#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// describe-batch.mjs (test) — fixtures for scripts/describe-batch.mjs
//
// Covers: the fail-closed command gate (mutating / unknown / non-gs-admin /
// path-prefixed binary / missing placeholder / shell operators / bad
// --doc-mode), the happy describe→doc→mark path (docs written with doc_path
// recorded, entries marked documented at depth full, failures marked with an
// error and the batch continuing), resumability (re-run selects only what's
// left), the --upgrade stub→full overwrite plus failed-stub retry (with the
// depth-aware { full, metadata, failed, total } domainProgress and full/total
// progress line), recorded describe recipes (--command defaulting to the
// index-time recording, explicit --command winning, missing recordings still
// requiring --command, recorded mutating/unknown commands refused by the same
// gate), {name} substitution carrying pipe-bearing names as literal argv (no
// shell), the template doc-mode (auto-selected for journey-email-templates,
// compact docs identical to standalone template-doc.mjs, raw override
// honored), the program doc-mode (auto-selected for journey, geometry dropped
// / PowerList + template refs kept, parity with standalone program-doc.mjs),
// content fingerprints (recorded on every documented mark; the --if-changed
// gate skipping doc writes on timestamp-only or key-order-only changes while
// real content changes rewrite, legacy entries document normally, the skip
// path never promotes a metadata-depth entry, and a deleted doc regenerates
// despite an unchanged fingerprint),
// the doc-filename collision rule across passes and WRITERS (F-156/F-188: a
// later pass that sees only one member of a case-colliding pair must not
// overwrite the other member's doc, and the deep pass must land on the stub
// filenames rather than mint its own),
// and the docs-agreement lock on the {id}-vs-{name} disambiguation sentences.
// The CLI is faked with a local node script via --bin; fixtures live under
// the OS temp dir — no real state.
//
// Run:  node plugins/gs-superadmin/test/describe-batch.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts");
const BATCH = join(SCRIPTS, "describe-batch.mjs");
const MANIFEST = join(SCRIPTS, "manifest.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-describe-batch-${process.pid}`);
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)}`);
  }
}

function manifest(verb, args) {
  const res = spawnSync(process.execPath, [MANIFEST, verb, "--manifest", M, ...args], { encoding: "utf8" });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch { /* failure path */ }
  return { code: res.status, json, stderr: res.stderr.trim() };
}

function batch(args, env) {
  const res = spawnSync(process.execPath, [BATCH, "--manifest", M, ...args], {
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
  });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch { /* failure path */ }
  return { code: res.status, json, stderr: res.stderr.trim() };
}

// ── Fixtures: workspace catalog, manifest, fake CLI ──────────────────────────
mkdirSync(join(ROOT, ".gs-superadmin"), { recursive: true });
writeFileSync(
  join(ROOT, ".gs-superadmin", "catalog.json"),
  JSON.stringify({
    globalFlags: [{ flag: "--json" }, { flag: "--base-url <url>" }],
    domains: [
      { namespace: "rules-engine", aliases: ["re"] },
      { namespace: "scorecard", aliases: ["sc"] },
      { namespace: "journey", aliases: ["jo"] },
    ],
    commands: [
      { path: "rules-engine rules describe", shortPath: "re r describe", mutating: false },
      { path: "rules-engine chains describe", shortPath: "re chains describe", mutating: false },
      { path: "scorecard measures", shortPath: "sc measures", mutating: false },
      { path: "journey email template", shortPath: "jo e template", mutating: false },
      { path: "journey programs describe", shortPath: "jo p describe", mutating: false },
      // F-429: the LIST command a journey domain is recorded from — the
      // doc-mode resolves through it, whatever the domain is named.
      { path: "journey programs list", shortPath: "jo p list", mutating: false },
      { path: "rules-engine rules delete", shortPath: "re r delete", mutating: true },
      // Catalog-non-mutating commands that nonetheless write — the F-020 class.
      { path: "rules-engine rules run-now", shortPath: "re r run-now", mutating: false },
      { path: "rules-engine rules edit", shortPath: "re r edit", mutating: false,
        endpoints: [{ method: "PUT", path: "/v1/rulesengine/ruledetails" }] },
      // Describe-shaped verb, write endpoint: proves the endpoint gate is independent
      // of the verb gate rather than a restatement of it.
      { path: "rules-engine rules describe-sneaky", shortPath: "re r describe-sneaky", mutating: false,
        endpoints: [{ method: "PUT", path: "/v1/rulesengine/sneaky" }] },
      // `get`-verb pure-GET read (release review 2026-07-25, F-046): the
      // per-item describe for two setup-indexed domains — must pass the gate.
      { path: "journey data-designer get", shortPath: "jo dd get", mutating: false,
        endpoints: [{ method: "GET", path: "/v1/dd/get" }] },
      // CP-4 (CLI 1.0.6 adoption rider): scheduling/Events-Framework reads
      // admitted by READ_VERB_EXACT, and a schedule-subscribe POST that must
      // stay refused (it is on the real ask-overrides list).
      { path: "rules-engine rules schedules", shortPath: "re r schedules", mutating: false,
        endpoints: [{ method: "GET", path: "/v1/api/scheduler/schedule/RULES/{{ruleId}}" }] },
      { path: "rules-engine rules s3-tasks", shortPath: "re r s3-tasks", mutating: false,
        endpoints: [{ method: "GET", path: "/v1/api/describe/s3/tasks" }] },
      { path: "rules-engine rules event-curl", shortPath: "re r event-curl", mutating: false,
        endpoints: [{ method: "GET", path: "/v1/api/events/curl" }] },
      { path: "rules-engine rules schedule-basic", shortPath: "re r schedule-basic", mutating: false,
        endpoints: [{ method: "POST", path: "/v1/api/scheduler/schedule" }] },
      // W9 (GP-B5 B13): the designer doc-mode's command — its flags are what
      // the mode verifies before appending `--task-id` / `--field` (catalog
      // shape at pin 1.0.8: flag spellings bare, no value placeholder).
      { path: "data-designer templates describe", shortPath: "dd t describe", mutating: false,
        flags: [{ flag: "--template-id" }, { flag: "--template-name" }, { flag: "--task-id" }, { flag: "--pivot-column" }, { flag: "--field" }],
        endpoints: [{ method: "GET", path: "/v1/bionicreporting/designTemplates/{{templateId}}" }, { method: "GET", path: "/v1/bionicreporting/designTemplates/{{templateId}}/tasks" }] },
    ],
  })
);

const FAKE = join(ROOT, "fake-gs-admin.mjs");
writeFileSync(
  FAKE,
  [
    // finish(): write, then exit in the write callback (F-356 — a pipe write past
    // the first chunk is lost on a synchronous process.exit; macOS shows it).
    "const finish = (s) => { process.stdout.write(s + '\\n', () => process.exit(0)); };",
    "const a = process.argv;",
    "const at = (f) => { const i = a.indexOf(f); return i > -1 ? a[i + 1] : undefined; };",
    "const id = at('--id') ?? at('--name');",
    "if (id === 'r-fail') { console.error('boom: simulated describe failure'); process.exit(1); }",
    // W9 designer branch — the three levels of `dd t describe` at pin 1.0.8,
    // fixtures under $FAKE_DD (a JSON file: { templates: { <id>: { tasks:[summary
    // rows], details: { <taskId>: tables }, fields: { <taskId>: { <label>: rows } } } } }).
    // Every call is logged to $FAKE_DD_LOG (one argv line per spawn) so the
    // suite can assert the exact tokens the mode appended.
    "if (a.includes('dd') && a.includes('describe')) {",
    "  const fs = await import('node:fs');",
    "  if (process.env.FAKE_DD_LOG) fs.appendFileSync(process.env.FAKE_DD_LOG, JSON.stringify(a.slice(2)) + '\\n');",
    "  const fx = JSON.parse(fs.readFileSync(process.env.FAKE_DD, 'utf8'));",
    "  const tid = at('--template-id'); const task = at('--task-id'); const field = at('--field');",
    "  const t = fx.templates[tid];",
    "  if (!t) { console.error('No template found'); process.exit(1); }",
    "  if (t.scalar !== undefined && !task) finish(JSON.stringify(t.scalar));",
    "  const empty = () => Object.fromEntries(['_taskDetailRows','_taskShowFields','_taskFieldDetail','_taskFieldFormula','_taskFieldCase','_taskJoinConditions','_taskUnionMerged','_taskUnionOther','_taskS3Export','_taskS3FieldOrder','_taskCriteriaExpressionRows','_taskCriteriaConditions','_taskPivotColumns','_taskPivotConditions'].map((k) => [k, []]));",
    "  const header = { templateId: tid, name: t.name, description: '', folderId: '', modifiedByName: '', modifiedDateStr: new Date().toISOString(), _taskCount: t.taskCount ?? t.tasks.length };",
    "  if (!task) finish(JSON.stringify({ result: true, data: { ...header, _tasks: t.tasks, ...empty() } }));",
    "  else if (task === 't-fail' || (t.failTasks || []).includes(task)) { console.error('boom: simulated drilldown failure'); process.exit(1); }",
    "  else if (!field) finish(JSON.stringify({ result: true, data: { ...header, _tasks: [], ...empty(), ...(t.details[task] || {}) } }));",
    "  else { const rows = (t.fields[task] || {})[field]; if (!rows) { console.error('No field found on task \"' + task + '\" matching: \"' + field + '\"'); process.exit(1); }",
    "    finish(JSON.stringify({ result: true, data: { ...header, _tasks: [], ...empty(), _taskFieldDetail: rows, _hideHeaderFields: true } })); }",
    "}",
    "else if (a.includes('jo') && a.includes('describe')) {",
    "  if (id === 'prog-bad') finish(JSON.stringify({ data: { foo: 1 } }));",
    "  else finish(JSON.stringify({ data: { programId: id, name: `Program ${id}`, status: 'ACTIVE',",
    "    stepJson: JSON.stringify({ nodes: [",
    "      { type: 'EMAIL', name: 'Send welcome', templateId: 'tpl-1', x: 120, y: 340, style: { color: '#fff' } },",
    "      { type: 'WAIT', name: 'Wait 3 days', timerValue: 3, intervalUnit: 'DAY', position: { x: 1, y: 2 } },",
    "    ], powerListConfig: { sourceType: 'CSV', width: 99 } }),",
    "    canvas: { zoom: 1.2 }, width: 800 } }));",
    "}",
    "else if (a.includes('email')) {",
    "  if (id === 'tpl-bad') finish(JSON.stringify({ data: { ruleId: id } }));",
    "  else finish(JSON.stringify({ result: true, data: { emailTemplate: {",
    "    templateId: id, title: `Template ${id}`, subject: 'Hi &amp; welcome',",
    "    plainTextContent: `Plain body for ${id} kept verbatim and long enough.`,",
    "    htmlContent: '&lt;p&gt;HTML ONLY MARKER&lt;/p&gt;',",
    "    folderId: 7, active: true, transactional: false, variantCount: 0,",
    "    builderVersion: 2, system: false, published: true,",
    "    createdDateStr: '2023-04-14 03:04:53 UTC', createdByName: 'Jordan',",
    "    modifiedDateStr: '2023-06-12 18:26:31 UTC', modifiedByName: 'Leah',",
    "  }, variants: [] } }));",
    "} else {",
    "// Default (rules) branch: modifiedDate moves every run (volatile — the",
    "// fingerprint must ignore it); FAKE_RULE_VERSION simulates a real content",
    "// change; FAKE_KEY_ORDER=rev permutes key order without changing content.",
    "const d = { ruleId: id, name: `Rule ${id}`, active: true, version: process.env.FAKE_RULE_VERSION ?? '1',",
    "  modifiedDate: new Date().toISOString(), argsSeen: a.slice(2).join(' ') };",
    "const keys = Object.keys(d);",
    "if (process.env.FAKE_KEY_ORDER === 'rev') keys.reverse();",
    "const out = {};",
    "for (const k of keys) out[k] = d[k];",
    "console.log(JSON.stringify({ data: out }));",
    "}",
  ].join("\n")
);

const M = join(ROOT, "acme-sbx", "_manifest.json");
manifest("init", ["--slug", "acme-sbx", "--base-url", "https://acme--sbx.gainsightcloud.com", "--environment", "sandbox"]);
const rulesList = join(ROOT, "rules.json");
writeFileSync(rulesList, JSON.stringify({
  data: [
    { ruleId: "r-1", name: "Risk Rule" },
    { ruleId: "r-2", name: "Renewal Rule" },
    { ruleId: "r 3", name: "Spaces In Id" },
    { ruleId: "r-fail", name: "Doomed Rule" },
  ],
}));
manifest("upsert-batch", ["--file", rulesList, "--domain", "rules-engine-rules", "--id-field", "ruleId", "--name-field", "name"]);

const OUT = join(ROOT, "acme-sbx", "rules-engine-rules");
const DESCRIBE = "gs-admin --json re r describe --id {id}";

// ── Fail-closed command gate ─────────────────────────────────────────────────
let r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", "gs-admin --json re r delete --id {id}"]);
check("gate: mutating command refused", r.code === 1 && /MUTATING/.test(r.stderr), r);
r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", "gs-admin --json re r frobnicate {id}"]);
check("gate: unknown command refused (fail-closed)", r.code === 1 && /not in the catalog/.test(r.stderr), r);
r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", "node evil.mjs {id}"]);
check("gate: non-gs-admin command refused", r.code === 1 && /single gs-admin invocation/.test(r.stderr), r);
r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", "gs-admin --json re r describe --id r-1"]);
check("gate: missing {id}/{name} placeholder refused", r.code === 1 && /placeholder/.test(r.stderr), r);
r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", "gs-admin --json re r describe --id {id} | jq ."]);
check("gate: pipe/chain in the template refused", r.code === 1 && /one plain gs-admin command/.test(r.stderr), r);
r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", "/opt/pinned/gs-admin --json re r describe --id {id}"]);
check("gate: path-prefixed binary refused with --bin pointer", r.code === 1 && /--bin/.test(r.stderr), r);

// ── F-020: catalog `mutating: false` is NOT read-only ────────────────────────
// The three gates that close the catalog-non-mutating write surface, each
// exercised on a command the old `if (matched.mutating)` check let through.
// Since CLI 1.0.8 the SHIPPED ask-overrides.json is empty (upstream closed
// the mislabel class), so the override gate keeps its coverage on a COPY of
// the script tree carrying a synthetic override file — same mechanism,
// synthetic entries — while shipped-tree checks pin the post-1.0.8 behavior.
const OV_TREE = join(ROOT, "override-tree");
mkdirSync(join(OV_TREE, "scripts"), { recursive: true });
mkdirSync(join(OV_TREE, "hooks"), { recursive: true });
for (const f of ["describe-batch.mjs", "doc-lib.mjs"]) {
  writeFileSync(join(OV_TREE, "scripts", f), readFileSync(join(SCRIPTS, f)));
}
const SYN_OVERRIDES = JSON.stringify({
  overrides: [
    { path: "rules-engine rules run-now", whileCatalogMutatingIs: false, unlessArgPresent: "--test-run",
      reason: "verified live rule execution", verifiedOnCli: "1.0.6" },
    { path: "rules-engine rules schedule-basic", whileCatalogMutatingIs: false,
      reason: "schedule POST verified as a tenant write", verifiedOnCli: "1.0.6" },
  ],
});
writeFileSync(join(OV_TREE, "hooks", "ask-overrides.json"), SYN_OVERRIDES);
function batchOv(args, env) {
  const res = spawnSync(process.execPath, [join(OV_TREE, "scripts", "describe-batch.mjs"), "--manifest", M, ...args], {
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
  });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch { /* failure path */ }
  return { code: res.status, json, stderr: res.stderr.trim() };
}
r = batchOv(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", "gs-admin --json re r run-now --id {id}"]);
check("gate: ask-override command refused outright (synthetic list)", r.code === 1 && /ask-override list/.test(r.stderr), r);
r = batchOv(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", "gs-admin --json re r run-now --id {id} --test-run"]);
check("gate: ask-override refusal ignores unlessArgPresent (--test-run)", r.code === 1 && /ask-override list/.test(r.stderr), r);
// Shipped tree, empty override list (1.0.8): the same command falls through
// to the verb gate — still refused, just later and with the verb wording.
r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", "gs-admin --json re r run-now --id {id}"]);
check("gate: run-now still refused with the shipped empty override list (verb gate)", r.code === 1 && /not a describe-shaped read/.test(r.stderr), r);
r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", "gs-admin --json re r edit --id {id} --new-name x"]);
check("gate: non-describe verb refused though catalog-non-mutating", r.code === 1 && /not a describe-shaped read/.test(r.stderr), r);
r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", "gs-admin --json re r describe-sneaky --id {id}"]);
check("gate: describe-shaped command with a PUT endpoint refused", r.code === 1 && /declares a PUT endpoint/.test(r.stderr), r);

// ── Happy path: describe → doc → mark, failures marked and skipped past ─────
r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", DESCRIBE]);
check("run: 3 documented, 1 failed, batch completed", r.code === 0 && r.json?.documented === 3 && r.json?.failed === 1, r);
check("run: doc-mode defaults to raw outside journey-email-templates", r.json?.docMode === "raw", r.json);
check("run: commandSource is explicit when --command is passed", r.json?.commandSource === "explicit", r.json);
check("run: docs written for clean ids", existsSync(join(OUT, "r-1.md")) && existsSync(join(OUT, "r-2.md")), r.json);
check("run: sanitized id gets the hash-suffixed filename", r.json?.docs.some((d) => /r_3-[0-9a-f]{8}\.md$/.test(d)), r.json);
const doc1 = readFileSync(join(OUT, "r-1.md"), "utf8");
check("run: doc carries name, scalar fields, and raw JSON block", /# Risk Rule/.test(doc1) && /- ruleId: r-1/.test(doc1) && /```json/.test(doc1), doc1.slice(0, 300));
let inv = JSON.parse(readFileSync(M, "utf8")).inventory;
check("run: documented entries marked at depth full", inv["rules-engine-rules/r-1"].status === "documented" && inv["rules-engine-rules/r-1"].depth === "full", inv["rules-engine-rules/r-1"]);
check("run: failed entry marked with the CLI error", inv["rules-engine-rules/r-fail"].status === "failed" && /simulated describe failure/.test(inv["rules-engine-rules/r-fail"].error), inv["rules-engine-rules/r-fail"]);
check("run: doc_path recorded on documented entries", /r-1\.md$/.test(inv["rules-engine-rules/r-1"].doc_path), inv["rules-engine-rules/r-1"]);
check("run: moreRemaining reflects the failed leftover", r.json?.moreRemaining === true, r.json);
check(
  "run: summary carries domainProgress (documented/total for the domain)",
  r.json?.domainProgress?.documented === 3 && r.json?.domainProgress?.total === 4,
  r.json?.domainProgress
);
check(
  "run: stderr progress line emitted with batch and domain counts",
  /\[describe-batch\] 4\/4 in batch — domain 3\/4 documented/.test(r.stderr),
  r.stderr
);

