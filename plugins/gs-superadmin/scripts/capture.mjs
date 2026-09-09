#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// capture.mjs — the shipped capture helper (B5 W4/DS-17): run one read-only
// gs-admin command and write its stdout to a file as clean UTF-8, no BOM —
// OR normalize an existing capture file whose encoding a shell redirect chose.
//
// Why this exists: the skills' bulk fetches redirect `gs-admin --json … > file`
// so payloads never enter model context, and what `>` writes depends on the
// shell — Windows PowerShell 5.1 writes UTF-16LE with a BOM (Out-File default),
// and its pipe re-encodes through the console codepage, both of which the
// later JSON.parse rejects or, worse, silently mangles (F-044/F-179/F-257).
// Every capturing skill used to restate that rule as prose, policed by
// build/check-doc-drift.mjs check 14; five rounds of matcher tuning
// (F-260..F-265) priced what prose-tier enforcement costs. This script IS the
// rule (A-5: construction over checking over prose): it spawns the CLI itself
// (argv array, shell:false — no shell, no redirect, no console codepage) and
// writes the bytes it captured, so the encoding can no longer vary by shell.
// Check 14 now enforces that skill captures ROUTE THROUGH this helper.
//
// Modes:
//   node capture.mjs --out <file> [--bin <path>] [--timeout-ms <n>]
//       [--wait [--wait-timeout <s>] [--wait-interval <s>]] -- gs-admin <args…>
//     Runs the command (everything after `--`, spelled exactly as a skill
//     would run it — the leading `gs-admin` word is required and matched
//     launcher-suffix-tolerantly, F-120) and writes stdout to <file> as UTF-8
//     without a BOM, via temp+rename (doc-lib writeFileAtomicSync) so a failed run
//     can never leave a truncated capture that reads as complete. On success:
//     one JSON summary on stdout ({ mode, out, bytes, command }). On failure:
//     nothing is written — the child's stderr has already streamed through —
//     and the exit code is the child's (A-4: a missing capture is loud, never
//     a plausible empty file).
//     --wait (GP-B5 W5/DS-26): bounded poll for the ASYNC dependency scan
//     (`dm deps check`), whose first response is usually a progress stub
//     (data.progressStatus.overallStatus "INIT"). The report skills used to
//     re-run the capture by hand every ~15 s as conversation turns; --wait
//     owns that loop: re-run the command every --wait-interval seconds
//     (default 15, floor 1 — each attempt is a real tenant request) until
//     the captured JSON reports overallStatus COMPLETED under the REQUIRED
//     `data` envelope (exactly the readers' rule — see depsScanStatus), for
//     up to --wait-timeout seconds (default 120, honored in full: the last
//     sleep is clamped to the remaining budget). A heartbeat line on stderr
//     names each retry. Only a COMPLETED payload is ever written to --out;
//     the summary gains { wait: { attempts, elapsedS } }. On timeout NOTHING
//     is written and the exit is non-zero, naming how long it waited and the
//     last status seen — "not ready after N s", never a confident zero (A-4:
//     the two consumer scripts refuse/flag non-COMPLETED captures, so an
//     incomplete file here would read downstream as a partial-but-plausible
//     dependency list). The readiness rule's agreement with the readers
//     (tenant-deps/jo-report-deps via parseLiveDepsAreas) is DIFFERENTIAL-
//     LOCKED by test/capture.mjs, which drives both implementations over the
//     same stub payloads (A-2).
//     --paginate (GP-B5 W6/DS-30): the page loop for bulk LIST sweeps — the
//     pagination doctrine the capturing skills used to restate as prose
//     (page loop, short-page/total reconciliation, suspect-round-count
//     honesty) now lives HERE, once. Requires --page-flag <name|none>: the
//     command's own paging flag spelled without dashes (`page`, per the
//     catalog), appended by the loop each round — or `none` for a
//     single reconciled fetch (limit-only commands, and commands with no
//     paging flags at all). With a page flag, --out must carry a literal
//     `{page}` placeholder (one file per page). Each page is captured with
//     the normal clean-write contract, then its envelope is scanned
//     (doc-lib decideEntryArray — ONE decision shared with er-count: the rows
//     array is the spine's single candidate (root / root child / `data`
//     child, where every measured list envelope keeps its rows — gate-3
//     F-351) or the one --items-path names; a shape it refuses is this
//     loop's `unrecognized-shape`; arrays never descended into; totals
//     collected
//     parse-don't-validate from the measured envelope variance: pageInfo
//     under data / at top level / absent, totalRecords / totalAfterFilters
//     / totalCount / _total / totalNumberOfObjects, `pageSize` vs `limit`).
//     Stop rule: an empty page stops; with a payload total, the loop stops
//     when the running count reaches it, and a short page below the
//     requested size only ADJUSTS the expected size (some handlers cap the
//     page size below what --limit asked for — a short page alone is never
//     proof of the last page); with no total, a short page stops (nothing
//     to reconcile against). --max-pages (default 50) is the safety stop.
//     --items-path <dotted> (gate-3 F-351) NAMES the rows array — the same
//     spelling manifest.mjs upsert-batch records — for any page whose spine
//     carries more than one distinct non-empty length (a list with a filled
//     side block such as `rp list`'s `alerts[]`, a bundle, a CLI view that
//     disagrees with the payload: the decision refuses them all the same way
//     and never ranks); stated by the caller, never inferred from the page.
//     The summary is the honesty report (A-3): pages fetched vs parsed,
//     rows counted, every total found with its path, per-page rows, and a
//     verdict — `reconciled` (exit 0), `unverified` (exit 0: no total
//     exists; the count is the CLI-reachable set, said so), or non-zero
//     `mismatch` / `suspect` (count landed exactly on a common server
//     default — 20/25/50/200 — or the requested limit, with nothing to
//     reconcile: re-verify with a larger limit to a SEPARATE file) /
//     `total-conflict` (payload totals disagree — never silently pick one)
//     / `unrecognized-shape` (the rows array could not be DECIDED: no array
//     on the envelope spine while arrays exist elsewhere, more than one
//     distinct non-empty length on the spine, or an --items-path naming no
//     array —
//     nothing is counted; name the rows array with --items-path <dotted>,
//     the same spelling manifest.mjs records, or inspect the page file)
//     / `failed-page` (a page that won't parse is a FAILED sweep page,
//     never 0 entries) / `safety-stop`. A non-zero sweep is never reported
//     as coverage. Reconciliation proves PAGING completeness against the
//     payload's own (post-filter) total — inventory completeness on
//     scope-limited domains is the skills' judgment, not this script's.
//   node capture.mjs --normalize <file>
//     Re-encodes an existing capture IN PLACE to UTF-8 without a BOM,
//     tolerant of what PS 5.1 redirects actually write: UTF-16LE with BOM,
//     UTF-16BE with BOM, UTF-8 with BOM (already-clean files pass through
//     byte-identical, without a rewrite). For captures that predate this
//     helper or were made by hand. Anything whose decode would be LOSSY is
//     refused with the file untouched (A-4 — never rewrite bytes into
//     U+FFFD): BOM-less non-UTF-8 (a console-codepage capture), BOM'd
//     content that is not valid in its declared encoding, UTF-16 payloads
//     with lone surrogates or an odd byte length (truncated mid-code-unit),
//     and BOM-less content carrying NUL bytes.
//     That last check is what refuses BOM-less UTF-16, which is
//     deliberately NOT sniffed (no encoding is ever guessed): a JSON or
//     text capture never contains a literal NUL, while UTF-16 of an
//     ASCII payload is NUL-interleaved yet byte-wise valid UTF-8, so the
//     validity check alone certified it as clean at exit 0 (F-297).
//     Summary: { mode, path, encoding, bytesIn, bytesOut }.
//
// Safety: like describe-batch.mjs, this script spawns gs-admin itself, so the
// mutation guard hook never sees the embedded command — the script therefore
// gates it fail-closed via the shared assertReadOnlyCommand (doc-lib; the
// five checks: unresolved, catalog-mutating, ask-override, read-shape,
// write-method endpoint). The capture read-shape policy below admits
// list-shaped and describe-shaped actions plus the known per-item and
// dependency-scan reads; everything else is refused — run it directly, where
// the guard can arbitrate. Exactly one plain command (no pipes/chains/
// redirects — there is no shell to interpret them, so an operator token in
// the argv is a mistake, refused loudly).
//
// The workspace catalog is resolved by walking up from the --out file's
// directory (captures land in <workspace>/.gs-superadmin/tmp/), falling back
// to the plugin's bundled catalog — same rule as describe-batch (F-232).
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  writeFileAtomicSync, makeCliHelpers, findWorkspaceCatalog, makeCommandResolver,
  assertReadOnlyCommand, assertPlainGsAdminCommand, resolveCliArgv, READ_VERB_EXACT,
  sleepMs, decideEntryArray, entryDecisionReason, DOTTED_PATH_RE,
} from "./doc-lib.mjs";
// The shared printable clamp (journal-lib exports it; the guard keeps its own
// self-contained copy by tenet — review round: a fourth hand copy here was
// the sibling-drift class the gate hoist exists to prevent).
import { printable } from "./journal-lib.mjs";
// The readers' own acceptance rule (F-320) — --wait gates on what the deps
// consumers will actually accept, not on a local re-implementation. The
// predicate lives in doc-lib beside parseLiveDepsAreas, which it calls.
import { depsCaptureReadiness } from "./doc-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// Everything after the first bare `--` is the command; everything before it is
// this script's own flags (so a command flag can never collide with --out).
const rawArgv = process.argv.slice(2);
const sep = rawArgv.indexOf("--");
const argv = sep === -1 ? rawArgv : rawArgv.slice(0, sep);
const cmdTokens = sep === -1 ? [] : rawArgv.slice(sep + 1);
const helpers = makeCliHelpers("capture.mjs", argv);
const { opt, out, finish } = helpers;
// Explicit annotation on `fail`'s own declaration (DS-46, strictNullChecks;
// the type is doc-lib's FailFn — its comment carries the rule): every
// `if (!x) fail(...)` below narrows x only through this line.
/** @type {import("./doc-lib.mjs").FailFn} */
const fail = helpers.fail;

