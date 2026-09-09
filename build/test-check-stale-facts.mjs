#!/usr/bin/env node
// Fixture tests for build/check-stale-facts.mjs — the citation gate that keeps
// hand-maintained prose in agreement with data/catalog.json meta.
//
// What this pins:
// F-275 — the live bus (dev/FEEDBACK.md) quotes rendered output VERBATIM, and
// those quotes legitimately carry historical vX.Y.Z literals; the exemption
// keeps them out of the citation checks while bus PROSE stays fully checked,
// and no other file gets any exemption at all.
// F-328 (round 3, the REDESIGN) — the exemption is LINE-LOCAL and stateless:
// an indented literal line (tab or 4+ spaces) is exempt, and NOTHING else
// carries state. Fenced blocks are not the bus's quoting convention: a
// {0,3}-indent line-leading run of 3+ backticks or tildes is REFUSED at its
// own line — which is also exactly the wrapped-prose shape that made every
// stateful fence model misclassify unbounded spans across three fix rounds
// (parity toggle, CommonMark pairing + EOF tripwire, predecessor rule). No
// fence state exists any more, so there is nothing a single line can corrupt.
//
// Each case copies the real checker into a scratch git repo under the OS temp
// dir (the checker roots itself at its own script location and scans that
// repo's `git ls-files`), so the checker runs unmodified. The rig satisfies the
// checker's own guards: the MIN_TRACKED_MD coverage floor, a SEMANTICS_BASIS
// stub, and F-280 fact-carrier stubs whose counts derive from the synthetic
// catalog (zero commands → both derived counts are 0). Zero dependencies.

import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { ROOT } from "./lib.mjs";
import { spawnSync, execSync } from "node:child_process";

const CHECKER = join(ROOT, "build", "check-stale-facts.mjs");

// The rig's pin. Bus fixtures cite STALE ("1.2.3") or current ("9.9.9") against it.
const PIN = "9.9.9";
const STALE = "v1.2.3";
// The rig catalog's generation stamp: the currency notice's "last updated on"
// date must equal its date part (GP-17).
const GENERATED_AT = "2029-03-04T05:06:07.000Z";

let passed = 0;
const failures = [];
const ok = (name, cond) => {
  if (cond) passed++;
  else failures.push(name);
};

