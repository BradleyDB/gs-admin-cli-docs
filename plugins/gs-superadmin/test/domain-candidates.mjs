#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// domain-candidates.mjs (test) — tests for scripts/domain-candidates.mjs, the
// F-108 candidate gate.
//
// Covers: the candidate filter (mutating / required-flag / cliHidden /
// non-list-shaped commands dropped; the summary-"List" prong catching
// candidates whose actionKey is not list-*), listCommand resolution (namespace
// alias spellings, valued global flags, trailing per-command flags), the
// excluded / undecided split, suggested names + the name-collision flag, the
// legacy-domain (no listCommand) arm of --require-decided, gate pass/fail exit
// codes, retired-exclusion and contradiction warnings, and the check verb's
// GLOBAL overlap test — including the arrangement that motivated it: rows
// whose apparent namespace has no domain but whose ids are already indexed
// under a DIFFERENT domain (list-rest-connections vs connectors), and the
// loud failure on an id field that resolves nowhere (the nested
// pnpConnectionsInfo trap). Fixtures live under the OS temp dir; no real
// state, no gs-admin invocation.
//
// Run:  node plugins/gs-superadmin/test/domain-candidates.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { makeCommandResolver, CLI_PIN_FACTS } from "../scripts/doc-lib.mjs";

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts");
const CANDIDATES = join(SCRIPTS, "domain-candidates.mjs");
const MANIFEST_SCRIPT = join(SCRIPTS, "manifest.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-domain-candidates-${process.pid}`);
rmSync(ROOT, { recursive: true, force: true });
// The workspace marker dir: domain-candidates resolves the catalog by walking
// up from the manifest dir to the first .gs-superadmin (same as describe-batch).
mkdirSync(join(ROOT, ".gs-superadmin"), { recursive: true });
mkdirSync(join(ROOT, "acme-sbx"), { recursive: true });

function run(script, args) {
  const res = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch { /* non-JSON output (failure path) */ }
  return { code: res.status, json, stderr: res.stderr.trim() };
}
const diff = (args = []) => run(CANDIDATES, ["diff", "--manifest", M, ...args]);
const check = (args) => run(CANDIDATES, ["check", "--manifest", M, ...args]);
const manifest = (verb, args) => run(MANIFEST_SCRIPT, [verb, "--manifest", M, ...args]);

let failures = 0;
function checkThat(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)}`);
  }
}

// ── Fixture catalog (fictional acme-style tenant; synthetic command set) ─────
const cmd = (path, shortPath, domain, name, actionKey, summary, extra = {}) => ({
  id: `${domain}:${actionKey}`,
  lane: "artifact",
  domain,
  path,
  shortPath,
  name,
  actionKey,
  summary,
  mutating: false,
  cliHidden: false,
  flags: [],
  ...extra,
});
const catalog = {
  meta: { cliVersion: "9.9.9" },
  globalFlags: [{ flag: "--json" }, { flag: "--output <format>" }],
  domains: [
    { namespace: "connectors", aliases: ["cn"] },
    { namespace: "rules-engine", aliases: ["re"] },
    { namespace: "scorecard", aliases: ["sc"] },
  ],
  commands: [
    // candidates (6)
    cmd("connectors list", "cn list", "connectors", "list", "list-connectors", "List all connections"),
    cmd("connectors jobs", "cn jobs", "connectors", "jobs", "list-jobs", "List connector jobs"),
    cmd("connectors widgets", "cn widgets", "connectors", "widgets", "list-widgets", "List widgets"),
    cmd(
      "rules-engine rules list-rest-connections",
      "re r list-rest-connections",
      "rules-engine",
      "list-rest-connections",
      "list-rest-connections",
      "List REST connections"
    ),
    cmd("scorecard scheme list", "sc sch list", "scorecard", "list", "list-schemes", "List scoring schemes"),
    // summary prong: actionKey is NOT list-*, the summary's first word is "List"
    cmd("rules-engine rules topics", "re r topics", "rules-engine", "topics", "topics", "List Events Framework topics"),
    // F-219 shape: a per-asset sublist whose required flag the CLI enforces at
    // runtime but the catalog does NOT declare — passes the tenantWide prong,
    // must surface flagged likelyPerAsset rather than silently dropped
    cmd("rules-engine rules executions", "re r executions", "rules-engine", "executions", "executions", "List execution history for a rule"),
    // F-226 shape: a required flag with a SMALL declared enum — runnable
    // tenant-wide in one invocation per value, so it must stay a candidate,
    // carrying the requiredEnumFlags marker
    cmd("rules-engine rules sources", "re r sources", "rules-engine", "sources", "list-source-objects", "List source objects by connection type", {
      flags: [{ name: "type", flag: "--type", required: true, cliExposed: true, enum: ["MDA", "SFDC"] }],
    }),
    // F-226 non-fire: an enum flag PLUS a required per-asset id — still not
    // runnable tenant-wide, still dropped
    cmd("rules-engine rules task-fields", "re r task-fields", "rules-engine", "task-fields", "list-task-fields", "List task fields", {
      flags: [
        { name: "type", flag: "--type", required: true, cliExposed: true, enum: ["MDA", "SFDC"] },
        { name: "ruleId", flag: "--rule-id", required: true, cliExposed: true, enum: null },
      ],
    }),
    // non-candidates
    cmd("rules-engine rules create", "re r create", "rules-engine", "create", "create-rule", "Create a rule", {
      mutating: true,
    }),
    cmd(
      "rules-engine rules list-task-outputs",
      "re r list-task-outputs",
      "rules-engine",
      "list-task-outputs",
      "list-task-outputs",
      "List a rule's task outputs",
      { flags: [{ flag: "--rule-id", required: true, cliExposed: true }] }
    ),
    cmd("connectors hidden", "cn hidden", "connectors", "hidden", "list-hidden-things", "List hidden things", {
      cliHidden: true,
    }),
    cmd("rules-engine rules describe", "re r describe", "rules-engine", "describe", "describe-rule", "Describe a rule"),
  ],
};
writeFileSync(join(ROOT, ".gs-superadmin", "catalog.json"), JSON.stringify(catalog, null, 2));

const M = join(ROOT, "acme-sbx", "_manifest.json");
manifest("init", ["--slug", "acme-sbx", "--base-url", "https://acme.example"]);

// Index connectors: nested connection-shaped rows, listCommand recorded with a
// valued GLOBAL flag and the namespace ALIAS spelling — resolution must skip
// the flag value and substitute the alias.
const cnRows = { data: [1, 2, 3, 4].map((n) => ({ pnpConnectionsInfo: { connectionId: `c-${n}`, name: `Conn ${n}` } })) };
const cnFile = join(ROOT, "cn-list.json");
writeFileSync(cnFile, JSON.stringify(cnRows));
let r = manifest("upsert-batch", [
  "--file", cnFile,
  "--domain", "connectors",
  "--id-field", "pnpConnectionsInfo.connectionId",
  "--name-field", "pnpConnectionsInfo.name",
  "--no-date-field",
  "--items-path", "data",
  "--list-command", "gs-admin --output json cn list",
]);
checkThat("fixture: connectors upsert succeeds with nested id field", r.code === 0 && r.json?.added === 4, r);

// ── F-450 b: the per-pin CLI facts — not-enumerable-bare sublists ─────────────
// A second workspace whose catalog is AT the stamped pin and carries the four
// real `re rules` sublists (real ids; the catalog declares no required flag on
// any of them — the upstream declaration gap) plus the real `dd sources
// fields` (declares --type[enum], keeps its requiredEnumFlags path). The
// shipped table must bucket the four WITHOUT any tenant record, keep the gate
// off them, report a tenant record written against one as inert, and keep an
// indexed domain visible when the table contradicts it.
{
  const R2 = join(ROOT, "pin");
  mkdirSync(join(R2, ".gs-superadmin"), { recursive: true });
  mkdirSync(join(R2, "acme-pin"), { recursive: true });
  const real = (path, shortPath, id, actionKey, summary, extra = {}) =>
    cmd(path, shortPath, path.split(" ")[0], path.split(" ").pop(), actionKey, summary, { id, ...extra });
  const catalogPin = {
    ...catalog,
    meta: { cliVersion: CLI_PIN_FACTS.cliVersion },
    commands: [
      // the synthetic F-219 executions command (a made-up id) gives way to the
      // real-id one below — one command per path, as in a real catalog
      ...catalog.commands.filter((c) => c.path !== "rules-engine rules executions"),
      real("rules-engine rules events", "re r events", "rules-engine:rules:events", "events", "List Events Framework events for a topic"),
      real("rules-engine rules executions", "re r executions", "rules-engine:rules:executions", "list-rule-executions", "List execution history for a rule"),
      real("rules-engine rules s3-tasks", "re r s3-tasks", "rules-engine:rules:s3-tasks", "s3-tasks", "List a rule's S3 tasks"),
      real("rules-engine rules schedules", "re r schedules", "rules-engine:rules:schedules", "list-rule-schedules", "List schedules for a rule"),
      real("data-designer sources fields", "dd sources fields", "data-designer:sources:fields", "list-source-fields", "List fields of a source object", {
        flags: [{ name: "type", flag: "--type", required: true, cliExposed: true, enum: ["MDA", "SFDC"] }],
      }),
    ],
    domains: [...catalog.domains, { namespace: "data-designer", aliases: ["dd"] }],
  };
  writeFileSync(join(R2, ".gs-superadmin", "catalog.json"), JSON.stringify(catalogPin, null, 2));
  const M2 = join(R2, "acme-pin", "_manifest.json");
  const diff2 = (args = []) => run(CANDIDATES, ["diff", "--manifest", M2, ...args]);
  const manifest2 = (verb, args) => run(MANIFEST_SCRIPT, [verb, "--manifest", M2, ...args]);
  manifest2("init", ["--slug", "acme-pin", "--base-url", "https://acme.example"]);
  const FOUR = ["rules-engine rules events", "rules-engine rules executions", "rules-engine rules s3-tasks", "rules-engine rules schedules"];
  let d = diff2(["--require-decided"]);
  const neb = d.json?.notEnumerableBare ?? [];
  const undec = (d.json?.undecided ?? []).map((u) => u.path);
  checkThat("pin: the table applies — pinFacts.applied true, stamped = catalog version", d.json?.pinFacts?.applied === true && d.json?.pinFacts?.catalogVersion === CLI_PIN_FACTS.cliVersion, d.json?.pinFacts);
  checkThat("pin: the four re rules sublists read notEnumerableBare with NO tenant record — needs + the runtime error, tenantRecord null", neb.length === 4 && JSON.stringify(neb.map((n) => n.path)) === JSON.stringify(FOUR) && neb.every((n) => typeof n.needs === "string" && n.needs.startsWith("--") && typeof n.error === "string" && n.tenantRecord === null && typeof n.summary === "string"), neb);
  checkThat("pin: none of the four is undecided, and the gate's stderr names none of them (they never gate)", FOUR.every((p) => !undec.includes(p)) && !/re r (events|executions|s3-tasks|schedules)/.test(d.stderr) && d.json?.notEnumerableBareCount === 4, { undec, stderr: d.stderr });
  checkThat("pin: candidateCount still counts the universe — the bucket is part of it", d.json?.candidateCount === d.json.indexedCount + d.json.excludedCount + d.json.blockedCount + d.json.undecidedCount + d.json.notEnumerableBareCount, d.json);
  const ddf = (d.json?.undecided ?? []).find((u) => u.path === "data-designer sources fields");
  checkThat("pin: the enum pair keeps its requiredEnumFlags path — dd sources fields is undecided carrying --type over MDA|SFDC, not bucketed", ddf != null && ddf.requiredEnumFlags?.[0]?.flag === "--type" && !neb.some((n) => n.path === "data-designer sources fields"), ddf);
  // A tenant record against a bucketed command (the pre-table route) is INERT:
  // reported on the entry and in a warning, dropped from the decisions in force.
  manifest2("exclude", ["--command", "rules-engine rules events", "--reason", "Per-topic sublist: hard-fails bare", "--no-check", "--topic is required"]);
  manifest2("block", ["--command", "rules-engine rules s3-tasks", "--reason", "server error x3", "--recheck-after", "2099-01-01"]);
  d = diff2(["--require-decided"]);
  const byPath = Object.fromEntries((d.json?.notEnumerableBare ?? []).map((n) => [n.path, n]));
  checkThat("pin: an exclusion recorded against a bucketed command reads tenantRecord 'excluded', is not in excluded[] and not counted", byPath["rules-engine rules events"]?.tenantRecord === "excluded" && !(d.json?.excluded ?? []).some((e) => e.path === "rules-engine rules events") && d.json?.excludedCount === 0 && d.json?.excludedLegacyCount === 0, { entry: byPath["rules-engine rules events"], excluded: d.json?.excluded });
  checkThat("pin: a block recorded against a bucketed command reads tenantRecord 'blocked', is not in blocked[] and the gate does not report it as blocked", byPath["rules-engine rules s3-tasks"]?.tenantRecord === "blocked" && !(d.json?.blocked ?? []).some((b) => b.path === "rules-engine rules s3-tasks") && d.json?.blockedCount === 0 && !/BLOCKED candidate/.test(d.stderr), { entry: byPath["rules-engine rules s3-tasks"], stderr: d.stderr });
  checkThat("pin: each inert record draws ONE warning naming the record kind, the flag needed and the lift verb", (d.json?.warnings ?? []).filter((w) => /is excluded per tenant, but at CLI .* not enumerable bare .*--topic.*exclude --remove/.test(w)).length === 1 && (d.json?.warnings ?? []).filter((w) => /is blocked per tenant, but .*block --remove/.test(w)).length === 1, d.json?.warnings);
  // Review round: a contradictory manifest (a hand edit — the verbs refuse to
  // write both) is still named whatever bucket the command lands in: the
  // pairwise contradiction checks run BEFORE the per-pin bucket.
  {
    const m = JSON.parse(readFileSync(M2, "utf8"));
    m.domains_blocked["rules-engine rules events"] = { reason: "server error x3", decidedAt: "2026-09-01T00:00:00.000Z" };
    writeFileSync(M2, JSON.stringify(m, null, 2));
    const dd = diff2();
    checkThat("pin: a bucketed command carrying BOTH an exclusion and a block still draws the excluded+blocked contradiction warning (never hidden by the bucket)", (dd.json?.warnings ?? []).some((w) => /"rules-engine rules events" is both excluded and blocked — contradictory/.test(w)) && (dd.json?.notEnumerableBare ?? []).find((n) => n.path === "rules-engine rules events")?.tenantRecord === "excluded", dd.json?.warnings);
    delete m.domains_blocked["rules-engine rules events"];
    writeFileSync(M2, JSON.stringify(m, null, 2));
  }
  // The table contradicted by the manifest: a domain INDEXED from a bucketed
  // command stays visible as indexed, with a warning — never hidden.
  const evFile = join(R2, "events.json");
  writeFileSync(evFile, JSON.stringify({ data: [{ id: "e-1", name: "Evt" }] }));
  manifest2("upsert-batch", ["--file", evFile, "--domain", "rules-engine-events", "--id-field", "id", "--name-field", "name", "--no-date-field", "--items-path", "data", "--list-command", "gs-admin --json re r events --topic t1"]);
  d = diff2();
  checkThat("pin: a domain indexed from a bucketed command is reported as indexed (never hidden) with a warning naming the contradiction", (d.json?.indexed ?? []).some((i) => i.path === "rules-engine rules events" && i.domains.includes("rules-engine-events")) && !(d.json?.notEnumerableBare ?? []).some((n) => n.path === "rules-engine rules events") && (d.json?.warnings ?? []).some((w) => /is indexed .* but the per-pin table says it is not enumerable bare/.test(w)), { indexed: d.json?.indexed, warnings: d.json?.warnings });
}

