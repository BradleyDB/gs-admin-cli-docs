#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// journal.mjs — deterministic change-attribution + journal operations
//
// The change-request skill's execution steps used to hand-transcribe the
// `.gs-superadmin/active-change.json` marker and the plan-completion journal
// entry (kind literal `change-plan execution` — "plan-completion" is prose
// shorthand, never the label) from SKILL.md fences — an LLM copying JSON and
// timestamps by hand.
// These verbs own that now: the model supplies WHAT happened (ticket, plan,
// outcome, assets); this script owns validation, timestamps, the operator
// field, atomic writes, and the journal file header (shared with the guard
// hook via journal-lib.mjs — guard-fixtures locks the two writers together).
//
// Verbs (workspace root = nearest ancestor of cwd containing `.gs-superadmin/`,
// override with --workspace <dir>):
//   change-start   --ticket <KEY|none> --plan <ws-relative path> --slug <slug>
//                  validate all three (plan file must exist under
//                  <slug>/changes/), stamp started_at = now, and atomically
//                  write .gs-superadmin/active-change.json so the guard hook
//                  attributes guard-approved commands to this plan. An
//                  existing marker is replaced (reported as replaced: true).
//   change-end     delete the marker (idempotent — ok even if absent), so
//                  later unrelated mutations are never attributed to a spent
//                  plan.
//   journal-append --slug <slug> --plan <ws-relative path>
//                  --outcome <executed|partial> --system-area <area>
//                  --ticket <KEY|none> --asset "<line>" [--asset "<line>" …]
//                  append one plan-completion entry (kind literal
//                  `change-plan execution`) to
//                  <slug>/changes/JOURNAL.md, creating the file with the
//                  exact header the guard hook writes. Completion timestamp
//                  and operator are computed here, never passed in.
//
// Output: one JSON object on stdout. Non-zero exit + stderr message on error.
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import {
  mkdirSync, existsSync, statSync,
  readdirSync, appendFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { userInfo } from "node:os";
import { journalHeader, printable, oneLine, composeJournalEntry } from "./journal-lib.mjs";
import { direntIsDirectory, writeFileAtomicSync, removeFileSync, makeCliHelpers } from "./doc-lib.mjs";

const argv = process.argv.slice(2);
const verb = argv[0];

// Shared argv helpers (F-238) — the F-165/F-171 last-token rule (extended
// here by F-205: a silently-defaulted flag would send the marker/journal to a
// CWD-derived workspace or stamp today's date in place of the intended one)
// lives in doc-lib now. Every opt()/optAll() call site in this script takes a
// value (no boolean flags), so the guard cannot misfire on a valid spelling.
const { opt, fail, out } = makeCliHelpers("journal.mjs", argv);
function optAll(name) {
  const vals = [];
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === name && argv[i + 1] !== undefined) vals.push(argv[++i]);
  }
  return vals;
}

// Single-line clamp for model-supplied free text (asset lines, plan paths):
// oneLine (journal-lib) keeps non-ASCII — the documented asset-line format
// itself contains an em dash (F-132) — while still stripping control/bidi
// characters and capping surrogate-safely. The OPERATOR clamp is frame
// policy and lives in composeJournalEntry, not here.

const VERBS = new Set(["change-start", "change-end", "journal-append"]);
if (!VERBS.has(verb)) fail(`usage: journal.mjs <${[...VERBS].join("|")}> [--workspace <dir>] [...]`);

// Workspace root: same walk-up the guard hook does, so the marker this script
// writes is exactly the one the hook will read.
let ws = resolve(opt("--workspace", process.cwd()));
for (;;) {
  if (existsSync(join(ws, ".gs-superadmin"))) break;
  const up = dirname(ws);
  if (up === ws) fail("no .gs-superadmin workspace found at or above the current directory — run /gs-superadmin:setup first");
  ws = up;
}
const markerPath = join(ws, ".gs-superadmin", "active-change.json");