const USAGE =
  'usage: capture.mjs --out <file> [--bin <path>] [--timeout-ms <n>] [--wait [--wait-timeout <s>] [--wait-interval <s>]] ' +
  '[--paginate --page-flag <name|none> [--max-pages <n>] [--items-path <dotted>]] -- gs-admin <args…>  |  capture.mjs --normalize <file>';

// ── Normalize mode ───────────────────────────────────────────────────────────
const normalizePath = opt("--normalize");
if (normalizePath) {
  // Reject EVERY capture-mode input, not just --out/--wait/command tokens —
  // a mixed-mode invocation with a knob silently ignored is the "two modes
  // given, one silently wins" class this guard exists for (review round).
  if (
    opt("--out") || cmdTokens.length || argv.includes("--wait") || argv.includes("--paginate") ||
    ["--bin", "--timeout-ms", "--wait-timeout", "--wait-interval", "--page-flag", "--max-pages", "--items-path"]
      .some((f) => opt(f) !== undefined)
  )
    fail(`--normalize takes no other mode — ${USAGE}`);
  const p = resolve(normalizePath);
  /** @type {Buffer} */
  let buf;
  try {
    buf = readFileSync(p);
  } catch (e) {
    fail(`cannot read ${p} (${e?.code ?? e?.message ?? String(e)})`);
  }
  // BOM sniff on the raw BYTES (an encoding decision, made before any decode).
  // Validation is fail-closed (A-4, review round): the first version decoded
  // with toString(), which maps undecodable bytes to U+FFFD — so a BOM-less
  // cp1252 capture (the PS-pipe console-codepage class, F-179) was silently
  // REWRITTEN with its bytes destroyed, at exit 0. Now every branch must
  // prove its decode was lossless before any write; otherwise the file is
  // left untouched and the failure names why. The UTF-8 branches never
  // transcode at all — the BOM strip is a byte slice, and the decode exists
  // only as the validity proof.
  const validUtf8 = (bytes) => {
    const t = bytes.toString("utf8");
    return Buffer.from(t, "utf8").equals(bytes);
  };
  const refuse = (why) =>
    fail(
      `${p} ${why} — cannot determine the source text, so nothing was rewritten (the file is ` +
        `untouched). Re-capture it through this helper, or convert it by hand from its real encoding.`
    );
  /** @type {Buffer} */
  let body; // the output bytes (UTF-8, no BOM)
  /** @type {string} */
  let encoding;
  // Odd-length guard for BOTH UTF-16 branches (release-gate round): a capture
  // cut short mid-code-unit has an odd payload byte count. toString("utf16le")
  // silently DROPS the trailing byte (the LE branch rewrote a truncated file
  // shorter at exit 0 — the F-297 false-green class), and swap16() throws a
  // raw RangeError before refuse() can run (the BE branch). Refuse up front,
  // file untouched, like every other undecodable shape.
  const oddUtf16 = (payload, name) => {
    if (payload.length % 2 !== 0)
      refuse(`is ${name} with an odd byte length (a capture truncated mid-code-unit?)`);
  };
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    encoding = "utf16le-bom";
    oddUtf16(buf.subarray(2), "UTF-16LE");
    const text = buf.subarray(2).toString("utf16le");
    body = Buffer.from(text, "utf8");
    // A UTF-8 encode of a lone surrogate emits U+FFFD; the round-trip
    // detects exactly the payloads whose transcode would be lossy.
    if (body.toString("utf8") !== text) refuse("is UTF-16LE with malformed text (lone surrogates)");
  } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    encoding = "utf16be-bom";
    oddUtf16(buf.subarray(2), "UTF-16BE");
    // Node has no utf16be decoder: byte-swap a copy, then decode as LE.
    const text = Buffer.from(buf.subarray(2)).swap16().toString("utf16le");
    body = Buffer.from(text, "utf8");
    if (body.toString("utf8") !== text) refuse("is UTF-16BE with malformed text (lone surrogates)");
  } else if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    encoding = "utf8-bom";
    body = buf.subarray(3);
    if (!validUtf8(body)) refuse("carries a UTF-8 BOM but its content is not valid UTF-8");
  } else {
    encoding = "utf8";
    body = buf;
    // NUL first: BOM-less UTF-16 of an ASCII payload is NUL-interleaved yet
    // every byte is < 0x80, so it passes the UTF-8 validity check — without
    // this refusal the file was certified "utf8" at exit 0 while still
    // failing JSON.parse (F-297, a false green). A real text capture never
    // carries a literal NUL, so this stays a refusal, not a sniff.
    if (body.includes(0)) refuse("carries no BOM and contains NUL bytes (a BOM-less UTF-16 capture?)");
    if (!validUtf8(body)) refuse("carries no BOM and is not valid UTF-8 (a console-codepage capture?)");
  }
  if (body !== buf) writeFileAtomicSync(p, body); // temp+rename with the win32 retry (F-133) — doc-lib's single copy
  // finish(): exit in the stdout write callback — never process.exit after a
  // stdout write (the F-356/F-360 class; makeCliHelpers' comment has the why).
  await finish({ mode: "normalize", path: p, encoding, bytesIn: buf.length, bytesOut: body.length });
}

