#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// sweep-fence-grammar.mjs — the pin AND the census for scanFenceMarkers in
// build/check-doc-drift.mjs (F-337, redesigned at F-338/F-339/F-340).
//
// History, compressed: from F-323 through F-337 every round of fence-grammar
// verification added a layer that verified the previous layer's enumeration
// with another human-authored enumeration — hand census (F-335), whole-function
// census (F-336), a mechanical site generator (F-337) whose operator-class
// list was itself unchecked human input (F-339) — and the judge was the
// full-tree e2e suite at ~45s per mutant, so the sweep could only be a manual
// ritual guarded by a fingerprint nag (F-338). This rewrite changes the
// structure instead of adding a layer:
//
//   1. THE PIN is FENCE_BATTERY below: committed inputs → exact
//      {problems, ok, ranges} outputs for the whole grammar. The function is
//      judged directly, in-process (extracted from its source and compiled) —
//      a behavioral edit reds here immediately.
//   2. THE JUDGE for mutants is that same battery, in memory. No file is ever
//      written, so an interrupted sweep cannot strand a mutant (kill-safe by
//      construction, F-338), and the whole sweep runs in well under a second —
//      cheap enough that test-check-doc-drift.mjs's census gate RUNS it on
//      every suite run instead of pinning a fingerprint and nagging.
//   3. THE CLASS LIST (RULES below) is still human input — this header no
//      longer pretends otherwise (F-339) — and it is CHECKED as far as a
//      check can reach, which is a claim with two halves (F-339 reopen):
//      a construct that OCCUPIES CODE OF ITS OWN is residue-checked — any
//      executable line no rule claims a site on reds against DECLARED_INERT
//      (a reason per entry, exactly as DECLARED_SURVIVORS does), so such a
//      construct reds on arrival. A RELATION between constructs (the order
//      of guards in an if/else-if chain, the order of statements) occupies
//      no line of its own and NO residue granularity can flag it; relation
//      classes are generated explicitly instead (chain: pairwise arm
//      transpositions of every if/else-if chain; stmt: adjacent single-line
//      statement swaps) and their completeness is a DECLARED BOUNDARY, not
//      a checked property. Not generated: reordering of multi-line blocks
//      (their member statements are individually swept; a demonstrated
//      surviving reorder is a finding, per the F-339 reopen precedent).
//
// What this tool does NOT judge: the four consumers' use of the returned
// contract (fenceRanges' loud/withhold semantics, per-caller suffixes). Those
// are pinned by test-check-doc-drift.mjs's own always-running arms
// (G6/G7/G9/G15/G15b/G18) — see the scope-boundary comment at the function.
//
// Usage:
//   node build/sweep-fence-grammar.mjs             battery + residue + sweep
//   node build/sweep-fence-grammar.mjs --census    also print rules, per-site
//                                                  and per-line residue tables
//
// Exit 0 iff: the shipped function passes the battery, every mutant is killed
// or in DECLARED_SURVIVORS (exact both ways), and residue is clean. A
// survivor outside the declared set is a FINDING, never a recorded decision
// (F-327).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const TARGET = join(ROOT, "build", "check-doc-drift.mjs");

// Declared equivalent survivors — each entry names its mutant by label AND
// carries the reason it is allowed to live. The sweep compares its survivor
// set against this list mechanically; a mismatch in either direction fails
// (an undeclared survivor is a finding; a declared one that dies means the
// reason is stale and must be re-examined).
const DECLARED_SURVIVORS = new Map([
  ["num:run[0]->run[1]", "equivalent — a delimiter run is one repeated character, so every index reads the same char"],
  ["cmp:< -> <=", "equivalent — lines[lines.length] is undefined; RegExp.exec coerces it to the string \"undefined\", which matches no delimiter"],
  ["rex1:$-drop", "equivalent — (.*) is greedy to end-of-line already; without $ the match is unchanged"],
  ["stmt:const problems = [] <-> const ranges = []", "equivalent — adjacent independent declarations: neither initializer reads the other binding, so the swap is behavior-identical (any later-added dependence makes the swap throw and this declaration go stale)"],
  ["stmt:const ranges = [] <-> let open = null", "equivalent — adjacent independent declarations: neither initializer reads the other binding, so the swap is behavior-identical"],
  ["stmt:const backtick = run <-> const flush = /^ {0,", "equivalent — backtick and flush derive from disjoint captures (run / indent); neither reads the other, so the swap is behavior-identical"],
]);

