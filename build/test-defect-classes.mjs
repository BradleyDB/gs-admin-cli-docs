#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// test-defect-classes.mjs — the defect-class DETECTORS, judged in memory
// (GP-B5 W10 / B15, 2026-09-03 — bus F-364, F-365).
//
// What this pins: detectRow (and callClose through it) from
// build/defect-classes.mjs, fed each case's lines directly and asserted on
// the EXACT hits — line and why — for every mechanical row. Cases are
// enumerated from the DETECTORS' decision points, never from the cases an
// earlier round happened to write (AGENTS.md § Review-gate rules, rule 1):
//   - every alternative of the stdout-then-exit row's WRITE_RE (bare and
//     receiver-qualified out — F-365 — console.log, process.stdout.write, the
//     await prefix, the line-start anchor that keeps a definition out);
//   - COMMENT_RE on every detector kind, and on the write line and the block
//     lines of the stdout row separately;
//   - callClose: string, single-quote and template literals, the escape skip,
//     a template spanning lines, the 40-line bound and its declared
//     consequence (an unbounded call closes on its own line);
//   - the block rule: same indent, deeper, blank lines, comment lines, the
//     dedent boundary (an else branch is a different block), the same-line
//     rest after the call closes;
//   - the callback exemption, a LATER write's callback, the first-exit return;
//   - unawaited-finish's two lookbehinds; fence-state-toggle's backreference;
//     marker-parity-arithmetic's comparator set; script-name-literal's name
//     class and its `${msg}` anchor; the needles rows' first-needle-wins order.
// The planted() inputs of build/test-check-doc-drift.mjs's former 19a/19b*/
// 19o*/19g/19h/19i cases are carried over verbatim. That suite keeps only the
// CONSUMER pins — the check reads the registry and reds naming file:line and
// the class (the F-365 site as the planted mutant), a stale allowance, an
// unreadable file, the scope floor, the manual-key join, the pass line —
// because the consumer feeds every row through the one detectRow call pinned
// here (sweepDefectClasses: `for (const row of rows) detectRow(row, lines)`),
// so a detector shape cannot go green there while it is red here.
//
// Cost: milliseconds, nothing written — a detector mutant is judged here, not
// by a ~75-second scratch-tree run of the e2e suite (F-364).
//
// Declared boundaries, pinned AS THEY BEHAVE so a change is a deliberate edit
// of the row and of this file together (each is marked "boundary" below):
// a two-level receiver (`a.b.out(`, `a.b.finish(`) is not the helper's
// handle; a needle is matched with its paren; the script-name row reads
// kebab-case names interpolating `${msg}` only. Closed by the B15 verdict
// round: a receiver-qualified `finish(` is an instance (F-367 — the F-365
// shape one row over) and `await` followed by any run of whitespace is
// awaited (the false alarm the tester measured). Pinned from the tester's
// outside-frame sweep (F-366): a `$`-initial receiver, a spaced `= ! x`
// self-toggle, and a write whose call never closes before EOF within the
// 40-line window (the array guard, not the bound — a crash, not a miss).
// Not pinned, by argument: an unknown detector kind yields no hits — the
// Detector typedef under the tsc gate refuses it before this suite could;
// the needles row's `n !== undefined` is equivalent to a bare `n` (they
// differ only for an empty needle, and no row has one).
//
// A floor at the end: every mechanical row has at least one positive and one
// negative case here, so a row added to the registry without a case reds.
//
// Run:  node build/test-defect-classes.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { MECHANICAL_CLASSES, COMMENT_RE, detectRow, sweepDefectClasses, maskCode } from "./defect-classes.mjs";

let passed = 0;
let failures = 0;
/** @param {string} label @param {boolean} cond @param {*} [detail] */
function check(label, cond, detail) {
  if (cond) { passed++; return; }
  failures++;
  console.log(`FAIL  ${label}`);
  if (detail !== undefined) console.log(`      ${typeof detail === "string" ? detail.slice(0, 600) : JSON.stringify(detail)}`);
}