// ── F-450: the shipped per-pin table holds against the BUNDLED catalog ────────
// Every id must exist at the pin; a notEnumerableBare entry the catalog has
// started to DECLARE (a required CLI-exposed flag) is dead and must go — the
// filter would drop the command on its own; a scope entry must be a list
// command. The version stamp itself is check-stale-facts' tripwire.
{
  const bundled = JSON.parse(readFileSync(join(SCRIPTS, "..", "reference", "catalog.json"), "utf8"));
  const byId = new Map((bundled.commands ?? []).map((c) => [c.id, c]));
  checkThat("pin table: stamped for the bundled catalog's cliVersion", CLI_PIN_FACTS.cliVersion === bundled.meta?.cliVersion, { table: CLI_PIN_FACTS.cliVersion, bundled: bundled.meta?.cliVersion });
  for (const [id, fact] of Object.entries(CLI_PIN_FACTS.commands)) {
    const c = byId.get(id);
    checkThat(`pin table: ${id} exists in the bundled catalog`, c != null, id);
    if (!c) continue;
    if (fact.notEnumerableBare)
      checkThat(`pin table: ${id} still declares no required CLI flag — the entry is live, not dead`, !(c.flags ?? []).some((f) => f.required && f.cliExposed !== false), c.flags);
    if (fact.scope)
      checkThat(`pin table: ${id} is a list-shaped command`, /^list(-|$)/.test(c.actionKey ?? "") || /^List\b/.test(c.summary ?? ""), { actionKey: c.actionKey, summary: c.summary });
  }
}