// ── Resumability: a re-run selects only what's left ──────────────────────────
r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", DESCRIBE]);
check("resume: re-run selects only the failed entry", r.code === 0 && r.json?.selected === 1 && r.json?.documented === 0 && r.json?.failed === 1, r);

// ── --upgrade: stub → full overwrite ─────────────────────────────────────────
const chainsList = join(ROOT, "chains.json");
writeFileSync(chainsList, JSON.stringify({ data: [{ workflowId: "wf-1", name: "Nightly Chain" }] }));
manifest("upsert-batch", ["--file", chainsList, "--domain", "rules-engine-chains", "--id-field", "workflowId", "--name-field", "name"]);
const CHAINS_OUT = join(ROOT, "acme-sbx", "rules-engine-chains");
manifest("stub", ["--file", chainsList, "--domain", "rules-engine-chains", "--id-field", "workflowId", "--name-field", "name", "--out-dir", CHAINS_OUT]);
check("upgrade setup: entry stubbed at depth metadata", JSON.parse(readFileSync(M, "utf8")).inventory["rules-engine-chains/wf-1"].depth === "metadata", null);
r = batch(["--domain", "rules-engine-chains", "--out-dir", CHAINS_OUT, "--bin", FAKE, "--upgrade", "--command", "gs-admin --json re chains describe --id {id}"]);
const chainDoc = readFileSync(join(CHAINS_OUT, "wf-1.md"), "utf8");
check("upgrade: stub file overwritten with the full describe doc", r.json?.documented === 1 && /Full describe doc/.test(chainDoc) && !/Metadata-only stub/.test(chainDoc), r);
check("upgrade: entry promoted to depth full", JSON.parse(readFileSync(M, "utf8")).inventory["rules-engine-chains/wf-1"].depth === "full", null);
check("upgrade: nothing left in the upgrade queue", r.json?.moreRemaining === false, r.json);
check(
  "upgrade: domainProgress is depth-aware ({ full, metadata, failed, total })",
  r.json?.domainProgress?.full === 1 && r.json?.domainProgress?.metadata === 0 &&
    r.json?.domainProgress?.failed === 0 && r.json?.domainProgress?.total === 1 &&
    r.json?.domainProgress?.documented === undefined,
  r.json?.domainProgress
);
check(
  "upgrade: stderr progress line shows full/total, not documented",
  /\[describe-batch\] 1\/1 in batch — domain 1\/1 full/.test(r.stderr) && !/documented/.test(r.stderr),
  r.stderr
);

// ── --upgrade: a failed ingest attempt stays in the queue and is retried ─────
const chainsBList = join(ROOT, "chains-b.json");
writeFileSync(chainsBList, JSON.stringify({ data: [{ workflowId: "wf-2", name: "Good Chain" }, { workflowId: "r-fail", name: "Doomed Chain" }] }));
manifest("upsert-batch", ["--file", chainsBList, "--domain", "rules-engine-chains-b", "--id-field", "workflowId", "--name-field", "name"]);
const CHAINS_B_OUT = join(ROOT, "acme-sbx", "rules-engine-chains-b");
manifest("stub", ["--file", chainsBList, "--domain", "rules-engine-chains-b", "--id-field", "workflowId", "--name-field", "name", "--out-dir", CHAINS_B_OUT]);
r = batch(["--domain", "rules-engine-chains-b", "--out-dir", CHAINS_B_OUT, "--bin", FAKE, "--upgrade", "--command", "gs-admin --json re chains describe --id {id}"]);
check("upgrade-fail: failure reported and queue not drained", r.json?.documented === 1 && r.json?.failed === 1 && r.json?.moreRemaining === true, r.json);
check(
  "upgrade-fail: domainProgress separates full from failed stubs",
  r.json?.domainProgress?.full === 1 && r.json?.domainProgress?.metadata === 0 &&
    r.json?.domainProgress?.failed === 1 && r.json?.domainProgress?.total === 2,
  r.json?.domainProgress
);
const failedStub = JSON.parse(readFileSync(M, "utf8")).inventory["rules-engine-chains-b/r-fail"];
check("upgrade-fail: entry keeps depth metadata for retry", failedStub.status === "failed" && failedStub.depth === "metadata", failedStub);
r = batch(["--domain", "rules-engine-chains-b", "--out-dir", CHAINS_B_OUT, "--bin", FAKE, "--upgrade", "--command", "gs-admin --json re chains describe --id {id}"]);
check("upgrade-fail: re-run retries the failed stub", r.json?.selected === 1 && r.json?.failed === 1, r.json);

