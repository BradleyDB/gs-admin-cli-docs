#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// describe-batch.mjs — deterministic describe→doc→mark loop for one domain
//
// Two live E2E runs in a row saw the model improvise its own orchestration for
// this exact loop (with quoting, encoding, and .cmd-spawn bugs along the way).
// This is the sanctioned version: it selects the batch through manifest.mjs
// (same `next` semantics), runs the describes SEQUENTIALLY (parallel gs-admin
// calls can trip the CLI's token-refresh race), writes one structured doc per
// asset, and marks each entry as its doc lands — so an interruption never
// loses more than one asset, and bulk payloads never enter model context.
//
//   node describe-batch.mjs --manifest <slug>/_manifest.json --domain <d> \
//     [--command "gs-admin --json <ns> <describe-cmd> --id {id}"] \
//     --out-dir <slug>/<domain> [--limit N] [--statuses a,b] [--upgrade] \
//     [--doc-mode raw|template|program|designer] [--if-changed] \
//     [--spawn-budget 30] [--timeout-ms 120000] [--bin <path-to-gs-admin-js>]
//
// Designer doc-mode (GP-B5 W9 — the default whenever the describe command
// resolves to the catalog's `data-designer templates describe`, whatever the
// domain is called): the template describe alone carries summary task rows
// and no field names, so this mode describes in THREE levels per entry — the
// template, then one `--task-id` drilldown per task, then one `--field`
// detail per show-field label (labels derived from the drilldown's tables by
// doc-lib's designerTaskFieldLabels; a vocabulary-known aggregation suffix
// stripped at keying time, and on the CLI's not-found refusal the other
// spelling tried once) — and writes ONE composite doc (doc-lib
// renderDesignerDoc: the template payload with the drilldowns under `_kb`,
// T-3 v5). Both extra flags are appended to the recorded template's argv as
// literal tokens (no new placeholder; no shell) and their spellings are
// VERIFIED against the catalog's flag list for the resolved command before
// any spawn — a future CLI rename fails here, loudly; the template's own
// `_taskCount` is checked against the readable task ids the same way (a
// renamed task row would otherwise read as an empty, "complete" composite).
// Cost is bounded per INVOCATION, not per template: `--spawn-budget N`
// (default 30 — 40–75 s at the measured 1.35–2.5 s per spawn on two tenants
// (the higher figure went through the capture helper's own node startup),
// under the harness's ~2-minute shell timeout; floor 2) counts every CLI spawn, template
// describes included; the composite doc is REWRITTEN after every spawn, so
// an interruption loses at most one call — the per-asset guarantee above,
// one level down. When the budget runs out mid-entry the doc on disk says
// INCOMPLETE, the entry keeps its status (nothing is marked), the summary
// reports budgetExhausted + moreRemaining, and the next invocation resumes:
// it re-runs the template describe, reads the doc's `_kb`, skips items
// already ok, retries RETRYABLE failures, and restarts the template when its
// fingerprint or task-id set changed. A field the CLI refuses with its own
// not-found sentence under EVERY spelling is a PERMANENT gap: recorded on the
// item, never retried until the template changes, and never blocking — the
// entry is marked documented with the gap stated in the doc's provenance
// line and per row in the deps report. A retryable failure (timeout,
// transport, unexpected output) marks the entry failed (doc kept on disk,
// doc_path recorded) so `next` retries it under the skill's stop rule.
// --if-changed in this mode skips only when the on-disk doc is a COMPLETE
// composite — summary-only docs from earlier plugin versions upgrade on any
// re-run. The summary's `drilldowns` block counts THIS RUN's spawns and item
// outcomes only; whole-composite totals are in each doc's provenance line.
//
// Content fingerprints: every successful describe with parseable JSON records
// a canonicalFingerprint of the payload (doc-lib.mjs — volatile modified/
// updated keys dropped) on the documented mark, via manifest.mjs mark
// --fingerprint. --if-changed uses it as a re-document gate: when an entry
// has a recorded fingerprint, its recorded doc file still exists on disk,
// and the fresh payload fingerprints equal, the doc write is SKIPPED and the
// entry is marked documented with no --depth and no --doc-path (mark keeps
// existing values when omitted — passing --depth full would silently promote
// metadata-era entries out of the --upgrade queue); the summary counts
// skippedUnchanged and lists unchangedKeys. A different or missing recorded
// fingerprint (legacy/pending entries) — or a missing doc file (an operator
// deleted it to force regeneration) — documents normally, so the flag is
// safe on any re-document invocation. Do NOT pass it on a deliberate
// re-render in a different doc format (a --doc-mode conversion, e.g.
// regenerating raw program docs compact): the fingerprint sees unchanged
// tenant content and would skip the conversion. The gate detects content
// change from ONE describe per entry — it saves the doc write and the
// doc-churn, not the describe call itself.
//
// {id} / {name} tokens in --command are substituted per entry as real argv —
// no shell is ever involved, so pipes and spaces in asset names are safe, and
// the Windows .cmd-shim ENOENT trap never applies (the CLI's JS entry is
// resolved and run with this same node).
//
// --command may be omitted when the domain's index recorded a describe-command
// template (manifest.mjs upsert-batch --describe-command, stored in
// domains_indexed[domain].describeCommand): the recorded template is used as
// the default. An explicit --command always wins, and the read-only
// fail-closed catalog gate below validates the recorded command exactly as it
// would an explicit one — a recorded mutating or unknown command is refused
// the same way. Domains with no recording require --command, as before.
//
// The describe identifier is always {id} — the manifest is keyed by it. {name}
// substitutes the display label and is only for commands that address by label
// (e.g. sc measures --name). dm objects therefore take --name {id}, not
// --name {name}.
//
// Doc modes: "raw" (default) writes the step-2 structured doc with the full
// describe JSON embedded. "template" — the default when --domain is
// journey-email-templates — renders the compact email-template doc instead
// (metadata + plain-text body via doc-lib.mjs, shared with template-doc.mjs;
// the ~50 KB HTML rendering never lands in a doc). "program" — the default
// when --domain is journey — renders the compact program doc (semantic
// skeleton with flow-canvas geometry dropped via doc-lib.mjs, shared with
// program-doc.mjs; a raw ~287 KB payload never lands in a doc). Selection,
// sequential describes, marking, and retry behave identically in all modes.
//
// Safety: the embedded command is inside a quoted argument, so the mutation
// guard hook cannot see it. This script therefore gates the command itself,
// fail-closed. The command must resolve in the catalog and clear four checks:
// catalog-mutating commands are refused; commands on hooks/ask-overrides.json
// (verified upstream mislabels) are refused outright, without honoring the
// override's safe-mode exemption; the resolved action must be a describe-shaped
// read verb; and no PUT/DELETE/PATCH endpoint may be declared. The catalog's
// `mutating` flag on its own is still NOT read-only enforcement: upstream
// closed the mislabeled-writer class at CLI 1.0.8 (0 non-mutating commands
// declare PUT/DELETE/PATCH; the 20 non-mutating POSTs are read-shaped), but
// the verb and endpoint checks are kept as the forward guard — they refuse a
// FUTURE mislabel independent of the catalog's word, and the override check
// keeps working the moment the (currently empty) list gains an entry. Anything
// else: run it directly, where the guard can arbitrate. Exactly one plain
// command is allowed (no pipes/chains/redirects).
//
// Output: one JSON summary on stdout (including `domainProgress`, the domain's
// documented/total counts after the batch). Non-zero exit + stderr message on
// error. While the batch runs, a stderr progress line is emitted every few
// describes (`[describe-batch] 45/120 in batch — domain 380/473 documented`)
// so long chunks are never silent. On --upgrade runs the depth is the metric,
// not the status — metadata stubs already count as documented, so
// documented/total would read N/N from the first chunk and never move:
// `domainProgress` reports { full, metadata, failed, total } instead and the
// progress line shows full/total (`… — domain 380/473 full`). Progress reads
// are best-effort: a failed read drops the domain part of the line, never the
// batch.
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalFingerprint, docNameClaimer, renderTemplateDoc, renderProgramDoc, renderRawDescribeDoc,
  renderDesignerDoc, designerDocProgress, designerDrilldownStats, designerTaskFieldLabels, splitTrailingGroup,
  parseDocJson, normalizeText, writeFileAtomicSync,
  readJsonFile, makeCliHelpers, findWorkspaceCatalog, makeCommandResolver,
  assertReadOnlyCommand, assertPlainGsAdminCommand, resolveCliArgv, READ_VERB_EXACT, DESCRIBE_NONE, RECORDED_LANES } from "./doc-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MANIFEST_SCRIPT = join(here, "manifest.mjs");