// ── diff: filter + statuses ──────────────────────────────────────────────────
r = diff();
checkThat("diff: candidate universe is exactly the 8 list-shaped tenant-wide commands", r.json?.candidateCount === 8, r.json);
// F-450 b: this catalog is at a synthetic pin, so the shipped per-pin table is
// NOT applied — the diff says so (pinFacts + a warning naming the stamp) and
// the bucket is empty; the F-219 sublist below stays an ordinary undecided
// candidate under a pin the table does not know.
checkThat(
  "diff: under a catalog at another pin the per-pin table is not applied — pinFacts.applied false, a warning names the stamp, notEnumerableBare empty (F-450 b)",
  r.json?.pinFacts?.applied === false && r.json?.pinFacts?.stamped === CLI_PIN_FACTS.cliVersion && r.json?.pinFacts?.catalogVersion === "9.9.9" &&
    (r.json?.warnings ?? []).some((w) => w.includes(`stamped for ${CLI_PIN_FACTS.cliVersion}`)) && r.json?.notEnumerableBareCount === 0 && Array.isArray(r.json?.notEnumerableBare),
  { pinFacts: r.json?.pinFacts, warnings: r.json?.warnings }
);
const undecidedPaths = (r.json?.undecided ?? []).map((u) => u.path);
checkThat(
  "diff: mutating / required-flag / hidden / describe commands are not candidates",
  !JSON.stringify(r.json).includes("rules create") &&
    !undecidedPaths.includes("rules-engine rules list-task-outputs") &&
    !undecidedPaths.includes("connectors hidden") &&
    !undecidedPaths.includes("rules-engine rules describe"),
  undecidedPaths
);
// F-226: the enum-flag command IS posed, carrying the marker; the ordinary
// candidate carries null; the enum+per-asset-id mix stays dropped
const srcCand = (r.json?.undecided ?? []).find((u) => u.path === "rules-engine rules sources");
checkThat(
  "diff: small-enum required-flag command stays a candidate with requiredEnumFlags (F-226)",
  srcCand != null &&
    Array.isArray(srcCand.requiredEnumFlags) &&
    srcCand.requiredEnumFlags.length === 1 &&
    srcCand.requiredEnumFlags[0].flag === "--type" &&
    JSON.stringify(srcCand.requiredEnumFlags[0].values) === JSON.stringify(["MDA", "SFDC"]),
  srcCand
);
checkThat(
  "diff: ordinary candidates carry requiredEnumFlags null; enum+id mix is still dropped (F-226)",
  (r.json?.undecided ?? []).find((u) => u.path === "rules-engine rules topics")?.requiredEnumFlags === null &&
    !undecidedPaths.includes("rules-engine rules task-fields"),
  undecidedPaths
);
checkThat(
  "diff: alias + valued-global-flag listCommand resolves to the canonical command",
  (r.json?.indexed ?? []).some((i) => i.path === "connectors list" && i.domains.includes("connectors")),
  r.json?.indexed
);
checkThat(
  "diff: summary-\"List\" prong surfaces a candidate whose actionKey is not list-*",
  undecidedPaths.includes("rules-engine rules topics"),
  undecidedPaths
);
const schemes = (r.json?.undecided ?? []).find((u) => u.path === "scorecard scheme list");
checkThat(
  "diff: suggested name strips the list- prefix and prefixes the namespace",
  schemes?.suggestedName === "scorecard-schemes" && schemes?.nameCollision === false,
  schemes
);
const topics = (r.json?.undecided ?? []).find((u) => u.path === "rules-engine rules topics");
checkThat("diff: summary-prong candidate suggestion uses the bare actionKey", topics?.suggestedName === "rules-engine-topics", topics);
// F-219: runtime-required sublist surfaces flagged, never silently dropped
const execs = (r.json?.undecided ?? []).find((u) => u.path === "rules-engine rules executions");
checkThat(
  "diff: undeclared-required per-asset sublist surfaces with likelyPerAsset true (F-219)",
  execs?.likelyPerAsset === true,
  execs
);
checkThat(
  "diff: ordinary tenant-wide candidates carry likelyPerAsset false (F-219 non-fire)",
  topics?.likelyPerAsset === false && (r.json?.undecided ?? []).find((u) => u.path === "scorecard scheme list")?.likelyPerAsset === false,
  { topics, schemes: (r.json?.undecided ?? []).find((u) => u.path === "scorecard scheme list") }
);
r = diff(["--require-decided"]);
checkThat("diff: --require-decided exits 1 while candidates are undecided", r.code === 1 && /undecided/.test(r.stderr), {
  code: r.code,
  stderr: r.stderr,
});

