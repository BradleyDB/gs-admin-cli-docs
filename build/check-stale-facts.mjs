#!/usr/bin/env node
// Stale-facts check: hand-maintained markdown may cite the CLI version and
// command/tool counts, and those go silently stale when the documented CLI is
// upgraded (the generated docs self-update; prose doesn't). This scans every
// hand-maintained tracked .md for such citations and fails if one disagrees
// with data/catalog.json meta — the same failure mode as the upstream
// package README's stale "115 tools" claim, caught in CI instead of by a reader.
//
// Version-citation convention (AGENTS.md "Generated vs hand-maintained"):
// `vX.Y.Z` = current-version claim, MUST equal the pin — trips here on every
// upgrade, forcing a re-check. Bare `X.Y.Z` = historical vintage ("observed on
// 1.0.4"), deliberately NOT matched — true as written forever. Don't "fix" the
// v-regex to catch bare forms; the blindness is the design.
//
// Two further checks ride along (decided at the 1.0.6 E2 rider, 2026-07-28):
// - Flag spellings (the F-093 class): a doc token like `--showFields` is a
//   case/hyphen variant of the real `--show-fields` — the payload property
//   name, not the CLI flag. Any `--token` whose hyphen-stripped lowercase form
//   matches a real catalog flag but whose literal spelling is not itself one
//   fails. Unknown tokens that match nothing are IGNORED (the plugin's own
//   script flags, other tools' flags); dev/ files are excluded — the bus and
//   archive legitimately quote bad spellings when recording findings.
// - Semantics basis (the F-094 class): relationships-build.mjs pins
//   SEMANTICS_BASIS, the verification statement its generated maps emit. It
//   must cite the pinned CLI version, so every adoption forces the semantics
//   re-verification (and the one-line update) instead of going silently stale.
//
// Zero dependencies: Node built-ins only. Runs in .github/workflows/docs-drift.yml.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, readJsonFile, assertScanCoverage } from "./lib.mjs";
import { DOCTRINE_FROM, REGISTERED_CLASS_KEYS, CLASS_KEY_RE } from "./defect-classes.mjs";

const catalog = readJsonFile(join(ROOT, "data", "catalog.json"));
const meta = catalog.meta;