// Tenant slugs = directories carrying a _manifest.json (the hook's rule).
// Resolve case-insensitively but return the on-disk casing, so the marker the
// hook matches (case-insensitively, as LLM-written markers required) is exact.
function resolveSlug(given) {
  if (!given) fail("--slug <workspace slug> is required");
  let entries;
  try {
    entries = readdirSync(ws, { withFileTypes: true });
  } catch (e) {
    fail(`cannot read workspace directory ${ws}: ${e.message}`);
  }
  // direntIsDirectory, not e.isDirectory(): a tenant dir behind a
  // junction/symlink (OneDrive/Known-Folder setups) reports isDirectory false
  // and would be invisible here (F-134).
  const slugs = entries
    .filter((e) => direntIsDirectory(ws, e) && existsSync(join(ws, e.name, "_manifest.json")))
    .map((e) => e.name);
  // Case-insensitive fallback with an ambiguity guard (F-207, same class as
  // the F-155 plan-segment guard): on a case-sensitive fs two case-variant
  // tenant dirs can both exist, and "first readdir match" would make the
  // resolution — and everything recorded from it — readdir-order-dependent.
  let match = slugs.find((s) => s === given);
  if (!match) {
    const folded = slugs.filter((s) => s.toLowerCase() === given.toLowerCase());
    if (folded.length > 1) {
      fail(`--slug "${given}" is ambiguous: ${folded.join(" and ")} are distinct tenant workspaces ` +
        `on this filesystem — spell the slug exactly as the directory you mean`);
    }
    match = folded[0];
  }
  if (!match) {
    fail(`no tenant workspace named "${given}" (no ${given}/_manifest.json). ` +
      (slugs.length ? `Known slugs: ${slugs.join(", ")}` : "No tenant manifests found — run /gs-superadmin:setup first."));
  }
  return match;
}

// Ticket: a Jira-shaped key or the literal word "none" — anything else is a
// transcription mistake the journal must not absorb.
function validTicket(t) {
  if (!t) fail('--ticket <KEY|none> is required (the plan header\'s Jira key, or the word "none")');
  if (t === "none" || /^[A-Z][A-Z0-9]*-\d+$/.test(t)) return t;
  fail(`--ticket "${t}" is neither a Jira key (e.g. CSOPS-142) nor the word "none"`);
}

// Plan: workspace-relative, must live under <slug>/changes/, and must exist on
// disk — the filename carries the drafting date, so requiring the real file
// makes "copy it, never re-derive it from today" mechanical.
function validPlan(given, slug) {
  if (!given) fail("--plan <workspace-relative path> is required");
  const norm = String(given).replace(/\\/g, "/").replace(/^\.\//, "");
  const parts = norm.split("/");
  // Reject dot/empty segments outright: "acme-prod/changes/../x.md" would pass
  // the segment checks below but join() resolves the ".." OUTSIDE changes/ —
  // and the traversal path would be recorded verbatim in the marker/journal.
  if (parts.some((p) => p === "" || p === "." || p === "..")) {
    fail(`--plan must not contain ".", "..", or empty path segments — got "${given}"`);
  }
  // The "changes" segment folds case like the slug segment does (F-122): an
  // LLM-typed `Changes/` resolves on Windows/macOS, so rejecting it on spelling
  // alone is a false failure there — and the canonical form below is what gets
  // recorded, so the marker/journal never carry the typed casing. existsSync
  // stays authoritative: on Linux a literal `Changes/` dir still fails the
  // file check loudly (fail-closed).
  if (parts[0]?.toLowerCase() !== slug.toLowerCase() || parts[1]?.toLowerCase() !== "changes" || parts.length < 3) {
    fail(`--plan must be a workspace-relative path under ${slug}/changes/ — got "${given}"`);
  }
  // Ambiguity guard on the case fold (F-155): on a case-SENSITIVE fs the slug
  // dir can hold BOTH `changes/` and a differently-cased sibling as distinct
  // entries — a typed non-canonical casing would then validate-and-record the
  // canonical dir's same-named file, a different file, silently. Fail loudly
  // when the typed spelling and the canonical one both exist as distinct
  // entries; a case-folding fs cannot hold both, so this can never fire
  // there, and the F-122 rescue (folding a typo when only changes/ exists)
  // is unchanged. Best-effort read: an unreadable slug dir falls through to
  // the existsSync check below, which stays authoritative.
  if (parts[1] !== "changes") {
    let entries = [];
    try { entries = readdirSync(join(ws, slug)); } catch { /* fall through to existsSync */ }
    if (entries.includes("changes") && entries.includes(parts[1])) {
      fail(
        `--plan path segment "${parts[1]}" is ambiguous: this workspace holds both "${parts[1]}/" and ` +
          `"changes/" as distinct directories — spell the plan path with the directory you mean ` +
          `(the canonical form is ${slug}/changes/...)`
      );
    }
  }
  // Same guard for the SLUG segment (F-207): it was folded and then discarded
  // by the canonicalization below, so on a case-sensitive fs a --plan naming a
  // case-variant SIBLING tenant dir would be silently rewritten into the
  // resolved slug's changes/ — a different tenant's plan path recorded as this
  // one's. Fail loudly when both spellings exist as distinct entries; a
  // case-folding fs cannot hold both, so the F-122 typo rescue is unchanged.
  if (parts[0] !== slug) {
    let entries = [];
    try { entries = readdirSync(ws); } catch { /* fall through to existsSync */ }
    if (entries.includes(slug) && entries.includes(parts[0])) {
      fail(
        `--plan path segment "${parts[0]}" is ambiguous: this workspace holds both "${parts[0]}/" and ` +
          `"${slug}/" as distinct directories — spell the plan path with the tenant directory you mean ` +
          `(the resolved slug is ${slug})`
      );
    }
  }
  const canonical = [slug, "changes", ...parts.slice(2)].join("/");
  const abs = join(ws, canonical);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    fail(`plan file not found: ${canonical} (resolved against workspace ${ws}). ` +
      "Pass the plan file's actual on-disk path — its filename carries the drafting date; never re-derive it from today.");
  }
  return canonical;
}

