#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// doc-lib-fixtures.mjs — DIRECT tests for scripts/doc-lib.mjs (GP-B5 DS-18).
// ("-fixtures" suffix, not the mirror name doc-lib.mjs: two test files
// dynamically import the script by bare basename, and a same-basename test
// file would make that resolution ambiguous to build/check-imports.mjs.)
//
// Until this suite, doc-lib — the plugin's portability layer and shared-helper
// home — was tested only TRANSITIVELY, through its consumers' fixtures, so a
// primitive regression surfaced (if at all) cross-file. F-113 is the proof:
// BOM-strip mutants (a global U+FEFF strip; a swallow-any-leading-junk strip)
// survived the ENTIRE transitive battery. The stripBom/normalizeText sections
// below exist to kill exactly that mutant class at the definition site:
//   - a DOUBLE leading BOM keeps its second BOM (kills the global strip),
//   - an interior BOM is preserved (kills the global strip),
//   - leading non-BOM junk is NOT swallowed (kills swallow-any-leading-junk).
//
// Assertions here are independently derived from the T-7/T-3 contracts and the
// primitives' own headers — never from running the code first (the bus's
// Class B standard; R-10). Temp-dir/spawn plumbing comes from test/rig.mjs.
//
// Run:  node plugins/gs-superadmin/test/doc-lib-fixtures.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, readFileSync, symlinkSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
import {
  stripBom, normalizeText, readJsonFile, codePointSlice, docBaseName, docNameClaimer,
  canonicalFingerprint, getPath, extractIds, findItemsArray, makeCliHelpers, requireKbDir,
  sq, shq, needsPosixQuoteCaveat, normTerm, termKey, cmpName, cmpKey,
  stripLauncherSuffix, extractFencedJson, topBullets, findWorkspaceCatalog, findWorkspaceDir,
  makeCommandResolver, listMdFiles, direntIsDirectory, replaceFileSync, removeFileSync,
  decode, htmlToText, templateTokens, compactProgramPayload, renderProgramDoc,
  renderTemplateDoc, STUB_MARKER, STUB_MARKER_RE, escapeRe, sleepMs, scanListEnvelope, decideEntryArray, entryDecisionReason,
  parseDocJson, docMeta, docH1, NO_NAME, assertReadOnlyCommand, readKbIdentity,
  resolveRecordedDomains, recordedDomainsByPath, indexedElsewhere, RECORDED_LANES, laneTable,
} from "../scripts/doc-lib.mjs";
// List-page envelope docs and the indexer payload live in the shared reader
// payload corpus (test/fixtures/reader-payloads.mjs) — the tracer scans the same docs.
import { INDEXER_PAYLOAD, LIST_PAGE_ROWS, LIST_PAGE_TOTALS, LIST_PAGE_PAGEINFO } from "./fixtures/reader-payloads.mjs";
import { docJsonBody } from "../scripts/jo-report-deps.mjs";
import { readdirSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const DOC_LIB_ABS = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "doc-lib.mjs");
const BOM = "\uFEFF";

let failures = 0;
let passed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; return; }
  failures++;
  console.log(`FAIL  ${label}`);
  if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
}

// ── assertReadOnlyCommand: the ask-overrides list at its JSON boundary (F-357, F-358) ──
// The gate mirrors the guard hook's rule: the list is admitted only if it IS an
// array; every other value the file can carry reads as "no overrides". The
// value classes are ENUMERATED FROM THE ARTIFACT — the JSON grammar's six
// value types plus the key absent — never from whatever arms were written
// first (F-358: a string arm pinned nothing, because a string iterates and
// each character fails the row's own string check whether or not the guard
// exists). Two columns per class, both stated BEFORE running:
//   fixed  — the gate returns for every non-array class (asserted here);
//   mutant — with the guard reverted to `overrides?.overrides ?? []`, the
//            classes that make their arm go RED: object, number, boolean (not
//            iterable → TypeError). string / null / absent stay GREEN under
//            the mutant (iterable-but-harmless, or swallowed by `??`): those
//            are TOLERANCE arms — kept because the contract is "every class
//            reads as no list", labelled so nobody reads them as guard pins.
// Controls: an ARRAY whose row matches the command IS reached and refuses
// (the loop runs in this harness — a differential that never reaches the
// loop is exactly F-358's defect); a row for another path, and rows that are
// not objects or carry a non-string path, are skipped, not thrown on.
{
  const dir = makeTempDir("doclib-overrides");
  try {
    const OV = join(dir, "ask-overrides.json");
    const matched = { path: "rules-engine rules list", shortPath: "re r list", mutating: false };
    const SENTINEL = Symbol("gate-fail");
    const gate = () => {
      try {
        assertReadOnlyCommand({
          matched, rest: ["re", "r", "list"], hooksDir: dir,
          fail: (m) => { throw Object.assign(new Error(m), { sentinel: SENTINEL }); },
          printable: (s) => String(s), isRead: () => true, shapeNoun: "list-shaped", runsNoun: "reads",
        });
        return { ok: true };
      } catch (e) {
        return e?.sentinel === SENTINEL ? { refused: e.message } : { threw: String(e) };
      }
    };
    // [class, file text, arm kind] — the mutant column above is the prediction
    // the review-round mutation table measures against (pin = goes RED).
    const CLASSES = [
      ["object", '{"overrides": {}}', "pin"],
      ["number", '{"overrides": 1}', "pin"],
      ["boolean", '{"overrides": true}', "pin"],
      ["string", '{"overrides": "run-now"}', "tolerance"],
      ["null", '{"overrides": null}', "tolerance"],
      ["absent", '{}', "tolerance"],
    ];
    for (const [cls, text, kind] of CLASSES) {
      writeFileSync(OV, text);
      const r = gate();
      check(`read-only gate: a(n) ${cls} override list reads as no overrides (${kind} arm)`, r.ok === true, r);
    }
    writeFileSync(OV, JSON.stringify({ overrides: [{ path: "rules-engine rules list", whileCatalogMutatingIs: false, reason: "synthetic" }] }));
    const hit = gate();
    check("read-only gate: an ARRAY with a matching row is reached and refuses — positive control, the loop runs",
      typeof hit.refused === "string" && /ask-override list/.test(hit.refused) && /synthetic/.test(hit.refused), hit);
    writeFileSync(OV, JSON.stringify({ overrides: [{ path: "rules-engine rules describe", whileCatalogMutatingIs: false }] }));
    check("read-only gate: a matching-shape row for ANOTHER path is skipped (negative control)", gate().ok === true);
    writeFileSync(OV, JSON.stringify({ overrides: [null, 5, "x", { path: 7 }, { reason: "no path" }] }));
    check("read-only gate: rows that are not objects or carry a non-string path are skipped, never thrown on", gate().ok === true);
  } finally {
    removeTempDir(dir);
  }
}

// ── STUB_MARKER / STUB_MARKER_RE / escapeRe — the T-3 single source (DS-13) ──
// The VALUE pin, hand-spelled at the export's home: single-sourcing makes
// writer↔parser agreement structural, which also makes every flow-through
// test blind to a value edit — but stub docs written by earlier plugin
// versions live in user KBs, so the string itself is contract.
check("STUB_MARKER: exact value pinned (a change is a KB format break, not a refactor)",
  STUB_MARKER === "> **Metadata-only stub**");
check("STUB_MARKER_RE: matches the marker at the start of any line (m-flag)",
  STUB_MARKER_RE.test("intro\n> **Metadata-only stub** (shallow crawl)"));
check("STUB_MARKER_RE: anchored — mid-line marker does NOT match",
  !STUB_MARKER_RE.test('- note: was "> **Metadata-only stub**" once'));
check("STUB_MARKER_RE: bold framing required — plain '> Metadata-only stub.' does NOT match",
  !STUB_MARKER_RE.test("> Metadata-only stub."));
check("STUB_MARKER_RE: no g flag (stateless .test for repeated parser calls)",
  STUB_MARKER_RE.flags === "m");
check("escapeRe: metacharacters escaped so a marker edit cannot widen the match",
  new RegExp(`^${escapeRe("a**b?")}$`).test("a**b?") && !new RegExp(escapeRe("a.b")).test("axb"));
check("escapeRe: backslash escaped", new RegExp(`^${escapeRe("a\\b")}$`).test("a\\b"));

// ── stripBom / normalizeText — the F-113 mutant-class killers ────────────────
check("stripBom: one leading BOM stripped", stripBom(BOM + '{"a":1}') === '{"a":1}');
check("stripBom: clean string unchanged", stripBom('{"a":1}') === '{"a":1}');
// Kills the GLOBAL-strip mutant (s.replace(/\uFEFF/g, "")): exactly one BOM
// comes off, the second leading BOM survives.
check("stripBom: double leading BOM keeps the second (F-113)", stripBom(BOM + BOM + "x") === BOM + "x");
// Kills the global-strip mutant from the other side: an interior BOM is content.
check("stripBom: interior BOM preserved (F-113)", stripBom("a" + BOM + "b") === "a" + BOM + "b");
// Kills the swallow-any-leading-junk mutant (/^[^{]*/): junk stays.
check("stripBom: leading non-BOM junk not swallowed (F-113)", stripBom("  " + BOM + "{") === "  " + BOM + "{");
check("stripBom: coerces non-strings", stripBom(42) === "42");

check("normalizeText: leading BOM stripped", normalizeText(BOM + "a") === "a");
check("normalizeText: CRLF → LF", normalizeText("a\r\nb") === "a\nb");
check("normalizeText: lone CR → LF", normalizeText("a\rb") === "a\nb");
check("normalizeText: double leading BOM keeps the second (F-113)", normalizeText(BOM + BOM + "a") === BOM + "a");
check("normalizeText: interior BOM preserved (F-113)", normalizeText("a" + BOM + "b") === "a" + BOM + "b");

// ── readJsonFile — BOM tolerance; fail direction stays the caller's ──────────
{
  const dir = makeTempDir("doclib-readjson");
  try {
    writeFileSync(join(dir, "bom.json"), BOM + '{"k":"v"}');
    writeFileSync(join(dir, "clean.json"), '{"k":"v"}');
    writeFileSync(join(dir, "bad.json"), "{nope");
    check("readJsonFile: BOM'd JSON parses", readJsonFile(join(dir, "bom.json")).k === "v");
    check("readJsonFile: clean JSON parses", readJsonFile(join(dir, "clean.json")).k === "v");
    let threw = false;
    try { readJsonFile(join(dir, "bad.json")); } catch { threw = true; }
    check("readJsonFile: invalid JSON throws (fail direction is the caller's)", threw);
    threw = false;
    try { readJsonFile(join(dir, "absent.json")); } catch { threw = true; }
    check("readJsonFile: missing file throws", threw);
  } finally {
    removeTempDir(dir);
  }
}

// ── codePointSlice — surrogate-safe truncation (F-131) ───────────────────────
{
  const emoji = "\u{1F600}"; // one code point, two code units
  check("codePointSlice: plain ASCII slice intact", codePointSlice("abcdef", 1, 4) === "bcd");
  // Cutting through the pair at the END drops the dangling high half.
  check("codePointSlice: trailing high surrogate dropped", codePointSlice("ab" + emoji, 0, 3) === "ab");
  // Cutting through the pair at the START drops the dangling low half.
  check("codePointSlice: leading low surrogate dropped", codePointSlice(emoji + "cd", 1, 4) === "cd");
  check("codePointSlice: whole pair inside the window survives", codePointSlice("a" + emoji + "b", 0, 4) === "a" + emoji + "b");
}