// ── {name} substitution: pipe-bearing name passed as literal argv ────────────
const scList = join(ROOT, "scorecards.json");
writeFileSync(scList, JSON.stringify({ data: [{ scorecardId: "sc-1", name: "CS|Health|Overall" }, { scorecardId: "sc-2", name: null }] }));
manifest("upsert-batch", ["--file", scList, "--domain", "scorecard", "--id-field", "scorecardId", "--name-field", "name"]);
const SC_OUT = join(ROOT, "acme-sbx", "scorecard");
r = batch(["--domain", "scorecard", "--out-dir", SC_OUT, "--bin", FAKE, "--command", "gs-admin --json sc measures --name {name}"]);
check("name: entry without a recorded name marked failed", r.json?.failed === 1 && r.json?.failures[0]?.error.includes("{name}"), r.json);
const scDoc = readFileSync(join(SC_OUT, "sc-1.md"), "utf8");
check("name: pipe-bearing name reached the CLI as one literal arg", r.json?.documented === 1 && scDoc.includes("--name CS|Health|Overall"), scDoc.slice(0, 400));

// ── Template doc-mode: journey-email-templates auto-selects the compact doc ─
const tplList = join(ROOT, "templates.json");
writeFileSync(tplList, JSON.stringify({ data: [
  { templateId: "tpl-1", title: "Template tpl-1" },
  { templateId: "tpl-2", title: "Template tpl-2" },
  { templateId: "tpl-bad", title: "Bad Payload" },
] }));
manifest("upsert-batch", ["--file", tplList, "--domain", "journey-email-templates", "--id-field", "templateId", "--name-field", "title"]);
const TPL_OUT = join(ROOT, "acme-sbx", "journey-email-templates");
const TPL_DESCRIBE = "gs-admin --json jo email template --id {id}";
r = batch(["--domain", "journey-email-templates", "--out-dir", TPL_OUT, "--bin", FAKE, "--command", TPL_DESCRIBE]);
check("template: doc-mode auto-selected for journey-email-templates", r.json?.docMode === "template", r.json);
check("template: 2 documented, renderer failure marked and batch continued", r.code === 0 && r.json?.documented === 2 && r.json?.failed === 1, r);
check("template: bad payload failure names the missing field", /emailTemplate/.test(r.json?.failures?.[0]?.error ?? ""), r.json?.failures);
const tplDoc = readFileSync(join(TPL_OUT, "tpl-1.md"), "utf8");
check(
  "template: compact doc (key, decoded subject, plain body, re-fetch note)",
  tplDoc.includes("- key: journey-email-templates/tpl-1") && tplDoc.includes("- subject: Hi & welcome") &&
    tplDoc.includes("Plain body for tpl-1") && tplDoc.includes("jo email template --id tpl-1"),
  tplDoc.slice(0, 400)
);
check("template: no raw JSON or HTML embedded", !tplDoc.includes("```json") && !tplDoc.includes("HTML ONLY MARKER") && !tplDoc.includes("&lt;"), tplDoc);
inv = JSON.parse(readFileSync(M, "utf8")).inventory;
check(
  "template: entries marked documented at depth full with doc_path",
  inv["journey-email-templates/tpl-1"].status === "documented" && inv["journey-email-templates/tpl-1"].depth === "full" &&
    /tpl-1\.md$/.test(inv["journey-email-templates/tpl-1"].doc_path),
  inv["journey-email-templates/tpl-1"]
);

// Parity lock: standalone template-doc.mjs writes the identical doc for the same payload.
const payloadFile = join(ROOT, "tpl-1-describe.json");
writeFileSync(payloadFile, spawnSync(process.execPath, [FAKE, "--json", "jo", "email", "template", "--id", "tpl-1"], { encoding: "utf8" }).stdout);
const SOLO_OUT = join(ROOT, "solo-docs");
spawnSync(process.execPath, [join(SCRIPTS, "template-doc.mjs"), "--out-dir", SOLO_OUT, payloadFile], { encoding: "utf8" });
check("template: batch doc identical to standalone template-doc.mjs output", readFileSync(join(SOLO_OUT, "tpl-1.md"), "utf8") === tplDoc, tplDoc.slice(0, 200));

// Explicit --doc-mode raw override still writes the raw-JSON doc for this domain.
const tplList2 = join(ROOT, "templates-2.json");
writeFileSync(tplList2, JSON.stringify({ data: [{ templateId: "tpl-4", title: "Template tpl-4" }] }));
manifest("upsert-batch", ["--file", tplList2, "--domain", "journey-email-templates", "--id-field", "templateId", "--name-field", "title"]);
r = batch(["--domain", "journey-email-templates", "--out-dir", TPL_OUT, "--bin", FAKE, "--doc-mode", "raw", "--command", TPL_DESCRIBE]);
const rawDoc = readFileSync(join(TPL_OUT, "tpl-4.md"), "utf8");
check("template: --doc-mode raw override honored", r.json?.docMode === "raw" && rawDoc.includes("```json"), r.json);
r = batch(["--domain", "journey-email-templates", "--out-dir", TPL_OUT, "--bin", FAKE, "--doc-mode", "compact", "--command", TPL_DESCRIBE]);
check("template: unknown --doc-mode refused", r.code === 1 && /--doc-mode/.test(r.stderr), r);

// ── Recorded describe recipes: --command defaults to the index-time recording ─
const recFile = join(ROOT, "recorded.json");
writeFileSync(recFile, JSON.stringify({ data: [{ ruleId: "rec-1", name: "Recorded Rule" }] }));
manifest("upsert-batch", ["--file", recFile, "--domain", "re-recorded", "--id-field", "ruleId", "--name-field", "name", "--describe-command", "gs-admin --json re r describe --id {id}"]);
const REC_OUT = join(ROOT, "acme-sbx", "re-recorded");
r = batch(["--domain", "re-recorded", "--out-dir", REC_OUT, "--bin", FAKE]);
check("recipe: recorded command used when --command omitted", r.code === 0 && r.json?.commandSource === "recorded" && r.json?.documented === 1, r);
check("recipe: doc proves the recorded template ran", readFileSync(join(REC_OUT, "rec-1.md"), "utf8").includes("re r describe --id rec-1"), null);
// gate-3 F-346: `--describe-command none` is the recorded LIST-ONLY decision —
// never a template to spawn. With no --command the script refuses and names
// the recording; an explicit --command still wins (the operator's override).
manifest("upsert-batch", ["--file", recFile, "--domain", "re-listonly", "--id-field", "ruleId", "--name-field", "name", "--describe-command", "none"]);
r = batch(["--domain", "re-listonly", "--out-dir", join(ROOT, "acme-sbx", "re-listonly"), "--bin", FAKE]);
check("recipe F-346: a recorded `none` is refused as a template, naming the list-only decision",
  r.code === 1 && /recorded as list-only/.test(r.stderr) && /--describe-command none/.test(r.stderr) && !/no describe-command recorded/.test(r.stderr), r);
r = batch(["--domain", "re-listonly", "--out-dir", join(ROOT, "acme-sbx", "re-listonly"), "--bin", FAKE, "--command", "gs-admin --json re r describe --id {id}"]);
check("recipe F-346: an explicit --command overrides the recorded `none`", r.code === 0 && r.json?.commandSource === "explicit" && r.json?.documented === 1, r);
const recFile2 = join(ROOT, "recorded-2.json");
writeFileSync(recFile2, JSON.stringify({ data: [{ ruleId: "rec-2", name: "Recorded Rule Two" }] }));
manifest("upsert-batch", ["--file", recFile2, "--domain", "re-recorded", "--id-field", "ruleId", "--name-field", "name"]);
r = batch(["--domain", "re-recorded", "--out-dir", REC_OUT, "--bin", FAKE, "--command", "gs-admin --json re chains describe --id {id}"]);
check("recipe: explicit --command overrides the recording", r.code === 0 && r.json?.commandSource === "explicit" && readFileSync(join(REC_OUT, "rec-2.md"), "utf8").includes("chains describe --id rec-2"), r.json);
r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE]);
check("recipe: no recording and no --command refused with a recording hint", r.code === 1 && /--command is required/.test(r.stderr) && /--describe-command/.test(r.stderr), r);
const doomedFile = join(ROOT, "doomed.json");
writeFileSync(doomedFile, JSON.stringify({ data: [{ ruleId: "dm-1", name: "Doomed" }] }));
manifest("upsert-batch", ["--file", doomedFile, "--domain", "re-doomed", "--id-field", "ruleId", "--name-field", "name", "--describe-command", "gs-admin --json re r delete --id {id}"]);
r = batch(["--domain", "re-doomed", "--out-dir", join(ROOT, "acme-sbx", "re-doomed"), "--bin", FAKE]);
check("recipe: recorded MUTATING command refused by the gate", r.code === 1 && /MUTATING/.test(r.stderr), r);
manifest("upsert-batch", ["--file", doomedFile, "--domain", "re-doomed", "--id-field", "ruleId", "--name-field", "name", "--describe-command", "gs-admin --json re r frobnicate {id}"]);
r = batch(["--domain", "re-doomed", "--out-dir", join(ROOT, "acme-sbx", "re-doomed"), "--bin", FAKE]);
check("recipe: recorded UNKNOWN command refused fail-closed", r.code === 1 && /not in the catalog/.test(r.stderr), r);