// Generated .md files self-update on rebuild.
const EXCLUDE = [/^reference\/domains\//, /^plugins\/gs-superadmin\/reference\//];

// Frozen record — exempt from the CITATION checks only (F-103). dev/FEEDBACK-archive.md
// is append-only historical evidence whose own header promises "Text is verbatim; never
// edit archived sections". It cannot contain a current-pin claim by construction: every
// version and count in it is a record of what was true, quoted, or printed at the time.
// So scanning it can only ever force edits to text declared non-editable — which is
// exactly what happened twice: the 1.0.6 adoption demoted its version literals and
// paraphrased three count phrases, and the 1.0.7 one (F-103) silently rewrote four
// verbatim quotations, leaving one certifying that a `v`-anchored pattern matched a
// literal it could no longer match. Excluding it removes that recurring falsification
// pressure at the source.
// The LIVE bus (dev/FEEDBACK.md) deliberately stays in scope: it carries forward-looking
// claims that later sessions act on, so a stale current-pin citation there is a real
// hazard. Precedent for the split: FLAG_EXCLUDE below already exempts all of dev/ from
// the flag-spelling check for the same "the record legitimately quotes the wrong thing"
// reason. Keep this list minimal — an entry here is a blind spot, justified only by the
// file being immutable by policy.
const CITATION_EXCLUDE = [/^dev\/FEEDBACK-archive\.md$/];

// Code contexts on the LIVE bus (F-275): dev/FEEDBACK.md increasingly carries
// VERBATIM QUOTATIONS of rendered output — prompt text, journal action lines —
// that legitimately contain historical `vX.Y.Z` literals. Flagging those forces
// edits to text the bus rules declare non-editable (the same falsification
// pressure the archive exclusion above removes), three times in the 1.0.8 arc
// alone. The exempt notation on the bus is INDENTED literal lines (tab or 4+
// spaces) ONLY — line-local by design (F-328 round 3): fenced blocks are NOT
// the bus's quoting convention and a line-leading fence delimiter there is
// refused outright, because a prose line wrapping onto leading backticks is
// syntactically indistinguishable from a fence, and any stateful fence
// parser lets one such line silently exempt or expose an unbounded span.
// Prose on the bus stays fully in scope (forward-looking claims there are a
// real hazard), every other file has no exemption at all, and the archive's
// blanket exclusion is untouched. Convention this encodes: quote rendered
// output as a 4-space-indented block; spell versions bare in bus prose.
const CODE_CONTEXT_EXEMPT = [/^dev\/FEEDBACK\.md$/];

// pattern → which meta value the captured number/version must equal
const CHECKS = [
  { re: /(\d+)\s+CLI commands/g, expect: String(meta.counts.totalCliCommands), what: "total CLI commands" },
  { re: /(\d+)\s+MCP tools/g, expect: String(meta.counts.mcpTools), what: "MCP tools" },
  { re: /(\d+)\s+named operations/g, expect: String(meta.counts.mcpTools), what: "MCP tools" },
  { re: /(\d+)\s+defined tools/g, expect: String(meta.counts.mcpTools), what: "MCP tools" },
  { re: /\bv(\d+\.\d+\.\d+)\b/g, expect: meta.cliVersion, what: "pinned CLI version" },
  { re: /@gainsight\/gs-admin-cli@(\d+\.\d+\.\d+)/g, expect: meta.cliVersion, what: "pinned CLI version" },
  // The Gainsight currency notice (going-public GP-17, 2026-09-04): its "last
  // updated on <date>" is the day the pinned catalog was generated — the date the
  // repo last looked at the then-current CLI package — so it moves only on a CLI
  // adoption, never by hand. Rebuilds at the pinned version restore the committed
  // timestamp, so the date is stable between adoptions.
  { re: /last updated on (\d{4}-\d{2}-\d{2})/g, expect: String(meta.generatedAt ?? "").slice(0, 10), what: "catalog generation date (meta.generatedAt)" },
];

// Coverage floor (F-101): build/lib.mjs's assertScanCoverage — one copy for both
// markdown-scanning checks (GP-B5 W10).

// execFileSync, not execSync: an unquoted `*.md` through a POSIX shell is
// glob-expanded against the repo ROOT before git ever sees it, silently
// shrinking the scan to the six top-level .md files (F-095 — this was the
// state of every Linux CI run until the 0.26.0 gate). No shell, no expansion.
const trackedMd = execFileSync("git", ["ls-files", "-z", "--", "*.md"], { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
assertScanCoverage(trackedMd);
const files = trackedMd.filter((f) => !EXCLUDE.some((re) => re.test(f)));

// Real CLI flag spellings, from the catalog (per-command flags + global flags;
// the `<value>` placeholder on some spellings is not part of the token).
const validFlags = new Set();
for (const cmd of catalog.commands ?? []) {
  for (const f of cmd.flags ?? []) if (f.flag) validFlags.add(String(f.flag).split(/\s/)[0]);
}
for (const gf of catalog.globalFlags ?? []) {
  if (gf.flag) validFlags.add(String(gf.flag).split(/\s/)[0]);
}
const normFlag = (t) => t.replace(/-/g, "").toLowerCase();
const normToFlag = new Map(); // normalized form → canonical catalog spelling
for (const f of validFlags) normToFlag.set(normFlag(f), f);
// Boundary-anchored (F-096): without the lookarounds, `<!--json-->` yields the
// token `--json--`, whose stripped form lands on the real `--json` and hard-fails
// a legitimate HTML comment; `text--limit` would trip the same way. The token
// must start at a non-word/non-hyphen boundary and end before one.
const FLAG_TOKEN_RE = /(?<![-\w])--[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*(?![-\w])/g;
const FLAG_EXCLUDE = [/^dev\//];

// The two bus regexes (declared once, module scope — the handoff-conventions
// block below reads BUS_INDENT_RE too; their boundary census and sweep ledger
// are the comment at their use site in the loop).
const BUS_FENCE_DELIM_RE = /^ {0,3}(`{3,}|~{3,})/;
const BUS_INDENT_RE = /^(\t| {4})/;

let failures = 0;
let citationChecked = 0;
for (const file of files) {
  const skipFlags = FLAG_EXCLUDE.some((re) => re.test(file));
  const skipCitations = CITATION_EXCLUDE.some((re) => re.test(file));
  const codeContextExempt = CODE_CONTEXT_EXEMPT.some((re) => re.test(file));
  if (!skipCitations) citationChecked++;
  // \r?\n split: the delimiter-refusal test below runs per line, and a
  // trailing CR from a CRLF-saved WORKING-TREE file (gitattributes normalizes
  // commits, not editor saves; this checker runs in the pre-push hook) must
  // not change what any line-local test sees.
  const lines = readFileSync(join(ROOT, file), "utf8").split(/\r?\n/);
  // Bus code-context exemption (F-275/F-328 — dev/FEEDBACK.md ONLY), the
  // round-3 REDESIGN: line-local and stateless, no fence parsing at all.
  //
  // Three prior rounds tried to keep a stateful fence parser honest here
  // (parity toggle → CommonMark pairing + EOF tripwire → predecessor rule +
  // span report), and each left a residue, because "is this line-leading
  // delimiter a quote fence or a wrapped prose line?" is not decidable from
  // syntax on a file whose prose legitimately TALKS ABOUT fences — and any
  // stateful model lets one misread line corrupt the classification of an
  // unbounded span. The model was wrong, not the tuning (A-9).
  //
  // The convention that replaces it (measured before adopting: the whole
  // ~9,000-line bus quoted with fences exactly twice; everything else already
  // used indentation): quoted output on the bus is an INDENTED literal — a
  // tab or 4+ spaces. Indentation is line-local: an indented line is exempt,
  // nothing else changes state, and no line can affect the classification of
  // any other line. Fenced code blocks are simply NOT the bus's quoting
  // convention: a {0,3}-indent line-leading run of 3+ backticks or tildes is
  // REFUSED loudly at its own line — which is also exactly what a prose line
  // wrapping onto leading fence characters looks like, so every phantom
  // shape from the F-328 arc (wrapped line, mid-file, run-to-EOF) dies as
  // the same line-local failure. A 4+-space-indented delimiter is an
  // indented literal like any other (that is how quoted output that itself
  // CONTAINS fences is carried). Residual: a prose line that genuinely
  // starts with 4 spaces would be exempt — wraps never insert leading
  // whitespace, and the blast radius is that ONE line, never a span.
  // Every other file keeps no exemption at all; the archive stays under its
  // blanket CITATION_EXCLUDE above.
  // Sweep ledger (one deliberately-unpinned mutant class): reverting the
  // \r?\n split above to a bare \n split is EQUIVALENT by construction — no
  // end-anchored test remains in this model, so a retained trailing CR
  // changes nothing. Anything else that survives a sweep is a finding.
  // Boundary census (F-335 sibling sweep): every quantifier bound and
  // character arm in the two regexes below is pinned at its boundary in
  // test-check-stale-facts — the fence rule's {0,3} indent by a fixture AT
  // 3 spaces (case 5), its {3,} run minimums and tilde arm by the refusal
  // cases, and the indent-literal tab / {4} arms by cases 2, 3, and 7. An
  // edit to either regex extends those arms in the same change.
  lines.forEach((line, i) => {
    let inCodeContext = false;
    if (codeContextExempt) {
      if (BUS_FENCE_DELIM_RE.test(line)) {
        failures++;
        console.error(
          `${file}:${i + 1}: line-leading fence delimiter — fenced blocks are not the bus's quoting ` +
            `convention (F-328: a wrapped prose line is indistinguishable from a fence, and stateful ` +
            `parsing let one such line silently exempt or expose whole spans). Quote output as a ` +
            `4-space-indented block instead; if this is prose that wrapped onto backticks, reword it.`,
        );
      } else if (BUS_INDENT_RE.test(line)) {
        inCodeContext = true;
      }
    }
    if (!skipCitations && !inCodeContext) {
      for (const { re, expect, what } of CHECKS) {
        for (const m of line.matchAll(re)) {
          if (m[1] !== expect) {
            failures++;
            console.error(`${file}:${i + 1}: says ${m[0]} but ${what} is ${expect} (catalog meta, CLI v${meta.cliVersion})`);
          }
        }
      }
    }
    if (skipFlags) return;
    for (const m of line.matchAll(FLAG_TOKEN_RE)) {
      const token = m[0];
      if (validFlags.has(token)) continue;
      const canonical = normToFlag.get(normFlag(token));
      if (canonical) {
        failures++;
        console.error(`${file}:${i + 1}: says \`${token}\` but the CLI flag is spelled \`${canonical}\` (catalog)`);
      }
    }
  });
}