// ── docBaseName — filename rule (charset, DOS devices, cap; F-126) ───────────
{
  check("docBaseName: clean id passes through", docBaseName("Company_Health-1.2") === "Company_Health-1.2");
  const dirty = docBaseName("a/b");
  check("docBaseName: sanitized id gains an 8-hex raw-id hash", /^a_b-[0-9a-f]{8}$/.test(dirty), dirty);
  check("docBaseName: distinct ids cleaning to the same base stay distinct", docBaseName("a/b") !== docBaseName("a b"));
  check("docBaseName: id already spelled like the cleaned twin differs from it", docBaseName("a_b") === "a_b" && docBaseName("a/b") !== "a_b");
  for (const dev of ["nul", "CON", "com3", "NUL.md"]) {
    const out = docBaseName(dev);
    check(`docBaseName: reserved device name "${dev}" is hash-suffixed`, /-[0-9a-f]{8}$/.test(out), out);
  }
  check("docBaseName: lpt0 is NOT reserved (device set is 1-9)", docBaseName("lpt0") === "lpt0");
  const long = "x".repeat(100);
  const capped = docBaseName(long);
  check("docBaseName: >80-char id truncated to 80 + hash", /^x{80}-[0-9a-f]{8}$/.test(capped), capped);
  check("docBaseName: case preserved", docBaseName("Company") === "Company");
}

// ── docNameClaimer — collision suffixing against disk + in-run claims (F-156) ─
{
  const dir = makeTempDir("doclib-claimer");
  try {
    writeFileSync(join(dir, "company.md"), "x"); // on-disk foreign stem (lower)
    writeFileSync(join(dir, "Own.md"), "x");     // on-disk own stem (exact case)
    const claim = docNameClaimer(dir);
    // Exact-case on-disk match is this id's own earlier doc: reused, no suffix.
    check("claimer: exact-case on-disk stem reused", claim("Own") === "Own");
    // Case-insensitive-but-not-exact on-disk match belongs to a DIFFERENT id.
    check("claimer: case-different on-disk stem forces -dup", claim("Company") === "Company-dup");
    // In-run collisions suffix too, case-insensitively.
    check("claimer: first in-run claim is plain", claim("Widget") === "Widget");
    check("claimer: case-insensitive in-run collision forces -dup", claim("widget") === "widget-dup");
    check("claimer: repeated collisions stack -dup", claim("widget") === "widget-dup-dup");
    // Missing dir → nothing on disk to respect (lazy snapshot must not throw).
    const claim2 = docNameClaimer(join(dir, "not-created-yet"));
    check("claimer: missing dir claims plain", claim2("anything") === "anything");
  } finally {
    removeTempDir(dir);
  }
}

// ── canonicalFingerprint — volatile-key drop + canonicalization ──────────────
{
  const a = canonicalFingerprint({ b: 1, a: { modifiedDate: "x", v: 2 } });
  const b = canonicalFingerprint({ a: { v: 2, lastUpdatedBy: "y" }, b: 1 });
  check("fingerprint: key order + volatile keys (any depth) canonicalized away", a === b);
  const c = canonicalFingerprint({ a: { v: 3 }, b: 1 });
  check("fingerprint: a real value change changes the hash", a !== c);
  check("fingerprint: array order is significant", canonicalFingerprint([1, 2]) !== canonicalFingerprint([2, 1]));
  check("fingerprint: 40-hex sha1", /^[0-9a-f]{40}$/.test(a));
}

// ── getPath / extractIds / findItemsArray (F-108/F-237) ──────────────────────
{
  check("getPath: dotted path resolves", getPath({ a: { b: { c: 7 } } }, "a.b.c") === 7);
  check("getPath: missing segment → undefined", getPath({ a: 1 }, "a.b.c") === undefined);
  check("extractIds: null/empty filtered, ids stringified",
    JSON.stringify(extractIds([{ id: 1 }, { id: null }, { id: "" }, { id: "x" }, {}], "id")) === '["1","x"]');
  const payload = INDEXER_PAYLOAD;
  check("findItemsArray: explicit itemsPath resolves", findItemsArray(payload, "data.rows", "rid").length === 2);
  let threw = false;
  try { findItemsArray(payload, "data", "rid", true); } catch { threw = true; }
  check("findItemsArray: itemsPath to a non-array stays fatal even with allowEmpty", threw);
  check("findItemsArray: allowEmpty + unresolvable path → []",
    findItemsArray({ note: "no arrays here" }, "data.rows", "rid", true).length === 0);
  const located = findItemsArray(payload, undefined, "rid");
  check("findItemsArray: auto-locate prefers the array carrying the id field", located[0]?.rid === "1");
  threw = false;
  try { findItemsArray({ nothing: 1 }, undefined, "rid"); } catch { threw = true; }
  check("findItemsArray: no array anywhere throws without allowEmpty", threw);
}

// ── makeCliHelpers — opt()/fail() incl. the last-token rule (F-165/F-171) ────
{
  const { opt } = makeCliHelpers("t", ["--name", "v", "--flag"]);
  check("makeCliHelpers: valued flag returns its value", opt("--name") === "v");
  check("makeCliHelpers: absent flag returns fallback", opt("--nope", "fb") === "fb");
  // fail() calls process.exit — the last-token rule is pinned through a spawned
  // driver so the suite process survives.
  const dir = makeTempDir("doclib-cli");
  try {
    const docLibUrl = pathToFileURL(DOC_LIB_ABS).href;
    writeFiles(dir, {
      "driver.mjs":
        `import { makeCliHelpers } from ${JSON.stringify(docLibUrl)};\n` +
        `const { opt } = makeCliHelpers("driver", process.argv.slice(2));\n` +
        `console.log(JSON.stringify({ got: opt("--limit", "default") }));\n`,
    });
    const lost = runNode(join(dir, "driver.mjs"), ["--limit"]);
    check("makeCliHelpers: valued flag as LAST token fails, never defaults (F-165)",
      lost.status === 1 && /--limit requires a value/.test(lost.stderr), lost);
    const dup = runNode(join(dir, "driver.mjs"), ["--limit", "1", "--limit"]);
    check("makeCliHelpers: bare trailing repeat of a valued flag fails (F-171)",
      dup.status === 1 && /--limit requires a value/.test(dup.stderr), dup);
    const okRun = runNode(join(dir, "driver.mjs"), ["--limit", "5"]);
    check("makeCliHelpers: normal valued spelling succeeds", okRun.status === 0 && okRun.stdout.includes('"got":"5"'), okRun);
  } finally {
    removeTempDir(dir);
  }
}

// ── requireKbDir — the one --kb existence gate (F-310) ───────────────────────
// tenant-deps accepted a nonexistent --kb and wrote a report claiming zero
// dependents; jo-report deps mode refused. The gate now lives here so both
// surfaces run the same copy; the refusal goes through the CALLER's fail so
// it names the script the operator invoked (F-306).
{
  const dir = makeTempDir("doclib-kbgate");
  try {
    const calls = [];
    const stubFail = (msg) => { calls.push(msg); throw new Error("fail-called"); };
    let threw = false;
    try { requireKbDir(join(dir, "no-such-kb"), stubFail); } catch { threw = true; }
    check("requireKbDir: nonexistent dir REFUSES via the caller's fail, naming flag and path (F-310)",
      threw && calls.length === 1 && /^--kb .*no-such-kb: directory not found$/.test(calls[0]), calls);
    calls.length = 0;
    requireKbDir(dir, stubFail);
    check("requireKbDir: existing dir passes without touching fail", calls.length === 0, calls);
    requireKbDir(null, stubFail);
    requireKbDir(undefined, stubFail);
    check("requireKbDir: absent flag (null/undefined) is the caller's business, not the gate's", calls.length === 0, calls);
  } finally {
    removeTempDir(dir);
  }
}

// ── sq / shq / POSIX-quote caveat (F-123/F-142) ──────────────────────────────
check("sq: apostrophe escaped the bash way", sq("it's") === "'it'\\''s'");
check("shq: bare token passes through unquoted", shq("a-b.c/d:e@f") === "a-b.c/d:e@f");
check("shq: space forces quoting", shq("a b") === "'a b'");
check("shq: backslash is NOT bare — Windows paths get quoted (F-142)", shq("C:\\x") === "'C:\\x'");
check("caveat detector: fires only on emitted escape text",
  needsPosixQuoteCaveat("plain", "has 'it'\\''s' inside") === true && needsPosixQuoteCaveat("plain") === false);

// ── normTerm / termKey (F-127/F-197) ─────────────────────────────────────────
{
  const nfd = "e\u0301"; // é decomposed
  check("normTerm: NFD folds to NFC", normTerm(nfd) === "\u00E9");
  check("termKey: NFC fold + trim + lowercase", termKey("  " + nfd.toUpperCase() + "  ") === "\u00E9");
  check("termKey: padded ASCII spelling keys equal", termKey(" Alpha ") === termKey("alpha"));
}

// ── cmpName / cmpKey — pinned locale + code-unit tiebreaker (F-128/F-144) ────
{
  // Locale semantics: under "en", é sorts with e (before z); raw code units
  // would put é (0xE9) after z (0x7A). Kills a comparator degraded to cuCmp.
  check("cmpName: pinned-locale semantics (é before z)", cmpName("\u00E9", "z") < 0);
  check("cmpKey: pinned-locale semantics (é before z)", cmpKey("\u00E9", "z") < 0);
  // Tiebreaker (F-144): collation-equal-but-distinct strings must not compare 0.
  check("cmpName: default-ignorable codepoint breaks ties deterministically", cmpName("a\u00ADb", "ab") !== 0);
  check("cmpName: equal inputs compare 0", cmpName("same", "same") === 0);
  // sensitivity:base makes case a collation tie; the code-unit tiebreaker must
  // still order the two spellings deterministically (never 0).
  check("cmpName: case-differing spellings tie-break, never 0", cmpName("Apple", "apple") !== 0);
}

// ── stripLauncherSuffix (F-120) ──────────────────────────────────────────────
check("stripLauncherSuffix: Windows launcher spelling resolves", stripLauncherSuffix("GS-Admin.CMD") === "gs-admin");
check("stripLauncherSuffix: exactly one suffix stripped", stripLauncherSuffix("x.exe.cmd") === "x.exe");
check("stripLauncherSuffix: .ps1 stripped", stripLauncherSuffix("gs-admin.ps1") === "gs-admin");
check("stripLauncherSuffix: plain word only lowercased", stripLauncherSuffix("GS-ADMIN") === "gs-admin");

// ── extractFencedJson / topBullets (T-3 read primitives) ─────────────────────
{
  // Below-boundary bullets carry UNIQUE keys: with a shared key, first-wins
  // shadowing alone satisfies the assertions even if the break is deleted —
  // the B2 mutation round caught the original fixture as undiscriminating.
  const doc = "# T\n\n- key: journey/1\n- id: 1\n- key: shadowed\n\n```json\n- fenced: yes\n```\n\n## Body\n\n- below_heading: yes\n";
  check("extractFencedJson: first ```json fence body returned", extractFencedJson(doc) === "- fenced: yes");
  check("extractFencedJson: no fence → null", extractFencedJson("# T\nno fence") === null);
  check("extractFencedJson: unterminated fence → null", extractFencedJson("```json\n{\"a\":1}") === null);
  const bullets = topBullets(doc);
  check("topBullets: first value wins per key", bullets.key === "journey/1");
  check("topBullets: bullets above the boundary collected", bullets.id === "1");
  check("topBullets: scan stops at the first fence", !("fenced" in bullets), bullets);
  check("topBullets: nothing below a fence is ever counted", !("below_heading" in bullets), bullets);
  const headingDoc = "# T\n\n- key: k2\n\n## Body\n\n- below_heading: yes\n";
  check("topBullets: scan stops at the first section heading", topBullets(headingDoc).key === "k2" && !("below_heading" in topBullets(headingDoc)));
}

