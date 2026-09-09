#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// guard-fixtures.mjs — stdin-fixture tests for hooks/gs-admin-guard.mjs
//
// Builds throwaway workspaces (a `.gs-superadmin/` marker plus `*/_manifest.json`
// files) under the OS temp dir and pipes PreToolUse JSON into the hook, asserting
// on the permissionDecision / reason it emits. Never touches real state: no
// `gs-admin` invocation, no `~/.gs-admin`, no network.
//
// Run:  node plugins/gs-superadmin/test/guard-fixtures.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, symlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "gs-admin-guard.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-guard-fixtures-${process.pid}`);

function makeWorkspace(name, manifests) {
  const dir = join(ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, ".gs-superadmin"), { recursive: true });
  for (const m of manifests) {
    mkdirSync(join(dir, m.slug), { recursive: true });
    writeFileSync(join(dir, m.slug, "_manifest.json"), JSON.stringify(m));
  }
  return dir;
}

// A reply that does not parse is a RESULT, not a crashed suite. Both drivers
// below used to call JSON.parse bare, so a truncated reply — or a DOUBLED one,
// two objects written for a single payload, which is what a reply site emits
// once its halt is gone — threw a SyntaxError and took the whole run with it:
// a real red then read as a crashed suite instead of a FAIL line naming the
// site (F-369). The F-363 block already parsed defensively at its own probe for
// exactly this reason; this is that solution moved to where the drivers live.
// `parsed` separates "there was output and it was not JSON" from a silent
// pass — `decision` is null for both, and `raw` carries the bytes either way.
function parseReply(stdout) {
  const text = stdout.trim();
  if (!text) return { j: null, parsed: true }; // silent pass — nothing to parse
  try {
    return { j: JSON.parse(text), parsed: true };
  } catch {
    return { j: null, parsed: false };
  }
}

// `preload` is a CommonJS file passed as `node -r`: the F-372 case uses it to make
// process.stdout.write asynchronous (a macOS pipe's shape) on every OS.
function runHook(cwd, command, sessionId = "guard-fixtures", event = undefined, toolResponse = undefined, extra = {}, hookFile = HOOK, preload = null) {
  const input = JSON.stringify({
    tool_name: "Bash",
    tool_input: { command },
    cwd,
    session_id: sessionId,
    ...(event ? { hook_event_name: event } : {}),
    ...(toolResponse ? { tool_response: toolResponse } : {}),
    ...extra,
  });
  const res = spawnSync(process.execPath, [...(preload ? ["-r", preload] : []), hookFile], { input, encoding: "utf8" });
  const { j, parsed } = parseReply(res.stdout);
  return {
    decision: j?.hookSpecificOutput?.permissionDecision ?? null,
    reason: j?.hookSpecificOutput?.permissionDecisionReason ?? "",
    silent: res.stdout.trim() === "" && res.status === 0,
    parsed,
    raw: res.stdout.trim(),
    status: res.status,
    bytes: Buffer.byteLength(res.stdout),
  };
}

// Same assertions, but with the stdin bytes under the caller's control — the
// only way to exercise payload-encoding paths, since runHook serializes the
// JSON itself. `mutate` receives the serialized payload and returns what is
// actually written to the hook's stdin. Takes the same event/tool_response
// params as runHook so encoding paths are probeable on the journal lane too —
// F-112's defect was "no ask AND no journal", and a PreToolUse-only helper
// could pin only half of it (F-113).
function runHookRawStdin(cwd, command, mutate, sessionId = "guard-fixtures", event = undefined, toolResponse = undefined) {
  const payload = JSON.stringify({
    tool_name: "Bash",
    tool_input: { command },
    cwd,
    session_id: sessionId,
    ...(event ? { hook_event_name: event } : {}),
    ...(toolResponse ? { tool_response: toolResponse } : {}),
  });
  const res = spawnSync(process.execPath, [HOOK], { input: mutate(payload), encoding: "utf8" });
  const { j, parsed } = parseReply(res.stdout);
  return {
    decision: j?.hookSpecificOutput?.permissionDecision ?? null,
    reason: j?.hookSpecificOutput?.permissionDecisionReason ?? "",
    silent: res.stdout.trim() === "" && res.status === 0,
    parsed,
    raw: res.stdout.trim(),
    status: res.status,
    bytes: Buffer.byteLength(res.stdout),
  };
}

// A COPY of the hook with a controlled sibling layout, for fail-open paths the
// shipped plugin tree can't exercise (missing journal-lib, malformed
// ask-overrides — the shipped siblings are valid). `files` maps copy-root-
// relative paths to contents; `dirs` lists extra (empty) directories to create.
function isolatedHookCopy(name, files = {}, dirs = []) {
  const dir = join(ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "hooks"), { recursive: true });
  writeFileSync(join(dir, "hooks", "gs-admin-guard.mjs"), readFileSync(HOOK));
  for (const d of dirs) mkdirSync(join(dir, d), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return join(dir, "hooks", "gs-admin-guard.mjs");
}