// ── Capture mode ─────────────────────────────────────────────────────────────
const outPath = opt("--out");
if (!outPath) fail(USAGE);
if (sep === -1 || !cmdTokens.length) fail(`no command given after \`--\` — ${USAGE}`);
const timeoutMs = Number.parseInt(opt("--timeout-ms", "300000"), 10);
if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) fail("--timeout-ms must be ≥ 1000");

// --wait (DS-26): bounded poll for the async dependency scan. Boolean via
// argv.includes (T-8's rule — booleans never through opt()); the two knobs
// are whole SECONDS. The interval floor is 1 s (review round): every attempt
// is a real dm-deps-check request against the tenant, so an unthrottled
// spin loop must be unspellable, not merely undocumented.
const wait = argv.includes("--wait");
const waitTimeoutRaw = opt("--wait-timeout");
const waitIntervalRaw = opt("--wait-interval");
if (!wait && (waitTimeoutRaw !== undefined || waitIntervalRaw !== undefined))
  fail(`--wait-timeout/--wait-interval only apply with --wait — ${USAGE}`);
const waitTimeoutS = Number.parseInt(waitTimeoutRaw ?? "120", 10);
const waitIntervalS = Number.parseInt(waitIntervalRaw ?? "15", 10);
if (wait) {
  if (!Number.isFinite(waitTimeoutS) || waitTimeoutS < 1) fail("--wait-timeout must be ≥ 1 (seconds)");
  if (!Number.isFinite(waitIntervalS) || waitIntervalS < 1) fail("--wait-interval must be ≥ 1 (seconds)");
}