// ── findWorkspaceCatalog — walk-up + corrupt-fallback (F-232/F-118) ──────────
{
  const dir = makeTempDir("doclib-wscat");
  try {
    writeFiles(dir, {
      "ws/.gs-superadmin/catalog.json": BOM + '{"meta":{"cliVersion":"9.9.9"},"commands":[]}',
      "ws/tenant/deep/placeholder.txt": "x",
      "bundled.json": '{"meta":{"cliVersion":"1.0.0"},"commands":[]}',
    });
    const found = findWorkspaceCatalog(join(dir, "ws", "tenant", "deep"), join(dir, "bundled.json"));
    check("findWorkspaceCatalog: walks up to the FIRST .gs-superadmin and reads BOM'd catalog",
      found?.meta?.cliVersion === "9.9.9", found);
    // Corrupt-but-parseable (null) workspace catalog → next source.
    writeFileSync(join(dir, "ws", ".gs-superadmin", "catalog.json"), "null");
    const fb = findWorkspaceCatalog(join(dir, "ws", "tenant", "deep"), join(dir, "bundled.json"));
    check("findWorkspaceCatalog: null-parsing workspace catalog falls back to bundled", fb?.meta?.cliVersion === "1.0.0");
    // Unreadable workspace catalog → next source.
    rmSync(join(dir, "ws", ".gs-superadmin", "catalog.json"));
    const fb2 = findWorkspaceCatalog(join(dir, "ws", "tenant", "deep"), join(dir, "bundled.json"));
    check("findWorkspaceCatalog: missing workspace catalog falls back to bundled", fb2?.meta?.cliVersion === "1.0.0");
    check("findWorkspaceCatalog: no source at all → null",
      findWorkspaceCatalog(join(dir, "ws", "tenant", "deep"), join(dir, "absent.json")) === null);
    // findWorkspaceDir — the shared walk-up itself (GP-B5 W5 review round:
    // hoisted so readAliasConvention isn't the walk's third hand copy)
    check("findWorkspaceDir: walks up to the workspace root", findWorkspaceDir(join(dir, "ws", "tenant", "deep")) === join(dir, "ws"), findWorkspaceDir(join(dir, "ws", "tenant", "deep")));
    check("findWorkspaceDir: the workspace root itself resolves", findWorkspaceDir(join(dir, "ws")) === join(dir, "ws"), null);
  } finally {
    removeTempDir(dir);
  }
}

// ── makeCommandResolver (F-232) ──────────────────────────────────────────────
{
  const catalog = {
    globalFlags: [
      { flag: "--format <fmt>", description: "" },
      { flag: "--json", description: "" },
    ],
    domains: [{ namespace: "journey", aliases: ["jo"], title: "", description: "" }],
    commands: [
      { path: "journey programs save", shortPath: "jo p save" },
      { path: "journey programs list", shortPath: "jo p list" },
    ],
  };
  const r = makeCommandResolver(catalog);
  check("resolver: canonical spelling resolves", r.resolveLine("gs-admin journey programs save")?.path === "journey programs save");
  check("resolver: alias spelling resolves", r.resolveLine("gs-admin jo p list")?.path === "journey programs list");
  check("resolver: mixed spelling resolves via ns→alias substitution",
    r.resolveLine("gs-admin journey p save")?.path === "journey programs save");
  // The other substitution direction (alias namespace + canonical group words)
  // is the only path through aliasToNs — the M12 mutation-proof round found it
  // uncovered (the pure-alias and pure-canonical spellings both match known
  // paths directly).
  check("resolver: mixed spelling resolves via alias→ns substitution",
    r.resolveLine("gs-admin jo programs save")?.path === "journey programs save");
  check("resolver: valued global flag's value is consumed, not a command token",
    r.resolveLine("gs-admin --format json jo p save")?.path === "journey programs save");
  check("resolver: trailing per-command flag value neutralized by prefix match",
    r.resolveLine("gs-admin jo p list --limit 10000")?.path === "journey programs list");
  check("resolver: launcher suffix on the program word tolerated (F-120)",
    r.resolveLine("GS-Admin.CMD --json jo p save")?.path === "journey programs save");
  check("resolver: unknown line → null", r.resolveLine("gs-admin nope nothing") === null);
}

// ── listMdFiles ──────────────────────────────────────────────────────────────
{
  const dir = makeTempDir("doclib-lsmd");
  try {
    writeFiles(dir, { "b.md": "x", "a.md": "x", "c.txt": "x" });
    const got = listMdFiles(dir).map((p) => p.slice(dir.length + 1));
    check("listMdFiles: sorted .md only", JSON.stringify(got) === '["a.md","b.md"]', got);
    check("listMdFiles: missing dir → null", listMdFiles(join(dir, "nope")) === null);
  } finally {
    removeTempDir(dir);
  }
}

// ── isMainModule (F-117/F-149) — via spawned drivers ─────────────────────────
{
  const dir = makeTempDir("doclib-main");
  try {
    const docLibUrl = pathToFileURL(DOC_LIB_ABS).href;
    writeFiles(dir, {
      "direct.mjs":
        `import { isMainModule } from ${JSON.stringify(docLibUrl)};\n` +
        `console.log(String(isMainModule(import.meta.url)));\n`,
      "importer.mjs":
        `import ${JSON.stringify(pathToFileURL(join(dir, "lib.mjs")).href)};\n`,
      "lib.mjs":
        `import { isMainModule } from ${JSON.stringify(docLibUrl)};\n` +
        `console.log("lib:" + String(isMainModule(import.meta.url)));\n`,
    });
    const direct = runNode(join(dir, "direct.mjs"));
    check("isMainModule: true when run as the CLI entry", direct.stdout.trim() === "true", direct);
    const imported = runNode(join(dir, "importer.mjs"));
    check("isMainModule: false for an imported module", imported.stdout.trim() === "lib:false", imported);
    // Relative argv spelling still resolves (resolve() + realpath both sides).
    const rel = runNode("direct.mjs", [], { cwd: dir });
    check("isMainModule: relative argv[1] spelling still true", rel.stdout.trim() === "true", rel);
  } finally {
    removeTempDir(dir);
  }
}

// ── direntIsDirectory (F-134) ────────────────────────────────────────────────
{
  const dir = makeTempDir("doclib-dirent");
  try {
    mkdirSync(join(dir, "realdir"));
    writeFileSync(join(dir, "afile"), "x");
    mkdirSync(join(dir, "target"));
    let links = true;
    try {
      symlinkSync(join(dir, "target"), join(dir, "link"), "junction");
      symlinkSync(join(dir, "gone-target"), join(dir, "dangling"), "junction");
    } catch (e) {
      // Only a PRIVILEGE failure may downgrade to a skip, and only on win32
      // (where symlink creation is Developer-Mode-gated; junctions normally
      // work, so even this is rare). Anything else — wrong args, a rig
      // contract change, POSIX — is a real defect and must throw: a bare
      // catch here silently disabled the only F-134 coverage on every OS
      // (B2 review, finder A).
      if (process.platform !== "win32" || !["EPERM", "EACCES"].includes(e?.code)) throw e;
      links = false;
    }
    const entries = new Map(readdirSync(dir, { withFileTypes: true }).map((d) => [d.name, d]));
    check("direntIsDirectory: real dir → true", direntIsDirectory(dir, entries.get("realdir")) === true);
    check("direntIsDirectory: plain file → false", direntIsDirectory(dir, entries.get("afile")) === false);
    if (links) {
      check("direntIsDirectory: junction/symlink to a dir → true (F-134)", direntIsDirectory(dir, entries.get("link")) === true);
      check("direntIsDirectory: dangling link → false", direntIsDirectory(dir, entries.get("dangling")) === false);
    } else {
      console.log("SKIP  direntIsDirectory link cases (symlink creation unavailable in this environment)");
    }
  } finally {
    removeTempDir(dir);
  }
}

// ── replaceFileSync / removeFileSync (F-133) ─────────────────────────────────
{
  const dir = makeTempDir("doclib-replace");
  try {
    writeFileSync(join(dir, "tmp"), "new");
    writeFileSync(join(dir, "dest"), "old");
    replaceFileSync(join(dir, "tmp"), join(dir, "dest"));
    check("replaceFileSync: replaces an existing target", readFileSync(join(dir, "dest"), "utf8") === "new");
    check("replaceFileSync: source gone after rename", !existsSync(join(dir, "tmp")));
    let code = null;
    try { replaceFileSync(join(dir, "absent"), join(dir, "dest")); } catch (e) { code = e.code; }
    check("replaceFileSync: non-retryable error rethrown loudly", code === "ENOENT", code);
    removeFileSync(join(dir, "dest"));
    check("removeFileSync: removes the file", !existsSync(join(dir, "dest")));
  } finally {
    removeTempDir(dir);
  }
}

// ── sleepMs (DS-26 — the one zero-dep sync sleep, exported for pacing) ───────
{
  const t0 = Date.now();
  sleepMs(0);
  sleepMs(-5);
  check("sleepMs: 0/negative return immediately", Date.now() - t0 < 100, Date.now() - t0);
  const t1 = Date.now();
  sleepMs(60);
  check("sleepMs: sleeps at least the requested duration", Date.now() - t1 >= 55, Date.now() - t1);
}

// ── decode / htmlToText ──────────────────────────────────────────────────────
check("decode: single-pass entity decode (&amp;lt; → &lt;)", decode("&amp;lt;") === "&lt;");
check("decode: common entities", decode("&lt;a&gt; &quot;x&quot; &#39;y&#39;&nbsp;z") === `<a> "x" 'y' z`);
{
  const text = htmlToText("<style>p{}</style><!-- c --><p>Hello  <b>world</b></p><li>item</li>");
  check("htmlToText: style/comments dropped, tags stripped, blocks break", text === "Hello world\nitem", text);
}

// ── templateTokens (ER-15 C1 v2) ─────────────────────────────────────────────
{
  check("templateTokens: no metadata at all → null", templateTokens({ data: { emailTemplate: { templateId: "t" } } }) === null);
  const payload = {
    data: {
      emailTemplate: {
        templateId: "t",
        _tokens: [{ tokenKey: "k1", displayName: "Name", variant: "A" }, { bad: true }],
        tokenMappings: { MDA: { k1: { surveyToken: { surveyId: "s1", surveyName: "NPS" } }, k2: { surveyToken: { surveyId: "s2" } } } },
      },
    },
  };
  const toks = templateTokens(payload);
  const k1 = toks.find((t) => t.tokenKey === "k1");
  const k2 = toks.find((t) => t.tokenKey === "k2");
  check("templateTokens: _tokens entry enriched with survey identity", k1?.survey?.surveyName === "NPS");
  check("templateTokens: malformed _tokens entries skipped", toks.length === 2);
  check("templateTokens: survey-only mapping appended as SURVEY token", k2?.tokenType === "SURVEY" && k2?.survey?.surveyId === "s2");
}