// Executable lines the residue check accepts with ZERO mutation sites — each
// with the reason. Everything else executable must carry at least one site.
const DECLARED_INERT = new Map([
  ["function scanFenceMarkers(lines) {", "declaration header — mutating it renames, it does not change behavior; the parameter's reads are swept (idx class) and the return contract has its own class"],
]);

// ── extract the function (same dumb rule the suite's gate used) ──────────────
const src = readFileSync(TARGET, "utf8");
const fileLines = src.split("\n");
const fnStartLine = fileLines.findIndex((l) => l.startsWith("function scanFenceMarkers("));
if (fnStartLine < 0) { console.error("scanFenceMarkers not found in check-doc-drift.mjs"); process.exit(2); }
let fnEndLine = fnStartLine;
while (fnEndLine < fileLines.length && fileLines[fnEndLine] !== "}") fnEndLine++;
const fn = fileLines.slice(fnStartLine, fnEndLine + 1).join("\n");

// ── compile a function-source string into a callable, in memory ──────────────
// The function is closure-free by design (only its parameter); if an edit ever
// makes it reference an outer name, every compile/call here throws and the
// gate reds loudly — that assumption is self-checking, not trusted.
function compile(fnText) {
  return new Function(`${fnText}\nreturn scanFenceMarkers;`)();
}

// ── FENCE_BATTERY — the behavioral pin: input lines → EXACT output ───────────
// Messages are spelled in full (copied from the checker) so a wording or
// interpolation mutant dies here too; editing a message is a loud re-pin of
// the matching rows, never a silent pass. Each case notes the mutant classes
// it was predicted to kill (prediction-first, probe-methodology Addendum 3b).
const MSG_TILDE = "~~~ fence markers are not supported — use plain ``` fences";
const MSG_INDENT = "indented ``` delimiter outside any fence — this checker's grammar is line-local and cannot see list containers, so it cannot tell an indented-code literal from a list-nested fence; keep fence delimiters at 3 or fewer absolute spaces (the repo convention), or restructure the block (F-329)";
const MSG_INFO = "line-leading backtick run with a backtick in its info string — CommonMark says this is NOT a fence opener (a paragraph starting with a code span reads exactly the same way), and silently picking either side lets one line open a phantom span; rework the line so it does not start with a delimiter run (F-329)";
const MSG_INSIDE = (openLine0) => `fence-opener-shaped line inside the fence opened at line ${openLine0 + 1} — a lost closer upstream, or an unmarked nested fence; close the open fence, or wrap the example in a longer-run fence (\`\`\`\`) so delimiter and content cannot be confused (F-329)`;
const MSG_UNCLOSED = "``` fence opened here is never closed — an unclosed fence makes pairing undefined and silently hides content (F-183)";
/** @returns {{problems: Array<[number, string]>, ok: boolean, ranges: Array<[number, number]>}} */
const out = (problems, ranges) => ({ problems, ok: problems.length === 0, ranges });