// --paginate (DS-30): the page loop. Boolean via argv.includes (T-8's rule);
// the page flag is stated by the CALLER, never guessed from the catalog — an
// explicit `none` is how limit-only commands (and commands with no paging
// flags at all) get the single reconciled fetch (A-4: no silent inference).
const paginate = argv.includes("--paginate");
const pageFlagRaw = opt("--page-flag");
const maxPagesRaw = opt("--max-pages");
// --items-path (gate-3 F-351): the rows array NAMED by the caller, the same
// dotted spelling manifest.mjs upsert-batch records — stated, never guessed,
// for every page whose spine carries more than one distinct non-empty
// length (the decision never ranks between them). Absent, a single-length
// spine decides and anything else is refused with the candidates named.
const itemsPath = opt("--items-path");
if (!paginate && (pageFlagRaw !== undefined || maxPagesRaw !== undefined || itemsPath !== undefined))
  fail(`--page-flag/--max-pages/--items-path only apply with --paginate — ${USAGE}`);
if (itemsPath !== undefined && !DOTTED_PATH_RE.test(itemsPath))
  fail(`--items-path must be a dotted key path (e.g. data.rows), got "${itemsPath.slice(0, 60)}"`);
const maxPages = Number.parseInt(maxPagesRaw ?? "50", 10);
// The command's paging flag, spelled without dashes (e.g. `page`) — a value
// spelled with them is tolerated. null = single reconciled fetch. The loop
// always starts at page 1: a resumed sweep cannot reconcile (the payload
// total covers the pages it skipped), so no --start-page knob exists (review
// round — a knob that cannot produce a correct verdict does not ship).
const pageFlagName =
  pageFlagRaw === undefined || pageFlagRaw === "none" ? null : `--${pageFlagRaw.replace(/^--+/, "")}`;