// ── compactProgramPayload / renderProgramDoc / renderTemplateDoc ─────────────
{
  const program = {
    data: {
      programId: "p1",
      name: "Prog",
      x: 5, y: 6, transform: "t", // geometry at top level
      unknownKey: "kept",
      powerListConfig: { x: 1, coordinates: [1, 2] }, // verbatim subtree
      stepJson: JSON.stringify({ nodes: [{ type: "email", position: { x: 1 } }] }),
      notJson: "{oops",
    },
  };
  const c = compactProgramPayload(program);
  const d = c.value.data;
  check("compact: geometry keys dropped", !("x" in d) && !("transform" in d));
  check("compact: unknown keys kept (fail-open)", d.unknownKey === "kept");
  check("compact: PowerList subtree kept VERBATIM, geometry included", d.powerListConfig.x === 1 && d.powerListConfig.coordinates.length === 2);
  check("compact: embedded stepJson parsed and geometry-stripped inside",
    typeof d.stepJson === "object" && d.stepJson.nodes[0].type === "email" && !("position" in d.stepJson.nodes[0]));
  check("compact: parsedJsonKeys records the parse", c.parsedJsonKeys.includes("stepJson"));
  check("compact: non-JSON json-suffixed string kept untouched", d.notJson === "{oops");
  check("compact: dropped count is honest (>0)", c.dropped > 0);

  const doc = renderProgramDoc(program);
  check("renderProgramDoc: id from the outer data object", doc.id === "p1");
  check("renderProgramDoc: doc carries key bullet + fenced json", doc.doc.includes("- key: journey/p1") && doc.doc.includes("```json"));
  let threw = false;
  try { renderProgramDoc({ data: { advancedOutreach: {} } }); } catch { threw = true; }
  check("renderProgramDoc: no id anywhere throws", threw);
  const jo = renderProgramDoc({ data: { advancedOutreach: { advancedOutreachId: "ao1", advancedOutreachName: "N" } } });
  check("renderProgramDoc: JO envelope id fallback", jo.id === "ao1" && jo.doc.startsWith("# N"));

  threw = false;
  try { renderTemplateDoc({ data: {} }); } catch { threw = true; }
  check("renderTemplateDoc: missing templateId throws", threw);
  const t = renderTemplateDoc({ data: { emailTemplate: { templateId: "t1", title: "T", subject: "A &amp; B" } } });
  check("renderTemplateDoc: subject decoded, standard key bullet", t.doc.includes("- subject: A & B") && t.doc.includes("- key: journey-email-templates/t1"));
  check("renderTemplateDoc: no token metadata → no Tokens section", !t.doc.includes("## Tokens"));
}

// ── scanListEnvelope + decideEntryArray — the shared list-page scan and the ──
// ONE rows-array decision (DS-30; gate-3 F-351, F-354/F-355). The scan offers
// no count; er-count and capture --paginate both print decideEntryArray's
// answer, so the two consumers of one rule cannot disagree. Pins er-count's
// no-descend contract at the definition site plus the totals-collection rules
// the paginate verdicts hang off.
{
  const rows = (doc, opts) => decideEntryArray(doc, opts).decision;
  // Rows: the spine's single candidate, arrays measured never descended
  const d1 = rows(LIST_PAGE_ROWS);
  check("decideEntryArray: nested per-row arrays never outvote the entry array (er-count contract)",
    d1.kind === "rows" && d1.count === 3 && d1.path === "data.liteObjects", d1);
  check("decideEntryArray: no arrays → kind empty (a genuinely empty page), reason null",
    rows({ data: { a: 1 } }).kind === "empty" && entryDecisionReason(rows({ data: { a: 1 } })) === null);
  check("scanListEnvelope: the scan itself offers NO count — a consumer cannot print a guess",
    !("entryCount" in scanListEnvelope({ data: [1] })) && !("entryPath" in scanListEnvelope({ data: [1] })));
  const dRoot = rows([1, 2, 3, 4]);
  check("decideEntryArray: a root array counts with an empty path", dRoot.kind === "rows" && dRoot.count === 4 && dRoot.path === "", dRoot);

  // Row totals: every measured spelling collected with its dotted path
  const s2 = scanListEnvelope(LIST_PAGE_TOTALS);
  const paths2 = s2.rowTotals.map((t) => t.path).sort();
  check("scanListEnvelope: all five row-total spellings collected with paths",
    paths2.join("|") === ["_total", "data.pageInfo.totalAfterFilters", "data.pageInfo.totalRecords", "data.totalCount", "data.totalNumberOfObjects"].join("|"),
    paths2);

  // pageInfo-scoped keys: limit/pageSize/returned only inside a pageInfo object
  const s3 = scanListEnvelope(LIST_PAGE_PAGEINFO);
  check("scanListEnvelope: limit outside pageInfo is ignored; pageSize/returned inside collected",
    !s3.pageSignals.some((p) => p.path === "data.limit") &&
      s3.pageSignals.some((p) => p.path === "data.pageInfo.pageSize") &&
      s3.pageSignals.some((p) => p.path === "data.pageInfo.returned"),
    s3.pageSignals);

  // Non-numeric / negative totals are reported as signals, never reconciled
  const s4 = scanListEnvelope({ data: { totalRecords: null, pageInfo: { totalRecords: -1 } } });
  check("scanListEnvelope: null/negative total values land in pageSignals, not rowTotals",
    s4.rowTotals.length === 0 && s4.pageSignals.length === 2, s4);

  // Spine rule (review round): a total-spelled key nested off the envelope
  // spine (root / data / pageInfo) is a facet's own count, not the result
  // total — demoted to pageSignals so it can neither masquerade as the total
  // nor falsely conflict with the real one.
  const s4b = scanListEnvelope({
    data: { data: [1, 2], totalRecords: 340, facets: { status: { totalCount: 12 } } },
  });
  check("scanListEnvelope: an off-spine nested totalCount is a signal, never a reconciliation total",
    s4b.rowTotals.length === 1 && s4b.rowTotals[0].path === "data.totalRecords" &&
      s4b.pageSignals.some((p) => p.path === "data.facets.status.totalCount"),
    s4b);

  // Continuation signals collected anywhere
  const s5 = scanListEnvelope({ data: { lastPage: false, totalPages: 6, nextPage: 2 } });
  check("scanListEnvelope: lastPage/totalPages/nextPage collected as signals",
    ["data.lastPage", "data.totalPages", "data.nextPage"].every((p) => s5.pageSignals.some((x) => x.path === p)), s5);

  // Spine rule for the ENTRY array (gate-3 F-351): rows live on the envelope
  // spine — root / root child / data child — in every measured list envelope
  // (31-command live census at 1.0.8). A larger array anywhere else is never
  // the entry array; it used to outvote the rows and inflate the page loop's
  // running count.
  const d6doc = { data: { rows: [1, 2], meta: { columns: [1, 2, 3, 4, 5, 6] } }, facets: { cols: [1, 2, 3] } };
  const d6 = rows(d6doc);
  check("decideEntryArray F-351: a larger array OFF the spine never outvotes the spine rows",
    d6.kind === "rows" && d6.count === 2 && d6.path === "data.rows", d6);
  check("scanListEnvelope F-351: off-spine arrays with entries are reported, largest first",
    scanListEnvelope(d6doc).offSpineArrays.map((a) => `${a.path}:${a.length}`).join("|") === "data.meta.columns:6|facets.cols:3");
  // F-354: rows only OFF the spine is REFUSED by the decision — never a count of
  // 0 (er-count printed that 0 while capture refused; one decision now).
  const d6b = rows({ _raw: { data: [1, 2, 3] }, data: { deep: { items: [1, 2, 3, 4] } } });
  check("decideEntryArray F-351/F-354: rows only OFF the spine → kind off-spine, the arrays named, a non-null reason",
    d6b.kind === "off-spine" && d6b.arrays.length === 2 && /data\.deep\.items/.test(entryDecisionReason(d6b)) && /--items-path/.test(entryDecisionReason(d6b)), d6b);
  check("decideEntryArray F-351: empty off-spine arrays do not refuse (a genuinely empty page stays empty)",
    rows({ data: [], _raw: { data: [] } }).kind === "empty");
  // Census shapes pinned: root `_rows[]` (cn activity/px) and the dm dropdowns
  // tie (root `_flatDropdowns[]` and `data.picklistList[]` equal — an echo:
  // ambiguity that cannot change the answer is not ambiguity).
  check("decideEntryArray F-351: a root-child array off `data` is spine (cn activity/px shape)",
    /** @type {*} */ (rows({ _rows: [1, 2], _total: 2 })).path === "_rows");
  const tieDoc = { _flatDropdowns: [1, 2], data: { picklistList: [1, 2], totalSize: 9 }, _total: 9 };
  const dTie = rows({ rules: [1, 2], _flatSummary: [1, 2] });
  check("decideEntryArray F-351: equal-length arrays at one level decide cleanly, the first seen (re list-and-describe echo)",
    dTie.kind === "rows" && dTie.count === 2 && dTie.path === "rules", dTie);
  check("scanListEnvelope F-351 (reopen): EVERY spine array is listed, empties included — the census's evidence of side blocks",
    scanListEnvelope(tieDoc).spineArrays.map((a) => a.path).join("|") === "_flatDropdowns|data.picklistList" &&
      scanListEnvelope({ alerts: [], data: { rows: [1] } }).spineArrays.map((a) => `${a.path}[${a.length}]`).join("|") === "alerts[0]|data.rows[1]");
  // F-351 ROUND 4 ACCEPTANCE TABLE (tune-twice-then-redesign): every shape a
  // prior round argued about, as one table judged by one rule — stated path,
  // or one distinct non-empty length on the spine; anything else refused.
  // A row here is a previous round's repro, not a mutant of the new arms.
  const n200 = Array.from({ length: 200 }, (_, i) => ({ id: i }));
  const nn = (k) => Array.from({ length: k }, (_, i) => i);
  const bundleDoc = { ctaTypes: nn(15), ctaPriorities: nn(3), ctaStatuses: nn(8), ctaReasons: nn(57), snoozeReasons: nn(3), dueDateSkipOptions: nn(4), commentOptions: nn(3), entityTypes: nn(3), userPools: nn(2), flat: nn(98) };
  const rpQuiet = { alerts: [], data: { data: [{ id: 1 }, { id: 2 }], pageInfo: { totalRecords: 2, pageSize: 200 } } };
  const rpAlert = { alerts: [{ level: "warn" }], data: { data: [{ id: 1 }, { id: 2 }], pageInfo: { totalRecords: 2, pageSize: 200 } } };
  /** @type {Array<[string, *, {itemsPath?: string}|undefined, string, ?string, ?number]>} */
  const TABLE = [
    // name, doc, opts, expected kind, expected path, expected count
    ["rp list quiet (alerts empty) — round-3 reopen premise", rpQuiet, undefined, "rows", "data.data", 2],
    ["rp list with ONE alert, unstated — refused (the reports fence states its path)", rpAlert, undefined, "ambiguous", null, null],
    ["rp list with ONE alert, stated", rpAlert, { itemsPath: "data.data" }, "rows", "data.data", 2],
    ["rp list with alerts LONGER than the rows, unstated — refused (round-3 :650 retired as unmeasured)", { alerts: [1, 2, 3, 4, 5], data: { data: [1, 2] } }, undefined, "ambiguous", null, null],
    ["tester's mirror: long _rows view beside a short data array — refused, never 3 (round-3 rank picked 3)", { _rows: n200, data: { facets: [1, 2, 3] } }, undefined, "ambiguous", null, null],
    ["tester's mirror, other direction — refused", { _rows: [1, 2, 3], data: { facets: n200 } }, undefined, "ambiguous", null, null],
    ["tester's mirror, stated", { _rows: n200, data: { facets: [1, 2, 3] } }, { itemsPath: "_rows" }, "rows", "_rows", 200],
    ["columns block beside the rows under data — refused (F-351 original hazard: never inflates)", { data: { data: n200, columns: Array(400).fill(0) } }, undefined, "ambiguous", null, null],
    ["same-level side block under data — refused", { data: { data: [1, 2], alerts: [1] } }, undefined, "ambiguous", null, null],
    ["dm dropdowns: equal-length root echo beside the payload — rows (count decided either way)", tieDoc, undefined, "rows", "_flatDropdowns", 2],
    ["re list-and-describe: equal-length root echoes — rows", { rules: [1, 2], _flatSummary: [1, 2] }, undefined, "rows", "rules", 2],
    ["cn activity/px: _rows alone — rows", { _rows: [1, 2], _total: 2 }, undefined, "rows", "_rows", 2],
    ["bare root array — rows at the empty path", [1, 2, 3, 4], undefined, "rows", "", 4],
    ["jo cta options bundle — refused", bundleDoc, undefined, "ambiguous", null, null],
    ["jo cta options bundle, stated", bundleDoc, { itemsPath: "ctaReasons" }, "rows", "ctaReasons", 57],
    ["rows only off the spine — refused (F-354)", { _raw: { data: [1, 2, 3] }, data: { deep: { items: [1, 2, 3, 4] } } }, undefined, "off-spine", null, null],
    ["genuinely empty page (empty arrays only) — empty", { data: [], _raw: { data: [] }, alerts: [] }, undefined, "empty", null, null],
    ["stated path that is an EMPTY array — rows 0 (an empty last page under a named path)", { data: { items: [] } }, { itemsPath: "data.items" }, "rows", "data.items", 0],
    ["stated path naming no array — refused", bundleDoc, { itemsPath: "nope" }, "named-missing", null, null],
  ];
  for (const [name, doc, opts, kind, path, count] of TABLE) {
    const d = /** @type {*} */ (rows(doc, opts));
    check(`F-351 acceptance table: ${name}`,
      d.kind === kind && (kind !== "rows" || (d.path === path && d.count === count)) && ((kind === "rows" || kind === "empty") === (entryDecisionReason(d) === null)), d);
  }
  check("F-351 acceptance table: a refusal names every non-empty spine candidate largest first and admits the reader cannot tell the shapes apart",
    (() => { const r = entryDecisionReason(rows(rpAlert)) ?? ""; return /"data\.data" \(2\), "alerts" \(1\)/.test(r) && /cannot tell/.test(r) && /--items-path/.test(r) && !/e\.g\./.test(r); })());
  // F-355: the one measured AMBIGUOUS envelope at 1.0.8 — `jo cta options`, a
  // bundle of ten lists of eight lengths (key names and lengths as measured on
  // the live tenant; no instance data). Refused; candidates largest first; the
  // reason names no exemplar (the first cut suggested the BFS-first candidate,
  // a 15-row list on a 98-row page); --items-path decides it.
  const n = (k) => Array.from({ length: k }, (_, i) => i);
  const bundle = {
    ctaTypes: n(15), ctaPriorities: n(3), ctaStatuses: n(8), ctaReasons: n(57), snoozeReasons: n(3),
    dueDateSkipOptions: n(4), commentOptions: n(3), entityTypes: n(3), userPools: n(2), flat: n(98),
  };
  const dB = /** @type {*} */ (rows(bundle));
  const rB = entryDecisionReason(dB) ?? "";
  check("decideEntryArray F-355: the jo-cta-options bundle (ten spine arrays, eight lengths) is kind ambiguous",
    dB.kind === "ambiguous" && dB.candidates.length === 10, dB);
  check("decideEntryArray F-355: candidates are listed largest first and the reason suggests no exemplar",
    dB.candidates[0].path === "flat" && dB.candidates[0].length === 98 && dB.candidates[1].path === "ctaReasons" &&
      /"flat" \(98\), "ctaReasons" \(57\)/.test(rB) && !/e\.g\./.test(rB) && /--items-path/.test(rB) && /cannot tell/.test(rB), rB);
  const dBn = /** @type {*} */ (rows(bundle, { itemsPath: "ctaReasons" }));
  check("decideEntryArray F-355: --items-path decides the bundle", dBn.kind === "rows" && dBn.count === 57 && dBn.path === "ctaReasons", dBn);
  const dBm = /** @type {*} */ (rows(bundle, { itemsPath: "nope" }));
  check("decideEntryArray: --items-path naming no array → kind named-missing, candidates listed in the reason",
    dBm.kind === "named-missing" && /--items-path nope names no array/.test(entryDecisionReason(dBm)) && /"flat" \(98\)/.test(entryDecisionReason(dBm)), dBm);
  check("decideEntryArray: --items-path naming an EMPTY array is rows with count 0 (an empty last page under a named path)",
    /** @type {*} */ (rows({ data: { items: [] } }, { itemsPath: "data.items" })).count === 0);

  // pageInfo spine (gate-3 F-348): a pageInfo object counts as spine only when
  // its PARENT is on the spine — one nested under a facet used to be granted
  // spine status by its key alone, so a facet's totalCount conflicted with the
  // real total on a healthy single page.
  const s7 = scanListEnvelope({ data: { rows: [1, 2], pageInfo: { totalRecords: 2 } }, facets: { byStatus: { pageInfo: { totalCount: 7 } } } });
  check("scanListEnvelope F-348: a pageInfo nested off the spine is a signal, never a reconciliation total",
    s7.rowTotals.length === 1 && s7.rowTotals[0].path === "data.pageInfo.totalRecords" &&
      s7.pageSignals.some((p) => p.path === "facets.byStatus.pageInfo.totalCount"), s7);
  check("scanListEnvelope F-348: a root-level pageInfo (jo e templates shape) is still spine",
    scanListEnvelope({ data: [1], pageInfo: { totalAfterFilters: 1, returned: 1 } }).rowTotals[0]?.path === "pageInfo.totalAfterFilters");
}