const rows = new Map(MECHANICAL_CLASSES.map((r) => [r.key, r]));
/** @param {string} key */
const rowOf = (key) => {
  const r = rows.get(key);
  if (!r) throw new Error(`no mechanical row "${key}" in build/defect-classes.mjs — a renamed key is renamed here too (keys are append-only)`);
  return r;
};
/** The why a line-regex row reports, read off the row's own source. @param {string} key */
const matchesWhy = (key) => {
  const d = rowOf(key).detect;
  if (d.kind !== "line-regex") throw new Error(`${key} is not a line-regex row`);
  return `matches /${d.source}/`;
};
/** @param {number} line @param {string} key */
const hit = (line, key) => ({ line, why: matchesWhy(key) });
/** @param {number} line @param {string} needle */
const spells = (line, needle) => ({ line, why: `spells ${JSON.stringify(needle)}` });
/** @param {number} line @param {number} exitLine */
const exitOn = (line, exitLine) => ({ line, why: `stdout write followed by process.exit( on line ${exitLine} in the same block` });

/** @type {Map<string, {pos: number, neg: number}>} */
const seen = new Map();
/**
 * Feed the case's lines to the row's detector and assert the exact hit list.
 * @param {string} key @param {string} label @param {string} text
 * @param {Array<{line: number, why: string}>} want
 */
function expectHits(key, label, text, want) {
  const got = detectRow(rowOf(key), text.split("\n"));
  check(`${key}: ${label}`, JSON.stringify(got) === JSON.stringify(want), { got, want });
  const s = seen.get(key) ?? { pos: 0, neg: 0 };
  if (want.length) s.pos++; else s.neg++;
  seen.set(key, s);
}

const BT = String.fromCharCode(96);
const BS = String.fromCharCode(92);

// ── COMMENT_RE itself: the prose exemption every detector applies ────────────
for (const l of ["// x", "  // x", " * x", "/* x", " */", "\t// tabbed"]) check(`COMMENT_RE: ${JSON.stringify(l)} is a comment line`, COMMENT_RE.test(l));
for (const l of ["a // b", 'const s = "/* not";', "x * 2", "out(x); // trailing prose"]) check(`COMMENT_RE: ${JSON.stringify(l)} is code`, !COMMENT_RE.test(l));

// ── fence-state-toggle (line-regex with a backreference) ─────────────────────
{
  const K = "fence-state-toggle";
  expectHits(K, "19a input: a self-toggle statement", "let zzFence = false; zzFence = !zzFence;", [hit(1, K)]);
  expectHits(K, "indented, no spaces around =", "    inFence=!inFence", [hit(1, K)]);
  expectHits(K, "line numbering: the hit names the 1-based line", "const a = 1;\nconst b = 2;\ninFence = !inFence;\nconst c = 3;", [hit(3, K)]);
  expectHits(K, "F-366(b): a space between ! and the identifier is still the self-toggle", "const a = 1;\nconst b = 2;\n  inFence = ! inFence;", [hit(3, K)]);
  expectHits(K, "a different identifier on the right is not a self-toggle (backreference)", "inFence = !closed;", []);
  expectHits(K, "double negation is a coercion, not a toggle", "ok = !!ok;", []);
  expectHits(K, "a comment line spelling the shape is prose", "// inFence = !inFence — the F-323 shape", []);
  expectHits(K, "a block-comment line spelling the shape is prose", " * inFence = !inFence", []);
}

// ── marker-parity-arithmetic (line-regex, comparator set) ────────────────────
{
  const K = "marker-parity-arithmetic";
  expectHits(K, "strict equality", "if (i % 2 === 0) open = i;", [hit(1, K)]);
  expectHits(K, "strict inequality", "if (i % 2 !== 0) open = i;", [hit(1, K)]);
  expectHits(K, "loose equality", "if (i % 2 == 0) open = i;", [hit(1, K)]);
  expectHits(K, "loose inequality, no spaces", "if (i%2!=0) open = i;", [hit(1, K)]);
  expectHits(K, "a modulus other than 2 is not parity pairing", "if (i % 3 !== 0) x = i;", []);
  expectHits(K, "a modulus with no comparator is arithmetic, not a test", "const half = n % 2;", []);
  expectHits(K, "a comment line spelling the shape is prose", "// i % 2 === 0 pairs by position (F-329)", []);
}

