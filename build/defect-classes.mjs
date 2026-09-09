// ─────────────────────────────────────────────────────────────────────────────
// defect-classes.mjs — the defect-class REGISTRY, as data (GP-B5 W10 / B14, 2026-09-03)
//
// Why a registry: across F-300..F-359, 20 of 31 tester findings were a NAMED
// class recurring at another site of the same arc (F-305, F-308, F-310, F-323,
// F-326, F-327, F-332..F-337, F-343, F-345, F-354, F-355, F-358 …), and the one
// sibling sweep that ran by eye (F-328's, over scanFenceMarkers) cleared the
// very site F-329 then found. A class with a pattern detector is therefore
// SWEPT BY A CHECK on every run, never by a recipe a session remembers to run.
//
// Where the pieces live (decisions live where their enforcement lives —
// AGENTS.md § Review-gate rules; a standalone dev/CLASSES.md was rejected as
// the "separate ADR directory" shape):
//   - MECHANICAL_CLASSES (this file): rows a check EXECUTES tree-wide —
//     build/check-doc-drift.mjs check 19 runs every row on every run, with
//     each row's ALLOWANCE (sanctioned files, each with a reason) checked in
//     BOTH directions like a survivor ledger (F-327): an unsanctioned hit
//     reds, and a sanctioned file that no longer carries the shape reds too.
//     A file the check cannot READ is reported as unreadable, never as
//     "carries no instance" (W10 review round).
//   - MANUAL_CLASSES (this file, KEYS ONLY): classes with no zero-false-
//     positive pattern. Their signature, recipe and cost live as `Class: <key>`
//     bullets in AGENTS.md § Review-gate rules — the ONE home — where review
//     enforces them; check 19 cross-checks keys both ways so a key cannot
//     exist in one home without the other.
//   - INSTANCES live on the bus: a finding of a registered class carries a
//     `Class: <key>` line (F-288/F-289/F-290 precedent); check-stale-facts
//     refuses an unregistered or malformed key and, on a FIXED/VERIFIED
//     section, a missing `Sibling sweep:` line. Enumerate instances with
//     `grep -n '^Class: <key>' dev/FEEDBACK*.md` — never a copied list here.
//     KEYS ARE APPEND-ONLY: archived sections are frozen text and the
//     enumeration grep spans both files, so a key is never renamed or deleted
//     — a superseded class keeps its key here with a "retired" note.
//
// Graduation is a PROPERTY, not a count: a class is a mechanical row the
// moment its detector is a pattern with zero false positives at gate cost
// (seconds). A detector with a tunable knob (build/sweep-twins.mjs, a
// similarity threshold) or one that can only enumerate SPELLINGS of a shape
// (the fence-grammar copies — demoted to manual in the W10 review round after
// six equally valid spellings passed its needle list) is an INSTRUMENT a
// manual recipe runs, never a row. The class list itself is HUMAN INPUT —
// nothing here claims it is complete (the F-339 lesson); the next unnamed
// class arrives as a finding and gets a row or a bullet then.
//
// Needles are assembled by concatenation so this file never contains one
// whole; the sweep excludes this file regardless (the registry's home).
// Comment lines are never instances: prose ABOUT a class is not the class
// (COMMENT_RE, applied by every detector). The stdout-then-exit row goes one
// step further: it reads the file through maskCode(), which blanks the
// CONTENTS of string/template literals, regex literals and comments (length
// preserved) before the paren walk and the exit test, so a "(" in a comment
// inside a call, a ")" in a regex argument, or the token process.exit( in a
// trailing comment or a message can never create an instance (release-gate
// review round, F-374 — measured against the guard's own callback-exit shape).
// No imports, by contract: check-stale-facts' scratch rig copies this file
// beside the checker exactly as it copies lib.mjs (build/check-imports.mjs
// RESTRICTED, mode "none"). Importing FROM it is fine (sweep-twins does).
// ─────────────────────────────────────────────────────────────────────────────