// ── F-341: bullet values written as one inline code span unwrap at the ──────
// primitive (topBullets), once for every reader. The tester's repro doc is
// pinned verbatim: four domains' KB docs quote every `- id:` this way, and
// every reader compares the value against bare payload ids.
{
  const sc = "# Acme Scorecard\n\n- id: `SC-1`\n- key: `scorecard/SC-1`\n- domain: scorecard\n";
  const b = topBullets(sc);
  check("F-341 topBullets: a whole-value code span unwraps (id)", b.id === "SC-1");
  check("F-341 topBullets: a whole-value code span unwraps (key)", b.key === "scorecard/SC-1");
  check("F-341 topBullets: a bare value is unchanged", b.domain === "scorecard");
  check("F-341 topBullets: a span INSIDE prose is content, not a wrapper",
    topBullets("- name: use `X` rule\n").name === "use `X` rule");
  check("F-341 topBullets: a lone backtick is content",
    topBullets("- name: `\n").name === "`");
  check("F-341 topBullets: an asymmetric wrap is content",
    topBullets("- name: `half\n").name === "`half");
  check("F-341 topBullets: an empty span yields the empty value", topBullets("- name: ``\n").name === "");
  check("F-341 docMeta: the repro doc resolves to a BARE id and the H1 name (was {id:\"`SC-1`\"})",
    isDeepStrictEqual(docMeta(sc), { id: "SC-1", name: "Acme Scorecard" }));
}

