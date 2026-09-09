// ─────────────────────────────────────────────────────────────────────────────
// journal-lib.mjs — the change journal's shared file format
//
// `<slug>/changes/JOURNAL.md` has exactly two writers: the guard hook's
// PostToolUse journal (hooks/gs-admin-guard.mjs) and the change-request
// skill's completion entries (kind literal `change-plan execution`, via
// scripts/journal.mjs). The shared FORMAT lives here as two emitters both
// writers import: journalHeader (whichever writer creates the file first
// must produce the identical header — guard-fixtures pins the two writers'
// runtime HEADERS equal) and composeJournalEntry (the T-4 entry frame —
// the conformance suite's T-4 section pins every entry line through both
// real writers). The hook imports this module
// lazily inside its fail-open try block: its PreToolUse path stays
// self-contained, and a missing/corrupt copy of this file degrades to the
// journaling alert, never a crashed hook.
//
// This file deliberately imports NOTHING — not even node: builtins (F-157):
// the guard's lazy import of this module must fail as a unit, never on another
// file's syntax. Declared + enforced by build/check-imports.mjs (the import-
// graph declaration); codePointSlice below is a local copy for that reason —
// the guard-local-copy precedent.
// ─────────────────────────────────────────────────────────────────────────────

// ── T-4 · Journal entry (shared format home) ─────────────────────────────────
/**
 * FROZEN (B5 P1, 2026-08-16; v2 B1, 2026-08-16; v4 B3, 2026-08-16 —
 * grammar re-derived from CAPTURED output of both writers and locked by the
 * T-4 section of test/contract-conformance.mjs, which executes both writers;
 * journal.mjs's kind label and field list corrected, the shared FRAME split
 * from the per-writer lists. Found by DS-15's conformance probes and
 * Bradley-approved in-session, Option A).
 * One journal entry, either writer (guard PostToolUse | journal.mjs
 * journal-append). File = journalHeader(slug) + entries, append-only;
 * guard-fixtures pins the two writers' runtime HEADERS equal (the entry
 * bodies are different record kinds by design — see the lists below).
 *
 * Entry FRAME, both writers (byte-uniform across every captured variant):
 *   ## <ISO ms Z> · <system-area> · <ticket key | "no-ticket">
 *   <blank> · `- kind:` first bullet · `- operator: <oneLine ≤80 — non-ASCII
 *   PRESERVED (F-132)>` second · `- kb-snapshot:` last bullet (content per
 *   writer: guard = tenant/domain KB-ref sentence; journal.mjs = fixed
 *   impact-analysis sentence) · <blank> terminator
 *
 * Guard composer fields, in order (invariant across all outcome variants):
 *   - kind: command (guard-approved)
 *   - action: <cmdKey + catalog-version basis (plain | ask-override |
 *     union-promoted) | not-in-catalog fail-closed sentence>
 *   - system-area: <vendored jira-ticket-anatomy §2 component vocabulary |
 *     catalog namespace as-is | "unknown">
 *   - target: <printable ≤200 | "(none stated)">
 *   - command: <redactSecrets THEN printable ≤1000>
 *   - outcome: <outcome sentence — basis per JournalOutcomeBasis below>
 *   - note: <blind/operand caveats — CONDITIONAL: present only when the parse
 *     established less than the entry would otherwise assert>
 *   - ticket: <KEY|none> · plan: <path|none>    (one combined line, hook-only)
 *
 * journal.mjs journal-append fields, in order:
 *   - kind: change-plan execution
 *   - plan: <ws-relative path> (executed | partially executed — see plan)
 *   - system-area: <plan header area, printable ≤80>
 *   - ticket: <KEY|none>                        (its own line, script-only)
 *   - assets: <oneLine ≤300>   (one per NON-EMPTY --asset — a value that
 *     clamps to empty is dropped, so the line count can undercount the argv)
 *
 * @typedef {"failed-event"|"exit-code"|"error-flag"|"interrupted"|
 *           "success-event"|"inferred-unverified"} JournalOutcomeBasis
 *   — conceptual labels for the guard's 6-way outcome precedence (the
 *   "Execution outcome" comment block in gs-admin-guard.mjs), NOT literal
 *   strings in the entry: the outcome line carries prose sentences. A typedef
 *   documents this union; it must never narrow it (defensive by tenet).
 *   Orthogonal to the basis (F-428): every basis describes the whole command
 *   LINE, so for a hit that was not the line's last stage (piped, `;`/`||`-
 *   chained, a non-last line, a nested shell that is itself piped) the guard
 *   qualifies the sentence IN the outcome — success-shaped bases become "ran —
 *   exit status not visible (…)", failure-shaped ones keep their FAILED head
 *   and say the failure may belong to a later stage. `&&` is the one boundary
 *   that preserves the call's own failure and leaves the sentence unqualified.
 */