// ── Bus handoff conventions (GP-B5 W10 / B14 — "verification must be able to
// surprise", rule of record AGENTS.md § Review-gate rules) ──────────────────
// Two of the four rules are STRUCTURE the live bus carries, refused here so
// the property survives deleting its prose (the deletion test):
//   1. Blind spots — the handoff writes `Blind spots (<token>): …` as the next
//      non-empty line after the ONE Under test line: what this round's
//      verification could NOT see. Keyed by the token, so a fresh token with a
//      stale line is red by construction (the re-stamp teeth); a second Under
//      test line is refused (re-stamp in place, never append — W10 review). No
//      token on the Under test line → nothing owed.
//   2. Prediction-first copy-outs — in every `## F-` section numbered
//      DOCTRINE_FROM or higher, an INDENTED row (BUS_INDENT_RE — the copy-out
//      convention) recording KILLED or SURVIVED carries pred:KILL or
//      pred:SURVIVE, written before the run (MISMATCH where they differ).
//      Prose mentions are not rows, and a VERBATIM QUOTE of an older table is
//      not a row either: an indented run whose nearest preceding unindented
//      line says "quoted verbatim" is exempt (a quoted record is never edited
//      to satisfy a gate — the F-275/F-328 rule, W10 review). The timing is an
//      obligation this check cannot see; the column is what it refuses.
//   3. Class join key — a `Class: <key>` line (the key alone, the registry's
//      own grammar) names a class registered in build/defect-classes.mjs; a
//      malformed line, a typo or an unregistered class is refused (naming a
//      class in prose only is how F-323's sibling waited for F-328). The same
//      key rule runs over dev/FEEDBACK-archive.md's sections from DOCTRINE_FROM
//      too — archived text is frozen, so the remedy is always on the registry
//      side (keys are append-only there).
//   4. Sibling sweep — a FIXED or VERIFIED section carrying `Class:` carries a
//      non-empty `Sibling sweep:` line (the check-19 pass line for a
//      mechanical class; the recipe's copy-out or "batched — <reason>" for a
//      manual one). Sections below DOCTRINE_FROM predate the grammar.
// Section-scoped by `## F-` headings (a partition no wrapped prose line can
// forge — unlike a fence delimiter, F-328); everything else is line-local.
const BUS_FILE = "dev/FEEDBACK.md";
const HANDOFF_TOKEN_RE = /hb-\d{8}-\d{2}/;
const SECTION_RE = /^## F-(\d+)\s*[—–-]+\s*([A-Z]+)/;
const VERDICT_RE = /\b(KILLED|SURVIVED)\b/;
// The Class: line = the registry's key grammar and nothing after it — DERIVED
// from CLASS_KEY_RE, never re-spelled (F-378: two hand copies matched while
// the error message advertised the export).
const CLASS_LINE_RE = new RegExp("^Class:\\s*(" + CLASS_KEY_RE.source.replace(/^\^|\$$/g, "") + ")\\s*$");
const PRED_RE = /\bpred:(KILL|SURVIVE)\b/;
let busConventions = "no live bus in this tree";
if (files.includes(BUS_FILE)) {
  const busLines = readFileSync(join(ROOT, BUS_FILE), "utf8").split(/\r?\n/);
  const utLines = busLines.map((l, i) => (/^Under test:/.test(l) ? i : -1)).filter((i) => i !== -1);
  if (utLines.length > 1) {
    failures++;
    console.error(
      `${BUS_FILE}:${utLines[1] + 1}: a second "Under test:" line — the handoff re-stamps the ONE line in place, never appends ` +
        `(the Blind spots rule keys on it; two lines would let a stale token pass for a fresh one)`,
    );
  }
  const utIdx = utLines[0] ?? -1;
  const token = utIdx === -1 ? null : (HANDOFF_TOKEN_RE.exec(busLines[utIdx])?.[0] ?? null);
  let blindSpots = "no handoff token on the Under test line, no Blind spots line owed";
  if (token) {
    const bsRe = new RegExp("^Blind spots \\(" + token + "\\):\\s*\\S");
    // the next non-empty line after Under test — "directly under", as the rule of record says
    let next = utIdx + 1;
    while (next < busLines.length && busLines[next].trim() === "") next++;
    if (next < busLines.length && bsRe.test(busLines[next])) blindSpots = `Blind spots line present for ${token}`;
    else {
      failures++;
      console.error(
        `${BUS_FILE}:${utIdx + 1}: Under test names ${token} but the next line is not a non-empty "Blind spots (${token}):" ` +
          `line — every handoff declares, directly under Under test, what its verification could NOT see (frames not used, ` +
          `measurements skipped with the argument, or "none — <reason>"); a line for an earlier token, or one elsewhere in ` +
          `the header, does not count (W10, AGENTS.md § Review-gate rules)`,
      );
    }
  }
  // 5. The Under test line itself (F-439): a bus that declares a `Canary:`
  //    location carries exactly ONE Under test line, and the canary at that
  //    location names the same handoff — the comparison every tester round's
  //    provenance rests on has to have something to read. The Blind spots rule
  //    above anchors on the line; nothing read the line, so a hand edit could
  //    replace it and every gate stayed green.
  const canaryDecl = busLines.find((l) => /^Canary:\s*\S+\s+description\s*$/.test(l));
  let underTestLine = "no Canary: declaration, no Under test line owed";
  // A bus on the loop (a `Profile:` line) declares its canary location; a
  // deleted `Canary:` line would otherwise make every rule below unowed (the
  // MEDIUM review of 0.37.0 — the weaker half of F-439's hole).
  if (!canaryDecl && busLines.some((l) => /^Profile:\s*\S/.test(l))) {
    failures++;
    console.error(`${BUS_FILE}: a "Profile:" header with no "Canary: <path> description" line — the canary location is part of the profile the handoff writes (F-439)`);
  }
  if (canaryDecl) {
    const canaryPath = canaryDecl.replace(/^Canary:\s*/, "").replace(/\s+description\s*$/, "");
    if (utLines.length === 0) {
      failures++;
      console.error(
        `${BUS_FILE}: no "Under test:" line — the header declares a Canary: location, so the tester's provenance ` +
          `comparison (the canary's token against the Under test token) has nothing to read; the handoff writes that ` +
          `line and a hand edit must never replace it (F-439)`,
      );
    } else {
      // Compared whether or not the bus line carries a token (the MEDIUM
      // review of 0.37.0): a hand edit that replaced the line with the
      // "(not yet handed off)" form beside a stamped canary used to pass, since
      // the whole comparison sat under "if there is a token".
      // The description is read from the FRONTMATTER block only (between the
      // first two `---` lines), never from the skill body — the same block
      // check-doc-drift reads.
      // A BOM-prefixed canary has no frontmatter to this reader and fails as
      // "carries no stamp" \u2014 the closed direction; the handoff writes the file
      // without one (the BOM-strip primitive is lib.mjs's, for JSON only).
      let desc = null;
      try {
        const src = readFileSync(join(ROOT, canaryPath), "utf8");
        const end = src.startsWith("---") ? src.indexOf("\n---", 3) : -1;
        desc = end < 0 ? null : (/^description:\s*(.*)$/m.exec(src.slice(0, end))?.[1] ?? null);
      } catch { desc = null; }
      const utText = busLines[utIdx].replace(/^Under test:\s*/, "").trim();
      // The canary's stamp is READ as the one field the template carries —
      // `under test <branch> · <token> · <date>.` — and compared whole (F-444: a
      // substring test let a description carrying a stale stamp beside the
      // fresh one, or the fresh one inside longer text, pass as a match).
      const stamp = desc === null ? null : (/\bunder test (.+?)\.(?:\s|$)/.exec(desc)?.[1] ?? null);
      if (desc === null) {
        failures++;
        console.error(`${BUS_FILE}:${utIdx + 1}: Under test names ${token} but the canary declared at ${canaryPath} is unreadable — the two are written by one handoff commit (F-439)`);
      } else if (stamp !== utText) {
        failures++;
        console.error(
          `${BUS_FILE}:${utIdx + 1}: Under test reads "${utText}" but the canary at ${canaryPath} ` +
            (stamp === null ? `carries no "under test <branch> · <token> · <date>." stamp (description: "${desc.slice(0, 140)}")` : `is stamped "${stamp}"`) +
            ` — the two are written by one handoff commit and name the same branch · token · date, compared whole; a stale ` +
            `or hand-edited line here is a provenance the tester cannot check (F-439, F-444)`,
        );
      } else underTestLine = `Under test line matches the canary at ${canaryPath}`;
    }
  }
  let sectionsChecked = 0;
  // Rules 4 and 5 (F-436's arc, 2026-09-08): a fixer cannot judge the fixer's
  // completeness — every reopen in that arc came from an external judge — so a
  // FIXED section of a registered class names its JUDGE (an oracle, a
  // differential, the shell itself; never the fixer's own list), and a section
  // REOPENED twice is not FIXED again without a REDESIGN line naming the model
  // replaced (the second tune of one boundary is the wrong model). From
  // JUDGE_FROM on: the sections before it were closed under the older grammar.
  const JUDGE_FROM = 436;
  /** @type {{num: number, status: string, line: number, classKey: string | null, hasSweep: boolean, hasJudge: boolean, hasRedesign: boolean, reopens: number, quoted: boolean} | null} */
  let cur = null;
  const closeSection = () => {
    if (!cur || cur.num < DOCTRINE_FROM) return;
    sectionsChecked++;
    if (cur.num >= JUDGE_FROM && cur.classKey && /^(FIXED|VERIFIED)$/.test(cur.status) && !cur.hasJudge) {
      failures++;
      console.error(
        `${BUS_FILE}:${cur.line + 1}: F-${cur.num} is ${cur.status} and names Class: ${cur.classKey} but its note carries no ` +
          `"Judge:" line — name what decides the fix's correctness INDEPENDENTLY of the fixer's own list (an oracle, a ` +
          `differential against the real shell or tool, the tester's live arm named as the judge); the fixer's enumeration ` +
          `is not a judge (bus rule 4, the F-436 arc)`,
      );
    }
    if (cur.num >= JUDGE_FROM && cur.reopens >= 2 && /^(FIXED|VERIFIED)$/.test(cur.status) && !cur.hasRedesign) {
      failures++;
      console.error(
        `${BUS_FILE}:${cur.line + 1}: F-${cur.num} was reopened ${cur.reopens} times (verdict lines saying REOPENED or "back to OPEN") ` +
          `and is ${cur.status} without a "Redesign:" line — a second reopen of one section means the model is wrong, not the ` +
          `boundary: name the model replaced, never tune it a third time (bus rule 5, the F-436 arc)`,
      );
    }
    if (cur.classKey && /^(FIXED|VERIFIED)$/.test(cur.status) && !cur.hasSweep) {
      failures++;
      console.error(
        `${BUS_FILE}:${cur.line + 1}: F-${cur.num} is ${cur.status} and names Class: ${cur.classKey} but its note carries no ` +
          `"Sibling sweep:" line — a fix of a registered class sweeps the tree for siblings in the same round: paste the ` +
          `check-19 pass line (mechanical class) or the recipe's copy-out with its cost, or "batched — <reason>" on a ` +
          `polish finding (W10)`,
      );
    }
  };
  busLines.forEach((line, i) => {
    const h = SECTION_RE.exec(line);
    if (h) {
      closeSection();
      cur = { num: Number(h[1]), status: h[2], line: i, classKey: null, hasSweep: false, hasJudge: false, hasRedesign: false, reopens: 0, quoted: false };
      return;
    }
    if (!cur || cur.num < DOCTRINE_FROM) return;
    // An unindented line re-decides the quote state for the indented run that
    // follows it: "quoted verbatim" marks a copied record (never edited for a
    // gate); anything else marks the section's own copy-outs.
    if (!BUS_INDENT_RE.test(line) && line.trim() !== "") cur.quoted = /quoted verbatim/i.test(line);
    if (/^Class:/.test(line)) {
      const c = CLASS_LINE_RE.exec(line);
      if (!c) {
        failures++;
        console.error(`${BUS_FILE}:${i + 1}: malformed Class: line — the key alone (${CLASS_KEY_RE.source}), nothing after it; notes go on their own line`);
        return;
      }
      if (cur.classKey === null) cur.classKey = c[1]; // the first Class: line is the section's
      if (!REGISTERED_CLASS_KEYS.has(c[1])) {
        failures++;
        console.error(
          `${BUS_FILE}:${i + 1}: Class: ${c[1]} is not a registered defect class — keys: ${[...REGISTERED_CLASS_KEYS].join(", ")} ` +
            `(build/defect-classes.mjs; register a mechanical row or a Review-gate bullet before naming a new class)`,
        );
      }
      return;
    }
    if (/^Sibling sweep:\s*\S/.test(line)) {
      cur.hasSweep = true;
      return;
    }
    if (/^Judge:\s*\S/.test(line)) { cur.hasJudge = true; return; }
    if (/^Redesign:\s*\S/.test(line)) { cur.hasRedesign = true; return; }
    // A reopen is the tester's verdict line saying REOPENED or "back to OPEN"
    // — the vocabulary the bus header declares (F-444: one wording was the
    // only signal, and a verdict saying "back to OPEN" counted for nothing).
    // Counting the section's Fix notes instead was considered and rejected by
    // the MEDIUM review: a fix landed in three separately-noted parts would
    // demand a Redesign line asserting a redesign that never happened.
    if (/^Verdict:.*(\bREOPENED\b|\bback to OPEN\b)/.test(line)) { cur.reopens++; return; }
    if (BUS_INDENT_RE.test(line) && VERDICT_RE.test(line) && !PRED_RE.test(line) && !cur.quoted) {
      failures++;
      console.error(
        `${BUS_FILE}:${i + 1}: a mutation copy-out row records KILLED/SURVIVED with no pred:KILL / pred:SURVIVE token — ` +
          `predictions are written BEFORE the run and copied out beside the measurement (mark a disagreement MISMATCH); ` +
          `build/sweep-fence-grammar.mjs prints them (W10 rule 2)`,
      );
    }
  });
  closeSection();
  busConventions = `${blindSpots}; ${underTestLine}; ${sectionsChecked} section(s) from F-${DOCTRINE_FROM} checked for pred: rows, Class: keys and Sibling sweep lines (Judge: and Redesign: lines from F-${JUDGE_FROM})`;
}
// The archive is frozen text (never edited to satisfy a gate), so only the
// KEY-REGISTRATION half runs over it, and only from DOCTRINE_FROM (the three
// legacy free-text Class: lines at F-288..F-290 predate the grammar): a key
// that stops being registered after its instances were archived points at the
// REGISTRY as the thing to fix — keys are append-only there.
const ARCHIVE_FILE = "dev/FEEDBACK-archive.md";
let archiveKeys = 0;
if (files.includes(ARCHIVE_FILE)) {
  let num = 0;
  readFileSync(join(ROOT, ARCHIVE_FILE), "utf8").split(/\r?\n/).forEach((line, i) => {
    const h = SECTION_RE.exec(line);
    if (h) { num = Number(h[1]); return; }
    if (num < DOCTRINE_FROM) return;
    const c = CLASS_LINE_RE.exec(line);
    if (!c) return;
    archiveKeys++;
    if (!REGISTERED_CLASS_KEYS.has(c[1])) {
      failures++;
      console.error(
        `${ARCHIVE_FILE}:${i + 1}: archived Class: ${c[1]} is no longer a registered defect class — keys are append-only in ` +
          `build/defect-classes.mjs (re-register it, with a retired note if superseded); archived text is never edited`,
      );
    }
  });
}