// ── exclusions ───────────────────────────────────────────────────────────────
r = manifest("exclude", ["--command", "rules-engine rules list-rest-connections", "--reason", "subsumed by the connectors domain", "--no-check", "fixture: decided without a capture"]);
checkThat("exclude: records a decision", r.code === 0 && r.json?.ok === true && r.json?.updated === false, r);
r = diff();
const excl = (r.json?.excluded ?? []).find((e) => e.path === "rules-engine rules list-rest-connections");
checkThat("diff: excluded candidate carries its reason and decidedAt", excl?.reason === "subsumed by the connectors domain" && typeof excl?.decidedAt === "string", excl);
checkThat(
  "diff: an exclusion recorded with --no-check reads kind no-check, carrying noCheck and null evidence/coveredBy (F-449)",
  excl?.kind === "no-check" && excl?.noCheck === "fixture: decided without a capture" && excl?.evidence === null && excl?.coveredBy === null && excl?.recheckAfter === null && excl?.recheckDue === false,
  excl
);
checkThat("diff: excluded candidate is no longer undecided", !(r.json?.undecided ?? []).some((u) => u.path === "rules-engine rules list-rest-connections"), r.json?.undecided);

// ── legacy domain (no listCommand) arms the gate + name collision ────────────
const jobsFile = join(ROOT, "cn-jobs.json");
writeFileSync(jobsFile, JSON.stringify({ data: [{ jobId: "j-1" }, { jobId: "j-2" }] }));
manifest("upsert-batch", ["--file", jobsFile, "--domain", "connectors-jobs", "--id-field", "jobId", "--no-date-field", "--items-path", "data"]);
r = diff();
checkThat("diff: domain indexed without listCommand reads as legacy", (r.json?.legacyDomains ?? []).includes("connectors-jobs"), r.json?.legacyDomains);
const jobsCand = (r.json?.undecided ?? []).find((u) => u.path === "connectors jobs");
checkThat(
  "diff: undecided suggestion colliding with an existing domain name is flagged",
  jobsCand?.suggestedName === "connectors-jobs" && jobsCand?.nameCollision === true,
  jobsCand
);
r = diff(["--require-decided"]);
checkThat("diff: --require-decided also fails on legacy domains, naming the backfill", r.code === 1 && /listCommand/.test(r.stderr) && /connectors-jobs/.test(r.stderr), {
  code: r.code,
  stderr: r.stderr,
});

// Backfill the legacy domain (trailing per-command flag exercises prefix match),
// then verify carry-forward keeps the recording on a flagless re-upsert.
manifest("upsert-batch", ["--file", jobsFile, "--domain", "connectors-jobs", "--id-field", "jobId", "--items-path", "data", "--list-command", "gs-admin --json cn jobs --limit 500"]);
manifest("upsert-batch", ["--file", jobsFile, "--domain", "connectors-jobs", "--id-field", "jobId", "--items-path", "data"]);
r = manifest("report", []);
checkThat(
  "upsert: listCommand recording carries forward when the flag is omitted",
  r.json?.domains_indexed?.["connectors-jobs"]?.listCommand === "gs-admin --json cn jobs --limit 500",
  r.json?.domains_indexed?.["connectors-jobs"]
);
r = diff();
checkThat("diff: backfilled domain leaves the legacy list and maps to its candidate", (r.json?.legacyDomains ?? []).length === 0 && (r.json?.indexed ?? []).some((i) => i.path === "connectors jobs"), r.json);

// ── decide the rest; the gate must then pass ─────────────────────────────────
const schemesFile = join(ROOT, "sc-schemes.json");
writeFileSync(schemesFile, JSON.stringify({ data: [{ schemeId: "s-1" }, { schemeId: "s-2" }] }));
manifest("upsert-batch", ["--file", schemesFile, "--domain", "scorecard-schemes", "--id-field", "schemeId", "--no-date-field", "--items-path", "data", "--list-command", "gs-admin --json sc sch list"]);
manifest("exclude", ["--command", "rules-engine rules topics", "--reason", "reference data - platform topic registry, not tenant-owned assets", "--no-check", "fixture"]);
manifest("exclude", ["--command", "connectors widgets", "--reason", "organizational containers with no dependency surface", "--no-check", "fixture"]);
manifest("exclude", ["--command", "rules-engine rules executions", "--reason", "per-asset sublist - runtime error 'ruleId or ruleName is required'", "--no-check", "fixture"]);
manifest("exclude", ["--command", "rules-engine rules sources", "--reason", "source schema reference lists - not tenant-owned assets", "--no-check", "fixture"]);
r = diff(["--require-decided"]);
checkThat("diff: gate passes once every candidate is decided and no domain is legacy", r.code === 0 && r.json?.undecidedCount === 0, {
  code: r.code,
  undecided: r.json?.undecided,
  legacy: r.json?.legacyDomains,
});