// Code-unit slice that never splits a surrogate pair (F-131) — keep in sync
// with doc-lib.mjs codePointSlice, the reference copy (see the header note for
// why this is a copy, not an import).
const codePointSlice = (s, start, end) =>
  String(s)
    .slice(start, end)
    .replace(/^[\uDC00-\uDFFF]/, "")
    .replace(/[\uD800-\uDBFF]$/, "");

// Printable-ASCII clamp for untrusted values (AGENTS.md design tenet 4) —
// collapses whitespace so a hostile value can't smuggle line breaks into a
// journal entry or approval prompt. Same behavior as the guard hook's copy
// (the hook keeps its own so its PreToolUse path imports nothing).
export const printable = (v, cap) =>
  String(v).replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim().slice(0, cap);

// One-line clamp that KEEPS non-ASCII letters (F-132) — for values whose
// fidelity matters in the durable record and that never reach an approval
// prompt: the OS-reported operator name (an accented username must not be
// blanked out of its own attribution line) and the change-request asset lines
// (whose documented format itself contains an em dash). Still unforgeable:
// control characters and the ENTIRE format category are stripped (F-145 —
// the Cf property class under the u flag, so the sweep covers what the
// hand-listed ranges missed: ALM U+061C, word joiner + invisible operators
// U+2060..U+2064, soft hyphen U+00AD, U+180E, interlinear annotation
// U+FFF9..U+FFFB, and the astral plane-14 tag block, unreachable without the
// u flag; a U+202E override could visually rewrite a journal line). ZWJ was
// already stripped before F-145, so emoji-ZWJ sequences were never preserved
// and the widening regresses nothing. Whitespace collapses so a value can
// never smuggle a line break, and the cap never splits a surrogate pair.
// printable() above remains the clamp for manifest-derived values — this is
// deliberately NOT a replacement for it.
export const oneLine = (v, cap) =>
  codePointSlice(
    String(v)
      .replace(/[\u0000-\u001F\u007F-\u009F\uFEFF]|\p{Cf}/gu, " ")
      .replace(/\s+/g, " ")
      .trim(),
    0,
    cap
  );