// ── DS-24: the collapsed KB-doc semantic parse wrappers ──────────────────────
// (GP-B5 DS-24.) Three files used to hand-sync a fence→JSON.parse→null
// wrapper — tenant-deps' docJson, relationships-build's docJson,
// jo-report-deps' docJsonBody (which adds the T-3 envelope unwrap + object
// enforcement) — and two of them a KbDocMeta resolver (docMeta). The
// differential landed BEFORE the collapse (A-6, this section's first
// revision): it proved the two docJson copies byte-equivalent in behavior,
// docJsonBody exactly T-3's rule over the same raw semantics, and the docMeta
// pair divergent on missing-value representation (relationships-build's
// undefined vs T-3's null — output-invisible, all consumers read through
// ??/truthiness). doc-lib's parseDocJson/docMeta are now the single copies,
// with jo-report-deps' exported docJsonBody composing the envelope rule on
// top; the CORPUS and every expectation below are UNCHANGED from the
// pre-collapse revision — hand-derived from the T-3 contract (envelope rule,
// KbDocMeta, extractFencedJson's own header) plus JSON semantics, never from
// running the code (R-10). Consumption pins below keep the two callers with
// deleted copies on the shared exports (the tree-wide sweep for regrown
// copies is check-doc-drift check 9's DS-24 rows). Honesty stats (docs vs
// parsed, A-3/F-228) live at the callers — parseDocJson never counts.
{
  const SCRIPTS = dirname(DOC_LIB_ABS);
  // undefined and null are DISTINCT under isDeepStrictEqual — the null shape
  // is contract (T-3), and mutant MM2 relies on the distinction.
  const deepEq = isDeepStrictEqual;
  const doc = (...lines) => lines.join("\n");

  // The shared corpus. Per entry: `raw` is the fence parsed with envelope
  // INTACT (arrays and scalars allowed) — the tenant-deps/relationships-build
  // semantics; `body` applies T-3's envelope rule on top: unwrap `{data:{…}}`
  // exactly one level when data is an object (never an array), then return
  // the result only if it is itself a non-array object — the jo-report-deps
  // semantics; `meta` is T-3 KbDocMeta in its null shape ("(none recorded)"
  // resolves to the H1, bullets stop at the first fence or `## `).
  const CORPUS = [
    { key: "full-object", raw: { ruleName: "Acme Health Rule", active: true, _flatMappings: [] },
      body: { ruleName: "Acme Health Rule", active: true, _flatMappings: [] },
      meta: { id: "rule-123", name: "Acme Health Rule" },
      doc: doc("# Acme Health Rule", "", "- key: rules-engine/rule-123", "- id: rule-123", "- name: Acme Health Rule", "",
        "## Raw", "", "```json", '{ "ruleName": "Acme Health Rule", "active": true, "_flatMappings": [] }', "```") },
    { key: "enveloped-describe", raw: { result: "ok", data: { label: "Acme S3", dataStore: "S3", columns: [{ name: "c1", label: "Col 1", type: "string" }] } },
      body: { label: "Acme S3", dataStore: "S3", columns: [{ name: "c1", label: "Col 1", type: "string" }] },
      meta: { id: "conn-9", name: "Acme S3" },
      doc: doc("# Acme S3", "", "- id: conn-9", "- name: Acme S3", "", "```json",
        '{ "result": "ok", "data": { "label": "Acme S3", "dataStore": "S3", "columns": [{ "name": "c1", "label": "Col 1", "type": "string" }] } }', "```") },
    { key: "stub-no-fence", raw: null, body: null, meta: { id: "tpl-1", name: "Welcome Email" },
      doc: doc("# Welcome Email", "", "- id: tpl-1", "- name: Welcome Email", "", `${STUB_MARKER} (shallow crawl).`) },
    { key: "prose-only", raw: null, body: null, meta: { id: null, name: "Notes" },
      doc: doc("# Notes", "", "No payload here.") },
    { key: "unterminated-fence", raw: null, body: null, meta: { id: null, name: "Broken" },
      doc: doc("# Broken", "", "```json", '{ "a": 1 }') },
    { key: "invalid-json", raw: null, body: null, meta: { id: null, name: "Bad" },
      doc: doc("# Bad", "", "```json", "{nope", "```") },
    { key: "empty-fence", raw: null, body: null, meta: { id: null, name: "Empty" },
      doc: doc("# Empty", "", "```json", "```") },
    { key: "array-payload", raw: [1, 2, 3], body: null, meta: { id: null, name: "List" },
      doc: doc("# List", "", "```json", "[1, 2, 3]", "```") },
    { key: "enveloped-array", raw: { data: [1, 2] }, body: { data: [1, 2] }, meta: { id: null, name: "ListEnv" },
      doc: doc("# ListEnv", "", "```json", '{ "data": [1, 2] }', "```") },
    { key: "data-non-object", raw: { data: "s" }, body: { data: "s" }, meta: { id: null, name: "S" },
      doc: doc("# S", "", "```json", '{ "data": "s" }', "```") },
    { key: "data-null", raw: { data: null }, body: { data: null }, meta: { id: null, name: "N" },
      doc: doc("# N", "", "```json", '{ "data": null }', "```") },
    // Exactly ONE unwrap level (T-3: "unwrap exactly one level") — a body
    // whose own payload carries a `data` key must NOT be unwrapped twice.
    { key: "body-owns-data-key", raw: { data: { data: { x: 1 }, y: 2 } }, body: { data: { x: 1 }, y: 2 }, meta: { id: null, name: "D" },
      doc: doc("# D", "", "```json", '{ "data": { "data": { "x": 1 }, "y": 2 } }', "```") },
    { key: "scalar-json", raw: 42, body: null, meta: { id: null, name: "Num" },
      doc: doc("# Num", "", "```json", "42", "```") },
    // JSON `null` parses to null — indistinguishable from a parse failure by
    // design (the callers' docs-vs-parsed stats count it as unparsed).
    { key: "json-null", raw: null, body: null, meta: { id: null, name: "Null" },
      doc: doc("# Null", "", "```json", "null", "```") },
    { key: "first-fence-wins", raw: { first: true }, body: { first: true }, meta: { id: null, name: "Two" },
      doc: doc("# Two", "", "```json", '{ "first": true }', "```", "", "```json", '{ "second": true }', "```") },
    { key: "sentinel-name", raw: null, body: null, meta: { id: "a-1", name: "Fallback Title" },
      doc: doc("# Fallback Title", "", "- id: a-1", "- name: (none recorded)", "", "prose") },
    { key: "empty-name-value", raw: null, body: null, meta: { id: "a-2", name: "T" },
      doc: doc("# T", "", "- id: a-2", "- name: ", "", "prose") },
    { key: "no-bullets-no-h1", raw: null, body: null, meta: { id: null, name: null },
      doc: doc("just prose", "no heading") },
    { key: "bullets-below-fence-ignored", raw: { k: 1 }, body: { k: 1 }, meta: { id: null, name: "B" },
      doc: doc("# B", "", "```json", '{ "k": 1 }', "```", "", "- id: late-id", "- name: Late Name") },
  ];

  // A driver that reports mismatches instead of asserting inline, so the
  // mutant self-checks below can reuse it (a thrown implementation counts as
  // a mismatch — a wrapper's contract is null-never-throw).
  const runCorpus = (fn, field) => {
    const bad = [];
    for (const c of CORPUS) {
      let got;
      try { got = fn(c.doc); } catch (e) { bad.push(`${c.key}: threw ${e.message}`); continue; }
      if (!deepEq(got, c[field])) bad.push(`${c.key}: got ${JSON.stringify(got)}, expected ${JSON.stringify(c[field])}`);
    }
    return bad;
  };

  let bad = runCorpus(parseDocJson, "raw");
  check("DS-24: parseDocJson matches the hand-derived raw expectation on every corpus doc", bad.length === 0, bad);
  bad = runCorpus(docJsonBody, "body");
  check("DS-24: jo-report-deps docJsonBody matches the T-3 envelope-rule body expectation on every corpus doc", bad.length === 0, bad);
  // The relation between the two semantics, stated once and executed against
  // the expectation TABLE (not the shipped code — that is the runCorpus line
  // above): a corpus edit whose raw and body expectations disagree with T-3's
  // one-level unwrap + object enforcement is caught here as a table defect.
  const t3Body = (raw) => {
    if (raw == null) return null;
    const unwrapped = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : raw;
    return unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped) ? unwrapped : null;
  };
  check("DS-24: every corpus body expectation equals T-3's rule applied to the raw expectation",
    CORPUS.every((c) => deepEq(t3Body(c.raw), c.body)));
  bad = runCorpus(docMeta, "meta");
  check("DS-24: docMeta matches KbDocMeta's null shape exactly (T-3 {?string})", bad.length === 0, bad);
  // The sentinel VALUE, hand-spelled (DS-13's lesson: single-sourcing makes
  // every flow-through test value-blind, and docs written by earlier plugin
  // versions carry the string — it is KB format, not a free constant).
  check("DS-24: NO_NAME exact value pinned (a change is a KB format break, not a refactor)",
    NO_NAME === "(none recorded)");
  check("DS-24: docH1 — first-H1 text, null when absent, empty title does not match (.+)",
    docH1("intro\n# Title A\n# Title B") === "Title A" && docH1("no heading") === null && docH1("# ") === null);

  // Consumption pins — the two callers whose copies were deleted must consume
  // the shared exports (positive call pins, not just import mentions); the
  // name-agnostic sweep for REGROWN copies anywhere in the tree is
  // check-doc-drift check 9's DS-24 rows, not this suite. Sources are
  // normalizeText'd so a CRLF checkout cannot skew the pins.
  const tdSrc = normalizeText(readFileSync(join(SCRIPTS, "tenant-deps.mjs"), "utf8"));
  const rbSrc = normalizeText(readFileSync(join(SCRIPTS, "relationships-build.mjs"), "utf8"));
  for (const [name, src] of [["tenant-deps.mjs", tdSrc], ["relationships-build.mjs", rbSrc]]) {
    check(`DS-24: ${name} calls the shared parseDocJson/docMeta (no local copy, no raw fence primitive)`,
      /import \{[^}]*parseDocJson[^}]*\} from "\.\/doc-lib\.mjs"/.test(src) &&
        src.includes("parseDocJson(") && src.includes("docMeta(") &&
        !src.includes("extractFencedJson(") && !/function doc(Json|Meta)\(|const doc(Json|Meta) = /.test(src));
  }

  // Mutant self-checks: the corpus must DETECT each defect class, or the pins
  // are decorative (A-11). Each mutant is a hand-written implementation of
  // one defect class, run against the same corpus — in memory, no file
  // writes. (Real-file mutants were additionally killed at review time; the
  // classes here keep that proof running every suite run.)
  const unwrap = (json) => (json.data && typeof json.data === "object" && !Array.isArray(json.data) ? json.data : json);
  const objectOnly = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
  // MJ1: envelope unwrap dropped → enveloped-describe body goes wrong.
  let m = (md) => { const j = parseDocJson(md); return j == null ? null : objectOnly(j); };
  check("DS-24 mutant MJ1 (unwrap dropped) is caught by the corpus", runCorpus(m, "body").length > 0);
  // MJ2: object enforcement dropped → array/scalar payloads leak through.
  m = (md) => { const j = parseDocJson(md); return j == null ? null : unwrap(j); };
  check("DS-24 mutant MJ2 (object enforcement dropped) is caught by the corpus", runCorpus(m, "body").length > 0);
  // MJ3: null-never-throw broken → invalid-json/no-fence throws.
  m = (md) => JSON.parse(extractFencedJson(md));
  check("DS-24 mutant MJ3 (throw instead of null) is caught by the corpus", runCorpus(m, "raw").length > 0);
  // MM1: sentinel handling dropped → "(none recorded)" leaks as the name.
  m = (md) => { const b = topBullets(md); return { id: b.id ?? null, name: b.name ?? docH1(md) }; };
  check("DS-24 mutant MM1 (sentinel dropped) is caught by the corpus", runCorpus(m, "meta").length > 0);
  // MM2: null shape dropped (the pre-DS-24 relationships-build divergence) →
  // the strict null expectations go red.
  m = (md) => { const b = topBullets(md); return { id: b.id, name: b.name && b.name !== NO_NAME ? b.name : docH1(md) }; };
  check("DS-24 mutant MM2 (null shape dropped) is caught by the corpus", runCorpus(m, "meta").length > 0);
}