const BS = String.fromCharCode(92); // backslash
const BT = String.fromCharCode(96); // backtick
/**
 * An optional single-level receiver before a helper call — `helpers.` in
 * `helpers.out(` / `helpers.finish(` (makeCliHelpers' handle, F-365, F-367).
 * ONE definition for every row that admits it: the identifier's lead and tail
 * classes are pinned once (build/test-defect-classes.mjs) and a row adopting
 * the idiom inherits them instead of re-opening them (F-367's amendment: a
 * hand-copied prefix arrived without its cases). A two-level receiver is not
 * the handle — declared boundary, same on every row.
 */
export const RECEIVER_PREFIX = "(?:[A-Za-z_$][" + BS + "w$]*" + BS + ".)?";

/** The first bus section number under the W10 copy-out / Class: grammar. */
export const DOCTRINE_FROM = 360;

const REGISTRY = "build/defect-classes.mjs";
/**
 * The test lanes: suites re-derive mechanisms as independent probes (Class B)
 * and are not consumer surface. The shared rig (test/rig.mjs) is NOT a test
 * lane — it is plumbing every suite imports, so it stays in scope, exactly as
 * check-doc-drift check 9 keeps it (the W10 review round aligned the two).
 * @param {string} f
 */
export const isTest = (f) => f.includes("/test/") || f.startsWith("build/test-");
/** Prose about a class is never an instance of it. */
export const COMMENT_RE = /^\s*(\/\/|\*|\/\*)/;

/** @type {Record<string, (f: string) => boolean>} */
export const SCOPES = {
  // every tracked source file outside the test lanes and the wiki bundle
  "all-code": (f) => /\.(mjs|js)$/.test(f) && !isTest(f) && !f.startsWith("build/wiki-assets/") && f !== REGISTRY,
  // the two production lanes (plugin + build) plus the shared rig, tests excluded
  "lane-mjs": (f) => f.endsWith(".mjs") && (f.startsWith("plugins/gs-superadmin/") || f.startsWith("build/") || f === "test/rig.mjs") && !isTest(f) && f !== REGISTRY,
  // shipped plugin code: scripts, hooks, skill-local scripts (never tests)
  shipped: (f) => f.endsWith(".mjs") && f.startsWith("plugins/gs-superadmin/") && !isTest(f),
};

/**
 * @typedef {{kind: "line-regex", source: string, flags?: string} |
 *           {kind: "needles", needles: string[]} |
 *           {kind: "stdout-then-exit"}} Detector
 * @typedef {{why: string, sites: number}} Allowance — a sanctioned file with its reason and the
 *            NUMBER of sites the sanction covers: the ledger reads both ways per site (F-376),
 *            so a new instance in a sanctioned file reds like one anywhere else, and a
 *            sanctioned site that disappears reds as stale — never a file-wide blind spot
 * @typedef {{key: string, origin: string, what: string, scope: keyof typeof SCOPES, detect: Detector,
 *            allow: Record<string, Allowance>}} MechanicalClass
 */