// ── Program doc-mode: journey auto-selects the compact program doc ──────────
const progList = join(ROOT, "programs.json");
writeFileSync(progList, JSON.stringify({ data: [
  { programId: "prog-1", name: "Onboarding Journey" },
  { programId: "prog-bad", name: "Bad Payload Program" },
] }));
manifest("upsert-batch", ["--file", progList, "--domain", "journey", "--id-field", "programId", "--name-field", "name"]);
const PROG_OUT = join(ROOT, "acme-sbx", "journey");
const PROG_DESCRIBE = "gs-admin --json jo p describe --id {id}";
r = batch(["--domain", "journey", "--out-dir", PROG_OUT, "--bin", FAKE, "--command", PROG_DESCRIBE]);
check("program: doc-mode auto-selected for journey", r.json?.docMode === "program", r.json);
// F-429: the doc-mode follows what the domain was RECORDED from, not its
// folder name — a journey domain under another name, recorded from `jo p
// list`, still gets the compact program renderer.
manifest("upsert-batch", ["--file", progList, "--domain", "programs-renamed", "--id-field", "programId", "--name-field", "name", "--list-command", "gs-admin --json jo p list"]);
{
  const rr = batch(["--domain", "programs-renamed", "--out-dir", join(ROOT, "acme-sbx", "programs-renamed"), "--bin", FAKE, "--command", PROG_DESCRIBE]);
  check("program (F-429): a journey domain under another NAME, recorded from jo p list, still auto-selects the program doc-mode", rr.json?.docMode === "program", rr.json);
}
check("program: 1 documented, renderer failure marked and batch continued", r.code === 0 && r.json?.documented === 1 && r.json?.failed === 1, r);
check("program: bad payload failure names the missing id field", /programId/.test(r.json?.failures?.[0]?.error ?? ""), r.json?.failures);
const progDoc = readFileSync(join(PROG_OUT, "prog-1.md"), "utf8");
check(
  "program: compact doc (key, scalar bullets, re-fetch note)",
  progDoc.includes("- key: journey/prog-1") && progDoc.includes("- status: ACTIVE") &&
    progDoc.includes("jo p describe --id prog-1"),
  progDoc.slice(0, 400)
);
check(
  "program: geometry and UI state dropped everywhere",
  !/"x":/.test(progDoc) && !progDoc.includes('"zoom"') && !progDoc.includes('"canvas"') && !progDoc.includes("#fff"),
  progDoc
);
check(
  "program: semantic skeleton kept — nodes, conditions/timers, template ref",
  progDoc.includes('"templateId": "tpl-1"') && progDoc.includes('"timerValue": 3') && progDoc.includes("Send welcome"),
  progDoc
);
check(
  "program: PowerList config preserved verbatim (even drop-list keys inside it)",
  progDoc.includes('"sourceType": "CSV"') && progDoc.includes('"width": 99'),
  progDoc
);
check("program: embedded stepJson parsed, not left as an escaped string", progDoc.includes("embedded JSON parsed: stepJson") && !progDoc.includes("\\\"nodes\\\""), progDoc.slice(0, 600));
inv = JSON.parse(readFileSync(M, "utf8")).inventory;
check(
  "program: entries marked documented at depth full with doc_path",
  inv["journey/prog-1"].status === "documented" && inv["journey/prog-1"].depth === "full" && /prog-1\.md$/.test(inv["journey/prog-1"].doc_path),
  inv["journey/prog-1"]
);

// Parity lock: standalone program-doc.mjs writes the identical doc for the same payload.
const progPayloadFile = join(ROOT, "prog-1-describe.json");
writeFileSync(progPayloadFile, spawnSync(process.execPath, [FAKE, "--json", "jo", "p", "describe", "--id", "prog-1"], { encoding: "utf8" }).stdout);
const PROG_SOLO_OUT = join(ROOT, "solo-program-docs");
spawnSync(process.execPath, [join(SCRIPTS, "program-doc.mjs"), "--out-dir", PROG_SOLO_OUT, progPayloadFile], { encoding: "utf8" });
check("program: batch doc identical to standalone program-doc.mjs output", readFileSync(join(PROG_SOLO_OUT, "prog-1.md"), "utf8") === progDoc, progDoc.slice(0, 200));

// Explicit --doc-mode raw override still writes the raw-JSON doc for this domain.
const progList2 = join(ROOT, "programs-2.json");
writeFileSync(progList2, JSON.stringify({ data: [{ programId: "prog-4", name: "Raw Program" }] }));
manifest("upsert-batch", ["--file", progList2, "--domain", "journey", "--id-field", "programId", "--name-field", "name"]);
r = batch(["--domain", "journey", "--out-dir", PROG_OUT, "--bin", FAKE, "--doc-mode", "raw", "--command", PROG_DESCRIBE]);
check("program: --doc-mode raw override honored", r.json?.docMode === "raw" && readFileSync(join(PROG_OUT, "prog-4.md"), "utf8").includes("```json"), r.json);

// ── Content fingerprints + --if-changed: docs rewritten only on real change ──
const fpList = join(ROOT, "fp-rules.json");
writeFileSync(fpList, JSON.stringify({ data: [{ ruleId: "fp-1", name: "Fingerprint Rule" }] }));
manifest("upsert-batch", ["--file", fpList, "--domain", "fp-rules", "--id-field", "ruleId", "--name-field", "name"]);
const FP_OUT = join(ROOT, "acme-sbx", "fp-rules");
r = batch(["--domain", "fp-rules", "--out-dir", FP_OUT, "--bin", FAKE, "--command", DESCRIBE]);
inv = JSON.parse(readFileSync(M, "utf8")).inventory;
const fp1 = inv["fp-rules/fp-1"].fingerprint;
check("fingerprint: documented entry carries a 40-hex payload fingerprint", r.code === 0 && /^[0-9a-f]{40}$/.test(fp1 ?? ""), inv["fp-rules/fp-1"]);

// Timestamp-only change (the fake bumps modifiedDate every run): skip the write
manifest("mark", ["--key", "fp-rules/fp-1", "--status", "stale", "--depth", "metadata"]);
writeFileSync(join(FP_OUT, "fp-1.md"), "# doc sentinel — must survive an unchanged --if-changed pass\n");
r = batch(["--domain", "fp-rules", "--out-dir", FP_OUT, "--bin", FAKE, "--command", DESCRIBE, "--if-changed"]);
check("if-changed: timestamp-only change skips the doc write", r.code === 0 && r.json?.skippedUnchanged === 1 && r.json?.unchangedKeys?.[0] === "fp-rules/fp-1" && r.json?.documented === 0, r.json);
check("if-changed: doc file untouched on the skip path", readFileSync(join(FP_OUT, "fp-1.md"), "utf8").includes("doc sentinel"), null);
inv = JSON.parse(readFileSync(M, "utf8")).inventory;
check("if-changed: entry re-marked documented, fingerprint kept", inv["fp-rules/fp-1"].status === "documented" && inv["fp-rules/fp-1"].fingerprint === fp1, inv["fp-rules/fp-1"]);
check("if-changed: skip path omits --depth (metadata-era entry NOT promoted to full)", inv["fp-rules/fp-1"].depth === "metadata", inv["fp-rules/fp-1"]);

// Real content change: doc rewritten, fingerprint updated
manifest("mark", ["--key", "fp-rules/fp-1", "--status", "stale"]);
r = batch(["--domain", "fp-rules", "--out-dir", FP_OUT, "--bin", FAKE, "--command", DESCRIBE, "--if-changed"], { FAKE_RULE_VERSION: "2" });
inv = JSON.parse(readFileSync(M, "utf8")).inventory;
check("if-changed: real content change rewrites the doc", r.code === 0 && r.json?.documented === 1 && r.json?.skippedUnchanged === 0 && readFileSync(join(FP_OUT, "fp-1.md"), "utf8").includes("- version: 2"), r.json);
check("if-changed: fingerprint updated on real change", /^[0-9a-f]{40}$/.test(inv["fp-rules/fp-1"].fingerprint ?? "") && inv["fp-rules/fp-1"].fingerprint !== fp1, inv["fp-rules/fp-1"]);

// No recorded fingerprint (legacy/pending entry): documents normally
const fpList2 = join(ROOT, "fp-rules-2.json");
writeFileSync(fpList2, JSON.stringify({ data: [{ ruleId: "fp-2", name: "Legacy Rule" }] }));
manifest("upsert-batch", ["--file", fpList2, "--domain", "fp-rules", "--id-field", "ruleId", "--name-field", "name"]);
r = batch(["--domain", "fp-rules", "--out-dir", FP_OUT, "--bin", FAKE, "--command", DESCRIBE, "--if-changed"]);
inv = JSON.parse(readFileSync(M, "utf8")).inventory;
check("if-changed: no recorded fingerprint documents normally + records one", r.code === 0 && r.json?.documented === 1 && r.json?.skippedUnchanged === 0 && existsSync(join(FP_OUT, "fp-2.md")) && /^[0-9a-f]{40}$/.test(inv["fp-rules/fp-2"].fingerprint ?? ""), r.json);

// Key-order permutation with identical content: canonicalization reads unchanged
manifest("mark", ["--key", "fp-rules/fp-1", "--status", "stale"]);
writeFileSync(join(FP_OUT, "fp-1.md"), "# permutation sentinel\n");
r = batch(["--domain", "fp-rules", "--out-dir", FP_OUT, "--bin", FAKE, "--command", DESCRIBE, "--if-changed"], { FAKE_RULE_VERSION: "2", FAKE_KEY_ORDER: "rev" });
check("if-changed: key-order permutation alone reads as unchanged (canonicalization)", r.code === 0 && r.json?.skippedUnchanged === 1 && readFileSync(join(FP_OUT, "fp-1.md"), "utf8").includes("permutation sentinel"), r.json);

// Deleted doc file: the skip requires the recorded doc to still exist —
// deleting a doc is the operator's way of forcing regeneration, and a skip
// there would mark documented with doc_path pointing at nothing.
manifest("mark", ["--key", "fp-rules/fp-1", "--status", "stale"]);
rmSync(join(FP_OUT, "fp-1.md"));
r = batch(["--domain", "fp-rules", "--out-dir", FP_OUT, "--bin", FAKE, "--command", DESCRIBE, "--if-changed"], { FAKE_RULE_VERSION: "2" });
check("if-changed: deleted doc regenerates despite an unchanged fingerprint", r.code === 0 && r.json?.documented === 1 && r.json?.skippedUnchanged === 0 && existsSync(join(FP_OUT, "fp-1.md")), r.json);

// F-143 (mechanism as rewritten by F-156, comment corrected by F-209): a
// SKIPPED-unchanged entry's doc stays on disk, and docNameClaimer's snapshot
// of the files already in the output dir — taken before this pass's first
// write — forces the -dup suffix onto a case-colliding entry in ANY queue
// order. The skip path itself registers nothing (it `continue`s before
// claimBaseName); protection comes entirely from that pre-first-write disk
// snapshot, which also covers collisions across SEPARATE runs. Rig: document
// the lower-case id first (fingerprint + doc recorded), add the upper-case
// collider as a new entry, then one --if-changed batch — the skipped entry's
// doc must survive and the collider must land as -dup.
const fpCollide = join(ROOT, "fp-collide.json");
writeFileSync(fpCollide, JSON.stringify({ data: [{ ruleId: "col-a", name: "Lower" }] }));
manifest("upsert-batch", ["--file", fpCollide, "--domain", "fp-collide", "--id-field", "ruleId", "--name-field", "name"]);
const FP_COLLIDE_OUT = join(ROOT, "acme-sbx", "fp-collide");
r = batch(["--domain", "fp-collide", "--out-dir", FP_COLLIDE_OUT, "--bin", FAKE, "--command", DESCRIBE]);
check("if-changed collide rig: lower-case id documented with a fingerprint", r.code === 0 && r.json?.documented === 1, r.json);
const fpCollide2 = join(ROOT, "fp-collide-2.json");
writeFileSync(fpCollide2, JSON.stringify({ data: [{ ruleId: "COL-A", name: "Upper" }] }));
manifest("upsert-batch", ["--file", fpCollide2, "--domain", "fp-collide", "--id-field", "ruleId", "--name-field", "name"]);
manifest("mark", ["--key", "fp-collide/col-a", "--status", "stale"]);
r = batch(["--domain", "fp-collide", "--out-dir", FP_COLLIDE_OUT, "--bin", FAKE, "--command", DESCRIBE, "--if-changed"]);
const filesCollide = readdirSync(FP_COLLIDE_OUT).filter((f) => f.endsWith(".md"));
check(
  "if-changed: skipped-unchanged entry still blocks a case-colliding write (two files, one -dup) (F-143)",
  r.code === 0 && r.json?.skippedUnchanged === 1 && r.json?.documented === 1 && filesCollide.length === 2 && filesCollide.some((f) => f.includes("-dup")),
  { json: r.json, filesCollide }
);