// ── provenance-literal (needles) ─────────────────────────────────────────────
{
  const K = "provenance-literal";
  const d = rowOf(K).detect;
  if (d.kind !== "needles") throw new Error(`${K} is not a needles row`);
  const [N0, N1, N2] = d.needles;
  check(`${K}: the row carries the three needles this suite reads`, d.needles.length === 3, d.needles);
  expectHits(K, "19g input: a literal outside the resolver's renderer", `const zz = ${JSON.stringify(N0)};`, [spells(1, N0)]);
  expectHits(K, "the second needle mid-line", `  reason = flag ? ${JSON.stringify(N1)} : other;`, [spells(1, N1)]);
  expectHits(K, "the third needle in a template", `  return ${BT}${N2} ${"$"}{p}${BT};`, [spells(1, N2)]);
  expectHits(K, "two needles on one line: the why names the FIRST in the row's list, not the first in the line", `x = ${JSON.stringify(N1)} + ${JSON.stringify(N0)};`, [spells(1, N0)]);
  expectHits(K, "a near-miss spelling is not the needle", `x = ${JSON.stringify(N0.slice(0, -1))};`, []);
  expectHits(K, "a comment line spelling a needle is prose", `// ${N0} — the F-307 literal`, []);
}

// ── atomic-write-copy (needles) ──────────────────────────────────────────────
{
  const K = "atomic-write-copy";
  expectHits(K, "19h input: a hand-spelled rename", "renameSync(zzA, zzB);", [spells(1, "renameSync(")]);
  expectHits(K, "the replace primitive re-spelled through a namespace", "  fs.replaceFileSync(tmp, dest);", [spells(1, "replaceFileSync(")]);
  expectHits(K, "boundary: the needle carries its paren — a spaced call is not seen", "renameSync (zzA, zzB);", []);
  expectHits(K, "the async rename is a different call", "await rename(zzA, zzB);", []);
  expectHits(K, "19b8 input: a comment line naming the shape is prose", "// never call renameSync( directly — use writeFileAtomicSync", []);
}

// ── unawaited-finish (line-regex, two lookbehinds) ───────────────────────────
{
  const K = "unawaited-finish";
  expectHits(K, "19o input: finish( without await", "finish({ ok: true });", [hit(1, K)]);
  expectHits(K, "19o2 input: await finish( is the sanctioned form", "await finish({ ok: true });", []);
  expectHits(K, "awaited, indented, inside a branch", "    await finish(summary, okVerdict ? 0 : 1);", []);
  expectHits(K, "returned without await is still un-awaited", "  return finish({ ok: false }, 1);", [hit(1, K)]);
  expectHits(K, "a longer identifier ending in finish is not the helper (word lookbehind)", "  unfinish(x);", []);
  expectHits(K, "F-367: a receiver-qualified finish( without await is the class (the F-365 shape one row over)", "  helpers.finish({ ok: true });", [hit(1, K)]);
  expectHits(K, "F-367: await helpers.finish( is the sanctioned form", "  await helpers.finish({ ok: true });", []);
  expectHits(K, "boundary: a two-level receiver is not the helper's handle (the same boundary as WRITE_RE's)", "  a.b.finish({ ok: true });", []);
  // F-367 amendment: the shared RECEIVER_PREFIX's two identifier classes, pinned on THIS
  // row too — it is unanchored, so the lead-class discriminator is a bare `$` receiver
  // (`$h.finish(` would still match by starting the prefix at `h.`).
  expectHits(K, "F-367 amendment (a): a bare $ receiver (the prefix's lead class on an unanchored row)", "  $.finish({ ok: true });", [hit(1, K)]);
  expectHits(K, "F-367 amendment (b): $ in the receiver's tail class", "  _h2$.finish({ ok: true });", [hit(1, K)]);
  expectHits(K, "F-367 co-fix: await followed by any run of whitespace is awaited (the tester's measured false alarm)", "  await  finish({ ok: true });", []);
  expectHits(K, "await across a tab is awaited too", "  await\tfinish({ ok: true });", []);
  expectHits(K, "boundary: a spaced call is not seen", "finish ({ ok: true });", []);
  expectHits(K, "a comment line naming finish() is prose (capture.mjs's own comment shape)", "  // finish(): exit in the stdout write callback — never process.exit after a", []);
}