/** @type {MechanicalClass[]} */
export const MECHANICAL_CLASSES = [
  {
    key: "fence-state-toggle",
    origin: "F-323 F-328 F-329",
    what: "a parser tracks paired-delimiter state with an unconditional self-toggle (x = !x), so one stray line inverts the classification of everything after it",
    scope: "all-code",
    detect: { kind: "line-regex", source: "(" + BS + "b[A-Za-z_]" + BS + "w*)" + BS + "s*=" + BS + "s*!" + BS + "s*" + BS + "1" + BS + "b" },
    allow: {},
  },
  {
    key: "marker-parity-arithmetic",
    origin: "F-329",
    what: "markers paired by even/odd POSITION (a % 2 test) instead of by an opener/closer grammar — two stray markers keep the count even and silently shift every range",
    scope: "all-code",
    detect: { kind: "line-regex", source: "%" + BS + "s*2" + BS + "s*[!=]==?" },
    allow: {
      "build/check-doc-drift.mjs": { why: "inline code-span even/odd split with a LOUD unpaired-backtick fallback (whole line) — not fence-range state (F-328 sibling sweep, probe 3); two split sites, each a pair of comparators", sites: 4 },
      "plugins/gs-superadmin/scripts/capture.mjs": { why: "UTF-16 byte-length parity refusal on a capture — an encoding check, not marker pairing", sites: 1 },
    },
  },
  {
    key: "provenance-literal",
    origin: "F-307 F-308 F-318 F-323",
    what: "a rendered provenance/reason string is a literal in the renderer instead of the resolver's own result, so the report credits a source that was never consulted",
    scope: "shipped",
    detect: { kind: "needles", needles: ["from the tenant conventions", "no field-aliasing convention supplied", "from the explicit " + "--alias-prefix"] },
    allow: {
      "plugins/gs-superadmin/scripts/jo-report-deps.mjs": { why: "the ONE renderer (aliasMatchingLine) reads provenance off resolveAliasPrefix's origin field, plus the documented defensive fallback on a state the resolver cannot produce (F-307/F-308)", sites: 1 },
    },
  },
  {
    key: "stdout-then-exit",
    origin: "F-356 F-360",
    what: "a stdout write followed by process.exit anywhere later in the same block — stdout is asynchronous on a macOS pipe, so everything past the first ~8 KB chunk is lost (a summary listing 60+ docs, a 13 KB census); end the script with process.exitCode, or exit in the write callback (makeCliHelpers' finish)",
    scope: "lane-mjs",
    detect: { kind: "stdout-then-exit" },
    // No allowance: the guard hook's five stdout sites — the three PreToolUse
    // replies (F-363, B16) and the two PostToolUse journal alerts (F-372, the
    // release-gate review) — exit in the write callback, so this row polices
    // the guard like every other lane-mjs file. Its declared boundary (a write
    // inside a helper the exit follows is a block proxy) is exactly why the
    // F-372 sites were invisible to it; those two are pinned by the
    // async-stdout case in test/guard-fixtures.mjs, not by this row.
    allow: {},
  },
  {
    key: "unawaited-finish",
    origin: "F-360",
    what: "makeCliHelpers' finish() called without await — bare or through its handle (helpers.finish, F-367) — the exit fires in the write callback, so an un-awaited call falls through into the code the early exit protects (a second spawn, an inventory overwrite) before the process ends",
    scope: "shipped",
    // The await lookbehind admits any run of whitespace (F-367 co-fix of a
    // measured false alarm on `await  finish(`); the receiver is the shared
    // RECEIVER_PREFIX (F-365's, one definition) and the word boundary is kept,
    // so `unfinish(` stays out. Unanchored, unlike WRITE_RE — so the input
    // that pins the prefix's lead class here is a bare `$.finish(`, not
    // `$h.finish(` (the tester's F-367 amendment).
    detect: { kind: "line-regex", source: "(?<!await" + BS + "s+)(?<![." + BS + "w])" + RECEIVER_PREFIX + "finish" + BS + "(" },
    allow: {},
  },
  {
    key: "atomic-write-copy",
    origin: "F-133 F-352",
    what: "a hand-spelled temp+rename (or bare) durable write outside the one atomic-write primitive — a missing parent crashes and an interrupted write leaves a truncated record that reads as complete",
    scope: "shipped",
    detect: { kind: "needles", needles: ["renameSync(", "replaceFileSync("] },
    allow: {
      "plugins/gs-superadmin/scripts/doc-lib.mjs": { why: "writeFileAtomicSync + replaceFileSync — the primitive's home (F-352), with the Windows rename retry (F-133): the retry's two renames and the primitive's replace", sites: 3 },
    },
  },
  {
    key: "script-name-literal",
    origin: "F-306",
    what: "a hand-rolled fail() helper spells its own script name into the prefix (<name>.mjs: ${msg}) instead of taking it from makeCliHelpers — the copy the next script imports blames a script the operator never ran (a script naming itself in a plain message is not this class)",
    scope: "shipped",
    detect: { kind: "line-regex", source: BT + "[a-z-]+" + BS + ".mjs: " + BS + "$" + BS + "{msg" + BS + "}" },
    allow: {},
  },
];