const argv = process.argv.slice(2);
// Shared argv helpers (F-238) — the F-165/F-171 last-token rule lives in
// doc-lib now (the email-report gap-fill fences pass `--limit <budget>` last
// to BOTH this script and manifest.mjs, so both need it). Booleans here are
// read with argv.includes, never opt().
const { opt, fail } = makeCliHelpers("describe-batch.mjs", argv);
const printable = (v, cap) =>
  String(v).replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim().slice(0, cap);

// Minimal shell word-split — keep in sync with the copy in gs-admin-guard.mjs.
function shellWords(s) {
  const out = [];
  let cur = "", q = null;
  for (const c of s) {
    if (q) { if (c === q) q = null; else cur += c; }
    else if (c === '"' || c === "'") q = c;
    else if (/\s/.test(c)) { if (cur) { out.push(cur); cur = ""; } }
    else cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

const manifestPath = opt("--manifest");
const domain = opt("--domain");
const outDir = opt("--out-dir");
if (!manifestPath || !domain || !outDir) {
  fail("required: --manifest <path> --domain <ns> --out-dir <dir> [--command \"gs-admin … {id}\"]");
}
// Command template: explicit --command wins; otherwise fall back to the
// describe-command the domain's index recorded (manifest.mjs upsert-batch
// --describe-command). The manifest is read directly but read-only — mutating
// verbs stay in manifest.mjs — and the recorded string goes through the exact
// same parsing and fail-closed catalog gate below as an explicit --command.
let template = opt("--command");
let commandSource = "explicit";
if (!template) {
  let recorded = null;
  try {
    const m = readJsonFile(resolve(manifestPath)); // BOM-tolerant (doc-lib, F-118)
    recorded = m.domains_indexed?.[domain];
  } catch (e) {
    // A bad --manifest path must not masquerade as a missing recording — the
    // real problem is upstream of any --command choice.
    fail(`cannot read manifest ${manifestPath} (${e?.message ?? String(e)}) — fix --manifest before --command`);
  }
  const recordedCmd =
    recorded && typeof recorded === "object" && typeof recorded.describeCommand === "string"
      ? recorded.describeCommand
      : null;
  if (recordedCmd === DESCRIBE_NONE) {
    // The recording is the operator's DECISION that this domain has no usable
    // per-item describe (gate-3 review round, F-346) — a list-only domain.
    // Running it as a template would spawn the literal word; refuse instead.
    fail(
      `domain ${domain} is recorded as list-only (--describe-command ${DESCRIBE_NONE}): its stubs are complete docs ` +
        `and there is nothing to describe. To describe it anyway, pass --command explicitly, or re-record a ` +
        `real template with manifest.mjs upsert-batch --describe-command "gs-admin --json <ns> <describe-cmd> --id {id}"`
    );
  } else if (recordedCmd) {
    template = recordedCmd;
    commandSource = "recorded";
  } else {
    fail(
      `--command is required — domain ${domain} has no describe-command recorded in the manifest. ` +
        `Pass --command, or record one at index time: manifest.mjs upsert-batch --describe-command ` +
        `"gs-admin --json <ns> <describe-cmd> --id {id}" (or --describe-command ${DESCRIBE_NONE} if the ` +
        `domain has no usable per-item describe)`
    );
  }
}
// 0 is valid and selects nothing: the email-report gap-fill fences feed the SAME
// computed budget placeholder to manifest.mjs mark --limit and to this script, and
// mark accepts 0 — so a zero budget must be a bounded no-op here too, not a usage
// error the skill would need conditional logic around (F-170).
const limit = Number.parseInt(opt("--limit", "25"), 10);
if (!Number.isFinite(limit) || limit < 0) fail("--limit must be a non-negative integer");
const timeoutMs = Number.parseInt(opt("--timeout-ms", "120000"), 10);
if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) fail("--timeout-ms must be ≥ 1000");
const upgrade = argv.includes("--upgrade");
const ifChanged = argv.includes("--if-changed");
const statuses = opt("--statuses"); // passed through to `next` when given
// Email-template payloads must never land in a doc as raw JSON (~50 KB of
// entity-escaped HTML apiece) — that domain defaults to the compact renderer.
// Journey-program payloads are worse (~287 KB of mostly flow-canvas geometry)
// — the journey domain defaults to the compact program renderer the same way.
const TEMPLATE_DOMAIN = RECORDED_LANES.templates.folder; // the no-recording fallback names come from doc-lib's one lane table
const PROGRAM_DOMAIN = RECORDED_LANES.journey.folder;
// The designer composite (header comment) is keyed on the RESOLVED CATALOG
// COMMAND, not on a workspace folder slug: whatever the domain is called, a
// describe that resolves to `data-designer templates describe` is the
// three-level template describe (tenet 6 — the catalog decides; W9 review
// round). The default doc-mode is therefore settled after the gate below.
const DESIGNER_COMMAND = "data-designer templates describe";
const docModeOpt = opt("--doc-mode");
if (docModeOpt !== undefined && !["raw", "template", "program", "designer"].includes(docModeOpt)) {
  fail('--doc-mode must be "raw", "template", "program", or "designer"');
}
// The drilldown flag spellings (CLI 1.0.8 and 1.0.9: `dd t describe --task-id <t>` and
// `--field <label>`). Data, not grammar: verified against the catalog below.
const DESIGNER_FLAGS = { task: "--task-id", field: "--field" };

// ── Parse and validate the command template ──────────────────────────────────
// First-token gs-admin match (launcher-suffix-tolerant, F-120) + shell-operator
// refusals are the shared assertPlainGsAdminCommand in doc-lib (review round,
// B5 W4 — capture.mjs is the sibling caller; the copied blocks had already
// drifted from the guard's superset operator list, which the shared helper
// now carries).
const tokens = shellWords(template);
if (!tokens.length) fail("--command is empty");
assertPlainGsAdminCommand({
  tokens, fail, printable,
  commandNoun: "--command",
  captureHint: "The script captures stdout itself.",
});
if (!tokens.includes("{id}") && !tokens.includes("{name}")) {
  fail("--command must contain an {id} or {name} placeholder token");
}

// ── Read-only enforcement against the catalog (fail-closed) ─────────────────
// Catalog search + command resolution are the shared doc-lib helpers (F-232):
// walk up to the FIRST directory containing .gs-superadmin (here from the
// manifest dir; the hook walks from cwd), try that one workspace catalog,
// then the bundle; token/alias/longest-prefix matching in makeCommandResolver.
// domain-candidates.mjs imports the same pair; the guard hook keeps its own
// deliberately self-contained copy (no-import tenet) with a comment naming
// doc-lib.
const catalog = findWorkspaceCatalog(dirname(resolve(manifestPath)), join(here, "..", "reference", "catalog.json"));
if (!catalog) fail("no catalog found (workspace or bundled) — cannot verify the command is read-only; refusing");

const { cmd: matched, rest } = makeCommandResolver(catalog).resolveTokens(tokens.slice(1));

// The gate itself (five fail-closed checks: unresolved, catalog-mutating,
// ask-override match refused outright, positive read-shape constraint,
// PUT/DELETE/PATCH endpoint) is the shared assertReadOnlyCommand in doc-lib
// (B5 W4/DS-17 hoist — capture.mjs is the second spawn-capable script; a
// copied gate would re-open the F-284 sibling class on a safety surface).
// This suite's fixtures pinned every refusal message BEFORE the hoist and
// still pin them through it (A-6). What stays HERE is this script's POLICY —
// the describe-shaped read predicate:
//
// The exact-name allowlist (READ_VERB_EXACT) is shared from doc-lib — its
// rationale, the audited catalog-version stamp, and the adoption-time
// re-audit tripwire live there (review round, B5 W4: two copies meant the
// tripwire pinned only one). This script's policy composes the describe
// shape onto it and refuses everything else; the shared gate's endpoint
// check still backstops any future write that happens to be named `get`.
const isReadVerb = (n) => typeof n === "string" && (/^describe(-|$)/.test(n) || READ_VERB_EXACT.has(n));
assertReadOnlyCommand({
  matched, rest, hooksDir: join(here, "..", "hooks"), fail, printable,
  isRead: isReadVerb,
  shapeNoun: "a describe-shaped read",
  runsNoun: "read-only describes",
});
// Doc-mode: explicit flag wins; else the compact modes by what the domain was
// RECORDED from (F-429: the folder name is per-workspace data — a journey
// domain named otherwise still holds program payloads), with the literal
// names as the no-recording fallback; the designer composite by the RESOLVED
// command; raw otherwise.
let recordedListPath = null;
try {
  const lc = readJsonFile(resolve(manifestPath)).domains_indexed?.[domain]?.listCommand;
  if (typeof lc === "string") recordedListPath = makeCommandResolver(catalog).resolveLine(lc)?.path ?? null;
} catch { /* an unreadable manifest already failed above, or has no recording to read */ }
const docMode =
  docModeOpt ??
  (recordedListPath === RECORDED_LANES.templates.path || domain === TEMPLATE_DOMAIN
    ? "template"
    : recordedListPath === RECORDED_LANES.journey.path || domain === PROGRAM_DOMAIN
      ? "program"
      : matched?.path === DESIGNER_COMMAND
        ? "designer"
        : "raw");
// The per-invocation spawn budget is a designer-mode control only — in every
// other mode one entry is one spawn and --limit already bounds the run. Floor
// 2: a fresh entry needs its template describe plus at least one drilldown to
// make progress, so a budget of 1 would spend one spawn per invocation forever
// (W9 review round).
const spawnBudgetOpt = opt("--spawn-budget");
if (spawnBudgetOpt !== undefined && docMode !== "designer") fail("--spawn-budget applies only to the designer doc-mode");
const spawnBudget = Number.parseInt(spawnBudgetOpt ?? "30", 10);
if (!Number.isFinite(spawnBudget) || spawnBudget < 2) fail("--spawn-budget must be an integer of at least 2 (one template describe plus one drilldown)");
// Designer mode appends the drilldown flags to THIS command's argv, so the
// resolved catalog command must declare both spellings (tenet 6: the catalog
// decides whether the drilldown is runnable at this pin). The appended pair
// resolves to the same command — `--task-id <t>` / `--field <l>` are rest
// tokens — so the gate verdict above covers every spawn this mode makes.
if (docMode === "designer") {
  const declared = new Set((Array.isArray(matched?.flags) ? matched.flags : []).map((f) => String(f?.flag ?? "").split(/\s+/)[0]));
  const missing = Object.values(DESIGNER_FLAGS).filter((f) => !declared.has(f));
  if (missing.length)
    fail(
      `designer doc-mode needs the resolved command (${matched?.path ?? "?"}) to declare ${missing.join(" and ")} — ` +
        `the catalog declares [${[...declared].join(", ")}]. The per-task / per-field drilldown grammar changed at this CLI ` +
        `pin: re-derive it from the routed handler (MAINTAINERS.md "Designer drilldown grammar") before documenting data designers.`
    );
}

// ── Resolve how to run the CLI (no shell — argv is passed verbatim) ─────────
// The resolution rule (JS-entry via npm root -g; shim refusals F-119/F-150;
// PATH-checked POSIX fallback F-192) is the shared resolveCliArgv in doc-lib
// (B5 W4/DS-17 hoist, alongside the read-only gate — capture.mjs resolves the
// same way). The "no shell" discipline is load-bearing: the {name}
// placeholder carries tenant asset names (untrusted, tenet 4) and cmd.exe
// quoting is not reliably escapable.
const resolveCli = () => resolveCliArgv({ binOpt: opt("--bin"), fail });
// F-192: resolution is EAGER only when --bin was passed (its F-119/F-150 shim
// refusals stay up-front, before any spawn or manifest write) and LAZY
// otherwise — deferred to the first real spawn — so a bounded no-op
// (`--limit 0`, or a selection that spawns nothing) exits identically on every
// OS whether or not the CLI is installed. Windows' documented fail-closed
// direction is preserved for batches that DO spawn.
let cliArgv = opt("--bin") ? resolveCli() : null;
const cli = () => (cliArgv ??= resolveCli());

function runManifest(args) {
  const res = spawnSync(process.execPath, [MANIFEST_SCRIPT, ...args, "--manifest", manifestPath], {
    encoding: "utf8",
  });
  if (res.status !== 0) fail(`manifest.mjs ${args[0]} failed: ${res.stderr.trim() || `exit ${res.status}`}`);
  return JSON.parse(res.stdout);
}

// ── Select the batch ─────────────────────────────────────────────────────────
// One builder for both the batch selection and the moreRemaining probe, so the
// two can never drift onto different selection criteria.
const selectionArgs = (lim) => {
  const a = ["next", "--domain", domain, "--limit", String(lim)];
  if (upgrade) a.push("--upgrade");
  if (statuses) a.push("--statuses", statuses);
  return a;
};
// --limit 0 never reaches `next` (which requires a positive limit): it is a
// bounded no-op by contract — same summary shape, nothing selected (F-170).
const batch = limit === 0 ? { count: 0, entries: [] } : runManifest(selectionArgs(limit));

// Progress for the whole domain — read fresh from the manifest so the numbers
// are true whatever mix of statuses the batch carries. Best-effort by design:
// progress is cosmetic, so a failed read returns null and the batch keeps
// running (runManifest's fail() is reserved for the real describe→doc→mark
// work). Two shapes: normal runs report { documented, total }; --upgrade runs
// report { full, metadata, failed, total } — metadata stubs already count as
// documented, so documented/total would read N/N from the first chunk and
// never move, and the true upgrade metric is depth "full".
const domainProgress = () => {
  if (upgrade) {
    try {
      const m = readJsonFile(resolve(manifestPath)); // BOM-tolerant (doc-lib, F-118)
      const c = { full: 0, metadata: 0, failed: 0, total: 0 };
      for (const e of Object.values(m.inventory ?? {})) {
        if (e.domain !== domain) continue;
        c.total++;
        if (e.status === "failed") c.failed++;
        // Same full-doc rule as manifest.mjs stub: depth full, or a
        // pre-depth-era entry that was verified (legacy full doc).
        else if (e.depth === "full" || (e.depth == null && e.last_verified != null)) c.full++;
        else c.metadata++;
      }
      return c.total > 0 ? c : null;
    } catch {
      return null;
    }
  }
  const res = spawnSync(process.execPath, [MANIFEST_SCRIPT, "report", "--manifest", manifestPath], {
    encoding: "utf8",
  });
  if (res.status !== 0) return null;
  let by;
  try {
    // hasOwn, not a bare lookup (F-225): JSON.parse output inherits
    // Object.prototype, so a domain named like a prototype member
    // ("constructor") would read the inherited function as its own counts.
    const all = JSON.parse(res.stdout).byDomain;
    by = all && typeof all === "object" && Object.hasOwn(all, domain) ? all[domain] : undefined;
  } catch {
    return null;
  }
  if (!by) return null;
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  return total > 0 ? { documented: by.documented ?? 0, total } : null;
};
const PROGRESS_EVERY = 5;

mkdirSync(resolve(outDir), { recursive: true });

const docs = [];
const failures = [];
const unchangedKeys = [];
const claimBaseName = docNameClaimer(resolve(outDir)); // shared disk-keyed collision rule (F-125/F-156)
let skippedUnchanged = 0;
let processed = 0;
let lastProgress = null; // final tick's snapshot doubles as the summary value — no duplicate report spawn
// Designer mode's per-invocation accounting (header comment): every CLI spawn
// this run makes, template describes included, draws on one budget. Every
// counter below is THIS RUN's work — the composite's whole-doc totals live in
// the doc's provenance line, never mixed in here (W9 review round).
let budgetLeft = spawnBudget;
let budgetExhausted = false;
const drill = {
  spawns: { template: 0, task: 0, field: 0 },
  thisRun: { tasksOk: 0, tasksFailed: 0, fieldsOk: 0, fieldsFailed: 0, fieldsUnresolvable: 0, fieldsSkippedUnresolvable: 0 },
  resumedEntries: 0,
  entries: { documented: 0, failed: 0, cutOff: 0 },
};
const progress = () => {
  processed++;
  if (processed % PROGRESS_EVERY === 0 || processed === batch.entries.length || budgetExhausted) {
    const dp = domainProgress();
    if (dp) lastProgress = dp;
    const domainPart = dp
      ? upgrade
        ? ` — domain ${dp.full}/${dp.total} full`
        : ` — domain ${dp.documented}/${dp.total} documented`
      : "";
    const budgetPart = docMode === "designer" ? ` (spawns ${spawnBudget - budgetLeft}/${spawnBudget})` : "";
    console.error(`[describe-batch] ${processed}/${batch.entries.length} in batch${domainPart}${budgetPart}`);
  }
};
// One-level envelope unwrap (T-3 rule; this file is a sanctioned read-side
// home — the single spelling here serves the doc writer AND the designer
// resume reader).
const unwrapOnce = (p) =>
  p && typeof p === "object" && !Array.isArray(p) && p.data && typeof p.data === "object" && !Array.isArray(p.data) ? p.data : p;
const isRecord = (v) => !!v && typeof v === "object" && !Array.isArray(v);
// The CLI spawn every level shares: the resolved entry + the template's argv
// with per-level tokens appended as literal argv (no shell — tenet 4).
const spawnCli = (args) => {
  const cliArgs = cli(); // first spawn resolves (and may fail-closed) — F-192
  const res = spawnSync(cliArgs[0], [...cliArgs.slice(1), ...args], {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error || res.status !== 0) {
    const why = res.error
      ? /** @type {NodeJS.ErrnoException} */ (res.error).code === "ETIMEDOUT"
        ? `timed out after ${timeoutMs}ms`
        : res.error.message
      : `exit ${res.status}: ${res.stderr?.trim() || res.stdout?.trim() || "no output"}`;
    return { ok: false, why, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
  }
  return { ok: true, why: null, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
};
// The CLI's own not-found sentence for a `--field` that resolves to nothing
// (handlers/data-preparation/templates/describe/index.js at 1.0.8, byte-identical at 1.0.9 —
// `No field found on task "<t>" matching: "<label>"`). A refusal in these
// words is PERMANENT for this template content (the label came from the
// task's own projection; no re-run changes what the resolver sees); anything
// else — timeout, transport, exit without that sentence — is retryable.
const FIELD_NOT_FOUND = /No field found on task/;

// ── Designer mode: the per-entry three-level drilldown with resume ──────────
// Returns "documented" | "failed" | "budget". Writes the composite doc after
// EVERY spawn (doc-lib renderDesignerDoc; atomic temp+rename) so the doc on
// disk is always the truth of what was captured.
function runDesignerEntry({ entry, payload, core, fp, base, args, prior }) {
  const taskRows = Array.isArray(core._tasks) ? core._tasks : [];
  /** @type {string[]} */
  const taskIds = [];
  for (const t of taskRows) {
    const id = isRecord(t) ? (t.taskId ?? t.id) : null;
    if (id != null && id !== "" && !taskIds.includes(String(id))) taskIds.push(String(id));
  }
  // The task list is the drilldown's whole work list, so its shape is gated
  // as loudly as the flag spellings above: the template's own `_taskCount`
  // must equal the readable task ids, or the payload's task rows are not the
  // rows this mode understands (a renamed key, an id-less row — an EMPTY
  // composite would otherwise read as complete and be pinned by --if-changed;
  // W9 review round).
  const declared = typeof core._taskCount === "number" ? core._taskCount : null;
  if (declared !== null && declared !== taskIds.length)
    return { outcome: "failed", error: `template declares _taskCount ${declared} but ${taskIds.length} task id(s) were readable from _tasks[] — the task-row shape changed at this CLI pin; re-derive it (MAINTAINERS.md "Designer drilldown grammar")` };
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  // Resume only when the prior composite belongs to THIS template content
  // (fingerprint) and names the same tasks — anything else starts over.
  const resumable = prior && prior.kb.templateFingerprint === fp && sameSet(Object.keys(prior.kb.tasks), taskIds);
  if (resumable) drill.resumedEntries++;
  /** @type {import("./doc-lib.mjs").KbDesignerComposite} */
  const kb = resumable
    ? prior.kb
    : { version: 1, templateFingerprint: fp, capturedAt: new Date().toISOString(), flags: { ...DESIGNER_FLAGS }, tasks: {}, fields: {}, taskDetails: {}, fieldDetails: {} };
  for (const tid of taskIds) if (!kb.tasks[tid]) kb.tasks[tid] = { status: "pending" };
  const target = resolve(outDir, `${base}.md`);
  const write = () =>
    writeFileAtomicSync(
      target,
      renderDesignerDoc({ name: entry.name ?? null, key: entry.key, id: String(entry.id), payload, envelope: core !== payload, kb, capturedAt: new Date().toISOString() })
    );
  write(); // the template level is captured even if the budget ends here
  // One spawn of either lower level: budget-charged, parsed, unwrapped, and
  // validated by the caller's `pick`. Returns { value } | { why, notFound }.
  const drillSpawn = (level, extra, pick) => {
    budgetLeft--; drill.spawns[level]++;
    const r = spawnCli([...args, ...extra]);
    if (!r.ok) return { value: null, why: printable(r.why, 200), notFound: FIELD_NOT_FOUND.test(r.stderr) || FIELD_NOT_FOUND.test(r.stdout) };
    let value = null;
    try { value = pick(unwrapOnce(JSON.parse(r.stdout))); } catch { /* non-JSON: reported below */ }
    return value === null ? { value: null, why: `${level} output is not the expected JSON shape`, notFound: false } : { value, why: null, notFound: false };
  };
  let stopped = false;
  for (const tid of taskIds) {
    if (kb.tasks[tid].status !== "ok") {
      if (budgetLeft <= 0) { stopped = true; break; }
      const r = drillSpawn("task", [DESIGNER_FLAGS.task, tid], (d) => (isRecord(d) ? d : null));
      if (!r.value) {
        kb.tasks[tid] = { status: "failed", error: r.why };
        drill.thisRun.tasksFailed++;
        write();
        continue;
      }
      // The drilldown's tables only — `_tasks` is emptied by the CLI and
      // `_taskCount` is the template's; both stay on the template body.
      /** @type {Record<string, *>} */
      const tables = {};
      for (const [k, v] of Object.entries(r.value)) if (k.startsWith("_task") && k !== "_tasks" && k !== "_taskCount") tables[k] = v;
      kb.taskDetails[tid] = tables;
      const { labels, unparsed } = designerTaskFieldLabels(tables);
      kb.tasks[tid] = { status: "ok", ...(unparsed.length ? { fieldListUnparsed: unparsed.map((u) => u.reason).join("; ") } : {}) };
      drill.thisRun.tasksOk++;
      // Field work list, keyed by the suffix-stripped label. A repeated label
      // (case-insensitive — the CLI's own resolver folds exactly that way) is
      // one key: `--field` resolves the first match, so one detail can only
      // ever serve the first row — the count is recorded and the reader keeps
      // the further rows label-only (never attributes the first field's
      // system name to a possibly different field).
      const map = kb.fields[tid] ?? (kb.fields[tid] = {});
      const byLower = new Map(Object.keys(map).map((k) => [k.toLowerCase(), k]));
      for (const l of labels) {
        const existing = byLower.get(l.label.toLowerCase());
        if (existing) { map[existing].duplicates = (map[existing].duplicates ?? 0) + 1; continue; }
        map[l.label] = { status: "pending", source: l.source, ...(l.suffix ? { suffix: l.suffix } : {}) };
        byLower.set(l.label.toLowerCase(), l.label);
      }
      write();
    }
    for (const [label, f] of Object.entries(kb.fields[tid] ?? {})) {
      if (f.status === "ok") continue;
      if (f.status === "failed" && f.permanent === true) { drill.thisRun.fieldsSkippedUnresolvable++; continue; }
      // Spellings to try, in order: a vocabulary-known suffix was stripped at
      // keying time, so the stripped label first and the full one on a
      // not-found refusal; an unknown trailing group is a label until the
      // CLI says otherwise, so the full label first and the shape-stripped
      // base second. Each attempt is a spawn.
      const full = f.suffix ? `${label} (${f.suffix})` : label;
      const shape = splitTrailingGroup(label);
      const spellings = f.suffix ? [label, full] : shape ? [label, shape.base] : [label];
      let outcome = null;
      for (const spelling of spellings) {
        if (budgetLeft <= 0) { stopped = true; break; }
        const r = drillSpawn("field", [DESIGNER_FLAGS.task, tid, DESIGNER_FLAGS.field, spelling], (d) => (isRecord(d) && Array.isArray(d._taskFieldDetail) ? d._taskFieldDetail : null));
        if (r.value) { outcome = { rows: r.value, spelling }; break; }
        outcome = { why: r.why, notFound: r.notFound };
        if (!r.notFound) break; // retryable (timeout/transport): do not spend the alternate spelling
      }
      if (stopped) break;
      if (outcome && outcome.rows) {
        (kb.fieldDetails[tid] ?? (kb.fieldDetails[tid] = {}))[label] = outcome.rows;
        f.status = "ok"; delete f.error; delete f.permanent;
        if (outcome.spelling !== label) f.spelling = outcome.spelling;
        drill.thisRun.fieldsOk++;
      } else if (outcome) {
        f.status = "failed"; f.error = outcome.why;
        if (outcome.notFound) { f.permanent = true; drill.thisRun.fieldsUnresolvable++; } else { delete f.permanent; drill.thisRun.fieldsFailed++; }
      }
      write();
    }
    if (stopped) break;
  }
  const s = designerDrilldownStats(kb);
  if (stopped) return { outcome: "budget", stats: s };
  if (s.complete) return { outcome: "documented", stats: s };
  const n = s.tasksFailed + s.fieldsFailed;
  // ASCII only: the mark's error text is clamped to printable characters.
  return { outcome: "failed", stats: s, error: `${n} of ${s.tasksTotal + s.fieldsTotal} drilldown(s) failed (retryable); doc kept, re-run to retry` };
}

for (const entry of batch.entries) {
  // Designer mode: a fresh entry needs its template describe AND at least
  // one drilldown to make progress (the floor on --spawn-budget says why).
  if (docMode === "designer" && budgetLeft <= 0) { budgetExhausted = true; break; }
  const markFailed = (msg, extra = []) => {
    runManifest(["mark", "--key", entry.key, "--status", "failed", "--error", printable(msg, 200), ...extra]);
    failures.push({ key: entry.key, error: printable(msg, 200) });
    progress();
  };
  if (tokens.includes("{name}") && (entry.name == null || entry.name === "")) {
    markFailed("no name recorded in manifest — cannot substitute {name}");
    continue;
  }
  const args = tokens.slice(1).map((t) => (t === "{id}" ? String(entry.id) : t === "{name}" ? String(entry.name) : t));
  if (docMode === "designer") { budgetLeft--; drill.spawns.template++; }
  const res = spawnCli(args);
  if (!res.ok) {
    markFailed(res.why);
    continue;
  }
  let payload = null;
  try {
    payload = JSON.parse(res.stdout);
  } catch { /* non-JSON stdout — kept raw below (raw mode only) */ }
  // Content fingerprint of the PARSED payload (never the rendered doc — see
  // doc-lib.mjs). Raw-mode non-JSON stdout has nothing to fingerprint.
  const fp = payload !== null ? canonicalFingerprint(payload) : null;
  // Ids are unique within the single-domain batch (inventory is keyed
  // <domain>/<id>), but distinct ids can still collide as FILENAMES on the
  // case-folding filesystems (Windows/macOS): "Company" and "company" are two
  // inventory entries and one file (F-125). The shared claimer suffixes on
  // every OS, keyed on in-run claims AND the files already on disk — so
  // collisions across SEPARATE runs (two batches each writing one half of the
  // pair) are caught too (F-156). Claimed BEFORE the --if-changed gate: a
  // designer entry cut off by the budget has a doc under this name and NO
  // recorded doc_path yet, and the claimer's exact-case reuse is how the next
  // run finds it.
  const base = claimBaseName(entry.id);
  const relPath = `${outDir.replace(/\\/g, "/").replace(/\/$/, "")}/${base}.md`;
  // Designer resume state: the composite already on disk for this entry, if
  // any — under the recorded doc_path, else under the claimed name (an
  // unmarked budget-cut doc; the two usually coincide, so the list is
  // deduped). Null for summary-only / legacy / no doc.
  let prior = null;
  if (docMode === "designer") {
    const candidates = [...new Set([typeof entry.doc_path === "string" ? resolve(entry.doc_path) : null, resolve(outDir, `${base}.md`)].filter((p) => p && existsSync(p)))];
    for (const p of candidates) {
      try {
        prior = designerDocProgress(unwrapOnce(parseDocJson(normalizeText(readFileSync(p, "utf8")))));
      } catch { prior = null; }
      if (prior) break;
    }
  }
  if (
    ifChanged && fp && typeof entry.fingerprint === "string" && entry.fingerprint.toLowerCase() === fp &&
    typeof entry.doc_path === "string" && existsSync(resolve(entry.doc_path)) &&
    (docMode !== "designer" || (prior !== null && prior.complete && prior.kb.templateFingerprint === fp))
  ) {
    // Unchanged content (only volatile modified/updated fields moved): skip
    // the doc write; mark documented with NO --depth and NO --doc-path (mark
    // keeps existing values when omitted — --depth full here would silently
    // promote metadata-era entries out of the --upgrade queue). The recorded
    // doc must still exist for the skip — a deleted doc file is the
    // operator's way of forcing regeneration, and a documented mark whose
    // doc_path points at nothing would strand the entry out of every queue.
    // The skipped entry's doc stays on disk, and the claimer's disk snapshot
    // (taken before this pass's first write) already blocks a later
    // case-colliding entry from taking its name — regardless of queue order,
    // which closed both the F-143 in-run lane and the F-125 cross-run
    // residual the old in-run Set could not see (F-156). Designer mode adds
    // one condition: the on-disk doc must be a COMPLETE composite of this
    // same template content — a summary-only doc from an earlier plugin
    // version, or a budget-cut partial, documents normally instead.
    runManifest(["mark", "--key", entry.key, "--status", "documented"]);
    skippedUnchanged++;
    unchangedKeys.push(entry.key);
    progress();
    continue;
  }
  let doc;
  if (docMode === "template") {
    // Compact email-template doc (shared renderer) — the raw payload carries
    // ~50 KB of entity-escaped HTML and must never be embedded.
    if (payload === null) {
      markFailed("describe output is not JSON — cannot render a template doc");
      continue;
    }
    try {
      doc = renderTemplateDoc(payload, { key: entry.key }).doc;
    } catch (e) {
      markFailed(e?.message ?? String(e));
      continue;
    }
  } else if (docMode === "program") {
    // Compact program doc (shared renderer) — the raw payload runs ~287 KB of
    // mostly flow-canvas geometry and must never be embedded.
    if (payload === null) {
      markFailed("describe output is not JSON — cannot render a program doc");
      continue;
    }
    try {
      doc = renderProgramDoc(payload, { key: entry.key }).doc;
    } catch (e) {
      markFailed(e?.message ?? String(e));
      continue;
    }
  } else if (docMode === "designer") {
    // Same failure contract as the two compact modes: a payload the mode
    // cannot build on marks THIS entry failed and the batch continues.
    const core = unwrapOnce(payload);
    if (!isRecord(core)) {
      markFailed("describe output is not a JSON object — cannot build a designer doc");
      continue;
    }
    let result;
    try {
      result = runDesignerEntry({ entry, payload, core, fp, base, args, prior });
    } catch (e) {
      markFailed(e?.message ?? String(e));
      continue;
    }
    if (result.outcome === "budget") {
      // Nothing marked: the doc says INCOMPLETE, the entry stays selectable,
      // and the next invocation resumes from the doc's `_kb`.
      budgetExhausted = true;
      drill.entries.cutOff++;
      progress();
      break;
    }
    if (result.outcome === "failed") {
      drill.entries.failed++;
      markFailed(result.error, existsSync(resolve(outDir, `${base}.md`)) ? ["--doc-path", relPath] : []);
      continue;
    }
    drill.entries.documented++;
    const markArgs = ["mark", "--key", entry.key, "--status", "documented", "--depth", "full", "--doc-path", relPath];
    if (fp) markArgs.push("--fingerprint", fp);
    runManifest(markArgs);
    docs.push(relPath);
    progress();
    continue;
  } else {
    // Describe payloads commonly wrap the asset in a `data` envelope.
    doc = renderRawDescribeDoc({
      name: entry.name ?? null,
      key: entry.key,
      id: String(entry.id),
      core: unwrapOnce(payload),
      fenceText: payload !== null ? JSON.stringify(payload, null, 2) : res.stdout.trim(),
      provenance: `> Full describe doc — generated by describe-batch.mjs, captured ${new Date().toISOString()}.`,
    });
  }
  writeFileSync(resolve(outDir, `${base}.md`), doc, "utf8");
  const markArgs = ["mark", "--key", entry.key, "--status", "documented", "--depth", "full", "--doc-path", relPath];
  if (fp) markArgs.push("--fingerprint", fp);
  runManifest(markArgs);
  docs.push(relPath);
  progress();
}

const more = runManifest(selectionArgs(1));
console.log(
  JSON.stringify(
    {
      ok: true,
      domain,
      docMode,
      commandSource,
      selected: batch.count,
      documented: docs.length,
      skippedUnchanged,
      unchangedKeys,
      failed: failures.length,
      failures,
      docs,
      ...(docMode === "designer" ? { drilldowns: { budget: spawnBudget, spawnsUsed: spawnBudget - budgetLeft, budgetExhausted, ...drill } } : {}),
      domainProgress: lastProgress ?? domainProgress(),
      moreRemaining: more.count > 0 || budgetExhausted,
    },
    null,
    2
  )
);