// One journal entry, both writers (GP-B5 DS-15) — the T-4 FRAME lives here:
// heading (with the "no-ticket" substitution), the kind/operator opening
// bullets, the writer's ordered field lines, the kb-snapshot terminator, and
// the blank-line entry separator. Writer CONTENT policy (what each field
// says — redaction, outcome wording, per-writer clamps) stays at the
// writers; FORMAT INTEGRITY is frame policy and lives here:
//   - EVERY scalar slot is oneLine-clamped at the frame (F-288 — before it,
//     only operator and kbSnapshot were, so the four heading slots could
//     forge a second `## ` heading; the protection against a hostile
//     workspace-catalog value was a coincidence of the callers' field lists,
//     not construction). oneLine, NOT printable (F-132): the OS username
//     lands only in this durable record, and an accented name must survive
//     its own attribution line — never "consolidate" this to printable;
//     controls/bidi/format chars are still stripped (F-145), so an embedded
//     newline (e.g. a hostile tenant DIRECTORY name reaching the guard's
//     kbRef sentence) cannot forge an entry heading — journal-ops' --asset
//     forgery pin's class, closed at the frame for every slot.
//   - every field must be a single-line "- " bullet — single-line means NO
//     ECMAScript LineTerminator, not just no newline (F-293), and field lines
//     get the same control/format-char strip as the scalars — and every
//     scalar slot a non-empty string BEFORE and AFTER the clamp: a mis-keyed
//     options bag fails LOUD (A-4) instead of landing "- kind: undefined" in
//     an append-only tenant journal, and a value that is ONLY invisibles
//     clamps to empty and must fail the same way, never land a blank heading
//     segment (the guard degrades a throw to its journaling alert PER ENTRY
//     (F-291) — one malformed hit never costs the invocation's other
//     entries; journal.mjs fails the verb (F-292)).
// Format changes here are format changes to a durable user file — the T-4
// conformance section pins every line, so they must be deliberate and loud.
export function composeJournalEntry({ ts, area, ticket, kind, operator, fields, kbSnapshot }) {
  const c = {};
  for (const [name, v, cap] of [["ts", ts, 80], ["area", area, 80], ["ticket", ticket, 80], ["kind", kind, 80], ["operator", operator, 80], ["kbSnapshot", kbSnapshot, 500]]) {
    if (typeof v !== "string" || v === "") throw new Error(`composeJournalEntry: missing or empty ${name}`);
    c[name] = oneLine(v, cap);
    if (c[name] === "") throw new Error(`composeJournalEntry: ${name} is empty after the one-line clamp`);
  }
  const cleanFields = [];
  for (const f of fields) {
    // Every ECMAScript LineTerminator, not just \n (F-293): a lone \r is a
    // line ending to CommonMark and to /^## /m alike, so a field carrying one
    // could forge an entry heading the \n-only test waved through.
    if (typeof f !== "string" || !f.startsWith("- ") || /[\n\r\u2028\u2029]/.test(f)) {
      throw new Error(`composeJournalEntry: field is not a single-line "- " bullet: ${String(f).slice(0, 60)}`);
    }
    // Control/format chars stripped from field lines at the frame (F-293) —
    // the scalars' F-145 class: a caller interpolating an unclamped untrusted
    // value must not land a U+202E visual rewrite in the entry body. Stripping
    // (not throwing) mirrors oneLine; the LineTerminator rejection above stays
    // LOUD because a terminator is forgery-capable, not just cosmetic.
    cleanFields.push(f.replace(/[\u0000-\u001F\u007F-\u009F\uFEFF]|\p{Cf}/gu, " "));
  }
  return [
    `## ${c.ts} · ${c.area} · ${c.ticket === "none" ? "no-ticket" : c.ticket}`,
    "",
    `- kind: ${c.kind}`,
    `- operator: ${c.operator}`,
    ...cleanFields,
    `- kb-snapshot: ${c.kbSnapshot}`,
    "",
  ].join("\n");
}

// File header written when a journal is created. `slug` is the tenant slug,
// or null for the workspace-level unattributed catch-all
// (.gs-superadmin/JOURNAL-unattributed.md), which carries an extra paragraph.
// The slug is a tenant DIRECTORY name — the same untrusted input the entry
// clamps guard against — so it gets the same oneLine treatment (F-288): a
// newline-bearing or bidi-carrying directory name must not put a forged line
// or a U+202E visual rewrite into the shipped journal's first line.
export function journalHeader(slug) {
  return (
    `# Change journal — ${slug == null ? "unattributed" : oneLine(slug, 200)}\n\n` +
    "Append-only record of approved change activity on this tenant — entries " +
    "from the gs-superadmin guard hook (one per executed catalog-mutating or " +
    "unknown `gs-admin` command, with its reported outcome; denied commands " +
    "never run, so they never appear) and from executed " +
    "/gs-superadmin:change-request plans. Tenant data: git-ignored by default; " +
    "orgs may privately git-track the workspace for durable history.\n" +
    (slug
      ? ""
      : "\nEntries land here when they cannot be attributed to a single tenant " +
        "(multi-tenant workspace, no active change plan) — move them to the right " +
        "`<slug>/changes/JOURNAL.md` by hand.\n") +
    "\n"
  );
}