// ── script-name-literal (line-regex) ─────────────────────────────────────────
{
  const K = "script-name-literal";
  const tpl = (name, v) => `const zzFail = (msg) => console.error(${BT}${name}.mjs: ${"$"}{${v}}${BT});`;
  expectHits(K, "19i input: a hand-rolled fail() spelling its script name", tpl("er-count", "msg"), [hit(1, K)]);
  expectHits(K, "any kebab-case script name", tpl("jo-report-deps", "msg"), [hit(1, K)]);
  expectHits(K, "boundary: the name class is kebab-case (an underscore is outside it)", tpl("doc_lib", "msg"), []);
  expectHits(K, "boundary: the template interpolates msg by that name", tpl("er-count", "m"), []);
  expectHits(K, "a plain-string message naming the script is not this class (declared in the row's what)", 'console.error("er-count.mjs: " + msg);', []);
  expectHits(K, "a comment line spelling the shape is prose", `// ${tpl("er-count", "msg")}`, []);
}

// ── stdout-then-exit (the block-scoped, literal-aware row) ───────────────────
{
  const K = "stdout-then-exit";
  // The former planted() inputs, verbatim.
  expectHits(K, "19b input: a write then an exit", 'console.log("zz");\nprocess.exit(0);', [exitOn(1, 2)]);
  expectHits(K, "19b2 input: the write-callback exit (the fix's shape) is not an instance", 'process.stdout.write("zz", () => process.exit(0));', []);
  expectHits(K, "19b3 input: a multi-line call closed before the exit", 'console.log(JSON.stringify({\n  a: 1,\n  b: 2,\n}));\nprocess.exit(0);', [exitOn(1, 5)]);
  expectHits(K, "19b4 input: a comment-only write followed by a real exit is not an instance", '// console.log("zz") — prose about the class\nif (process.env.ZZ_NEVER) process.exit(0);', []);
  expectHits(K, "19b5 input: an exit five lines after the write in the same block (block scope, not a window)", 'if (zz) {\n  out({ a: 1 });\n  const b = 1;\n  const c = 2;\n  const d = 3;\n  const e = 4;\n  process.exit(1);\n}', [exitOn(2, 7)]);
  expectHits(K, "19b6 input: an unmatched ( inside the written string does not hide the adjacent exit", 'console.log("done (see log");\nprocess.exit(0);', [exitOn(1, 2)]);
  expectHits(K, "19b9 input: a ) inside the written string does not end the call early (callback exit stays exempt)", 'process.stdout.write("x ) y", () => process.exit(0));', []);
  expectHits(K, "19b7 input: an exit in an OUTER block after the write is not this instance (declared boundary)", 'if (zz) {\n  out({ a: 1 });\n}\nif (!zz) process.exit(2);', []);
  // WRITE_RE's alternatives (F-365: the receiver-qualified out).
  expectHits(K, "F-365: runDocGenerator's helpers.out( then process.exit( — the F-360 site, seen", "  helpers.out({ ok: failed.length === 0, written, failed });\n  process.exit(written.length === 0 && failed.length ? 1 : 0);", [exitOn(1, 2)]);
  expectHits(K, "F-360's fixed shape: helpers.out( then process.exitCode = is not an exit", "  helpers.out({ ok: failed.length === 0, written, failed });\n  process.exitCode = written.length === 0 && failed.length ? 1 : 0;", []);
  expectHits(K, "any single identifier may qualify out (underscore, digits, $ in the tail)", "_h2$.out(x);\nprocess.exit(0);", [exitOn(1, 2)]);
  expectHits(K, "F-366(a): a $-initial receiver (the lead class, not the tail)", "  $h.out({ ok: true });\n  process.exit(0);", [exitOn(1, 2)]);
  expectHits(K, "boundary: a two-level receiver is not the helper's handle", "a.b.out(x);\nprocess.exit(0);", []);
  expectHits(K, "the await prefix", "await out(x);\nprocess.exit(0);", [exitOn(1, 2)]);
  expectHits(K, "a raw process.stdout.write statement", 'process.stdout.write("x");\nprocess.exit(0);', [exitOn(1, 2)]);
  expectHits(K, "a definition of out is not a write statement (line-start anchor)", "const out = (obj) => console.log(JSON.stringify(obj, null, 2));\nprocess.exit(0);", []);
  expectHits(K, "stderr is not the class: console.error then exit (the fail() paths)", 'console.error("er-count.mjs: bad");\nprocess.exit(1);', []);
  expectHits(K, "stderr is not the class: process.stderr.write then exit", 'process.stderr.write("x");\nprocess.exit(1);', []);
  expectHits(K, "console.log takes no receiver prefix", 'logger.log("x");\nprocess.exit(0);', []);
  expectHits(K, "a longer identifier starting with out is not the helper", "outfile(x);\nprocess.exit(0);", []);
  expectHits(K, "a bare stdout.write is not the raw-write alternative", 'stdout.write("x");\nprocess.exit(0);', []);
  // The block rule.
  expectHits(K, "an exit on the write's own line after the call closes", "out(x); process.exit(0);", [exitOn(1, 1)]);
  expectHits(K, "blank lines never end the block", "  out(x);\n\n  process.exit(0);", [exitOn(1, 3)]);
  expectHits(K, "a column-0 comment line between never ends the block", "  out(x);\n// note\n  process.exit(0);", [exitOn(1, 3)]);
  expectHits(K, "a comment line spelling the exit is prose", "out(x);\n// process.exit(0) here would lose the tail (F-360)\nreturn;", []);
  expectHits(K, "a deeper exit after the write is in the block", "out(x);\nif (y) {\n  process.exit(1);\n}", [exitOn(1, 3)]);
  expectHits(K, "an else branch is a different block (dedent then re-indent)", "if (a) {\n  out(x);\n} else {\n  process.exit(1);\n}", []);
  // Later writes and the first-exit return.
  expectHits(K, "a LATER write's callback exit is not an exit after this write", 'out(a);\nprocess.stdout.write("b", () => process.exit(0));', []);
  expectHits(K, "a later plain write then an exit: both writes are hits, each naming the exit line", "out(a);\nout(b); process.exit(0);", [exitOn(1, 2), exitOn(2, 2)]);
  expectHits(K, "a later multi-line write then an exit: both hits name the exit past the second call's close", "out(a);\nconsole.log(JSON.stringify({\n  x: 1,\n}));\nprocess.exit(0);", [exitOn(1, 5), exitOn(2, 5)]);
  expectHits(K, "one hit per write: the first exit only", "out(a);\nprocess.exit(0);\nprocess.exit(1);", [exitOn(1, 2)]);
  // callClose: literals, escapes, templates, the bound.
  expectHits(K, "an escaped quote inside the string keeps the callback inside the call", `process.stdout.write("a ${BS}" ) b", () => process.exit(0));`, []);
  expectHits(K, "a ( inside a single-quoted string does not unbalance the call", "out('a (b');\nprocess.exit(0);", [exitOn(1, 2)]);
  expectHits(K, "a template literal spans lines: a ) and exit text inside it are literal, the real exit after is the hit", `console.log(${BT}a\nb ) process.exit(\nc${BT});\nprocess.exit(0);`, [exitOn(1, 4)]);
  expectHits(K, "the same multi-line template with no real exit after it", `console.log(${BT}a\nb ) process.exit(\nc${BT});\nreturn;`, []);
  const longCall = (filler) => ["console.log(JSON.stringify({", ...Array.from({ length: filler }, (_, i) => `  k${i}: 1,`), "  cb: () => process.exit(0),", "}));"].join("\n");
  expectHits(K, "the 40-line bound: a call closing on line 40 is read whole — the callback exit inside it is exempt", longCall(37), []);
  expectHits(K, "the 40-line bound's declared consequence: a call closing on line 41 is treated as closing on its own line, so the callback exit inside it reads as an exit after the write", longCall(38), [exitOn(1, 40)]);
  expectHits(K, "F-366(c): a write whose call never closes before EOF, inside the 40-line window — the array guard holds (a hit, never a throw)", '  console.log("oops (unbalanced;\n  process.exit(1);\nconst zz = 1;\nconst yy = 2;', [exitOn(1, 2)]);
  // F-374 (release-gate review): the masked view — comments, strings and regex
  // literals cannot unbalance the call or spell the exit. Each of these was
  // measured as a false hit before maskCode existed.
  expectHits(K, "F-374: a ( inside a // comment INSIDE a multi-line write does not unbalance the call — the callback exit stays exempt", "process.stdout.write(\n  json,\n  // exit in the write callback (F-363\n  () => process.exit(0)\n);", []);
  expectHits(K, "F-374: a ) inside a regex-literal argument does not close the call early", 'process.stdout.write(s.replace(/\\)/g, ""), () => process.exit(0));', []);
  expectHits(K, "F-374: a ( inside a regex-literal argument does not unbalance the call", 'process.stdout.write(s.replace(/\\(/g, ""), () => process.exit(0));', []);
  expectHits(K, "F-374: a ) inside a regex character class", 'process.stdout.write(s.replace(/[)]/g, ""), () => process.exit(0));', []);
  expectHits(K, "F-374: division is not a regex start (a / after an identifier), so the exit after it is seen", "out(a / b);\nprocess.exit(0);", [exitOn(1, 2)]);
  expectHits(K, "F-374: a TRAILING comment naming process.exit( is prose", "  out(summary); // never process.exit(0) after a write (F-360)\n  return;", []);
  expectHits(K, "F-374: a string literal naming process.exit( is not an exit", '  out(summary);\n  const hint = "use process.exit(0) only in a callback";', []);
  expectHits(K, "F-374: a block comment spanning lines inside the block is prose", "  out(x);\n  /* process.exit(0)\n     would truncate */\n  return;", []);
  expectHits(K, "F-374: the real exit after a trailing comment is still seen", "  out(x); // flush first\n  process.exit(0);", [exitOn(1, 2)]);
  expectHits(K, "F-374: a regex holding the exit token is not an exit", "  out(x);\n  const re = /process.exit\\(/;", []);
  check("maskCode: literals, comments and regexes blank to spaces, delimiters and length kept", JSON.stringify(maskCode(['a("b(c") + /x)/g // (d', "`e", "f)` + g"])) === JSON.stringify(['a("   ") + /  /g      ', "` ", "  ` + g"]), maskCode(['a("b(c") + /x)/g // (d', "`e", "f)` + g"]));
  // F-382 (release-gate verdict round): a keyword that takes an operand leads a
  // regex — `return /x/` is not division. Measured LIVE on this tree at
  // jo-report.mjs's CSV quoting (the tester's probe), where the character rule
  // read `/[",\r\n|]/` as division and the `"` inside it opened string mode over
  // real code. Both directions of that desync are pinned: a false hit (the exit
  // token inside such a regex) and a missed real exit (code blanked after it).
  expectHits(K, "F-382: a regex after return holding the exit token is not an exit (the tester's probe A)", "function report() {\n  process.stdout.write(summary);\n  return /process.exit(/.test(flag);\n}", []);
  expectHits(K, "F-382: a quote inside a regex after return does not open string mode — the real exit after it on the same line is seen", 'out(x);\nreturn /["]/.test(s) || process.exit(1);', [exitOn(1, 2)]);
  expectHits(K, "F-382: typeof leads a regex the same way (the quote inside it stays regex text)", 'out(x);\nif (typeof /["]/.exec(s)) process.exit(1);', [exitOn(1, 2)]);
  expectHits(K, "F-382: a keyword-NAMED property is not a keyword — a.in / b is division, so the call closes and the exit on the write's own line is seen", "out(a.in / b); process.exit(0);", [exitOn(1, 1)]);
  const joReportCsvLine = "  return /[\",\\r\\n|]/.test(s) || /^\\s|\\s$/.test(s) ? `\"${s.replace(/\"/g, '\"\"')}\"` : s;";
  check("F-382 maskCode: jo-report.mjs's CSV-quoting line masks to code only — two regex bodies (9, 7) and the template body (26) blanked, length kept",
    JSON.stringify(maskCode([joReportCsvLine])) === JSON.stringify(["  return /" + " ".repeat(9) + "/.test(s) || /" + " ".repeat(7) + "/.test(s) ? `" + " ".repeat(26) + "` : s;"]),
    maskCode([joReportCsvLine]));
  const docLibExecLine = "    return /\\.(mjs|cjs|js)$/i.test(p) ? [process.execPath, p] : [p];";
  check("F-382 maskCode: doc-lib.mjs's balanced sibling (return, then a regex holding parens) is blanked too — balanced by luck is not lexed",
    JSON.stringify(maskCode([docLibExecLine])) === JSON.stringify(["    return /" + " ".repeat(15) + "/i.test(p) ? [process.execPath, p] : [p];"]),
    maskCode([docLibExecLine]));
  // F-384 (release-gate verdict round, found by an acorn oracle over the 37
  // swept files): a template's ${ … } substitution is code — it may hold a
  // nested template, escaped backticks, strings with braces, regexes with
  // backticks — so the lexer keeps a stack. The single-mode version closed
  // the outer template at the first inner backtick, read the escaped
  // backticks after it as openers, and stayed in template mode over the next
  // hundred lines of jo-report-program.mjs (measured: lines 218..33x blanked).
  const joProgramModelLine = "  lines.push(`- model: ${modelLabel(program)}${program.model ? ` (\\`${program.model}\\`)` : \"\"}`);";
  expectHits(K, "F-384: jo-report-program.mjs's nested template with escaped backticks does not carry template mode into the next line — the write and exit there are seen", joProgramModelLine + "\nout(x); process.exit(0);", [exitOn(2, 2)]);
  expectHits(K, "F-384: a regex holding a backtick inside a substitution does not close the template — the call closes and the exit after it is seen", "out(`${/`/.test(s)}`); process.exit(0);", [exitOn(1, 1)]);
  expectHits(K, "F-384: a } inside a string inside a substitution does not end the substitution", 'out(`${a ? "}" : b}`); process.exit(0);', [exitOn(1, 1)]);
  expectHits(K, "F-384: a substitution spanning lines carries on the stack; the call closes on the template's last line", "out(`x${\n  y}`);\nprocess.exit(0);", [exitOn(1, 3)]);
  check("F-384 maskCode: the whole body between the OUTERMOST backticks is blanked, substitutions included, both delimiters kept",
    JSON.stringify(maskCode([joProgramModelLine])) === JSON.stringify(["  lines.push(`" + " ".repeat(joProgramModelLine.length - "  lines.push(`".length - "`);".length) + "`);"]),
    maskCode([joProgramModelLine]));
  check("F-384 maskCode: a hashbang line is a comment (the character rule read #!/usr/ as a regex)",
    JSON.stringify(maskCode(["#!/usr/bin/env node", "out(x);"])) === JSON.stringify([" ".repeat(19), "out(x);"]),
    maskCode(["#!/usr/bin/env node", "out(x);"]));
  check("F-384 maskCode: a closing string or regex delimiter ends an expression, so the / after it is division",
    JSON.stringify(maskCode(['x = "a" / 2 + /b/ / 3;'])) === JSON.stringify(['x = " " / 2 + / / / 3;']),
    maskCode(['x = "a" / 2 + /b/ / 3;']));
}