/**
 * Classes with no zero-false-positive pattern: KEYS ONLY. The signature,
 * recipe and cost live as the `Class: <key>` bullet in AGENTS.md § Review-gate
 * rules (the one home); `origin` is kept for the fail message and history.
 * Append-only (see the header).
 * @type {Array<{key: string, origin: string}>}
 */
export const MANUAL_CLASSES = [
  { key: "reader-shape", origin: "F-342 F-343 F-345 F-353 F-355 F-358" },
  { key: "consumer-parity", origin: "F-306 F-310 F-311 F-320 F-349 F-354 F-355" },
  { key: "unpinned-arm", origin: "F-314 F-315 F-324 F-326 F-327 F-332 F-335 F-336 F-337" },
  { key: "malformed-shape-readers", origin: "F-357" },
  // demoted from a mechanical row in the W10 review round: a spelling list is
  // not a pattern (six valid spellings of the same grammar passed it) and a
  // 3-backtick-run token matches the emitters too — no honest zero-FP detector
  { key: "fence-grammar-copy", origin: "F-323 F-328 F-329" },
  // a shipped note gives a false REASON for correct advice — the promised
  // failure cannot occur, so the drift check the note offers is dead
  { key: "false-rationale", origin: "F-416" },
  // a consumer keys per-workspace RECORDED data (a manifest domain name) by a
  // hardcoded default or a namespace spelling instead of reading the recording
  // — the lookup is right on the workspace it was written against and silently
  // empty or forked on any other
  { key: "recording-blind-lookup", origin: "F-429" },
  // a ledger or report field asserts an OUTCOME from a proxy signal that
  // describes a larger unit (a harness event for a whole command line, an exit
  // code of a pipeline) — the word is not entailed by anything the writer read
  { key: "outcome-from-proxy", origin: "F-428" },
  // a ledger or report field is filled by scanning ADJACENT tokens past the
  // boundary that defines it (a line end, a redirection, a heredoc body) — the
  // field states as fact words the parser never attributed to that row's unit
  { key: "field-from-adjacency", origin: "F-431" },
  // a grammar decision (is this word an operator, a redirection, a delimiter)
  // is made on the ASSEMBLED word after quote removal, so quoted or arithmetic
  // text is read as shell syntax — the character loop that saw the quotes is
  // the only layer that can tell
  { key: "quote-erased-grammar", origin: "F-433" },
  // a token walk stops at a REDIRECTION as if it were a command separator, so
  // a redirection standing before the words the walk needs empties it — and
  // an empty walk is read as "no invocation" (silence) rather than "an
  // invocation whose words stand past the redirection"
  { key: "redirection-as-boundary", origin: "F-436" },
  // a header line that a rule ANCHORS on (the Under test line the Blind spots
  // rule keys to) is not itself read by any gate, so a hand edit can delete or
  // replace it and every gate stays green — the anchor must be a checked fact
  { key: "unread-anchor-line", origin: "F-439" },
  // the binary is spelled on the line in a form the word scanner never
  // matches — a substitution, an expression or a variable standing where the
  // command name goes, a quoted or glued spelling — so the invocation drops
  // out of the scan (F-109, F-111, F-244, F-250 were instances; F-441 the class)
  { key: "name-spelling", origin: "F-441" },
  // a reader re-derives grammar from the text — its own quote loop, its own
  // operator clauses, a regex over a word — instead of consulting the
  // tokenizer's record, so the two disagree exactly where the grammar is subtle
  { key: "second-scanner", origin: "F-443" },
];