if (verb === "change-start") {
  const slug = resolveSlug(opt("--slug"));
  const ticket = validTicket(opt("--ticket"));
  const plan = validPlan(opt("--plan"), slug);
  const replaced = existsSync(markerPath);
  const marker = { ticket, plan, slug, started_at: new Date().toISOString() };
  // atomic temp+rename with the Windows retry (F-133) — doc-lib's single copy
  writeFileAtomicSync(markerPath, JSON.stringify(marker, null, 2) + "\n");
  out({ ok: true, verb, marker: markerPath, replaced, ...marker });
} else if (verb === "change-end") {
  const existed = existsSync(markerPath);
  if (existed) removeFileSync(markerPath); // same Windows-lock retry as the marker write (F-133)
  out({ ok: true, verb, marker: markerPath, existed });
} else if (verb === "journal-append") {
  const slug = resolveSlug(opt("--slug"));
  const ticket = validTicket(opt("--ticket"));
  const plan = validPlan(opt("--plan"), slug);
  const outcomeFlag = opt("--outcome");
  const OUTCOMES = { executed: "executed", partial: "partially executed — see plan" };
  if (!OUTCOMES[outcomeFlag]) {
    fail('--outcome must be "executed" (every step in the plan ran) or "partial" (any step skipped or failed)');
  }
  const area = opt("--system-area");
  if (!area) fail("--system-area <area from the plan header> is required");
  const assets = optAll("--asset").map((a) => oneLine(a, 300)).filter(Boolean);
  if (!assets.length) {
    fail('at least one --asset "<CREATE|MODIFY> <name> (<GSID>) — <KB doc path | KB doc pending next /gs-superadmin:refresh>" is required ' +
      '(pass --asset none if the executed steps created or modified nothing)');
  }

  let operator;
  try {
    operator = userInfo().username;
  } catch {
    operator = process.env.USERNAME || process.env.USER || "unknown";
  }

  const ts = new Date().toISOString();
  const cleanArea = printable(area, 80);
  // Validate AFTER the clamp, not just before it (F-292): a non-ASCII or
  // whitespace-only --system-area passes the `!area` presence check yet
  // clamps to empty, and the frame's empty-slot throw would then crash the
  // verb with a raw stack trace instead of the fail() + JSON contract.
  if (!cleanArea) {
    fail(
      '--system-area clamps to empty (the value has no printable ASCII) — pass the plan ' +
        "header's area in plain ASCII, e.g. gs-rules"
    );
  }
  // Same clamp-to-empty class for the OS-reported username: fall back rather
  // than let the frame throw uncaught (F-292).
  operator = oneLine(operator, 80) || "unknown";
  // Entry FRAME from journal-lib's composeJournalEntry — the shared emitter
  // both writers call (T-4; conformance-pinned). The fields below are this
  // writer's own: the plan line, system-area, ticket on its OWN line
  // (script-only — the guard writes the combined ticket·plan line), and one
  // assets line per --asset.
  const entry = composeJournalEntry({
    ts,
    area: cleanArea,
    ticket,
    kind: "change-plan execution",
    operator,
    fields: [
      `- plan: ${oneLine(plan, 200)} (${OUTCOMES[outcomeFlag]})`,
      `- system-area: ${cleanArea}`,
      `- ticket: ${ticket}`,
      ...assets.map((a) => `- assets: ${a}`),
    ],
    kbSnapshot: "pre-change state cited in the plan's Impact analysis (KB paths + last_verified dates there)",
  });

  const journalPath = join(ws, slug, "changes", "JOURNAL.md");
  mkdirSync(dirname(journalPath), { recursive: true });
  // Header + entry in ONE append, same as the hook: appendFileSync creates the
  // file itself, so the worst concurrent outcome is a duplicate header, never
  // a lost entry.
  const created = !existsSync(journalPath);
  appendFileSync(journalPath, (created ? journalHeader(slug) : "") + entry + "\n");
  out({ ok: true, verb, journal: journalPath, created, timestamp: ts, slug, ticket, plan, outcome: OUTCOMES[outcomeFlag], assets: assets.length });
}