// ── the engine: regex flags reach the compiled pattern ───────────────────────
{
  const synthetic = { ...rowOf("fence-state-toggle"), key: "zz-synthetic-flags", detect: { kind: /** @type {const} */ ("line-regex"), source: "zzflag", flags: "i" } };
  const got = detectRow(synthetic, ["ZZFLAG = 1;"]);
  check("engine: a row's flags reach the compiled regex", JSON.stringify(got) === JSON.stringify([{ line: 1, why: "matches /zzflag/" }]), got);
  // F-375: g and y are dropped — a cached stateful regex reported every other line before.
  for (const flags of ["g", "y", "gi"]) {
    const row = { ...rowOf("fence-state-toggle"), key: "zz-synthetic-" + flags, detect: { kind: /** @type {const} */ ("line-regex"), source: "zz", flags } };
    const first = detectRow(row, ["zz", "zz", "zz", "zz"]);
    const second = detectRow(row, ["zz", "zz", "zz"]);
    check(`F-375: flags "${flags}" — every matching line hits, across two calls (no carried lastIndex)`, first.length === 4 && second.length === 3, { first, second });
  }
}

// ── the sweep: scope counts and per-site allowances (F-377, F-376) ─────────────
{
  // F-377: a file counts toward a scope the moment its predicate matches —
  // before readability and before row coverage are known.
  const files = ["build/wiki-assets/app.mjs", "plugins/gs-superadmin/scripts/zz.mjs", "build/zz-unreadable.mjs"];
  const res = sweepDefectClasses(files, (f) => (f.includes("unreadable") ? null : "const a = 1;\n"));
  check("F-377: an unreadable in-scope file still counts toward its scopes; every scope counts what its predicate matched", res.unreadable.length === 1 && res.scopeCounts["lane-mjs"] === 3 && res.scopeCounts["all-code"] === 2 && res.scopeCounts.shipped === 1, res.scopeCounts);
  // F-376: an allowance sanctions a NUMBER of sites.
  const DOC = "plugins/gs-superadmin/scripts/doc-lib.mjs";
  const SITES = rowOf("atomic-write-copy").allow[DOC].sites;
  const sweepWith = (n) => sweepDefectClasses([DOC], () => Array.from({ length: n }, (_, i) => `renameSync(a${i}, b${i});`).join("\n"));
  const exact = sweepWith(SITES);
  check("F-376: exactly the sanctioned site count → no hit, the allowance is live", !exact.hits.some((h) => h.file === DOC) && !exact.stale.some((s) => s.file === DOC), { hits: exact.hits, stale: exact.stale });
  const more = sweepWith(SITES + 1);
  check("F-376: one MORE site than sanctioned → every site in the file is reported, naming both counts", more.hits.filter((h) => h.file === DOC && h.key === "atomic-write-copy").length === SITES + 1 && more.hits.every((h) => new RegExp(`${SITES + 1} site\\(s\\).*sanctions ${SITES}`).test(h.why)) && !more.stale.some((s) => s.file === DOC), more.hits.map((h) => h.why));
  const fewer = sweepWith(SITES - 1);
  check("F-376: one FEWER → reported too (a sanctioned site gone), never silently live", fewer.hits.filter((h) => h.file === DOC && h.key === "atomic-write-copy").length === SITES - 1 && !fewer.stale.some((s) => s.file === DOC), fewer.hits.map((h) => h.why));
  check("F-376: none → the allowance is stale", sweepWith(0).stale.some((s) => s.file === DOC && s.key === "atomic-write-copy"), sweepWith(0).stale);
}

// ── floor: every mechanical row has a positive and a negative case here ──────
for (const r of MECHANICAL_CLASSES) {
  const s = seen.get(r.key);
  check(`floor: row "${r.key}" has at least one positive and one negative case in this suite`, !!s && s.pos >= 1 && s.neg >= 1, s);
}
check("floor: the registry carries mechanical rows at all", MECHANICAL_CLASSES.length >= 1);

if (failures) {
  console.log(`\ntest-defect-classes: ${failures} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`test-defect-classes: all ${passed} checks passed (${MECHANICAL_CLASSES.length} mechanical rows, in memory)`);