// ── W9 (GP-B5 B13): the designer composite's grammar and writers/readers ────
// Expectations derived from task-detail.js's taskFieldLabel / buildJoinRows /
// buildUnionFields grammars at CLI 1.0.8 and the T-3 v5 header — never from
// running the code first.
{
  const {
    splitDesignerFieldLabel, splitTrailingGroup, designerTaskFieldLabels, designerDrilldownStats, designerDocProgress,
    renderRawDescribeDoc, renderDesignerDoc, DESIGNER_FIELD_SUFFIX_KEYS, DESIGNER_TASK_TABLES, NO_NAME: NONAME,
  } = await import("../scripts/doc-lib.mjs");
  check("W9 trailing group: the LAST parenthesized group splits off; a label's own inner parentheses stay in the base", isDeepStrictEqual(splitTrailingGroup("Rollup (v2) (rollup_v2__gc)"), { base: "Rollup (v2)", group: "rollup_v2__gc" }) && splitTrailingGroup("plain") === null && splitTrailingGroup("(MAX)") === null && splitTrailingGroup(null) === null);
  check("W9 suffix: an aggregation key in the ONE trailing group is stripped and recorded", isDeepStrictEqual(splitDesignerFieldLabel("ARR (MAX)"), { label: "ARR", suffix: "MAX" }));
  check("W9 suffix: a formula function key strips too (the 54-key vocabulary)", isDeepStrictEqual(splitDesignerFieldLabel("Growth (trend_percentage)"), { label: "Growth", suffix: "trend_percentage" }));
  check("W9 suffix: the structured-formula and wrapper keys strip too (the review round's six)", splitDesignerFieldLabel("Trend (period_over_period_comparison)").suffix === "period_over_period_comparison" && splitDesignerFieldLabel("Calc (anonymous)").suffix === "anonymous" && splitDesignerFieldLabel("Bucket (CASE)").suffix === "CASE");
  check("W9 suffix: a label's OWN trailing parenthesis is NOT a suffix — keyed on the vocabulary, never on shape", isDeepStrictEqual(splitDesignerFieldLabel("Rollup (v2)"), { label: "Rollup (v2)", suffix: null }));
  check("W9 suffix: the vocabulary is exact-case (aggregations upper, functions lower)", splitDesignerFieldLabel("ARR (max)").suffix === null && splitDesignerFieldLabel("x (TREND)").suffix === null);
  check("W9 suffix: a bare parenthesized group is a label (needs a non-space char before the group)", isDeepStrictEqual(splitDesignerFieldLabel("(MAX)"), { label: "(MAX)", suffix: null }));
  check("W9 suffix: vocabulary size = 6 aggregations + 54 formula keys + 4 structured keys + 2 wrappers", DESIGNER_FIELD_SUFFIX_KEYS.size === 66);
  check("W9 tables: DESIGNER_TASK_TABLES lists the CLI's 14 `_task*` tables, no duplicates", DESIGNER_TASK_TABLES.length === 14 && new Set(DESIGNER_TASK_TABLES).size === 14 && DESIGNER_TASK_TABLES.every((k) => k.startsWith("_task") && k !== "_tasks"));
  const labels = designerTaskFieldLabels(/** @type {*} */ ({
    _taskShowFields: [{ _index: 1, _field: "ARR (MAX)" }, { _index: 2, _field: "Name" }, { _index: 3, _field: "  " }],
    _taskDetailRows: [{ _key: "Source", _value: "company (MDA)" }, { _key: "Fields (t1)", _value: "Companies: ARR, Name (2)" }, { _key: "Fields (t2)", _value: "Users: A, B (3)" }, { _key: "Fields (t3)", _value: "no-colon (1)" }],
    _taskUnionMerged: [{ _index: 1, _field: "Unified" }], _taskUnionOther: [{ _index: 1, _field: "Other" }],
  }));
  check("W9 labels: show rows (suffix split, blanks dropped) + parsed join Fields rows + union tables, in order, with their source", isDeepStrictEqual(labels.labels, [
    { label: "ARR", suffix: "MAX", source: "show" }, { label: "Name", suffix: null, source: "show" },
    { label: "ARR", suffix: null, source: "join" }, { label: "Name", suffix: null, source: "join" },
    { label: "Unified", suffix: null, source: "union" }, { label: "Other", suffix: null, source: "union" },
  ]), labels.labels);
  check("W9 labels: a join Fields row whose split count ≠ the declared N, or with no ': ', is reported UNPARSED (never guessed)", labels.unparsed.length === 2 && labels.unparsed.every((u) => /Fields \(t[23]\)/.test(u.key)), labels.unparsed);
  // The grammar-correct split (review round): the source label and the field
  // labels are both free text, so the ONE ": " position whose comma-split
  // yields N fields is accepted — zero or several qualifying positions is
  // unparsed, never a silent mis-slice.
  const joinRow = (v) => designerTaskFieldLabels(/** @type {*} */ ({ _taskDetailRows: [{ _key: "Fields (t1)", _value: v }] }));
  check("W9 labels: a colon WITHOUT a following space is not a split position — 'Stage:Won: A, B (2)' parses", isDeepStrictEqual(joinRow("Stage:Won: A, B (2)").labels.map((l) => l.label), ["A", "B"]));
  // A source label containing ": " is ALWAYS ambiguous under the emitter's
  // grammar (the earlier split keeps the same comma count), so the honest
  // answer is unparsed — never the first-": " guess the review round caught
  // mis-slicing "Extract: Company: Name, ARR (2)" into ["Company: Name", "ARR"].
  check("W9 labels: a source label containing ': ' makes every split position qualify → unparsed with the count of qualifying splits, never a guess", joinRow("Extract: Company: Name, ARR (2)").labels.length === 0 && /2 qualifying split/.test(joinRow("Extract: Company: Name, ARR (2)").unparsed[0].reason) && joinRow("Extract: Company: Name (1)").unparsed.length === 1 && joinRow("Q3: Renewals: A, B, C (3)").unparsed.length === 1);
  check("W9 labels: a field label containing ', ' over-splits against N and is unparsed", joinRow("Company: Rev, Net, ARR (2)").unparsed.length === 1 && joinRow("Company: Rev, Net, ARR (2)").labels.length === 0);
  check("W9 labels: absent tables → nothing, nothing thrown", isDeepStrictEqual(designerTaskFieldLabels(null), { labels: [], unparsed: [] }));
  /** @type {*} */
  const kb = { version: 1, templateFingerprint: "a".repeat(40), capturedAt: "x", flags: { task: "--task-id", field: "--field" },
    tasks: { t1: { status: "ok" }, t2: { status: "pending" }, t3: { status: "failed", error: "e", fieldListUnparsed: "r" } },
    fields: { t1: { A: { status: "ok", source: "show", duplicates: 2 }, B: { status: "failed", source: "show" }, C: { status: "failed", source: "show", permanent: true } }, t2: {} },
    taskDetails: {}, fieldDetails: {} };
  const s = designerDrilldownStats(kb);
  check("W9 stats: counts per status, duplicates summed, unparsed lists counted, PERMANENT failures counted apart, complete false while anything is pending/retryably failed", s.tasksTotal === 3 && s.tasksOk === 1 && s.tasksPending === 1 && s.tasksFailed === 1 && s.fieldsTotal === 3 && s.fieldsOk === 1 && s.fieldsFailed === 1 && s.fieldsPermanentlyFailed === 1 && s.duplicateLabels === 2 && s.unparsedFieldLists === 1 && s.complete === false, s);
  const st = (tasks, fields) => designerDrilldownStats(/** @type {*} */ ({ tasks, fields }));
  check("W9 stats: complete = every task ok and every field ok (a duplicate is a property of an ok field, not an open item)", st({ t1: { status: "ok" } }, { t1: { A: { status: "ok", duplicates: 3 } } }).complete === true);
  check("W9 stats: ONE failed field with every task ok keeps the composite incomplete (mutation M18 — the field axis alone)", st({ t1: { status: "ok" } }, { t1: { A: { status: "ok" }, B: { status: "failed" } } }).complete === false);
  check("W9 stats: ONE pending field with every task ok keeps the composite incomplete", st({ t1: { status: "ok" } }, { t1: { A: { status: "pending" } } }).complete === false);
  check("W9 stats: a PERMANENTLY failed field (the CLI refused every spelling) is a recorded gap, not an open item — complete stays true", st({ t1: { status: "ok" } }, { t1: { A: { status: "failed", permanent: true, error: "No field found" } } }).complete === true);
  check("W9 progress: null for a body without _kb, with another version, or with a missing map; the composite otherwise", designerDocProgress({ _tasks: [] }) === null && designerDocProgress({ _kb: { ...kb, version: 2 } }) === null && designerDocProgress({ _kb: { ...kb, fieldDetails: undefined } }) === null && designerDocProgress(null) === null && designerDocProgress({ _kb: kb })?.tasksTotal === 3);
  // Leaf validation (review round): a composite whose per-item records are
  // not the typedef's shape reads as NO composite — the writer's resume loops
  // never see a primitive where a record is due.
  check("W9 progress: a task record that is a primitive, or with an unknown status, → null", designerDocProgress({ _kb: { ...kb, tasks: { t1: "ok" } } }) === null && designerDocProgress({ _kb: { ...kb, tasks: { t1: { status: "done" } } } }) === null);
  check("W9 progress: a fields map whose task entry is a string, or whose field record is a primitive, → null", designerDocProgress({ _kb: { ...kb, fields: { t1: "corrupt" } } }) === null && designerDocProgress({ _kb: { ...kb, fields: { t1: { A: 5 } } } }) === null);
  check("W9 progress: a fieldDetails entry that is not a row array, or a taskDetails entry that is not a record, → null", designerDocProgress({ _kb: { ...kb, fieldDetails: { t1: { A: "rows" } } } }) === null && designerDocProgress({ _kb: { ...kb, taskDetails: { t1: [] } } }) === null);
  // The raw describe doc, hand-spelled from the pre-W9 inline writer — the
  // hoist's byte-identity pin (A-6).
  const raw = renderRawDescribeDoc({ name: "Risk Rule", key: "rules-engine-rules/r-1", id: "r-1", core: { ruleId: "r-1", active: true, n: null, empty: "", nested: { x: 1 }, list: [1] }, fenceText: '{\n  "data": {}\n}', provenance: "> Full describe doc — generated by describe-batch.mjs, captured T." });
  check("W9 raw doc: byte-identical to the inline shape (H1 · provenance · key/id/name · scalar bullets only · one fence)", raw === "# Risk Rule\n\n> Full describe doc — generated by describe-batch.mjs, captured T.\n\n- key: rules-engine-rules/r-1\n- id: r-1\n- name: Risk Rule\n- ruleId: r-1\n- active: true\n- n: null\n- empty: \"\"\n\n```json\n{\n  \"data\": {}\n}\n```\n", JSON.stringify(raw));
  check("W9 raw doc: a null name → H1 falls back to the id and the bullet carries the sentinel", renderRawDescribeDoc({ name: null, key: "k", id: "x-1", core: {}, fenceText: "{}", provenance: "> p" }).startsWith(`# x-1\n\n> p\n\n- key: k\n- id: x-1\n- name: ${NONAME}\n`));
  const payload = { result: true, data: { templateId: "dd-1", name: "N", _taskCount: 1, _tasks: [{ taskId: "t1" }] } };
  const before = JSON.stringify(payload);
  const doc = renderDesignerDoc({ name: "N", key: "data-designer/dd-1", id: "dd-1", payload, envelope: true, kb, capturedAt: "T" });
  check("W9 designer doc: _kb lands on the unwrapped body (data) and the INPUT payload is not mutated", /"_kb": \{/.test(doc) && JSON.parse(/```json\n([\s\S]*?)\n```/.exec(doc)[1]).data._kb.version === 1 && JSON.stringify(payload) === before);
  check("W9 designer doc: `_kb` is an object, so it never becomes a metadata bullet; templateId does", /- templateId: dd-1\n/.test(doc) && !/- _kb:/.test(doc));
  check("W9 designer doc: provenance states the outcome — retryable failures, permanent gaps, duplicates, unparsed lists — and INCOMPLETE while items are pending/retryably failed", /^> Full describe doc \(designer doc-mode: template describe \+ task\/field drilldowns — 1\/3 task\(s\), 1\/3 field\(s\) drilled, 2 failed \(retried next run\), 1 field\(s\) unresolvable by the CLI \(recorded gap\), 2 duplicate label\(s\), 1 field list\(s\) unparsed; INCOMPLETE — resumes on the next describe-batch run\) — generated by describe-batch\.mjs, captured T\.$/m.test(doc), doc.split("\n")[2]);
  const docTop = renderDesignerDoc({ name: "N", key: "k", id: "dd-1", payload: { templateId: "dd-1", _tasks: [] }, envelope: false, kb: /** @type {*} */ ({ ...kb, tasks: { t1: { status: "ok" } }, fields: {} }), capturedAt: "T" });
  check("W9 designer doc: without an envelope _kb lands at the top level; a complete composite carries no INCOMPLETE", JSON.parse(/```json\n([\s\S]*?)\n```/.exec(docTop)[1])._kb.version === 1 && /1\/1 task\(s\), 0\/0 field\(s\) drilled\)/.test(docTop) && !/INCOMPLETE/.test(docTop), docTop.split("\n")[2]);
}