// ── Docs agreement: the {id}-vs-{name} disambiguation is stated everywhere ──
// The same three sentences appear in the setup skill's index-scope-notes
// reference (GP-B5 DS-32 moved them there from the skill body), the operating
// model, and describe-batch.mjs's header — this lock keeps them in agreement
// (AGENTS.md: statements about the same topic must agree). The canon is only
// reachable through the skeleton's pointers (Phase 4's recording bullets and
// Phase 5's batch paragraph both name the reference), so the pointer itself is
// locked below too — a trimmed pointer would leave the canon green but
// unloaded (review round, B9).
const PLUGIN = join(SCRIPTS, "..");
const CANON = [
  "the describe identifier is always {id} — the manifest is keyed by it.",
  "{name} substitutes the display label and is only for commands that address by label (e.g. sc measures --name).",
  "dm objects therefore take --name {id}, not --name {name}.",
];
const normalize = (s) => s.replace(/`/g, "").replace(/^\s*\/\/ ?/gm, "").replace(/\s+/g, " ").toLowerCase();
for (const rel of ["skills/setup/references/index-scope-notes.md", "templates/operating-model.md", "scripts/describe-batch.mjs"]) {
  const text = normalize(readFileSync(join(PLUGIN, ...rel.split("/")), "utf8"));
  for (const s of CANON) {
    check(`canon: ${rel} states "${s.slice(0, 42)}…"`, text.includes(s), rel);
  }
}
{
  const skeleton = readFileSync(join(PLUGIN, "skills", "setup", "SKILL.md"), "utf8");
  const pointerCount = skeleton.split("references/index-scope-notes.md").length - 1;
  check("canon: the setup skeleton still points at index-scope-notes (>=2 sites — the canon is unloaded without them)",
    pointerCount >= 2, { pointerCount });
}

// ── F-046 (release review 2026-07-25): `get`-verb reads pass the verb gate ───
// `jo dd get` / `jo s get` are the natural --describe-command for two domains
// the setup skill indexes; the first allowlist refused them at batch runtime.
const ddList = join(ROOT, "dd.json");
writeFileSync(ddList, JSON.stringify({ data: [{ id: "dd-1", name: "Design One" }] }));
manifest("upsert-batch", ["--file", ddList, "--domain", "journey-data-designer", "--id-field", "id", "--name-field", "name"]);
// `jo dd get` addresses by --name (its `jo s get` sibling takes --id); the manifest key
// still substitutes as {id} per the describe-identifier rule.
r = batch(["--domain", "journey-data-designer", "--out-dir", join(ROOT, "acme-sbx", "journey-data-designer"), "--bin", FAKE, "--command", "gs-admin --json jo dd get --name {id}"]);
check("gate: get-verb pure-GET read admitted (jo dd get)", r.code === 0 && r.json?.documented === 1, r);

// ── CP-4 (CLI 1.0.6 adoption rider): the five scheduling/Events-Framework read
// verbs (`schedules`, `topics`, `events`, `s3-tasks`, `event-curl`) join
// READ_VERB_EXACT; the schedule-subscribe writers around them stay refused.
const schedList = join(ROOT, "sched.json");
writeFileSync(schedList, JSON.stringify({ data: [{ id: "sr-1", name: "Scheduled Rule" }] }));
manifest("upsert-batch", ["--file", schedList, "--domain", "re-sched", "--id-field", "id", "--name-field", "name"]);
const SCHED_OUT = join(ROOT, "acme-sbx", "re-sched");
r = batch(["--domain", "re-sched", "--out-dir", SCHED_OUT, "--bin", FAKE, "--command", "gs-admin --json re r schedules --rule-id {id}"]);
check("gate: schedules read verb admitted (1.0.6)", r.code === 0 && r.json?.documented === 1, r);
manifest("mark", ["--key", "re-sched/sr-1", "--status", "stale"]);
r = batch(["--domain", "re-sched", "--out-dir", SCHED_OUT, "--bin", FAKE, "--command", "gs-admin --json re r s3-tasks --rule-id {id}"]);
check("gate: hyphenated s3-tasks read verb admitted (1.0.6)", r.code === 0 && r.json?.documented === 1, r);
manifest("mark", ["--key", "re-sched/sr-1", "--status", "stale"]);
r = batch(["--domain", "re-sched", "--out-dir", SCHED_OUT, "--bin", FAKE, "--command", "gs-admin --json re r event-curl --rule-id {id}"]);
check("gate: event-curl read verb admitted (1.0.6)", r.code === 0 && r.json?.documented === 1, r);
// schedule-basic is catalog-non-mutating and on the SYNTHETIC ask-overrides
// list (the real list is empty since 1.0.8) — the override gate refuses it
// before the verb gate is ever consulted, pinning the gate ORDER.
r = batchOv(["--domain", "re-sched", "--out-dir", SCHED_OUT, "--bin", FAKE, "--command", "gs-admin --json re r schedule-basic --rule-id {id}"]);
check("gate: schedule-basic write refused via ask-overrides (synthetic list)", r.code === 1 && /ask-override list/.test(r.stderr), r);
// Shipped tree (empty list): the verb gate catches it instead.
r = batch(["--domain", "re-sched", "--out-dir", SCHED_OUT, "--bin", FAKE, "--command", "gs-admin --json re r schedule-basic --rule-id {id}"]);
check("gate: schedule-basic still refused with the shipped empty override list (verb gate)", r.code === 1 && /not a describe-shaped read/.test(r.stderr), r);

// ── wave-2 portability: launcher-shim --bin + case/suffix template gate ──────
// F-119: a .cmd/.bat/.ps1 --bin is refused up front with the JS-entry hint,
// BEFORE any spawn or manifest write — previously each asset was marked
// failed with an opaque `spawn EINVAL` and the batch exited 0.
const SHIM = join(ROOT, "fake-cli.cmd");
writeFileSync(SHIM, "@echo off\r\necho tripwire\r\n");
manifest("mark", ["--key", "re-sched/sr-1", "--status", "stale"]);
r = batch(["--domain", "re-sched", "--out-dir", SCHED_OUT, "--bin", SHIM, "--command", "gs-admin --json re r schedules --rule-id {id}"]);
check("resolveCli: launcher-shim --bin refused with the JS-entry hint (F-119)", r.code === 1 && /launcher shim/.test(r.stderr) && /JS entry/.test(r.stderr), r);
check("resolveCli: shim refusal precedes any manifest write", JSON.parse(readFileSync(M, "utf8")).inventory["re-sched/sr-1"].status === "stale", null);

// F-120: case/suffix spellings of gs-admin in a recorded template match like
// the guard's word matcher (stripLauncherSuffix) — the spelling is only ever
// MATCHED; execution still resolves the CLI via --bin/resolveCli.
r = batch(["--domain", "re-sched", "--out-dir", SCHED_OUT, "--bin", FAKE, "--command", "GS-Admin.CMD --json re r schedules --rule-id {id}"]);
check("gate: GS-Admin.CMD template spelling accepted (F-120)", r.code === 0 && r.json?.documented === 1, r);
r = batch(["--domain", "re-sched", "--out-dir", SCHED_OUT, "--bin", FAKE, "--command", "C:\\shims\\GS-ADMIN.CMD --json re r schedules --rule-id {id}"]);
check("gate: path-prefixed shim spelling reaches the --bin redirect (F-120)", r.code === 1 && /pass the binary via --bin/.test(r.stderr), r);
r = batch(["--domain", "re-sched", "--out-dir", SCHED_OUT, "--bin", FAKE, "--command", "gsadmin --json re r schedules --rule-id {id}"]);
check("gate: a genuinely different binary is still refused", r.code === 1 && /single gs-admin invocation/.test(r.stderr), r);

// F-125's in-run usedBaseNames guard, pinned here per F-139: unique ids can
// still collide as FILENAMES under case folding, so two assets differing only
// by case must produce two docs in one batch. Without the guard the second doc
// overwrites the first while the summary still counts both documented.
const collideList = join(ROOT, "collide.json");
writeFileSync(collideList, JSON.stringify({ data: [{ ruleId: "Rule-X", name: "Upper" }, { ruleId: "rule-x", name: "Lower" }] }));
manifest("upsert-batch", ["--file", collideList, "--domain", "re-collide", "--id-field", "ruleId", "--name-field", "name"]);
const COLLIDE_OUT = join(ROOT, "acme-sbx", "re-collide");
r = batch(["--domain", "re-collide", "--out-dir", COLLIDE_OUT, "--bin", FAKE, "--command", "gs-admin --json re r describe --id {id}"]);
{
  const filesC = readdirSync(COLLIDE_OUT);
  check(
    "collision: case-colliding ids in one batch get distinct docs (F-125/F-139)",
    r.code === 0 && r.json?.documented === 2 && filesC.length === 2 && filesC.some((f) => f.includes("-dup")),
    { code: r.code, documented: r.json?.documented, filesC }
  );
}

// ── F-188: the collision case where a pass sees only ONE member of the pair ──
// The block above pins one writer's IN-RUN collisions and F-143 pins one writer
// across passes, but neither can regress the disk key: both passes there see the
// same two ids in the same order, so an in-run-only Set mints the same names and
// every assertion still holds. The orphan F-156 exists for needs a pass that sees
// only ONE member — the realistic shape, since a collider is usually discovered
// by a LATER crawl. Then an in-run-only writer starts with an empty Set, claims
// the plain name, and on Windows/macOS that IS the other id's file: the first
// doc is silently overwritten and its entry's doc_path now points at another
// id's content. Sequence: stub one member, discover the collider and stub it
// alone, then deep-pass the whole domain across both.
// Fixture-authoring caveat: never name a helper file after both ids of the pair —
// on Windows/macOS those two filenames are ONE file, so the rig would silently
// test one id twice while looking like it tests two (F-188).
const xwFirst = join(ROOT, "cross-writer-1.json");
const xwSecond = join(ROOT, "cross-writer-2.json");
writeFileSync(xwFirst, JSON.stringify({ data: [{ ruleId: "rule-xw", name: "Lower" }] }));
writeFileSync(xwSecond, JSON.stringify({ data: [{ ruleId: "Rule-XW", name: "Upper" }] }));
const XW_OUT = join(ROOT, "acme-sbx", "re-xwriter");
const xwDocOf = (id) => JSON.parse(readFileSync(M, "utf8")).inventory[`re-xwriter/${id}`]?.doc_path;
const xwBody = (id) => readFileSync(join(ROOT, "acme-sbx", "re-xwriter", xwDocOf(id).split("/").pop()), "utf8");

// Pass 1 — the first crawl knows about one id only.
manifest("upsert-batch", ["--file", xwFirst, "--domain", "re-xwriter", "--id-field", "ruleId", "--name-field", "name"]);
manifest("stub", ["--file", xwFirst, "--domain", "re-xwriter", "--id-field", "ruleId", "--name-field", "name", "--out-dir", XW_OUT]);
check("one-member: first crawl writes a single stub doc (F-188 setup)", readdirSync(XW_OUT).length === 1, readdirSync(XW_OUT));

// Pass 2 — a LATER crawl discovers the case-collider and stubs it ALONE. Only the
// on-disk key can protect the first doc here; this run's own Set is empty.
manifest("upsert-batch", ["--file", xwSecond, "--domain", "re-xwriter", "--id-field", "ruleId", "--name-field", "name"]);
manifest("stub", ["--file", xwSecond, "--domain", "re-xwriter", "--id-field", "ruleId", "--name-field", "name", "--out-dir", XW_OUT]);
const xwTwo = readdirSync(XW_OUT).sort();
check(
  "one-member: a later pass over the collider ALONE does not overwrite the first doc (F-156/F-188)",
  xwTwo.length === 2 && xwTwo.some((f) => f.includes("-dup")) && !xwTwo.some((f) => f.includes("~")),
  xwTwo
);
check(
  "one-member: each entry's doc_path is distinct and holds its OWN id (F-156/F-188)",
  xwDocOf("rule-xw").toLowerCase() !== xwDocOf("Rule-XW").toLowerCase() &&
    xwBody("rule-xw").includes("re-xwriter/rule-xw") &&
    xwBody("Rule-XW").includes("re-xwriter/Rule-XW"),
  { lower: xwDocOf("rule-xw"), upper: xwDocOf("Rule-XW") }
);

// Pass 3 — the deep pass, a DIFFERENT writer, over both members in the same dir.
r = batch(["--domain", "re-xwriter", "--out-dir", XW_OUT, "--bin", FAKE, "--upgrade", "--command", DESCRIBE]);
const xwAfter = readdirSync(XW_OUT).sort();
check(
  "cross-writer: deep pass reuses both stub filenames — no orphan, no third file (F-156/F-188)",
  r.json?.documented === 2 && JSON.stringify(xwAfter) === JSON.stringify(xwTwo),
  { documented: r.json?.documented, xwTwo, xwAfter }
);
check(
  "cross-writer: both docs upgraded in place, each still holding its own id (F-156/F-188)",
  ["rule-xw", "Rule-XW"].every((id) => {
    const t = xwBody(id);
    return /Full describe doc/.test(t) && !/Metadata-only stub/.test(t) && t.includes(`re-xwriter/${id}`);
  }),
  { lower: xwDocOf("rule-xw"), upper: xwDocOf("Rule-XW") }
);

// ── F-165: a value-taking flag left as the LAST token has lost its value ─────
// The email-report gap-fill fences pass `--limit <budget>` last to this script
// as well as to manifest.mjs, so an empty placeholder substitution must not be
// read as "flag absent" — here that would silently swap the caller's budget for
// this script's default of 25 rather than failing.
{
  let r = batch(["--domain", "journey-email-templates", "--command", "noop", "--out-dir", ROOT, "--limit"]);
  check("trailing bare --limit rejected, not read as absent (F-165)", r.code === 1 && /--limit requires a value/.test(r.stderr), r);
  r = batch(["--domain", "journey-email-templates", "--command", "noop", "--out-dir"]);
  check("trailing bare --out-dir rejected too (opt-level guard, F-165)", r.code === 1 && /--out-dir requires a value/.test(r.stderr), r);

  // ── review-gate F-170: --limit 0 is a bounded no-op, matching mark's contract ─
  // The email-report fences feed one computed budget placeholder to BOTH scripts;
  // mark accepts 0, so a zero budget must not be a usage error here.
  // --bin kept for the eager-validation lane (F-119/F-150 stay up-front); the
  // environment-dependence F-191 saw here is gone since F-192 made no-bin
  // resolution lazy — the no-bin no-op is pinned separately below.
  r = batch(["--domain", "journey-email-templates", "--command", "gs-admin --json jo email template --id {id}", "--out-dir", ROOT, "--bin", FAKE, "--limit", "0"]);
  check("--limit 0 selects nothing at exit 0 (F-170)", r.code === 0 && r.json?.selected === 0 && r.json?.documented === 0, r);
  r = batch(["--domain", "journey-email-templates", "--command", "gs-admin --json jo email template --id {id}", "--out-dir", ROOT, "--limit", "-1"]);
  check("negative --limit still rejected (F-170)", r.code === 1 && /non-negative/.test(r.stderr), r);

  // ── review-gate F-171: duplicated flag with a bare trailing repeat fails ────
  r = batch(["--domain", "journey-email-templates", "--command", "noop", "--out-dir", ROOT, "--limit", "1", "--limit"]);
  check("valued --limit with a bare trailing repeat rejected (F-171)", r.code === 1 && /--limit requires a value/.test(r.stderr), r);
}

// ── F-192: CLI resolution is lazy — a bounded no-op exits 0 on EVERY OS ──────
// Without --bin, and with resolution forced to fail everywhere (PATH scrubbed,
// so `npm root -g` cannot run and no shim can be found), a --limit 0 no-op
// must still exit 0: resolution happens at the first real spawn, not at
// startup. Pre-F-192 this diverged — POSIX exited 0 via the unconditional
// bare-shim fallback while win32 fail-closed at module load — and the POSIX
// fallback now requires the shim to actually exist on PATH, so the eager
// mutant is red on every OS, not just Windows.
{
  const r = batch(
    ["--domain", "journey-email-templates", "--command", "gs-admin --json jo email template --id {id}", "--out-dir", ROOT, "--limit", "0"],
    { PATH: "", Path: "" }
  );
  check("no-bin --limit 0 no-op exits 0 with resolution unreachable (F-192)", r.code === 0 && r.json?.selected === 0 && r.json?.documented === 0, r);
}

// ── F-204: the ask-overrides read is BOM-tolerant ────────────────────────────
// A BOM'd ask-overrides.json (a Windows editor re-saving an INSTALLED plugin
// copy) must not silently no-op the override gate: the refusal must still be
// the override one, not the downstream verb-gate one. Runs a COPY of the
// script tree so the real hooks file is never touched; the override file is
// the SYNTHETIC list (the shipped one is empty since 1.0.8, and an empty list
// would make this pin vacuous); the BOM is built via fromCharCode so this
// file never carries invisible literals (the F-130 rule).
{
  const TREE = join(ROOT, "bom-tree");
  mkdirSync(join(TREE, "scripts"), { recursive: true });
  mkdirSync(join(TREE, "hooks"), { recursive: true });
  for (const f of ["describe-batch.mjs", "doc-lib.mjs"]) {
    writeFileSync(join(TREE, "scripts", f), readFileSync(join(SCRIPTS, f)));
  }
  writeFileSync(
    join(TREE, "hooks", "ask-overrides.json"),
    String.fromCharCode(0xfeff) + SYN_OVERRIDES
  );
  const res = spawnSync(
    process.execPath,
    [join(TREE, "scripts", "describe-batch.mjs"), "--manifest", M, "--domain", "re-sched", "--out-dir", join(ROOT, "bom-out"), "--bin", FAKE, "--command", "gs-admin --json re r schedule-basic --rule-id {id}"],
    { encoding: "utf8" }
  );
  check("BOM'd ask-overrides still refuses via the override gate (F-204)", res.status === 1 && /ask-override list/.test(res.stderr), { code: res.status, err: res.stderr.trim() });
}

// ── F-208(b): stripBom's negative contract, pinned at the unit level ─────────
// ── W9 (GP-B5 B13): designer doc-mode — three levels, spawn budget + resume ─
// Fixture shapes authored from the routed handler at CLI 1.0.8 and the live
// probe of 2026-09-02 (summary rows; the 14 `_task*` tables; `_taskFieldDetail`
// key/value rows; the "(MAX)" suffix; a duplicate label). Fictional values.
{
  const ddList = join(ROOT, "dd.json");
  writeFileSync(ddList, JSON.stringify({ data: [
    { templateId: "dd-1", name: "Acme Rollup" }, { templateId: "dd-2", name: "Acme Broken" }, { templateId: "dd-3", name: "Acme Field Only" },
    { templateId: "dd-4", name: "Acme Miscounted" }, { templateId: "dd-5", name: "Acme Scalar" }, { templateId: "dd-6", name: "Acme Fallback" },
  ] }));
  manifest("upsert-batch", ["--file", ddList, "--domain", "data-designer", "--id-field", "templateId", "--name-field", "name", "--describe-command", "gs-admin --json dd t describe --template-id {id}"]);
  const DD_OUT = join(ROOT, "acme-sbx", "data-designer");
  const FX = join(ROOT, "dd-fixture.json");
  const LOG = join(ROOT, "dd-log.txt");
  const detailRows = (kv) => Object.entries(kv).map(([k, v]) => ({ _key: k, _value: v }));
  const fx = {
    templates: {
      "dd-1": {
        name: "Acme Rollup",
        tasks: [
          { taskId: "t1", taskName: "Companies", taskType: "mdaExtract", _parents: "", _object: "company", _connType: "MDA", _fieldCount: 3, _filterCount: 0, _groupByCount: 0 },
          { taskId: "t2", taskName: "Merge", taskType: "join", _parents: "t1", _object: "", _connType: "MDA", _fieldCount: 2, _filterCount: 0, _groupByCount: 0 },
        ],
        details: {
          t1: { _taskDetailRows: detailRows({ "Task ID": "t1", Name: "Companies", Type: "mdaExtract", Parents: "—", Children: "t2", Source: "company (MDA)", "Show Fields": "3" }),
                _taskShowFields: [{ _index: 1, _field: "ARR (MAX)", _type: "NUMBER", _calc: "—" }, { _index: 2, _field: "Name", _type: "STRING", _calc: "—" }, { _index: 3, _field: "Name", _type: "STRING", _calc: "—" }] },
          t2: { _taskDetailRows: detailRows({ "Task ID": "t2", Name: "Merge", Type: "join", Parents: "t1", Children: "—", "Join Type": "LEFT", "Fields (t1)": "Companies: ARR, Name (2)" }),
                _taskJoinConditions: [{ _index: 1, _left: "Companies.Gsid", _op: "EQ", _right: "Companies.Gsid" }] },
        },
        fields: {
          t1: { ARR: detailRows({ "Display Name": "ARR", "Field Name": "Arr__gc", "Source Object": "company", Connection: "MDA", Aggregation: "MAX" }), Name: detailRows({ "Display Name": "Name", "Field Name": "Name", "Source Object": "company", Connection: "MDA" }) },
          t2: { ARR: detailRows({ "Display Name": "ARR", "Field Name": "Arr__gc" }), Name: detailRows({ "Display Name": "Name", "Field Name": "Name" }) },
        },
      },
      "dd-2": {
        name: "Acme Broken",
        tasks: [
          { taskId: "t1", taskName: "A", taskType: "mdaExtract", _parents: "", _object: "company", _connType: "MDA", _fieldCount: 1, _filterCount: 0, _groupByCount: 0 },
          { taskId: "t-fail", taskName: "B", taskType: "mdaExtract", _parents: "", _object: "gsuser", _connType: "MDA", _fieldCount: 1, _filterCount: 0, _groupByCount: 0 },
        ],
        details: { t1: { _taskShowFields: [{ _index: 1, _field: "Broken", _type: "STRING", _calc: "—" }] } },
        fields: { t1: {} },
      },
      // Every TASK drills fine; exactly one FIELD is refused by the CLI's
      // not-found sentence — a PERMANENT gap (review round): recorded, not
      // retried, not blocking (the field axis of "complete" is the RETRYABLE
      // failure only — mutation M18 covers that arm in doc-lib-fixtures).
      "dd-3": {
        name: "Acme Field Only",
        tasks: [{ taskId: "t1", taskName: "A", taskType: "mdaExtract", _parents: "", _object: "company", _connType: "MDA", _fieldCount: 2, _filterCount: 0, _groupByCount: 0 }],
        details: { t1: { _taskShowFields: [{ _index: 1, _field: "Fine", _type: "STRING", _calc: "—" }, { _index: 2, _field: "Broken", _type: "STRING", _calc: "—" }] } },
        fields: { t1: { Fine: detailRows({ "Display Name": "Fine", "Field Name": "Fine__gc" }) } },
      },
      // The template's own count disagrees with the readable task rows — the
      // task-row shape gate (review round).
      "dd-4": { name: "Acme Miscounted", taskCount: 3, tasks: [{ taskId: "t1", taskName: "A", taskType: "mdaExtract", _parents: "", _object: "company", _connType: "MDA", _fieldCount: 0, _filterCount: 0, _groupByCount: 0 }], details: { t1: {} }, fields: { t1: {} } },
      // A JSON scalar on stdout (the designer arm's own failure contract).
      "dd-5": { name: "Acme Scalar", scalar: "unauthorized", tasks: [], details: {}, fields: {} },
      // The spelling fallback: an UNKNOWN trailing group is a label until the
      // CLI refuses it, then the shape-stripped base is tried; a known suffix
      // is tried stripped first and whole on refusal.
      "dd-6": {
        name: "Acme Fallback",
        tasks: [{ taskId: "t1", taskName: "A", taskType: "mdaExtract", _parents: "", _object: "company", _connType: "MDA", _fieldCount: 3, _filterCount: 0, _groupByCount: 0 }],
        details: { t1: { _taskShowFields: [{ _index: 1, _field: "Growth (new_fn)", _type: "NUMBER", _calc: "ƒ" }, { _index: 2, _field: "Rollup (v2)", _type: "STRING", _calc: "—" }, { _index: 3, _field: "Total (SUM)", _type: "NUMBER", _calc: "—" }] } },
        fields: { t1: { Growth: detailRows({ "Display Name": "Growth", "Field Name": "Growth__gc" }), "Rollup (v2)": detailRows({ "Display Name": "Rollup (v2)", "Field Name": "Rollup_v2__gc" }), "Total (SUM)": detailRows({ "Display Name": "Total (SUM)", "Field Name": "Total__gc" }) } },
      },
    },
  };
  writeFileSync(FX, JSON.stringify(fx));
  const ENV = { FAKE_DD: FX, FAKE_DD_LOG: LOG };
  const dd = (args, env = {}) => batch(["--domain", "data-designer", "--out-dir", DD_OUT, "--bin", FAKE, ...args], { ...ENV, ...env });
  const argLines = () => (existsSync(LOG) ? readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  const resetLog = () => rmSync(LOG, { force: true });
  const fenceOf = (file) => { const t = readFileSync(join(DD_OUT, file), "utf8"); const m = /```json\n([\s\S]*?)\n```/.exec(t); return { text: t, payload: JSON.parse(m[1]) }; };
  const invOf = (key) => JSON.parse(readFileSync(M, "utf8")).inventory[key];
  const normKb = (kb) => JSON.stringify({ ...kb, capturedAt: null });

  // ── One-shot: dd-1 completes in one invocation ─────────────────────────
  resetLog();
  let r = dd(["--limit", "1"]);
  check("W9 one-shot: doc-mode auto-selected for data-designer; recorded describe-command used", r.code === 0 && r.json?.docMode === "designer" && r.json?.commandSource === "recorded", r);
  check("W9 one-shot: 1 documented; spawns = 1 template + 2 tasks + 4 fields (the duplicate label is ONE key); thisRun counts this run's item outcomes", r.json?.documented === 1 && r.json?.drilldowns?.spawnsUsed === 7 && r.json?.drilldowns?.spawns?.task === 2 && r.json?.drilldowns?.spawns?.field === 4 && r.json?.drilldowns?.thisRun?.tasksOk === 2 && r.json?.drilldowns?.thisRun?.fieldsOk === 4 && r.json?.drilldowns?.entries?.documented === 1 && r.json?.drilldowns?.budgetExhausted === false, r.json?.drilldowns);
  const oneShot = fenceOf("dd-1.md");
  const kb1 = oneShot.payload.data._kb;
  check("W9 one-shot: composite under data._kb — every task ok, every field ok, the aggregated label keyed STRIPPED with its suffix recorded, the duplicate counted on its key", kb1?.version === 1 && kb1.tasks.t1.status === "ok" && kb1.tasks.t2.status === "ok" && kb1.fields.t1.ARR?.status === "ok" && kb1.fields.t1.ARR.suffix === "MAX" && kb1.fields.t1.Name?.duplicates === 1 && !("ARR (MAX)" in kb1.fields.t1) && kb1.fields.t2.ARR?.source === "join", kb1);
  check("W9 one-shot: task tables and field detail rows stored verbatim; the template body keeps its summary rows and empty tables", kb1?.taskDetails?.t1?._taskShowFields?.length === 3 && kb1.fieldDetails.t1.ARR.some((x) => x._key === "Field Name" && x._value === "Arr__gc") && oneShot.payload.data._tasks.length === 2 && oneShot.payload.data._taskShowFields.length === 0, null);
  check("W9 one-shot: provenance line states the outcome, no INCOMPLETE", /^> Full describe doc \(designer doc-mode: template describe \+ task\/field drilldowns — 2\/2 task\(s\), 4\/4 field\(s\) drilled, 1 duplicate label\(s\)\) — generated by describe-batch\.mjs, captured /m.test(oneShot.text) && !/INCOMPLETE/.test(oneShot.text), oneShot.text.split("\n")[2]);
  const e1 = invOf("data-designer/dd-1");
  check("W9 one-shot: entry documented at depth full with doc_path + fingerprint", e1.status === "documented" && e1.depth === "full" && /dd-1\.md$/.test(e1.doc_path) && /^[0-9a-f]{40}$/.test(e1.fingerprint), e1);
  const calls = argLines();
  check("W9 one-shot: the drilldown argv = the recorded template's argv + literal `--task-id <t>` (+ `--field <label>`), the suffix STRIPPED for the field call and never sent whole", calls.some((a) => a.join(" ") === "--json dd t describe --template-id dd-1 --task-id t1") && calls.some((a) => a.join(" ") === "--json dd t describe --template-id dd-1 --task-id t1 --field ARR") && !calls.some((a) => a.includes("ARR (MAX)")), calls);
  check("W9 one-shot: the duplicate label is drilled ONCE", calls.filter((a) => a.join(" ").endsWith("--task-id t1 --field Name")).length === 1, calls);

  // ── --if-changed: a COMPLETE composite of the same content skips ───────
  r = dd(["--statuses", "documented", "--if-changed", "--limit", "1"]);
  check("W9 if-changed: complete composite + same fingerprint → skipped, no drilldown spawned", r.json?.skippedUnchanged === 1 && r.json?.drilldowns?.spawns?.task === 0, r.json);
  // …but a summary-only doc (earlier plugin version) documents normally.
  {
    const stripped = JSON.parse(JSON.stringify(oneShot.payload));
    delete stripped.data._kb;
    const fence = /```json\n([\s\S]*?)\n```/.exec(oneShot.text)[1];
    writeFileSync(join(DD_OUT, "dd-1.md"), oneShot.text.replace(fence, JSON.stringify(stripped, null, 2)));
  }
  check("W9 if-changed setup: summary-only doc written (no _kb)", !fenceOf("dd-1.md").payload.data._kb, null);
  r = dd(["--statuses", "documented", "--if-changed", "--limit", "1"]);
  check("W9 if-changed: a summary-only doc is NOT skipped — it upgrades to the composite", r.json?.skippedUnchanged === 0 && r.json?.documented === 1 && !!fenceOf("dd-1.md").payload.data._kb, r.json);

  // ── Budget + resume: cut after 3 spawns, finish on the next run ────────
  manifest("mark", ["--key", "data-designer/dd-1", "--status", "stale"]);
  rmSync(join(DD_OUT, "dd-1.md"), { force: true });
  resetLog();
  r = dd(["--limit", "1", "--spawn-budget", "3"]);
  const cut = fenceOf("dd-1.md");
  check("W9 budget: the run stops at the budget — nothing marked, entry still stale, budgetExhausted + moreRemaining true, 3 spawns", r.code === 0 && r.json?.documented === 0 && r.json?.drilldowns?.budgetExhausted === true && r.json?.moreRemaining === true && r.json?.drilldowns?.spawnsUsed === 3 && invOf("data-designer/dd-1").status === "stale", r.json);
  check("W9 budget: the partial doc is on disk and SAYS so — t1 ok, t2 pending, one field ok, provenance INCOMPLETE", cut.payload.data._kb.tasks.t1.status === "ok" && cut.payload.data._kb.tasks.t2.status === "pending" && Object.values(cut.payload.data._kb.fields.t1).filter((f) => f.status === "ok").length === 1 && /INCOMPLETE — resumes on the next describe-batch run/.test(cut.text), cut.text.split("\n")[2]);
  check("W9 budget: stderr progress line reports spawns used against the budget", /\(spawns 3\/3\)/.test(r.stderr), r.stderr);
  resetLog();
  r = dd(["--limit", "1"]);
  const resumed = fenceOf("dd-1.md");
  check("W9 resume: the next run resumes from the doc (resumedEntries 1), re-runs the template once, drills only what was missing (1 field + 1 task + 2 fields = 5 spawns), completes — and thisRun counts ONLY this run's items (1 task, 3 fields), not the composite's totals", r.json?.documented === 1 && r.json?.drilldowns?.resumedEntries === 1 && r.json?.drilldowns?.spawnsUsed === 5 && r.json?.drilldowns?.spawns?.template === 1 && r.json?.drilldowns?.thisRun?.tasksOk === 1 && r.json?.drilldowns?.thisRun?.fieldsOk === 3, r.json?.drilldowns);
  check("W9 resume: the resumed composite EQUALS the one-shot composite (modulo capturedAt) — the A-6 identity lock on resume", normKb(resumed.payload.data._kb) === normKb(kb1), { resumed: resumed.payload.data._kb, oneShot: kb1 });
  check("W9 resume: an already-ok field is never re-spawned", !argLines().some((a) => a.join(" ").endsWith("--task-id t1 --field ARR")), argLines());

  // ── Resume restarts when the template CONTENT changed under a partial doc ──
  manifest("mark", ["--key", "data-designer/dd-1", "--status", "stale"]);
  rmSync(join(DD_OUT, "dd-1.md"), { force: true });
  r = dd(["--limit", "1", "--spawn-budget", "3"]);
  check("W9 restart setup: partial doc on disk again", r.json?.drilldowns?.budgetExhausted === true && !!fenceOf("dd-1.md").payload.data._kb, r.json?.drilldowns);
  const fxChanged = JSON.parse(JSON.stringify(fx));
  fxChanged.templates["dd-1"].name = "Acme Rollup v2"; // content change, same task ids
  writeFileSync(FX, JSON.stringify(fxChanged));
  resetLog();
  r = dd(["--limit", "1"]);
  writeFileSync(FX, JSON.stringify(fx));
  check("W9 restart: a changed template fingerprint discards the partial composite — resumedEntries 0 and the full 7 spawns run again", r.json?.documented === 1 && r.json?.drilldowns?.resumedEntries === 0 && r.json?.drilldowns?.spawnsUsed === 7, r.json?.drilldowns);
  check("W9 restart: the rebuilt composite records the NEW fingerprint", fenceOf("dd-1.md").payload.data._kb.templateFingerprint === invOf("data-designer/dd-1").fingerprint && fenceOf("dd-1.md").payload.data._kb.templateFingerprint !== kb1.templateFingerprint, null);

  // ── Failures: retryable vs permanent, the task-count gate, a scalar payload, the spelling fallback ──
  resetLog();
  r = dd(["--limit", "9"]);
  const e2 = invOf("data-designer/dd-2");
  const broken = fenceOf("dd-2.md");
  check("W9 failure (retryable): dd-2's TASK drilldown failed on transport → entry marked failed naming the RETRYABLE count (the permanently refused field is not counted), doc_path recorded, doc on disk with both outcomes recorded", /1 of 3 drilldown\(s\) failed \(retryable\); doc kept/.test(e2.error) && e2.status === "failed" && /dd-2\.md$/.test(e2.doc_path) && broken.payload.data._kb.tasks["t-fail"].status === "failed" && /simulated drilldown failure/.test(broken.payload.data._kb.tasks["t-fail"].error) && broken.payload.data._kb.fields.t1.Broken.status === "failed" && broken.payload.data._kb.fields.t1.Broken.permanent === true, { e2, kb: broken.payload.data._kb });
  const e3 = invOf("data-designer/dd-3");
  const fieldOnly = fenceOf("dd-3.md");
  check("W9 failure (permanent): every task ok, ONE field refused by the CLI's not-found sentence → a recorded gap, entry DOCUMENTED, provenance names the unresolvable field and no INCOMPLETE", e3.status === "documented" && e3.depth === "full" && fieldOnly.payload.data._kb.fields.t1.Fine.status === "ok" && fieldOnly.payload.data._kb.fields.t1.Broken.status === "failed" && fieldOnly.payload.data._kb.fields.t1.Broken.permanent === true && /1 field\(s\) unresolvable by the CLI \(recorded gap\)/.test(fieldOnly.text) && !/INCOMPLETE/.test(fieldOnly.text), { e3, kb: fieldOnly.payload.data._kb });
  check("W9 failure (permanent): the refused label was tried ONCE (no alternate spelling exists for a bare label) and thisRun counts it as unresolvable", argLines().filter((a) => a.join(" ").endsWith("--field Broken")).length === 2 && r.json?.drilldowns?.thisRun?.fieldsUnresolvable === 2, { calls: argLines().filter((a) => a.includes("Broken")), thisRun: r.json?.drilldowns?.thisRun });
  const e4 = invOf("data-designer/dd-4");
  check("W9 gate: a template whose _taskCount disagrees with the readable task ids is marked failed BEFORE any drilldown, naming both numbers and the re-derivation home", e4.status === "failed" && /_taskCount 3 but 1 task id\(s\)/.test(e4.error) && /MAINTAINERS\.md/.test(e4.error) && !argLines().some((a) => a.includes("--template-id") && a.includes("dd-4") && a.includes("--task-id")), e4);
  const e5 = invOf("data-designer/dd-5");
  check("W9 gate: a JSON scalar on stdout marks THAT entry failed and the batch continues (no crash, summary emitted)", r.code === 0 && e5.status === "failed" && /not a JSON object/.test(e5.error) && !existsSync(join(DD_OUT, "dd-5.md")), e5);
  const e6 = invOf("data-designer/dd-6");
  const fb = fenceOf("dd-6.md");
  const dd6calls = argLines().filter((a) => a.includes("dd-6") && a.includes("--field")).map((a) => a[a.indexOf("--field") + 1]);
  check("W9 fallback: an UNKNOWN trailing group is tried whole first, then shape-stripped on the not-found refusal; the resolved spelling is recorded", e6.status === "documented" && isDeepStrictEqual(dd6calls.slice(0, 2), ["Growth (new_fn)", "Growth"]) && fb.payload.data._kb.fields.t1["Growth (new_fn)"].status === "ok" && fb.payload.data._kb.fields.t1["Growth (new_fn)"].spelling === "Growth", { dd6calls, f: fb.payload.data._kb.fields.t1 });
  check("W9 fallback: a label whose own parenthesis resolves whole is never stripped; a known suffix is tried stripped first and whole on refusal", isDeepStrictEqual(dd6calls.slice(2), ["Rollup (v2)", "Total", "Total (SUM)"]) && fb.payload.data._kb.fields.t1["Rollup (v2)"].spelling === undefined && fb.payload.data._kb.fields.t1.Total.status === "ok" && fb.payload.data._kb.fields.t1.Total.spelling === "Total (SUM)", { dd6calls, f: fb.payload.data._kb.fields.t1 });
  check("W9 failure: the batch continued past the failures and the queue re-offers the retryable ones", r.json?.moreRemaining === true && r.json?.failed === 3, r.json);
  resetLog();
  r = dd(["--limit", "9"]);
  check("W9 failure: the retry resumes dd-2 (fingerprint unchanged), re-spawns ONLY its retryable item (template + 1 task) and SKIPS the permanent field; dd-4/dd-5 fail again at their gates without drilldowns", r.json?.drilldowns?.resumedEntries === 1 && r.json?.drilldowns?.thisRun?.fieldsSkippedUnresolvable === 1 && argLines().filter((a) => a.includes("--task-id")).length === 1 && r.json?.failed === 3, { drilldowns: r.json?.drilldowns, calls: argLines() });

  // ── Refusals ───────────────────────────────────────────────────────────
  r = batch(["--domain", "rules-engine-rules", "--out-dir", OUT, "--bin", FAKE, "--command", DESCRIBE, "--spawn-budget", "5"]);
  check("W9 refusal: --spawn-budget outside designer mode", r.code === 1 && /applies only to the designer doc-mode/.test(r.stderr), r.stderr);
  r = dd(["--spawn-budget", "1"]);
  check("W9 refusal: --spawn-budget floor is 2 (a budget of 1 could never advance an entry)", r.code === 1 && /at least 2/.test(r.stderr), r.stderr);
  const catPath = join(ROOT, ".gs-superadmin", "catalog.json");
  const catBackup = readFileSync(catPath, "utf8");
  const cat = JSON.parse(catBackup);
  cat.commands.find((c) => c.path === "data-designer templates describe").flags = [{ flag: "--template-id" }, { flag: "--task-id" }];
  writeFileSync(catPath, JSON.stringify(cat));
  resetLog();
  r = dd(["--limit", "1"]);
  writeFileSync(catPath, catBackup);
  check("W9 refusal: the resolved command must declare the drilldown flags — a catalog without --field refuses BEFORE any spawn, pointing at the SHIPPED re-derivation home", r.code === 1 && /declare --field/.test(r.stderr) && /MAINTAINERS\.md "Designer drilldown grammar"/.test(r.stderr) && !/dev\/VALIDATION/.test(r.stderr) && argLines().length === 0, r.stderr);
  check("W9 refusal: --doc-mode raw still writes the summary-only doc for data-designer (the pre-W9 shape, no _kb)", (() => { manifest("mark", ["--key", "data-designer/dd-1", "--status", "stale"]); const rr = dd(["--limit", "1", "--doc-mode", "raw"]); return rr.json?.docMode === "raw" && rr.json?.documented === 1 && !fenceOf("dd-1.md").payload.data._kb && rr.json?.drilldowns === undefined; })(), null);
  // The mode is keyed on the RESOLVED command, not the domain slug (review
  // round): any domain whose describe resolves to `dd t describe` is designer.
  const otherList = join(ROOT, "designs-x.json");
  writeFileSync(otherList, JSON.stringify({ data: [{ templateId: "dd-1", name: "Acme Rollup" }] }));
  manifest("upsert-batch", ["--file", otherList, "--domain", "designs-x", "--id-field", "templateId", "--name-field", "name"]);
  r = batch(["--domain", "designs-x", "--out-dir", join(ROOT, "acme-sbx", "designs-x"), "--bin", FAKE, "--command", "gs-admin --json dd t describe --template-id {id}"], ENV);
  check("W9 mode: a domain NOT named data-designer whose command resolves to `dd t describe` still gets the designer doc-mode", r.json?.docMode === "designer" && r.json?.documented === 1 && !!fenceOf(join("..", "designs-x", "dd-1.md")).payload.data._kb, r.json);
}

// "Exactly one leading U+FEFF, never a global strip" — the global-regex mutant
// used to leave every suite green. Direct unit on the shared doc-lib copy; the
// guard hook's self-contained copies are pinned by guard-fixtures.
{
  const { stripBom } = await import(pathToFileURL(join(SCRIPTS, "doc-lib.mjs")).href);
  const BOM = String.fromCharCode(0xfeff);
  check("doc-lib stripBom: strips one leading BOM (F-208)", stripBom(BOM + "a") === "a", JSON.stringify(stripBom(BOM + "a")));
  check("doc-lib stripBom: keeps interior BOMs — never a global strip (F-208)", stripBom(BOM + "a" + BOM + "b") === "a" + BOM + "b", null);
  check("doc-lib stripBom: strips only ONE leading BOM (F-208)", stripBom(BOM + BOM + "a") === BOM + "a", null);
}

// ── The corpus tenet, held for the drilldown reader (F-390 round 2 observation):
// "the fixture a suite passes on IS the fixture the tracer measures". The W9
// block above drives its own inline fake and payloads (they model failure arms
// the corpus fake does not); this block drives the SAME fake the reader-shape
// tracer spawns — test/fixtures/fake-dd-cli.mjs over DESIGNER_DRILLDOWN — through
// the real script, so the corpus entry is exercised by a shipped-behaviour suite
// and the two fakes cannot drift apart unnoticed on the shape that matters.
{
  const { DESIGNER_DRILLDOWN: DD } = await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "reader-payloads.mjs")).href);
  const FAKE_DD_CLI = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "fake-dd-cli.mjs");
  const corpusList = join(ROOT, "dd-corpus.json");
  writeFileSync(corpusList, JSON.stringify({ data: [{ templateId: DD.templateId, name: DD.template.data.name }] }));
  manifest("upsert-batch", ["--file", corpusList, "--domain", "data-designer-corpus", "--id-field", "templateId", "--name-field", "name"]);
  const CORPUS_OUT = join(ROOT, "acme-sbx", "data-designer-corpus");
  const r = batch(["--domain", "data-designer-corpus", "--out-dir", CORPUS_OUT, "--bin", FAKE_DD_CLI, "--command", "gs-admin --json dd t describe --template-id {id}"]);
  check("corpus tenet: the tracer's fake CLI + DESIGNER_DRILLDOWN drive the real designer doc-mode to a complete composite", r.code === 0 && r.json?.docMode === "designer" && r.json?.documented === 1 && r.json?.drilldowns?.budgetExhausted === false, r);
  const docText = readFileSync(join(CORPUS_OUT, `${DD.templateId}.md`), "utf8");
  const fence = docText.split("```json")[1]?.split("```")[0] ?? "";
  let kb = null;
  try { kb = JSON.parse(fence).data._kb; } catch { /* asserted below */ }
  const taskIds = Object.keys(DD.tasks);
  const fieldCount = Object.values(DD.fields).reduce((a, m) => a + Object.keys(m).length, 0);
  check("corpus tenet: every corpus task and field landed in the composite (_kb.taskDetails / fieldDetails keyed as the corpus is)",
    !!kb && taskIds.every((t) => kb.tasks?.[t]?.status === "ok" && kb.taskDetails?.[t]?._taskShowFields) && Object.entries(DD.fields).every(([t, m]) => Object.keys(m).every((f) => Array.isArray(kb.fieldDetails?.[t]?.[f]))), { tasks: kb?.tasks, fields: kb?.fields });
  check("corpus tenet: the provenance line counts the corpus's tasks and fields",
    new RegExp(`${taskIds.length}/${taskIds.length} task\\(s\\), ${fieldCount}/${fieldCount} field\\(s\\) drilled`).test(docText), docText.split("\n")[2]);
}

rmSync(ROOT, { recursive: true, force: true });
console.log(failures ? `\n${failures} check(s) failed` : "\nAll describe-batch checks passed");
process.exit(failures ? 1 : 0);