export const REGISTERED_CLASS_KEYS = new Set([...MECHANICAL_CLASSES.map((c) => c.key), ...MANUAL_CLASSES.map((c) => c.key)]);
/** The registry's own key grammar — the bus's `Class:` line and AGENTS.md's bullets both use it. */
export const CLASS_KEY_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Every `Class: <key>` spelled in backticks in a prose file (AGENTS.md's
 * Review-gate bullets) — the join key between the registry and the rules.
 * @param {string} text
 * @returns {Set<string>}
 */
export function classKeysIn(text) {
  return new Set([...text.matchAll(new RegExp(BT + "Class: ([a-z][a-z0-9-]*)" + BT, "g"))].map((m) => m[1]));
}

const compiled = new Map();
/**
 * One compiled RegExp per source+flags for the process. The global and
 * sticky flags are DROPPED: every detector runs a per-line boolean test, and
 * a cached g/y regex carries lastIndex from one test to the next — across
 * lines and across files — so a row declaring one reported every other match
 * (release-gate review, F-375; measured before the strip).
 * @param {string} source @param {string} [flags]
 */
const regexOf = (source, flags = "") => {
  const f = flags.replace(/[gy]/g, "");
  const k = source + "/" + f;
  if (!compiled.has(k)) compiled.set(k, new RegExp(source, f));
  return compiled.get(k);
};