// ── readKbIdentity: the ONE KB identity read for both deps surfaces (W10, F-361) ──
// F-373: the JSDoc contract is ATTACHED to the function. npm run typecheck
// (checkJs, test/ included) must reject a wrong-typed call; if the block ever
// detaches again the directive below is unused and the type gate reds.
// @ts-expect-error readKbIdentity(kbDir: string, warnings: string[]) — a number is not a string
if (process.env.ZZ_NEVER_SET_TYPE_PROBE) readKbIdentity(42, []);
// Predictions, written before the first run: no manifest → slug from the
// directory name, "unknown" baseUrl/environment, {} inventory, exactly ONE
// warning naming the file and "directory name"; a BOM'd manifest → its four
// fields, no warning (normalizeText strips the BOM); a non-object inventory →
// {} with no warning (the stricter of the two drifted guards won — A-4).
{
  const dir = makeTempDir("doclib-identity");
  const kb = join(dir, "acme-prod");
  mkdirSync(kb, { recursive: true });
  let w = [];
  let id = readKbIdentity(kb, w);
  check("readKbIdentity: no manifest → directory-name slug, unknowns, {} inventory, one warning naming the file",
    id.slug === "acme-prod" && id.baseUrl === "unknown" && id.environment === "unknown" && Object.keys(id.inventory).length === 0 &&
      w.length === 1 && /_manifest\.json unreadable/.test(w[0]) && /directory name/.test(w[0]), { id, w });
  writeFileSync(join(kb, "_manifest.json"), String.fromCharCode(0xfeff) + JSON.stringify({ slug: "acme-sbx", baseUrl: "https://acme.example", environment: "sandbox", inventory: { "journey/p-1": { status: "documented" } } }));
  w = [];
  id = readKbIdentity(kb, w);
  check("readKbIdentity: a BOM'd manifest → its slug/baseUrl/environment/inventory, no warning",
    id.slug === "acme-sbx" && id.baseUrl === "https://acme.example" && id.environment === "sandbox" && id.inventory["journey/p-1"]?.status === "documented" && w.length === 0, { id, w });
  writeFileSync(join(kb, "_manifest.json"), JSON.stringify({ slug: "acme-sbx", inventory: "not-an-object" }));
  w = [];
  id = readKbIdentity(kb, w);
  check("readKbIdentity: a non-object inventory reads as {} (the stricter guard, now on both surfaces)",
    id.slug === "acme-sbx" && id.baseUrl === "unknown" && Object.keys(id.inventory).length === 0 && w.length === 0, { id, w });
  removeTempDir(dir);
}

// ── F-429: recorded-domain resolution — the one home every KB reader asks ─────
// A lane's identity is its canonical list path; the folder name is whatever the
// manifest recorded for that command. Run against the bundled catalog from a
// scratch dir with no .gs-superadmin above it.
{
  const BUNDLED = join(dirname(DOC_LIB_ABS), "..", "reference", "catalog.json");
  const scratch = join(process.env.TEMP || process.env.TMPDIR || "/tmp", `doc-lib-f429-${process.pid}`);
  mkdirSync(scratch, { recursive: true });
  const lanes = { connections: "connectors list", reports: "report list", rules: "rules-engine rules list" };
  const defaults = { connections: "connectors", reports: "report", rules: "rules-engine" };
  const stamp = (listCommand) => ({ at: "2026-01-01T00:00:00.000Z", idField: "id", listCommand });
  try {
    const r1 = resolveRecordedDomains({
      startDir: scratch,
      domainsIndexed: { connections: stamp("gs-admin --json cn list"), "report-reports": stamp("gs-admin --json rp list") },
      lanes, defaults, bundledCatalogPath: BUNDLED,
    });
    check("F-429 resolver: a recorded lane resolves to the workspace's folder name, alias spellings (cn, rp) included", r1.dirs.connections === "connections" && r1.dirs.reports === "report-reports" && r1.basis.connections === "manifest recording", JSON.stringify(r1));
    check("F-429 resolver: an unrecorded lane keeps its default with basis 'default (no recording)'", r1.dirs.rules === "rules-engine" && r1.basis.rules === "default (no recording)", JSON.stringify(r1.basis));
    check("F-429 resolver: lanes resolved away from the defaults are named in ONE summary warning", r1.warnings.some((w) => /differing from the defaults: connections → connections \(default connectors\); reports → report-reports \(default report\)/.test(w)), JSON.stringify(r1.warnings));
    const r2 = resolveRecordedDomains({
      startDir: scratch,
      domainsIndexed: { connectors: stamp("gs-admin --json cn list"), "connectors-dup": stamp("gs-admin --json connectors list"), legacy: { at: "2026-01-01T00:00:00.000Z" }, odd: stamp("gs-admin --json nosuch verb") },
      lanes, defaults, bundledCatalogPath: BUNDLED,
    });
    check("F-429 resolver: two domains recording one list, nothing to separate them → first by name, basis 'ambiguous', warning names both and says why", r2.dirs.connections === "connectors" && r2.basis.connections === "manifest recording (ambiguous)" && r2.warnings.some((w) => /2 domains record "connectors list" \(connectors, connectors-dup\) — reading connectors \(first by name — no inventory entries or docs on disk separate them\)/.test(w)), JSON.stringify(r2));
    check("F-429 resolver: a legacy stamp (no listCommand) and an unresolvable recording claim no lane", r2.dirs.reports === "report" && r2.basis.reports === "default (no recording)", JSON.stringify(r2.basis));
    // Second pass: the ambiguity is decided by evidence, never by spelling —
    // the domain holding inventory entries wins even when it sorts LAST …
    const r2b = resolveRecordedDomains({
      startDir: scratch,
      domainsIndexed: { "aaa-probe": stamp("gs-admin --json cn list"), connections: stamp("gs-admin --json connectors list") },
      inventory: { "connections/c-1": { id: "c-1", domain: "connections" }, "connections/c-2": { id: "c-2", domain: "connections" } },
      lanes, defaults, bundledCatalogPath: BUNDLED,
    });
    check("F-429 resolver (second pass): among two recordings the domain with inventory entries is read, not the probe that sorts first; the warning names the rung", r2b.dirs.connections === "connections" && r2b.basis.connections === "manifest recording (ambiguous)" && r2b.warnings.some((w) => /reading connections \(it holds 2 inventory entries\)/.test(w)), JSON.stringify(r2b));
    // … and with no inventory at all, the domain whose folder holds docs on
    // disk wins (the folder rung reads under startDir).
    mkdirSync(join(scratch, "connections"), { recursive: true });
    writeFileSync(join(scratch, "connections", "c-1.md"), "# c-1\n", "utf8");
    const r2c = resolveRecordedDomains({
      startDir: scratch,
      domainsIndexed: { "aaa-probe": stamp("gs-admin --json cn list"), connections: stamp("gs-admin --json connectors list") },
      lanes, defaults, bundledCatalogPath: BUNDLED,
    });
    check("F-429 resolver (second pass): with no inventory the domain whose folder holds docs on disk is read; the warning names the rung", r2c.dirs.connections === "connections" && r2c.warnings.some((w) => /reading connections \(its folder holds 1 doc\(s\) on disk\)/.test(w)), JSON.stringify(r2c));
    // F-434 (release-gate review of 0.37.0): an explicit flag is an override the
    // resolver applies itself — that lane's folder is the flag's, its basis names
    // the flag, and NO recording warning (moved or ambiguous) is produced for it,
    // so every surface quoting the warnings agrees with the basis.
    const r2d = resolveRecordedDomains({
      startDir: scratch,
      domainsIndexed: { "aaa-probe": stamp("gs-admin --json cn list"), connections: stamp("gs-admin --json connectors list"), "report-reports": stamp("gs-admin --json rp list") },
      lanes, defaults, overrides: { connections: "conn-override", rules: undefined }, bundledCatalogPath: BUNDLED,
    });
    check("F-434 resolver: an override wins the lane, basis names the flag, and no warning mentions that lane; other lanes resolve as before", r2d.dirs.connections === "conn-override" && r2d.basis.connections === "flag --connections-domain" && !r2d.warnings.some((w) => /connections/.test(w)) && r2d.dirs.reports === "report-reports" && r2d.warnings.some((w) => /reports → report-reports/.test(w)) && r2d.basis.rules === "default (no recording)", JSON.stringify(r2d));
    // F-429 fourth pass: the lane table is ONE home and it is valid against the
    // bundled catalog — every lane's list path is a known command (a CLI rename
    // fails here, not silently in a reader), every folder is distinct, and
    // laneTable() re-keys a subset without changing its values.
    const { known: knownPaths } = makeCommandResolver(readJsonFile(BUNDLED));
    const laneRows = Object.entries(RECORDED_LANES);
    const unknownLanes = laneRows.filter(([, row]) => !knownPaths.has(row.path)).map(([k]) => k);
    const folders = laneRows.map(([, row]) => row.folder);
    check("F-429 lane table: every RECORDED_LANES path is a command the bundled catalog knows, every folder is distinct, and the table is frozen", laneRows.length >= 11 && unknownLanes.length === 0 && new Set(folders).size === folders.length && Object.isFrozen(RECORDED_LANES), { unknownLanes, folders });
    const lt = laneTable({ journeys: "journey", scorecard: "scorecards" });
    check("F-429 laneTable: a script's re-keyed subset carries the table's values", lt.lanes.journeys === "journey programs list" && lt.defaults.journeys === "journey" && lt.lanes.scorecard === "scorecard list" && lt.defaults.scorecard === "scorecard", lt);
    let threw = null;
    try { laneTable(/** @type {any} */ ({ x: "no-such-lane" })); } catch (e) { threw = e.message; }
    check("F-429 laneTable: an unknown lane key throws rather than defaulting silently", /no lane "no-such-lane"/.test(threw ?? ""), threw);
    const r3 = resolveRecordedDomains({ startDir: scratch, domainsIndexed: { connections: stamp("gs-admin --json cn list") }, lanes, defaults, bundledCatalogPath: join(scratch, "no-catalog-here.json") });
    check("F-429 resolver: no catalog anywhere → every lane default, basis 'default (no catalog)', said out loud", r3.dirs.connections === "connectors" && Object.values(r3.basis).every((b) => b === "default (no catalog)") && r3.warnings.some((w) => /no catalog found/.test(w)), JSON.stringify(r3));
    const r4 = resolveRecordedDomains({ startDir: scratch, domainsIndexed: {}, lanes: { ghost: "no-such namespace list" }, defaults: { ghost: "ghost" }, bundledCatalogPath: BUNDLED });
    check("F-429 resolver: a lane whose list path is not in the catalog is said out loud, never silently defaulted", r4.basis.ghost === "default (list path not in this catalog)" && r4.warnings.some((w) => /lane ghost: list path "no-such namespace list" is not in the installed catalog/.test(w)), JSON.stringify(r4));
    // The two pieces underneath, directly.
    const { resolveLine } = makeCommandResolver(readJsonFile(BUNDLED));
    const bp = recordedDomainsByPath({ a: stamp("gs-admin --json re r list"), b: stamp("gs-admin --json rules-engine rules list"), c: { at: "x" }, d: stamp("gs-admin --json zz") }, resolveLine);
    check("F-429 recordedDomainsByPath: alias and canonical spellings of one list fold to one path; legacy and unresolvable are reported apart", (bp.byPath.get("rules-engine rules list") ?? []).join(",") === "a,b" && bp.legacyDomains.join() === "c" && bp.unresolved.length === 1 && bp.unresolved[0].domain === "d", JSON.stringify([...bp.byPath], null, 0));
    const ov = indexedElsewhere({ "x/1": { id: "1", domain: "x" }, "y/1": { id: "1", domain: "y" }, "y/2": { id: "2", domain: "y" } }, ["1", "2", "3"], "x");
    check("F-429 indexedElsewhere: excludes the target domain's own entries and counts the rest per domain", ov.matches.length === 2 && ov.byDomain.y === 2 && ov.byDomain.x === undefined, JSON.stringify(ov));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (failures) {
  console.log(`\n${failures} failure(s), ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll doc-lib direct checks passed (${passed})`);
