#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// capture.mjs (test) — fixtures for scripts/capture.mjs (B5 W4/DS-17).
//
// Covers: the clean-write contract (captured file is UTF-8 with NO BOM, bytes
// exact, non-ASCII intact — the PS-redirect encoding class this helper exists
// to retire), a BOM-emitting child stripped defensively, the failure honesty
// contract (child failure → child's exit code, NOTHING written, an earlier
// capture left byte-identical and named as earlier), the normalize mode on
// the PS 5.1 redirect realities (UTF-16LE with BOM, UTF-16BE with BOM, UTF-8
// with BOM) plus already-clean passthrough, and the fail-closed read-only
// gate in this script's capture parameterization, and the --wait bounded
// poll (DS-26): readiness on COMPLETED under the REQUIRED data envelope —
// differential-locked against jo-report-deps' parseLiveDepsAreas (both
// implementations driven over the same stub payloads; a flat payload is
// rejected by BOTH) — the re-run loop, the full-budget timeout (last sleep
// clamped to the remaining window), timeout honesty (non-zero "not ready
// after N s" naming the last status, NOTHING written, an earlier capture
// untouched), the no-progress-contract shape named at timeout, a failed
// attempt keeping the child's exit code, and the knob validations
// (interval floor 1 s). Gate: catalog-mutating refused,
// unknown refused fail-closed, non-capture-shaped reads refused, list-shaped
// name admitted via actionKey (`jo e templates`), the async `dm deps check`
// admitted, a list-verb command with a PUT endpoint refused (endpoint gate
// independent of shape), ask-override refused outright on a synthetic list
// (copied tree — the shipped list is empty since CLI 1.0.8), no-catalog
// refusal, and the argv hygiene refusals (shell operator, non-gs-admin,
// path-prefixed binary).
//
// The CLI is faked with a local node script via --bin; fixtures live under
// the OS temp dir (shared rig) — no real state.
//
// Run:  node plugins/gs-superadmin/test/capture.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
// The consuming readers' parse — the differential-lock counterpart for the
// --wait readiness rule (both sides driven over the same stub payloads).
import { parseLiveDepsAreas } from "../scripts/jo-report-deps.mjs";

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts");
const CAPTURE = join(SCRIPTS, "capture.mjs");

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)}`);
  }
}

const ROOT = makeTempDir("gs-superadmin-capture");
try {
  // ── Fixtures: workspace catalog, fake CLI ─────────────────────────────────
  const CATALOG = JSON.stringify({
    globalFlags: [{ flag: "--json" }, { flag: "--base-url <url>" }],
    domains: [
      { namespace: "rules-engine", aliases: ["re"] },
      { namespace: "journey", aliases: ["jo"] },
      { namespace: "data-management", aliases: ["dm"] },
    ],
    commands: [
      // The capture surface the skills actually use: list pages, per-item
      // describes, and the async dependency scan.
      { path: "rules-engine rules list", shortPath: "re r list", mutating: false, actionKey: "list-rules",
        endpoints: [{ method: "POST", path: "/v1/rulesengine/rules/list" }] },
      { path: "rules-engine rules describe", shortPath: "re r describe", mutating: false, actionKey: "describe-rule" },
      // List-shaped by actionKey only — the resolved-path verb is "templates".
      { path: "journey email templates", shortPath: "jo e templates", mutating: false,
        actionKey: "list-email-templates", endpoints: [{ method: "GET", path: "/v1/email/templates" }] },
      { path: "data-management dependencies check", shortPath: "dm deps check", mutating: false,
        actionKey: "object-dependencies", endpoints: [{ method: "POST", path: "/v1/deps/check" }] },
      // List-shaped by SUMMARY only — neither verb ("config") nor actionKey is
      // list-shaped; domain-candidates' second prong is what classifies it
      // (review round: dropping the prong refused a genuine setup candidate).
      { path: "data-management dependencies config", shortPath: "dm deps config", mutating: false,
        actionKey: "dependency-config", summary: "List available dependency areas",
        endpoints: [{ method: "GET", path: "/v1/deps/config" }] },
      // Refusal surface.
      { path: "rules-engine rules delete", shortPath: "re r delete", mutating: true },
      { path: "rules-engine rules run-now", shortPath: "re r run-now", mutating: false },
      // List-shaped verb, write endpoint: the endpoint gate must be
      // independent of the shape gate, not a restatement of it.
      { path: "rules-engine rules list-sneaky", shortPath: "re r list-sneaky", mutating: false,
        endpoints: [{ method: "PUT", path: "/v1/rulesengine/sneaky" }] },
    ],
  });
  const WS = join(ROOT, "ws");
  writeFiles(WS, { ".gs-superadmin/catalog.json": CATALOG });
  const TMP = join(WS, ".gs-superadmin", "tmp");

  // Fake CLI: emits a payload with non-ASCII content (the bytes the PS-redirect
  // class mangles), env-switchable to a BOM-prefixed or failing variant.
  const FAKE = join(ROOT, "fake-gs-admin.mjs");
  writeFileSync(
    FAKE,
    [
      // finish(): write, then exit in the write CALLBACK. Node's stdout is
      // asynchronous when it is a pipe (POSIX), so print-then-process.exit
      // loses everything past the first ~8 KB chunk — the release-PR macOS
      // leg caught V3's 648-row page arriving as exactly 8192 bytes (F-356).
      // Every exit path below that prints goes through this one helper.
      "const finish = (s) => { process.stdout.write(s + '\\n', () => process.exit(0)); };",
      "const payload = JSON.stringify({ data: [{ id: 'r-1', name: 'h\\u00e9llo \\u2713 caf\\u00e9' }], args: process.argv.slice(2) });",
      "if (process.env.FAKE_MODE === 'fail') { console.error('boom: simulated CLI failure'); process.exit(3); }",
      "else if (process.env.FAKE_MODE === 'bom') finish('\\uFEFF' + payload);",
      // Stateful async-scan stub (DS-26): each invocation bumps a counter file;
      // the payload reports INIT until the FAKE_READY_AT-th call, then
      // COMPLETED. FAKE_FLAT=1 emits the body without the data envelope.
      "else if (process.env.FAKE_MODE === 'deps-poll') {",
      "  const fs = await import('node:fs');",
      "  let n = 0; try { n = Number(fs.readFileSync(process.env.FAKE_COUNTER, 'utf8')) || 0; } catch {}",
      "  n++; fs.writeFileSync(process.env.FAKE_COUNTER, String(n));",
      "  const ready = n >= Number(process.env.FAKE_READY_AT || '1');",
      "  const body = ready",
      "    ? { objectName: 'Company', progressStatus: { overallStatus: 'COMPLETED', areaStatusMap: {} }, dependents: { RULE: [] } }",
      "    : { objectName: 'Company', progressStatus: { overallStatus: 'INIT' } };",
      "  if (ready && process.env.FAKE_NO_DEPS === '1') delete body.dependents;",
      "  finish(JSON.stringify(process.env.FAKE_FLAT === '1' ? body : { data: body }));",
      "}",
      // Paged list stub (DS-30): FAKE_PAGES is a comma list of page row
      // counts; pages beyond it are empty. The page number is read from the
      // argv token after FAKE_PAGE_FLAG (default --page; absent argv → page
      // 1). FAKE_SHAPE picks an envelope from the measured variance menu.
      "else if (process.env.FAKE_MODE === 'paged') {",
      "  const argv2 = process.argv.slice(2);",
      "  const pf = process.env.FAKE_PAGE_FLAG || '--page';",
      "  const pi = argv2.indexOf(pf);",
      "  const page = pi === -1 ? 1 : Number(argv2[pi + 1]);",
      "  const sizes = (process.env.FAKE_PAGES || '').split(',').filter(Boolean).map(Number);",
      "  const n = sizes[page - 1] ?? 0;",
      "  const total = process.env.FAKE_TOTAL === '' || process.env.FAKE_TOTAL === undefined ? null : Number(process.env.FAKE_TOTAL);",
      "  const badPage = Boolean(process.env.FAKE_BAD_PAGE) && page === Number(process.env.FAKE_BAD_PAGE);",
      "  const rows = Array.from({ length: n }, (_, i) => ({ id: `r${page}-${i}` }));",
      "  const shapes = {",
      "    'data-pageinfo': { data: { data: rows, pageInfo: { totalRecords: total, totalPages: 3, limit: 200, pageNumber: page, nextAvailable: n > 0 } } },",
      "    'pageinfo-pagesize': { data: { data: rows, pageInfo: { totalRecords: total, pageSize: 200 } } },",
      "    'top-pageinfo': { data: rows, pageInfo: { returned: n, totalAfterFilters: total, limit: 10000 } },",
      "    'data-totals': { data: { advancedOutreaches: rows, totalRecords: total, totalPages: 6, lastPage: n === 0 } },",
      "    'bare': { data: rows },",
      "    'sc-total': { _total: total, data: rows },",
      "    'liteobjects': { data: { liteObjects: rows.map((r) => ({ ...r, steps: Array.from({ length: 50 }, (_, k) => k) })), totalNumberOfObjects: total, nextPage: page + 1 } },",
      "    'conflict': { _total: (total ?? 0) + 1, data: { data: rows, pageInfo: { totalRecords: total } } },",
      "    'string-total': { data: { advancedOutreaches: rows, totalRecords: String(total) } },",
      // gate-3 F-351: a non-entry SIBLING array under data, LARGER than the
      // rows (a columns/facets block) — the shape that used to outvote the
      // rows and inflate the running count.
      "    'sibling-array': { data: { data: rows, columns: Array.from({ length: n * 2 }, (_, k) => ({ c: k })), pageInfo: { totalRecords: total } } },",
      // gate-3 F-351: rows nowhere on the envelope spine — a shape no census
      // has seen; the loop must refuse it, never count it as 0 entries.
      "    'off-spine': { data: { deep: { items: rows } }, _raw: { echo: rows } },",
      // F-351 reopen: rp list on an alert-bearing tenant — a root-level side
      // block beside the data payload, filled on every page.
      "    'rp-alerts': { alerts: [{ level: 'warn', message: 'x' }], data: { data: rows, pageInfo: { totalRecords: total, pageSize: 200 } } },",
      "  };",
      "  const shapeName = page > 1 && process.env.FAKE_SHAPE2 ? process.env.FAKE_SHAPE2 : (process.env.FAKE_SHAPE || 'data-pageinfo');",
      "  finish(badPage ? 'this is not JSON {' : JSON.stringify(shapes[shapeName]));",
      "}",
      "else console.log(payload);",
    ].join("\n")
  );
  const EXPECTED_PAYLOAD =
    JSON.stringify({
      data: [{ id: "r-1", name: "héllo ✓ café" }],
      args: ["--json", "re", "r", "list", "--limit", "5"],
    }) + "\n";

  const cap = (args, env) =>
    (({ status, stdout, stderr }) => {
      let json = null;
      try { json = JSON.parse(stdout); } catch { /* failure path */ }
      return { code: status, json, stdout, stderr: stderr.trim() };
    })(runNode(CAPTURE, args, env ? { env: { ...process.env, ...env } } : {}));

  // ── Clean write ────────────────────────────────────────────────────────────
  const out1 = join(TMP, "rules-1.json");
  /** @type {{code: number|null, stderr: string, json?: any, stdout?: string}} */
  let r = cap(["--out", out1, "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list", "--limit", "5"]);
  check("capture: read-only list succeeds and reports a summary",
    r.code === 0 && r.json?.mode === "capture" && r.json?.out && r.json?.bytes > 0, r);
  const bytes1 = readFileSync(out1);
  check("capture: file is byte-exact UTF-8 with NO BOM, non-ASCII intact (the F-044/F-257 class)",
    bytes1.equals(Buffer.from(EXPECTED_PAYLOAD, "utf8")) && bytes1[0] !== 0xef,
    { got: [...bytes1.subarray(0, 8)], text: bytes1.toString("utf8").slice(0, 80) });
  check("capture: captured payload parses as JSON with the accents it was sent",
    JSON.parse(bytes1.toString("utf8")).data[0].name === "héllo ✓ café", bytes1.toString("utf8"));

  // ── BOM-emitting child stripped defensively ────────────────────────────────
  const out2 = join(TMP, "rules-bom.json");
  r = cap(["--out", out2, "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list", "--limit", "5"], { FAKE_MODE: "bom" });
  const bytes2 = readFileSync(out2);
  check("capture: a BOM on the child's stdout never reaches the file",
    r.code === 0 && !(bytes2[0] === 0xef && bytes2[1] === 0xbb && bytes2[2] === 0xbf) &&
      JSON.parse(bytes2.toString("utf8")).data[0].id === "r-1",
    { got: [...bytes2.subarray(0, 6)] });

  // ── Shape admits: actionKey list, deps check, describe ─────────────────────
  r = cap(["--out", join(TMP, "tpl.json"), "--bin", FAKE, "--", "gs-admin", "--json", "jo", "e", "templates", "--limit", "10000"]);
  check("gate: list-shaped by actionKey admitted (jo e templates — verb is not 'list')", r.code === 0, r);
  r = cap(["--out", join(TMP, "deps.json"), "--bin", FAKE, "--", "gs-admin", "--json", "dm", "deps", "check", "--name", "Company"]);
  check("gate: async dm deps check admitted (the deps-report live capture)", r.code === 0, r);
  r = cap(["--out", join(TMP, "depscfg.json"), "--bin", FAKE, "--", "gs-admin", "--json", "dm", "deps", "config"]);
  check("gate: list-shaped by summary prong admitted (dm deps config — domain-candidates parity)", r.code === 0, r);
  r = cap(["--out", join(TMP, "desc.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "describe", "--id", "r-1"]);
  check("gate: describe-shaped read admitted", r.code === 0, r);

  // ── Refusals ───────────────────────────────────────────────────────────────
  r = cap(["--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "delete", "--id", "r-1"]);
  check("gate: mutating command refused", r.code === 1 && /MUTATING/.test(r.stderr), r);
  r = cap(["--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "frobnicate"]);
  check("gate: unknown command refused (fail-closed)", r.code === 1 && /not in the catalog/.test(r.stderr), r);
  r = cap(["--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "run-now", "--id", "r-1"]);
  check("gate: non-capture-shaped read refused (capture wording)",
    r.code === 1 && /not a capture-shaped read/.test(r.stderr) && /read-only captures/.test(r.stderr), r);
  r = cap(["--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list-sneaky"]);
  check("gate: list-shaped command with a PUT endpoint refused (endpoint gate independent)",
    r.code === 1 && /declares a PUT endpoint/.test(r.stderr), r);
  r = cap(["--out", join(TMP, "x.json"), "--bin", FAKE, "--", "node", "evil.mjs"]);
  check("argv: non-gs-admin command refused", r.code === 1 && /single gs-admin invocation/.test(r.stderr), r);
  r = cap(["--out", join(TMP, "x.json"), "--bin", FAKE, "--", "/opt/pinned/gs-admin", "--json", "re", "r", "list"]);
  check("argv: path-prefixed binary refused with --bin pointer", r.code === 1 && /--bin/.test(r.stderr), r);
  r = cap(["--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list", ">", "x.json"]);
  check("argv: shell operator among the tokens refused (the retired redirect, pasted)",
    r.code === 1 && /no pipes, chains, or redirection/.test(r.stderr), r);
  r = cap(["--out", join(TMP, "x.json"), "--bin", FAKE]);
  check("argv: missing `--` command refused with usage", r.code === 1 && /usage:/.test(r.stderr), r);
  r = cap(["--out", join(TMP, "x.json"), "--bin", FAKE, "--timeout-ms", "10", "--", "gs-admin", "--json", "re", "r", "list"]);
  check("argv: sub-second --timeout-ms refused", r.code === 1 && /--timeout-ms/.test(r.stderr), r);

  // ── Ask-override refused outright (synthetic list on a copied tree) ────────
  // The shipped ask-overrides.json is empty since CLI 1.0.8, so the override
  // gate keeps its coverage on a COPY of the script tree carrying a synthetic
  // list — same mechanism as the describe-batch suite. The copied tree has no
  // reference/ dir, which doubles as the no-catalog case below.
  const OV_TREE = join(ROOT, "override-tree");
  writeFiles(OV_TREE, {
    "scripts/capture.mjs": readFileSync(CAPTURE, "utf8"),
    "scripts/doc-lib.mjs": readFileSync(join(SCRIPTS, "doc-lib.mjs"), "utf8"),
    "scripts/journal-lib.mjs": readFileSync(join(SCRIPTS, "journal-lib.mjs"), "utf8"),
    "hooks/ask-overrides.json": JSON.stringify({
      overrides: [
        { path: "rules-engine rules run-now", whileCatalogMutatingIs: false, unlessArgPresent: "--test-run",
          reason: "verified live rule execution", verifiedOnCli: "1.0.6" },
      ],
    }),
  });
  const capOv = (args) =>
    (({ status, stderr }) => ({ code: status, stderr: stderr.trim() }))(
      runNode(join(OV_TREE, "scripts", "capture.mjs"), args));
  r = capOv(["--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "run-now", "--id", "r-1"]);
  check("gate: ask-override command refused outright (synthetic list)",
    r.code === 1 && /ask-override list/.test(r.stderr), r);
  r = capOv(["--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "run-now", "--id", "r-1", "--test-run"]);
  check("gate: ask-override refusal ignores unlessArgPresent (--test-run)",
    r.code === 1 && /ask-override list/.test(r.stderr), r);

  // ── A NON-ARRAY override list reads as no overrides — the hook's rule ──────
  // (F-357; reshaped at F-358.) The per-class table (object / number / boolean
  // pin the guard; string / null / absent are tolerance) lives at the
  // DEFINITION site, test/doc-lib-fixtures.mjs. This is the consumer-level
  // check: one non-array shape through capture's own gate on a READ-ONLY
  // command — a command the catalog marks mutating is refused BEFORE the
  // override loop and can never reach the guarded line (F-358 (a)); the
  // positive control below proves this command DOES reach it in this tree.
  const ovTreeWith = (name, overridesJson) => {
    const dir = join(ROOT, name);
    writeFiles(dir, {
      "scripts/capture.mjs": readFileSync(CAPTURE, "utf8"),
      "scripts/doc-lib.mjs": readFileSync(join(SCRIPTS, "doc-lib.mjs"), "utf8"),
      "scripts/journal-lib.mjs": readFileSync(join(SCRIPTS, "journal-lib.mjs"), "utf8"),
      "hooks/ask-overrides.json": overridesJson,
    });
    return (args) => (({ status, stderr }) => ({ code: status, stderr: stderr.trim().split(name).join("<tree>") }))(
      runNode(join(dir, "scripts", "capture.mjs"), args));
  };
  const readArgs = ["--out", join(TMP, "ov-read.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list", "--limit", "5"];
  const reached = ovTreeWith("override-tree-read-control", JSON.stringify({
    overrides: [{ path: "rules-engine rules list", whileCatalogMutatingIs: false, reason: "synthetic read-path control" }],
  }))(readArgs);
  check("gate: positive control — the read-only command reaches the override loop (a matching row refuses it)",
    reached.code === 1 && /ask-override list/.test(reached.stderr), reached);
  const emptyList = ovTreeWith("override-tree-empty", JSON.stringify({ overrides: [] }))(readArgs);
  const objectList = ovTreeWith("override-tree-object", JSON.stringify({ overrides: {} }))(readArgs);
  check("gate: a non-array (object) override list behaves exactly as the empty list on a read-only command (the hook's rule)",
    objectList.code === emptyList.code && objectList.stderr === emptyList.stderr && !/TypeError|not iterable/.test(objectList.stderr),
    { objectList, emptyList });
  // ── No catalog anywhere → refuse before any spawn ──────────────────────────
  r = capOv(["--out", join(ROOT, "nowhere", "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"]);
  check("gate: no workspace or bundled catalog → refused fail-closed",
    r.code === 1 && /no catalog found/.test(r.stderr), r);

  // ── Failure honesty: child fails → child's code, nothing written ───────────
  const outF = join(TMP, "prior.json");
  writeFileSync(outF, '{"earlier":"capture"}');
  const priorBytes = readFileSync(outF);
  r = cap(["--out", outF, "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"], { FAKE_MODE: "fail" });
  check("failure: child's exit code propagated, stderr names the missing capture",
    r.code === 3 && /nothing was written/.test(r.stderr) && /EARLIER run/.test(r.stderr), r);
  check("failure: an earlier capture at --out is left byte-identical",
    readFileSync(outF).equals(priorBytes), readFileSync(outF).toString("utf8"));
  const outG = join(TMP, "never-existed.json");
  r = cap(["--out", outG, "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"], { FAKE_MODE: "fail" });
  check("failure: no file materializes for a failed first capture", r.code === 3 && !existsSync(outG), r);

  // ── Normalize mode: the PS 5.1 redirect realities ──────────────────────────
  const JSON_TEXT = '{"data":[{"id":"r-1","name":"héllo ✓ café"}]}\r\n'; // CRLF: what a PS redirect writes
  const cleanBytes = Buffer.from(JSON_TEXT, "utf8");

  const f16le = join(TMP, "ps-redirect-16le.json");
  writeFileSync(f16le, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(JSON_TEXT, "utf16le")]));
  r = cap(["--normalize", f16le]);
  check("normalize: UTF-16LE-with-BOM (the PS 5.1 `>` reality) → clean UTF-8, no BOM",
    r.code === 0 && r.json?.encoding === "utf16le-bom" && readFileSync(f16le).equals(cleanBytes), r);
  check("normalize: normalized UTF-16LE capture parses with accents intact",
    JSON.parse(readFileSync(f16le, "utf8")).data[0].name === "héllo ✓ café", readFileSync(f16le, "utf8"));

  const f16be = join(TMP, "ps-redirect-16be.json");
  const beBytes = Buffer.from(JSON_TEXT, "utf16le").swap16();
  writeFileSync(f16be, Buffer.concat([Buffer.from([0xfe, 0xff]), beBytes]));
  r = cap(["--normalize", f16be]);
  check("normalize: UTF-16BE-with-BOM → clean UTF-8",
    r.code === 0 && r.json?.encoding === "utf16be-bom" && readFileSync(f16be).equals(cleanBytes), r);

  const f8bom = join(TMP, "utf8-bom.json");
  writeFileSync(f8bom, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), cleanBytes]));
  r = cap(["--normalize", f8bom]);
  check("normalize: UTF-8-with-BOM → BOM stripped, content byte-identical",
    r.code === 0 && r.json?.encoding === "utf8-bom" && readFileSync(f8bom).equals(cleanBytes), r);

  const fclean = join(TMP, "already-clean.json");
  writeFileSync(fclean, cleanBytes);
  r = cap(["--normalize", fclean]);
  check("normalize: already-clean UTF-8 passes through byte-identical",
    r.code === 0 && r.json?.encoding === "utf8" && r.json?.bytesIn === r.json?.bytesOut &&
      readFileSync(fclean).equals(cleanBytes), r);

  r = cap(["--normalize", join(TMP, "no-such-file.json")]);
  check("normalize: unreadable file fails loudly", r.code === 1 && /cannot read/.test(r.stderr), r);

  // Lossy decodes are refused with the file untouched (the review round's
  // corruption case: toString() maps undecodable bytes to U+FFFD, so a
  // rewrite would silently destroy them).
  const fbad = join(TMP, "codepage-capture.json");
  const badBytes = Buffer.from([0x7b, 0x22, 0x6e, 0x22, 0x3a, 0x22, 0x4f, 0x92, 0x42, 0x22, 0x7d]); // {"n":"O·B"} with cp1252 0x92
  writeFileSync(fbad, badBytes);
  r = cap(["--normalize", fbad]);
  check("normalize: BOM-less non-UTF-8 (console-codepage capture) refused, never rewritten to U+FFFD",
    r.code === 1 && /not valid UTF-8/.test(r.stderr) && /untouched/.test(r.stderr), r);
  check("normalize: the refused file's bytes are untouched", readFileSync(fbad).equals(badBytes), [...readFileSync(fbad)]);

  const fsurr = join(TMP, "lone-surrogate-16le.json");
  // UTF-16LE BOM + '{"a":"' + lone high surrogate U+D800 + '"}'
  const surrText = '{"a":"';
  const surrBytes = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(surrText, "utf16le"),
    Buffer.from([0x00, 0xd8]), // lone high surrogate, LE
    Buffer.from('"}', "utf16le"),
  ]);
  writeFileSync(fsurr, surrBytes);
  r = cap(["--normalize", fsurr]);
  check("normalize: UTF-16LE payload with a lone surrogate refused (lossy transcode), file untouched",
    r.code === 1 && /lone surrogates/.test(r.stderr) && readFileSync(fsurr).equals(surrBytes), r);

  // Release-gate round: an odd payload byte count means the capture was cut
  // mid-code-unit. toString("utf16le") silently DROPS the trailing byte (the
  // LE branch used to rewrite the file SHORTER at exit 0 — the F-297
  // false-green class), and swap16() threw a raw RangeError on the BE branch
  // before refuse() could run.
  const foddLe = join(TMP, "odd-16le.json");
  const oddLeBytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('{"a":1}', "utf16le"), Buffer.from([0x63])]);
  writeFileSync(foddLe, oddLeBytes);
  r = cap(["--normalize", foddLe]);
  check("normalize: odd-byte-length UTF-16LE refused (truncated capture), never rewritten shorter",
    r.code === 1 && /odd byte length/.test(r.stderr) && /untouched/.test(r.stderr), r);
  check("normalize: the refused odd-length LE file's bytes are untouched",
    readFileSync(foddLe).equals(oddLeBytes), [...readFileSync(foddLe)]);
  const foddBe = join(TMP, "odd-16be.json");
  const oddBeBytes = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('{"a":1}', "utf16le").swap16(), Buffer.from([0x63])]);
  writeFileSync(foddBe, oddBeBytes);
  r = cap(["--normalize", foddBe]);
  check("normalize: odd-byte-length UTF-16BE refused with the clean message, not a swap16 RangeError",
    r.code === 1 && /odd byte length/.test(r.stderr) && !/RangeError/.test(r.stderr) &&
      readFileSync(foddBe).equals(oddBeBytes), r);

  // F-297: BOM-less UTF-16 of an ASCII payload is NUL-interleaved yet every
  // byte is < 0x80, so it passes the UTF-8 validity check — before the NUL
  // refusal it was certified "utf8" at exit 0 while still failing JSON.parse.
  const f16nobom = join(TMP, "bomless-16le.json");
  const noBomBytes = Buffer.from('{"result":true,"data":[{"id":"r-1","name":"rule"}]}', "utf16le");
  writeFileSync(f16nobom, noBomBytes);
  r = cap(["--normalize", f16nobom]);
  check("normalize: BOM-less UTF-16 (ASCII payload) refused via NUL check — never a false utf8 green",
    r.code === 1 && /NUL bytes/.test(r.stderr) && /untouched/.test(r.stderr), r);
  check("normalize: the refused BOM-less UTF-16 file's bytes are untouched",
    readFileSync(f16nobom).equals(noBomBytes), [...readFileSync(f16nobom)]);

  // The operator refusal names the likely real cause when the offending token
  // is an unsubstituted doc placeholder (review round: the plain message sent
  // readers hunting for a redirect that was not there).
  r = cap(["--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list", "--search", "<name>"]);
  check("argv: unsubstituted <placeholder> token refused WITH the placeholder hint",
    r.code === 1 && /unsubstituted <placeholder>/.test(r.stderr), r);
  // Release-gate round: a REAL value starting with an operator character (an
  // asset name beginning "|") stays refused — fail-closed, since it is
  // indistinguishable from an operator glued to its operand — but the message
  // must name that case and the guard-arbitrated direct run, not send the
  // operator hunting for a pipe that is not there.
  r = cap(["--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list", "--search", "|Renewal Center"]);
  check("argv: a leading-operator VALUE is refused WITH the real-value hint",
    r.code === 1 && /real argument value/.test(r.stderr) && /run the command directly/.test(r.stderr), r);
  // An internal operator character is a plain value — admitted (names like
  // CS|Risk are documented tenant reality).
  r = cap(["--out", join(TMP, "ok-pipe.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list", "--search", "CS|Risk"]);
  check("argv: an internal '|' in a value passes the operator hygiene",
    r.code === 0, r);

  // ── --wait: bounded poll for the async dependency scan (DS-26) ─────────────
  const CTR = join(ROOT, "poll-counter.txt");
  const resetCtr = () => writeFileSync(CTR, "0");
  const waitEnv = (extra) => ({ FAKE_MODE: "deps-poll", FAKE_COUNTER: CTR, ...extra });
  const DEPS_CMD = ["--", "gs-admin", "--json", "dm", "deps", "check", "--name", "Company"];

  // ready on the first attempt — written, wait stats in the summary
  resetCtr();
  const outW1 = join(TMP, "wait-first.json");
  r = cap(["--wait", "--out", outW1, "--bin", FAKE, ...DEPS_CMD], waitEnv({ FAKE_READY_AT: "1" }));
  check("wait: ready on the first attempt → written, wait stats in summary",
    r.code === 0 && r.json?.wait?.attempts === 1 && existsSync(outW1), r);
  check("wait: the written capture is the COMPLETED payload",
    /"overallStatus":"COMPLETED"/.test(readFileSync(outW1, "utf8")), readFileSync(outW1, "utf8"));

  // differential lock (A-2, review round): the COMPLETED capture --wait just
  // wrote must be COMPLETE to the readers' own parse — the two readiness
  // implementations are driven over the SAME bytes, so a drift in either
  // (status literal, envelope rule, progress path) goes red here.
  {
    const lp = parseLiveDepsAreas(readFileSync(outW1, "utf8"));
    check("differential: the capture --wait wrote parses COMPLETE via parseLiveDepsAreas",
      lp != null && lp.complete === true && lp.objectName === "Company", lp);
  }

  // INIT ×2 then COMPLETED — the poll re-runs the command until ready
  // (--wait-interval 1: the floor; ~2 s of real sleep is the price of the
  // no-unthrottled-live-polling rule)
  resetCtr();
  const outW2 = join(TMP, "wait-third.json");
  r = cap(["--wait", "--wait-interval", "1", "--out", outW2, "--bin", FAKE, ...DEPS_CMD], waitEnv({ FAKE_READY_AT: "3" }));
  check("wait: INIT → INIT → COMPLETED polls to readiness (attempts = 3)",
    r.code === 0 && r.json?.wait?.attempts === 3 && /"overallStatus":"COMPLETED"/.test(readFileSync(outW2, "utf8")), r);
  check("wait: heartbeat lines name each retry (attempt, status, budget)",
    /attempt 1 — overallStatus: INIT; retrying in 1s/.test(r.stderr), r.stderr?.slice(0, 300));

  // flat payload (no data envelope): REJECTED by --wait exactly as the
  // readers reject it (review round — the first version accepted it, writing
  // a capture parseLiveDepsAreas then skipped as unrecognizable: a false
  // green). Both sides of the differential refuse the same bytes.
  resetCtr();
  const outW3 = join(TMP, "wait-flat.json");
  r = cap(["--wait", "--wait-interval", "1", "--wait-timeout", "1", "--out", outW3, "--bin", FAKE, ...DEPS_CMD],
    waitEnv({ FAKE_READY_AT: "1", FAKE_FLAT: "1" }));
  check("wait: a flat (unenveloped) payload is NOT ready — envelope required, like the readers",
    r.code === 1 && !existsSync(outW3) && /no data\.progressStatus\.overallStatus/.test(r.stderr), r);
  {
    const flatBody = JSON.stringify({ objectName: "Company", progressStatus: { overallStatus: "COMPLETED" }, dependents: { RULE: [] } });
    check("differential: the readers reject the same flat payload --wait refused",
      parseLiveDepsAreas(flatBody) === null, parseLiveDepsAreas(flatBody));
  }

  // F-320: COMPLETED but WITHOUT a dependents map — the axis the original
  // differential never sampled, and exactly the payload the old hand-written
  // status probe wrote as success while the readers skipped it downstream.
  // Readiness is now the readers' own imported predicate
  // (jo-report-deps depsCaptureReadiness), so --wait keeps polling and the
  // timeout names the mismatch; nothing is written.
  resetCtr();
  const outWnd = join(TMP, "wait-nodeps.json");
  r = cap(["--wait", "--wait-interval", "1", "--wait-timeout", "1", "--out", outWnd, "--bin", FAKE, ...DEPS_CMD],
    waitEnv({ FAKE_READY_AT: "1", FAKE_NO_DEPS: "1" }));
  check("wait: COMPLETED without a dependents map is NOT ready — the readers' acceptance gates the write",
    r.code === 1 && !existsSync(outWnd) && /COMPLETED, but the payload is not one the deps readers accept/.test(r.stderr), r);
  {
    const noDepsBody = JSON.stringify({ data: { objectName: "Company", progressStatus: { overallStatus: "COMPLETED" } } });
    check("differential: the readers reject the same no-dependents payload --wait refused",
      parseLiveDepsAreas(noDepsBody) === null, parseLiveDepsAreas(noDepsBody));
  }

  // timeout honesty (A-4): never ready → non-zero exit naming elapsed + last
  // status, NOTHING written — an earlier capture at --out survives byte-identical
  resetCtr();
  const outW4 = join(TMP, "wait-timeout.json");
  writeFileSync(outW4, '{"earlier":"capture"}');
  const w4Prior = readFileSync(outW4);
  r = cap(["--wait", "--wait-interval", "1", "--wait-timeout", "1", "--out", outW4, "--bin", FAKE, ...DEPS_CMD],
    waitEnv({ FAKE_READY_AT: "999" }));
  check("wait: timeout → non-zero exit naming 'not ready after' + the last overallStatus",
    r.code === 1 && /not ready after \d+s/.test(r.stderr) && /INIT/.test(r.stderr) && /nothing was written/.test(r.stderr), r);
  check("wait: timeout writes NOTHING — the earlier capture at --out is byte-identical",
    readFileSync(outW4).equals(w4Prior), readFileSync(outW4).toString("utf8"));
  resetCtr();
  const outW5 = join(TMP, "wait-timeout-fresh.json");
  r = cap(["--wait", "--wait-interval", "1", "--wait-timeout", "1", "--out", outW5, "--bin", FAKE, ...DEPS_CMD],
    waitEnv({ FAKE_READY_AT: "999" }));
  check("wait: timeout on a fresh path materializes no file", r.code === 1 && !existsSync(outW5), r);

  // a payload with no progress contract (plain list; data is an ARRAY, so the
  // object-shaped unwrap must not fire) keeps polling and is NAMED at timeout
  const outW6 = join(TMP, "wait-nostatus.json");
  r = cap(["--wait", "--wait-interval", "1", "--wait-timeout", "1", "--out", outW6, "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list"]);
  check("wait: payload without progressStatus → honest timeout naming the absence",
    r.code === 1 && /no data\.progressStatus\.overallStatus/.test(r.stderr) && !existsSync(outW6), r);

  // a FAILED poll attempt is a failed command, not "not ready" — the
  // single-shot failure contract (child's exit code, nothing written) holds
  r = cap(["--wait", "--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"],
    { FAKE_MODE: "fail" });
  check("wait: a failed poll attempt exits with the child's code, not 'not ready'",
    r.code === 3 && /nothing was written/.test(r.stderr) && !/not ready/.test(r.stderr), r);

  // flag validation
  r = cap(["--wait-timeout", "30", "--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"]);
  check("argv: --wait-timeout without --wait refused", r.code === 1 && /only apply with --wait/.test(r.stderr), r);
  r = cap(["--wait", "--wait-timeout", "0", "--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"]);
  check("argv: --wait-timeout 0 refused", r.code === 1 && /--wait-timeout must be/.test(r.stderr), r);
  r = cap(["--wait", "--wait-interval", "-1", "--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"]);
  check("argv: negative --wait-interval refused", r.code === 1 && /--wait-interval must be/.test(r.stderr), r);
  // interval floor (review round): 0 = unthrottled live polling, unspellable
  r = cap(["--wait", "--wait-interval", "0", "--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"]);
  check("argv: --wait-interval 0 refused (floor is 1 s — no unthrottled live polling)", r.code === 1 && /--wait-interval must be ≥ 1/.test(r.stderr), r);
  r = cap(["--normalize", join(TMP, "whatever.json"), "--wait"]);
  check("argv: --normalize with --wait refused", r.code === 1 && /--normalize takes no other mode/.test(r.stderr), r);
  // the guard covers every capture-mode knob, not just --wait (review round)
  r = cap(["--normalize", join(TMP, "whatever.json"), "--wait-timeout", "300"]);
  check("argv: --normalize with a stray --wait-timeout refused", r.code === 1 && /--normalize takes no other mode/.test(r.stderr), r);
  r = cap(["--normalize", join(TMP, "whatever.json"), "--bin", FAKE]);
  check("argv: --normalize with a stray --bin refused", r.code === 1 && /--normalize takes no other mode/.test(r.stderr), r);

  // ── Paginate mode (DS-30): the page loop owns the pagination doctrine ──────
  // One case per measured envelope variant (the live tester answers table:
  // pageInfo under data / at top level / absent; pageSize vs limit; rows at
  // data.liteObjects[]; top-level _total; bare data[] with no total), plus
  // the stop rules, cap rule, suspect/mismatch/conflict/failed-page honesty,
  // and the argv refusals. The fake CLI serves deterministic pages.
  const pag = (name, extra, env) =>
    cap(
      ["--paginate", "--page-flag", "page", "--out", join(TMP, `${name}-{page}.json`),
        ...extra, "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list", "--limit", "200"],
      { FAKE_MODE: "paged", ...env }
    );

  // V1 · data.pageInfo envelope (re r list), 200/200/74 of 474 → reconciled
  r = pag("v1", [], { FAKE_SHAPE: "data-pageinfo", FAKE_PAGES: "200,200,74", FAKE_TOTAL: "474" });
  check("paginate: data.pageInfo envelope reconciles across 3 pages, exit 0",
    r.code === 0 && r.json?.verdict === "reconciled" && r.json?.pagesFetched === 3 &&
      r.json?.rowsCounted === 474 && r.json?.payloadTotal === 474, r);
  check("paginate: one file per page, {page} substituted",
    existsSync(join(TMP, "v1-1.json")) && existsSync(join(TMP, "v1-2.json")) && existsSync(join(TMP, "v1-3.json")), r);
  check("paginate: per-page rows report the entry array's path",
    r.json?.perPage?.[0]?.rows === 200 && r.json?.perPage?.[0]?.rowsPath === "data.data", r);
  check("paginate: reconciled verdict discloses the paging-vs-inventory limit",
    (r.json?.flags ?? []).some((f) => /PAGING completeness/.test(f)), r);
  // Differential (A-2): er-count and the paginate scan consume ONE traversal —
  // the shipped counter over a written page file agrees with the summary.
  {
    const ec = runNode(join(SCRIPTS, "er-count.mjs"), [join(TMP, "v1-3.json")]);
    check("paginate ↔ er-count differential: same entry count for the same page file",
      ec.status === 0 && ec.stdout.trim() === "74", { ec: ec.stdout, stderr: ec.stderr });
  }

  // V2 · pageSize spelling (rp list) → reconciled
  r = pag("v2", [], { FAKE_SHAPE: "pageinfo-pagesize", FAKE_PAGES: "200,200", FAKE_TOTAL: "400" });
  check("paginate: pageSize-spelled pageInfo reconciles",
    r.code === 0 && r.json?.verdict === "reconciled" && r.json?.rowsCounted === 400, r);

  // V3 · top-level pageInfo (jo e templates), single fetch — reconciled…
  r = cap(["--paginate", "--page-flag", "none", "--out", join(TMP, "v3.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "jo", "e", "templates", "--limit", "10000"],
    { FAKE_MODE: "paged", FAKE_SHAPE: "top-pageinfo", FAKE_PAGES: "648", FAKE_TOTAL: "648" });
  check("paginate: --page-flag none single fetch reconciles against top-level pageInfo",
    r.code === 0 && r.json?.verdict === "reconciled" && r.json?.pagesFetched === 1 &&
      r.json?.totalPaths?.includes("pageInfo.totalAfterFilters"), r);
  // …and the client-side-cap reality (50 of 648) is a loud MISMATCH
  r = cap(["--paginate", "--page-flag", "none", "--out", join(TMP, "v3b.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "jo", "e", "templates", "--limit", "10000"],
    { FAKE_MODE: "paged", FAKE_SHAPE: "top-pageinfo", FAKE_PAGES: "50", FAKE_TOTAL: "648" });
  check("paginate: rows short of the payload total → mismatch, exit 1, refetch guidance",
    r.code === 1 && r.json?.verdict === "mismatch" && r.json?.pagesFetched === 1 &&
      (r.json?.flags ?? []).some((f) => /captured 50 of 648/.test(f)), r);

  // V4 · totals as direct children of data, no pageInfo (jo p list)
  r = pag("v4", [], { FAKE_SHAPE: "data-totals", FAKE_PAGES: "200,200,74", FAKE_TOTAL: "474" });
  check("paginate: pageInfo-less totals under data reconcile (jo p list envelope)",
    r.code === 0 && r.json?.verdict === "reconciled" && r.json?.totalPaths?.includes("data.totalRecords"), r);

  // V5 · bare data[] no total: a count on a server default is SUSPECT…
  r = cap(["--paginate", "--page-flag", "none", "--out", join(TMP, "v5.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list"],
    { FAKE_MODE: "paged", FAKE_SHAPE: "bare", FAKE_PAGES: "20" });
  check("paginate: no total + count on a common server default → SUSPECT, exit 1, separate-file guidance",
    r.code === 1 && r.json?.verdict === "suspect" && /SEPARATE file/.test((r.json?.flags ?? []).join(" ")), r);
  // …a count equal to the requested limit is suspect too (not in the default set)…
  r = cap(["--paginate", "--page-flag", "none", "--out", join(TMP, "v5b.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list", "--limit", "30"],
    { FAKE_MODE: "paged", FAKE_PAGES: "30", FAKE_SHAPE: "bare" });
  check("paginate: no total + count equal to the requested limit → suspect",
    r.code === 1 && r.json?.verdict === "suspect" && /requested limit/.test((r.json?.flags ?? []).join(" ")), r);
  // …and an off-default count stays an honest UNVERIFIED at exit 0
  r = cap(["--paginate", "--page-flag", "none", "--out", join(TMP, "v5c.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list", "--limit", "10000"],
    { FAKE_MODE: "paged", FAKE_PAGES: "74", FAKE_SHAPE: "bare" });
  check("paginate: no total, off-default count → unverified exit 0, completeness disclaimed",
    r.code === 0 && r.json?.verdict === "unverified" && /CLI-reachable set/.test((r.json?.flags ?? []).join(" ")), r);

  // V6 · sc-family top-level _total (CLI 1.0.8+) reconciles
  r = cap(["--paginate", "--page-flag", "none", "--out", join(TMP, "v6.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list", "--limit", "10000"],
    { FAKE_MODE: "paged", FAKE_SHAPE: "sc-total", FAKE_PAGES: "74", FAKE_TOTAL: "74" });
  check("paginate: top-level _total reconciles (sc family)",
    r.code === 0 && r.json?.verdict === "reconciled" && r.json?.totalPaths?.includes("_total"), r);

  // V7 · rows at data.liteObjects[] whose rows carry 50-element nested arrays:
  // the traversal measures, never descends (er-count's contract)
  r = cap(["--paginate", "--page-flag", "none", "--out", join(TMP, "v7.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list"],
    { FAKE_MODE: "paged", FAKE_SHAPE: "liteobjects", FAKE_PAGES: "3", FAKE_TOTAL: "3" });
  check("paginate: liteObjects rows counted; nested per-row arrays never outvote the entry array",
    r.code === 0 && r.json?.verdict === "reconciled" && r.json?.rowsCounted === 3 &&
      r.json?.perPage?.[0]?.rowsPath === "data.liteObjects", r);

  // V8 · the cap rule: requested 500, server serves 200/page, total 474 —
  // a short page with the running count short of the total ADJUSTS, exactly once flagged
  r = cap(["--paginate", "--page-flag", "page", "--out", join(TMP, "v8-{page}.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list", "--limit", "500"],
    { FAKE_MODE: "paged", FAKE_SHAPE: "data-pageinfo", FAKE_PAGES: "200,200,74", FAKE_TOTAL: "474" });
  check("paginate: server page cap below the requested limit keeps paging at the returned size",
    r.code === 0 && r.json?.verdict === "reconciled" && r.json?.pagesFetched === 3 && r.json?.rowsCounted === 474, r);
  check("paginate: the cap is flagged exactly once (the adjustment sticks)",
    (r.json?.flags ?? []).filter((f) => /capped the page size/.test(f)).length === 1, r);

  // V9 · no total, paged, no --limit spelled: the first page defines the
  // expected size; a shorter page stops the loop (nothing to reconcile)
  r = cap(["--paginate", "--page-flag", "page", "--out", join(TMP, "v9-{page}.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list"],
    { FAKE_MODE: "paged", FAKE_SHAPE: "bare", FAKE_PAGES: "5,3,9" });
  check("paginate: short page stops a no-total loop — the 3rd page is never fetched",
    r.json?.pagesFetched === 2 && r.json?.rowsCounted === 8 && r.json?.verdict === "unverified" && r.code === 0, r);
  // V9a · with a spelled --limit and no total, a first page below it is
  // already the doctrinal last page (fewer items than the page size)
  r = pag("v9a", [], { FAKE_SHAPE: "bare", FAKE_PAGES: "5,3,9" });
  check("paginate: no total, first page below the requested limit stops at one fetch",
    r.json?.pagesFetched === 1 && r.json?.rowsCounted === 5 && r.json?.verdict === "unverified" && r.code === 0, r);

  // V9b · empty first page: one fetch, honest zero
  r = pag("v9b", [], { FAKE_SHAPE: "bare", FAKE_PAGES: "0" });
  check("paginate: an empty first page stops at one fetch (no spin to the safety stop)",
    r.json?.pagesFetched === 1 && r.json?.rowsCounted === 0 && r.code === 0, r);
  // V9c · empty first page on a LIMIT-LESS command: the zero-row stop is the
  // only rule that can fire (no requested size → the short-page rule would
  // compare 0 < 0 and never stop) — the sweep's MP12 survivor, now pinned
  r = cap(["--paginate", "--page-flag", "page", "--out", join(TMP, "v9c-{page}.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list"],
    { FAKE_MODE: "paged", FAKE_SHAPE: "bare", FAKE_PAGES: "0" });
  check("paginate: empty first page with no spelled limit still stops at one fetch (zero-row stop)",
    r.json?.pagesFetched === 1 && r.json?.rowsCounted === 0 && r.json?.verdict === "unverified" && r.code === 0, r);

  // V6b · a STRING-typed total is never reconciled, but the evidence is
  // reported: pageSignals carries it and the unverified flag says so
  r = cap(["--paginate", "--page-flag", "none", "--out", join(TMP, "v6b.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list"],
    { FAKE_MODE: "paged", FAKE_SHAPE: "string-total", FAKE_PAGES: "7", FAKE_TOTAL: "1072" });
  check("paginate: a string-typed total is not reconciled but surfaces in pageSignals",
    r.code === 0 && r.json?.verdict === "unverified" &&
      r.json?.pageSignals?.some((p) => p.path === "data.totalRecords" && p.value === "1072") &&
      /page signals WERE seen/.test((r.json?.flags ?? []).join(" ")), r);

  // V7b · the entry array must stay at ONE path across pages — a page whose
  // largest array moved is counting something else, and the summary says so
  r = pag("v7b", [], { FAKE_SHAPE: "data-totals", FAKE_SHAPE2: "bare", FAKE_PAGES: "200,200,74", FAKE_TOTAL: "474" });
  check("paginate: an entry-array path change across pages is flagged loudly",
    (r.json?.flags ?? []).some((f) => /entry array is at/.test(f)), r);

  // V10 · safety stop: pages never go short within --max-pages
  r = pag("v10", ["--max-pages", "3"], { FAKE_SHAPE: "bare", FAKE_PAGES: "200,200,200,200,200" });
  check("paginate: --max-pages safety stop, exit 1, never a confident total",
    r.code === 1 && r.json?.verdict === "safety-stop" && r.json?.pagesFetched === 3 &&
      /safety stop/.test(r.json?.stopped ?? "") && /safety stop/.test(r.stderr), r);

  // V11 · payload totals that disagree → conflict, never a silent pick
  r = cap(["--paginate", "--page-flag", "none", "--out", join(TMP, "v11.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list"],
    { FAKE_MODE: "paged", FAKE_SHAPE: "conflict", FAKE_PAGES: "10", FAKE_TOTAL: "10" });
  check("paginate: disagreeing payload totals → total-conflict, exit 1, both named with paths",
    r.code === 1 && r.json?.verdict === "total-conflict" &&
      /_total/.test(r.json?.stopped ?? "") && /pageInfo\.totalRecords/.test(r.json?.stopped ?? ""), r);

  // V12 · a page that will not parse is a FAILED sweep page, never 0 entries;
  // the file is kept as evidence and pagesParsed says how far honesty reaches
  r = pag("v12", [], { FAKE_SHAPE: "data-pageinfo", FAKE_PAGES: "200,200,74", FAKE_TOTAL: "474", FAKE_BAD_PAGE: "2" });
  check("paginate: unparseable page → failed-page verdict, exit 1, evidence file kept",
    r.code === 1 && r.json?.verdict === "failed-page" && /FAILED sweep page/.test(r.json?.stopped ?? "") &&
      /FAILED sweep page/.test(r.stderr) && existsSync(join(TMP, "v12-2.json")), r);
  check("paginate: honesty stats separate pages fetched from pages parsed",
    r.json?.pagesFetched === 2 && r.json?.pagesParsed === 1, r);

  // V13 · gate-3 F-351: the rows array is DECIDED, never guessed. With 200
  // rows and a 400-entry sibling `columns` array under data and a payload
  // total of 400, the old anywhere-rule counted the columns, hit the total on
  // page 1 and certified ONE page of 200 rows as reconciled. Two non-empty
  // spine arrays of different lengths are ambiguous: refused, candidates
  // named, --items-path suggested.
  r = pag("v13", [], { FAKE_SHAPE: "sibling-array", FAKE_PAGES: "200,200", FAKE_TOTAL: "400" });
  check("paginate F-351: two candidate row arrays of different lengths are refused as unrecognized-shape, never picked",
    r.code === 1 && r.json?.verdict === "unrecognized-shape" && r.json?.pagesFetched === 1 && r.json?.rowsCounted === 0 &&
      /data\.columns/.test(r.json?.stopped ?? "") && /data\.data/.test(r.json?.stopped ?? "") && /--items-path/.test(r.json?.stopped ?? ""), r);
  // Differential (A-2, F-354/F-355): er-count over the SAME page file refuses
  // the same shape with the same reason — one decision, two consumers.
  {
    const ec = runNode(join(SCRIPTS, "er-count.mjs"), [join(TMP, "v13-1.json")]);
    check("paginate ↔ er-count differential F-355: the refused ambiguous page is refused by er-count too, same candidates",
      ec.status === 1 && ec.stdout.trim() === "" && /"data\.columns" \(400\), "data\.data" \(200\)/.test(ec.stderr) && /"data\.columns" \(400\), "data\.data" \(200\)/.test(r.json?.stopped ?? ""), { ec: ec.stderr, stopped: r.json?.stopped });
    const ecNamed = runNode(join(SCRIPTS, "er-count.mjs"), [join(TMP, "v13-1.json"), "--items-path", "data.data"]);
    check("paginate ↔ er-count differential F-355: --items-path decides it for er-count as for capture", ecNamed.status === 0 && ecNamed.stdout.trim() === "200", ecNamed);
  }
  // V13c · --items-path names the rows array: the sibling never inflates the
  // count, the second page is fetched, 400 real rows reconcile.
  r = pag("v13c", ["--items-path", "data.data"], { FAKE_SHAPE: "sibling-array", FAKE_PAGES: "200,200", FAKE_TOTAL: "400" });
  check("paginate F-351: --items-path names the rows array — two real pages reconcile, the sibling is ignored",
    r.code === 0 && r.json?.verdict === "reconciled" && r.json?.pagesFetched === 2 && r.json?.rowsCounted === 400 &&
      r.json?.perPage?.[0]?.rows === 200 && r.json?.perPage?.[0]?.rowsPath === "data.data", r);
  // V13d · an --items-path that names no array is refused, never counted as 0
  r = pag("v13d", ["--items-path", "data.nope"], { FAKE_SHAPE: "sibling-array", FAKE_PAGES: "200,200", FAKE_TOTAL: "400" });
  check("paginate F-351: an --items-path naming no array on the page is refused (unrecognized-shape)",
    r.code === 1 && r.json?.verdict === "unrecognized-shape" && /--items-path data\.nope names no array/.test(r.json?.stopped ?? ""), r);
  // V13f · F-351 round 4: the audit skill's rp list sweep on a tenant with an
  // alert. Two distinct lengths on the spine: unstated it is refused on page 1
  // (never a wrong count); the shipped fence STATES --items-path data.data and
  // reconciles across pages.
  r = pag("v13f", [], { FAKE_SHAPE: "rp-alerts", FAKE_PAGES: "200,74", FAKE_TOTAL: "274" });
  check("paginate F-351 round 4: rp list with a filled alerts block, unstated — unrecognized-shape on page 1, nothing counted",
    r.code === 1 && r.json?.verdict === "unrecognized-shape" && r.json?.rowsCounted === 0 && /"data\.data" \(200\), "alerts" \(1\)/.test(r.json?.stopped ?? ""), r);
  r = pag("v13f2", ["--items-path", "data.data"], { FAKE_SHAPE: "rp-alerts", FAKE_PAGES: "200,74", FAKE_TOTAL: "274" });
  check("paginate F-351 round 4: the reports fence's stated path reconciles the alert-bearing sweep (rows at data.data)",
    r.code === 0 && r.json?.verdict === "reconciled" && r.json?.rowsCounted === 274 && r.json?.perPage?.[0]?.rowsPath === "data.data", r);
  // V13b · rows nowhere on the spine: refused loudly, nothing counted
  r = pag("v13b", [], { FAKE_SHAPE: "off-spine", FAKE_PAGES: "5" });
  check("paginate F-351: a page whose arrays are all off the spine is verdict unrecognized-shape, exit 1, paths named",
    r.code === 1 && r.json?.verdict === "unrecognized-shape" && r.json?.rowsCounted === 0 &&
      /data\.deep\.items/.test(r.json?.stopped ?? "") && /nothing was counted/.test(r.json?.stopped ?? ""), r);
  {
    const ec = runNode(join(SCRIPTS, "er-count.mjs"), [join(TMP, "v13b-1.json")]);
    check("paginate ↔ er-count differential F-354: the refused off-spine page is refused by er-count too (no silent 0)",
      ec.status === 1 && ec.stdout.trim() === "" && /data\.deep\.items/.test(ec.stderr), ec);
  }
  // V14 · gate-3 F-347: a no-total sweep whose row count is an exact multiple
  // of the page size ends on an EMPTY page — the ordinary stop. The
  // entry-array drift check used to run before the empty-page stop and flag
  // that page (entryPath null) as "counts may not be comparable".
  r = pag("v14", [], { FAKE_SHAPE: "bare", FAKE_PAGES: "200,200" });
  check("paginate F-347: the normal empty last page raises no entry-array drift flag",
    r.code === 0 && r.json?.verdict === "unverified" && r.json?.pagesFetched === 3 && r.json?.rowsCounted === 400 &&
      !(r.json?.flags ?? []).some((x) => /not be comparable/.test(x)), r);
  // V14b · the drift check still fires for a NON-empty page whose entry array
  // moved (page 2 arrives in the data.pageInfo shape — rows at data.data)
  r = pag("v14b", [], { FAKE_SHAPE: "bare", FAKE_SHAPE2: "data-pageinfo", FAKE_PAGES: "200,3" });
  check("paginate F-347: a non-empty page whose entry array moved still flags the drift",
    (r.json?.flags ?? []).some((x) => /not be comparable/.test(x)) && r.json?.perPage?.[1]?.rowsPath === "data.data", r);
  r = cap(["--items-path", "data.data", "--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"]);
  check("argv: --items-path without --paginate refused", r.code === 1 && /only apply with --paginate/.test(r.stderr), r);
  r = pag("v13e", ["--items-path", "data[0]"], { FAKE_SHAPE: "bare", FAKE_PAGES: "1" });
  check("argv: --items-path must be a dotted key path", r.code === 1 && /dotted key path/.test(r.stderr), r);

  // Argv refusals — one per validation arm
  r = cap(["--paginate", "--out", join(TMP, "x-{page}.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"]);
  check("argv: --paginate without --page-flag refused (never guessed)", r.code === 1 && /requires --page-flag/.test(r.stderr), r);
  r = cap(["--paginate", "--page-flag", "page", "--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"]);
  check("argv: paging without a {page} placeholder in --out refused", r.code === 1 && /\{page\} placeholder/.test(r.stderr), r);
  r = cap(["--paginate", "--page-flag", "page", "--out", join(TMP, "x-{page}.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list", "--page", "3"]);
  check("argv: a command already carrying the page flag refused (the loop owns the page number)",
    r.code === 1 && /already carries --page/.test(r.stderr), r);
  r = cap(["--paginate", "--wait", "--page-flag", "page", "--out", join(TMP, "x-{page}.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list"]);
  check("argv: --paginate with --wait refused (different jobs)", r.code === 1 && /different jobs/.test(r.stderr), r);
  r = cap(["--page-flag", "page", "--out", join(TMP, "x.json"), "--bin", FAKE, "--", "gs-admin", "--json", "re", "r", "list"]);
  check("argv: --page-flag without --paginate refused", r.code === 1 && /only apply with --paginate/.test(r.stderr), r);
  r = cap(["--paginate", "--page-flag", "page", "--max-pages", "0", "--out", join(TMP, "x-{page}.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list"]);
  check("argv: --max-pages 0 refused", r.code === 1 && /--max-pages must be/.test(r.stderr), r);
  // equals-form flag spellings (review round): the guard and the size probe
  // compare on the token's name half, so `--page=2` / `--limit=30` behave
  // exactly like the spaced spellings
  r = cap(["--paginate", "--page-flag", "page", "--out", join(TMP, "x-{page}.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list", "--page=2"]);
  check("argv: a command carrying the page flag in --flag=value form is refused too",
    r.code === 1 && /already carries --page/.test(r.stderr), r);
  r = cap(["--paginate", "--page-flag", "none", "--out", join(TMP, "veq.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "list", "--limit=30"],
    { FAKE_MODE: "paged", FAKE_PAGES: "30", FAKE_SHAPE: "bare" });
  check("paginate: --limit=30 (equals form) still feeds the requested-limit suspect rule",
    r.code === 1 && r.json?.verdict === "suspect" && /requested limit/.test((r.json?.flags ?? []).join(" ")), r);
  r = cap(["--normalize", join(TMP, "whatever.json"), "--paginate"]);
  check("argv: --normalize with --paginate refused", r.code === 1 && /--normalize takes no other mode/.test(r.stderr), r);
  r = cap(["--normalize", join(TMP, "whatever.json"), "--max-pages", "9"]);
  check("argv: --normalize with a stray --max-pages refused", r.code === 1 && /--normalize takes no other mode/.test(r.stderr), r);
  // The read-only gate arbitrates paginate exactly as plain captures (fail-closed)
  r = cap(["--paginate", "--page-flag", "page", "--out", join(TMP, "x-{page}.json"), "--bin", FAKE,
    "--", "gs-admin", "--json", "re", "r", "delete"]);
  check("paginate: catalog-mutating command refused by the shared read-only gate", r.code === 1 && /mutating/i.test(r.stderr), r);
} finally {
  removeTempDir(ROOT);
}

console.log("");
if (failures > 0) {
  console.log(`${failures} capture check(s) FAILED`);
  process.exit(1);
}
console.log("All capture checks passed");