// name, lines, expected — the expected shape is out()'s return, typed once there.
/** @type {Array<[string, string[], ReturnType<typeof out>]>} */
const FENCE_BATTERY = [
  // name, lines, expected — kills-prediction in the trailing comment
  ["empty input", [], out([], [])], // seeded-init (problems/ranges)
  ["plain pair", ["# t", "", "```", "code", "```", ""], out([], [[2, 4]])], // most classes: alt-right, {3,}->{4,}, *-drops, cmp:>= -> >, !-doublings, ifneg, destructure, rec:line, pairswap, ranges.push void, ret drops, = null TDZ
  ["info string", ["```js", "x", "```"], out([], [[0, 2]])],
  ["tilde on line 0", ["~~~"], out([[0, MSG_TILDE]], [])], // for-init 0->1, alt keeps-left, run[0] cmp, problems.push void, lines[i]->lines[i+1], num:===0
  ["tilde on last line (no-trailing-newline shape)", ["x", "~~~"], out([[1, MSG_TILDE]], [])], // F-337's upper bound: i<len narrowing, lhs+1
  ["three-space opener is flush", ["   ```", "x", "```"], out([], [[0, 2]])], // flush {0,3}->{0,2}
  ["four-space opener refused", ["    ```"], out([[0, MSG_INDENT]], [])], // flush {0,3}->{0,4}, flush ^-drop, flush $-drop
  ["tab opener refused", ["\t```"], out([[0, MSG_INDENT]], [])], // rex1 \s->space, flush space->[ \t]
  ["backtick in info string refused", ["```a`b"], out([[0, MSG_INFO]], [])], // .includes -> .startsWith
  ["longer closer closes", ["```", "x", "````"], out([], [[0, 2]])], // cmp:>= -> ===
  ["shorter closer is content, then unclosed", ["````", "x", "```"], out([[0, MSG_UNCLOSED]], [])], // EOF guard, opener records run
  ["whitespace-decorated closer closes", ["```", "x", "``` "], out([], [[0, 2]])], // .trim() dropped
  ["decorated closer refused, fence stays open", ["```", "x", "``` tail"], out([[2, MSG_INSIDE(0)], [0, MSG_UNCLOSED]], [])], // trim ===/!==, tmpl num open.line+1
  ["two sequential fences", ["```", "a", "```", "```", "b", "```"], out([], [[0, 2], [3, 5]])], // i++ -> i+=2, open reset = null -> = open, continue dropped (throws)
  ["tilde run inside is content", ["```", "~~~", "```"], out([], [[0, 2]])], // closer && -> || (backtick conjunct)
  ["indented run inside is content", ["```", "    ```", "```"], out([], [[0, 2]])], // closer && -> || (flush conjunct)
  ["shorter run inside is content", ["````", "```", "````"], out([], [[0, 2]])],
  ["opener-shaped line inside refused, real closer still closes", ["```", "````x", "```"], out([[1, MSG_INSIDE(0)]], [[0, 2]])],
  ["mid-line run is not a delimiter", ["x```"], out([], [])], // rex1 ^-drop
  ["two-backtick run is not a delimiter", ["``"], out([], [])], // {3,}->{2,} backtick half
  ["two-tilde run is not a delimiter", ["~~"], out([], [])], // {3,}->{2,} tilde half — found by the sweep itself on first run: the backtick probe alone left the tilde bound unjudged
  ["four-backtick pair", ["````", "x", "````"], out([], [[0, 2]])],
  ["one-space opener opens, unclosed at EOF", [" ```"], out([[0, MSG_UNCLOSED]], [])], // opener records line, EOF cite
  // Guard-ORDER discriminators (F-339 reopen): each input satisfies TWO
  // refusal conditions at once, so it pins which guard fires FIRST — the
  // chain-rule transpositions die here and nowhere else.
  ["indented tilde run: tilde outranks indent", ["    ~~~"], out([[0, MSG_TILDE]], [])], // chain !backtick <-> !flush (tester's M1)
  ["indented backtick run with backtick in info: indent outranks info", ["    ```a`b"], out([[0, MSG_INDENT]], [])], // chain !flush <-> includes (tester's M2)
  ["tilde run with backtick in info: tilde outranks info", ["~~~a`b"], out([[0, MSG_TILDE]], [])], // chain !backtick <-> includes (the non-adjacent pair)
];

function outcome(f, lines) {
  try { return JSON.stringify(f(lines.slice())); }
  catch (e) { return `THREW ${e.constructor.name}: ${e.message}`; }
}

// ── code mask: which characters of fn are executable code (mutable) ──────────
// States: code · dq ("…") · tpl (`…`) · tplExpr (${…} inside a template — code
// again) · rex (regex literal) · comment (// to end of line). Regex literals
// are recognized as a `/` whose previous non-space character is `=` or `(` —
// true for this function today; if an edit adds a division the compile step
// or residue goes loudly wrong, it cannot silently pass.
const mask = new Array(fn.length).fill(false);
const regexSpans = [];
{
  let st = "code";
  let rexStart = -1;
  let braceDepth = 0;
  let prevNonSpace = "";
  for (let i = 0; i < fn.length; i++) {
    const c = fn[i];
    if (st === "code") {
      if (c === '"') { st = "dq"; continue; }
      if (c === "`") { st = "tpl"; continue; }
      if (c === "/" && fn[i + 1] === "/") { st = "comment"; continue; }
      if (c === "/" && (prevNonSpace === "=" || prevNonSpace === "(")) { st = "rex"; rexStart = i; continue; }
      mask[i] = true;
      if (!/\s/.test(c)) prevNonSpace = c;
    } else if (st === "dq") {
      if (c === "\\") { i++; continue; }
      if (c === '"') st = "code";
    } else if (st === "tpl") {
      if (c === "\\") { i++; continue; }
      if (c === "`") { st = "code"; continue; }
      if (c === "$" && fn[i + 1] === "{") { st = "tplExpr"; braceDepth = 0; i++; continue; }
    } else if (st === "tplExpr") {
      if (c === "{") braceDepth++;
      else if (c === "}") {
        if (braceDepth === 0) { st = "tpl"; continue; }
        braceDepth--;
      }
      mask[i] = true;
      if (!/\s/.test(c)) prevNonSpace = c;
    } else if (st === "rex") {
      if (c === "\\") { i++; continue; }
      if (c === "/") { regexSpans.push([rexStart, i + 1]); st = "code"; prevNonSpace = "/"; }
    } else if (st === "comment") {
      if (c === "\n") st = "code";
    }
  }
}
const codeAt = (a, b) => { for (let i = a; i < b; i++) if (!mask[i]) return false; return true; };
const eachCode = (re, cb) => { for (const m of fn.matchAll(re)) if (codeAt(m.index, m.index + m[0].length)) cb(m); };