if (paginate) {
  if (wait)
    fail("--paginate and --wait are different jobs (a list sweep vs the async dependency scan) — use one");
  if (pageFlagRaw === undefined)
    fail(`--paginate requires --page-flag <name|none> (the command's own paging flag, e.g. \`page\`; \`none\` = one reconciled fetch) — it is never guessed`);
  if (!Number.isFinite(maxPages) || maxPages < 1) fail("--max-pages must be ≥ 1");
}

// First-token gs-admin match (launcher-suffix-tolerant, F-120) + operator
// refusals are the shared assertPlainGsAdminCommand in doc-lib — one hygiene
// rule for both spawn-capable scripts (review round: the copied blocks had
// already drifted from the guard's superset operator list).
assertPlainGsAdminCommand({
  tokens: cmdTokens, fail, printable,
  commandNoun: "the command after `--`",
  captureHint: "This script captures stdout itself; the file goes to --out.",
});
const args = cmdTokens.slice(1);

// Flag-token comparisons split on `=` (review round): the `--flag=value`
// spelling must neither slip the duplicate-page-flag guard nor hide the
// requested size from the suspect-count rule.
const flagName = (t) => String(t).split("=")[0];
if (paginate && pageFlagName) {
  if (cmdTokens.some((t) => flagName(t) === pageFlagName))
    fail(
      `the command already carries ${pageFlagName} — the paginate loop owns the page number and appends ` +
        `it each round; remove it from the command (a fixed page would re-fetch the same page forever)`
    );
  if (!outPath.includes("{page}"))
    fail("--paginate with a page flag needs a literal {page} placeholder in --out (one file per page)");
}
// The requested page size, read from the command's own tokens (the caller
// already spells `--limit 200` there; a second knob would drift): used only
// for the cap-detection flag and the suspect-count rule — absent is fine.
/** @type {number | null} */
let requestedSize = null;
if (paginate) {
  const i = cmdTokens.findIndex((t) => flagName(t) === "--limit" || flagName(t) === "--size");
  if (i !== -1) {
    const tok = cmdTokens[i];
    const raw = tok.includes("=") ? tok.slice(tok.indexOf("=") + 1) : cmdTokens[i + 1];
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) requestedSize = n;
  }
}

// ── Read-only gate (fail-closed; shared with describe-batch) ─────────────────
const resolvedOut = resolve(outPath);
const catalog = findWorkspaceCatalog(dirname(resolvedOut), join(here, "..", "reference", "catalog.json"));
if (!catalog) fail("no catalog found (workspace or bundled) — cannot verify the command is read-only; refusing");
const { cmd: matched, rest } = makeCommandResolver(catalog).resolveTokens(args);

// Capture read-shape policy: what skills capture to files are bulk LIST pages,
// per-item DESCRIBE payloads, and the dm dependency scan. Admitted:
//   - list-shaped actions, by BOTH of domain-candidates.mjs's prongs —
//     actionKey starting `list` (admits `jo email templates` / `jo dd list`
//     names) OR a summary starting "List" (review round: dropping the summary
//     prong refused `dm deps config`, a genuine setup candidate whose
//     actionKey is `dependency-config`) — plus the resolved-path verb form;
//     actionKey/summary are absent on hand-trimmed workspace catalogs, so
//     the verb clause stands alone there;
//   - describe-shaped actions and the shared per-item/scheduling read set
//     (READ_VERB_EXACT — one copy, in doc-lib, with the adoption-time
//     re-audit stamp);
//   - `check` — the async `dm deps check` dependency scan (actionKey
//     object-dependencies), the deps-report/email-report live capture.
// Everything else is refused; the shared gate's mutating/override/endpoint
// checks backstop this list in both directions.
const CAPTURE_VERB_EXACT = new Set([...READ_VERB_EXACT, "check"]);
const isCaptureRead = (verb, cmd) =>
  (typeof verb === "string" && (/^(describe|list)(-|$)/.test(verb) || CAPTURE_VERB_EXACT.has(verb))) ||
  (typeof cmd?.actionKey === "string" && /^list(-|$)/.test(cmd.actionKey)) ||
  (typeof cmd?.summary === "string" && /^List\b/.test(cmd.summary));
assertReadOnlyCommand({
  matched, rest, hooksDir: join(here, "..", "hooks"), fail, printable,
  isRead: isCaptureRead,
  shapeNoun: "a capture-shaped read",
  runsNoun: "read-only captures",
});

// ── Run and write ────────────────────────────────────────────────────────────
const cliArgv = resolveCliArgv({ binOpt: opt("--bin"), fail });