// files: { relPath: string } written on top of the standing scaffold. Returns
// the spawnSync result of the checker copy run inside a fresh scratch git repo.
function runRig(files) {
  const rig = mkdtempSync(join(tmpdir(), "stale-facts-test-"));
  try {
    mkdirSync(join(rig, "build"));
    copyFileSync(CHECKER, join(rig, "build", "check-stale-facts.mjs"));
    // lib.mjs rides along beside the copied script (DS-16): the script under
    // test imports it, and the copy's own location roots ROOT at the rig.
    copyFileSync(join(ROOT, "build", "lib.mjs"), join(rig, "build", "lib.mjs"));
    // …and the defect-class registry (W10): the checker reads its keys for the
    // bus Class: rule; import-free by contract so this copy can never dangle.
    copyFileSync(join(ROOT, "build", "defect-classes.mjs"), join(rig, "build", "defect-classes.mjs"));
    mkdirSync(join(rig, "data"));
    writeFileSync(
      join(rig, "data", "catalog.json"),
      JSON.stringify({
        meta: { cliVersion: PIN, generatedAt: GENERATED_AT, counts: { totalCliCommands: 188, mcpTools: 182 } },
        commands: [],
        globalFlags: [],
      }),
    );
    // SEMANTICS_BASIS stub (F-094 check) and the F-280 fact carriers, with the
    // counts the empty synthetic catalog derives (0 and 0) and the pin.
    mkdirSync(join(rig, "plugins", "gs-superadmin", "scripts"), { recursive: true });
    mkdirSync(join(rig, "plugins", "gs-superadmin", "hooks"), { recursive: true });
    writeFileSync(
      join(rig, "plugins", "gs-superadmin", "scripts", "relationships-build.mjs"),
      `const SEMANTICS_BASIS = "semantics verified on ${PIN}";\n`,
    );
    writeFileSync(
      join(rig, "plugins", "gs-superadmin", "hooks", "ask-overrides.json"),
      JSON.stringify({ _note: "went from 29 to 0 strict; with the 0 remaining POST reads", overrides: [] }),
    );
    // All three F-280 carriers live in doc-lib since the shared-gate hoist
    // (B5 W4/DS-17 + its review round).
    writeFileSync(
      join(rig, "plugins", "gs-superadmin", "scripts", "doc-lib.mjs"),
      `// strict writers went 29 → 0; POST reads 59 → 0\n// read actions in the v${PIN} catalog audited\n`,
    );
    // Coverage floor (F-101): the checker requires ≥40 tracked .md files with
    // some nested — filler carries no version/count/flag tokens.
    mkdirSync(join(rig, "docs"));
    for (let i = 0; i < 45; i++) writeFileSync(join(rig, "docs", `filler-${i}.md`), "filler prose only\n");
    mkdirSync(join(rig, "dev"), { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(dirname(join(rig, rel)), { recursive: true });
      writeFileSync(join(rig, rel), content);
    }
    execSync("git init -q", { cwd: rig });
    execSync("git -c core.autocrlf=false add -A", { cwd: rig });
    return spawnSync(process.execPath, [join(rig, "build", "check-stale-facts.mjs")], {
      cwd: rig,
      encoding: "utf8",
    });
  } finally {
    rmSync(rig, { recursive: true, force: true });
  }
}

// ── 1. Stale citation in bus PROSE: still fails ──────────────────────────────
{
  const res = runRig({ "dev/FEEDBACK.md": `The pin is ${STALE} and that is a claim.\n` });
  ok("bus prose stale citation fails", res.status === 1);
  ok("bus prose failure names the bus file", res.stderr.includes("dev/FEEDBACK.md"));
  ok("bus prose failure names the version check", res.stderr.includes("pinned CLI version"));
}

// ── 2. Indented literal lines on the bus: exempt (4-space and tab) ───────────
{
  const res = runRig({
    "dev/FEEDBACK.md":
      "Journal line, quoted:\n\n" +
      `    action: re r debug (catalog ${STALE}, mutating)\n` +
      `\tsecond spelling of the same quote (catalog ${STALE})\n`,
  });
  ok("bus indented stale literal passes (4-space and tab)", res.status === 0);
}

// ── 3. The indent boundary is 4: a 3-space-indented line is prose ────────────
{
  const res = runRig({
    "dev/FEEDBACK.md": `   prose claim at ${STALE} with three leading spaces fails.\n`,
  });
  ok("bus 3-space-indented line is still checked prose",
    res.status === 1 && res.stderr.includes(":1:") && res.stderr.includes("pinned CLI version"));
}

// ── 4. Line-local honesty: an indented quote between prose lines exempts ONLY
// itself — the neighbouring prose stays checked at the right line numbers ────
{
  const res = runRig({
    "dev/FEEDBACK.md":
      "Clean prose above.\n" +
      `    quoted output at ${STALE}\n` +
      `prose claim at ${STALE} fails on line 3.\n`,
  });
  ok("indent exemption is line-local: the quote passes, the prose line fails",
    res.status === 1 && res.stderr.includes(":3:") && !res.stderr.includes(":2:"));
}

// ── 5. F-328 round 3: line-leading fence delimiters on the bus are REFUSED ───
// One check per spelling arm; each names its own line. The wrapped-prose
// shape (the arc's live incident) is the same refusal as every other.
{
  const res = runRig({ "dev/FEEDBACK.md": "Some prose.\n\n```\nanything\n```\n" });
  ok("bus refusal: a bare backtick fence line is refused at its line",
    res.status === 1 && res.stderr.includes(":3:") && res.stderr.includes("quoting convention"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "```bash\nnode x.mjs\n```\n" });
  ok("bus refusal: an info-stringed opener is refused too",
    res.status === 1 && res.stderr.includes(":1:") && res.stderr.includes("quoting convention"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "~~~\nanything\n~~~\n" });
  ok("bus refusal: tilde fences are refused too",
    res.status === 1 && res.stderr.includes("quoting convention"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "````\nfour backticks\n````\n" });
  ok("bus refusal: longer delimiter runs are refused (3+ is the floor)",
    res.status === 1 && res.stderr.includes("quoting convention"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "Prose that wrapped onto\n``` a delimiter, by accident\nmore prose.\n" });
  ok("bus refusal: the wrapped-prose shape dies as the same line-local refusal",
    res.status === 1 && res.stderr.includes(":2:") && res.stderr.includes("quoting convention"));
}
{
  // The fixture sits AT the 3-space boundary on purpose (F-335 sibling
  // census): a 2-space fixture let a narrowed {0,2} indent bound ship green —
  // the boundary case kills every narrowing, and the 4-space side is case 7.
  const res = runRig({ "dev/FEEDBACK.md": "Some prose.\n\n   ``` three-space indented\nmore prose.\n" });
  ok("bus refusal: up-to-3-space-indented delimiters are still refused (fixture at the boundary)",
    res.status === 1 && res.stderr.includes(":3:") && res.stderr.includes("quoting convention"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "The refusal cites its finding for the next reader.\n\n```\n" });
  ok("bus refusal: the message cites F-328", res.status === 1 && res.stderr.includes("F-328"));
}

// ── 6. No fence state exists: text AROUND a refused pair is PROSE, checked ───
// The three stateful rounds each let one misread line silently exempt (or
// expose) a span. Now the delimiter lines are refused and everything between
// them is ordinary prose — a stale claim there fails on its own line.
{
  const res = runRig({
    "dev/FEEDBACK.md": "Some prose.\n\n```\n" + `stale claim at ${STALE} inside the would-be span\n` + "```\n",
  });
  ok("no span semantics: a stale literal between refused delimiters still fails itself",
    res.status === 1 && res.stderr.includes(":4:") && res.stderr.includes("pinned CLI version"));
}

// ── 7. A 4+-space-indented delimiter is an indented LITERAL, not a fence ─────
// That is how quoted output which itself contains fences is carried.
{
  const res = runRig({
    "dev/FEEDBACK.md":
      "Quoted doc excerpt that contains a fence, indented like any literal:\n\n" +
      "    ```json\n" +
      `    { "pinned": "${STALE}" }\n` +
      "    ```\n",
  });
  ok("4-space-indented delimiter lines are exempt literals, not refusals", res.status === 0);
}

// ── 8. A 2-character delimiter run is prose (the floor is 3 — pinned per
// alternation branch: the two quantifiers are independent, the F-327 lesson) ─
{
  const res = runRig({ "dev/FEEDBACK.md": "``two backticks lead this line and it is prose\nclean.\n" });
  ok("a 2-backtick line is prose, not refused", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": "~~two tildes lead this line and it is prose\nclean.\n" });
  ok("a 2-tilde line is prose, not refused", res.status === 0);
}

// ── 9. Bus-only, both directions: no other file is exempt OR fence-refused ───
{
  const res = runRig({
    "dev/FEEDBACK.md": "clean bus\n",
    "docs/notes.md": "```\n" + `example pinned at ${STALE}\n` + "```\n",
  });
  ok("non-bus fenced stale literal still fails (no exemption outside the bus)",
    res.status === 1 && res.stderr.includes("docs/notes.md") && res.stderr.includes("pinned CLI version"));
  ok("non-bus fence delimiters are NOT refused (the convention is bus-only)",
    !res.stderr.includes("quoting convention"));
}
{
  const res = runRig({
    "dev/FEEDBACK.md": "clean bus\n",
    "docs/notes.md": `    indented stale literal at ${STALE}\n`,
  });
  ok("non-bus INDENTED stale literal still fails (the indent exemption is bus-only too)",
    res.status === 1 && res.stderr.includes("docs/notes.md"));
}

// ── 10. CRLF working-tree bus: the line-local tests see clean lines ──────────
{
  const res = runRig({
    "dev/FEEDBACK.md": "Quoted:\r\n\r\n" + `    action at ${STALE}\r\n` + "clean prose.\r\n",
  });
  ok("CRLF bus: an indented stale literal is still exempt", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": "Some prose.\r\n\r\n```\r\nx\r\n```\r\n" });
  ok("CRLF bus: fence refusal still fires at its line",
    res.status === 1 && res.stderr.includes(":3:") && res.stderr.includes("quoting convention"));
}

// ── 12. W10 rule 3 — the Blind spots line is keyed to the Under test token ───
// Predictions, written before the first run: (a) a handoff token with no
// Blind spots line → RED at the Under test line, naming the token; (b) a line
// for ANOTHER token → RED (a re-stamped token needs its own line); (c) a
// matching non-empty line → GREEN; (d) a matching but EMPTY line → RED;
// (e) an Under test line with no token ("not yet handed off") → GREEN.
{
  const res = runRig({ "dev/FEEDBACK.md": "Profile: plugin\n\nUnder test: dev · hb-20260904-01 · 2026-09-04\n\nclean prose.\n" });
  ok("W10 blind spots: a handoff token with no Blind spots line fails at the Under test line, naming the token",
    res.status === 1 && res.stderr.includes("dev/FEEDBACK.md:3:") && res.stderr.includes("Blind spots (hb-20260904-01)"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "Under test: dev · hb-20260904-02 · 2026-09-04\nBlind spots (hb-20260904-01): the previous round's line.\n" });
  ok("W10 blind spots: a line for an earlier token does not count (re-stamp teeth)",
    res.status === 1 && res.stderr.includes("Blind spots (hb-20260904-02)"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "Under test: dev · hb-20260904-02 · 2026-09-04\nBlind spots (hb-20260904-02): none — close-out token.\n" });
  ok("W10 blind spots: a matching non-empty line passes", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": "Under test: dev · hb-20260904-02 · 2026-09-04\nBlind spots (hb-20260904-02):   \n" });
  ok("W10 blind spots: a matching but EMPTY line fails", res.status === 1 && res.stderr.includes("Blind spots (hb-20260904-02)"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "Under test: (not yet handed off)\n" });
  ok("W10 blind spots: no token on the Under test line → nothing owed", res.status === 0);
}

// ── 13. W10 rule 2 — pred: tokens on copy-out rows, sections from F-360 ─────
// Predictions: (a) an indented KILLED row with no pred: token in F-360 → RED
// at that line; (b) the same row with pred:KILL → GREEN; (c) the same row in
// F-359 (below DOCTRINE_FROM) → GREEN; (d) an UNINDENTED prose mention of
// KILLED in F-360 → GREEN (prose is not a copy-out row).
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — FIXED\nReported: x\nSeverity: polish\nFix: sweep (source: census)\n    KILLED  M1 closer dropped\n" });
  ok("W10 pred: an indented KILLED row without pred:KILL/SURVIVE fails at its line (F-360+)",
    res.status === 1 && res.stderr.includes("dev/FEEDBACK.md:5:") && res.stderr.includes("pred:KILL"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — FIXED\nReported: x\nSeverity: polish\nFix: sweep (source: census)\n    pred:KILL  KILLED  M1 closer dropped\n    pred:SURVIVE  SURVIVED  M2 equivalent (declared)\n" });
  ok("W10 pred: rows carrying pred:KILL / pred:SURVIVE pass", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-359 — VERIFIED\nReported: x\n    KILLED  M1 closer dropped\n" });
  ok("W10 pred: sections below F-360 predate the grammar and pass", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — FIXED\nReported: x\nThe mutant was KILLED by the arm, as prose says.\n" });
  ok("W10 pred: an unindented prose mention of KILLED is not a copy-out row", res.status === 0);
}

// ── 14. W10 — Class: names a registered key ──────────────────────────────────
// Predictions: (a) Class: bogus-thing in F-360 → RED naming the registered
// keys; (b) Class: reader-shape on an OPEN section → GREEN.
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — OPEN\nReported: x\nSeverity: polish\nClass: bogus-thing\n" });
  ok("W10 class: an unregistered Class: key fails and the message lists the registered keys",
    res.status === 1 && res.stderr.includes("dev/FEEDBACK.md:4:") && res.stderr.includes("bogus-thing") && res.stderr.includes("reader-shape"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — OPEN\nReported: x\nSeverity: polish\nClass: reader-shape\n" });
  ok("W10 class: a registered key on an OPEN section passes", res.status === 0);
}

// ── 15. W10 — a FIXED/VERIFIED section with Class: carries Sibling sweep: ────
// Predictions: (a) FIXED + Class + no sweep line → RED at the section header;
// (b) FIXED + Class + "Sibling sweep: batched — polish" → GREEN; (c) OPEN +
// Class + no sweep → GREEN; (d) VERIFIED + Class + no sweep → RED.
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — FIXED\nReported: x\nSeverity: polish\nClass: reader-shape\nFix: done\n" });
  ok("W10 sweep: a FIXED section naming a class without a Sibling sweep line fails at its header",
    res.status === 1 && res.stderr.includes("dev/FEEDBACK.md:1:") && res.stderr.includes("Sibling sweep"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — FIXED\nReported: x\nSeverity: polish\nClass: reader-shape\nFix: done\nSibling sweep: batched — polish, rides the next substantive round.\n" });
  ok("W10 sweep: a FIXED section with Class and a Sibling sweep line passes", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — OPEN\nReported: x\nClass: reader-shape\n" });
  ok("W10 sweep: an OPEN section owes no sweep yet", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — VERIFIED\nReported: x\nClass: consumer-parity\nVerdict: ok\n" });
  ok("W10 sweep: a VERIFIED section naming a class without a sweep line fails", res.status === 1 && res.stderr.includes("Sibling sweep"));
}

// ── 16. Review round (W10): the tightened bus rules ──────────────────────────
// Predictions: (a) TWO Under test lines → RED at the second; (b) a Blind spots
// line for the right token but NOT directly under Under test → RED; (c) a
// Class: line with trailing text → RED "malformed"; (d) an indented KILLED row
// under a line saying "quoted verbatim" → GREEN, and the same row after a
// later unindented line without it → RED; (e) an archived section ≥ F-360 with
// an unregistered Class: key → RED pointing at the registry; (f) an archived
// section below F-360 with a free-text Class: line → GREEN (legacy).
{
  const res = runRig({ "dev/FEEDBACK.md": "Under test: dev · hb-20260904-03 · 2026-09-04\nBlind spots (hb-20260904-03): none.\nUnder test: dev · hb-20260904-04 · 2026-09-04\n" });
  ok("W10 review: a second Under test line is refused (re-stamp in place)", res.status === 1 && res.stderr.includes("dev/FEEDBACK.md:3:") && /second "Under test:" line/.test(res.stderr));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "Under test: dev · hb-20260904-03 · 2026-09-04\n\nSome other header prose.\nBlind spots (hb-20260904-03): none.\n" });
  ok("W10 review: the Blind spots line must be directly under Under test", res.status === 1 && res.stderr.includes("Blind spots (hb-20260904-03)"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — OPEN\nReported: x\nClass: consumer-parity, the twin class\n" });
  ok("W10 review: a Class: line with trailing text is malformed, not a lookup of the wrong key", res.status === 1 && /malformed Class: line/.test(res.stderr) && !/is not a registered/.test(res.stderr));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — OPEN\nReported: x\nThe F-337 table, quoted verbatim:\n    KILLED    [47] ret:ok dropped\n    SURVIVED  [6] cmp:< -> <=\n" });
  ok("W10 review: a verbatim quote of an older table is exempt from the pred: rule", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": "## F-360 — OPEN\nReported: x\nThe F-337 table, quoted verbatim:\n    KILLED    [47] ret:ok dropped\nAnd this round's own sweep:\n    KILLED  M1 closer dropped\n" });
  ok("W10 review: the exemption ends at the next unindented line — the section's own row still needs pred:", res.status === 1 && res.stderr.includes("dev/FEEDBACK.md:6:") && res.stderr.includes("pred:KILL"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "clean bus\n", "dev/FEEDBACK-archive.md": "## F-361 — VERIFIED\nReported: x\nClass: zz-retired-key\n" });
  ok("W10 review: an archived Class: key that is no longer registered fails, pointing at the registry", res.status === 1 && res.stderr.includes("dev/FEEDBACK-archive.md:3:") && /keys are append-only/.test(res.stderr));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "clean bus\n", "dev/FEEDBACK-archive.md": "## F-288 - VERIFIED\nReported: x\nClass: **clamp/integrity asymmetry** - free text\n" });
  ok("W10 review: archived sections below F-360 keep their legacy free-text Class: lines", res.status === 0);
}

// ── 16. GP-17 — the currency notice's date is meta.generatedAt's date ─────────
// Predictions: (a) "last updated on 2020-01-01" in a hand-maintained doc → RED
// naming the generation date; (b) the rig stamp's date → GREEN; (c) the phrase
// on an indented bus line → exempt (same line-local rule as every other row).
{
  const res = runRig({ "docs/notice.md": "This document was last updated on 2020-01-01 with reference to the package.\n" });
  ok("GP-17 currency: a stale 'last updated on' date fails and names meta.generatedAt's date",
    res.status === 1 && res.stderr.includes("docs/notice.md:1:") && res.stderr.includes("2029-03-04") && res.stderr.includes("meta.generatedAt"));
}
{
  const res = runRig({ "docs/notice.md": "This document was last updated on 2029-03-04 with reference to the package.\n" });
  ok("GP-17 currency: the catalog's generation date passes", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": "clean bus\n    quoted: last updated on 2020-01-01\n" });
  ok("GP-17 currency: an indented bus quotation of an old date is exempt", res.status === 0);
}

// ── 11. Clean rig baseline: scaffolding itself is green ──────────────────────
{
  const res = runRig({ "dev/FEEDBACK.md": `Current pin v${PIN}, bare historical 1.2.3 in prose is fine.\n` });
  ok("clean rig passes", res.status === 0);
  ok("pass line reports the citation scan", res.stdout.includes("Stale-facts check passed"));
  ok("pass line reports the bus handoff conventions (W10)", res.stdout.includes("bus handoff conventions (W10)"));
}

// ── 13. F-439 — the Under test line is READ: present, and matching the canary ─
// Predictions, written before the first run: (f) a bus that declares a Canary:
// location but carries no Under test line → RED naming the missing line; (g) an
// Under test token the canary does not carry → RED at the Under test line;
// (h) a matching pair → GREEN; (i) a declared canary that does not exist → RED
// ("unreadable"); (j) no Canary: declaration → the rule is not owed (GREEN).
const CANARY_PATH = "plugins/gs-superadmin/skills/dev-canary/SKILL.md";
const canary = (stamp) => `---\nname: dev-canary\ndescription: DEV CANARY — under test ${stamp}. Visible only from a dev working tree.\n---\n`;
const busWith = (underTest) =>
  `Profile: plugin\nCanary: ${CANARY_PATH} description\n\n${underTest ? `Under test: ${underTest}\n` : ""}Blind spots (hb-20260904-02): none — rig.\n`;
{
  const res = runRig({ "dev/FEEDBACK.md": busWith(null), [CANARY_PATH]: canary("dev · hb-20260904-02 · 2026-09-04") });
  ok("F-439: a bus declaring a Canary location with no Under test line fails, naming the line",
    res.status === 1 && res.stderr.includes('no "Under test:" line'));
}
{
  const res = runRig({ "dev/FEEDBACK.md": busWith("dev · hb-20260904-02 · 2026-09-04"), [CANARY_PATH]: canary("dev · hb-20260904-01 · 2026-09-04") });
  ok("F-439: an Under test token the canary does not carry fails at the Under test line",
    res.status === 1 && res.stderr.includes("dev/FEEDBACK.md:4:") && res.stderr.includes("but the canary at"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": busWith("dev · hb-20260904-02 · 2026-09-04"), [CANARY_PATH]: canary("dev · hb-20260904-02 · 2026-09-04") });
  ok("F-439: a matching Under test line and canary pass", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": busWith("dev · hb-20260904-02 · 2026-09-04") });
  ok("F-439: a declared canary that does not exist fails as unreadable", res.status === 1 && res.stderr.includes("unreadable"));
}
{
  const res = runRig({ "dev/FEEDBACK.md": "Under test: dev · hb-20260904-02 · 2026-09-04\nBlind spots (hb-20260904-02): none — rig.\n" });
  ok("F-439: no Profile: and no Canary: declaration → the rule is not owed", res.status === 0);
}
{
  // The MEDIUM review of 0.37.0: a Profile: line with the Canary: line deleted
  // used to make every canary rule unowed.
  const res = runRig({ "dev/FEEDBACK.md": "Profile: plugin\n\nUnder test: dev · hb-20260904-02 · 2026-09-04\nBlind spots (hb-20260904-02): none — rig.\n" });
  ok("F-439 (review): a Profile: header with no Canary: line is refused", res.status === 1 && res.stderr.includes('no "Canary:'));
}
{
  // …and a bus line hand-edited back to the no-token form beside a stamped canary.
  const res = runRig({ "dev/FEEDBACK.md": busWith("(not yet handed off)"), [CANARY_PATH]: canary("dev · hb-20260904-02 · 2026-09-04") });
  ok("F-439 (review): an Under test line with no token beside a stamped canary fails — the stamp is compared whether or not the line carries a token", res.status === 1 && res.stderr.includes("is stamped"));
}
{
  // The stamp is read from the frontmatter only: a `description:` line in the
  // skill BODY is not the stamp.
  const res = runRig({
    "dev/FEEDBACK.md": busWith("dev · hb-20260904-02 · 2026-09-04"),
    [CANARY_PATH]: "---\nname: dev-canary\ndescription: DEV CANARY — under test dev · hb-20260904-02 · 2026-09-04. Visible only from a dev working tree.\n---\n\nBody prose.\ndescription: under test dev · hb-20260904-09 · 2026-09-04. (a body line, not the stamp)\n",
  });
  ok("F-444 (review): the canary stamp is read from the frontmatter block, never from a body line", res.status === 0);
}

// ── 14. Rules 4 and 5 — Judge: and Redesign: lines (the F-436 arc) ───────────
// Predictions, before the first run: (p) a FIXED section from F-436 on with a
// Class: and a Sibling sweep: but no Judge: → RED naming "Judge:"; (q) the same
// with a Judge: → GREEN; (r) two REOPENED verdicts, FIXED, Judge: present, no
// Redesign: → RED naming "Redesign:"; (s) with a Redesign: → GREEN; (t) a
// section BELOW F-436 with no Judge: → GREEN (older grammar).
const section = (num, status, extra) =>
  `Under test: (not yet handed off)\n\n## F-${num} — ${status}\nReported: 2026-09-08 (tester)\nSeverity: normal — rig\nClass: reader-shape\nWhat: rig.\nFix: rig.\nSibling sweep: rig.\n${extra}`;
{
  const res = runRig({ "dev/FEEDBACK.md": section(440, "FIXED", "") });
  ok("rule 4:a FIXED section of a registered class with no Judge: line fails", res.status === 1 && res.stderr.includes('"Judge:" line'));
}
{
  const res = runRig({ "dev/FEEDBACK.md": section(440, "FIXED", "Judge: the shell itself.\n") });
  ok("rule 4:a Judge: line passes", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": section(440, "FIXED", "Judge: the shell.\nVerdict: (tester) — REOPENED once.\nVerdict: (tester) — REOPENED twice.\n") });
  ok("rule 5:two REOPENED verdicts and FIXED without a Redesign: line fails", res.status === 1 && res.stderr.includes('"Redesign:" line'));
}
{
  const res = runRig({ "dev/FEEDBACK.md": section(440, "FIXED", "Judge: the shell.\nVerdict: (tester) — REOPENED once.\nVerdict: (tester) — REOPENED twice.\nRedesign: the model replaced.\n") });
  ok("rule 5:a Redesign: line passes", res.status === 0);
}
{
  const res = runRig({ "dev/FEEDBACK.md": section(400, "FIXED", "") });
  ok("rules 5/6: a section below F-436 is exempt (older grammar)", res.status === 0);
}

// ── 15. F-444 — the gates read proxies: rule 5 counted ONE verdict wording, and
// the Under test compare was a substring ──────────────────────────────────────
// Predictions, before the first run: (x) two verdicts worded "back to OPEN",
// FIXED, no Redesign: → RED naming "Redesign:"; (y) THREE Fix notes (Fix:,
// Fix (second pass):, Fix (third pass):) with no REOPENED verdict at all,
// FIXED, no Redesign: → RED; (z) two Fix notes → GREEN (one reopen); (aa) a
// canary description carrying a STALE stamp beside the fresh one, the bus
// naming the fresh one → RED at the Under test line (the substring test
// passed it); (bb) a description with no "under test …" stamp → RED naming the
// missing stamp.
{
  const res = runRig({ "dev/FEEDBACK.md": section(440, "FIXED", "Judge: the shell.\nVerdict: (tester) — back to OPEN, the fix missed a sibling.\nVerdict: (tester) — back to OPEN again.\n") });
  ok("rule 5 (F-444): two verdicts worded \"back to OPEN\" count as two reopens", res.status === 1 && res.stderr.includes('"Redesign:" line'));
}
{
  // Considered and rejected (the MEDIUM review): counting Fix notes as reopens
  // would demand a Redesign line for a fix landed in three separately-noted
  // parts — a false provenance. The verdict vocabulary is the one reading.
  const res = runRig({ "dev/FEEDBACK.md": section(440, "FIXED", "Judge: the shell.\nFix (second pass): rig.\nFix (third pass): rig.\n") });
  ok("rule 5 (F-444, control): three Fix notes with no reopening verdict are not a reopen — no Redesign owed", res.status === 0);
}
{
  const res = runRig({
    "dev/FEEDBACK.md": busWith("dev · hb-20260904-02 · 2026-09-04"),
    [CANARY_PATH]: "---\nname: dev-canary\ndescription: DEV CANARY — under test dev · hb-20260904-01 · 2026-09-04. Also under test dev · hb-20260904-02 · 2026-09-04. Visible only from a dev working tree.\n---\n",
  });
  ok("F-444: a canary carrying a stale stamp beside the fresh one fails — the stamp is compared whole, not as a substring", res.status === 1 && res.stderr.includes("dev/FEEDBACK.md:4:") && res.stderr.includes('is stamped "dev · hb-20260904-01 · 2026-09-04"'));
}
{
  const res = runRig({
    "dev/FEEDBACK.md": busWith("dev · hb-20260904-02 · 2026-09-04"),
    [CANARY_PATH]: "---\nname: dev-canary\ndescription: DEV CANARY without a stamp.\n---\n",
  });
  ok("F-444: a canary description with no \"under test …\" stamp fails, naming the missing stamp", res.status === 1 && res.stderr.includes("carries no"));
}

if (failures.length) {
  console.error(`test-check-stale-facts: ${failures.length} FAILED, ${passed} passed`);
  for (const f of failures) console.error(`  FAIL: ${f}`);
  process.exit(1);
}
console.log(`test-check-stale-facts: all ${passed} checks passed`);