// SEMANTICS_BASIS (F-094): the verification statement relationships-build.mjs
// emits into generated maps must cite the pinned CLI version.
const RB = join(ROOT, "plugins", "gs-superadmin", "scripts", "relationships-build.mjs");
const rbSrc = readFileSync(RB, "utf8");
// Line-start anchor so a commented-out `// const SEMANTICS_BASIS = …` cannot
// shadow the live declaration; quote/space tolerant (F-096).
const basisMatch = rbSrc.match(/^const SEMANTICS_BASIS\s*=\s*["'`]([^"'`]*)["'`]/m);
// Version must appear as a whole token — a substring test would let `1.0.61`
// satisfy a `1.0.6` pin (F-096).
const versionToken = new RegExp(`(^|[^0-9.])${meta.cliVersion.replace(/\./g, "\\.")}($|[^0-9])`);
if (!basisMatch) {
  failures++;
  console.error(`${RB}: SEMANTICS_BASIS constant not found — the semantics-basis check needs it (F-094)`);
} else if (!versionToken.test(basisMatch[1])) {
  failures++;
  console.error(
    `plugins/gs-superadmin/scripts/relationships-build.mjs: SEMANTICS_BASIS ("${basisMatch[1]}") does not cite the pinned CLI version ${meta.cliVersion} — re-verify the _flatMappings/mapper semantics on ${meta.cliVersion} and update the constant (one line covers every emitted site)`,
  );
}

// NON-MD FACT CARRIERS (F-280): the 1.0.8 override retirement moved load-bearing
// derivable counts into .json/.mjs comments the citation scan (md-only, by
// design) never sees. Recompute each from the catalog and pin the carrier's
// phrasing, so the next adoption trips here instead of shipping stale
// arithmetic. Same shape as SEMANTICS_BASIS: a pattern that no longer matches
// is itself a failure — silently unmatched prose is how these went invisible.
const strictWriters = (catalog.commands ?? []).filter(
  (c) => !c.mutating && (c.endpoints ?? []).some((e) => /^(PUT|DELETE|PATCH)$/i.test(e.method)),
).length;
const postReads = (catalog.commands ?? []).filter(
  (c) => !c.mutating && (c.endpoints ?? []).some((e) => /^POST$/i.test(e.method)),
).length;
const FACT_CARRIERS = [
  {
    file: "plugins/gs-superadmin/hooks/ask-overrides.json",
    facts: [
      { re: /from 29 to (\d+)/, expect: strictWriters, what: "strict mislabeled writers (non-mutating + PUT/DELETE/PATCH)" },
      { re: /with the (\d+) remaining/, expect: postReads, what: "non-mutating commands with a POST endpoint" },
    ],
  },
  {
    // The counting-rule sentence AND the shared read-verb allowlist (with its
    // audit stamp) moved with the gate rationale into doc-lib (B5 W4/DS-17
    // hoist + review round) — carrier entries follow the facts' home.
    file: "plugins/gs-superadmin/scripts/doc-lib.mjs",
    facts: [
      { re: /went 29 → (\d+)/, expect: strictWriters, what: "strict mislabeled writers (non-mutating + PUT/DELETE/PATCH)" },
      { re: /59 → (\d+)/, expect: postReads, what: "non-mutating commands with a POST endpoint" },
      // The read-verb allowlist is re-audited by hand at each adoption; pinning
      // the audit note's version stamp forces that re-audit when the pin moves.
      { re: /read actions in the v(\d+\.\d+\.\d+) catalog/, expect: meta.cliVersion, what: "read-verb allowlist audit version" },
    ],
  },
];
for (const { file, facts } of FACT_CARRIERS) {
  const src = readFileSync(join(ROOT, file), "utf8");
  for (const { re, expect, what } of facts) {
    const m = src.match(re);
    if (!m) {
      failures++;
      console.error(`${file}: expected fact pattern ${re} not found — ${what} is no longer pinned (F-280)`);
    } else if (m[1] !== String(expect)) {
      failures++;
      console.error(`${file}: says "${m[0]}" but ${what} is ${expect} per data/catalog.json (F-280)`);
    }
  }
}

if (failures) {
  console.error(
    `\n${failures} finding(s). Version/count drift: update the doc to match data/catalog.json meta (usually after a CLI upgrade). ` +
      `Flag spellings: use the catalog's kebab-case form the message names. SEMANTICS_BASIS: re-verify the mapper semantics on the pinned CLI, then update the constant. ` +
      `Fact carriers (F-280): recompute the named count from data/catalog.json and update the carrier file's prose.`,
  );
  process.exit(1);
}
console.log(
  `Stale-facts check passed: ${citationChecked} of ${files.length} hand-maintained .md files agree with catalog meta ` +
    `(${files.length - citationChecked} exempt as frozen record), flag spellings match the catalog, SEMANTICS_BASIS cites the pin (CLI v${meta.cliVersion}), ` +
    `and the non-md fact carriers agree with the catalog (F-280); bus handoff conventions (W10): ${busConventions}; ${archiveKeys} archived Class: key(s) registered.`,
);