const MUTATING = "gs-admin jo p save";
const READONLY = "gs-admin --json re rules list";
// The hook's redirection vocabulary, read ONCE out of its source (the F-436 and
// F-440 generated pins derive from it); guarded, so a reformatted array is a
// red line here rather than a TypeError mid-suite (the MEDIUM review).
const HOOK_REDIR_OPS = JSON.parse(/const REDIR_OPS = (\[[^\]]*\]);/.exec(readFileSync(HOOK, "utf8"))?.[1] ?? "[]");

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${detail}`);
  }
}

// ── Mutation guard: legacy manifests (no environment field) — heuristic ─────
let t = runHook(
  makeWorkspace("legacy-both", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com" },
    { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com" },
  ]),
  MUTATING
);
check("legacy pair: mutating asks", t.decision === "ask", t.raw);
check(
  "legacy pair: names both tenants",
  t.reason.includes("acme-prod") && t.reason.includes("acme-sbx"),
  t.reason
);
check("legacy pair: heuristic prod warning", t.reason.includes("looks like PRODUCTION"), t.reason);

t = runHook(
  makeWorkspace("legacy-sbx", [{ slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com" }]),
  MUTATING
);
check("legacy sandbox-only: asks, no prod warning", t.decision === "ask" && !t.reason.includes("PRODUCTION"), t.reason);

t = runHook(
  makeWorkspace("legacy-prod", [{ slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com" }]),
  MUTATING
);
check("legacy prod-only: prod warning", t.reason.includes("PRODUCTION"), t.reason);

// Regression: sandbox-ish SUBSTRINGS must not suppress the warning ("devon" ⊃ "dev")
t = runHook(
  makeWorkspace("legacy-devon", [
    { slug: "devon", baseUrl: "https://devon.gainsightcloud.com" },
    { slug: "devon-sbx", baseUrl: "https://devon--sbx.gainsightcloud.com" },
  ]),
  MUTATING
);
check("legacy devon+sbx: prod warning (substring regression)", t.reason.includes("PRODUCTION"), t.reason);

// Regression: 'prod' as a token mid-slug must match
t = runHook(
  makeWorkspace("legacy-prod-eu", [{ slug: "acme-prod-eu", baseUrl: "https://acme-eu.gainsightcloud.com" }]),
  MUTATING
);
check("legacy acme-prod-eu: prod warning (anchor regression)", t.reason.includes("PRODUCTION"), t.reason);

// Whole-token sandbox markers in URLs still recognized
t = runHook(
  makeWorkspace("legacy-uat-url", [{ slug: "acme2", baseUrl: "https://acme-uat.gainsightcloud.com" }]),
  MUTATING
);
check("legacy uat-in-URL: no prod warning", !t.reason.includes("PRODUCTION"), t.reason);

// Regression: bare 'stag' is a sandbox marker (old regex matched it; the first
// token-set rewrite dropped it, silencing the prod warning for this pair)
t = runHook(
  makeWorkspace("legacy-stag", [
    { slug: "acme-stag", baseUrl: "https://acme-stag.gainsightcloud.com" },
    { slug: "acme", baseUrl: "https://acme.gainsightcloud.com" },
  ]),
  MUTATING
);
check("legacy stag+neutral: prod warning on neutral sibling", t.reason.includes("looks like PRODUCTION"), t.reason);

// ── Mutation guard: recorded environment — exact, no guessing ───────────────
t = runHook(
  makeWorkspace("env-prod", [
    { slug: "acme-eu", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]),
  MUTATING
);
check("env=production (plain slug): 'recorded at setup' warning", t.reason.includes("PRODUCTION (recorded at setup)"), t.reason);

t = runHook(
  makeWorkspace("env-sbx", [
    { slug: "devon", baseUrl: "https://devon.gainsightcloud.com", environment: "sandbox" },
  ]),
  MUTATING
);
check("env=sandbox (tricky slug): no prod warning", !t.reason.includes("PRODUCTION"), t.reason);

t = runHook(
  makeWorkspace("env-mixed", [
    { slug: "acme", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
    { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
  ]),
  MUTATING
);
check("env mixed pair: 'recorded at setup' warning", t.reason.includes("PRODUCTION (recorded at setup)"), t.reason);

// Recorded sandbox + LEGACY neutral sibling: the recorded sandbox feeds the
// relative clause, so the legacy tenant is flagged — with heuristic-grade
// wording ("looks like"), never "recorded at setup" (no production recorded).
t = runHook(
  makeWorkspace("env-sbx-legacy", [
    { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
    { slug: "acme", baseUrl: "https://acme.gainsightcloud.com" },
  ]),
  MUTATING
);
check("recorded-sandbox + legacy neutral: heuristic prod warning", t.reason.includes("looks like PRODUCTION"), t.reason);
check("recorded-sandbox + legacy neutral: NOT 'recorded at setup' wording", !t.reason.includes("recorded at setup"), t.reason);

// ── Read-only commands pass silently ─────────────────────────────────────────
const envProdDir = makeWorkspace("readonly", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(envProdDir, READONLY);
check("read-only: silent pass-through", t.silent, t.raw);

// ── Outside a workspace the hook is inert ────────────────────────────────────
const bare = join(ROOT, "no-workspace");
rmSync(bare, { recursive: true, force: true });
mkdirSync(bare, { recursive: true });
t = runHook(bare, MUTATING);
check("no workspace: inert even for mutations", t.silent, t.raw);

// ── Pipe-safety lint (unique session id so tmpdir state can't leak) ──────────
const pipeDir = makeWorkspace("pipes", [
  { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
]);
const freshSid = () => `guard-fixtures-${randomUUID()}`;
const sid = freshSid();
const BROKEN = "gs-admin --json re rules list --search CS|Risk|Renewal|Alert";

t = runHook(pipeDir, BROKEN, sid);
check("unquoted pipe: first offense denied with quoting hint", t.decision === "deny" && /single-quote/i.test(t.reason), t.raw);

t = runHook(pipeDir, BROKEN, sid);
check("unquoted pipe: repeat escalates to ask", t.decision === "ask", t.raw);

t = runHook(pipeDir, "gs-admin --json re rules list --search 'CS|Risk|Renewal|Alert'", sid);
check("quoted pipe in read-only command: silent", t.silent, t.raw);

t = runHook(pipeDir, "gs-admin --json re rules list | jq '.items[0]'", sid);
check("pipe into recognized filter: not flagged", t.silent, t.raw);

// POSIX clipboard writers are recognized consumers (F-110 — pre-fix each of
// these drew a false first-offense deny on macOS/Linux).
for (const clipper of ["pbcopy", "xclip", "xsel", "wl-copy"]) {
  t = runHook(pipeDir, `gs-admin --json jo p list | ${clipper}`, freshSid());
  check(`pipe into ${clipper}: recognized clipboard consumer (silent)`, t.silent, t.raw);
}
// Consumer names normalize through the same launcher-suffix rule as the
// gs-admin word matcher (F-111 — pre-fix only `.exe` was stripped, so the
// suffixed spelling of a listed consumer drew a false deny).
t = runHook(pipeDir, "gs-admin --json re rules list | findstr.CMD x", freshSid());
check("pipe into findstr.CMD: launcher suffix normalized like built-ins (silent)", t.silent, t.raw);

// ── Lone-& lint (mirrors the pipe lint; `&&` chaining is never touched) ──────
const asid = freshSid();
const AMP_BROKEN = "gs-admin --json jo p list --search Sales & Marketing Renewals";

t = runHook(pipeDir, AMP_BROKEN, asid);
check(
  "unquoted lone &: first offense denied with quoting hint",
  t.decision === "deny" && /single-quote/i.test(t.reason) && t.reason.includes("`&`"),
  t.raw
);
t = runHook(pipeDir, AMP_BROKEN, asid);
check("unquoted lone &: repeat escalates to ask", t.decision === "ask", t.raw);

t = runHook(pipeDir, "gs-admin --json jo p list --search 'Sales & Marketing'", freshSid());
check("quoted & in read-only command: silent", t.silent, t.raw);

t = runHook(pipeDir, "gs-admin --json re rules list && gs-admin --json jo p list", freshSid());
check("&& chaining of read-only commands: untouched (silent)", t.silent, t.raw);

t = runHook(pipeDir, "gs-admin jo p save && gs-admin jo p publish", freshSid());
check(
  "&& chaining of mutations: plain mutation ask, no lint wording",
  t.decision === "ask" && !t.reason.includes("Unquoted"),
  t.raw
);

t = runHook(pipeDir, "gs-admin --json re rules list > out.json 2>&1", freshSid());
check("redirection &: 2>&1 not flagged", t.silent, t.raw);

t = runHook(pipeDir, "gs-admin --json re rules list &", freshSid());
check("trailing & (backgrounding): not flagged", t.silent, t.raw);

t = runHook(pipeDir, "(gs-admin --json re rules list &)", freshSid());
check("subshell backgrounding `(cmd &)`: not flagged", t.silent, t.raw);

// PowerShell call operator: `&` with a quoted RHS is deliberate syntax, not a
// name fragment — the lint skips it, and the mutation guard still sees the
// invocation (quoted or not: shellWords strips quotes before the word scan).
t = runHook(pipeDir, "gs-admin --json re rules list & gs-admin --json jo p list", freshSid());
check("& into a recognized program (parallel gs-admin): not flagged", t.silent, t.raw);
t = runHook(pipeDir, "& C:\\tools\\gs-admin jo p save", freshSid());
check("call-operator-style & before a gs-admin path: lint skipped, mutation still asks", t.decision === "ask", t.raw);
t = runHook(pipeDir, '& "C:\\tools\\gs-admin" jo p save', freshSid());
check("call operator with QUOTED gs-admin path: mutation still asks (gate accepts quotes)", t.decision === "ask", t.raw);
t = runHook(pipeDir, "'gs-admin' jo p save", freshSid());
check("bare quoted 'gs-admin' invocation: mutation still asks", t.decision === "ask", t.raw);

// `| $pager` / `| "quoted"` RHS is deliberate syntax for pipes too — the lint
// targets unquoted name fragments, which always resume with a literal word.
t = runHook(pipeDir, "gs-admin --json re rules list | $PAGER", freshSid());
check("pipe into a variable ($PAGER): deliberate syntax, not flagged", t.silent, t.raw);

// ── Workspace pipe-consumers (.gs-superadmin/pipe-consumers.json) ────────────
// Additive-only extension of the lint's accepted consumers (Finding H: piping
// into a user-defined function). It can never touch the mutation ask.
const consWs = makeWorkspace("pipe-consumers", [
  { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
]);
writeFileSync(
  join(consWs, ".gs-superadmin", "pipe-consumers.json"),
  JSON.stringify({ consumers: ["dump", "My-Filter.exe", 42, "scripts/"] })
);
t = runHook(consWs, "gs-admin --json re rules list | dump", freshSid());
check("workspace consumers: custom function accepted (| dump silent)", t.silent, t.raw);
t = runHook(consWs, "gs-admin --json re rules list | my-filter", freshSid());
check("workspace consumers: names normalized like built-ins (.exe stripped, case-folded)", t.silent, t.raw);
t = runHook(consWs, "gs-admin --json re rules list & dump", freshSid());
check("workspace consumers: the & lint accepts them too", t.silent, t.raw);
t = runHook(consWs, "gs-admin --json re rules list | not-listed", freshSid());
check("workspace consumers: non-listed word still denied (non-string entries skipped)", t.decision === "deny", t.raw);
// The "scripts/" entry normalizes to "" and must be REJECTED — otherwise it
// would silently accept every empty-RHS pipe (the "(end of command)" case).
t = runHook(consWs, "gs-admin --json re rules list --search CS|", freshSid());
check(
  "workspace consumers: empty-normalizing entry rejected (trailing | still denied)",
  t.decision === "deny" && t.reason.includes("(end of command)"),
  t.raw
);
t = runHook(consWs, MUTATING, freshSid());
check("workspace consumers: mutation ask unaffected", t.decision === "ask", t.raw);

// A UTF-8 BOM (PowerShell 5.1's default utf8 encoding) must not disable the file
const consBomWs = makeWorkspace("pipe-consumers-bom", [
  { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
]);
writeFileSync(
  join(consBomWs, ".gs-superadmin", "pipe-consumers.json"),
  "\uFEFF" + JSON.stringify({ consumers: ["dump"] })
);
t = runHook(consBomWs, "gs-admin --json re rules list | dump", freshSid());
check("workspace consumers: UTF-8 BOM tolerated", t.silent, t.raw);

// Malformed workspace file → ignored, built-ins only (fail-open)
const consBadWs = makeWorkspace("pipe-consumers-bad", [
  { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
]);
writeFileSync(join(consBadWs, ".gs-superadmin", "pipe-consumers.json"), "{ not json !!!");
t = runHook(consBadWs, "gs-admin --json re rules list | jq '.x'", freshSid());
check("malformed consumers file: built-in consumers still accepted", t.silent, t.raw);
t = runHook(consBadWs, "gs-admin --json re rules list | dump", freshSid());
check("malformed consumers file: ignored — custom name still denied", t.decision === "deny", t.raw);
writeFileSync(join(consBadWs, ".gs-superadmin", "pipe-consumers.json"), JSON.stringify({ consumers: "dump" }));
t = runHook(consBadWs, "gs-admin --json re rules list | dump", freshSid());
check("non-array consumers field: ignored — custom name still denied", t.decision === "deny", t.raw);

// ── Variable-subcommand coaching (guard can't inspect `gs-admin $cmd`) ───────
const vsid = `guard-fixtures-${randomUUID()}`;
const VARLOOP = 'for c in "re rules list" "sc list"; do gs-admin --json $c > .gs-superadmin/tmp/out.json; done';

t = runHook(pipeDir, VARLOOP, vsid);
check(
  "variable subcommand: first offense denied with literal-rewrite hint",
  t.decision === "deny" && /spelled\s+literally/i.test(t.reason),
  t.raw
);

t = runHook(pipeDir, VARLOOP, vsid);
check(
  "variable subcommand: repeat escalates to ask, names the variable",
  t.decision === "ask" && /shell variable/.test(t.reason) && t.reason.includes("gs-admin $c"),
  t.raw
);

t = runHook(pipeDir, "gs-admin --json re rules list --page $p > .gs-superadmin/tmp/re-rules-$p.json", vsid);
check("variables in flag values/paths only: silent pass-through", t.silent, t.raw);

t = runHook(pipeDir, "foreach ($cmd in $cmds) { gs-admin --json $cmd | Out-File $out }", `guard-fixtures-${randomUUID()}`);
check("variable subcommand (PowerShell foreach): denied on first offense", t.decision === "deny", t.raw);

// A variable after a literal namespace hides the subcommand just the same —
// it must get the literal-rewrite coaching, not the typo/newer-CLI prompt.
t = runHook(pipeDir, 'for c in "rules list" "chains list"; do gs-admin --json re $c; done', `guard-fixtures-${randomUUID()}`);
check(
  "variable after literal namespace (gs-admin re $c): coached, not typo-prompted",
  t.decision === "deny" && /spelled\s+literally/i.test(t.reason),
  t.raw
);

// Path-prefixed invocations must not slip past the cheap command gate — the
// word scanner accepts them, so the gate must too.
t = runHook(pipeDir, "./gs-admin jo p save", `guard-fixtures-${randomUUID()}`);
check("path-prefixed invocation (./gs-admin): mutating still asks", t.decision === "ask", t.raw);
t = runHook(pipeDir, "C:\\tools\\gs-admin jo p save", `guard-fixtures-${randomUUID()}`);
check("path-prefixed invocation (C:\\tools\\gs-admin): mutating still asks", t.decision === "ask", t.raw);

// Suffix-spelled invocations are the same CLI — on Windows the npm shims are
// gs-admin.cmd / gs-admin.ps1 — and must not slip past the gate or the word
// scanner: mutating suffixed forms ask, read-only ones stay silent, and
// unrelated words that merely end in gs-admin-like text never match.
t = runHook(pipeDir, "gs-admin.cmd jo p save", freshSid());
check("suffixed shim (gs-admin.cmd): mutating still asks", t.decision === "ask", t.raw);
t = runHook(pipeDir, "C:\\tools\\gs-admin.exe jo p save", freshSid());
check("path-prefixed suffixed (C:\\tools\\gs-admin.exe): mutating still asks", t.decision === "ask", t.raw);
t = runHook(pipeDir, '& "C:\\tools\\gs-admin.ps1" jo p save', freshSid());
check("call operator with QUOTED gs-admin.ps1 path: mutating still asks", t.decision === "ask", t.raw);
t = runHook(pipeDir, "gs-admin.CMD jo p save", freshSid());
check("launcher suffix matched case-insensitively (gs-admin.CMD): mutating still asks", t.decision === "ask", t.raw);
t = runHook(pipeDir, "gs-admin.cmd --json re rules list", freshSid());
check("suffixed read-only: silent pass-through", t.silent, t.raw);
t = runHook(pipeDir, "backup-gs-admin.cmd jo p save", freshSid());
check("unrelated word ending in gs-admin-like text (backup-gs-admin.cmd): silent", t.silent, t.raw);

// ── Case-folded binary matching (OS-portability wave 1, F-109) ───────────────
// Windows and macOS filesystems are case-insensitive: `GS-Admin jo p save`
// runs the same CLI as the lowercase spelling. Pre-fix, BOTH the cheap
// substring gate (case-sensitive includes) and isGsAdminWord's name compare
// were case-sensitive, so every payload below was SILENT — no mutation ask
// and no journal entry, on a real mutation (fail-open). The whole binary
// word now case-folds, unconditionally on every OS (no process.platform
// branch — see the hook's comment for why). Prod-marked workspace so the
// asks carry the full warning surface.
const caseWs = makeWorkspace("case-fold", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
for (const [label, cmd] of [
  ["all-caps bare", "GS-ADMIN jo p save"],
  ["mixed-case bare", "Gs-Admin jo p save"],
  ["all-caps .CMD shim", "GS-ADMIN.CMD jo p save"],
  ["mixed-case .Ps1 shim", "Gs-Admin.Ps1 jo p save"],
  ["all-caps .BAT launcher", "GS-ADMIN.BAT jo p save"],
  ["path-prefixed all-caps shim", "C:\\x\\GS-ADMIN.CMD jo p save"],
  ["call operator, quoted all-caps path", '& "C:\\npm\\GS-ADMIN.CMD" jo p save'],
]) {
  t = runHook(caseWs, cmd, freshSid());
  // Pin the FULL warning surface per spelling, not just the ask (F-114): the
  // resolved canonical catalog path proves every folded spelling reaches the
  // same catalog match, and the PRODUCTION clause is the reason this loop
  // runs in a prod-marked workspace at all.
  check(
    `case fold (${label}): mutating asks with resolved path + PRODUCTION warning`,
    t.decision === "ask" &&
      t.reason.includes("Mutating Gainsight command: gs-admin journey programs save") &&
      t.reason.includes("PRODUCTION"),
    `${cmd} -> ${t.raw}`
  );
}
// Read-side symmetry: folding the binary word must not manufacture asks.
t = runHook(caseWs, "GS-ADMIN --json re rules list", freshSid());
check("case fold: all-caps read-only stays silent", t.silent, t.raw);
// Catalog SUBCOMMAND matching stays case-sensitive — an uppercase subcommand
// is not a catalog path and must land on the fail-closed unrecognized ask,
// never resolve to the mutation (and never pass silently). Pinned so nobody
// "fixes" it into case-folded catalog paths.
t = runHook(caseWs, "gs-admin JO P SAVE", freshSid());
check(
  "case fold: uppercase SUBCOMMAND stays case-sensitive (fail-closed unrecognized ask)",
  t.decision === "ask" &&
    t.reason.includes("Unrecognized gs-admin command") &&
    !t.reason.includes("Mutating Gainsight command"),
  t.raw
);
// The unrelated-word negative must survive the fold: case-folding widens the
// accepted casings of gs-admin, never what counts as the gs-admin word.
t = runHook(caseWs, "BACKUP-GS-ADMIN.CMD jo p save", freshSid());
check("case fold: unrelated all-caps word (BACKUP-GS-ADMIN.CMD) still silent", t.silent, t.raw);

// ── Payload BOM tolerance (OS-portability wave 1, F-112) ─────────────────────
// A leading UTF-8 BOM on the stdin payload made `JSON.parse` throw, and the
// hook's catch exits 0 — so one invisible byte turned the guard globally inert
// on a real mutation: no ask, no journal, no diagnostic. Windows toolchains
// emit a BOM routinely, so any wrapper re-encoding the payload en route was
// enough. Written as an escape, never a literal, so the assertion stays
// visible to a reader and to grep.
const BOM = "\uFEFF";
const bomAsk = runHookRawStdin(caseWs, MUTATING, (p) => BOM + p, freshSid());
check(
  "BOM payload: mutation still asks (guard is not silenced by the byte)",
  bomAsk.decision === "ask" && bomAsk.reason.includes("Mutating Gainsight command"),
  bomAsk.raw
);
// The strip is leading-only and must not perturb an ordinary payload: same
// command with no BOM, and with a BOM plus the trailing CRLF a Windows pipe
// also adds, must reach the identical decision.
t = runHookRawStdin(caseWs, MUTATING, (p) => BOM + p + "\r\n", freshSid());
check(
  "BOM payload: BOM + trailing CRLF also asks",
  t.decision === "ask" && t.reason.includes("Mutating Gainsight command"),
  t.raw
);
// Full-reason equality, not just the decision \u2014 "identical decision" is the
// contract, and a decision-only control was the weakest link in the trio
// (F-113). The reason is deterministic for a fixed workspace, so equality is
// exactly what tolerance-must-not-perturb means.
t = runHookRawStdin(caseWs, MUTATING, (p) => p, freshSid());
check(
  "BOM payload: un-prefixed control asks with the identical reason",
  t.decision === "ask" && t.reason === bomAsk.reason,
  JSON.stringify({ control: t.reason, bom: bomAsk.reason })
);
// Read-only symmetry: tolerating the BOM must not manufacture an ask, and a
// genuinely unparseable payload must still fail open silently (unchanged).
t = runHookRawStdin(caseWs, READONLY, (p) => BOM + p, freshSid());
check("BOM payload: read-only stays silent", t.silent, t.raw);
t = runHookRawStdin(caseWs, MUTATING, (p) => BOM + p.slice(0, p.length - 3), freshSid());
check("BOM payload: still-malformed JSON fails open silently", t.silent, t.raw);
// Leading-only, single-BOM semantics, pinned from both directions (F-113 \u2014
// mutation testing showed a strip widened to "swallow any leading junk" or to
// a GLOBAL BOM strip survived the whole suite: the malformed-JSON fixture
// above corrupts the tail while the fix guards the head). Junk that is not
// exactly one leading BOM is malformed input and must keep failing open
// silently; a wider strip would turn either payload into an ask and fail here.
t = runHookRawStdin(caseWs, MUTATING, (p) => "x" + p, freshSid());
check("BOM payload: leading non-BOM junk stays silent (strip must not widen)", t.silent, t.raw);
t = runHookRawStdin(caseWs, MUTATING, (p) => BOM + BOM + p, freshSid());
check("BOM payload: double BOM stays silent (strip is single-leading-only)", t.silent, t.raw);
// The journal half of F-112's contract ("no ask AND no journal"): a BOM'd
// PostToolUse mutation must journal exactly like a clean payload. Pre-fix this
// was the silently-lost durable history; the ask half alone cannot pin it.
{
  const bws = makeWorkspace("journal-bom", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  t = runHookRawStdin(bws, MUTATING, (p) => BOM + p, freshSid(), "PostToolUse", { exit_code: 0 });
  // join()'d inline: the journalOf helper is declared further down, with the
  // journal section it belongs to.
  const bJrnPath = join(bws, "acme-prod", "changes", "JOURNAL.md");
  const bJrn = existsSync(bJrnPath) ? readFileSync(bJrnPath, "utf8") : "";
  check(
    "BOM payload: PostToolUse mutation still journals (the no-journal half of F-112)",
    t.silent && bJrn.includes("journey programs save") && bJrn.includes("- outcome: exit 0"),
    bJrn || t.raw
  );
}

// ── Change journal (PostToolUse) ─────────────────────────────────────────────
// PostToolUse only fires for a command that actually ran — i.e. the guard's ask
// was approved (or no prompt was needed). Denial means no PostToolUse at all,
// which is why "denied write → no journal entry" is tested via the PreToolUse
// path leaving no file behind.
const journalOf = (ws, slug) => join(ws, slug, "changes", "JOURNAL.md");

// Denied write → no entry: the PreToolUse ask (already asserted above on this
// fixture shape) must not itself write anything.
let ws = makeWorkspace("journal-denied", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(ws, MUTATING);
check("journal: PreToolUse ask writes no journal", t.decision === "ask" && !existsSync(journalOf(ws, "acme-prod")), t.raw);

// Approved write (single tenant, no active change plan) → entry with all fields
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse");
check("journal: approved mutation is silent on stdout", t.silent, t.raw);
check("journal: file created at <slug>/changes/JOURNAL.md", existsSync(journalOf(ws, "acme-prod")), ws);
let jrn = existsSync(journalOf(ws, "acme-prod")) ? readFileSync(journalOf(ws, "acme-prod"), "utf8") : "";
check("journal: header names the tenant", jrn.startsWith("# Change journal — acme-prod"), jrn.slice(0, 80));
check("journal: entry has ISO timestamp heading", /## \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(jrn), jrn);
check("journal: entry records operator", /- operator: \S+/.test(jrn), jrn);
check("journal: entry records the command", jrn.includes(`- command: ${MUTATING}`), jrn);
check("journal: system-area mapped to X-2 vocabulary (jo → gs-journey)", jrn.includes("- system-area: gs-journey"), jrn);
check("journal: catalog action + mutating flag recorded", /- action: journey .*\(catalog v.*, mutating\)/.test(jrn), jrn);
check("journal: no active plan → ticket none", jrn.includes("- ticket: none · plan: none") && jrn.includes("· no-ticket"), jrn);
check("journal: kb-snapshot references the tenant KB", jrn.includes("- kb-snapshot: acme-prod/journey/"), jrn);
check(
  "journal: explicit PostToolUse with no exit code → success-event wording (the event IS the success signal)",
  jrn.includes("- outcome: completed (success event; no exit code reported)"),
  jrn
);

// The journal's two writers — this hook and scripts/journal.mjs journal-append
// (the change-request skill's verb) — share journal-lib's emitters. This
// check compares the two writers' runtime FILE HEADERS only (the entry
// frame is pinned by contract-conformance's T-4 section, which executes
// both writers): whichever creates the file first must produce the
// identical header, compared as RUNTIME output so write-path mangling
// fails here too.
const JOURNAL_SCRIPT = join(HOOK, "..", "..", "scripts", "journal.mjs");
const scriptWs = makeWorkspace("journal-script-header", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
mkdirSync(join(scriptWs, "acme-prod", "changes"), { recursive: true });
writeFileSync(join(scriptWs, "acme-prod", "changes", "2026-07-02-test-plan.md"), "# plan\n");
const sres = spawnSync(
  process.execPath,
  [JOURNAL_SCRIPT, "journal-append",
    "--slug", "acme-prod", "--plan", "acme-prod/changes/2026-07-02-test-plan.md",
    "--ticket", "CSOPS-142", "--system-area", "gs-rules", "--outcome", "executed",
    "--asset", "CREATE X (1I00ABC) — KB doc pending next /gs-superadmin:refresh"],
  { cwd: scriptWs, encoding: "utf8" }
);
check("journal: journal-append verb exits 0 on a fresh journal", sres.status === 0, sres.stderr || sres.stdout);
const scriptJrn = existsSync(journalOf(scriptWs, "acme-prod")) ? readFileSync(journalOf(scriptWs, "acme-prod"), "utf8") : "";
const hookHeader = jrn.slice(0, jrn.indexOf("## "));
const scriptHeader = scriptJrn.slice(0, scriptJrn.indexOf("## "));
check(
  "journal: hook and journal-append create byte-identical file headers",
  hookHeader.length > 0 && hookHeader === scriptHeader,
  JSON.stringify({ hookHeader, scriptHeader })
);

// F-292: a --system-area that clamps to empty (whitespace-only here; any
// value with no printable ASCII hits the same) passes the raw presence check
// but must fail the verb's fail() + JSON contract — a named one-liner on
// stderr, never the frame's raw uncaught stack trace.
const sres292 = spawnSync(
  process.execPath,
  [JOURNAL_SCRIPT, "journal-append",
    "--slug", "acme-prod", "--plan", "acme-prod/changes/2026-07-02-test-plan.md",
    "--ticket", "CSOPS-142", "--system-area", " ", "--outcome", "executed",
    "--asset", "CREATE X (1I00ABC) — KB doc pending next /gs-superadmin:refresh"],
  { cwd: scriptWs, encoding: "utf8" }
);
check("journal: --system-area clamping to empty fails the verb LOUD — fail() one-liner, no frame stack (F-292)",
  sres292.status === 1 && sres292.stderr.includes("clamps to empty") &&
    !sres292.stderr.includes("composeJournalEntry"),
  sres292.stderr || sres292.stdout);

// Outcome comes from tool_response.exit_code — a failed command must journal
// as a failed attempt, never read as an applied change
ws = makeWorkspace("journal-outcome", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse", { exit_code: 0, stdout: "", stderr: "" });
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: exit_code 0 → outcome exit 0", jrn.includes("- outcome: exit 0"), jrn);

// Harness variants: exit status at the payload top level (current docs' shape),
// and PostToolUse inferred from tool_response when hook_event_name is absent.
ws = makeWorkspace("journal-toplevel-exit", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse", { stdout: "", stderr: "" }, { exit_code: 3 });
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: top-level exit_code shape detected (exit 3 → FAILED)", jrn.includes("- outcome: exit 3 — command FAILED"), jrn);

ws = makeWorkspace("journal-inferred-post", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(ws, MUTATING, "guard-fixtures", undefined, { exit_code: 0, stdout: "" });
check(
  "journal: absent hook_event_name with tool_response infers PostToolUse (journals, no post-hoc ask)",
  t.silent && existsSync(journalOf(ws, "acme-prod")),
  t.raw
);
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse", { exit_code: 1, stdout: "", stderr: "auth expired" });
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: non-zero exit → outcome FAILED", jrn.includes("- outcome: exit 1 — command FAILED; this change likely did not apply"), jrn);
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse", { interrupted: true, stdout: "", stderr: "" });
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: interrupted → outcome interrupted", jrn.includes("- outcome: interrupted — may not have completed"), jrn);

// ── PostToolUseFailure (the failure event): an approved command that ran and
// FAILED must journal as a FAILED attempt. Current-docs payload shape: no
// tool_response, a tool_error string instead.
ws = makeWorkspace("journal-failure-event", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUseFailure", undefined, {
  tool_error: "Command failed with exit code 1",
});
check("journal: failure event is silent on stdout (never a post-hoc ask)", t.silent, t.raw);
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check(
  "journal: failure event → outcome FAILED with clamped tool_error detail",
  jrn.includes("- outcome: FAILED (tool call failed: Command failed with exit code 1) — this change likely did not apply"),
  jrn
);

// tool_error is untrusted payload text: newlines and oversize must be clamped
// (single printable line, capped) before landing in the journal.
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUseFailure", undefined, {
  tool_error: "line one\nline two\n" + "x".repeat(500),
});
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
const failedLines = jrn.split("\n").filter((l) => l.startsWith("- outcome: FAILED (tool call failed: line one"));
check(
  "journal: failure-event tool_error clamped to one printable line, capped length",
  failedLines.length === 1 && failedLines[0].includes("line one line two") && failedLines[0].length < 300,
  failedLines
);

// Failure event with no tool_error at all still journals FAILED
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUseFailure");
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check(
  "journal: failure event without tool_error → plain FAILED outcome",
  jrn.includes("- outcome: FAILED (tool call failed) — this change likely did not apply"),
  jrn
);

// Failure event for a read-only command appends nothing (same rule as PostToolUse)
const beforeFail = readFileSync(journalOf(ws, "acme-prod"), "utf8");
t = runHook(ws, READONLY, "guard-fixtures", "PostToolUseFailure", undefined, { tool_error: "boom" });
check(
  "journal: failure event for read-only command appends nothing",
  t.silent && readFileSync(journalOf(ws, "acme-prod"), "utf8") === beforeFail,
  t.raw
);

// Graceful degradation: an inferred PostToolUse (older harness — no
// hook_event_name, tool_response without exit status) keeps the honest
// pre-0.12.0 "not verified" wording; those harnesses' failure semantics are
// unknown, so their success event must not claim "completed".
ws = makeWorkspace("journal-inferred-noexit", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(ws, MUTATING, "guard-fixtures", undefined, { stdout: "", stderr: "" });
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check(
  "journal: inferred PostToolUse without exit code keeps 'not verified' (older-harness degradation)",
  jrn.includes("- outcome: not verified (harness reported no exit status)"),
  jrn
);

// Read-only command → no entry appended
const before = readFileSync(journalOf(ws, "acme-prod"), "utf8");
t = runHook(ws, READONLY, "guard-fixtures", "PostToolUse");
check("journal: read-only command appends nothing", t.silent && readFileSync(journalOf(ws, "acme-prod"), "utf8") === before, t.raw);

// Active change plan marker → ticket key, plan path, and Jira key in the heading
ws = makeWorkspace("journal-marker", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
writeFileSync(join(ws, ".gs-superadmin", "active-change.json"), JSON.stringify({
  ticket: "CSOPS-142",
  plan: "acme-prod/changes/2026-07-02-enterprise-nps-risk-cta.md",
  slug: "acme-prod",
  started_at: new Date().toISOString(),
}));
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse");
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: marker stamps ticket + plan", jrn.includes("- ticket: CSOPS-142 · plan: acme-prod/changes/2026-07-02-enterprise-nps-risk-cta.md"), jrn);
check("journal: ticket key grep-able from the heading", /## .*· CSOPS-142/.test(jrn), jrn);

// Stale marker (> 24 h) is ignored — no mis-attribution to a spent plan
ws = makeWorkspace("journal-stale-marker", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
writeFileSync(join(ws, ".gs-superadmin", "active-change.json"), JSON.stringify({
  ticket: "CSOPS-142",
  plan: "acme-prod/changes/old.md",
  slug: "acme-prod",
  started_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
}));
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse");
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: stale marker ignored (ticket none)", jrn.includes("- ticket: none · plan: none"), jrn);

// Future-dated marker (beyond small clock skew) is ignored too
ws = makeWorkspace("journal-future-marker", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
writeFileSync(join(ws, ".gs-superadmin", "active-change.json"), JSON.stringify({
  ticket: "CSOPS-142",
  plan: "acme-prod/changes/future.md",
  slug: "acme-prod",
  started_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
}));
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse");
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: future-dated marker ignored (ticket none)", jrn.includes("- ticket: none · plan: none"), jrn);

// Multi-tenant, no marker → catch-all file, never a guessed tenant journal
ws = makeWorkspace("journal-multi", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
]);
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse");
check(
  "journal: ambiguous tenant → unattributed catch-all only",
  existsSync(join(ws, ".gs-superadmin", "JOURNAL-unattributed.md")) &&
    !existsSync(journalOf(ws, "acme-prod")) && !existsSync(journalOf(ws, "acme-sbx")),
  ws
);

// Multi-tenant WITH marker slug → the marker's tenant journal (matched
// case-insensitively — the marker is LLM-written)
writeFileSync(join(ws, ".gs-superadmin", "active-change.json"), JSON.stringify({
  ticket: "CSOPS-150",
  plan: "acme-sbx/changes/2026-07-06-test.md",
  slug: "Acme-SBX",
  started_at: new Date().toISOString(),
}));
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse");
check("journal: marker slug resolves multi-tenant attribution (case-insensitive)", existsSync(journalOf(ws, "acme-sbx")), ws);

// Unknown-to-catalog command → journaled fail-closed with unknown system-area
ws = makeWorkspace("journal-unknown", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(ws, "gs-admin newdomain frobnicate --id 7", "guard-fixtures", "PostToolUse");
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: unknown command journaled fail-closed", jrn.includes("- system-area: unknown") && /journaled fail-closed/.test(jrn), jrn);

// Approved variable-subcommand command (PostToolUse = the ask was approved) →
// journaled fail-closed too: it may have mutated, so it must leave a trace
t = runHook(ws, VARLOOP, "guard-fixtures", "PostToolUse");
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: approved variable subcommand journaled fail-closed", /journaled fail-closed.*gs-admin \$c/.test(jrn), jrn);

// Suffix-spelled invocations journal like the bare name — an approved
// gs-admin.cmd / path-prefixed .exe mutation must leave the same trace, and a
// suffixed read-only command must append nothing.
ws = makeWorkspace("journal-suffixed", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(ws, "gs-admin.cmd jo p save", "guard-fixtures", "PostToolUse");
check("journal: suffixed shim mutation is silent on stdout", t.silent, t.raw);
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: suffixed shim (gs-admin.cmd) journaled", jrn.includes("- command: gs-admin.cmd jo p save"), jrn);
t = runHook(ws, "C:\\tools\\gs-admin.exe jo p save", "guard-fixtures", "PostToolUse");
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: path-prefixed gs-admin.exe journaled", jrn.includes("- command: C:\\tools\\gs-admin.exe jo p save"), jrn);
const sufBefore = readFileSync(journalOf(ws, "acme-prod"), "utf8");
t = runHook(ws, "gs-admin.cmd --json re rules list", "guard-fixtures", "PostToolUse");
check(
  "journal: suffixed read-only command appends nothing",
  t.silent && readFileSync(journalOf(ws, "acme-prod"), "utf8") === sufBefore,
  t.raw
);

// Case-folded spellings journal like the bare name (F-109's journal half —
// pre-fix the case-sensitive cheap gate exited before the PostToolUse branch
// could run, so an approved `GS-Admin jo p save` left NO trace).
ws = makeWorkspace("journal-case-fold", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(ws, "GS-Admin jo p save", "guard-fixtures", "PostToolUse");
check("journal: case-folded mutation is silent on stdout", t.silent, t.raw);
check("journal: case-folded mutation (GS-Admin) journaled", existsSync(journalOf(ws, "acme-prod")), ws);
jrn = existsSync(journalOf(ws, "acme-prod")) ? readFileSync(journalOf(ws, "acme-prod"), "utf8") : "";
check("journal: case-folded entry records the command as typed", jrn.includes("- command: GS-Admin jo p save"), jrn);
check("journal: case-folded entry resolves the catalog path", jrn.includes("journey programs save"), jrn);
// Mirror of the suffixed-journal block's negative (F-114): folding widens
// which spellings of the BINARY are recognized, never what counts as a
// mutation — a case-folded read-only command must append nothing.
const cfBefore = readFileSync(journalOf(ws, "acme-prod"), "utf8");
t = runHook(ws, "GS-ADMIN --json re rules list", "guard-fixtures", "PostToolUse");
check(
  "journal: case-folded read-only command appends nothing",
  t.silent && readFileSync(journalOf(ws, "acme-prod"), "utf8") === cfBefore,
  t.raw
);

// Two mutating invocations in one command → two entries
ws = makeWorkspace("journal-two", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(ws, "gs-admin jo p save && gs-admin jo p publish", "guard-fixtures", "PostToolUse");
jrn = readFileSync(journalOf(ws, "acme-prod"), "utf8");
check("journal: one entry per mutating invocation", (jrn.match(/- kind: command \(guard-approved\)/g) ?? []).length === 2, jrn);

// Outside a workspace: PostToolUse inert too
t = runHook(bare, MUTATING, "guard-fixtures", "PostToolUse");
check("journal: no workspace → inert on PostToolUse", t.silent, t.raw);

// The journal's fail-open promise: journal-lib.mjs is imported lazily INSIDE
// the journalMutations try, so a missing/corrupt lib must degrade to the
// systemMessage alert — never a crashed hook. Exercise it with a COPY of the
// hook whose ../scripts/ has no journal-lib.mjs (its ../reference/ is gone
// too, so the fixture workspace supplies a minimal catalog).
const isoHook = isolatedHookCopy("hook-isolated", {}, ["scripts"]); // scripts/ present but empty
ws = makeWorkspace("journal-lib-missing", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
writeFileSync(join(ws, ".gs-superadmin", "catalog.json"), JSON.stringify({
  meta: { cliVersion: "0.0.0" },
  globalFlags: [],
  domains: [{ namespace: "journey", aliases: ["jo"] }],
  commands: [{ path: "journey programs save", shortPath: "jo p save", domain: "journey", mutating: true }],
}));
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse", { exit_code: 0, stdout: "", stderr: "" }, {}, isoHook);
check(
  "journal: missing journal-lib degrades to systemMessage alert (fail-open, exit 0)",
  t.status === 0 && t.raw.includes("systemMessage") && t.raw.includes("failed to record"),
  t.raw
);

// F-372: the same alert under an ASYNCHRONOUS stdout — a preload shim defers
// every write one tick (the shape of a macOS pipe, reproduced on every OS).
// The alert used to be written and then exited past by the caller's
// process.exit(0), so under the shim it never reached the harness at all;
// the two journal alerts now exit in the write callback like the three
// PreToolUse replies (F-363). Predicted before the fix: EMPTY stdout here.
const SHIM = join(ROOT, "async-stdout.cjs");
writeFileSync(SHIM, [
  "// makes process.stdout.write asynchronous: the chunk lands on a later tick, then the callback fires",
  "const real = process.stdout.write.bind(process.stdout);",
  "process.stdout.write = (chunk, enc, cb) => {",
  '  if (typeof enc === "function") { cb = enc; enc = undefined; }',
  "  setImmediate(() => real(chunk, enc, cb));",
  "  return true;",
  "};",
  "",
].join("\n"));
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse", { exit_code: 0, stdout: "", stderr: "" }, {}, isoHook, SHIM);
check(
  "F-372: the PostToolUse journal alert arrives WHOLE under an async stdout (exit in the write callback, exit 0)",
  t.status === 0 && t.parsed && t.raw.includes("systemMessage") && t.raw.includes("failed to record"),
  `${t.bytes} bytes, exit ${t.status}, parsed ${t.parsed}: ${t.raw.slice(0, 120)}`
);
t = runHook(ws, MUTATING, "guard-fixtures-shim", undefined, undefined, {}, HOOK, SHIM);
check(
  "F-372 control: a PreToolUse ask arrives WHOLE under the same async stdout (F-363's callback exit, measured on this OS)",
  t.status === 0 && t.parsed && t.decision === "ask",
  `${t.bytes} bytes, exit ${t.status}, decision ${t.decision}`
);

// STALE journal-lib (present, but pre-0.31.6 — no composeJournalEntry
// export): dynamic-import destructuring yields undefined without throwing,
// so the failure lands at the call site — it must still degrade to the same
// alert, never a crashed hook. (Mixed-version trees are unsupported, but a
// hand-vendored hook beside older scripts is exactly how F-212's phantom
// symptom arose; the degradation shape is the contract.)
const staleHook = isolatedHookCopy("hook-stale-journal-lib", {
  "scripts/journal-lib.mjs":
    'export function journalHeader(slug) { return `# Change journal — ${slug}\\n\\n`; }\n' +
    "export const oneLine = (v, cap) => String(v).slice(0, cap);\n",
});
ws = makeWorkspace("journal-lib-stale", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
writeFileSync(join(ws, ".gs-superadmin", "catalog.json"), JSON.stringify({
  meta: { cliVersion: "0.0.0" },
  globalFlags: [],
  domains: [{ namespace: "journey", aliases: ["jo"] }],
  commands: [{ path: "journey programs save", shortPath: "jo p save", domain: "journey", mutating: true }],
}));
t = runHook(ws, MUTATING, "guard-fixtures", "PostToolUse", { exit_code: 0, stdout: "", stderr: "" }, {}, staleHook);
check(
  // F-291 moved compose-time failures to the per-entry alert ("could not be
  // composed", with a count and the first cause) — the degradation SHAPE is
  // the contract here: exit 0, a systemMessage naming the journal failure,
  // never a crashed hook.
  "journal: STALE journal-lib (no composeJournalEntry export) degrades to a journaling alert (fail-open, exit 0)",
  t.status === 0 && t.raw.includes("systemMessage") &&
    (t.raw.includes("failed to record") || t.raw.includes("could not be composed")),
  t.raw
);

// F-291: a degenerate workspace-catalog value must cost at most its OWN
// entry, never the invocation's other approved mutations. An empty-string
// domain journals as "unknown" (oneLine + `||` at the area site — bare `??`
// let "" through to the frame, whose throw escaped the loop and lost the
// WHOLE batch: alert, no file, the well-formed sibling entry discarded).
ws = makeWorkspace("journal-batch-resilience", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
writeFileSync(join(ws, ".gs-superadmin", "catalog.json"), JSON.stringify({
  meta: { cliVersion: "0.0.0" },
  globalFlags: [],
  // The empty-domain command must resolve as a real catalog HIT (its first
  // token maps through domains[]), so the "" lands on h.cmd.domain at the
  // area site — an unresolvable token would fall to the unknowns path, whose
  // hardcoded "unknown" area would fake this case green under the mutant.
  domains: [{ namespace: "journey", aliases: ["jo"] }, { namespace: "rules-engine", aliases: ["re"] }],
  commands: [
    { path: "journey programs save", shortPath: "jo p save", domain: "journey", mutating: true },
    { path: "rules-engine rule delete", shortPath: "re rule delete", domain: "", mutating: true },
  ],
}));
t = runHook(ws, "gs-admin jo p save && gs-admin re rule delete r1", "guard-fixtures", "PostToolUse", { exit_code: 0, stdout: "", stderr: "" });
jrn = existsSync(journalOf(ws, "acme-prod")) ? readFileSync(journalOf(ws, "acme-prod"), "utf8") : "";
check("journal: empty-string domain HIT journals as unknown — the batch is never thrown away (F-291)",
  jrn.includes("- action: rules-engine rule delete (catalog v0.0.0, mutating)") &&
    jrn.includes("· unknown ·") && jrn.includes("- system-area: unknown"),
  t.raw + " | " + jrn.slice(0, 600));
check("journal: the sibling entry in the same invocation is still recorded (F-291)",
  jrn.includes("- system-area: gs-journey"), jrn);

// F-291 + F-293, the partial-batch shape: a catalog value the frame REJECTS
// outright (a `path` carrying a raw CR — a LineTerminator the field check
// refuses; cmdKey prefers path, so it reaches the `- action:` line) costs its
// own entry and raises the per-entry alert, while the sibling entry still
// lands. Pre-F-291 the throw escaped the loop: no file, no sibling entry.
// CR via fromCharCode ONLY (the F-130 rule).
const crChar = String.fromCharCode(0x0d);
ws = makeWorkspace("journal-batch-partial", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
writeFileSync(join(ws, ".gs-superadmin", "catalog.json"), JSON.stringify({
  meta: { cliVersion: "0.0.0" },
  globalFlags: [],
  domains: [{ namespace: "journey", aliases: ["jo"] }, { namespace: "zz", aliases: [] }],
  commands: [
    { path: "journey programs save", shortPath: "jo p save", domain: "journey", mutating: true },
    { path: "zz thing" + crChar + " delete", shortPath: "zz thing delete", domain: "zz", mutating: true },
  ],
}));
t = runHook(ws, "gs-admin jo p save && gs-admin zz thing delete", "guard-fixtures", "PostToolUse", { exit_code: 0, stdout: "", stderr: "" });
jrn = existsSync(journalOf(ws, "acme-prod")) ? readFileSync(journalOf(ws, "acme-prod"), "utf8") : "";
check("journal: frame-rejected hit costs ONLY its own entry — sibling recorded, alert says the rest landed (F-291/F-293)",
  t.raw.includes("could not be composed") && t.raw.includes("The other entries were recorded") &&
    jrn.includes("- system-area: gs-journey") &&
    (jrn.match(/^## /gm) || []).length === 1 && !jrn.includes("· zz ·"),
  t.raw + " | " + jrn.slice(0, 400));

// ── Ask-overrides: verified upstream `mutating` mislabels (self-retiring) ────
// The shipped hooks/ask-overrides.json is EMPTY since CLI 1.0.8: upstream
// flipped all 39 mislabeled writers to `mutating: true` (gs-fortress audit of
// 1.0.8), so every one of the eleven entries self-retired and was deleted.
// Two layers stay under test:
//   1. Real hook + bundled 1.0.8 catalog — the former override paths now ask
//      from the catalog itself, with the PLAIN mutating prompt, no mislabel
//      wording, exactly one prompt (the self-retire promise, observed for
//      real).
//   2. The override MECHANISM — kept because a future release can mislabel
//      again (the manifest schema still defaults `mutating` to false).
//      Tested on an isolated hook copy carrying a SYNTHETIC ask-overrides.json
//      (entries modeled verbatim on the retired real ones) against a synthetic
//      catalog still carrying the mislabels, preserving the pre-1.0.8
//      coverage: fire wording, the unlessArgPresent exemption
//      (exact-token-only), F-085 (no doubled period, both branches), F-089
//      (one paragraph per repeated override), the journal override line, and
//      the self-retiring predicate itself.
const RUNNOW = "gs-admin re r run-now --id 12345678-aaaa-bbbb-cccc-000000000000";
const ovWs = makeWorkspace("ask-override", [
  { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
]);

// Layer 1 — bundled 1.0.8 catalog: former override paths ask PLAIN.
t = runHook(ovWs, RUNNOW, freshSid());
check("ask-override retired (1.0.8): bare run-now asks from the catalog", t.decision === "ask", t.raw);
check(
  "ask-override retired (1.0.8): plain mutating wording, no mislabel paragraph",
  t.reason.includes("Mutating Gainsight command") && !t.reason.includes("mislabel"),
  t.reason
);
// 1.0.8 audit §1.10: with the entry gone, unlessArgPresent no longer exists
// for run-now — the safe mode PROMPTS too now (an added ask, the safe
// direction; the exemption mechanics live on in the synthetic layer below).
t = runHook(ovWs, `${RUNNOW} --test-run`, freshSid());
check("ask-override retired (1.0.8): --test-run no longer exempts (catalog ask)", t.decision === "ask", t.raw);
t = runHook(ovWs, "gs-admin re c delete-schedule --id 12345678-aaaa-bbbb-cccc-000000000000", freshSid());
check(
  "ask-override retired (1.0.8): re c delete-schedule asks plain",
  t.decision === "ask" && t.reason.includes("Mutating Gainsight command") && !t.reason.includes("mislabel"),
  t.raw
);
t = runHook(ovWs, "gs-admin re r set-source-template --id 12345678-aaaa-bbbb-cccc-000000000000 --template-id 87654321-bbbb-cccc-dddd-000000000000", freshSid());
check(
  "ask-override retired (1.0.8): re r set-source-template asks plain",
  t.decision === "ask" && t.reason.includes("Mutating Gainsight command") && !t.reason.includes("mislabel"),
  t.raw
);
t = runHook(ovWs, "gs-admin re r schedule-basic --id 12345678-aaaa-bbbb-cccc-000000000000 --frequency DAILY --start-time 02:00", freshSid());
check("ask-override retired (1.0.8): re r schedule-basic asks plain", t.decision === "ask" && !t.reason.includes("mislabel"), t.raw);

// ── F-268 regression: a STALE workspace catalog must not silence known writers ─
// The guard prefers <ws>/.gs-superadmin/catalog.json over the bundled snapshot.
// A workspace whose catalog predates 1.0.8 labels the 39 flipped writers
// non-mutating, and with the override list empty the guard went fully SILENT on
// them (tester repro, F-268 reopen). The fix is the conservative catalog UNION:
// the workspace catalog stays primary for resolution, but a command it labels
// non-mutating is promoted to mutating when the bundled catalog says so — asks
// can only increase, in either skew direction. The prompt carries a
// catalog-version note pointing at setup; the journal records the union basis.
// This is the real-catalog-version dimension the CP-3 rewrite dropped.
const staleWs = makeWorkspace("stale-ws-catalog", [
  { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
]);
writeFileSync(join(staleWs, ".gs-superadmin", "catalog.json"), JSON.stringify({
  meta: { cliVersion: "1.0.7" },
  globalFlags: [],
  domains: [
    { namespace: "rules-engine", aliases: ["re"] },
    { namespace: "journey", aliases: ["jo"] },
  ],
  commands: [
    // The pre-1.0.8 shape: writers still labeled non-mutating.
    { path: "rules-engine rules run-now", shortPath: "re r run-now", domain: "rules-engine", mutating: false },
    { path: "rules-engine rules set-source-template", shortPath: "re r set-source-template", domain: "rules-engine", mutating: false },
    { path: "rules-engine chains delete-schedule", shortPath: "re c delete-schedule", domain: "rules-engine", mutating: false },
    { path: "rules-engine rules test-schedule", shortPath: "re r test-schedule", domain: "rules-engine", mutating: false },
    { path: "journey programs save", shortPath: "jo p save", domain: "journey", mutating: true },
  ],
}));
t = runHook(staleWs, RUNNOW, freshSid());
check("stale-ws union: run-now asks despite the pre-1.0.8 workspace catalog", t.decision === "ask", t.raw);
check(
  "stale-ws union: plain mutating wording plus the catalog-version note naming setup",
  t.reason.includes("Mutating Gainsight command") && !t.reason.includes("mislabel") &&
    t.reason.includes("Catalog-version note") && t.reason.includes("/gs-superadmin:setup"),
  t.reason
);
// The bundled half of this assertion is the REAL tree's catalog version —
// derived, not hardcoded, so the next adoption's pin bump cannot fail this
// check for bookkeeping reasons (it asserts "the note names the bundled
// version", whatever that is). The v1.0.7 half is this fixture's own
// synthetic workspace value and stays literal on purpose.
const bundledVer = JSON.parse(
  readFileSync(join(dirname(HOOK), "..", "reference", "catalog.json"), "utf8")
).meta.cliVersion;
check(
  "stale-ws union: the note names both catalog versions",
  t.reason.includes("v1.0.7") && t.reason.includes(`v${bundledVer}`),
  t.reason
);
t = runHook(staleWs, `${RUNNOW} --test-run`, freshSid());
check("stale-ws union: --test-run asks too (no override exemption exists)", t.decision === "ask", t.raw);
t = runHook(staleWs, "gs-admin re c delete-schedule --id 12345678-aaaa-bbbb-cccc-000000000000", freshSid());
check("stale-ws union: re c delete-schedule asks", t.decision === "ask", t.raw);
t = runHook(staleWs, "gs-admin re r set-source-template --id 12345678-aaaa-bbbb-cccc-000000000000 --template-id 87654321-bbbb-cccc-dddd-000000000000", freshSid());
check("stale-ws union: re r set-source-template asks", t.decision === "ask", t.raw);
t = runHook(staleWs, "gs-admin re r test-schedule --cron '0 0 0 * * ?'", freshSid());
check("stale-ws union: test-schedule (non-mutating in BOTH catalogs) stays silent", t.silent, t.raw);
t = runHook(staleWs, MUTATING, freshSid());
check("stale-ws union: a workspace-mutating command still asks from the primary lane", t.decision === "ask", t.raw);
// Journal: an approved union-promoted run journals, naming the union basis.
t = runHook(staleWs, RUNNOW, "guard-fixtures", "PostToolUse", { exit_code: 0 });
check("stale-ws union journal: approved run-now journals silently", t.silent, t.raw);
jrn = readFileSync(journalOf(staleWs, "acme-sbx"), "utf8");
check(
  "stale-ws union journal: action line records the bundled-catalog basis",
  jrn.includes("mutating per bundled v"),
  jrn
);

// Layer 2 — the mechanism, on an isolated hook copy with a synthetic override
// file and a synthetic catalog still carrying the mislabels. journal-lib is
// copied alongside so the journal lane works from the copy too.
const OV_SYN_OVERRIDES = JSON.stringify({
  overrides: [
    {
      path: "rules-engine rules run-now",
      whileCatalogMutatingIs: false,
      unlessArgPresent: "--test-run",
      reason: "Triggers a LIVE on-demand rule execution by default - the rule's actions write to the tenant - but the catalog labels it non-mutating. --test-run is the safe mode.",
      verifiedOnCli: "1.0.6",
    },
    {
      path: "rules-engine rules schedule-basic",
      whileCatalogMutatingIs: false,
      reason: "Creates or replaces the rule's cron schedule (POST /v1/api/rules/schedule) - a tenant write the catalog labels non-mutating. No safe-mode flag. Endpoint-verified.",
      verifiedOnCli: "1.0.6",
    },
    {
      path: "rules-engine rules set-source-template",
      whileCatalogMutatingIs: false,
      reason: "Attaches a Design Template as the rule's data source - a destructive write the catalog labels non-mutating: REPLACES the current source; a re-run APPENDS a second graph. No safe mode. Live-verified.",
      verifiedOnCli: "1.0.7",
    },
  ],
});
const ovHook = isolatedHookCopy("hook-ov-live", {
  "hooks/ask-overrides.json": OV_SYN_OVERRIDES,
  "scripts/journal-lib.mjs": readFileSync(join(dirname(HOOK), "..", "scripts", "journal-lib.mjs")),
});
const ovSynWs = makeWorkspace("ask-override-syn", [
  { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
]);
writeFileSync(join(ovSynWs, ".gs-superadmin", "catalog.json"), JSON.stringify({
  meta: { cliVersion: "1.0.7" },
  globalFlags: [],
  domains: [{ namespace: "rules-engine", aliases: ["re"] }],
  commands: [
    { path: "rules-engine rules run-now", shortPath: "re r run-now", domain: "rules-engine", mutating: false },
    { path: "rules-engine rules schedule-basic", shortPath: "re r schedule-basic", domain: "rules-engine", mutating: false },
    { path: "rules-engine rules set-source-template", shortPath: "re r set-source-template", domain: "rules-engine", mutating: false },
  ],
}));

// Fire: bare run-now against the synthetic non-mutating catalog must ask
t = runHook(ovSynWs, RUNNOW, freshSid(), undefined, undefined, {}, ovHook);
check("ask-override mech: bare run-now (catalog non-mutating) asks", t.decision === "ask", t.raw);
check(
  "ask-override mech: prompt cites the verified mislabel + CLI version",
  t.reason.includes("catalog-marked non-mutating") && t.reason.includes("v1.0.6"),
  t.reason
);
check("ask-override mech: prompt names the exempting arg", t.reason.includes("--test-run"), t.reason);
// F-085 pin (unlessArgPresent branch): this branch never doubled the period —
// its "(… skips this prompt)." suffix replaces the bare "." — so this is a
// non-regression PIN of the healthy branch, not a reproduction of the bug;
// the reproduction lives in the no-safe-mode checks further down.
check("ask-override mech: run-now prompt has no doubled period", !t.reason.includes(".."), t.reason);

// Exempt: only the EXACT literal safe-mode token skips the prompt. An
// `=`-glued form still asks — `--test-run=false` would be a LIVE run, and the
// guard cannot know which values disable the safe mode; when in doubt, ask.
t = runHook(ovSynWs, `${RUNNOW} --test-run`, freshSid(), undefined, undefined, {}, ovHook);
check("ask-override mech: literal --test-run exempts (silent pass-through)", t.silent, t.raw);
t = runHook(ovSynWs, "gs-admin re r run-now --test-run=false --id 12345678-aaaa-bbbb-cccc-000000000000", freshSid(), undefined, undefined, {}, ovHook);
check("ask-override mech: --test-run=false still asks (a valued form can disable the safe mode)", t.decision === "ask", t.raw);
t = runHook(ovSynWs, "gs-admin re r run-now --test-run=true --id 12345678-aaaa-bbbb-cccc-000000000000", freshSid(), undefined, undefined, {}, ovHook);
check("ask-override mech: --test-run=true still asks (exemption is the exact token only)", t.decision === "ask", t.raw);

// F-085 regression (no-unlessArgPresent branch): the no-safe-mode reasons all
// end in a sentence-ender already, so the guard must not append a second one.
t = runHook(ovSynWs, "gs-admin re r set-source-template --id 12345678-aaaa-bbbb-cccc-000000000000 --template-id 87654321-bbbb-cccc-dddd-000000000000", freshSid(), undefined, undefined, {}, ovHook);
check(
  "ask-override mech: no-safe-mode entry asks with the mislabel wording + its verified version",
  t.decision === "ask" && t.reason.includes("catalog-marked non-mutating") && t.reason.includes("v1.0.7"),
  t.reason
);
check("ask-override mech: no doubled period on a no-safe-mode entry", !t.reason.includes(".."), t.reason);

// A chained call hitting the SAME override twice renders ONE mislabel
// paragraph (the journal still records each invocation) — F-089.
t = runHook(ovSynWs, "gs-admin re r schedule-basic --id 11111111-aaaa-bbbb-cccc-000000000000 --frequency DAILY --start-time 02:00 && gs-admin re r schedule-basic --id 22222222-aaaa-bbbb-cccc-000000000000 --frequency DAILY --start-time 03:00", freshSid(), undefined, undefined, {}, ovHook);
check(
  "ask-override mech: same override twice in one call renders one paragraph",
  t.decision === "ask" && t.reason.split("Verified catalog mislabel").length === 2,
  t.reason
);

// Retire (the self-retiring predicate itself): the SAME override file against
// a catalog where upstream fixed the flag (mutating: true) — the entry stops
// matching and the NORMAL catalog ask takes over: still one prompt, no
// mislabel wording, never a double prompt. This is the predicate that retired
// the real list at 1.0.8, pinned on the mechanism rather than the shipped file.
const retiredWs = makeWorkspace("ask-override-retired", [
  { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
]);
writeFileSync(join(retiredWs, ".gs-superadmin", "catalog.json"), JSON.stringify({
  meta: { cliVersion: "1.0.8" },
  globalFlags: [],
  domains: [{ namespace: "rules-engine", aliases: ["re"] }],
  commands: [{ path: "rules-engine rules run-now", shortPath: "re r run-now", domain: "rules-engine", mutating: true }],
}));
t = runHook(retiredWs, RUNNOW, freshSid(), undefined, undefined, {}, ovHook);
check(
  "ask-override mech: retired entry is a no-op — plain catalog ask, no mislabel wording",
  t.decision === "ask" && t.reason.includes("Mutating Gainsight command") && !t.reason.includes("mislabel"),
  t.raw
);

// Journal: an approved override hit ran and is verified to mutate — it must
// leave a journal trace, with the override called out in the action line.
t = runHook(ovSynWs, RUNNOW, "guard-fixtures", "PostToolUse", undefined, {}, ovHook);
check("ask-override mech journal: approved bare run-now journals silently", t.silent, t.raw);
jrn = readFileSync(journalOf(ovSynWs, "acme-sbx"), "utf8");
check(
  "ask-override mech journal: action line records the override + verified CLI version",
  jrn.includes("non-mutating — ask-override: verified mutating on CLI v1.0.6"),
  jrn
);
check("ask-override mech journal: system-area mapped (rules-engine → gs-rules)", jrn.includes("- system-area: gs-rules"), jrn);

// …but the exempted safe mode stays a plain read: nothing appended
const ovBefore = readFileSync(journalOf(ovSynWs, "acme-sbx"), "utf8");
t = runHook(ovSynWs, `${RUNNOW} --test-run`, "guard-fixtures", "PostToolUse", undefined, {}, ovHook);
check(
  "ask-override mech journal: --test-run run appends nothing",
  t.silent && readFileSync(journalOf(ovSynWs, "acme-sbx"), "utf8") === ovBefore,
  t.raw
);

// ── Union × override interaction (F-281): a command that is BOTH bundled-
// mutating and override-listed. Promotion mutates the known-map entry BEFORE
// the scan, so the catalog-mutating branch takes the hit and the override
// entry — its wording, its unlessArgPresent exemption, its journal label — is
// deliberately not consulted. That is the safe direction (asks can only
// widen: the exemption stops applying), but it is a real behavior change the
// pre-union suite never exercised: Layer 1 runs with the shipped EMPTY
// override list, and every other Layer-2 copy has no bundled catalog, so the
// union path was dead in every override check. The bundled version below is
// this fixture's own synthetic value, hardcoded on purpose.
const ovUnionHook = isolatedHookCopy("hook-ov-union", {
  "hooks/ask-overrides.json": OV_SYN_OVERRIDES,
  "scripts/journal-lib.mjs": readFileSync(join(dirname(HOOK), "..", "scripts", "journal-lib.mjs")),
  "reference/catalog.json": JSON.stringify({
    meta: { cliVersion: "1.0.8" },
    globalFlags: [],
    domains: [{ namespace: "rules-engine", aliases: ["re"] }],
    commands: [
      { path: "rules-engine rules run-now", shortPath: "re r run-now", domain: "rules-engine", mutating: true },
    ],
  }),
});
t = runHook(ovSynWs, RUNNOW, freshSid(), undefined, undefined, {}, ovUnionHook);
check(
  "union×override: promotion wins — plain mutating ask with the catalog-version note, no mislabel wording",
  t.decision === "ask" && t.reason.includes("Mutating Gainsight command") &&
    t.reason.includes("Catalog-version note") && !t.reason.includes("mislabel"),
  t.reason
);
t = runHook(ovSynWs, `${RUNNOW} --test-run`, freshSid(), undefined, undefined, {}, ovUnionHook);
check(
  "union×override: --test-run no longer exempts a promoted command (asks only widen)",
  t.decision === "ask",
  t.raw
);
t = runHook(ovSynWs, RUNNOW, "guard-fixtures", "PostToolUse", undefined, {}, ovUnionHook);
check("union×override journal: approved run journals silently", t.silent, t.raw);
jrn = readFileSync(journalOf(ovSynWs, "acme-sbx"), "utf8");
check(
  "union×override journal: action line records the bundled basis, not the override",
  jrn.includes("mutating per bundled v1.0.8"),
  jrn
);

// ── Version-probe short-circuit (F-283): when reference/version.json names the
// SAME cliVersion as the workspace catalog, the hook skips the bundled parse —
// same-vintage labels make the union a no-op, and a same-version catalog with
// hand-edited flags is a deliberate local edit, outside the stale-skew threat
// model F-268 covers. Pinned so a future change to that trade is a decision,
// not an accident: the bundled copy below DOES flag run-now mutating, and the
// probe match must keep the guard silent anyway.
const probeHook = isolatedHookCopy("hook-union-probe", {
  "hooks/ask-overrides.json": JSON.stringify({ overrides: [] }),
  "scripts/journal-lib.mjs": readFileSync(join(dirname(HOOK), "..", "scripts", "journal-lib.mjs")),
  "reference/version.json": JSON.stringify({ cliVersion: "1.0.7" }),
  "reference/catalog.json": JSON.stringify({
    meta: { cliVersion: "1.0.8" },
    globalFlags: [],
    domains: [{ namespace: "rules-engine", aliases: ["re"] }],
    commands: [
      { path: "rules-engine rules run-now", shortPath: "re r run-now", domain: "rules-engine", mutating: true },
    ],
  }),
});
t = runHook(ovSynWs, "gs-admin re r run-now --id 12345678-aaaa-bbbb-cccc-000000000000", freshSid(), undefined, undefined, {}, probeHook);
check(
  "union probe: same-version workspace (per version.json) skips the union — stays silent",
  t.silent,
  t.raw
);

// ── Ask-headline key fallback (F-284): a workspace-catalog entry carrying only
// `shortPath` (the hand-trimmed shape describe-batch.mjs documents) must still
// NAME the command in the ask headline — same cmdKey fallback the journal and
// promotion set already use. Runs against the real shipped hook at the bundled
// version (derived, not hardcoded) so the F-283 probe short-circuits the union:
// this is the fully-current-workspace lane, no skew required. Every other
// synthetic entry in this suite carries both keys, which is why the suite was
// green while the headline read `gs-admin undefined`.
const shortKeyWs = makeWorkspace("shortpath-only-headline", [
  { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
]);
writeFileSync(join(shortKeyWs, ".gs-superadmin", "catalog.json"), JSON.stringify({
  meta: { cliVersion: bundledVer },
  globalFlags: [],
  domains: [{ namespace: "rules-engine", aliases: ["re"] }],
  commands: [{ shortPath: "re r run-now", domain: "rules-engine", mutating: true }],
}));
t = runHook(shortKeyWs, "gs-admin re r run-now --id 12345678-aaaa-bbbb-cccc-000000000000", freshSid());
check(
  "headline cmdKey: shortPath-only entry asks AND names the command (no `undefined`)",
  t.decision === "ask" &&
    t.reason.includes("Mutating Gainsight command: gs-admin re r run-now") &&
    !t.reason.includes("undefined"),
  t.reason
);
// Control: the same entry WITH `path` names it under path, as before.
writeFileSync(join(shortKeyWs, ".gs-superadmin", "catalog.json"), JSON.stringify({
  meta: { cliVersion: bundledVer },
  globalFlags: [],
  domains: [{ namespace: "rules-engine", aliases: ["re"] }],
  commands: [{ path: "rules-engine rules run-now", shortPath: "re r run-now", domain: "rules-engine", mutating: true }],
}));
t = runHook(shortKeyWs, "gs-admin re r run-now --id 12345678-aaaa-bbbb-cccc-000000000000", freshSid());
check(
  "headline cmdKey control: both-key entry still names the path form",
  t.decision === "ask" &&
    t.reason.includes("Mutating Gainsight command: gs-admin rules-engine rules run-now"),
  t.reason
);

// Shipped-file assertions: the overrides array is empty (the 1.0.8 state —
// asserted so a drive-by re-add is a conscious decision that updates this
// check too), and any future entry must survive printable()'s 200-char cap
// uncut, or the F-085 punctuation logic can strand a truncated sentence.
{
  // BOM-tolerant like the guard's own stripBom contract — single leading
  // U+FEFF only (F-204): a BOM the file ever gains must surface as this
  // section's own assertions, never crash the whole suite at JSON.parse.
  const shipped = JSON.parse(readFileSync(join(dirname(HOOK), "ask-overrides.json"), "utf8").replace(/^\uFEFF/, ""));
  check(
    "ask-override: shipped list is empty (mislabel class closed upstream at 1.0.8)",
    Array.isArray(shipped.overrides) && shipped.overrides.length === 0,
    JSON.stringify(shipped.overrides)
  );
  const over = shipped.overrides.filter(
    (o) => String(o.reason).replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim().length > 200
  );
  check("ask-override: every shipped reason fits the 200-char printable cap", over.length === 0,
    over.map((o) => o.path).join(", "));
}

// Former deliberate NON-entries (decision record in ask-overrides.json):
// test-schedule is validation-only and the discovery reads are plain reads —
// still catalog-non-mutating at 1.0.8 (upstream's review reached the same
// command-for-command conclusion). `re r edit`, the old documented-class
// example, flipped to catalog-mutating at 1.0.8 and now asks plain.
t = runHook(ovWs, "gs-admin re r test-schedule --cron '0 0 0 * * ?'", `guard-fixtures-${randomUUID()}`);
check("ask-override non-entry: re r test-schedule (validation-only) passes silently", t.silent, t.raw);
t = runHook(ovWs, "gs-admin re r schedules --id 12345678-aaaa-bbbb-cccc-000000000000", `guard-fixtures-${randomUUID()}`);
check("ask-override non-entry: re r schedules (read surface) passes silently", t.silent, t.raw);
t = runHook(ovWs, "gs-admin re r edit --id 12345678-aaaa-bbbb-cccc-000000000000 --new-name same-name", `guard-fixtures-${randomUUID()}`);
check(
  "ask-override retired (1.0.8): re r edit (former documented class) asks plain",
  t.decision === "ask" && t.reason.includes("Mutating Gainsight command") && !t.reason.includes("mislabel"),
  t.raw
);

// Missing / malformed override files fail open to plain catalog behavior.
// Exercised on COPIES of the hook (the shipped ask-overrides.json is valid);
// the isolated copies have no ../reference, so the fixture workspace supplies
// a catalog marking run-now non-mutating and jo p save mutating.
const OV_CATALOG = JSON.stringify({
  meta: { cliVersion: "1.0.4" },
  globalFlags: [],
  domains: [
    { namespace: "rules-engine", aliases: ["re"] },
    { namespace: "journey", aliases: ["jo"] },
  ],
  commands: [
    { path: "rules-engine rules run-now", shortPath: "re r run-now", domain: "rules-engine", mutating: false },
    { path: "journey programs save", shortPath: "jo p save", domain: "journey", mutating: true },
  ],
});
const ovFile = (overridesText) => ({ "hooks/ask-overrides.json": overridesText });
ws = makeWorkspace("ask-override-failopen", [
  { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
]);
writeFileSync(join(ws, ".gs-superadmin", "catalog.json"), OV_CATALOG);

let hf = isolatedHookCopy("hook-ov-missing");
t = runHook(ws, RUNNOW, freshSid(), undefined, undefined, {}, hf);
check("ask-override: missing file → today's behavior (run-now passes silently)", t.silent, t.raw);

hf = isolatedHookCopy("hook-ov-garbage", ovFile("{ not json !!!"));
t = runHook(ws, RUNNOW, freshSid(), undefined, undefined, {}, hf);
check("ask-override: unparseable file fails open (run-now passes silently)", t.silent, t.raw);
t = runHook(ws, MUTATING, freshSid(), undefined, undefined, {}, hf);
check("ask-override: unparseable file leaves the mutation guard intact (jo p save asks)", t.decision === "ask", t.raw);

hf = isolatedHookCopy("hook-ov-notarray", ovFile(JSON.stringify({ overrides: "run-now" })));
t = runHook(ws, RUNNOW, freshSid(), undefined, undefined, {}, hf);
check("ask-override: non-array overrides field fails open", t.silent, t.raw);

// Per-entry validation: malformed entries (and any shape that isn't literally
// whileCatalogMutatingIs:false) are skipped; a valid entry alongside still
// fires — here written in shortPath form, which must match too.
hf = isolatedHookCopy("hook-ov-mixed", ovFile(JSON.stringify({
  overrides: [
    { path: 42, whileCatalogMutatingIs: false },
    { path: "rules-engine rules run-now", whileCatalogMutatingIs: "false" },
    { path: "re r run-now", whileCatalogMutatingIs: false, unlessArgPresent: "--test-run", reason: "verified live run", verifiedOnCli: "1.0.4" },
  ],
})));
t = runHook(ws, RUNNOW, freshSid(), undefined, undefined, {}, hf);
check(
  "ask-override: malformed entries skipped; valid shortPath-form entry still fires",
  t.decision === "ask" && t.reason.includes("catalog-marked non-mutating"),
  t.raw
);

// A malformed exemption field must disable only the exemption (degrade toward
// asking), never drop the entry — dropping it would remove an ask.
hf = isolatedHookCopy("hook-ov-badexempt", ovFile(JSON.stringify({
  overrides: [
    { path: "rules-engine rules run-now", whileCatalogMutatingIs: false, unlessArgPresent: "test-run", reason: "verified live run", verifiedOnCli: "1.0.4" },
  ],
})));
t = runHook(ws, `${RUNNOW} --test-run`, freshSid(), undefined, undefined, {}, hf);
check(
  "ask-override: malformed unlessArgPresent keeps the ask (even with the would-be exempting flag)",
  t.decision === "ask",
  t.raw
);
// …and the prompt must not ADVERTISE the malformed flag as an escape hatch:
// the matcher validates the exemption (string, "-"-prefixed) before honoring
// it, so the prompt applies the same rule before rendering the
// "skips this prompt" suffix (F-089).
check(
  "ask-override: malformed unlessArgPresent is not advertised in the prompt",
  !t.reason.includes("skips this prompt") && !t.reason.includes("test-run`"),
  t.reason
);

// ── Glued shell metacharacters (security sweep 2026-07-24, F-012) ────────────
// Both shells treat `;` `|` `&` `(` `)` and a backtick as command boundaries
// with NO separating space, so `echo done;gs-admin jo p save` really does run
// the mutation. The gate regex already accepted those separators, but
// shellWords split on whitespace alone, so the token was `done;gs-admin`,
// isGsAdminWord rejected it, and the invocation was never scanned — producing
// neither an ask nor a journal entry. Every payload below was observed SILENT
// before the fix; the plain and space-separated spellings always worked.
const gluedWs = makeWorkspace("glued-meta", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);

for (const [label, cmd] of [
  ["glued semicolon", "echo done;gs-admin jo p save"],
  ["command substitution", "out=$(gs-admin jo p save)"],
  ["subshell", "(gs-admin jo p save)"],
  ["glued pipe", "echo x|gs-admin jo p save"],
  ["glued ampersand", "echo x&gs-admin jo p save"],
  ["glued &&", "echo done&&gs-admin jo p save"],
  ["backtick substitution", "echo `gs-admin jo p save`"],
  ["two invocations, glued ;", "gs-admin --json jo p list;gs-admin jo p save"],
]) {
  t = runHook(gluedWs, cmd, freshSid());
  check(
    `glued meta (${label}): mutation still asks`,
    t.decision === "ask" && t.reason.includes("Mutating Gainsight command"),
    `${cmd} -> ${t.raw}`
  );
}

// Mirror case: a TRAILING glued operator left `save;` unmatched, downgrading a
// known mutation to the vaguer "Unrecognized command" prompt (and an `unknown`
// journal system-area, losing the X-2 component mapping).
t = runHook(gluedWs, "gs-admin jo p save; echo done", freshSid());
check(
  "glued meta: trailing `;` names the mutation (not 'Unrecognized')",
  t.decision === "ask" &&
    t.reason.includes("Mutating Gainsight command") &&
    !t.reason.includes("Unrecognized gs-admin command"),
  t.raw
);

// Read-only commands must stay silent through the same tokenization change.
t = runHook(gluedWs, "echo done;gs-admin --json re rules list", freshSid());
check("glued meta: read-only stays silent", t.silent, t.raw);

// A substitution standing where the SUBCOMMAND should be is still unreadable —
// it must reach the variable-subcommand coaching path, not fall silent now that
// backticks tokenize separately.
t = runHook(gluedWs, "gs-admin `echo jo` p save", freshSid());
check(
  "glued meta: substituted subcommand still coached (deny or ask, never silent)",
  !t.silent && (t.decision === "deny" || t.decision === "ask"),
  t.raw
);

// The journal half of the same gap: the glued mutation ran, so it must be recorded.
{
  const jws = makeWorkspace("glued-meta-journal", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  runHook(jws, "echo done;gs-admin jo p save", freshSid(), "PostToolUse", { exit_code: 0 });
  const jp = join(jws, "acme-prod", "changes", "JOURNAL.md");
  const body = existsSync(jp) ? readFileSync(jp, "utf8") : "";
  check(
    "glued meta: approved mutation is journaled with its catalog path",
    body.includes("journey programs save") && body.includes("mutating"),
    body || "(no journal written)"
  );
}

// ── Quote-parity swallow (security sweep 2026-07-24, F-012) ──────────────────
// bash's `\"`, PowerShell's backtick-escaped `"`, and an apostrophe inside a `#`
// comment are NOT quote toggles in the real shells. One spurious toggle left the
// tokenizer mid-quote, swallowing the rest of the command — including a
// following mutation — into a single token. The quote-blind second pass catches
// those; it is union-only, so it must not manufacture asks on read-only work.
t = runHook(gluedWs, "# Bradley's note\ngs-admin jo p save", freshSid());
check(
  "quote parity: apostrophe in a comment does not hide the mutation",
  t.decision === "ask" && t.reason.includes("Mutating Gainsight command"),
  t.raw
);

t = runHook(gluedWs, 'echo \\" ; gs-admin jo p save', freshSid());
check(
  "quote parity: backslash-escaped dquote does not hide the mutation",
  t.decision === "ask" && t.reason.includes("Mutating Gainsight command"),
  t.raw
);

t = runHook(gluedWs, "# Bradley's note\ngs-admin --json re rules list", freshSid());
check("quote parity: read-only with a stray apostrophe stays silent", t.silent, t.raw);

// Genuinely quoted metacharacters in a value must still be one word — the
// union pass must not re-read them as operators and double-count.
t = runHook(gluedWs, "gs-admin --json jo p list --search 'Sales & Marketing|EMEA'", freshSid());
check("quote parity: quoted metachars in a value stay quoted (silent)", t.silent, t.raw);

// ── Inert text says so (release review 2026-07-25, F-047; re-based on the
// tokenizer at the F-428 third pass) ─────────────────────────────────────────
// A mutation-shaped string inside a heredoc body is DATA of the command that
// opened the heredoc: the shell never executes it (unless the command is an
// interpreter — `bash <<EOF` — which is why it still ASKS, fail-closed). Both
// surfaces must say the text may not have executed, instead of asserting an
// applied tenant change as fact — and they must say so from what the tokenizer
// READ (a heredoc body → operand position), not from whether an apostrophe in
// the body happened to make the whole command unbalanced. The tester's live
// case (hb-20260908-02): a body WITHOUT an apostrophe was tokenized as a new
// command line, found at command position, and journaled "ran".
t = runHook(gluedWs, "cat > notes.md <<'EOF'\nDon't forget: gs-admin jo p save\nEOF", freshSid());
check(
  "heredoc: body mutation (apostrophe) asks WITH the operand caveat, not the quote-blind one — a body's quotes are literal",
  t.decision === "ask" && t.reason.includes("operand position") && t.reason.includes("heredoc body") && !t.reason.includes("quote-blind") && t.reason.includes("Mutating Gainsight command"),
  t.raw
);
{
  const bws = makeWorkspace("blind-note-journal", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  runHook(bws, "cat > notes.md <<'EOF'\nDon't forget: gs-admin jo p save\nEOF", freshSid(), "PostToolUse", { exit_code: 0 });
  const body = readFileSync(join(bws, "acme-prod", "changes", "JOURNAL.md"), "utf8");
  check(
    "heredoc: journal entry carries the operand note naming the heredoc body",
    body.includes("- note: found in operand position (an argument to another command, a heredoc body,") && !body.includes("quote-blind"),
    body
  );
  // F-428 adjacent instance (detection-confidence axis): the outcome WORD is
  // qualified too — a success event on the command line says nothing about
  // text the shell never ran, so "completed" (or "ran") must not lead the row.
  check(
    "heredoc: journal entry's OUTCOME word is qualified, not \"completed\" with the doubt in the note only",
    /^- outcome: not verified as executed \(found in operand position; .*see note\)/m.test(body) && !/^- outcome: (completed|ran|exit)/m.test(body),
    body
  );
  // A plain first-pass mutation must NOT carry the note — the annotation is
  // reserved for findings the tokenizer could not place in an executing position.
  runHook(bws, "gs-admin jo p save", freshSid(), "PostToolUse", { exit_code: 0 });
  const second = readFileSync(join(bws, "acme-prod", "changes", "JOURNAL.md"), "utf8").slice(body.length);
  check(
    "heredoc: plain mutation journals WITHOUT the note",
    second.includes("journey programs save") && !second.includes("- note:"),
    second
  );
  check(
    "heredoc: plain mutation keeps the unqualified outcome word (the qualifier is reserved for doubted findings)",
    /^- outcome: exit 0$/m.test(second),
    second
  );
  // A doubted finding that ALSO fails the line keeps the FAILED head (safe
  // direction) and says the text may not have run at all.
  runHook(bws, "cat > notes.md <<'EOF'\nDon't forget: gs-admin jo p save\nEOF", freshSid(), "PostToolUse", { exit_code: 1 });
  const third = readFileSync(join(bws, "acme-prod", "changes", "JOURNAL.md"), "utf8").slice(body.length + second.length);
  check(
    "heredoc: failure-shaped line keeps the FAILED head and says the flagged text may not have executed at all",
    /^- outcome: exit 1 — command FAILED; this change likely did not apply — NOTE: found in operand position; the flagged text may not have executed as a gs-admin invocation at all — see note$/m.test(third),
    third
  );
}
// ── F-428 third pass: heredoc bodies are data, whatever their quoting ─────────
// The tester's discriminator was one apostrophe: with it the body went through
// the quote-blind pass (qualified), without it the primary pass placed the body
// line at command position (journaled "ran"). Every shape below must read the
// same way from what the tokenizer READ. Predictions are in the bus note.
{
  const hws = makeWorkspace("heredoc-shapes", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  const journalFor = (label, cmd, tr = { exit_code: 0 }) => {
    const ws = makeWorkspace(`heredoc-${label}`, [
      { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
    ]);
    runHook(ws, cmd, freshSid(), "PostToolUse", tr);
    return readFileSync(journalOf(ws, "acme-prod"), "utf8");
  };
  const OPERAND_OUTCOME = /^- outcome: not verified as executed \(found in operand position; /gm;
  const BARE_OUTCOME = /^- outcome: (exit 0|completed \(success event; no exit code reported\))$/gm;
  const count = (text, re) => (text.match(re) ?? []).length;

  // (a) the tester's live case: a balanced body, a trailing command
  t = runHook(hws, "cat > notes.md <<'EOF'\ngs-admin jo p save\nEOF\necho done", freshSid());
  check(
    "heredoc (a): balanced body asks WITH the operand caveat and no quote-blind caveat",
    t.decision === "ask" && t.reason.includes("operand position") && !t.reason.includes("quote-blind"),
    t.raw
  );
  let j = journalFor("a", "cat > notes.md <<'EOF'\ngs-admin jo p save\nEOF\necho done");
  check(
    "heredoc (a): balanced body journals \"not verified as executed (found in operand position; …)\" — never \"ran\"",
    count(j, OPERAND_OUTCOME) === 1 && !/^- outcome: ran/m.test(j) && count(j, BARE_OUTCOME) === 0,
    j
  );
  // (b) `<<-` with a tab-indented body and terminator, then a REAL mutation on
  // the next line: exactly one doubted row and exactly one bare row
  j = journalFor("b", "cat <<-EOF\n\tgs-admin jo p save\n\tEOF\ngs-admin jo p save");
  check(
    "heredoc (b): <<- body is operand (one qualified row); the mutation after the terminator is command position (one bare row)",
    count(j, OPERAND_OUTCOME) === 1 && count(j, BARE_OUTCOME) === 1 && count(j, /^- note:/gm) === 1,
    j
  );
  // (c) a spaced, unquoted delimiter
  j = journalFor("c", "cat << EOF\ngs-admin jo p save\nEOF");
  check("heredoc (c): `<< EOF` (spaced, unquoted) body is operand", count(j, OPERAND_OUTCOME) === 1 && count(j, BARE_OUTCOME) === 0, j);
  // (d) a here-string is a WORD, not a heredoc: the next line is a real command
  t = runHook(hws, "cat <<< 'x'\ngs-admin jo p save", freshSid());
  check("heredoc (d): after a here-string the next line is command position (no operand caveat)", t.decision === "ask" && !t.reason.includes("operand position"), t.raw);
  j = journalFor("d", "cat <<< 'x'\ngs-admin jo p save");
  check("heredoc (d): after a here-string the journal row is bare", count(j, BARE_OUTCOME) === 1 && count(j, /^- note:/gm) === 0, j);
  // (e) an unterminated heredoc runs to the end of the text (bash semantics)
  t = runHook(hws, "cat <<EOF\ngs-admin jo p save", freshSid());
  check("heredoc (e): unterminated body is still operand (asks with the caveat)", t.decision === "ask" && t.reason.includes("operand position"), t.raw);
  // (f) the mutation BEFORE the operator on its own line really runs
  t = runHook(hws, "gs-admin jo p save <<EOF\nx\nEOF", freshSid());
  check("heredoc (f): a mutation that OPENS a heredoc is command position (no caveat)", t.decision === "ask" && !t.reason.includes("operand position"), t.raw);
  j = journalFor("f", "gs-admin jo p save <<EOF\nx\nEOF");
  check("heredoc (f): its journal row is bare", count(j, BARE_OUTCOME) === 1 && count(j, /^- note:/gm) === 0, j);
  // (g) two heredocs announced on one line, bodies in order
  j = journalFor("g", "cat <<A > a.txt; cat <<B > b.txt\ngs-admin jo p save\nA\ngs-admin jo p save\nB");
  check("heredoc (g): both bodies of two heredocs on one line are operand — every row qualified", count(j, OPERAND_OUTCOME) === 2 && count(j, BARE_OUTCOME) === 0, j);
  // (h) CRLF line endings (a Windows tool payload)
  j = journalFor("h", "cat > notes.md <<'EOF'\r\ngs-admin jo p save\r\nEOF\r\n");
  check("heredoc (h): CRLF body is operand", count(j, OPERAND_OUTCOME) === 1 && count(j, BARE_OUTCOME) === 0, j);
  // (i) a bash `\"` escape before the heredoc (read as a quote opener): the
  // quote-aware pass swallows the rest, the quote-blind pass runs — and it, too,
  // reads the body as data, so the row is doubted on BOTH axes it observed.
  // (Until F-442 the device here was an apostrophe in a `#` comment; the lexer
  // now discards comments, so that spelling no longer unbalances anything.)
  j = journalFor("i", 'echo \\"note\ncat <<EOF\ngs-admin jo p save\nEOF');
  check(
    "heredoc (i): under an unbalanced escaped quote the quote-blind pass still reads the body as operand",
    /^- outcome: not verified as executed \(found only by the quote-blind re-scan and in operand position; /m.test(j) && count(j, BARE_OUTCOME) === 0,
    j
  );
}
// The quote-parity family above also reaches the mutation only via the blind
// pass — its ask carries the caveat too, which is honest: the parse genuinely
// cannot tell that spelling from inert text.
t = runHook(gluedWs, 'echo \\"note\ngs-admin jo p save', freshSid());
check("quote-blind: quote-parity ask carries the caveat", t.decision === "ask" && t.reason.includes("quote-blind"), t.raw);
// A comment is grammar since F-442 (bash 3.1.3): the apostrophe in it never
// opens a quote, so the same mutation asks WITHOUT the blind caveat.
t = runHook(gluedWs, "# Bradley's note\ngs-admin jo p save", freshSid());
check("comment: an apostrophe in a `#` comment unbalances nothing — the ask carries no quote-blind caveat", t.decision === "ask" && !t.reason.includes("quote-blind"), t.raw);

// ── Journal secret redaction (F-024) ─────────────────────────────────────────
// Any secret typed on a gs-admin command line was written to the journal twice:
// once in `- command:`, and once in `- target:` (a flag the catalog doesn't
// declare doesn't consume its value, so it fell through to the args list).
const secretWs = makeWorkspace("journal-secrets", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(
  secretWs,
  "gs-admin config --client-secret sk_live_TOPSECRET_9f3 --client-id abc123",
  freshSid(),
  "PostToolUse"
);
let sjrn = existsSync(journalOf(secretWs, "acme-prod"))
  ? readFileSync(journalOf(secretWs, "acme-prod"), "utf8")
  : "";
check("journal: secret value never appears in the entry", sjrn && !sjrn.includes("sk_live_TOPSECRET_9f3"), sjrn);
check("journal: secret flag is recorded, redacted", sjrn.includes("--client-secret ***"), sjrn);
check("journal: non-secret flag value is preserved", sjrn.includes("--client-id abc123"), sjrn);
check("journal: the command itself is still identifiable", /- action: .*config/.test(sjrn), sjrn);

// `=`-glued spelling, and the PostToolUseFailure path (the command failed, but
// the hook still journals — so the redaction must cover that event too).
const secretWs2 = makeWorkspace("journal-secrets-glued", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
runHook(secretWs2, "gs-admin config --client-secret=sk_live_GLUED_1 --base-url https://x", freshSid(), "PostToolUseFailure");
sjrn = existsSync(journalOf(secretWs2, "acme-prod")) ? readFileSync(journalOf(secretWs2, "acme-prod"), "utf8") : "";
check("journal: =-glued secret redacted on the failure event too", sjrn && !sjrn.includes("sk_live_GLUED_1") && sjrn.includes("--client-secret=***"), sjrn);

// The denylist must not eat non-secret payload flags that merely contain
// "token" — journal fidelity for real v1.0.4 flags.
const secretWs3 = makeWorkspace("journal-token-mappings", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
runHook(secretWs3, "gs-admin jo p save --token-mappings mapping-42", freshSid(), "PostToolUse");
sjrn = existsSync(journalOf(secretWs3, "acme-prod")) ? readFileSync(journalOf(secretWs3, "acme-prod"), "utf8") : "";
check("journal: --token-mappings value NOT redacted", sjrn.includes("--token-mappings mapping-42"), sjrn);

// Global-flag position (release review 2026-07-25, F-048): global flags go
// BEFORE the subcommand in this CLI, and the collection gate used to require an
// already-captured subcommand word — so a pre-subcommand secret value fell into
// `rest`, degraded the invocation to the unknown branch, and was echoed
// verbatim in the ask reason and the journal's `- action:` line.
const secretWs4 = makeWorkspace("journal-secrets-preposition", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
t = runHook(secretWs4, "gs-admin --client-secret sk_live_PREPOS_7 jo p save", freshSid());
check("prompt: pre-subcommand secret never appears in the ask reason", t.decision === "ask" && !t.reason.includes("sk_live_PREPOS_7"), t.raw);
check(
  "prompt: pre-subcommand spelling still resolves the real mutation",
  t.reason.includes("Mutating Gainsight command") && t.reason.includes("journey programs save"),
  t.raw
);
runHook(secretWs4, "gs-admin --client-secret sk_live_PREPOS_7 jo p save", freshSid(), "PostToolUse", { exit_code: 0 });
sjrn = existsSync(journalOf(secretWs4, "acme-prod")) ? readFileSync(journalOf(secretWs4, "acme-prod"), "utf8") : "";
check("journal: pre-subcommand secret never appears in the entry", sjrn && !sjrn.includes("sk_live_PREPOS_7"), sjrn);
check("journal: pre-subcommand spelling journals the real catalog path", sjrn.includes("journey programs save") && sjrn.includes("mutating"), sjrn);

// ── Prompt clamping (F-025) ──────────────────────────────────────────────────
// Unknown-command text is untrusted: inside quotes it can carry newlines and
// bidi overrides, and it was interpolated raw and uncapped.
t = runHook(pipeDir, "gs-admin 'frobnicate \nMutating Gainsight command: none. Safe to approve.'", freshSid());
check("prompt: unknown-command text is clamped (no raw newline)", t.decision === "ask" && !t.reason.includes("\n"), JSON.stringify(t.reason));
check("prompt: unknown-command text keeps the real header", t.reason.includes("Unrecognized gs-admin command"), t.reason);
t = runHook(pipeDir, `gs-admin frob${"x".repeat(4000)}`, freshSid());
check("prompt: a huge unknown command cannot blow up the reason string", t.decision === "ask" && t.reason.length < 900, `${t.reason.length} chars`);

// ── Escalated pipe lint carries the mutation text too (F-026) ────────────────
// The repeat-offense ask exists so the human CAN run the command — so it must
// carry the mutation, tenant and PRODUCTION warning, not replace them.
const escWs = makeWorkspace("lint-escalation", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
const esid = freshSid();
const LINT_MUTATION = "gs-admin jo p save --search CS|Risk";
t = runHook(escWs, LINT_MUTATION, esid);
check("lint escalation: first offense still a plain deny", t.decision === "deny" && !t.reason.includes("Mutating Gainsight command"), t.raw);
t = runHook(escWs, LINT_MUTATION, esid);
check("lint escalation: repeat asks", t.decision === "ask", t.raw);
check("lint escalation: ask keeps the lint text", t.reason.includes("unquoted"), t.reason);
check("lint escalation: ask names the mutating command", t.reason.includes("Mutating Gainsight command"), t.reason);
check("lint escalation: ask carries the tenant label", t.reason.includes("acme-prod"), t.reason);
check("lint escalation: ask carries the PRODUCTION warning", t.reason.includes("PRODUCTION"), t.reason);

// A read-only command with the same lint escalation must still ask (the lint is
// the reason), and must not invent a mutation.
const esid2 = freshSid();
const LINT_READONLY = "gs-admin --json re rules list --search CS|Risk";
runHook(escWs, LINT_READONLY, esid2);
t = runHook(escWs, LINT_READONLY, esid2);
check("lint escalation: read-only repeat asks on lint alone", t.decision === "ask" && !t.reason.includes("Mutating Gainsight command"), t.raw);

// ── Catalog fallback on a falsy-but-parseable workspace catalog (F-036) ──────
// `null` / `0` parse fine, so the loader broke out of its source loop and then
// tripped the falsy check — the bundled catalog was never tried and the guard
// went silent on a mutation.
for (const corrupt of ["null", "0", "false"]) {
  const cws = makeWorkspace(`catalog-falsy-${corrupt}`, [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  writeFileSync(join(cws, ".gs-superadmin", "catalog.json"), corrupt);
  t = runHook(cws, MUTATING, freshSid());
  check(`catalog fallback: workspace catalog "${corrupt}" falls back to the bundle`, t.decision === "ask" && t.reason.includes("Mutating Gainsight command"), t.raw);
}

// ── Pipe-lint tuning (F-037 / F-038) ─────────────────────────────────────────
t = runHook(pipeDir, "gs-admin --json re rules list | %{ $_.name }", freshSid());
check("pipe lint: PowerShell `| %{ … }` is not a false denial", t.silent, t.raw);
t = runHook(pipeDir, "gs-admin --json re rules list | ?{ $_.active }", freshSid());
check("pipe lint: PowerShell `| ?{ … }` is not a false denial", t.silent, t.raw);
t = runHook(pipeDir, "gs-admin --json re rules list | Export-Csv out.csv", freshSid());
check("pipe lint: Export-Csv is a recognized consumer", t.silent, t.raw);
t = runHook(pipeDir, "gs-admin --json re rules list --search CS|&Risk", freshSid());
check("pipe lint: bash `|&` RHS is linted, not skipped as syntax", t.decision === "deny" && /single-quote/i.test(t.reason), t.raw);
t = runHook(pipeDir, "gs-admin --json re rules list || echo failed", freshSid());
check("pipe lint: `||` is still deliberate chaining (silent)", t.silent, t.raw);

// ── Backtick line continuation (LOW batch 2026-07-25, F-049) ─────────────────
// In PowerShell a backtick before a newline is LINE CONTINUATION, not
// substitution. Tokenizing it as a boundary routed the continuation-spelled
// command to the substituted-subcommand path, so the deny message and journal
// showed only `…` where the real words belong. A continuation-spelled read
// must pass silently; a continuation-spelled mutation must ask with the real
// words; a glued substitution (no whitespace after the backtick) must still
// reach the F-012 coaching path.
t = runHook(gluedWs, "gs-admin `\n  --json re rules list", freshSid());
check("continuation: read-only continuation passes silently", t.silent, t.raw);
t = runHook(gluedWs, "gs-admin `\n  jo p save", freshSid());
check(
  "continuation: mutation via continuation asks WITH the real words",
  t.decision === "ask" && t.reason.includes("journey programs save"),
  t.raw
);
t = runHook(gluedWs, "gs-admin --json re rules `\n  list", freshSid());
check("continuation: mid-args continuation still parses as the read it is", t.silent, t.raw);
t = runHook(gluedWs, "gs-admin `echo jo` p save", freshSid());
check(
  "continuation: glued substitution still coached (deny or ask, never silent)",
  !t.silent && (t.decision === "deny" || t.decision === "ask"),
  t.raw
);

// ── Operand-position findings say so (Step 5 tester 2026-07-25, F-051) ───────
// F-047's first-pass sibling: a gs-admin word standing as an ARGUMENT to
// another command, or as echoed/redirected text, is scanned by the balanced
// first pass exactly like a real invocation — it asks (correct, fail-closed)
// but then journaled byte-for-byte like a genuine mutation, with no note.
// Both surfaces must carry the operand-position caveat; command-position
// findings (a real invocation — first word, or right after `;` `|` `&` `(`
// or a substitution backtick) must stay unnoted.
const opWs = makeWorkspace("operand-position", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
// Case A (the sharp one): balanced quoting, only `echo` executes — the entry
// used to be the same shape as a genuine mutation.
t = runHook(opWs, "echo gs-admin jo p save > notes.txt", freshSid());
check(
  "operand: echoed mutation asks WITH the operand-position caveat",
  t.decision === "ask" && t.reason.includes("operand position"),
  t.raw
);
runHook(opWs, "echo gs-admin jo p save > notes.txt", freshSid(), "PostToolUse", { exit_code: 0 });
let ojrn = readFileSync(journalOf(opWs, "acme-prod"), "utf8");
check(
  "operand: echoed mutation journal entry carries the operand note",
  ojrn.includes("- note: found in operand position"),
  ojrn
);
check(
  "operand: echoed mutation journal entry's OUTCOME word is qualified (F-428 adjacent instance), not \"completed\"",
  /^- outcome: not verified as executed \(found in operand position; .*see note\)/m.test(ojrn) && !/^- outcome: completed/m.test(ojrn),
  ojrn
);
// Case B: `which gs-admin …` — unknown entries, journaled fail-closed, noted.
const opWs2 = makeWorkspace("operand-which", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
runHook(opWs2, "which gs-admin gs-admin.cmd node npm", freshSid(), "PostToolUse", { exit_code: 0 });
ojrn = readFileSync(journalOf(opWs2, "acme-prod"), "utf8");
check(
  "operand: `which gs-admin` journal entries carry the note",
  ojrn.includes("journaled fail-closed") && ojrn.includes("- note: found in operand position"),
  ojrn
);
check(
  "operand: `which gs-admin` unknown entries' OUTCOME word is qualified too (same per-entry rule)",
  /^- outcome: not verified as executed \(found in operand position/m.test(ojrn) && !/^- outcome: completed/m.test(ojrn),
  ojrn
);
// Case D and the F-012 shapes: real invocations stay unnoted on both surfaces.
const opWs3 = makeWorkspace("operand-negative", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
runHook(opWs3, MUTATING, freshSid(), "PostToolUse", { exit_code: 0 });
ojrn = readFileSync(journalOf(opWs3, "acme-prod"), "utf8");
check(
  "operand: plain mutation journals WITHOUT any note",
  ojrn.includes("journey programs save") && !ojrn.includes("- note:"),
  ojrn
);
runHook(opWs3, "echo done;gs-admin jo p save", freshSid(), "PostToolUse", { exit_code: 0 });
check(
  "operand: glued-separator mutation stays unnoted (command position)",
  !readFileSync(journalOf(opWs3, "acme-prod"), "utf8").includes("- note:"),
  readFileSync(journalOf(opWs3, "acme-prod"), "utf8")
);
runHook(opWs3, "out=$(gs-admin jo p save)", freshSid(), "PostToolUse", { exit_code: 0 });
check(
  "operand: $(…) invocation stays unnoted (command position)",
  !readFileSync(journalOf(opWs3, "acme-prod"), "utf8").includes("- note:"),
  readFileSync(journalOf(opWs3, "acme-prod"), "utf8")
);
t = runHook(opWs3, MUTATING, freshSid());
check(
  "operand: plain mutation ask carries no operand caveat",
  t.decision === "ask" && !t.reason.includes("operand position"),
  t.reason
);

// ── Command position across newlines and keywords (pre-release review, F-052) ─
// The first cut of F-051 computed position from the previous token alone, so a
// real invocation on line 2+ of a multi-line command — the most common
// multi-command shape — was stamped "may be inert" on the prompt AND the
// journal of a genuine mutation. Segment starts now come from the tokenizer.
t = runHook(opWs3, "gs-admin --json re rules list > a.json\ngs-admin jo p save", freshSid());
check(
  "segment: line-2 mutation asks WITHOUT the operand caveat",
  t.decision === "ask" && t.reason.includes("Mutating Gainsight command") && !t.reason.includes("operand position"),
  t.raw
);
runHook(opWs3, "cd /tmp\ngs-admin jo p save", freshSid(), "PostToolUse", { exit_code: 0 });
check(
  "segment: line-2 mutation journals WITHOUT any note",
  !readFileSync(journalOf(opWs3, "acme-prod"), "utf8").includes("- note:"),
  readFileSync(journalOf(opWs3, "acme-prod"), "utf8")
);
t = runHook(opWs3, "for f in a b; do gs-admin jo p save; done", freshSid());
check(
  "segment: keyword-introduced mutation (do) carries no operand caveat",
  t.decision === "ask" && !t.reason.includes("operand position"),
  t.raw
);
t = runHook(opWs3, 'echo \\"note\ngs-admin jo p save', freshSid());
check(
  "segment: quote-blind line-2 mutation keeps the blind caveat, not the operand one",
  t.decision === "ask" && t.reason.includes("quote-blind") && !t.reason.includes("operand position"),
  t.raw
);

// ── Backtick narrowing: continuation is backtick-before-NEWLINE only (F-052) ──
// Dropping backtick-before-ANY-whitespace (F-049's first cut) silenced a
// space-padded substituted subcommand whose literal text matched a known read
// — the coaching deny was lost — and stripped command position from
// `echo ` gs-admin … ``. A space-padded backtick must stay a boundary token.
t = runHook(gluedWs, "gs-admin ` re rules list `", freshSid());
check(
  "backtick narrowing: space-padded substituted subcommand still coached (never silent)",
  !t.silent && (t.decision === "deny" || t.decision === "ask"),
  t.raw
);
t = runHook(gluedWs, "echo ` gs-admin jo p save `", freshSid());
check(
  "backtick narrowing: space-padded substitution keeps command position (no operand caveat)",
  t.decision === "ask" && t.reason.includes("Mutating Gainsight command") && !t.reason.includes("operand position"),
  t.raw
);

// ── Journal outcome: string exit codes and error flags (F-039) ───────────────
// The outcome precedence accepted only `typeof v === "number"` exit codes and
// had no error-flag branch — a PostToolUse payload carrying `is_error: true`
// or a STRING "1" exit code journaled as "completed (success event…)".
const outWs = makeWorkspace("journal-outcome-flags", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
runHook(outWs, MUTATING, freshSid(), "PostToolUse", { exit_code: "1" });
let outJrn = readFileSync(journalOf(outWs, "acme-prod"), "utf8");
check(
  'outcome: string exit code "1" journals FAILED',
  outJrn.includes("- outcome: exit 1 — command FAILED"),
  outJrn
);
runHook(outWs, MUTATING, freshSid(), "PostToolUse", { exit_code: "0" });
outJrn = readFileSync(journalOf(outWs, "acme-prod"), "utf8");
check(
  'outcome: string exit code "0" journals a clean exit 0',
  outJrn.includes("- outcome: exit 0\n"),
  outJrn
);
runHook(outWs, MUTATING, freshSid(), "PostToolUse", { is_error: true });
outJrn = readFileSync(journalOf(outWs, "acme-prod"), "utf8");
check(
  "outcome: is_error without exit code journals FAILED",
  outJrn.includes("error flag; no exit code) — this change likely did not apply"),
  outJrn
);
runHook(outWs, MUTATING, freshSid(), "PostToolUse", { exit_code: 0, is_error: true });
outJrn = readFileSync(journalOf(outWs, "acme-prod"), "utf8");
check(
  "outcome: exit 0 + error flag journals as unverified, never clean success",
  outJrn.includes("exit 0, but the harness reported an error flag"),
  outJrn
);
// Fresh workspace so the assertion is on this run's entry alone, not a
// cumulative count that degrades to a tautology if runs above are reordered.
const outWs2 = makeWorkspace("journal-outcome-toplevel-flag", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
runHook(outWs2, MUTATING, freshSid(), "PostToolUse", undefined, { is_error: true });
outJrn = readFileSync(journalOf(outWs2, "acme-prod"), "utf8");
check(
  "outcome: top-level is_error shape detected too",
  outJrn.includes("error flag; no exit code) — this change likely did not apply"),
  outJrn
);

// ── Wave-2 portability: BOM'd manifests + junction tenant dirs ───────────────
// F-118: a BOM-prefixed _manifest.json (a PowerShell hand-repair is enough to
// produce one) used to be skipped by the tenant scan's catch — the ask lost
// the tenant label AND the PRODUCTION warning silently. The prompt must carry
// both. BOM built via fromCharCode — never a literal in a source file (F-130).
{
  const dir = join(ROOT, "bom-manifest");
  mkdirSync(join(dir, ".gs-superadmin"), { recursive: true });
  mkdirSync(join(dir, "acme-prod"), { recursive: true });
  writeFileSync(
    join(dir, "acme-prod", "_manifest.json"),
    String.fromCharCode(0xfeff) + JSON.stringify({ slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" })
  );
  const r = runHook(dir, MUTATING);
  check(
    "BOM'd tenant manifest still yields the tenant label + PRODUCTION warning (F-118)",
    r.decision === "ask" && r.reason.includes("acme-prod") && r.reason.includes("PRODUCTION"),
    r.raw
  );
}

// F-134: a tenant KB behind a junction/symlink (OneDrive/Known-Folder setups)
// reports Dirent.isDirectory() false — pre-fix the tenant scan and journal
// attribution never saw it. "junction" works unprivileged on Windows; the
// type argument is ignored on POSIX.
{
  const dir = join(ROOT, "junction-ws");
  mkdirSync(join(dir, ".gs-superadmin"), { recursive: true });
  const real = join(ROOT, "junction-real");
  mkdirSync(real, { recursive: true });
  writeFileSync(join(real, "_manifest.json"), JSON.stringify({ slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" }));
  let linked = true;
  // F-137: only errors that mean "this environment cannot create links" may
  // downgrade to the skipped-PASS branch; anything else is a coding error.
  try { symlinkSync(real, join(dir, "acme-prod"), "junction"); }
  catch (e) { if (["EPERM", "EACCES", "ENOSYS"].includes(e?.code)) linked = false; else throw e; }
  if (linked) {
    const r = runHook(dir, MUTATING);
    check(
      "junction tenant dir visible to the tenant scan — label + PRODUCTION (F-134)",
      r.decision === "ask" && r.reason.includes("acme-prod") && r.reason.includes("PRODUCTION"),
      r.raw
    );
    const post = runHook(dir, MUTATING, "guard-junction", "PostToolUse", { exit_code: 0 });
    check(
      "junction tenant slug attributes the journal, not the catch-all (F-134)",
      post.silent && existsSync(join(real, "changes", "JOURNAL.md")) && !existsSync(join(dir, ".gs-superadmin", "JOURNAL-unattributed.md")),
      post.raw || "(silent)"
    );
  } else {
    check("junction tenant dir fixtures (F-134) [link creation unavailable here — skipped]", true, null);
  }
}

// ── Nested shell interpreters (wave-5 review, F-194) ─────────────────────────
// A mutating command inside a nested shell's QUOTED -c / -Command payload was
// completely invisible: the cheap gate and the boundary regex pass, but
// shellWords collapses the quoted payload to the single token
// "gs-admin jo p save", which isGsAdminWord rejects; quotes are balanced, so
// the quote-blind pass never ran — no ask AND no journal. Every quoted payload
// below was observed SILENT before the fix (the unquoted spellings always
// worked). The guard now re-scans a known interpreter's payload token, with
// interpreter names normalized like the built-ins (path prefix + launcher
// suffix) and a bounded recursive re-scan for nested payloads.
const nestWs = makeWorkspace("nested-shells", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
for (const [label, cmd] of [
  ["bash -c single-quoted", "bash -c 'gs-admin jo p save'"],
  ["sh -c double-quoted", 'sh -c "gs-admin jo p save"'],
  ["zsh -c", "zsh -c 'gs-admin jo p save'"],
  ["bash -lc option cluster", "bash -lc 'gs-admin jo p save'"],
  ["powershell -Command", 'powershell -Command "gs-admin jo p save"'],
  ["powershell.exe -c abbreviation", 'powershell.exe -c "gs-admin jo p save"'],
  ["pwsh -com abbreviation", 'pwsh -com "gs-admin jo p save"'],
  ["cmd.exe /c", 'cmd.exe /c "gs-admin jo p save"'],
  ["cmd /K", 'cmd /K "gs-admin jo p save"'],
  ["path-prefixed powershell.exe", 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command "gs-admin jo p save"'],
  ["two-level nesting", "bash -c \"bash -c 'gs-admin jo p save'\""],
]) {
  t = runHook(nestWs, cmd, freshSid());
  // The payload starts its own command segment, so the ask must carry the
  // resolved catalog path with NO operand caveat — the payload really runs.
  check(
    `nested shell (${label}): quoted-payload mutation asks with the resolved path`,
    t.decision === "ask" &&
      t.reason.includes("Mutating Gainsight command: gs-admin journey programs save") &&
      !t.reason.includes("operand position"),
    `${cmd} -> ${t.raw}`
  );
}
// Read-side symmetry: a re-scanned read-only payload must stay silent.
t = runHook(nestWs, "bash -c 'gs-admin --json re rules list'", freshSid());
check("nested shell: read-only quoted payload stays silent", t.silent, t.raw);
t = runHook(nestWs, 'powershell -Command "gs-admin --json re rules list"', freshSid());
check("nested shell: read-only -Command payload stays silent", t.silent, t.raw);
// The UNBALANCED spelling asked even before this fix (via the quote-blind
// re-scan) and must keep asking — now the first pass sees the real payload.
t = runHook(nestWs, "bash -c 'gs-admin jo p save", freshSid());
check(
  "nested shell: unbalanced nested spelling still asks",
  t.decision === "ask" && t.reason.includes("journey programs save"),
  t.raw
);
// The journal half of the same gap (the scan runs before the isPost branch,
// so pre-fix an approved nested mutation left NO trace in durable history).
{
  const njws = makeWorkspace("nested-shells-journal", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  runHook(njws, "bash -c 'gs-admin jo p save'", freshSid(), "PostToolUse", { exit_code: 0 });
  const body = existsSync(journalOf(njws, "acme-prod")) ? readFileSync(journalOf(njws, "acme-prod"), "utf8") : "";
  check(
    "nested shell: approved quoted-payload mutation is journaled with its catalog path",
    body.includes("journey programs save") && body.includes("- system-area: gs-journey"),
    body || "(no journal written)"
  );
}

// ── Brace-glued invocations (security review, F-244) ─────────────────────────
// `{` opens a PowerShell script block with no space required, and the no-space
// spelling is the idiomatic one. Pre-fix the gate regex's boundary class had no
// brace, so `%{gs-admin …}` exited 0 BEFORE any scanner ran — no ask, no
// PRODUCTION warning, no journal, on both lanes — while every SPACED form
// (`| % { … }`, `{ gs-admin … }`) asked correctly, which is what kept it
// invisible. Fix: `{` joins the gate's boundary class and both braces join META,
// so the brace tokenizes separately and CMD_KEYWORDS' existing `{` marks the
// word after it as command position.
const braceWs = makeWorkspace("brace-glued", [
  { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
]);
for (const [label, cmd] of [
  ["pipeline %{ glued", "1..3 | %{gs-admin jo p save}"],
  ["pipeline ?{ glued", "$ids | ?{gs-admin jo p save}"],
  ["ForEach-Object { glued", "$ids | ForEach-Object {gs-admin jo p save}"],
  ["if (…){ glued", "if ($true){gs-admin jo p save}"],
  ["foreach (…){ glued", "foreach ($x in $ids){gs-admin jo p save}"],
  ["call-operator script block &{", "&{gs-admin jo p save}"],
  ["bare script block", "{gs-admin jo p save}"],
]) {
  // PowerShell idioms run on the PowerShell lane (the Step 0 review made the
  // computed-name rule per tool: `foreach ($x in $ids)` is an expression there,
  // and under the Bash lane a `$x` at command position is a command name).
  t = runHook(braceWs, cmd, freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  // A script block's contents really run, so the ask must name the resolved
  // catalog path with NO operand caveat — and must not be masked by a
  // first-offense pipe/ampersand coaching deny.
  check(
    `brace-glued (${label}): mutation asks with the resolved path`,
    t.decision === "ask" &&
      t.reason.includes("Mutating Gainsight command: gs-admin journey programs save") &&
      !t.reason.includes("operand position"),
    `${cmd} -> ${t.raw}`
  );
}
// The PRODUCTION warning is part of what the silent exit threw away.
t = runHook(braceWs, "1..3 | %{gs-admin jo p save}", freshSid());
check(
  "brace-glued: the ask still carries the PRODUCTION tenant warning",
  t.decision === "ask" && t.reason.includes("PRODUCTION"),
  t.raw
);
// Read-side symmetry: a brace-glued read-only command must stay silent.
t = runHook(braceWs, "1..3 | %{gs-admin --json re rules list}", freshSid());
check("brace-glued: read-only script block stays silent", t.silent, t.raw);
t = runHook(braceWs, "if ($true){gs-admin --json re rules list}", freshSid());
check("brace-glued: read-only if-block stays silent", t.silent, t.raw);
// Spaced forms are the control that always worked — they must not regress.
t = runHook(braceWs, "1..3 | % { gs-admin jo p save }", freshSid());
check(
  "brace-glued control: the SPACED form still asks",
  t.decision === "ask" && t.reason.includes("journey programs save"),
  t.raw
);
// `}` now terminates argument collection, so the journal's target field records
// what actually ran rather than a trailing brace word.
{
  const bjws = makeWorkspace("brace-glued-journal", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  runHook(bjws, "1..3 | %{gs-admin jo p save --id 42}", freshSid(), "PostToolUse", { exit_code: 0 });
  const body = existsSync(journalOf(bjws, "acme-prod")) ? readFileSync(journalOf(bjws, "acme-prod"), "utf8") : "";
  check(
    "brace-glued: approved script-block mutation is journaled, target free of the closing brace",
    body.includes("journey programs save") &&
      body.includes("- system-area: gs-journey") &&
      !/- target:.*\}/.test(body),
    body || "(no journal written)"
  );
}

// ── PowerShell assignment prefix (tester round, F-250) ───────────────────────
// `$x=gs-admin jo p save` really runs the mutation, but `=` is not a token
// boundary, so the tokenizer produced the single word `$x=gs-admin` and the
// match failed — silent on both lanes, while the SPACED form asked correctly.
// Fixed by stripping the assignment prefix in isGsAdminWord plus `=` in the
// GATE class only — deliberately NOT in META, because splitting on `=` would
// push a `--flag=value` value into the subcommand words and could stop a
// mutating command matching its catalog path, i.e. REMOVE an ask.
for (const [label, cmd] of [
  ["plain assignment", "$x=gs-admin jo p save"],
  ["bare = after brace split", "=gs-admin jo p save"],
  ["assignment with flags", "$r=gs-admin jo p save --id 42"],
  ["braced variable", "${x}=gs-admin jo p save"],
  ["scoped variable", "$script:x=gs-admin jo p save"],
]) {
  t = runHook(braceWs, cmd, freshSid());
  check(
    `assignment prefix (${label}): mutation asks with the resolved path`,
    t.decision === "ask" && t.reason.includes("Mutating Gainsight command: gs-admin journey programs save"),
    `${cmd} -> ${t.raw}`
  );
}
// Controls. The spaced form always worked and must not regress; a read-only
// assignment stays silent; and the reason `=` is gate-only — a `--flag=value`
// must still tokenize as ONE word, or its value would land in the subcommand
// words and could cost a real ask.
t = runHook(braceWs, "$x = gs-admin jo p save", freshSid());
check("assignment prefix control: the SPACED form still asks", t.decision === "ask", t.raw);
t = runHook(braceWs, "$x=gs-admin --json re rules list", freshSid());
check("assignment prefix: read-only assignment stays silent", t.silent, t.raw);
t = runHook(braceWs, "gs-admin jo p save --id=42", freshSid());
check(
  "`=` is gate-only: --flag=value still resolves the catalog path (META must NOT split on =)",
  t.decision === "ask" && t.reason.includes("journey programs save"),
  t.raw
);

// ── No-flag nested interpreters (security review, F-245) ─────────────────────
// F-194's re-scan is keyed on interpreter-name-plus-command-string-flag, a
// shape that structurally cannot reach an interpreter taking no such flag.
// `eval '…'` is the common way a POSIX shell runs a command held as a string,
// and it was invisible for exactly the F-194 reason: one collapsed token,
// balanced quotes, no ask and no journal. dash/ksh were simply missing from the
// posix family. Payload for a `noflag` interpreter is the next non-operator,
// non-flag-shaped word.
for (const [label, cmd] of [
  ["eval single-quoted", "eval 'gs-admin jo p save'"],
  ["eval double-quoted", 'eval "gs-admin jo p save"'],
  ["eval with -- separator", "eval -- 'gs-admin jo p save'"],
  ["dash -c", "dash -c 'gs-admin jo p save'"],
  ["ksh -c", "ksh -c 'gs-admin jo p save'"],
  ["eval inside a nested bash -c", "bash -c \"eval 'gs-admin jo p save'\""],
]) {
  t = runHook(nestWs, cmd, freshSid());
  check(
    `no-flag interpreter (${label}): quoted-payload mutation asks with the resolved path`,
    t.decision === "ask" &&
      t.reason.includes("Mutating Gainsight command: gs-admin journey programs save") &&
      !t.reason.includes("operand position"),
    `${cmd} -> ${t.raw}`
  );
}
// Read-side symmetry: a re-scanned read-only eval payload must stay silent.
t = runHook(nestWs, "eval 'gs-admin --json re rules list'", freshSid());
check("no-flag interpreter: read-only eval payload stays silent", t.silent, t.raw);
// Two former residuals, CLOSED (F-247). The payload is now the first following
// token that is neither an operator nor option-shaped, so an option between the
// flag and the payload no longer defeats the re-scan; and PowerShell's
// POSITIONAL first argument is treated as a command string, which is what it
// really is. Both were accepted by judgment rather than by constraint under
// F-194/F-245, and both turned out cheap to close.
for (const [label, cmd] of [
  ["option-after-flag `bash -c -x`", "bash -c -x 'gs-admin jo p save'"],
  ["option-after-flag `bash -c --`", "bash -c -- 'gs-admin jo p save'"],
  ["option-after-flag `sh -c -e`", "sh -c -e 'gs-admin jo p save'"],
  ["positional powershell payload", 'powershell "gs-admin jo p save"'],
  ["positional pwsh after a switch", 'pwsh -NoProfile "gs-admin jo p save"'],
  ["option-after-flag on cmd", 'cmd /c /q "gs-admin jo p save"'],
]) {
  t = runHook(nestWs, cmd, freshSid());
  check(
    `closed residual (${label}): now asks with the resolved path`,
    t.decision === "ask" && t.reason.includes("Mutating Gainsight command: gs-admin journey programs save"),
    `${cmd} -> ${t.raw}`
  );
}
// A positional is a SCRIPT PATH to a POSIX shell, not a command string, so the
// positional rule is pwsh-only — asserting otherwise would claim an execution
// that does not happen. The control must be a positional that WOULD be found if
// the rule wrongly applied: a quoted command-looking string. (`bash script.sh`
// was the first spelling tried here and it is worthless as a control — it stays
// silent either way, because isGsAdminWord rejects the `.sh` filename before
// the positional rule matters. Mutation M60 caught that; keep this spelling.)
t = runHook(nestWs, "bash 'gs-admin jo p save'", freshSid());
check(
  "positional rule is pwsh-only: a posix positional is a script path, not a payload",
  t.silent,
  t.raw
);
// PowerShell's eval (F-249). The `noflag` family shipped POSIX-only, so
// `Invoke-Expression` and its `iex` alias — the same construct, on a hook
// registered for the PowerShell matcher — were silent on both lanes by the
// identical F-245 trace. `-Command` is a real parameter, so the option-skipping
// payload rule covers it with no extra case; `IEX` folds through normalizeProg.
for (const [label, cmd] of [
  ["iex, single-quoted", "iex 'gs-admin jo p save'"],
  ["Invoke-Expression, single-quoted", "Invoke-Expression 'gs-admin jo p save'"],
  ["Invoke-Expression, double-quoted", 'Invoke-Expression "gs-admin jo p save"'],
  ["IEX, case-folded", "IEX 'gs-admin jo p save'"],
  ["Invoke-Expression -Command", "Invoke-Expression -Command 'gs-admin jo p save'"],
  ["iex nested in a bash -c payload", "bash -c \"iex 'gs-admin jo p save'\""],
]) {
  t = runHook(nestWs, cmd, freshSid());
  check(
    `PowerShell eval (${label}): asks with the resolved path and no operand caveat`,
    t.decision === "ask" &&
      t.reason.includes("Mutating Gainsight command: gs-admin journey programs save") &&
      !t.reason.includes("does not stand at the start of a command segment"),
    `${cmd} -> ${t.raw}`
  );
}
// The read-only control: recognizing an interpreter must not turn its harmless
// payloads into prompts, or the family is just noise.
t = runHook(nestWs, "iex 'gs-admin --json re rules list'", freshSid());
check("PowerShell eval: a read-only payload still passes silently", t.silent, t.raw);
// The journal half of the same gap — F-249's defect was "no ask AND no journal".
{
  const iexws = makeWorkspace("iex-journal", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  runHook(iexws, "iex 'gs-admin jo p save'", freshSid(), "PostToolUse", { exit_code: 0 });
  const body = existsSync(journalOf(iexws, "acme-prod")) ? readFileSync(journalOf(iexws, "acme-prod"), "utf8") : "";
  check(
    "PowerShell eval: the journal records the resolved path and system area",
    body.includes("journey programs save") && body.includes("gs-journey"),
    body.slice(-400)
  );
}
// ACCEPTED RESIDUALS, pinned — DERIVED from hooks/guard-residuals.json, which is
// the single source of record for the set (F-246). Nothing here is hand-listed:
// add or remove a residual there and these checks follow, so the pins can never
// describe a different set than the documentation does. These assert what the
// guard does NOT catch; that is on purpose. If you CLOSE a residual, the matching
// check reds — the fix is to delete its entry from guard-residuals.json (which
// also forces the README copy, via check-doc-drift) in the same change, never to
// loosen the assertion.
// Rebuild a pinnedExample from the command it claims to conceal, so the stored
// example can be compared for EQUALITY rather than searched. An explicit
// encoding allow-list, not a generic "does the example contain the command"
// test: the point of a residual is that the command is NOT present as literal
// text, so a substring test would be satisfied by exactly the pins that conceal
// nothing. Unknown encoding returns null and fails the check closed.
// `verbatim` is for a residual that hides the command by INDIRECTION rather
// than by encoding (variable-payload: the text IS present, stored in a variable
// the eval later names) — the template carries the indirection, and the three
// assertions below still hold: silent as pinned, asks when spelled plainly, and
// exactly template + payload.
function buildPinnedExample(encoding, template, plain) {
  if (typeof template !== "string" || !template.includes("{payload}")) return null;
  let payload;
  if (encoding === "base64-utf16le") payload = Buffer.from(plain, "utf16le").toString("base64");
  else if (encoding === "base64-utf8") payload = Buffer.from(plain, "utf8").toString("base64");
  else if (encoding === "verbatim") payload = plain;
  else return null;
  return template.replace("{payload}", payload);
}
const RESIDUALS = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "guard-residuals.json"), "utf8")
).residuals;
check(
  "residual pins are derived from guard-residuals.json (F-246) and the file is non-empty",
  Array.isArray(RESIDUALS) && RESIDUALS.length > 0,
  JSON.stringify(RESIDUALS)
);
for (const r of RESIDUALS) {
  // Every residual is pinned, or states why it is not — the file's own rule,
  // asserted here so an unpinned-and-unexplained entry cannot slip in.
  if (!r.pinnedExample) {
    check(
      `residual ${r.id} is unpinned but states why (guard-residuals.json _pin_rule)`,
      typeof r.notPinnedWhy === "string" && r.notPinnedWhy.length > 0,
      JSON.stringify(r)
    );
    continue;
  }
  // (1) The residual is still open: the concealed spelling runs unseen.
  t = runHook(nestWs, r.pinnedExample, freshSid());
  check(`documented residual (${r.id}) is still uncaught — guard-residuals.json must keep naming it`, t.silent, t.raw);
  // (2) PIN INTEGRITY (F-251) — silence in (1) only means something if the
  // example actually CONCEALS A MUTATION. The first `encoded-command` pin
  // encoded the bare binary name with no subcommand, so it stayed silent even
  // under a guard that fully decoded and re-scanned the payload: it could not
  // tell "residual open" from "residual closed", and the whole suite stayed
  // green with the residual closed outright. Asserting the concealed command
  // ASKS when spelled plainly is what makes (1) attributable to the residual
  // rather than to an inert payload. The same decorative-assertion class as
  // M60 and D5; this is the mechanical answer to it.
  check(
    `pin integrity (${r.id}): the example declares what it conceals`,
    typeof r.pinnedExampleConceals === "string" && r.pinnedExampleConceals.length > 0 &&
      typeof r.pinnedExampleEncoding === "string" && r.pinnedExampleEncoding.length > 0,
    JSON.stringify(r)
  );
  t = runHook(nestWs, r.pinnedExampleConceals, freshSid());
  check(
    `pin integrity (${r.id}): the concealed command ASKS when spelled plainly — else the pin proves nothing`,
    t.decision === "ask" && t.reason.includes("Mutating Gainsight command:"),
    `${r.pinnedExampleConceals} -> ${t.raw}`
  );
  // (3) …and the example is EXACTLY the template plus that command, encoded, so
  // the two cannot drift apart. Equality rather than a substring test: a
  // truthful-looking `pinnedExampleConceals` must not be able to sit beside an
  // example that hides something else, or nothing, or that carries extra text
  // riding along after the payload.
  {
    const built = buildPinnedExample(r.pinnedExampleEncoding, r.pinnedExampleTemplate, r.pinnedExampleConceals);
    check(
      `pin integrity (${r.id}): the example is exactly its template + the encoded command it claims to conceal`,
      built !== null && built === r.pinnedExample,
      `built=${built} stored=${r.pinnedExample}`
    );
  }
}
// The journal half of the same gap.
{
  const ejws = makeWorkspace("eval-journal", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  runHook(ejws, "eval 'gs-admin jo p save'", freshSid(), "PostToolUse", { exit_code: 0 });
  const body = existsSync(journalOf(ejws, "acme-prod")) ? readFileSync(journalOf(ejws, "acme-prod"), "utf8") : "";
  check(
    "no-flag interpreter: approved eval mutation is journaled with its catalog path",
    body.includes("journey programs save") && body.includes("- system-area: gs-journey"),
    body || "(no journal written)"
  );
}

// ── Backslash line continuation (wave-5 review, F-195) ───────────────────────
// bash's `\` ⏎ is line continuation — the analogue of PowerShell's backtick
// (F-049) — but only the backtick was special-cased. The lone `\` token landed
// in rest, no candidate prefix matched, and a KNOWN mutation drew the vague
// "Unrecognized" prompt and journaled "- system-area: unknown" (fails CLOSED,
// degraded fidelity). Both tokenizers now swallow `\` + newline (and CRLF).
t = runHook(gluedWs, "gs-admin \\\n  --json re rules list", freshSid());
check("backslash continuation: read-only continuation passes silently", t.silent, t.raw);
t = runHook(gluedWs, "gs-admin \\\n  jo p save", freshSid());
check(
  "backslash continuation: mutation asks WITH the real words (not 'Unrecognized')",
  t.decision === "ask" &&
    t.reason.includes("Mutating Gainsight command: gs-admin journey programs save") &&
    !t.reason.includes("Unrecognized"),
  t.raw
);
t = runHook(gluedWs, "gs-admin \\\r\n  jo p save", freshSid());
check(
  "backslash continuation: CRLF spelling asks with the real words too",
  t.decision === "ask" && t.reason.includes("journey programs save"),
  t.raw
);
t = runHook(gluedWs, "gs-admin --json re rules \\\n  list", freshSid());
check("backslash continuation: mid-args continuation still parses as the read it is", t.silent, t.raw);
// The quote-blind tokenizer must swallow it too — an unbalanced quote earlier
// in the command otherwise regressed the SAME spelling back to the unknowns
// branch on the blind pass.
t = runHook(gluedWs, 'echo \\"note\ngs-admin \\\n  jo p save', freshSid());
check(
  "backslash continuation: quote-blind pass swallows it too (real words + blind caveat)",
  t.decision === "ask" && t.reason.includes("journey programs save") && t.reason.includes("quote-blind"),
  t.raw
);
// The journal half: attribution must be the real catalog path + X-2 area, not
// the fail-closed unknown catch-all the finding observed.
{
  const cjws = makeWorkspace("backslash-continuation-journal", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  runHook(cjws, "gs-admin \\\n  jo p save", freshSid(), "PostToolUse", { exit_code: 0 });
  const body = existsSync(journalOf(cjws, "acme-prod")) ? readFileSync(journalOf(cjws, "acme-prod"), "utf8") : "";
  check(
    "backslash continuation: journal attributes the catalog path, not fail-closed unknown",
    body.includes("journey programs save") && body.includes("- system-area: gs-journey") &&
      !body.includes("journaled fail-closed"),
    body || "(no journal written)"
  );
}

// ── stripBom negative half: interior BOMs are preserved (F-208) ──────────────
// doc-lib's stripBom documents "exactly one leading U+FEFF, never a global
// strip"; the guard carries its own two copies (the stdin read and
// readJsonFileTolerant). The STDIN copy's negative half is pinned by the
// F-113 fixtures above (leading junk / double BOM stay silent); this pins the
// FILE-read copy: a workspace consumer name carrying an interior BOM must NOT
// match its BOM-less spelling — a strip widened to a global regex would
// silently rewrite every workspace-file value the guard loads. The failing
// direction here is lint acceptance only; no mutation ask is involved.
// BOM built via fromCharCode — never a literal in a source file (F-130).
{
  const b = String.fromCharCode(0xfeff);
  const iws = makeWorkspace("interior-bom-consumers", [
    { slug: "acme-sbx", baseUrl: "https://acme--sbx.gainsightcloud.com", environment: "sandbox" },
  ]);
  writeFileSync(
    join(iws, ".gs-superadmin", "pipe-consumers.json"),
    b + JSON.stringify({ consumers: [`du${b}mp`, "dump-ok"] })
  );
  const r1 = runHook(iws, "gs-admin --json re rules list | dump", freshSid());
  check(
    "stripBom negative: interior-BOM consumer name does NOT match plain dump (F-208)",
    r1.decision === "deny",
    r1.raw
  );
  // Control: the leading BOM was still stripped — the same file's clean
  // sibling entry loads and is accepted, so the deny above is the interior
  // BOM surviving, not the whole file failing to parse.
  const r2 = runHook(iws, "gs-admin --json re rules list | dump-ok", freshSid());
  check(
    "stripBom negative: clean sibling entry in the same BOM'd file still accepted",
    r2.silent,
    r2.raw
  );
}

// ── Bounded reply in a many-tenant workspace (guard wave B16, F-363) ─────────
// The ask reason grew by ~165 bytes per tenant directory with nothing capping
// the total (measured pre-fix with 80-char labels: 50 dirs → 8,684 bytes of
// stdout, 100 → 16,934) — unreadable in a permission prompt, and on a macOS
// pipe cut at the 8,192-byte first chunk because the hook exited right after
// the write. Two halves are pinned here. DISCRIMINATING ON EVERY OS: the
// tenant list is cut at five with an "; and K more" tail; production-like
// tenants lead a cut list so the ⚠ warning still names its tenant; the
// shell-variable list is cut the same way with "(+K more)"; and the assembled
// reason stays under REASON_BOUND at 100 tenant directories + 50 variable
// subcommands. DISCRIMINATING ON macOS ONLY: "stdout parses whole" against a
// reply site reverted to write-then-exit — Linux and Windows pipes are
// synchronous, so that assertion is green there with or without the callback
// exit (its home is the release matrix's macos-latest leg, banked by the repo's
// validation ledger under "W10 · F-363"). Labels
// are worst-case on purpose: printable() caps slug and URL at 80 chars each.
{
  const REASON_BOUND = 4096; // half the chunk — the whole reply fits twice over
  const manyTenants = (n) => {
    const ms = [];
    for (let i = 0; i < n; i++) {
      const id = String(i).padStart(3, "0");
      ms.push({
        slug: `acme-tenant-${id}-` + "s".repeat(80),
        baseUrl: `https://acme-tenant-${id}-` + "u".repeat(80) + ".gainsightcloud.com",
        // The LAST directory in readdir order is the production one: a plain
        // first-five cut hides it; only the prod-first ordering shows it.
        environment: i === n - 1 ? "production" : "sandbox",
      });
    }
    return ms;
  };
  // One driver: runHook parses defensively (parseReply, F-369) and reports
  // the reply's byte length — the private rawReply this block carried was a
  // second spelling of the same spawn with a comment that stopped being true
  // the day F-369 landed (release-gate review, F-381).
  const rawReply = (cwd, command, sessionId) => runHook(cwd, command, sessionId);
  const shownLabels = (reason) => (reason.match(/acme-tenant-\d{3}-s/g) ?? []).length;

  for (const n of [50, 100]) {
    const r = rawReply(makeWorkspace(`many-tenants-${n}`, manyTenants(n)), MUTATING, freshSid());
    check(`F-363 (${n} tenant dirs): stdout parses WHOLE and the hook exits 0`, r.parsed && r.raw !== "" && r.status === 0, `${r.bytes} bytes, exit ${r.status}`);
    check(`F-363 (${n} tenant dirs): the decision is still "ask" — never deny, never absent`, r.decision === "ask", r.reason || String(r.j));
    check(`F-363 (${n} tenant dirs): five tenants named, then "; and ${n - 5} more"`, shownLabels(r.reason) === 5 && r.reason.includes(`; and ${n - 5} more)`), r.reason);
    const prodId = String(n - 1).padStart(3, "0");
    check(
      `F-363 (${n} tenant dirs): the production tenant (last in directory order) is among the five shown and the warning is the recorded one`,
      r.reason.includes(`acme-tenant-${prodId}-`) && r.reason.includes("PRODUCTION (recorded at setup)"),
      r.reason
    );
    check(`F-363 (${n} tenant dirs): reason under ${REASON_BOUND} bytes`, Buffer.byteLength(r.reason) < REASON_BOUND, `${Buffer.byteLength(r.reason)} bytes`);
  }

  // At the cap nothing changes: five tenants are all named, in directory
  // order, with no tail — the fix is invisible to every workspace it does not
  // need to touch.
  {
    const five = manyTenants(5);
    const r = rawReply(makeWorkspace("many-tenants-5", five), MUTATING, freshSid());
    const order = five.map((m) => r.reason.indexOf(m.slug.slice(0, 80))); // printable() clamps the slug at 80
    check(
      "F-363 (5 tenant dirs, at the cap): all five named in directory order, no \"more\" tail",
      r.decision === "ask" && shownLabels(r.reason) === 5 && !r.reason.includes(" more)") &&
        order.every((i, k) => i !== -1 && (k === 0 || i > order[k - 1])),
      r.reason
    );
  }

  // The shell-variable list, same cap: 50 `gs-admin $c` segments in one
  // command. First offense per session is the coaching deny, the repeat is the
  // escalated ask — both carry the one bounded `shown` string. The repeat on
  // the 100-directory workspace is the combined worst case the bound is for.
  {
    // 70-char variable names: worst case for the 80-char per-entry clamp, so an
    // uncapped list (50 × ~93 bytes) would cross the bound on its own.
    const varCmd = Array.from({ length: 50 }, (_, i) => `gs-admin $c${i}_${"v".repeat(70)}`).join("; ");
    const vws = makeWorkspace("many-tenants-vars", manyTenants(100));
    const vsid = freshSid();
    const d = rawReply(vws, varCmd, vsid);
    check(
      "F-363 (50 variable subcommands): first-offense deny names five and \"(+45 more)\", under the bound",
      d.decision === "deny" && (d.reason.match(/gs-admin \$c\d+/g) ?? []).length === 5 && d.reason.includes("(+45 more)") &&
        Buffer.byteLength(d.reason) < REASON_BOUND,
      `${Buffer.byteLength(d.reason)} bytes: ${d.reason}`
    );
    const a = rawReply(vws, varCmd, vsid);
    check(
      "F-363 (50 variable subcommands + 100 tenant dirs): the escalated ask carries both capped lists, parses whole, under the bound",
      a.j !== null && a.status === 0 && a.decision === "ask" && a.reason.includes("(+45 more)") && a.reason.includes("; and 95 more)") &&
        Buffer.byteLength(a.reason) < REASON_BOUND,
      `${Buffer.byteLength(a.reason)} bytes, exit ${a.status}: ${a.reason}`
    );
    console.log(`      (F-363 measured: 100 tenant dirs → ${Buffer.byteLength(a.reason)}-byte reason on the combined ask; bound ${REASON_BOUND})`);
  }
}

// ── An unparseable reply is REPORTED, never thrown (F-369) ───────────────────
// Driven with a stand-in hook that writes two replies for one payload — the
// shape the real hook emits at a deny site whose halt has been deleted, and the
// shape that used to end the run with a SyntaxError. The three properties that
// matter to a reader of a FAIL line: the call returns, the reply is marked
// unparsed rather than silent, and the raw bytes survive for the detail column.
{
  const reply = (d) =>
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: d, permissionDecisionReason: "fixture" },
    });
  const doubleHook = join(ROOT, "f369-double-reply-hook.mjs");
  writeFileSync(doubleHook, `process.stdout.write(${JSON.stringify(reply("deny") + reply("ask"))});\n`);
  const ws = makeWorkspace("f369", [{ slug: "acme", baseUrl: "https://acme.gainsightcloud.com" }]);

  let threw = null;
  let t = null;
  try {
    t = runHook(ws, MUTATING, freshSid(), undefined, undefined, {}, doubleHook);
  } catch (e) {
    threw = e;
  }
  check("F-369: a doubled reply is reported, not thrown", threw === null, threw ? String(threw) : "");
  check(
    "F-369: an unparseable reply is parsed:false with a null decision",
    t?.parsed === false && t?.decision === null,
    JSON.stringify({ parsed: t?.parsed, decision: t?.decision })
  );
  check(
    "F-369: the raw stdout survives for the FAIL detail (both objects present)",
    (t?.raw.match(/hookSpecificOutput/g) ?? []).length === 2,
    t?.raw ?? ""
  );

  // The two shapes that must NOT be confused with it.
  const ok = runHook(ws, MUTATING, freshSid());
  check("F-369: a well-formed reply still parses, decision preserved", ok.parsed === true && ok.decision === "ask", ok.raw);
  const quiet = runHook(ws, "gs-admin re rules list", freshSid());
  check("F-369: a silent pass is parsed:true, never read as a bad reply", quiet.parsed === true && quiet.silent === true, quiet.raw);
}

// ── F-428: the outcome word is entailed by a signal the hook read. The harness
// event and any exit code describe the whole COMMAND LINE; a mutating call that
// was not the line's last stage (piped, `;`/`||`-chained, a non-last line, or
// inside a nested shell that is itself piped) cannot be journaled "completed"
// from them. `&&` is the one boundary that preserves the call's failure; a
// bare stderr redirect (`2>&1`) is not a boundary at all.
{
  const wsM = makeWorkspace("journal-masked", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  const lastOutcome = () => {
    const j = existsSync(journalOf(wsM, "acme-prod")) ? readFileSync(journalOf(wsM, "acme-prod"), "utf8") : "";
    return (j.match(/^- outcome: .*$/gm) ?? []).pop() ?? "(no entry)";
  };
  const MASKED = /^- outcome: ran — exit status not visible \(this call was not the command line's last stage/;
  const COMPLETED = /^- outcome: completed \(success event; no exit code reported\)$/;
  /** @type {Array<[string, string, ({exit_code: number} | undefined), RegExp]>} */
  const cases = [
    ["piped into head, success event → qualified (the tester's measured case)", `${MUTATING} 2>&1 | head -12; echo done`, undefined, MASKED],
    ["piped, exit_code 0 → qualified (the 0 is the pipeline's)", `${MUTATING} | cat`, { exit_code: 0 }, MASKED],
    ["semicolon-chained → qualified", `${MUTATING}; echo done`, undefined, MASKED],
    ["or-chained → qualified", `${MUTATING} || true`, undefined, MASKED],
    ["non-last line of a multi-line command → qualified", `${MUTATING}\necho done`, undefined, MASKED],
    ["inside a nested shell that is itself piped → qualified", `bash -c '${MUTATING}' | cat`, undefined, MASKED],
    ["and-chained keeps completed (a later stage cannot hide this one's failure)", `${MUTATING} && echo ok`, undefined, COMPLETED],
    ["last stage of a chain keeps completed", `echo start; ${MUTATING}`, undefined, COMPLETED],
    ["a bare stderr redirect is not a boundary — keeps completed", `${MUTATING} 2>&1`, undefined, COMPLETED],
    [
      "piped with exit_code 1 keeps the FAILED head and says the failure may belong to a later stage",
      `${MUTATING} | grep nomatch`,
      { exit_code: 1 },
      /^- outcome: exit 1 — command FAILED; this change likely did not apply — NOTE: this call was not the command line's last stage.*verify whether this change applied$/,
    ],
  ];
  for (const [label, cmd, tr, re] of cases) {
    runHook(wsM, cmd, "guard-fixtures", "PostToolUse", tr);
    const o = lastOutcome();
    check(`F-428 ${label}`, re.test(o), `${JSON.stringify(cmd)} → ${o}`);
  }
}

// ── F-431: `- target:` fidelity — arguments read from structure, not adjacency ─
// The argument collector stopped only at operator tokens, so a two-line command
// journaled line 2 as line 1's target ("echo done"), a heredoc opener carried
// its redirection word and body ("<<EOF x"), and a body hit swallowed the rest
// of the body and the command after the terminator. A false target in an audit
// row. Boundaries now come from what the tokenizer recorded: a segment start,
// heredoc data (in or out), a body line, a heredoc word.
{
  const targetOf = (label, cmd) => {
    const ws = makeWorkspace(`target-${label}`, [
      { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
    ]);
    runHook(ws, cmd, freshSid(), "PostToolUse", { exit_code: 0 });
    const j = readFileSync(journalOf(ws, "acme-prod"), "utf8");
    return (j.match(/^- target: .*$/gm) ?? []).map((l) => l.slice("- target: ".length));
  };
  let tg = targetOf("two-line", `${MUTATING}\necho done`);
  check("F-431 (t1): a two-line command does not journal line 2 as line 1's target", tg.length === 1 && tg[0] === "(none stated)", tg);
  tg = targetOf("opener", `${MUTATING} <<EOF\nx\nEOF`);
  check("F-431 (t2): a heredoc opener's target stops at the redirection word — no `<<EOF`, no body", tg.length === 1 && tg[0] === "(none stated)", tg);
  tg = targetOf("body", `cat > n.md <<'EOF'\n${MUTATING} --name Foo\nsecond line\nEOF\necho done`);
  check("F-431 (t3): a body hit's target is its own body line's text — not the next body line, not the command after the terminator", tg.length === 1 && tg[0] === "Foo", tg);
  tg = targetOf("redirect-control", `${MUTATING} --name Foo > out.txt`);
  check("F-431 (t4, control): an ordinary argument before a redirect is still the target", tg.length === 1 && tg[0] === "Foo", tg);
  tg = targetOf("spaced-opener", `${MUTATING} << EOF\nx\nEOF`);
  check("F-431 (t5): a spaced `<< EOF` opener stops at the bare `<<` word too", tg.length === 1 && tg[0] === "(none stated)", tg);
  tg = targetOf("continuation-control", `${MUTATING} \\\n--name Foo`);
  check("F-431 (t6, control): a backslash continuation is the SAME command — its argument on line 2 is still the target", tg.length === 1 && tg[0] === "Foo", tg);
  tg = targetOf("two-hits", `${MUTATING} --name One\n${MUTATING} --name Two`);
  check("F-431 (t7): two invocations on two lines each keep their own target", tg.length === 2 && tg[0] === "One" && tg[1] === "Two", tg);
}

// ── F-436 (the /security-review of 0.37.0): a redirection is stepped over, never a boundary ──
// The argument collector stopped at a heredoc word (F-431's target boundary) and
// at every OPERATORS member — redirections included — as if each ended the
// invocation. A redirection standing BEFORE the subcommand words therefore
// emptied the collection, and an empty collection read as "no invocation":
// `gs-admin <<EOF jo p save` asked on 0.36.3 and went silent on the F-431 tree
// (the regression the review found); `gs-admin > out.txt jo p save` was silent
// on both (the class is older than the regression).
// SECOND PASS (the tester's `>|` reopen): the first fix marked redirection words
// with per-character clauses — an `&` rule for `>&2`/`2>&1`/`&>log` — and `|`
// in `>|` had no clause, so it split as a pipe and the collection emptied again.
// The grammar fact now lives ONCE, in the hook's REDIR_OPS vocabulary, and the
// spellings pinned here are GENERATED from that vocabulary (read out of the hook's
// source, like check 22 reads doc-lib's), glued / spaced / fd-prefixed, so an
// operator added to the vocabulary is pinned without a fixture edit — and a
// spelling missing from it is missing here too, which is the honest shape of
// the coverage. Beyond the vocabulary: process substitution (`> >(cat)` — the
// tokenizer splits `(`, so the substitution is one word of the enclosing
// command whose inside is scanned as its own), PowerShell's `*>` / `n>&1` (the
// hook guards both tools with one grammar), and the tester's `>|` rows verbatim.
{
  const REDIR_OPS = HOOK_REDIR_OPS;
  check("F-436 (vocabulary): the hook's REDIR_OPS is readable from its source and non-empty", Array.isArray(REDIR_OPS) && REDIR_OPS.length > 0, JSON.stringify(REDIR_OPS));
  check("F-436 (vocabulary): bash's clobber `>|` is in the vocabulary (the tester's reopen spelling)", REDIR_OPS.includes(">|"), JSON.stringify(REDIR_OPS));
  // One leading spelling per operator × form. A heredoc operator carries a body;
  // a dup operator (`>&`, `<&`) takes an fd; everything else a file word.
  const HEREDOC = new Set(["<<", "<<-"]);
  const spell = (fd, op, spaced) => {
    const target = HEREDOC.has(op) ? "EOF" : op === "<<<" ? "text" : op === ">&" ? "2" : op === "<&" ? "0" : "f";
    const word = fd + op + (spaced ? " " : "") + target;
    return HEREDOC.has(op) ? `gs-admin ${word} jo p save\nx\nEOF` : `gs-admin ${word} jo p save`;
  };
  const LEADING = [];
  for (const op of REDIR_OPS) {
    LEADING.push([`${op} glued`, spell("", op, false)]);
    LEADING.push([`${op} spaced`, spell("", op, true)]);
    if (op.startsWith(">") || op.startsWith("<")) {
      // Every fd prefix the grammar allows (third pass — the tester's {varname}
      // reopen): a digit, a SECOND digit so the pin is not "fd 1", and bash's
      // {varname}, glued and spaced. The prefix is read from the same
      // vocabulary as the operator (FD_PREFIX in the hook).
      LEADING.push([`1${op} (fd-prefixed)`, spell("1", op, false)]);
      LEADING.push([`2${op} (fd-prefixed, another digit)`, spell("2", op, false)]);
      LEADING.push([`{v}${op} (varname fd, glued)`, spell("{v}", op, false)]);
      LEADING.push([`{v}${op} (varname fd, spaced)`, spell("{v}", op, true)]);
    }
  }
  LEADING.push(
    ["PowerShell *> (all streams)", "gs-admin *> f jo p save"],
    ["PowerShell *>> (all streams, append)", "gs-admin *>> f jo p save"],
    ["PowerShell 3>&1 (stream merge)", "gs-admin 3>&1 jo p save"],
    ["PowerShell 2>$null", "gs-admin 2>$null jo p save"],
    ["> out.txt then a global flag", "gs-admin > out.txt --json jo p save"],
    ["nested payload, <<EOF first", "bash -c \"gs-admin <<EOF jo p save\nx\nEOF\""],
    ["redirect to a process substitution, leading", "gs-admin > >(cat) jo p save"],
    ["input from a process substitution, leading", "gs-admin < <(echo x) jo p save"],
    ["tester arm G: >| leading, her exact shape", "gs-admin >| .gs-superadmin/tmp/f436-g.txt jo p save"],
    ["tester arm H2: {v}> leading, her exact shape", "gs-admin {v}>.gs-superadmin/tmp/f436b-h2.txt jo p save"],
    ["tester arm H2 spaced", "gs-admin {v}> .gs-superadmin/tmp/f436b-h2.txt jo p save"],
    ["flag value ${F} before the subcommand (braces mid-word are a word)", "gs-admin --format ${F} jo p save"],
    ["flag value $(…) before the subcommand (a substitution is one word)", "gs-admin --format $(echo json) jo p save"],
    ["group with a leading redirect inside", "{ gs-admin >f jo p save; }"],
  );
  let k = 0;
  const wsFor = () => makeWorkspace(`f436-${k++}`, [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  const rowsOf = (cmd, tr = { exit_code: 0 }) => {
    const ws = wsFor();
    runHook(ws, cmd, freshSid(), "PostToolUse", tr);
    const j = existsSync(journalOf(ws, "acme-prod")) ? readFileSync(journalOf(ws, "acme-prod"), "utf8") : "";
    return {
      outcomes: (j.match(/^- outcome: .*$/gm) ?? []).map((l) => l.slice("- outcome: ".length)),
      targets: (j.match(/^- target: .*$/gm) ?? []).map((l) => l.slice("- target: ".length)),
      notes: (j.match(/^- note: /gm) ?? []).length,
    };
  };
  let res, r;
  for (const [label, cmd] of LEADING) {
    res = runHook(wsFor(), cmd, freshSid());
    check(
      `F-436 (${label}): the leading redirection is stepped over — the mutating ask, no operand caveat`,
      res.decision === "ask" && res.reason.includes("Mutating Gainsight command: gs-admin journey programs save") && !res.reason.includes("operand position"),
      res.raw
    );
    r = rowsOf(cmd);
    check(`F-436 (${label}): the mutation is journaled — one row`, r.outcomes.length === 1, JSON.stringify(r));
  }
  // The quote-erased twin (F-433's class): a QUOTED look-alike is an argument,
  // not a redirection — it must never empty the collection.
  res = runHook(wsFor(), "gs-admin '<<EOF' jo p save", freshSid());
  check("F-436 (twin): a quoted '<<EOF' argument never empties the collection — it asks (the word is an argument; fail-closed unknown)", res.decision === "ask", res.raw);
  res = runHook(wsFor(), "gs-admin '>|' jo p save", freshSid());
  check("F-436 (twin): a quoted '>|' argument is an argument too — it asks, and is not read as a pipe", res.decision === "ask" && !res.reason.includes("pipeline"), res.raw);
  // Process substitution as an ARGUMENT (leading): the shell hands the CLI a
  // /dev/fd path as its first word, so no mutation can run — but the guard
  // must not read the construct as a command boundary: fail-closed ask.
  res = runHook(wsFor(), "gs-admin >(cat) jo p save", freshSid());
  check("F-436 (procsub as argument): `gs-admin >(cat) jo p save` asks (fail-closed) rather than dropping the invocation", res.decision === "ask", res.raw);
  // …and a mutation INSIDE a process substitution is still its own command:
  // the inner words are a segment, so closing this class must not open that one.
  res = runHook(wsFor(), `echo x > >(${MUTATING})`, freshSid());
  check("F-436 (procsub inside): a mutation INSIDE `>(…)` still asks — the inner command is scanned as its own", res.decision === "ask" && res.reason.includes("Mutating Gainsight command: gs-admin journey programs save"), res.raw);
  r = rowsOf(`echo x > >(${MUTATING})`);
  check("F-436 (procsub inside): …and is journaled", r.outcomes.length === 1, JSON.stringify(r));
  r = rowsOf(`${MUTATING} > >(cat)`);
  check("F-436 (procsub trailing): a trailing redirect to a process substitution keeps one row, target (none stated)", r.outcomes.length === 1 && r.targets.join("|") === "(none stated)", JSON.stringify(r));
  // Target fidelity in both directions: arguments after a leading redirection
  // are the command's own; the F-431 boundaries that ARE boundaries still hold.
  r = rowsOf(`${MUTATING} > out.txt --name Foo`);
  check("F-436 (target): the arguments after a leading redirection are this command's target", r.targets.join("|") === "Foo", JSON.stringify(r));
  r = rowsOf(`${MUTATING} >| .gs-superadmin/tmp/f436-e.txt --name Foo`);
  check("F-436 (tester arm E): an interior `>|` is a redirection, not a pipe — target Foo, no pipeline masking note", r.targets.join("|") === "Foo" && r.outcomes.length === 1 && r.outcomes[0] === "exit 0" && r.notes === 0, JSON.stringify(r));
  r = rowsOf(`${MUTATING} <<EOF\nx\nEOF`);
  check("F-436 (target, F-431 t2 kept): a trailing heredoc opener contributes nothing to the target", r.targets.join("|") === "(none stated)", JSON.stringify(r));
  r = rowsOf(`${MUTATING} --name Foo > out.txt`);
  check("F-436 (target, F-431 t4 kept): an argument before a trailing redirect is still the target", r.targets.join("|") === "Foo", JSON.stringify(r));
  // Controls that must NOT change.
  res = runHook(wsFor(), "gs-admin | cat", freshSid());
  check("F-436 (control): a bare binary before a separator is still silent — nothing to approve", res.silent, res.raw);
  res = runHook(wsFor(), "gs-admin && echo ok", freshSid());
  check("F-436 (control): `&&` is still a separator (an `&` that starts no redirection)", res.silent, res.raw);
  r = rowsOf(`gs-admin <<EOF\n${MUTATING}\nEOF`);
  check("F-436 (control): a mutation in a heredoc BODY is still operand-qualified data, one row", r.outcomes.length === 1 && /^not verified as executed \(found in operand position/.test(r.outcomes[0]), JSON.stringify(r));
  r = rowsOf(`${MUTATING} 2>&1`);
  check("F-436 (control): `2>&1` is one redirection word, not a separator — the row stays bare", r.outcomes.length === 1 && r.outcomes[0] === "exit 0", JSON.stringify(r));
  r = rowsOf(`${MUTATING} 2>&1 | cat`);
  check("F-436 (control): a pipe after `2>&1` still masks the row (F-428)", r.outcomes.length === 1 && /^ran — exit status not visible/.test(r.outcomes[0]), JSON.stringify(r));
  r = rowsOf(`grep '<<EOF' f.md\n${MUTATING}`);
  check("F-436 (control, F-433 kept): a quoted `<<EOF` argument opens no body — the next line's mutation journals a bare row", r.outcomes.length === 1 && r.outcomes[0] === "exit 0", JSON.stringify(r));
  r = rowsOf(`echo $((1<<8))\n${MUTATING}`);
  check("F-436 (control, F-433 kept): an arithmetic shift opens no body", r.outcomes.length === 1 && r.outcomes[0] === "exit 0", JSON.stringify(r));
}

// ── F-436 (third pass): what the lexer records beyond the pins above ─────────
{
  const ws = makeWorkspace("f436-third", [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  const res = runHook(ws, "gs-admin ${fd}>f jo p save", freshSid());
  check("F-436 (third pass): a substituted fd `${fd}>f` is never silent — an unreadable word routes to the variable-subcommand path (deny or ask)", res.decision === "ask" || res.decision === "deny", res.raw);
}
// ── F-436 (third pass): payloads the line carries, and a bare operand ────────
// Found by the shell-oracle suite, not by a list: `echo jo p save | xargs
// gs-admin` executed in silence (a bare gs-admin as another command's
// argument had "nothing to approve"), and so did `env -S 'gs-admin jo p save'`
// (a string run as a command line, with no family in NESTED_SHELLS). The
// readable stdin shapes are closed with them; the unreadable ones are the
// documented stdin-payload residual.
{
  let k = 0;
  const ws = () => makeWorkspace(`f436-payload-${k++}`, [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  const rows = (cmd) => {
    const w = ws();
    runHook(w, cmd, freshSid(), "PostToolUse", { exit_code: 0 });
    return existsSync(journalOf(w, "acme-prod")) ? (readFileSync(journalOf(w, "acme-prod"), "utf8").match(/^## /gm) ?? []).length : 0;
  };
  const MUTATES = (r) => r.decision === "ask" && r.reason.includes("Mutating Gainsight command: gs-admin journey programs save");
  let res = runHook(ws(), "echo jo p save | xargs gs-admin", freshSid());
  check("F-436 (payloads): a bare gs-admin fed by xargs asks fail-closed, in operand position", res.decision === "ask" && res.reason.includes("no subcommand words on this line") && res.reason.includes("operand position"), res.raw);
  check("F-436 (payloads): …and journals a row", rows("echo jo p save | xargs gs-admin") === 1, "rows");
  res = runHook(ws(), "which gs-admin", freshSid());
  check("F-436 (payloads): `which gs-admin` draws the same fail-closed ask — a bare operand is never silent", res.decision === "ask", res.raw);
  res = runHook(ws(), "gs-admin", freshSid());
  check("F-436 (payloads, control): a bare gs-admin at COMMAND position is its help — silent", res.silent, res.raw);
  res = runHook(ws(), "gs-admin --version", freshSid());
  check("F-436 (payloads, control): flags only at command position — silent", res.silent, res.raw);
  res = runHook(ws(), "env -S 'gs-admin jo p save'", freshSid());
  check("F-436 (payloads): env -S runs its string — the mutating ask", MUTATES(res), res.raw);
  res = runHook(ws(), "env X=1 gs-admin jo p save", freshSid());
  check("F-436 (payloads, control): env without -S is a prefix command — asks", res.decision === "ask", res.raw);
  res = runHook(ws(), "watch -n 5 'gs-admin jo p save'", freshSid());
  check("F-436 (payloads): watch runs its string, past its -n value — the mutating ask", MUTATES(res), res.raw);
  res = runHook(ws(), "bash <<< 'gs-admin jo p save'", freshSid());
  check("F-436 (payloads): a here-string target is the interpreter's payload — the mutating ask", MUTATES(res), res.raw);
  res = runHook(ws(), "bash <<<'gs-admin jo p save'", freshSid());
  check("F-436 (payloads): …glued here-string too", MUTATES(res), res.raw);
  // Piping into an interpreter draws the shell-safety lint's coaching DENY
  // first (bash/sh are not pipe consumers) — guarded, but the rescan behind it
  // is exercised in a workspace that ACCEPTS them as consumers.
  res = runHook(ws(), "echo 'gs-admin jo p save' | bash", freshSid());
  check("F-436 (payloads): piping into bash is guarded by the lint's deny in a default workspace", res.decision === "deny", res.raw);
  const consumerWs = ws();
  writeFileSync(join(consumerWs, ".gs-superadmin", "pipe-consumers.json"), JSON.stringify({ consumers: ["bash", "sh"] }));
  res = runHook(consumerWs, "echo 'gs-admin jo p save' | bash", freshSid());
  check("F-436 (payloads): with bash accepted as a consumer, the upstream stage's words are re-scanned as its payload — the mutating ask", MUTATES(res), res.raw);
  res = runHook(consumerWs, "printf '%s\\n' 'gs-admin jo p save' | sh", freshSid());
  check("F-436 (payloads): …printf upstream of sh too", MUTATES(res), res.raw);
  res = runHook(consumerWs, "cat notes.md | bash", freshSid());
  check("F-436 (payloads, control): an upstream stage carrying no command text finds nothing — silent (the stdin-payload residual)", res.silent, res.raw);
  for (const cmd of ["cat script.sh | bash", "bash < script.sh", "bash script.sh"]) {
    res = runHook(ws(), cmd, freshSid());
    check(`F-436 (payloads, residual stdin-payload): \`${cmd}\` stays silent — the commands are in a file the line does not carry`, res.silent, res.raw);
  }
}
// ── F-438: the outcome qualifier follows WHOSE status the harness reported ───
// segmentMasked used "a later segment start exists" as a proxy for "a later
// pipeline stage": true for the inner command of a substitution (so
// `cmd > >(cat)` was masked though bash reports cmd's own status) and false
// for a call INSIDE a substitution (so `echo x > >(gs-admin …)` journaled the
// outer echo's success as the mutation's). Both now read the lexer's spans.
{
  let k = 0;
  const rowsOf = (cmd, tr = { exit_code: 0 }) => {
    const ws = makeWorkspace(`f438-${k++}`, [
      { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
    ]);
    runHook(ws, cmd, freshSid(), "PostToolUse", tr);
    const j = existsSync(journalOf(ws, "acme-prod")) ? readFileSync(journalOf(ws, "acme-prod"), "utf8") : "";
    return (j.match(/^- outcome: .*$/gm) ?? []).map((l) => l.slice("- outcome: ".length));
  };
  const ENCLOSING = /^ran — exit status not visible \(this call ran inside a substitution/;
  const STAGE = /^ran — exit status not visible \(this call was not the command line's last stage/;
  let o = rowsOf(`${MUTATING} > >(cat)`);
  check("F-438 (P2): a trailing redirect to a process substitution reports the call's OWN status — bare row", o.length === 1 && o[0] === "exit 0", JSON.stringify(o));
  o = rowsOf("gs-admin > >(cat) jo p save");
  check("F-438 (P1): a leading redirect to a process substitution — bare row", o.length === 1 && o[0] === "exit 0", JSON.stringify(o));
  o = rowsOf(`echo x > >(${MUTATING})`);
  check("F-438 (P3): a mutation INSIDE a process substitution is qualified — the status is the enclosing command's", o.length === 1 && ENCLOSING.test(o[0]), JSON.stringify(o));
  o = rowsOf(`echo $(${MUTATING})`);
  check("F-438: inside $(…) the same qualifier", o.length === 1 && ENCLOSING.test(o[0]), JSON.stringify(o));
  o = rowsOf(`echo \`${MUTATING}\``);
  check("F-438: inside backticks the same qualifier", o.length === 1 && ENCLOSING.test(o[0]), JSON.stringify(o));
  o = rowsOf(`cat <(${MUTATING})`);
  check("F-438: inside <(…) the same qualifier", o.length === 1 && ENCLOSING.test(o[0]), JSON.stringify(o));
  o = rowsOf(`echo x > >(${MUTATING})`, { exit_code: 1 });
  check("F-438: a failure-shaped signal inside a substitution keeps its FAILED head and says the failure is the enclosing command's", o.length === 1 && /command FAILED/.test(o[0]) && /enclosing command's/.test(o[0]), JSON.stringify(o));
  o = rowsOf(`${MUTATING} | cat`);
  check("F-438 (control, F-428 kept): a later pipeline stage masks with the stage wording", o.length === 1 && STAGE.test(o[0]), JSON.stringify(o));
  o = rowsOf(`${MUTATING} && echo ok`);
  check("F-438 (control): && keeps the bare row", o.length === 1 && o[0] === "exit 0", JSON.stringify(o));
  o = rowsOf(`(${MUTATING}) | cat`);
  check("F-438 (control): a subshell followed by a pipe is a later stage — masked", o.length === 1 && STAGE.test(o[0]), JSON.stringify(o));
  // Two more shapes the shell-oracle test's status invariant surfaced.
  o = rowsOf(`${MUTATING} &`);
  check("F-438: a backgrounded call's row says the line's status is not its own", o.length === 1 && /backgrounded/.test(o[0]), JSON.stringify(o));
  o = rowsOf(`! ${MUTATING}`);
  check("F-438: a negated call's row says the status is inverted", o.length === 1 && /negated/.test(o[0]), JSON.stringify(o));
}

// ── Release-gate review of 0.37.0 (F-433, F-428 third instances): the guard ────
// F-433: a heredoc is announced by an UNQUOTED `<<` the character loop saw at a
// word's start, outside `$(( … ))` — never by the assembled word alone. A quoted
// `<<EOF`, an arithmetic shift, or a spaced `<< 2` inside arithmetic opened a
// phantom heredoc that swallowed every following line as inert body, so a real,
// executing mutation on the next line was journaled "not verified as executed".
{
  /**
   * @param {string} label
   * @param {string} cmd
   * @param {Record<string, unknown>} [tr]  the tool_response payload, any shape the harness may send
   * @param {string | null} [event]  null omits hook_event_name (the inferred-PostToolUse path)
   */
  const gateRows = (label, cmd, tr = { exit_code: 0 }, event = "PostToolUse") => {
    const ws = makeWorkspace(`gate-${label}`, [
      { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
    ]);
    runHook(ws, cmd, freshSid(), event, tr);
    const j = existsSync(journalOf(ws, "acme-prod")) ? readFileSync(journalOf(ws, "acme-prod"), "utf8") : "";
    return { outcomes: (j.match(/^- outcome: .*$/gm) ?? []).map((l) => l.slice("- outcome: ".length)), notes: (j.match(/^- note: /gm) ?? []).length };
  };
  const BARE = (o) => o === "exit 0";
  for (const [label, cmd] of [
    ["quoted <<EOF in a grep argument", `grep '<<EOF' f.md\n${MUTATING}`],
    ["quoted <<EOF in a commit message", `git commit -m "<<EOF explained"\n${MUTATING}`],
    ["arithmetic shift 1<<8", `echo $((1<<8))\n${MUTATING}`],
    ["spaced arithmetic shift x << 2", `echo $((x << 2))\n${MUTATING}`],
  ]) {
    const r = gateRows(label.replace(/[^a-z0-9]+/gi, "-"), cmd);
    check(`F-433 (${label}): the next line is a real command — bare row, no note`, r.outcomes.length === 1 && BARE(r.outcomes[0]) && r.notes === 0, r);
    t = runHook(gluedWs, cmd, freshSid());
    check(`F-433 (${label}): the ask carries no operand caveat`, t.decision === "ask" && !t.reason.includes("operand position"), t.raw);
  }
  // Real heredocs still open: the quoted-delimiter form, and the fd-prefixed form.
  let r = gateRows("fd-heredoc", `cat 3<<EOF\n${MUTATING}\nEOF`);
  check("F-433 (control): `3<<EOF` is a heredoc on fd 3 — its body is operand", r.outcomes.length === 1 && /^not verified as executed \(found in operand position/.test(r.outcomes[0]), r);
  r = gateRows("quoted-delim-heredoc", `cat <<'EOF'\n${MUTATING}\nEOF`);
  check("F-433 (control): a quoted DELIMITER is still a heredoc — its body is operand", r.outcomes.length === 1 && /^not verified as executed \(found in operand position/.test(r.outcomes[0]), r);
  // F-428, review instances: the qualifier never claims more than the base word,
  // interruption is read from the base word, and every finding shape carries `masked`.
  r = gateRows("no-signal-piped", `${MUTATING} | cat`, { stdout: "x" }, null); // null: runHook omits hook_event_name (undefined would take the default)
  check("F-428 (review): a piped call whose harness reported NO status stays \"not verified (harness reported no exit status)\" — masking never upgrades it to \"ran\"", r.outcomes.length === 1 && r.outcomes[0] === "not verified (harness reported no exit status)", r);
  r = gateRows("interrupted-body", `cat > n.md <<'EOF'\n${MUTATING}\nEOF`, { exit_code: 0, interrupted: true });
  check("F-428 (review): exit_code 0 plus interrupted:true on a heredoc body keeps the operand qualification (interruption is read from the base word, which an exit code outranks)", r.outcomes.length === 1 && /^not verified as executed \(found in operand position/.test(r.outcomes[0]), r);
  r = gateRows("interrupted-piped", `${MUTATING} | cat`, { exit_code: 0, interrupted: true });
  check("F-428 (review): exit_code 0 plus interrupted:true on a piped call keeps the masked qualification", r.outcomes.length === 1 && /^ran — exit status not visible/.test(r.outcomes[0]), r);
  r = gateRows("interrupted-only", `${MUTATING} | cat`, { interrupted: true });
  check("F-428 (review, control): a base word that IS the interruption stays as is", r.outcomes.length === 1 && r.outcomes[0] === "interrupted — may not have completed", r);
  r = gateRows("unknown-piped", `gs-admin newverb | head`);
  check("F-428 (review): a piped UNKNOWN command's row is masked too — the qualifier is carried by every finding shape", r.outcomes.length === 1 && /^ran — exit status not visible/.test(r.outcomes[0]), r);
  // No live half by construction (tester, hb-20260908-06): in the real loader
  // the variable-subcommand coaching DENY fires on PreToolUse, so the call never
  // runs and no row is journaled — this arm pins the composer for the row the
  // journal branch WOULD write if the harness ever reported such a call.
  r = gateRows("varsub-piped", `gs-admin jo $cmd | head`);
  check("F-428 (review): a piped variable-subcommand row is masked too (fixture-only shape — the live loader denies it first)", r.outcomes.length === 1 && /^ran — exit status not visible/.test(r.outcomes[0]), r);
  r = gateRows("unknown-bare", `gs-admin newverb`);
  check("F-428 (review, control): an unpiped unknown command's row stays bare", r.outcomes.length === 1 && BARE(r.outcomes[0]), r);
}

// ── Release-gate /security-review of 0.37.0: the arithmetic branch swallowed ──
// real commands. `$(( … ))` is one word for the readers (F-433 kept) only where
// the shell reads it as arithmetic: PowerShell never does (`$((gs-admin …))` is
// a subexpression around a grouped pipeline and RUNS the call); bash does only
// when the span closes with an adjacent `))` (`$((cmd); true)` is `$( (cmd) …)`
// and runs); and a substitution nested inside real arithmetic is expanded first
// (`$((x=$(cmd)))` runs). Each executed in silence on the unreleased tree; each
// now asks, journaled "enclosing" (the call ran inside a substitution).
{
  let n = 0;
  const rowsFor = (cmd, extra = {}) => {
    const ws = makeWorkspace(`arith-span-${++n}`, [
      { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
    ]);
    runHook(ws, cmd, freshSid(), "PostToolUse", { exit_code: 0 }, extra);
    const j = existsSync(journalOf(ws, "acme-prod")) ? readFileSync(journalOf(ws, "acme-prod"), "utf8") : "";
    return { ws, outcomes: (j.match(/^- outcome: .*$/gm) ?? []).map((l) => l.slice("- outcome: ".length)) };
  };
  const ENCLOSING = (o) => /^ran — exit status not visible \(this call ran inside a substitution/.test(o);
  for (const [label, cmd] of [
    ["closer after a separator", `echo $((${MUTATING}); true)`],
    ["closer after a space", `echo $((${MUTATING}) )`],
    ["closer after a pipe", `echo $((${MUTATING})|cat)`],
    ["at command position", `$((${MUTATING}); true)`],
    ["a substitution nested inside real arithmetic", `echo $((x=$(${MUTATING})))`],
  ]) {
    const r = rowsFor(cmd);
    const d = runHook(r.ws, cmd, freshSid());
    check(`security review (arithmetic span, ${label}): the mutation inside asks`, d.decision === "ask", d.raw);
    check(`security review (arithmetic span, ${label}): one row, qualified "enclosing"`, r.outcomes.length === 1 && ENCLOSING(r.outcomes[0]), JSON.stringify(r.outcomes));
  }
  const psRows = rowsFor(`$((${MUTATING}))`, { tool_name: "PowerShell" });
  const ps = runHook(psRows.ws, `$((${MUTATING}))`, freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  check("security review (PowerShell `$((…))` is a subexpression around a grouped pipeline): asks", ps.decision === "ask", ps.raw);
  check("security review (PowerShell `$((…))`): one row, qualified \"enclosing\"", psRows.outcomes.length === 1 && ENCLOSING(psRows.outcomes[0]), JSON.stringify(psRows.outcomes));
  // Kept (F-433): real arithmetic stays one word — the next line's row is bare,
  // and arithmetic with no call inside stays silent.
  const bare = rowsFor(`echo $((1<<8))\n${MUTATING}`);
  check("security review (control, F-433 kept): `$((1<<8))` is one word and the next line's row is bare", bare.outcomes.length === 1 && bare.outcomes[0] === "exit 0", JSON.stringify(bare.outcomes));
  const arith = runHook(bare.ws, "echo $((1<<8))", freshSid());
  check("security review (control): real arithmetic with no call inside is silent", arith.silent, arith.raw);
}

// ── Step 0 review of 0.37.0 (F-440 … F-443): the gate, computed names, the ───
// lexer's operator precedence, comments, delimiters, and the lint over tokens.
// F-440: the command-text gate restated the word boundary as a character class
// and required whitespace or the end of the text AFTER the name, so an operator
// or empty quotes glued to the binary hid the whole invocation — `gs-admin>f
// jo p save` ran with no ask and no journal row, on every shipped version.
// F-441: a substitution, a call-operator expression or a variable standing
// where the command name goes was never a candidate name (`$(which gs-admin)
// jo p save`, `& (Get-Command gs-admin) jo p save`). F-442: the lexer read `&`
// by the control-operator table before asking the redirection vocabulary, so
// `save&>f` was `save` `&` `>f` and the row said "backgrounded"; a heredoc
// delimiter kept its backslash; a `#` comment's text was the journal's target.
// F-443: the pipe lint was a second scanner over the raw text — a `|` inside
// heredoc DATA drew a coaching deny on a line carrying a real mutation. The
// shell-oracle suite (test/guard-oracle.mjs) is the judge of each; these pins
// keep the shapes from regressing between its runs.
{
  let k = 0;
  const ws = () => makeWorkspace(`s0-${k++}`, [
    { slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production" },
  ]);
  const MUTATES = (r) => r.decision === "ask" && r.reason.includes("Mutating Gainsight command: gs-admin journey programs save");
  const rowsOf = (cmd, tool = "Bash") => {
    const w = ws();
    runHook(w, cmd, freshSid(), "PostToolUse", { exit_code: 7 }, { tool_name: tool });
    const j = existsSync(journalOf(w, "acme-prod")) ? readFileSync(journalOf(w, "acme-prod"), "utf8") : "";
    return {
      outcomes: (j.match(/^- outcome: .*$/gm) ?? []).map((l) => l.slice("- outcome: ".length)),
      targets: (j.match(/^- target: .*$/gm) ?? []).map((l) => l.slice("- target: ".length)),
    };
  };
  // F-440 — the gate: every bare operator glued to the name, read out of the
  // hook's vocabulary like the F-436 pins, plus empty quotes after the name.
  const REDIR_OPS = HOOK_REDIR_OPS;
  for (const op of REDIR_OPS) {
    const target = op === "<<" || op === "<<-" ? "EOF" : op === "<<<" ? "text" : op === ">&" ? "2" : op === "<&" ? "0" : "f";
    const cmd = `gs-admin${op}${target} jo p save${op === "<<" || op === "<<-" ? "\nx\nEOF" : ""}`;
    const res = runHook(ws(), cmd, freshSid());
    check(`F-440 (gate): \`${op}\` glued to the binary name still asks — the lexer, not a boundary class, ends the word`, MUTATES(res), res.raw);
  }
  for (const cmd of ["gs-admin'' jo p save", 'gs-admin"" jo p save']) {
    const res = runHook(ws(), cmd, freshSid());
    check(`F-440 (gate): empty quotes after the name (\`${cmd.slice(0, 10)}\`) — the word is still gs-admin`, MUTATES(res), res.raw);
  }
  let res = runHook(ws(), "gs-admin>f jo p save", freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  check("F-440 (gate): the PowerShell lane asks on the glued spelling too (PowerShell itself reads `gs-admin>f` as one name and runs nothing — an over-ask, the safe direction)", MUTATES(res), res.raw);
  // F-441 — computed names: strong (the name spelled inside the expansion) ask
  // on any tail; weak (only the line names gs-admin) assert an invocation only
  // on a catalog match; an assignment is never a name.
  const CAVEAT = "the command name is an expansion or a variable";
  for (const cmd of ["$(which gs-admin) jo p save", "`which gs-admin` jo p save", "\"$(which gs-admin)\" jo p save", "$(command -v gs-admin) --json jo p save"]) {
    res = runHook(ws(), cmd, freshSid());
    check(`F-441 (name): \`${cmd}\` — the mutating ask, with the computed-name caveat`, MUTATES(res) && res.reason.includes(CAVEAT), res.raw);
  }
  res = runHook(ws(), "$(which gs-admin) frob nicate", freshSid());
  check("F-441 (name, strong): an unknown tail after a name that spells gs-admin asks fail-closed", res.decision === "ask" && res.reason.includes("Unrecognized") && res.reason.includes(CAVEAT), res.raw);
  res = runHook(ws(), "n=gs-admin; $n jo p save", freshSid());
  check("F-441 (name, weak): a variable at command position on a line naming gs-admin asks when the tail matches the catalog", MUTATES(res) && res.reason.includes(CAVEAT), res.raw);
  res = runHook(ws(), "n=gs-admin; $(echo $n) jo p save", freshSid());
  check("F-441 (name, weak): a substitution not spelling the name asks on a catalog tail", MUTATES(res), res.raw);
  res = runHook(ws(), "echo gs-admin; $x frob nicate", freshSid());
  check("F-441 (name, bash): a variable at command position on a line naming gs-admin is a computed name — an unknown tail asks fail-closed, with the caveat", res.decision === "ask" && res.reason.includes("frob") && res.reason.includes(CAVEAT), res.raw);
  res = runHook(ws(), "foreach ($x in $ids){gs-admin jo p save}", freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  check("F-441 (name, PowerShell, control): `foreach ($x in $ids)` is an expression, not a `$x` invocation — the script block's mutation asks plainly", MUTATES(res) && !res.reason.includes(CAVEAT) && !res.reason.includes("shell variable"), res.raw);
  res = runHook(ws(), "$out = gs-admin --json re rules list; $out | ConvertFrom-Json", freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  check("F-441 (name, control): an assignment and a piped variable on a read-only line stay silent", res.silent, res.raw);
  res = runHook(ws(), "$env:PATH -split ';' | ? { $_ -match 'x' }; gs-admin --json re rules list", freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  check("F-441 (name, PowerShell, control): a `$x` statement is an expression — no computed-name ask on a read-only line", res.silent, res.raw);
  // The review's shapes (additive reading): the INNER call of a substitution or
  // subshell is the mutation and asks; the name reading never silences it.
  for (const [cmd, tool] of [["$(gs-admin jo p save)", "Bash"], ["`gs-admin jo p save`", "Bash"], ["sleep 0 & (gs-admin jo p save)", "Bash"], ["& (gs-admin jo p save)", "PowerShell"]]) {
    res = runHook(ws(), cmd, freshSid(), undefined, undefined, { tool_name: tool });
    check(`F-441 (review): the inner call of \`${cmd}\` asks — the name reading is additive`, MUTATES(res), res.raw);
  }
  res = runHook(ws(), "echo hi\n$(which gs-admin) jo p save", freshSid());
  check("F-441 (review): a computed name on the second line keeps its reading (the opener is a segment start)", MUTATES(res) && res.reason.includes(CAVEAT), res.raw);
  res = runHook(ws(), "gs-admin `jo p save", freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  check("F-441 (review): an unclosed backtick at subcommand position is the coached unreadable subcommand, never silence", res.decision === "deny" && res.reason.includes("shell variable"), res.raw);
  res = runHook(ws(), "gs-admin jo $cmd", freshSid());
  check("F-441 (review, control): the variable-subcommand deny path still answers (the escalation key reads the lexer's record)", res.decision === "deny" && res.reason.includes("shell variable"), res.raw);
  // F-447 — a redirection between an interpreter and its payload.
  for (const cmd of ["bash -c > f 'gs-admin jo p save'", "bash > f -c 'gs-admin jo p save'", "bash -c 2>&1 'gs-admin jo p save'", "eval > f 'gs-admin jo p save'"]) {
    res = runHook(ws(), cmd, freshSid());
    check(`F-447 (payload): \`${cmd}\` — the redirection is stepped over and the payload is scanned: the mutating ask`, MUTATES(res), res.raw);
  }
  res = runHook(ws(), "& (Get-Command gs-admin) jo p save", freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  check("F-441 (name): PowerShell's call operator on an expression naming gs-admin — the mutating ask, with the caveat", MUTATES(res) && res.reason.includes(CAVEAT), res.raw);
  let r = rowsOf("& (Get-Command gs-admin) jo p save", "PowerShell");
  check("F-441 (name): …and its journal row is bare — the expression is the name, not an earlier stage", r.outcomes.length === 1 && r.outcomes[0] === "exit 7 — command FAILED; this change likely did not apply", r);
  res = runHook(ws(), "$s = 'gs-admin jo p save'; iex $s", freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  check("F-441 (name, control): the variable-payload residual is untouched — an assignment is never a name", res.silent, res.raw);
  // F-442 — the lexer: `&>` glued to a word is a redirection, not a background;
  // the delimiter after quote removal; comments discarded.
  r = rowsOf("gs-admin jo p save&>f");
  check("F-442 (lexer): `save&>f` journals a BARE row — `&>` is read by the redirection vocabulary before the control table", r.outcomes.length === 1 && !/backgrounded/.test(r.outcomes[0]), r);
  r = rowsOf("gs-admin jo p save&");
  check("F-442 (lexer, control): a glued `&` alone is still a background — the row is qualified", r.outcomes.length === 1 && /backgrounded/.test(r.outcomes[0]), r);
  r = rowsOf("cat <<\\EOF\nx\nEOF\ngs-admin jo p save");
  check("F-442 (lexer): `<<\\EOF` names EOF — the terminator is found and the call after it is a real command (bare row)", r.outcomes.length === 1 && !/not verified/.test(r.outcomes[0]), r);
  r = rowsOf("gs-admin jo p save # note");
  check("F-442 (lexer): a `#` comment's text is not the journal's target", r.targets.length === 1 && !/note/.test(r.targets[0]), r);
  res = runHook(ws(), "# gs-admin jo p save", freshSid());
  check("F-442 (lexer): a commented-out call runs nothing — silent", res.silent, res.raw);
  res = runHook(ws(), "gs-admin --format >f json jo p save", freshSid());
  check("F-442 (collector): a redirection between a flag and its value is stepped over — the value is `json`, the mutating ask", MUTATES(res), res.raw);
  // F-443 — the lint over tokens.
  res = runHook(ws(), "cat <<EOF\nfoo|bar\nEOF\ngs-admin jo p save", freshSid());
  check("F-443 (lint): a `|` inside heredoc DATA is not an operator — the line's mutation asks, no coaching deny", MUTATES(res), res.raw);
  res = runHook(ws(), "gs-admin --json jo p list --search CS|Risk", freshSid());
  check("F-443 (lint, control): an unquoted name fragment after `|` still draws the first-offense deny", res.decision === "deny" && res.reason.includes("Risk"), res.raw);
  res = runHook(ws(), "gs-admin --json jo p list --search 'Sales' & (echo x)", freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  check("F-443 (lint, control): `&` before an expression is the call operator — no lone-& deny", res.decision !== "deny", res.raw);
  res = runHook(ws(), "gs-admin --json jo p list | \"C:\\tools\\pager.exe\"", freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  check("F-443 (lint, control): a quoted RHS after `|` is deliberate syntax — read from the lexer's quoted-word record", res.decision !== "deny", res.raw);
  // The review's shapes for the comment rule, the quote state and the lint.
  res = runHook(ws(), "echo ''#x; gs-admin jo p save", freshSid());
  check("F-442 (review): `''#x` is the argument `#x`, not a comment — the call after `;` asks", MUTATES(res), res.raw);
  res = runHook(ws(), 'echo "a \\" #b" ; gs-admin jo p save', freshSid());
  check("F-442 (review): an escaped `\\\"` inside a string keeps the quote open — the `#` is string text and the call asks WITHOUT the quote-blind caveat", MUTATES(res) && !res.reason.includes("quote-blind"), res.raw);
  res = runHook(ws(), "<# note #> gs-admin jo p save", freshSid(), undefined, undefined, { tool_name: "PowerShell" });
  check("F-442 (review): PowerShell's block comment `<# … #>` is grammar — the call after it asks", MUTATES(res), res.raw);
  res = runHook(ws(), "cat > n.md <<'EOF'\n| Program | Status |\nEOF\ngs-admin jo p save", freshSid());
  check("F-443 (review): a markdown table in a heredoc body — its `|` words are data, the call asks, no deny", MUTATES(res), res.raw);
  res = runHook(ws(), "gs-admin --json re rules list # a|b", freshSid());
  check("F-443 (review, control): a `|` inside a comment draws no deny on a read-only line — silent", res.silent, res.raw);
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
rmSync(ROOT, { recursive: true, force: true });

console.log(failures ? `\n${failures} failure(s)` : "\nAll guard fixture checks passed");
process.exit(failures ? 1 : 0);