// A "/" starts a regex literal when the last code character before it is an
// operator, an opener or a separator (or the line is empty so far), or when
// the last code WORD is a keyword that takes an operand (`return /x/`); after
// an identifier, a number or a closer it is division. The one grammar, as
// data. The keyword rule is F-382: the character rule alone read the regex at
// jo-report.mjs's CSV quoting (`return /[",\r\n|]/`) as division, and the `"`
// inside it opened string mode over real code — measured live on the tree the
// F-374 boundary note called free of the construction. This is the tree's ONE
// code-view lexer: check-imports.mjs imports maskCode for its edge scan
// (F-385) rather than carrying a second grammar.
const REGEX_LEAD = /^$|[(,=:[!&|?{};+\-*%<>~^]/;
const KEYWORD_LEAD = new Set([
  "return", "typeof", "case", "in", "of", "do", "else", "void", "delete",
  "instanceof", "new", "yield", "await", "throw",
]);
/**
 * The file as CODE ONLY: every character inside a string/template literal, a
 * regex literal, a line comment or a block comment is replaced by a space
 * (delimiters kept, length preserved, so columns survive); a template
 * literal or block comment left open carries into the next line. The
 * paren walk and the exit test read this view, never the raw text (F-374).
 *
 * A stack lexer, not a mode flag (F-384): a template literal's `${ … }`
 * substitution is code that may hold strings, regexes, comments, braces and
 * NESTED templates, so the lexer keeps a stack — an open template body, or
 * an open substitution with its brace depth — and everything between the
 * OUTERMOST backticks is blanked (substitutions included: the detectors read
 * statements, and a write inside a template's substitution is not one). The
 * single-mode version closed the outer template at the first inner backtick
 * and then read the escaped backticks after it as openers, so a
 * jo-report-program.mjs line with `\`${x}\`` inside a substitution left it in
 * template mode over the next hundred lines of real code. A hashbang line is
 * a comment. Measured, not proved (F-384): a session-scratch differential
 * against acorn's tokenizer (Node's bundled parser) reported 0 disagreeing
 * lines over the 37 swept files / 21929 lines, all 37 parsed. acorn is that
 * instrument's IMPLEMENTATION, not ground truth: it rejects `a?.of / b` as
 * an unterminated regex where this lexer reads division and V8 evaluates it
 * (F-386, 0 such sites in the swept set), and its failure mode on a legal
 * file is a THROW — a rerun must count parse failures and fail loudly, never
 * skip a file and still report zero.
 * @param {string[]} lines
 * @returns {string[]}
 */
export function maskCode(lines) {
  /** @type {string | null} */
  let mode = null; // null (code) | '"' | "'" | "/" (regex) | "/*"
  /** @type {Array<"tpl" | number>} */
  const stack = []; // an open template body ("tpl"), or an open ${ … } substitution holding its brace depth
  return lines.map((l, li) => {
    if (li === 0 && l.startsWith("#!")) return " ".repeat(l.length); // hashbang is a comment
    const out = l.split("");
    let cls = false; // inside a regex character class
    let prev = ""; // the last code character seen on this line
    let word = ""; // the identifier run ending at prev ("" once a punctuator or a literal follows it)
    let wordOpen = false; // still accumulating that run (whitespace closes it but keeps it)
    let wordLead = ""; // the code character before the run: after "." it is a property name, never a keyword
    for (let c = 0; c < l.length; c++) {
      const ch = l[c];
      const nx = l[c + 1];
      if (stack.length) out[c] = " "; // inside a template: text, the outer delimiters excepted (restored below)
      if (mode === "/*") {
        out[c] = " ";
        if (ch === "*" && nx === "/") { out[c + 1] = " "; c++; mode = null; }
        continue;
      }
      if (mode === '"' || mode === "'") {
        if (ch === BS) { out[c] = " "; if (c + 1 < l.length) out[c + 1] = " "; c++; continue; }
        if (ch === mode) { mode = null; prev = ch; continue; } // the closing delimiter stays; a literal ends an expression
        out[c] = " ";
        continue;
      }
      if (mode === "/") {
        if (ch === BS) { out[c] = " "; if (c + 1 < l.length) out[c + 1] = " "; c++; continue; }
        if (cls) { if (ch === "]") cls = false; out[c] = " "; continue; }
        if (ch === "[") { cls = true; out[c] = " "; continue; }
        if (ch === "/") { mode = null; prev = ch; continue; }
        out[c] = " ";
        continue;
      }
      if (stack[stack.length - 1] === "tpl") { // template body
        if (ch === BS) { if (c + 1 < l.length) out[c + 1] = " "; c++; continue; }
        if (ch === BT) { stack.pop(); if (!stack.length) out[c] = BT; prev = BT; word = ""; wordOpen = false; continue; }
        if (ch === "$" && nx === "{") { out[c + 1] = " "; c++; stack.push(0); prev = ""; word = ""; wordOpen = false; }
        continue;
      }
      // code — at the top level or inside a substitution
      if (ch === '"' || ch === "'") { mode = ch; word = ""; wordOpen = false; continue; }
      if (ch === BT) { stack.push("tpl"); word = ""; wordOpen = false; continue; } // the outermost opener stays
      if (ch === "/" && nx === "/") { for (let k = c; k < l.length; k++) out[k] = " "; break; }
      if (ch === "/" && nx === "*") { out[c] = " "; out[c + 1] = " "; c++; mode = "/*"; continue; }
      if (ch === "/" && (REGEX_LEAD.test(prev) || (KEYWORD_LEAD.has(word) && wordLead !== "."))) { mode = "/"; cls = false; word = ""; wordOpen = false; continue; }
      const depth = stack[stack.length - 1]; // a number = brace depth inside an open substitution
      if (typeof depth === "number") {
        if (ch === "{") stack[stack.length - 1] = depth + 1;
        else if (ch === "}") { if (depth === 0) { stack.pop(); continue; } stack[stack.length - 1] = depth - 1; }
      }
      if (ch === " " || ch === "\t") { wordOpen = false; continue; }
      if (/[\w$]/.test(ch)) { if (!wordOpen) { wordLead = prev; word = ""; wordOpen = true; } word += ch; }
      else { word = ""; wordOpen = false; }
      prev = ch;
    }
    if (mode !== "/*") mode = null; // a string or regex literal never spans lines; templates carry on the stack
    return out.join("");
  });
}

/**
 * Where the stdout write CALL that starts at (line i, column start) closes,
 * walking the MASKED view so nothing inside a literal, a regex or a comment
 * can unbalance it (W10 review: the naive walk ran to EOF on
 * `console.log("done (see log")`; the release-gate review measured the same
 * miss on a "(" in a comment inside the call and a ")" in a regex argument —
 * F-374). Bounded to 40 lines; an unbalanced call is treated as closing on
 * its own line (the rest of the line counts as after the call).
 * @param {string[]} masked @param {number} i @param {number} start
 * @returns {{line: number, col: number}}
 */
function callClose(masked, i, start) {
  let depth = 0;
  for (let j = i; j < Math.min(masked.length, i + 40); j++) {
    const l = masked[j];
    for (let c = j === i ? start : 0; c < l.length; c++) {
      const ch = l[c];
      if (ch === "(") depth++;
      else if (ch === ")" && --depth === 0) return { line: j, col: c };
    }
  }
  return { line: i, col: -1 };
}

/**
 * Run one row's detector over one file's lines.
 * @param {MechanicalClass} row
 * @param {string[]} lines
 * @returns {Array<{line: number, why: string}>}
 */
export function detectRow(row, lines) {
  const hits = [];
  const d = row.detect;
  if (d.kind === "line-regex") {
    const re = regexOf(d.source, d.flags);
    lines.forEach((l, i) => {
      if (!COMMENT_RE.test(l) && re.test(l)) hits.push({ line: i + 1, why: `matches /${d.source}/` });
    });
  } else if (d.kind === "needles") {
    lines.forEach((l, i) => {
      if (COMMENT_RE.test(l)) return;
      const n = d.needles.find((x) => l.includes(x));
      if (n !== undefined) hits.push({ line: i + 1, why: `spells ${JSON.stringify(n)}` });
    });
  } else if (d.kind === "stdout-then-exit") {
    // A stdout write STATEMENT (console.log, makeCliHelpers' out — bare, or
    // through its handle as `helpers.out(` (F-365: the F-360 site itself was
    // invisible to a bare line-start anchor; RECEIVER_PREFIX, the shared
    // optional `<ident>.` fragment, is admitted on the out alternative only,
    // makeCliHelpers' handle being its one producer in this tree) — or a raw process.stdout.write at the start
    // of a line, optionally awaited) with process.exit( anywhere later in the
    // SAME BLOCK — every following line at the write's indentation or deeper,
    // until the block dedents. The exit must come AFTER the call closes: an
    // exit inside the call is the write-callback form (makeCliHelpers'
    // finish), which is the fix, not the class. A definition (`const out =
    // (obj) => console.log(…)`) is not a statement. Boundary, declared: a
    // block that dedents and re-indents (an else branch) is a different block;
    // a write inside a callback body is scanned to that body's end only; a
    // write inside a helper the exit follows is not seen (a block proxy).
    // Decision points pinned in memory by build/test-defect-classes.mjs
    // (callClose included); the consumer by build/test-check-doc-drift.mjs.
    const WRITE_RE = regexOf("^(" + BS + "s*)(?:await" + BS + "s+)?(console" + BS + ".log|" + RECEIVER_PREFIX + "out|process" + BS + ".stdout" + BS + ".write)" + BS + "(");
    const EXIT = "process.exit(";
    // The paren walk and the exit test read the masked view (literals,
    // regexes and comments blanked); the write anchor, the block's indent
    // and the comment-line skip read the raw line.
    const masked = maskCode(lines);
    lines.forEach((l, i) => {
      const m = WRITE_RE.exec(l);
      if (!m || COMMENT_RE.test(l)) return;
      const indent = m[1].length;
      const close = callClose(masked, i, m[0].length - 1);
      for (let j = close.line; j < lines.length; j++) {
        const line = lines[j];
        if (line.trim() === "" || COMMENT_RE.test(line)) continue;
        let rest = j === close.line && close.col !== -1 ? masked[j].slice(close.col + 1) : j === close.line ? masked[j].slice(m[0].length) : masked[j];
        if (j !== close.line && line.search(/\S/) < indent) break; // the block ended
        if (j !== close.line) {
          // A LATER write statement's own callback exit is not an exit after
          // this write — writes to one stream complete in order, so an exit in
          // a later write's callback fires after this one flushed too.
          const m2 = WRITE_RE.exec(line);
          if (m2) {
            const c2 = callClose(masked, j, m2[0].length - 1);
            if (c2.col !== -1) {
              rest = masked[c2.line].slice(c2.col + 1);
              j = c2.line;
            }
          }
        }
        if (rest.includes(EXIT)) {
          hits.push({ line: i + 1, why: `stdout write followed by process.exit( on line ${j + 1} in the same block` });
          return;
        }
      }
    });
  }
  return hits;
}

/**
 * Sweep every mechanical row over the tracked tree: each file is read and
 * split ONCE, then every row in scope runs over its lines. `readText` returns
 * the file's text or null; an unreadable file is returned in `unreadable` (once)
 * and is neither a hit nor a stale allowance — the caller fails on it by name.
 * `scopeCounts` lets the caller floor each scope (a scope matching zero files is
 * a broken enumeration, never a clean tree — the F-095/F-101 signature); a
 * file is counted the moment a scope predicate matches it, BEFORE readability
 * or row coverage is known, so the floor measures the predicates and nothing
 * else (release-gate review, F-377).
 * An allowance sanctions a NUMBER of sites (F-376): exactly that many hits in
 * the file is the sanctioned state; none is a stale allowance; any other
 * count reports every hit in the file so the reader can pick out the new one.
 * @param {string[]} files repo-root-relative tracked paths
 * @param {(f: string) => string | null} readText
 */
export function sweepDefectClasses(files, readText) {
  /** @type {Array<{key: string, file: string, line: number, why: string, origin: string, what: string}>} */
  const hits = [];
  /** @type {Array<{key: string, file: string}>} */
  const stale = [];
  /** @type {string[]} */
  const unreadable = [];
  /** @type {Map<string, Set<string>>} */
  const seenAllowed = new Map(MECHANICAL_CLASSES.map((row) => [row.key, new Set()]));
  const scopeCounts = Object.fromEntries(Object.keys(SCOPES).map((k) => [k, 0]));
  const swept = new Set();
  const liveFor = (/** @type {string} */ key) => /** @type {Set<string>} */ (seenAllowed.get(key));
  for (const f of files) {
    const inScope = Object.keys(SCOPES).filter((name) => SCOPES[name](f));
    for (const name of inScope) scopeCounts[name]++;
    const rows = MECHANICAL_CLASSES.filter((row) => inScope.includes(row.scope));
    if (!rows.length) continue;
    const text = readText(f);
    if (text == null) {
      unreadable.push(f);
      for (const row of rows) if (Object.hasOwn(row.allow, f)) liveFor(row.key).add(f); // unknown, not absent
      continue;
    }
    swept.add(f);
    const lines = text.split(/\r?\n/);
    for (const row of rows) {
      const found = detectRow(row, lines);
      if (!found.length) continue;
      if (Object.hasOwn(row.allow, f)) {
        liveFor(row.key).add(f);
        const { sites } = row.allow[f];
        if (found.length === sites) continue;
        for (const h of found)
          hits.push({
            key: row.key,
            file: f,
            line: h.line,
            why: `${h.why} — ${found.length} site(s) of the shape in a file whose allowance sanctions ${sites} (a new instance, or a sanctioned one gone: fix the site or re-count the allowance deliberately)`,
            origin: row.origin,
            what: row.what,
          });
        continue;
      }
      for (const h of found) hits.push({ key: row.key, file: f, line: h.line, why: h.why, origin: row.origin, what: row.what });
    }
  }
  let allowRows = 0;
  let allowLive = 0;
  for (const row of MECHANICAL_CLASSES) {
    for (const f of Object.keys(row.allow)) {
      allowRows++;
      if (liveFor(row.key).has(f)) allowLive++;
      else stale.push({ key: row.key, file: f });
    }
  }
  return { hits, stale, unreadable, filesSwept: swept.size, allowRows, allowLive, scopeCounts };
}