// ── warnings: retired exclusion + contradiction ──────────────────────────────
{
  const raw = JSON.parse(readFileSync(M, "utf8"));
  raw.domains_excluded["ghost namespace gone-list"] = { reason: "was excluded on an older CLI", decidedAt: "2020-01-01T00:00:00.000Z" };
  // contradiction: exclude a command that is also indexed
  raw.domains_excluded["connectors list"] = { reason: "contradiction fixture", decidedAt: "2020-01-01T00:00:00.000Z" };
  writeFileSync(M, JSON.stringify(raw, null, 2));
}
r = diff();
checkThat(
  "diff: exclusion not in the catalog warns TYPO-first, record kept (F-227)",
  (r.json?.warnings ?? []).some((w) => w.includes("ghost namespace gone-list") && /TYPO'D PATH/.test(w) && /retired or renamed/.test(w) && !w.includes("nearest candidate")),
  r.json?.warnings
);
checkThat("diff: indexed+excluded contradiction is reported", (r.json?.warnings ?? []).some((w) => w.includes("connectors list") && w.includes("contradictory")), r.json?.warnings);
// F-227: a NEAR-typo'd key earns the edit-distance suggestion naming the real
// candidate — the pre-fix warning misdiagnosed exactly this as an upstream
// rename, inviting a second phantom decision.
{
  const raw = JSON.parse(readFileSync(M, "utf8"));
  raw.domains_excluded["connectors wigets"] = { reason: "typo fixture", decidedAt: "2020-01-01T00:00:00.000Z" };
  writeFileSync(M, JSON.stringify(raw, null, 2));
}
r = diff();
checkThat(
  "diff: near-typo'd excluded key suggests the nearest candidate by edit distance (F-227)",
  (r.json?.warnings ?? []).some((w) => w.includes("connectors wigets") && w.includes('nearest candidate: "connectors widgets"')),
  r.json?.warnings
);
{
  const raw = JSON.parse(readFileSync(M, "utf8"));
  delete raw.domains_excluded["connectors wigets"];
  writeFileSync(M, JSON.stringify(raw, null, 2));
}
// F-226: an exclude recorded against a catalog command OUTSIDE the candidate
// universe used to sit silently inert — the candidate loop never visits the
// path. It must warn by name now.
{
  const raw = JSON.parse(readFileSync(M, "utf8"));
  raw.domains_excluded["rules-engine rules list-task-outputs"] = { reason: "inert fixture", decidedAt: "2020-01-01T00:00:00.000Z" };
  writeFileSync(M, JSON.stringify(raw, null, 2));
}
r = diff();
checkThat(
  "diff: exclude against a filtered-out path warns INERT instead of sitting silent (F-226)",
  (r.json?.warnings ?? []).some((w) => w.includes("rules-engine rules list-task-outputs") && w.includes("INERT")),
  r.json?.warnings
);
{
  const raw = JSON.parse(readFileSync(M, "utf8"));
  delete raw.domains_excluded["rules-engine rules list-task-outputs"];
  writeFileSync(M, JSON.stringify(raw, null, 2));
}
{
  // undo the contradiction fixture so later checks see a clean manifest
  const raw = JSON.parse(readFileSync(M, "utf8"));
  delete raw.domains_excluded["connectors list"];
  writeFileSync(M, JSON.stringify(raw, null, 2));
}

// ── F-218: the blocked state — "could not evaluate" satisfies the gate but
// never goes quiet. Re-enact the live PV-6 arrangement: a candidate whose list
// command fails server-side (re r topics was one of the two real ones).
manifest("exclude", ["--command", "rules-engine rules topics", "--remove"]);
r = manifest("block", ["--command", "rules-engine rules topics", "--reason", "Server Error Occurred - deterministic across 3 attempts, distinct request IDs"]);
checkThat("block: records a could-not-evaluate state", r.code === 0 && r.json?.ok === true, r);
r = diff();
const blk = (r.json?.blocked ?? []).find((b) => b.path === "rules-engine rules topics");
checkThat(
  "diff: blocked candidate surfaces BY NAME with reason and full identification (F-218)",
  r.json?.blockedCount === 1 &&
    /Server Error/.test(blk?.reason ?? "") &&
    typeof blk?.decidedAt === "string" &&
    blk?.suggestedName === "rules-engine-topics" &&
    blk?.recheckAfter === null &&
    blk?.recheckDue === false,
  blk
);
checkThat("diff: blocked candidate is neither undecided nor excluded", !(r.json?.undecided ?? []).some((u) => u.path === "rules-engine rules topics") && !(r.json?.excluded ?? []).some((e) => e.path === "rules-engine rules topics"), r.json);
r = diff(["--require-decided"]);
checkThat(
  "diff: --require-decided PASSES with a blocked candidate, naming it on stderr (F-218)",
  r.code === 0 && /BLOCKED/.test(r.stderr) && /re r topics/.test(r.stderr),
  { code: r.code, stderr: r.stderr }
);
// re-check date in the past → warning, still passing
manifest("block", ["--command", "rules-engine rules topics", "--reason", "still failing", "--recheck-after", "2020-01-01"]);
r = diff(["--require-decided"]);
const topicsBlk = (r.json?.blocked ?? []).find((b) => b.path === "rules-engine rules topics");
checkThat(
  "diff: passed re-check date flags recheckDue and warns, gate still passes",
  r.code === 0 && topicsBlk?.recheckDue === true && (r.json?.warnings ?? []).some((w) => w.includes("re-check date") && w.includes("re r topics")),
  { code: r.code, blk: topicsBlk, warnings: r.json?.warnings }
);
// a later round that CAN look decides it — the exclude lifts the block
r = manifest("exclude", ["--command", "rules-engine rules topics", "--reason", "reference data - platform topic registry, not tenant-owned assets", "--no-check", "fixture", "--recheck-after", "2020-01-01"]);
checkThat("exclude: deciding a blocked candidate lifts the block (blockLifted)", r.code === 0 && r.json?.blockLifted === true, r);
r = diff(["--require-decided"]);
const topicsExcl = (r.json?.excluded ?? []).find((e) => e.path === "rules-engine rules topics");
checkThat(
  "diff: an exclusion past its re-check date flags recheckDue and warns by name, gate still passes (F-449)",
  r.code === 0 && topicsExcl?.recheckAfter === "2020-01-01" && topicsExcl?.recheckDue === true && (r.json?.warnings ?? []).some((w) => w.includes("excluded candidate") && w.includes("re-check date") && w.includes("re r topics")),
  { code: r.code, excl: topicsExcl, warnings: r.json?.warnings }
);
r = diff();
checkThat("diff: decided candidate leaves blocked and reads excluded", r.json?.blockedCount === 0 && (r.json?.excluded ?? []).some((e) => e.path === "rules-engine rules topics"), r.json);
// stale block (command retired from the catalog) warns, record kept
{
  const raw = JSON.parse(readFileSync(M, "utf8"));
  (raw.domains_blocked ??= {})["ghost namespace gone-list"] = { reason: "was blocked on an older CLI", decidedAt: "2020-01-01T00:00:00.000Z" };
  writeFileSync(M, JSON.stringify(raw, null, 2));
}
r = diff();
checkThat(
  "diff: block not in the catalog warns TYPO-first with its own lift remediation (F-227/F-239)",
  (r.json?.warnings ?? []).some((w) => w.includes("ghost namespace gone-list") && /TYPO'D PATH/.test(w) && w.includes("block --remove")),
  r.json?.warnings
);
{
  const raw = JSON.parse(readFileSync(M, "utf8"));
  delete raw.domains_blocked["ghost namespace gone-list"];
  writeFileSync(M, JSON.stringify(raw, null, 2));
}

// ── check: the GLOBAL overlap test ───────────────────────────────────────────
// The motivating arrangement: rows whose APPARENT namespace (rules-engine) has
// no matching domain, but whose ids are all already indexed under a DIFFERENT
// domain (connectors). A per-apparent-domain implementation returns 0 here —
// these assertions are the mutation tripwire for that regression.
const restFile = join(ROOT, "re-rest-connections.json");
writeFileSync(restFile, JSON.stringify({ data: [1, 2, 3, 4].map((n) => ({ pnpConnectionsInfo: { connectionId: `c-${n}` } })) }));
r = check(["--file", restFile, "--id-field", "pnpConnectionsInfo.connectionId", "--items-path", "data"]);
checkThat(
  "check: rows indexed under a DIFFERENT domain are found (global test, not per-domain)",
  r.code === 0 && r.json?.alreadyIndexed === 4 && r.json?.allIndexed === true && r.json?.matchedByDomain?.connectors === 4,
  r.json
);
// ── F-449: check --out is the evidence file exclude --check reads ────────────
// The verdict is bound to the numbers this run measured: the file is the
// printed JSON byte-for-byte, and the exclude verb copies its numbers into the
// ledger entry — never a re-typed count.
const restCheck = join(ROOT, "check-rest.json");
r = check(["--file", restFile, "--id-field", "pnpConnectionsInfo.connectionId", "--items-path", "data", "--out", restCheck]);
checkThat("check --out: refused without --command — the evidence file names the candidate it measured", r.code === 1 && /--out requires --command/.test(r.stderr), r);
r = check(["--file", restFile, "--id-field", "pnpConnectionsInfo.connectionId", "--items-path", "data", "--command", "gs-admin --json re r list-rest-connections", "--out", restCheck]);
checkThat("check --command: a full command line is refused — canonical path only", r.code === 1 && /canonical command path/.test(r.stderr), r);
r = check(["--file", restFile, "--id-field", "pnpConnectionsInfo.connectionId", "--items-path", "data", "--command", "rules-engine rules list-rest-connections", "--out", restCheck]);
checkThat("check --out: writes the printed JSON to the file, stamped with command and checkedAt", r.code === 0 && r.json?.command === "rules-engine rules list-rest-connections" && typeof r.json?.checkedAt === "string" && JSON.stringify(JSON.parse(readFileSync(restCheck, "utf8"))) === JSON.stringify(r.json), { stdout: r.json });
r = check(["--file", restFile, "--id-field", "pnpConnectionsInfo.connectionId", "--items-path", "data"]);
checkThat("check: without --command the printed command is null (no file, no binding needed)", r.code === 0 && r.json?.command === null, r.json);
r = manifest("exclude", ["--command", "rules-engine rules list-rest-connections", "--reason", "filtered view of the connectors domain", "--check", restCheck]);
checkThat("exclude: a check proving coverage is refused without --covered-by (F-449)", r.code === 1 && /--covered-by connectors/.test(r.stderr), r);
r = manifest("exclude", ["--command", "rules-engine rules list-rest-connections", "--reason", "filtered view of the connectors domain", "--check", restCheck, "--covered-by", "connectors"]);
checkThat("exclude: --covered-by connectors accepted on 4 of 4 (kind coverage)", r.code === 0 && r.json?.kind === "coverage" && r.json?.updated === true, r);
r = diff();
const covExcl = (r.json?.excluded ?? []).find((e) => e.path === "rules-engine rules list-rest-connections");
checkThat(
  "diff: a coverage exclusion reads kind coverage with coveredBy and the check's evidence, noCheck null",
  covExcl?.kind === "coverage" && covExcl?.coveredBy === "connectors" && covExcl?.evidence?.uniqueIds === 4 && covExcl?.evidence?.alreadyIndexed === 4 && covExcl?.evidence?.matchedByDomain?.connectors === 4 && covExcl?.noCheck === null,
  covExcl
);
{
  // A pre-F-449 entry (neither evidence nor noCheck) is tolerated and named
  // legacy — readers never guess its kind from the prose.
  const raw = JSON.parse(readFileSync(M, "utf8"));
  raw.domains_excluded["rules-engine rules list-rest-connections"] = { reason: "subsumed by the connectors domain", decidedAt: "2020-01-01T00:00:00.000Z" };
  writeFileSync(M, JSON.stringify(raw, null, 2));
}
r = diff();
const legacyExcl = (r.json?.excluded ?? []).find((e) => e.path === "rules-engine rules list-rest-connections");
checkThat("diff: a pre-evidence exclusion reads kind legacy (evidence, noCheck, coveredBy all null) and is counted", legacyExcl?.kind === "legacy" && legacyExcl?.evidence === null && legacyExcl?.noCheck === null && legacyExcl?.coveredBy === null && r.json?.excludedLegacyCount === 1, legacyExcl);
manifest("exclude", ["--command", "rules-engine rules list-rest-connections", "--reason", "filtered view of the connectors domain", "--check", restCheck, "--covered-by", "connectors"]);
r = check(["--file", restFile, "--id-field", "id", "--items-path", "data"]);
checkThat("check: id field resolving to no value on every row fails loudly, naming the nested shape", r.code === 1 && /pnpConnectionsInfo/.test(r.stderr), {
  code: r.code,
  stderr: r.stderr,
});
// F-388: the FLAT connection row a CLI 1.0.9 `cn list` emits (v2 duct — the
// five fields at top level, no pnpConnectionsInfo key; DERIVED from the package
// source, not captured). The id VALUES do not move, so flat rows keyed by the
// flat path are found already indexed under the connectors domain that was
// indexed by the nested path — a re-key is a path change, not an identity
// change (audit-1.0.9 §1.11 mitigation b). The stale nested path on flat rows
// fails loudly, and the message names BOTH paths with the CLI version each
// belongs to — the operator's next step is in the error, not in a guess.
const flatFile = join(ROOT, "cn-list-1-0-9.json");
writeFileSync(
  flatFile,
  JSON.stringify({ data: [1, 2, 3, 4].map((n) => ({ connectionId: `c-${n}`, connectionName: `Conn ${n}`, connectionType: "S3", connectionStatus: "AUTHORIZED", authorizationType: "ACCESS_KEY" })) })
);
r = check(["--file", flatFile, "--id-field", "connectionId", "--items-path", "data"]);
checkThat(
  "check (F-388): flat 1.0.9 rows keyed by the top-level connectionId are found already indexed under the nested-keyed connectors domain (same id values, different dot-path)",
  r.code === 0 && r.json?.alreadyIndexed === 4 && r.json?.allIndexed === true && r.json?.matchedByDomain?.connectors === 4,
  r.json
);
r = check(["--file", flatFile, "--id-field", "pnpConnectionsInfo.connectionId", "--items-path", "data"]);
checkThat(
  "check (F-388): the recorded NESTED path on flat rows fails loudly, naming both paths and the CLI version each belongs to",
  r.code === 1 && /pnpConnectionsInfo\.connectionId/.test(r.stderr) && /top-level connectionId/.test(r.stderr) && /1\.0\.8/.test(r.stderr) && /1\.0\.9/.test(r.stderr) && /installed CLI/.test(r.stderr),
  { code: r.code, stderr: r.stderr }
);
// F-391 (negative pin): rules-shaped rows with a typo'd id path get the
// domain-neutral sentence — the connection-shape hint is noise there. The
// check verb has no --domain, so the rows alone decide (the two arms above
// are the positive pins: nested rows, and flat rows carrying connectionId).
const rulesFile = join(ROOT, "re-rules.json");
writeFileSync(rulesFile, JSON.stringify({ data: [1, 2].map((n) => ({ ruleId: `r-${n}`, ruleName: `Rule ${n}` })) }));
r = check(["--file", rulesFile, "--id-field", "ruleID", "--items-path", "data"]);
checkThat(
  "check (F-391): a typo'd id path on rules-shaped rows fails with the NEUTRAL sentence, without the connection-shape hint",
  r.code === 1 && /--id-field ruleID resolves to no value on any of the 2 row\(s\)/.test(r.stderr) && /an id path must name a key the rows actually carry/.test(r.stderr) && /installed CLI actually emits/.test(r.stderr) && !/pnpConnectionsInfo/.test(r.stderr),
  { code: r.code, stderr: r.stderr }
);
const partialFile = join(ROOT, "partial.json");
writeFileSync(
  partialFile,
  JSON.stringify({ data: [{ id: "c-1" }, { id: "c-2" }, { id: "c-3" }, { id: "MDA" }, { id: "S3" }, { id: "DESIGN_TEMPLATE" }] })
);
r = check(["--file", partialFile, "--id-field", "id", "--items-path", "data"]);
checkThat("check: partial overlap reports exact counts, neither all nor none", r.json?.alreadyIndexed === 3 && r.json?.allIndexed === false && r.json?.noneIndexed === false && r.json?.uniqueIds === 6, r.json);
// F-216: the id field resolving on only SOME rows is the same failure as it
// resolving on none, one level down — the verdict would cover the resolvable
// subset only. The arrangement below is the one that bites: the 2 rows that DO
// resolve are both already indexed, so an unguarded run reports allIndexed and
// Phase 4's rule turns that into a PERMANENT exclusion over the 8 rows nobody
// tested. These two assertions are the mutation tripwire for that regression.
const mixedFile = join(ROOT, "mixed-shape.json");
writeFileSync(
  mixedFile,
  JSON.stringify({
    data: [
      { pnpConnectionsInfo: { connectionId: "c-1" } },
      { pnpConnectionsInfo: { connectionId: "c-2" } },
      ...Array.from({ length: 8 }, (_, n) => ({ configId: `ext-${n}`, name: `external action ${n}` })),
    ],
  })
);
r = check(["--file", mixedFile, "--id-field", "pnpConnectionsInfo.connectionId", "--items-path", "data"]);
checkThat(
  "check: id field resolving on only SOME rows fails rather than answering over the subset (F-216)",
  r.code === 1 && /only 2 of 10 rows/.test(r.stderr) && /8 unresolved/.test(r.stderr),
  { code: r.code, stderr: r.stderr }
);
r = check(["--file", mixedFile, "--id-field", "pnpConnectionsInfo.connectionId", "--items-path", "data", "--allow-partial"]);
checkThat(
  "check: --allow-partial answers but WITHHOLDS allIndexed/noneIndexed (F-216)",
  r.code === 0 &&
    r.json?.rows === 10 &&
    r.json?.idsExtracted === 2 &&
    r.json?.unresolvedRows === 8 &&
    r.json?.partial === true &&
    r.json?.allIndexed === null &&
    r.json?.noneIndexed === null &&
    r.json?.alreadyIndexed === 2 &&
    r.json?.warnings?.length === 1,
  r.json
);
// A fully-resolving payload keeps the flags — the guard must not fire on the
// ordinary case (an all-rows-resolve run is the one Phase 4 decides from).
r = check(["--file", restFile, "--id-field", "pnpConnectionsInfo.connectionId", "--items-path", "data"]);
checkThat(
  "check: a fully-resolving payload reports unresolvedRows 0 and keeps the flags (F-216)",
  r.code === 0 && r.json?.unresolvedRows === 0 && r.json?.partial === false && r.json?.allIndexed === true,
  r.json
);
const freshFile = join(ROOT, "fresh.json");
writeFileSync(freshFile, JSON.stringify({ data: [{ id: "x-1" }, { id: "x-2" }] }));
const freshCheck = join(ROOT, "check-fresh.json");
r = check(["--file", freshFile, "--id-field", "id", "--items-path", "data", "--command", "connectors widgets", "--out", freshCheck]);
checkThat("check: 0-of-N rows indexed anywhere reads noneIndexed", r.json?.alreadyIndexed === 0 && r.json?.noneIndexed === true && r.json?.allIndexed === false, r.json);
r = manifest("exclude", ["--command", "connectors widgets", "--reason", "covered by connectors", "--check", freshCheck, "--covered-by", "connectors"]);
checkThat("exclude: --covered-by on a 0-of-2 check is refused end-to-end through the real check file (F-449)", r.code === 1 && /NOT covered by connectors/.test(r.stderr) && /0 of 2/.test(r.stderr), r);
r = manifest("exclude", ["--command", "connectors jobs", "--reason", "x", "--check", freshCheck]);
checkThat("exclude: the real check file passed for a different candidate is refused (measured connectors widgets)", r.code === 1 && /measured "connectors widgets", not "connectors jobs"/.test(r.stderr), r);
// ── F-224: zero-row honesty — the pre-fix hardwired allowEmpty=true turned a
// typo'd --items-path into rows:0 + a confident `noneIndexed: true` at exit 0,
// and setup Phase 4 maps noneIndexed to the ADOPT branch: a permanent ledger
// decision over a payload the script never read. These assertions are the
// mutation tripwire for that regression.
const typoFile = join(ROOT, "typo-path.json");
writeFileSync(typoFile, JSON.stringify({ data: { items: [{ id: "c-1" }, { id: "c-2" }] } }));
r = check(["--file", typoFile, "--id-field", "id", "--items-path", "data.itmes"]);
checkThat(
  "check: typo'd --items-path fails loudly instead of reading as an empty list (F-224)",
  r.code === 1 && /--allow-empty/.test(r.stderr) && /typo'd --items-path/.test(r.stderr),
  { code: r.code, stderr: r.stderr }
);
const errFile = join(ROOT, "error-body.json");
writeFileSync(errFile, JSON.stringify({ error: { code: 500, message: "Server Error Occurred" } }));
r = check(["--file", errFile, "--id-field", "id"]);
checkThat("check: captured error-wrapper body fails loudly without --allow-empty (F-224)", r.code === 1 && /--allow-empty/.test(r.stderr), {
  code: r.code,
  stderr: r.stderr,
});
r = check(["--file", errFile, "--id-field", "id", "--allow-empty"]);
checkThat(
  "check: --allow-empty answers 0 rows but WITHHOLDS the decision flags, warning loudly (F-224)",
  r.code === 0 && r.json?.rows === 0 && r.json?.allIndexed === null && r.json?.noneIndexed === null &&
    r.json?.warnings?.some((w) => /0 rows extracted/.test(w) && /withheld/.test(w)),
  r.json
);
// A REAL empty array at the given path resolves without --allow-empty (it IS
// an array) — but the flags are withheld all the same: 0 rows answer nothing.
const emptyFile = join(ROOT, "empty.json");
writeFileSync(emptyFile, JSON.stringify({ data: [] }));
r = check(["--file", emptyFile, "--id-field", "id", "--items-path", "data"]);
checkThat(
  "check: genuinely empty array reports rows 0 with flags withheld, not a vacuous noneIndexed (F-224)",
  r.code === 0 && r.json?.rows === 0 && r.json?.noneIndexed === null && r.json?.allIndexed === null,
  r.json
);

// ── F-225: prototype-member domain in a pre-fix manifest folds safely ────────
// matchedByDomain is an accumulator keyed by manifest domain names; on a {}
// literal, a domain named "constructor" reads the inherited Object function at
// the `?? 0` and the count degrades to a string. The fold is null-prototype
// now — this pins the own-key numeric result.
{
  const raw = JSON.parse(readFileSync(M, "utf8"));
  raw.inventory["constructor/k-9"] = { id: "k-9", name: "Legacy Proto", domain: "constructor", status: "pending" };
  writeFileSync(M, JSON.stringify(raw, null, 2));
}
const protoIdFile = join(ROOT, "proto-id.json");
writeFileSync(protoIdFile, JSON.stringify({ data: [{ id: "k-9" }] }));
r = check(["--file", protoIdFile, "--id-field", "id", "--items-path", "data"]);
checkThat(
  "check: prototype-member domain folds as an OWN key with a numeric count (F-225)",
  r.code === 0 && r.json?.alreadyIndexed === 1 && Object.hasOwn(r.json?.matchedByDomain ?? {}, "constructor") && r.json.matchedByDomain.constructor === 1,
  r.json
);
{
  const raw = JSON.parse(readFileSync(M, "utf8"));
  delete raw.inventory["constructor/k-9"];
  writeFileSync(M, JSON.stringify(raw, null, 2));
}

// ── F-232: shared resolver table ─────────────────────────────────────────────
// domain-candidates.mjs (listCommand matching) and describe-batch.mjs (the
// fail-closed read-only gate) both import doc-lib's makeCommandResolver, so
// they resolve identically by construction; this table locks the ONE
// implementation's behavior — alias substitution, valued-global-flag skip,
// trailing-flag neutralization by longest-prefix, launcher-suffixed program
// word (F-120), unknown → null.
{
  const resolver = makeCommandResolver(catalog);
  const TABLE = [
    ["gs-admin --output json cn list", "connectors list"],
    ["gs-admin --json connectors list", "connectors list"],
    ["gs-admin --json cn jobs --limit 500", "connectors jobs"],
    // MIXED spelling — alias namespace + canonical remainder — is neither a
    // path nor a shortPath in the catalog: only the alias substitution can
    // resolve it (the load-bearing row for that rule; every plain alias
    // spelling above also exists as a shortPath and would resolve without it)
    ["gs-admin --json re rules list-rest-connections", "rules-engine rules list-rest-connections"],
    ["GS-Admin.CMD --json sc sch list", "scorecard scheme list"],
    ["gs-admin --json nope nothing", null],
  ];
  for (const [line, want] of TABLE) {
    const got = resolver.resolveLine(line)?.path ?? null;
    checkThat(`resolver table: "${line}" → ${want ?? "null"} (F-232)`, got === want, { line, want, got });
  }
}

// ── flag hygiene ─────────────────────────────────────────────────────────────
r = run(CANDIDATES, ["diff", "--manifest"]);
checkThat("opt: trailing valueless flag fails rather than falling back", r.code === 1 && /requires a value/.test(r.stderr), r);
r = run(CANDIDATES, ["bogus", "--manifest", M]);
checkThat("verb: unknown verb fails with usage", r.code === 1 && /usage/.test(r.stderr), r);

rmSync(ROOT, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILURE(S)` : "\nall domain-candidates checks passed");
process.exit(failures ? 1 : 0);