// Find the `)` matching the `(` at fn[openAt], counting parens only at masked
// (code) positions so parens inside strings never shift the depth.
function matchParen(openAt) {
  let depth = 0;
  for (let i = openAt; i < fn.length; i++) {
    if (!mask[i]) continue;
    if (fn[i] === "(") depth++;
    else if (fn[i] === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
}
function matchBrace(openAt) {
  let depth = 0;
  for (let i = openAt; i < fn.length; i++) {
    if (!mask[i]) continue;
    if (fn[i] === "{") depth++;
    else if (fn[i] === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}
// Advance past whitespace and unmasked (comment/string-interior) characters
// to the next masked code token.
function skipCode(i) {
  while (i < fn.length && (!mask[i] || /\s/.test(fn[i]))) i++;
  return i;
}
// Parse the if / else-if chain whose `if` keyword starts at fn[headAt].
// Returns {arms: [{cond:[a,b], body:[a,b]}], elseBody: [a,b]|null, end} —
// every range indexes the ORIGINAL text, so a swap is a splice of original
// substrings and an un-swapped reconstruction is byte-identical by
// construction. Each parsed condition is compile-checked as an expression;
// a misparse exits 2 loudly instead of sweeping garbage.
function parseChain(headAt) {
  const arms = [];
  let i = headAt;
  let elseBody = null;
  let end;
  for (;;) {
    const openAt = skipCode(i + 2);
    if (fn[openAt] !== "(") return null;
    const closeAt = matchParen(openAt);
    if (closeAt < 0) return null;
    const cond = [openAt + 1, closeAt];
    try { new Function(`return (${fn.slice(cond[0], cond[1])});`); } catch {
      console.error(`chain parser misparse — condition does not compile: ${fn.slice(cond[0], cond[1])}`);
      process.exit(2);
    }
    const j = skipCode(closeAt + 1);
    let body;
    if (fn[j] === "{") { const bc = matchBrace(j); if (bc < 0) return null; body = [j, bc + 1]; }
    else { let k = j; while (k < fn.length && !(mask[k] && fn[k] === ";")) k++; body = [j, k + 1]; }
    arms.push({ cond, body });
    const e = skipCode(body[1]);
    if (fn.slice(e, e + 4) === "else" && mask[e]) {
      const f = skipCode(e + 4);
      if (fn.slice(f, f + 2) === "if") { i = f; continue; }
      if (fn[f] === "{") { const bc = matchBrace(f); if (bc < 0) return null; elseBody = [f, bc + 1]; }
      else { let k = f; while (k < fn.length && !(mask[k] && fn[k] === ";")) k++; elseBody = [f, k + 1]; }
      end = elseBody[1];
    } else {
      end = body[1];
    }
    return { arms, elseBody, end };
  }
}

// ── RULES — the operator-class table ─────────────────────────────────────────
// Human input, but CHECKED: the residue assertion below reds any executable
// line no rule claims. Each entry: {cls, what, gen(add)} — gen derives every
// site of the class from the function source, skipping none by judgment.
const RULES = [
  { cls: "cmp", what: "every comparison operator flipped and tightened", gen: (add) => {
    eachCode(/===/g, (m) => add("cmp:=== -> !==", m.index, 3, "!=="));
    eachCode(/!==/g, (m) => add("cmp:!== -> ===", m.index, 3, "==="));
    eachCode(/>=/g, (m) => { add("cmp:>= -> >", m.index, 2, ">"); add("cmp:>= -> ===", m.index, 2, "==="); });
    eachCode(/(?<![<>=!])<(?!=)/g, (m) => { add("cmp:< -> <=", m.index, 1, "<="); add("cmp:< bound -1 (lhs +1)", m.index, 1, "+ 1 <"); });
  } },
  { cls: "log", what: "each && flipped to ||; each unary ! doubled", gen: (add) => {
    eachCode(/&&/g, (m) => add("log:&& -> ||", m.index, 2, "||"));
    eachCode(/!(?![=!])(?=[\w(])/g, (m) => add("log:! -> !!", m.index, 1, "!!"));
  } },
  { cls: "ifneg", what: "every if / else-if condition negated whole (bare truthiness guards included — F-339)", gen: (add) => {
    eachCode(/\bif \(/g, (m) => {
      const openAt = m.index + m[0].length - 1;
      const closeAt = matchParen(openAt);
      if (closeAt < 0) return;
      const cond = fn.slice(openAt + 1, closeAt);
      add("ifneg:condition negated", openAt + 1, cond.length, `!(${cond})`);
    });
  } },
  { cls: "chain", what: "every if/else-if chain: each PAIR of guarded arms transposed, guard carrying its body (F-339 reopen: guard ORDER is a relation, invisible to line residue; a plain if/else order flip is ifneg's negation, already generated)", gen: (add) => {
    eachCode(/\bif\b/g, (m) => {
      const before = fn.slice(Math.max(0, m.index - 8), m.index).replace(/\s+/g, " ").trimEnd();
      if (before.endsWith("else")) return; // continuation of a chain, not a head
      const chain = parseChain(m.index);
      if (!chain || chain.arms.length < 2) return;
      const { arms, end } = chain;
      const t = (r) => fn.slice(r[0], r[1]).replace(/\s+/g, " ").trim().slice(0, 20);
      for (let a = 0; a < arms.length - 1; a++) {
        for (let b = a + 1; b < arms.length; b++) {
          const A = arms[a], B = arms[b];
          const repl =
            fn.slice(m.index, A.cond[0]) + fn.slice(B.cond[0], B.cond[1]) +
            fn.slice(A.cond[1], A.body[0]) + fn.slice(B.body[0], B.body[1]) +
            fn.slice(A.body[1], B.cond[0]) + fn.slice(A.cond[0], A.cond[1]) +
            fn.slice(B.cond[1], B.body[0]) + fn.slice(A.body[0], A.body[1]) +
            fn.slice(B.body[1], end);
          add(`chain:${t(A.cond)} <-> ${t(B.cond)}`, m.index, end - m.index, repl);
        }
      }
    });
  } },
  { cls: "stmt", what: "adjacent single-line statements at equal indent swapped (the order relation between statements; multi-line block reordering is NOT generated — declared boundary, see header)", gen: (add) => {
    const lines = fn.split("\n");
    const starts = [];
    let pos = 0;
    for (const l of lines) { starts.push(pos); pos += l.length + 1; }
    const codeOf = (li) => {
      let s = "";
      for (let i = starts[li]; i < starts[li] + lines[li].length; i++) if (mask[i]) s += fn[i];
      return s.trim();
    };
    const simple = (li) => {
      const c = codeOf(li);
      return c.endsWith(";") && !c.startsWith("}") && !c.startsWith("else");
    };
    const indent = (li) => lines[li].match(/^\s*/)[0];
    for (let li = 0; li < lines.length - 1; li++) {
      if (!simple(li) || !simple(li + 1) || indent(li) !== indent(li + 1)) continue;
      const at = starts[li];
      const len = lines[li].length + 1 + lines[li + 1].length;
      const head = (l) => l.trim().replace(/;.*$/, "").replace(/\s+/g, " ").slice(0, 20);
      add(`stmt:${head(lines[li])} <-> ${head(lines[li + 1])}`, at, len, `${lines[li + 1]}\n${lines[li]}`);
    }
  } },
  { cls: "num", what: "every numeric literal in code bumped by one", gen: (add) => {
    eachCode(/\b\d+\b/g, (m) => {
      const n = Number(m[0]);
      const ctx = fn.slice(Math.max(0, m.index - 12), m.index);
      const label = ctx.includes("run[") ? "num:run[0]->run[1]" : `num:${n}->${n + 1}`;
      add(label, m.index, m[0].length, String(n + 1));
    });
  } },
  { cls: "meth", what: "each deciding method call weakened or dropped", gen: (add) => {
    eachCode(/\.trim\(\)/g, (m) => add("meth:.trim() dropped", m.index, m[0].length, ""));
    eachCode(/\.includes\(/g, (m) => add("meth:.includes -> .startsWith", m.index, m[0].length, ".startsWith("));
  } },
  { cls: "ctl", what: "continue dropped; loop step doubled", gen: (add) => {
    eachCode(/\bcontinue\b/g, (m) => add("ctl:continue dropped", m.index, m[0].length, ";"));
    eachCode(/\bi\+\+/g, (m) => add("ctl:i++ -> i += 2", m.index, m[0].length, "i += 2"));
  } },
  { cls: "fx", what: "each state-writing call voided; each null assignment made inert", gen: (add) => {
    eachCode(/\b(problems|ranges)\.push\b/g, (m) => add(`fx:${m[1]}.push voided`, m.index, m[0].length, "void"));
    eachCode(/= null/g, (m) => add("fx:= null -> = open", m.index, m[0].length, "= open"));
  } },
  { cls: "init", what: "each empty-array initializer seeded (F-339: initializers carried no sites)", gen: (add) => {
    eachCode(/= \[\]/g, (m) => add("init:[] seeded", m.index, m[0].length, "= [[0, 0]]"));
  } },
  { cls: "destr", what: "array-destructuring patterns: leading hole dropped; each adjacent pair swapped (F-339)", gen: (add) => {
    eachCode(/\[([^\]]*,[^\]]*)\](?= =)/g, (m) => {
      const parts = m[1].split(",").map((s) => s.trim());
      const span = m[0].length;
      if (parts[0] === "") add("destr:leading hole dropped", m.index, span, `[${parts.slice(1).join(", ")}]`);
      for (let j = 0; j < parts.length - 1; j++) {
        if (parts[j] === "" || parts[j + 1] === "") continue;
        const sw = parts.slice();
        [sw[j], sw[j + 1]] = [sw[j + 1], sw[j]];
        add(`destr:${parts[j]} <-> ${parts[j + 1]}`, m.index, span, `[${sw.join(", ")}]`);
      }
    });
  } },
  { cls: "pair", what: "two-element array literals: element order inverted (F-339: the ledger named inversion, no rule produced it)", gen: (add) => {
    eachCode(/\[([\w$.]+), ([\w$.]+)\](?! =)/g, (m) => add(`pair:[${m[1]}, ${m[2]}] inverted`, m.index, m[0].length, `[${m[2]}, ${m[1]}]`));
  } },
  { cls: "field", what: "object-literal assignments: each field dropped (F-339)", gen: (add) => {
    eachCode(/= (\{ [^{}]+ \})/g, (m) => {
      const fields = m[1].slice(1, -1).trim().split(", ");
      if (fields.length < 2) return;
      fields.forEach((f, j) => {
        const kept = fields.filter((_, k) => k !== j);
        add(`field:${f.split(":")[0].trim()} dropped`, m.index, m[0].length, `= { ${kept.join(", ")} }`);
      });
    });
  } },
  { cls: "idx", what: "identifier-indexed reads offset by one (F-339: lines[i] had no site)", gen: (add) => {
    eachCode(/\b[A-Za-z_$][\w$]*\[i\]/g, (m) => add(`idx:${m[0]} -> [i + 1]`, m.index, m[0].length, m[0].replace("[i]", "[i + 1]")));
  } },
  { cls: "rec", what: "each recorded field value bumped", gen: (add) => {
    eachCode(/\bline: i\b/g, (m) => add("rec:line: i -> i + 1", m.index, m[0].length, "line: i + 1"));
    eachCode(/\brun: run\.length\b/g, (m) => add("rec:run: run.length -> + 1", m.index, m[0].length, "run: run.length + 1"));
  } },
  { cls: "ret", what: "each returned field dropped (the F-336 lesson made mechanical)", gen: (add) => {
    const ret = "return { problems, ok: problems.length === 0, ranges };";
    const at = fn.indexOf(ret);
    if (at < 0) { console.error("return contract line not found — function changed; update this rule"); process.exit(2); }
    add("ret:problems dropped", at, ret.length, "return { ok: problems.length === 0, ranges };");
    add("ret:ok dropped", at, ret.length, "return { problems, ranges };");
    add("ret:ranges dropped", at, ret.length, "return { problems, ok: problems.length === 0 };");
  } },
  { cls: "rex", what: "regex internals: every quantifier bound, anchor, alternation branch, literal space, \\s class, * quantifier", gen: (add) => {
    regexSpans.forEach(([a, b], ri) => {
      const body = fn.slice(a, b);
      const tag = `rex${ri + 1}`;
      for (const m of body.matchAll(/\{(\d+),\}/g)) {
        const n = Number(m[1]);
        if (n > 0) add(`${tag}:{${n},}->{${n - 1},}`, a + m.index, m[0].length, `{${n - 1},}`);
        add(`${tag}:{${n},}->{${n + 1},}`, a + m.index, m[0].length, `{${n + 1},}`);
      }
      for (const m of body.matchAll(/\{(\d+),(\d+)\}/g)) {
        const [lo, hi] = [Number(m[1]), Number(m[2])];
        if (hi > lo) add(`${tag}:{${lo},${hi}}->{${lo},${hi - 1}}`, a + m.index, m[0].length, `{${lo},${hi - 1}}`);
        add(`${tag}:{${lo},${hi}}->{${lo},${hi + 1}}`, a + m.index, m[0].length, `{${lo},${hi + 1}}`);
        add(`${tag}:{${lo},${hi}}->{${lo + 1},${hi}}`, a + m.index, m[0].length, `{${lo + 1},${hi}}`);
      }
      for (const m of body.matchAll(/\^/g)) add(`${tag}:^-drop`, a + m.index, 1, "");
      for (const m of body.matchAll(/\$/g)) add(`${tag}:$-drop`, a + m.index, 1, "");
      for (const m of body.matchAll(/\(([^()|]+)\|([^()|]+)\)/g)) {
        add(`${tag}:alt keeps left`, a + m.index, m[0].length, `(${m[1]})`);
        add(`${tag}:alt keeps right`, a + m.index, m[0].length, `(${m[2]})`);
      }
      for (const m of body.matchAll(/ /g)) add(`${tag}:space->[ \\t]`, a + m.index, 1, "[ \\t]");
      for (const m of body.matchAll(/\\s/g)) add(`${tag}:\\s->space`, a + m.index, 2, " ");
    });
  } },
];

// Generate all sites; dedupe identical edits (two rules producing the same
// (at,len,repl) is one mutant); disambiguate colliding labels with @offset.
const raw = [];
for (const rule of RULES) rule.gen((label, at, len, repl) => raw.push({ cls: rule.cls, label, at, len, repl }));
const seen = new Map();
for (const s of raw) {
  const key = `${s.at}:${s.len}:${s.repl}`;
  if (!seen.has(key)) seen.set(key, s);
}
const sites = [...seen.values()].sort((x, y) => x.at - y.at);
{
  // Colliding labels are disambiguated by their (unique) source offset.
  const counts = new Map();
  for (const s of sites) counts.set(s.label, (counts.get(s.label) ?? 0) + 1);
  for (const s of sites) if (counts.get(s.label) > 1) s.label = `${s.label}@${s.at}`;
}

// ── residue: every executable line is claimed by a site or declared inert ────
const fnLines = fn.split("\n");
const lineSpans = [];
{
  let pos = 0;
  for (const l of fnLines) { lineSpans.push([pos, pos + l.length]); pos += l.length + 1; }
}
const STRUCTURAL = /^[{}();]*(else)?[{}();]*$/;
const residue = [];
const lineSiteCounts = [];
for (let li = 0; li < fnLines.length; li++) {
  const [a, b] = lineSpans[li];
  let codeText = "";
  for (let i = a; i < b; i++) if (mask[i]) codeText += fn[i];
  codeText = codeText.replace(/\s+/g, " ").trim();
  const executable = codeText !== "" && !STRUCTURAL.test(codeText.replace(/\s/g, ""));
  const nSites = sites.filter((s) => (s.at >= a && s.at < b) || (s.at < a && s.at + s.len > a)).length;
  lineSiteCounts.push({ li, executable, nSites, text: fnLines[li] });
  if (executable && nSites === 0 && !DECLARED_INERT.has(fnLines[li].trim())) residue.push(fnLines[li].trim());
}
const staleInert = [...DECLARED_INERT.keys()].filter((t) => {
  const row = lineSiteCounts.find((r) => r.text.trim() === t);
  return !row || !row.executable || row.nSites > 0;
});

// ── run ──────────────────────────────────────────────────────────────────────
const census = process.argv.includes("--census");
console.log(`census: ${sites.length} mutation sites over scanFenceMarkers (fn lines ${fnStartLine + 1}-${fnEndLine + 1})`);
if (census) {
  console.log("rules:");
  for (const r of RULES) console.log(`  ${r.cls.padEnd(6)} ${r.what}`);
  console.log("sites:");
  for (const [i, s] of sites.entries()) {
    const line = fn.slice(0, s.at).split("\n").length + fnStartLine;
    console.log(`  [${String(i).padStart(2)}] L${line}  ${s.label}`);
  }
  console.log("per-line residue:");
  for (const r of lineSiteCounts) {
    const markType = !r.executable ? "structural/comment" : r.nSites > 0 ? "" : DECLARED_INERT.has(r.text.trim()) ? "DECLARED INERT" : "RESIDUE";
    console.log(`  L${String(r.li + fnStartLine + 1).padStart(3)}  sites=${String(r.nSites).padStart(2)}  ${markType.padEnd(18)} ${r.text.trim().slice(0, 60)}`);
  }
}

// 1. Battery conformance: the shipped function must produce the exact table.
const orig = compile(fn);
const expected = FENCE_BATTERY.map(([name, lines, expect]) => ({ name, lines, want: JSON.stringify(expect) }));
const batteryFails = expected.filter((c) => outcome(orig, c.lines) !== c.want);
if (batteryFails.length) {
  console.log(`battery: FAIL — ${batteryFails.length} case(s) diverge from the pinned table:`);
  for (const c of batteryFails) console.log(`  ${c.name}\n    want ${c.want}\n    got  ${outcome(orig, c.lines)}`);
} else {
  console.log(`battery: PASS (${FENCE_BATTERY.length} cases, shipped function conforms)`);
}

// 2. Residue.
if (residue.length === 0 && staleInert.length === 0) {
  console.log(`residue: NONE outside DECLARED_INERT (${lineSiteCounts.filter((r) => r.executable).length} executable lines, every one claimed or declared with a reason)`);
} else {
  if (residue.length) console.log(`residue: ${residue.length} executable line(s) with no mutation site and no DECLARED_INERT row (an unmodelled construct — extend RULES or declare with a reason):\n  ${residue.join("\n  ")}`);
  if (staleInert.length) console.log(`residue: ${staleInert.length} stale DECLARED_INERT row(s) (line gone, non-executable, or now claimed — remove or update):\n  ${staleInert.join("\n  ")}`);
}

// 3. Sweep: every site, judged in memory against the battery. No file writes.
let killed = 0;
const survivors = [];
for (const [i, s] of sites.entries()) {
  const mutatedFn = fn.slice(0, s.at) + s.repl + fn.slice(s.at + s.len);
  let verdict;
  let firstKill = "";
  try {
    const mutant = compile(mutatedFn);
    const killCase = expected.find((c) => outcome(mutant, c.lines) !== c.want);
    if (killCase) { verdict = "KILLED"; firstKill = killCase.name; } else verdict = "SURVIVED";
  } catch (e) {
    verdict = "KILLED"; firstKill = `does not compile: ${e.message}`;
  }
  // Prediction column (W10 rule 2): the declared-survivor map IS the
  // prediction, written before any run — a declared label is expected to
  // SURVIVE, everything else to be KILLED — so every row the census prints
  // carries its pred: token and the bus's copy-out grammar
  // (check-stale-facts) is satisfied by pasting these lines verbatim. A row
  // whose measurement disagrees with its prediction is a MISMATCH: an
  // undeclared survivor is a finding; a declared label that dies is a stale
  // declaration (the comparison line below reports both).
  const pred = DECLARED_SURVIVORS.has(s.label) ? "pred:SURVIVE" : "pred:KILL";
  const mismatch = (verdict === "SURVIVED") !== DECLARED_SURVIVORS.has(s.label) ? "  MISMATCH" : "";
  if (verdict === "KILLED") {
    killed++;
    if (census) console.log(`${pred}  KILLED    [${i}] ${s.label} | ${firstKill}${mismatch}`);
  } else {
    survivors.push(s.label);
    console.log(`${pred}  SURVIVED  [${i}] ${s.label}${DECLARED_SURVIVORS.has(s.label) ? " (declared: " + DECLARED_SURVIVORS.get(s.label) + ")" : " (UNDECLARED)"}${mismatch}`);
  }
}
const undeclared = survivors.filter((l) => !DECLARED_SURVIVORS.has(l));
const staleDecls = [...DECLARED_SURVIVORS.keys()].filter((l) => !survivors.includes(l));
console.log(`sweep: ${sites.length} points, ${killed} killed (in-memory battery judge), survivors=[${survivors.join(" · ")}]`);
console.log(`declared-survivor comparison: ${undeclared.length === 0 && staleDecls.length === 0 ? "EXACT" : "MISMATCH"}${undeclared.length ? " — UNDECLARED (a finding, not a decision): " + undeclared.join(" · ") : ""}${staleDecls.length ? " — STALE DECLARATIONS (label gone or mutant now dies): " + staleDecls.join(" · ") : ""}`);

const green = batteryFails.length === 0 && residue.length === 0 && staleInert.length === 0 && undeclared.length === 0 && staleDecls.length === 0;
// exitCode, never process.exit after the census: the --census copy-out is ~13 KB,
// past a macOS pipe's first chunk (the stdout-then-exit class this tool's own
// output feeds — W10 review round).
process.exitCode = green ? 0 : 1;