// One child run → captured stdout bytes, or a loud exit (the child's code,
// nothing written) — the single-shot failure contract, unchanged under
// --wait: a poll attempt that FAILS is a failed command, not "not ready".
const runOnce = (extraArgs = [], target = resolvedOut) => {
  const res = spawnSync(cliArgv[0], [...cliArgv.slice(1), ...args, ...extraArgs], {
    // stdout captured raw; stderr streams straight through so CLI errors and
    // progress stay visible to the caller in real time.
    stdio: ["ignore", "pipe", "inherit"],
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error || res.status !== 0) {
    const why = res.error
      ? /** @type {NodeJS.ErrnoException} */ (res.error).code === "ETIMEDOUT"
        ? `timed out after ${timeoutMs}ms`
        : res.error.message
      : `exit ${res.status}`;
    // Nothing written: an existing --out file (an earlier successful capture)
    // is left untouched, and the failure names that explicitly so a stale file
    // is never mistaken for this run's output.
    console.error(
      `capture.mjs: command failed (${why}) — nothing was written to ${target}` +
        ` (any existing file there is from an EARLIER run)`
    );
    process.exit(typeof res.status === "number" && res.status !== 0 ? res.status : 1);
  }
  // The CLI writes UTF-8 to a pipe (no console re-encoding on this path), so
  // the capture is a BYTE copy — no decode, no re-encode (review round: the
  // first version round-tripped tens-of-MB payloads through a JS string, ~4x
  // peak memory, and a decode maps any invalid byte to U+FFFD — a byte copy
  // preserves the child's output exactly). One defensive byte-level strip: a
  // leading UTF-8 BOM never reaches the file, should a future CLI emit one.
  let payload = res.stdout ?? Buffer.alloc(0);
  if (payload.length >= 3 && payload[0] === 0xef && payload[1] === 0xbb && payload[2] === 0xbf) {
    payload = payload.subarray(3);
  }
  return payload;
};

// UTF-8 bytes, no BOM, temp+rename — a failed run can never leave a truncated
// capture that reads as complete. doc-lib's writeFileAtomicSync is the single
// copy every integrity-owning writer uses (gate-3 F-352; normalize mode above
// used to spell its own).
const writePayload = (target, payload) => writeFileAtomicSync(target, payload);

// ── Paginate mode (DS-30): the page loop, reconciliation, honesty report ─────
if (paginate) {
  // Common server-default page sizes observed live (20/25/50) plus the 200
  // page cap — a final count landing EXACTLY on one of these, with no payload
  // total to reconcile against, is a suspect round count, never trusted.
  const SUSPECT_COUNTS = new Set([20, 25, 50, 200]);
  const perPage = [];
  const flags = [];
  // Every distinct row-total value seen, value → Set of dotted paths (pages
  // may repeat the same total; a DISAGREEMENT is a conflict, never a pick).
  const totalsSeen = new Map();
  // The ONE derivation of "the payload total" (review round: the loop's stop
  // rule and the report must never compute it from two drifting expressions).
  const soleTotal = () => (totalsSeen.size === 1 ? totalsSeen.keys().next().value : null);
  let cum = 0;
  let effSize = requestedSize;
  // The sweep's verdict vocabulary — every value the report can carry, as the
  // type (strictNullChecks ratchet; an unlisted spelling is a checker error).
  /** @type {"safety-stop" | "failed-page" | "unrecognized-shape" | "total-conflict" | "reconciled" | "mismatch" | "suspect" | "unverified" | null} */
  let verdict = null;
  /** @type {string | null} */
  let stopped = null; // why the loop ended (for the report)
  /** @type {Array<{path: string, value: string | number | boolean | null}> | null} */
  let firstSignals = null; // page 1's pageSignals, primitive-clamped, for the report
  for (let page = 1; ; page++) {
    if (perPage.length >= maxPages) {
      verdict = "safety-stop";
      stopped = `safety stop: ${maxPages} page(s) fetched and the sweep still had not reached a stop rule — ` +
        `something is off (a non-entry array being counted, a server repeating pages, or a genuinely huge ` +
        `domain: raise --max-pages deliberately)`;
      break;
    }
    const target = resolve(outPath.replaceAll("{page}", String(page)));
    const payload = runOnce(pageFlagName ? [pageFlagName, String(page)] : [], target);
    writePayload(target, payload);
    let doc = null;
    try {
      const parsed = JSON.parse(payload.toString("utf8"));
      doc = parsed && typeof parsed === "object" ? parsed : null;
    } catch { /* falls through to the failed-page verdict */ }
    if (doc == null) {
      perPage.push({ page, file: target, rows: null, bytes: payload.length });
      verdict = "failed-page";
      stopped = `page ${page} is not parseable JSON — a FAILED sweep page, never 0 entries (file kept as evidence)`;
      break;
    }
    // Which array is THE rows array — decided ONCE, in doc-lib's
    // decideEntryArray (gate-3 F-351; moved there at F-354/F-355 so er-count
    // and this loop can never disagree): --items-path names it, else the spine
    // rule. A refused shape (off-spine, ambiguous, named-missing) is verdict
    // unrecognized-shape with doc-lib's own reason — nothing counted, because a
    // refused page counted as 0 would end a sweep as a confident empty domain,
    // and the old "largest array anywhere" rule let a sibling block inflate the
    // running count until a truncated sweep read `reconciled`.
    const { scan, decision } = decideEntryArray(doc, itemsPath !== undefined ? { itemsPath } : {});
    const reason = entryDecisionReason(decision);
    if (reason) {
      perPage.push({ page, file: target, rows: 0, rowsPath: null, bytes: payload.length });
      verdict = "unrecognized-shape";
      stopped = `page ${page}: ${reason}`;
      break;
    }
    const rowsCount = decision.kind === "rows" ? decision.count : 0;
    const rowsPath = decision.kind === "rows" ? decision.path : null;
    perPage.push({ page, file: target, rows: rowsCount, rowsPath, bytes: payload.length });
    cum += rowsCount;
    if (firstSignals == null) {
      // Signals are report-only evidence (a string-typed total, a lastPage
      // flag): clamp to primitives so the summary never retains payload
      // subtrees.
      firstSignals = scan.pageSignals.map(({ path, value }) => ({
        path,
        value: value === null || ["number", "boolean", "string"].includes(typeof value)
          ? (typeof value === "string" ? printable(value, 80) : value)
          : `(${Array.isArray(value) ? "array" : typeof value})`,
      }));
    }
    for (const t of scan.rowTotals) {
      if (!totalsSeen.has(t.value)) totalsSeen.set(t.value, new Set());
      totalsSeen.get(t.value).add(t.path);
    }
    if (totalsSeen.size > 1) {
      verdict = "total-conflict";
      stopped =
        "the payload's own totals disagree — " +
        [...totalsSeen].map(([v, paths]) => `${v} (${[...paths].join(", ")})`).join(" vs ") +
        " — nothing is reconciled and no value is silently picked";
      break;
    }
    const total = soleTotal();
    if (!pageFlagName) { stopped = "single fetch (--page-flag none)"; break; }
    if (rowsCount === 0) { stopped = `page ${page} returned 0 entries`; break; }
    // The entry array must be the SAME array across pages — a page whose
    // largest spine array lives elsewhere is counting something else (review
    // round). Checked only for a page that HAS entries (gate-3 F-347): an
    // empty last page has no entry array at all, and this check used to sit
    // above the empty-page stop, flagging every no-total sweep that ended on
    // one as "counts may not be comparable".
    if (perPage.length > 1 && rowsPath !== perPage[0].rowsPath) {
      flags.push(
        `page ${page}'s entry array is at ${JSON.stringify(rowsPath)} but page ${perPage[0].page}'s was at ` +
          `${JSON.stringify(perPage[0].rowsPath)} — the counts may not be comparable; inspect the page files before ` +
          `trusting the totals`
      );
    }
    if (total != null && cum >= total) { stopped = `running count ${cum} reached the payload total ${total}`; break; }
    if (effSize == null) effSize = rowsCount;
    if (rowsCount < effSize) {
      if (total != null) {
        // The cap rule: a short page is only the last page if the running
        // total also matches the payload's total — otherwise the server
        // capped the page size below what --limit asked for; keep paging at
        // the size actually returned.
        flags.push(
          `page ${page} returned ${rowsCount} < ${effSize} while the running count ${cum} is short of ` +
            `the payload total ${total} — the server capped the page size; continuing at ${rowsCount}/page`
        );
        effSize = rowsCount;
      } else {
        stopped = `page ${page} returned ${rowsCount} < ${effSize} (short page; no payload total to reconcile against)`;
        break;
      }
    }
  }
  const total = soleTotal();
  const pagesParsed = perPage.filter((p) => p.rows !== null).length;
  if (verdict == null) {
    if (total != null) {
      if (cum === total) verdict = "reconciled";
      else {
        verdict = "mismatch";
        flags.push(
          cum < total
            ? `captured ${cum} of ${total} — the sweep is SHORT of the payload's own total: re-fetch with a ` +
              `larger limit (or more pages) before reporting this domain as covered`
            : `captured ${cum} but the payload total says ${total} — more rows than the total claims; the ` +
              `total is not trusted, and neither is the count until re-verified`
        );
      }
    } else if (SUSPECT_COUNTS.has(cum) || (requestedSize != null && cum === requestedSize)) {
      verdict = "suspect";
      flags.push(
        `final count ${cum} lands exactly on ${requestedSize != null && cum === requestedSize ? "the requested limit" : "a common server default"} ` +
          `with no payload total to reconcile against — a suspect round count, never trusted: re-verify with a ` +
          `larger limit captured to a SEPARATE file (never overwrite the baseline being compared against)`
      );
    } else {
      verdict = "unverified";
      flags.push(
        "no payload total anywhere — the count is the CLI-reachable set and its completeness could not be " +
          "reconciled; say so wherever this sweep is reported" +
          (firstSignals?.length
            ? " (page signals WERE seen — see pageSignals: a non-numeric or unrecognized total spelling is reported there, never reconciled)"
            : "")
      );
    }
  }
  if (verdict === "reconciled") {
    flags.push(
      "reconciliation proves PAGING completeness against the payload's own (post-filter) total — on a " +
        "scope-limited domain that is not inventory completeness"
    );
  }
  const summary = {
    mode: "paginate",
    verdict,
    pagesFetched: perPage.length,
    pagesParsed,
    rowsCounted: cum,
    payloadTotal: total,
    totalPaths: total != null ? [...(totalsSeen.get(total) ?? [])] : [],
    requestedSize,
    stopped,
    flags,
    perPage,
    pageSignals: firstSignals ?? [],
    command: printable(["gs-admin", ...args].join(" "), 200),
  };
  const okVerdict = verdict === "reconciled" || verdict === "unverified";
  if (!okVerdict) console.error(`capture.mjs: paginate verdict ${verdict} — ${flags[flags.length - 1] ?? stopped}`);
  // The honesty report grows one row per page; finish() writes it and exits
  // in the write callback so a long sweep's summary is never cut at a pipe
  // chunk (the F-356/F-360 class).
  await finish(summary, okVerdict ? 0 : 1);
}

// dm-deps-check readiness (--wait): the rule is IMPORTED from the readers
// (jo-report-deps depsCaptureReadiness, F-320) — a capture is ready exactly
// when parseLiveDepsAreas accepts it AND the scan is COMPLETED. The previous
// hand-written status probe checked only overallStatus, so a COMPLETED
// payload without a dependents object was written as success and then
// skipped downstream as unrecognizable — the exact class the old comment
// claimed differential-locked (the lock never sampled that axis; it now
// proves the import wiring instead of a hand-sync).
const startedAt = Date.now();
let attempts = 0;
let payload;
for (;;) {
  attempts++;
  payload = runOnce();
  if (!wait) break;
  const { ready, status } = depsCaptureReadiness(payload.toString("utf8"));
  if (ready) break;
  const elapsedS = (Date.now() - startedAt) / 1000;
  const shown =
    status == null
      ? "none — no data.progressStatus.overallStatus in the payload (is this the dm deps scan?)"
      : status === "COMPLETED"
        ? `${status}, but the payload is not one the deps readers accept (no dependents map) — it would be skipped downstream, so it is not written`
        : status;
  if (elapsedS >= waitTimeoutS) {
    // Timeout honesty (A-4): nothing is written — both consumer scripts
    // treat a non-COMPLETED capture as partial-but-plausible, so an
    // incomplete file here would read downstream as a confident undercount.
    // No claim about WHY the scan is not COMPLETED: the status vocabulary is
    // the server's (review round — the old text asserted "still running",
    // false for a terminal failure status).
    console.error(
      `capture.mjs: not ready after ${Math.round(elapsedS)}s (${attempts} attempt(s); last overallStatus: ${shown}) — ` +
        `nothing was written to ${resolvedOut} (any existing file there is from an EARLIER run). ` +
        `If that status is a terminal failure, re-running will not help — inspect the scan in the tenant; ` +
        `otherwise re-run with a longer --wait-timeout, or re-capture later.`
    );
    process.exit(1);
  }
  // Sleep only what the budget still allows, so --wait-timeout is honored in
  // FULL: the pre-review check (`elapsed + interval > timeout`, before the
  // sleep) exited without ever sleeping whenever the remaining budget was
  // smaller than the interval — a --wait-timeout at or below the interval
  // degenerated to a single attempt.
  const sleepForS = Math.min(waitIntervalS, waitTimeoutS - elapsedS);
  // Heartbeat (review round): a parked 15 s gap reads as a hang to an
  // operator watching a long poll — say what happened and what comes next.
  console.error(
    `capture.mjs: attempt ${attempts} — overallStatus: ${shown}; retrying in ${Math.ceil(sleepForS)}s ` +
      `(${Math.round(elapsedS)}s elapsed of ${waitTimeoutS}s)`
  );
  sleepMs(sleepForS * 1000); // doc-lib's zero-dep sync sleep
}
writePayload(resolvedOut, payload);
out({
  mode: "capture",
  out: resolvedOut,
  bytes: payload.length,
  command: printable(["gs-admin", ...args].join(" "), 200),
  ...(wait ? { wait: { attempts, elapsedS: Math.round(((Date.now() - startedAt) / 1000) * 10) / 10 } } : {}),
});
