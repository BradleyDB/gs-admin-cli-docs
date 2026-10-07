#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// contract-conformance.mjs — EXECUTES the frozen contracts against produced
// artifacts (GP-B5 DS-18 build note; promoted per the review-gate rule after
// this probe class caught the v2 contract defects: enumerate real keys and
// nullability instead of trusting prose).
//
//   T-2 (scripts/manifest.mjs header): drive the manifest verbs in a temp
//   workspace and assert key presence/nullability on the file they write —
//   environment/last_refresh present-and-nullable from init, the stamp's
//   always-present-nullable itemsPath/describeCommand/listCommand (v2 delta 2),
//   dateField's tri-state (string / null / ABSENT — never null-for-unknown),
//   crawl_mode (not `crawl` — v2 delta 1), GsExclusion/GsBlock shapes with
//   decidedAt and the conditional recheckAfter, inventory-entry key sets, and
//   the legacy bare-ISO-string stamp a reader must tolerate (v2 delta 10).
//
//   T-1 (build/extract-catalog.mjs header): key-set conformance on the BUNDLED
//   plugin catalog (reference/catalog.json) — the artifact the guard and setup
//   actually consume. (build/test-extract-catalog.mjs runs the same
//   conformance on the committed repo catalog and a generated fixture one.)
//
//   T-3 (scripts/doc-lib.mjs header, GP-B5 DS-13): the stub-marker string
//   contract executed through the real parser — the LITERAL back-compat
//   value pin, the marker-is-the-signal control, and the line-anchoring
//   negative. (The writer→parser round trip through the real stub verb
//   lives in test/jo-report.mjs; test/doc-lib-fixtures.mjs pins the
//   exported constants directly.)
//
//   T-4 (scripts/journal-lib.mjs header, GP-B5 DS-15): the journal entry
//   grammar executed through BOTH real writers (guard hook PostToolUse,
//   journal.mjs journal-append) — frame uniformity, exact per-writer field
//   sequences, kind literals, ticket placement, and the label-subset
//   closure of "no other fields exist".
//
//   T-10 (scripts/engagement.mjs header, ENG-1): the engagement snapshot,
//   executed through the real producer over the fictional acme tenant (the
//   fake CLI behind --bin) — every table's key set, the conditional step
//   tables, the enums, the three tracking states, the schemaVersion refusal,
//   the additive health facts (HLT-1: the failure count on every send row, the
//   five health tables and their part-by-part marker) — and the same pins over
//   the committed fixture snapshot.
//
//   T-11 (scripts/dashboard-spec.mjs header, DSH-1): the dashboard spec,
//   executed through its one writer (draft, set, save in a throwaway KB of
//   the fictional acme tenant) — every object's key set, the enums, the two
//   presets' defaults, the version refusal — and the same pins over the
//   committed fixture spec.
//
// The two observed-vs-typedef discrepancies this suite's probes found were
// adjudicated as CONTRACT v3 (B2, 2026-08-16, Bradley-approved in-session):
// endpoint entries carry {name, method, path}, and `char` is
// artifact-lane-only. The pins below assert them as contract.
//
// Run:  node plugins/gs-superadmin/test/contract-conformance.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
import { parseJourneyDoc } from "../scripts/jo-report.mjs";
import { STUB_MARKER } from "../scripts/doc-lib.mjs";
import { isDeepStrictEqual } from "node:util";
import { openSnapshot, accountAvailability, healthAvailability, T10_SCHEMA_VERSION } from "../scripts/engagement-query.mjs";
import { kbFiles, FIXTURE_BOUNCE_CATEGORIES } from "./fixtures/engagement/acme-tenant.mjs";
import { openSpec, T11_SCHEMA_VERSION } from "../scripts/dashboard-spec.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_SCRIPT = join(HERE, "..", "scripts", "manifest.mjs");
const BUNDLED_CATALOG = join(HERE, "..", "reference", "catalog.json");

let failures = 0;
let passed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; return; }
  failures++;
  console.log(`FAIL  ${label}`);
  if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// ── T-2 · _manifest.json, executed through the single writer ─────────────────
const dir = makeTempDir("contract-conformance");
try {
  const M = join(dir, "acme-prod", "_manifest.json");
  const readM = () => JSON.parse(readFileSync(M, "utf8"));
  const verb = (v, args) => runNode(MANIFEST_SCRIPT, [v, "--manifest", M, ...args]);

  // init: nullable fields are PRESENT from birth (freeze deltas 1–2).
  let r = verb("init", ["--slug", "acme-prod", "--base-url", "https://acme.gainsightcloud.com"]);
  check("init exits 0", r.status === 0, r.stderr);
  let m = readM();
  check("T-2: slug + baseUrl recorded", m.slug === "acme-prod" && m.baseUrl === "https://acme.gainsightcloud.com");
  check("T-2: environment PRESENT and null when not stated at init", "environment" in m && m.environment === null);
  check("T-2: last_refresh PRESENT and null from init", "last_refresh" in m && m.last_refresh === null);
  check("T-2: created is ISO", typeof m.created === "string" && ISO.test(m.created));
  check("T-2: inventory map present from init", m.inventory && typeof m.inventory === "object");
  const T2_TOP_KEYS = new Set([
    "slug", "baseUrl", "environment", "created", "last_refresh", "inventory",
    "domains_indexed", "domains_excluded", "domains_blocked", "crawl_mode",
  ]);
  check("T-2: no top-level key outside the typedef", Object.keys(m).every((k) => T2_TOP_KEYS.has(k)), Object.keys(m));

  // upsert-batch, minimal flags: the stamp's three command/path keys are
  // ALWAYS-PRESENT NULLABLE (v2 delta 2), dateField ABSENT for unknown (never
  // null-for-unknown — the tri-state's third state).
  writeFiles(dir, {
    "templates.json": JSON.stringify({ emailTemplates: [
      { templateId: "t-1", title: "Welcome A", modifiedDate: "2026-01-05T00:00:00.000Z" },
      { templateId: "t-2", title: "Welcome B", modifiedDate: null },
    ] }),
    "rules.json": JSON.stringify([{ id: "r-1", name: "Rule One" }]),
  });
  r = verb("upsert-batch", ["--file", join(dir, "templates.json"), "--domain", "journey-email-templates", "--id-field", "templateId", "--name-field", "title"]);
  check("upsert-batch (minimal flags) exits 0", r.status === 0, r.stderr);
  m = readM();
  let stamp = m.domains_indexed?.["journey-email-templates"];
  check("T-2: stamp written as an object keyed by namespace", stamp && typeof stamp === "object");
  check("T-2: stamp.at is ISO", ISO.test(stamp?.at ?? ""));
  check("T-2: stamp.idField recorded", stamp?.idField === "templateId");
  check("T-2: itemsPath ALWAYS PRESENT, null when unrecorded (v2 delta 2)", "itemsPath" in stamp && stamp.itemsPath === null);
  check("T-2: describeCommand ALWAYS PRESENT, null until recorded", "describeCommand" in stamp && stamp.describeCommand === null);
  check("T-2: listCommand ALWAYS PRESENT, null until recorded", "listCommand" in stamp && stamp.listCommand === null);
  check("T-2: dateField ABSENT when unknown — never null-for-unknown", !("dateField" in stamp), stamp);

  // Inventory entries: required keys present, every key inside the typedef.
  const T2_ENTRY_KEYS = new Set(["id", "name", "domain", "modified_date", "status", "depth", "last_verified", "doc_path", "fingerprint", "error"]);
  const e1 = m.inventory["journey-email-templates/t-1"];
  check("T-2: inventory keyed <domain>/<id>", !!e1, Object.keys(m.inventory));
  check("T-2: entry id/domain/status present", e1?.id === "t-1" && e1?.domain === "journey-email-templates" && e1?.status === "pending");
  check("T-2: entry keys all inside the typedef", Object.values(m.inventory).every((e) => Object.keys(e).every((k) => T2_ENTRY_KEYS.has(k))),
    Object.values(m.inventory).flatMap((e) => Object.keys(e)));

  // Recording pass: dateField string = recorded; itemsPath/describeCommand/
  // listCommand move null → recorded string; modified_date null = recorded-none.
  r = verb("upsert-batch", [
    "--file", join(dir, "templates.json"), "--domain", "journey-email-templates", "--id-field", "templateId",
    "--name-field", "title", "--date-field", "modifiedDate", "--items-path", "emailTemplates",
    "--describe-command", "gs-admin --json jo email template --id {id}",
    "--list-command", "gs-admin --json jo email templates",
  ]);
  check("upsert-batch (recording flags) exits 0", r.status === 0, r.stderr);
  m = readM();
  stamp = m.domains_indexed["journey-email-templates"];
  check("T-2: dateField string = recorded", stamp.dateField === "modifiedDate");
  check("T-2: itemsPath recorded", stamp.itemsPath === "emailTemplates");
  check("T-2: describeCommand recorded", stamp.describeCommand === "gs-admin --json jo email template --id {id}");
  check("T-2: listCommand recorded", stamp.listCommand === "gs-admin --json jo email templates");
  check("T-2: modified_date carries the item's date", m.inventory["journey-email-templates/t-1"].modified_date === "2026-01-05T00:00:00.000Z");
  check("T-2: modified_date null = recorded-none (explicitly none)",
    "modified_date" in m.inventory["journey-email-templates/t-2"] && m.inventory["journey-email-templates/t-2"].modified_date === null,
    m.inventory["journey-email-templates/t-2"]);

  // --no-date-field on a fresh domain: dateField null = recorded-none.
  r = verb("upsert-batch", ["--file", join(dir, "rules.json"), "--domain", "rules-engine-rules", "--id-field", "id", "--name-field", "name", "--no-date-field"]);
  check("upsert-batch --no-date-field exits 0", r.status === 0, r.stderr);
  m = readM();
  check("T-2: dateField null = recorded-none", m.domains_indexed["rules-engine-rules"].dateField === null,
    m.domains_indexed["rules-engine-rules"]);

  // crawl_mode: the key is crawl_mode (v2 delta 1 — no manifest ever carries
  // a `crawl` key), values from the two-value union.
  r = verb("crawl", ["--set", "deep"]);
  check("crawl --set deep exits 0", r.status === 0, r.stderr);
  m = readM();
  check("T-2: crawl_mode key spelled crawl_mode (v2 delta 1)", m.crawl_mode === "deep" && !("crawl" in m));

  // GsExclusion (F-449): {reason, decidedAt} plus EXACTLY ONE of evidence /
  // noCheck on every entry the verb writes; coveredBy and recheckAfter
  // conditional. A legacy entry (neither evidence nor noCheck) is tolerated
  // by readers, never produced.
  r = verb("exclude", ["--command", "connectors jobs list", "--reason", "fixture: considered and declined", "--no-check", "fixture: no capture in this suite"]);
  check("exclude exits 0", r.status === 0, r.stderr);
  m = readM();
  const excl = m.domains_excluded?.["connectors jobs list"];
  check("T-2: exclusion keyed by canonical command path", !!excl, m.domains_excluded);
  check("T-2: GsExclusion without a check is exactly {reason, decidedAt, noCheck}",
    excl && Object.keys(excl).sort().join(",") === "decidedAt,noCheck,reason" && ISO.test(excl.decidedAt), excl);
  const checkFile = join(dir, "check-evidence.json");
  writeFileSync(checkFile, JSON.stringify({ ok: true, command: "connectors jobs list", checkedAt: new Date().toISOString(), rows: 3, idsExtracted: 3, unresolvedRows: 0, partial: false, uniqueIds: 3, alreadyIndexed: 3, allIndexed: true, noneIndexed: false, matchedByDomain: { "rules-engine-rules": 3 }, sampleMatches: [], warnings: [] }));
  r = verb("exclude", ["--command", "connectors jobs list", "--reason", "fixture: covered", "--check", checkFile, "--covered-by", "rules-engine-rules", "--recheck-after", "2030-01-01"]);
  check("exclude with --check --covered-by exits 0", r.status === 0, r.stderr);
  m = readM();
  const cov = m.domains_excluded?.["connectors jobs list"];
  check("T-2: GsExclusion with a check is exactly {reason, decidedAt, coveredBy, evidence, recheckAfter} — noCheck absent",
    cov && Object.keys(cov).sort().join(",") === "coveredBy,decidedAt,evidence,reason,recheckAfter" && ISO.test(cov.decidedAt), cov);
  check("T-2: GsCheckEvidence is exactly {rows, uniqueIds, alreadyIndexed, matchedByDomain}",
    cov?.evidence && Object.keys(cov.evidence).sort().join(",") === "alreadyIndexed,matchedByDomain,rows,uniqueIds", cov?.evidence);

  // GsBlock: decidedAt present (freeze delta 5); recheckAfter conditional.
  r = verb("block", ["--command", "scorecard measures list", "--reason", "fixture: could not look"]);
  check("block (no recheck) exits 0", r.status === 0, r.stderr);
  m = readM();
  const b1 = m.domains_blocked?.["scorecard measures list"];
  check("T-2: GsBlock without --recheck-after is exactly {reason, decidedAt}",
    b1 && Object.keys(b1).sort().join(",") === "decidedAt,reason" && ISO.test(b1.decidedAt), b1);
  r = verb("block", ["--command", "report definitions list", "--reason", "fixture: rate limited", "--recheck-after", "2026-12-01"]);
  check("block --recheck-after exits 0", r.status === 0, r.stderr);
  m = readM();
  const b2 = m.domains_blocked?.["report definitions list"];
  check("T-2: recheckAfter present as YYYY-MM-DD when passed",
    b2 && Object.keys(b2).sort().join(",") === "decidedAt,reason,recheckAfter" && b2.recheckAfter === "2026-12-01", b2);

  // Legacy bare-ISO-string stamp (v2 delta 10): a pre-recording manifest may
  // carry a STRING where the stamp object lives; the writer must tolerate it
  // (typeof branch) and upgrade it to an object on the next stamp.
  m = readM();
  m.domains_indexed["legacy-domain"] = "2025-01-01T00:00:00.000Z";
  writeFileSync(M, JSON.stringify(m, null, 2));
  writeFiles(dir, { "legacy.json": JSON.stringify([{ id: "l-1", name: "Legacy" }]) });
  r = verb("upsert-batch", ["--file", join(dir, "legacy.json"), "--domain", "legacy-domain", "--id-field", "id"]);
  check("legacy string stamp tolerated by the writer (v2 delta 10)", r.status === 0, r.stderr);
  m = readM();
  const lg = m.domains_indexed["legacy-domain"];
  check("legacy string stamp upgraded to an object on re-stamp",
    lg && typeof lg === "object" && "itemsPath" in lg && lg.itemsPath === null, lg);

  // T-2 v3 (Session C1, 2026-09-15): report's OUTPUT is part of the contract —
  // the skills quote its fields and describe-batch reads byDomain. Key sets
  // re-derived from the GsReport / GsReportDomain / GsReportDepth typedefs
  // (never imported — the independent-derivation standard above), the v2 keys
  // all still present (additive), byDomain rows numbers-only (the progress
  // probe sums them), and remove's docPathsUnknown beside docPaths.
  r = verb("report", []);
  check("T-2 v3: report exits 0 with JSON", r.status === 0, r.stderr);
  const rep = JSON.parse(r.stdout);
  const T2_REPORT_KEYS = [
    "ok", "slug", "baseUrl", "environment", "total", "last_refresh", "byStatus", "byDomain", "lookback", "lookbackDefault",
    "domains_indexed", "domains_excluded", "domains_blocked", "emptyDomains",
    "byDepth", "domainCounts", "docPathsUnknown", "domains", "pinFacts",
  ].sort().join(",");
  check("T-2 v4: report carries exactly the typedef keys (v2 set + byDepth/domainCounts/docPathsUnknown/domains + pinFacts)", Object.keys(rep).sort().join(",") === T2_REPORT_KEYS, Object.keys(rep).sort());
  const T2_DEPTH_KEYS = "full,listOnly,metadata,unrecorded";
  check("T-2 v3: byDepth is exactly {full, metadata, listOnly, unrecorded}, all numbers", Object.keys(rep.byDepth).sort().join(",") === T2_DEPTH_KEYS && Object.values(rep.byDepth).every((v) => typeof v === "number"), rep.byDepth);
  check("T-2 v3: domainCounts is exactly {indexed, withAssets, empty}", Object.keys(rep.domainCounts).sort().join(",") === "empty,indexed,withAssets", rep.domainCounts);
  check("T-2 v3: docPathsUnknown is a number", typeof rep.docPathsUnknown === "number", rep.docPathsUnknown);
  const T2_DOMAIN_ROW_KEYS = "byDepth,changeDetection,datelessEntries,describeState,docPathsUnknown,scope,stamped";
  check("T-2 v4: one domains row per stamped or populated domain, each exactly {stamped, describeState, byDepth, changeDetection, datelessEntries, docPathsUnknown, scope}",
    Object.keys(rep.domains).sort().join(",") === [...new Set([...Object.keys(rep.byDomain), ...Object.keys(rep.domains_indexed)])].sort().join(",") &&
      Object.values(rep.domains).every((d) => Object.keys(d).sort().join(",") === T2_DOMAIN_ROW_KEYS && Object.keys(d.byDepth).sort().join(",") === T2_DEPTH_KEYS),
    rep.domains);
  check("T-2 v3: describeState ∈ describable|list-only|unrecorded and changeDetection ∈ date|none|unrecorded on every row",
    Object.values(rep.domains).every((d) => ["describable", "list-only", "unrecorded"].includes(d.describeState) && ["date", "none", "unrecorded"].includes(d.changeDetection) && typeof d.stamped === "boolean"), rep.domains);
  // v4 (F-450 c): scope is DERIVED from the stamp's recorded listCommand
  // through doc-lib's per-pin table — the templates stamp above recorded
  // `jo email templates`, a scope-limited command at the pin; the rules
  // stamp recorded nothing. pinFacts says the table applied (the scratch
  // dir has no workspace catalog, so the bundled one — at the pin — is read).
  check("T-2 v4: pinFacts is exactly {stamped, catalogVersion, applied, why} and applied against the bundled catalog",
    Object.keys(rep.pinFacts ?? {}).sort().join(",") === "applied,catalogVersion,stamped,why" && rep.pinFacts.applied === true && rep.pinFacts.why === null && rep.pinFacts.stamped === rep.pinFacts.catalogVersion, rep.pinFacts);
  check("T-2 v4: scope is {key, path, limit} on the scope-limited templates domain (key = catalog id, path = canonical path) and null on the others",
    rep.domains["journey-email-templates"]?.scope?.key === "journey:email:templates" && rep.domains["journey-email-templates"].scope.path === "journey email templates" && typeof rep.domains["journey-email-templates"].scope.limit === "string" && rep.domains["journey-email-templates"].scope.limit.length > 0 &&
      Object.keys(rep.domains["journey-email-templates"].scope).sort().join(",") === "key,limit,path" && rep.domains["rules-engine-rules"]?.scope === null && rep.domains["legacy-domain"]?.scope === null,
    Object.fromEntries(Object.entries(rep.domains).map(([k, d]) => [k, d.scope])));
  check("T-2 v3: byDomain rows are numbers only — nothing new was nested into them", Object.values(rep.byDomain).every((row) => Object.values(row).every((v) => typeof v === "number")), rep.byDomain);
  check("T-2 v3: the fixture's recorded-none domain reads changeDetection none; the recorded-field domain reads date; the legacy string-stamp domain reads unrecorded",
    rep.domains["rules-engine-rules"]?.changeDetection === "none" && rep.domains["journey-email-templates"]?.changeDetection === "date" && rep.domains["legacy-domain"]?.changeDetection === "unrecorded", Object.fromEntries(Object.entries(rep.domains).map(([k, d]) => [k, d.changeDetection])));
  r = verb("remove", ["--key", "legacy-domain/l-1"]);
  check("T-2 v3: remove's summary is exactly {ok, removed, missing, docPaths, docPathsUnknown, totalInventory}", r.status === 0 && Object.keys(JSON.parse(r.stdout)).sort().join(",") === "docPaths,docPathsUnknown,missing,ok,removed,totalInventory", r.stdout);
} finally {
  removeTempDir(dir);
}

// ── T-1 · bundled plugin catalog conformance ─────────────────────────────────
{
  const cat = JSON.parse(readFileSync(BUNDLED_CATALOG, "utf8"));
  // The key lists below are deliberately re-derived from the frozen typedef
  // rather than shared with build/test-extract-catalog.mjs (which runs the
  // same conformance on the committed repo catalog): no lane both suites may
  // import exists for assertion material (R-10 keeps the rig plumbing-only),
  // and independent derivation is the house testing standard. A T-1 amendment
  // updates BOTH suites — grep T1_COMMAND_KEYS.
  // Non-empty floors first: `every` over empty arrays is vacuously true
  // (B2 review, finder A).
  check("T-1: non-vacuous — artifact commands, endpoints, and both flag families exist",
    cat.commands.filter((c) => c.lane === "artifact").length > 0 &&
      cat.commands.reduce((n, c) => n + c.endpoints.length, 0) > 0 &&
      cat.commands.filter((c) => c.lane === "artifact").reduce((n, c) => n + c.flags.length, 0) > 0 &&
      cat.commands.filter((c) => c.lane !== "artifact").reduce((n, c) => n + c.flags.length, 0) > 0);
  const T1_COMMAND_KEYS = [
    "id", "lane", "domain", "path", "shortPath", "group", "subGroup", "subSubGroup",
    "groupPath", "groupTitles", "name", "actionKey", "summary", "description",
    "mutating", "cliHidden", "mcpTool", "mcpHidden", "outputFormat", "flags",
    "examples", "afterHelpNotes", "endpoints",
  ].sort().join(",");
  const T1_FLAG_KEYS = ["name", "flag", "char", "type", "required", "default", "enum", "csv", "description", "cliExposed"].sort().join(",");
  const FLAG_KEYS_NO_CHAR = T1_FLAG_KEYS.split(",").filter((k) => k !== "char").join(",");
  check("T-1: bundled catalog commands carry exactly the typedef keys",
    cat.commands.every((c) => Object.keys(c).sort().join(",") === T1_COMMAND_KEYS));
  check("T-1: bundled artifact flags carry the ten keys (char null-valued at the pin)",
    cat.commands.filter((c) => c.lane === "artifact").every((c) => c.flags.every((f) => Object.keys(f).sort().join(",") === T1_FLAG_KEYS)));
  check("T-1 v3: runtime/static flags omit char (artifact-lane-only key)",
    cat.commands.filter((c) => c.lane !== "artifact").every((c) => c.flags.every((f) => Object.keys(f).sort().join(",") === FLAG_KEYS_NO_CHAR)));
  check("T-1 v3: endpoint entries carry exactly name+method+path",
    cat.commands.every((c) => c.endpoints.every((e) => Object.keys(e).sort().join(",") === "method,name,path")));
  // F-287 value-rule projection (independently derived — see the note above
  // about the sibling suite): "default" tracks the manifest's singular
  // `endpoint` FIELD, not entry count, so single-entry arrays must exist in
  // both name shapes.
  {
    const singles = cat.commands.map((c) => c.endpoints).filter((e) => e.length === 1);
    check("T-1 v3 (F-287): single-entry endpoint arrays exist in both name shapes",
      singles.some((e) => e[0].name === "default") && singles.some((e) => e[0].name !== "default"));
  }
  check("T-1: counts of record hold on the bundled catalog",
    cat.meta.counts.totalCliCommands === cat.commands.length &&
      cat.meta.counts.mcpTools === cat.commands.filter((c) => c.mcpTool).length);
}

// ── T-3 · stub-marker string contract, executed through the real parser ──────
// GP-B5 DS-13: the marker is single-sourced as doc-lib's STUB_MARKER /
// STUB_MARKER_RE. The writer→parser round trip through the REAL stub verb
// already lives in test/jo-report.mjs ("journey stub (stub verb)" block —
// init/upsert/stub/parseJourneyDoc, so writer or detector desync from the
// constant fails there); this section adds the locks that round trip is
// BLIND to, all in-process on hand-spelled docs (R-10 independent
// derivation): the VALUE pin (a constant edit keeps the round trip green —
// both sites flow the same constant — but must fail on a doc written by an
// EARLIER plugin version, which lives immutably in user KBs), the
// marker-is-the-signal control, and the line-anchoring negative.
{
  const legacyDoc = [
    "# Legacy Program",
    "",
    "> **Metadata-only stub** (shallow crawl, captured 2026-01-01T00:00:00.000Z) — full ingest:",
    "> `/gs-superadmin:setup --deep journey`",
    "",
    "- key: journey/legacy-1",
    "",
    "```json",
    '{ "programId": "legacy-1", "name": "Legacy Program" }',
    "```",
    "",
  ].join("\n");
  check("T-3 back-compat VALUE pin: literal legacy stub doc detected as stub (fence present)",
    parseJourneyDoc(legacyDoc, "legacy-1.md").entry.depth === "stub");

  // Control: the marker line is the load-bearing signal — remove it and the
  // same doc reads as FULL (its fence parses), proving detection rides the
  // marker, not fence absence. Removal keys on the constant so a marker
  // rename cannot silently turn this into a no-op filter.
  const noMarker = legacyDoc.split("\n").filter((l) => !l.startsWith(STUB_MARKER)).join("\n");
  check("T-3 control: marker line removed → same doc parses as depth full",
    parseJourneyDoc(noMarker, "legacy-1.md").entry.depth === "full");

  // Anchoring negative: the marker MID-LINE in pre-fence text must NOT read
  // as a stub — the contract is marker at the start of a line (the ^…m
  // anchor a widening edit to STUB_MARKER_RE would silently drop).
  const midLine = legacyDoc.replace(
    "> **Metadata-only stub** (shallow crawl,",
    "> was \"> **Metadata-only stub**\" before deep ingest (shallow crawl,");
  check("T-3 anchoring: marker mid-line is NOT a stub (parses full)",
    parseJourneyDoc(midLine, "legacy-1.md").entry.depth === "full");
}

// ── T-4 · journal entry grammar, executed through BOTH real writers ──────────
// GP-B5 DS-15, landed BEFORE the emitter hoist as the differential lock
// (A-6); grammar authored from captured output, assertions hand-spelled from
// the v4 header (R-10). Ownership split: this section owns FRAME, ORDER,
// heading↔body agreement, and the label-subset closure; entry CONTENT
// wording (outcome sentences guard-fixtures:574/:623/:654, note text
// guard-fixtures:1461) stays with the writer suites.
{
  const t4 = makeTempDir("contract-conformance-t4");
  try {
    const HOOK = join(HERE, "..", "hooks", "gs-admin-guard.mjs");
    const JOURNAL_SCRIPT = join(HERE, "..", "scripts", "journal.mjs");
    writeFiles(t4, {
      ".gs-superadmin/.keep": "",
      "acme-prod/_manifest.json": JSON.stringify({
        slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com",
        environment: "production", created: "2026-01-01T00:00:00.000Z",
        last_refresh: null, inventory: {},
      }, null, 2),
      "acme-prod/changes/2026-08-16-t4-plan.md": "# plan\n",
    });
    // The guard fails OPEN on journaling errors (exit 0 + systemMessage), so
    // every hook spawn asserts silence: a broken journal-lib import must
    // surface as a labeled FAIL quoting the alert, never a count mismatch.
    const hookPost = (command, extra = {}) => {
      const r = runNode(HOOK, [], {
        cwd: t4,
        input: JSON.stringify({
          hook_event_name: "PostToolUse", tool_name: "Bash",
          tool_input: { command }, cwd: t4, session_id: "t4-conformance", ...extra,
        }),
      });
      check("T-4: hook spawn exits 0 and journals without a fail-open alert",
        r.status === 0 && !String(r.stdout).includes("systemMessage"), r.stdout || r.stderr);
      return r;
    };
    // Guard variants (one spawn journals EVERY invocation it finds — hits
    // then unknowns — so the first covers two entries):
    //   e0 mutating + e1 unknown-fail-closed (one combined command) ·
    //   e2 exit-code failure · e3 failure event (hook_event_name override) ·
    //   e4 blind finding (conditional note) · e5 ticketed via the
    //   active-change marker — the frame's ticket substitution and the
    //   combined ticket·plan VALUES exercised through the GUARD path too.
    hookPost("gs-admin jo p save; gs-admin frobnicate everything");
    hookPost("gs-admin jo p save", { tool_response: { exit_code: 3, stdout: "", stderr: "" } });
    hookPost("gs-admin jo p save", { hook_event_name: "PostToolUseFailure", tool_error: "Command failed with exit code 1" });
    hookPost("cat > notes.md <<'EOF'\nDon't forget: gs-admin jo p save\nEOF", { tool_response: { exit_code: 0 } });
    writeFiles(t4, { ".gs-superadmin/active-change.json": JSON.stringify({
      ticket: "CSOPS-142", plan: "acme-prod/changes/2026-08-16-t4-plan.md",
      slug: "acme-prod", started_at: new Date().toISOString(),
    }) });
    hookPost("gs-admin jo p save");
    // journal.mjs variants: executed/ticketed/two assets · partial/no-ticket.
    let jr = runNode(JOURNAL_SCRIPT, ["journal-append", "--slug", "acme-prod",
      "--plan", "acme-prod/changes/2026-08-16-t4-plan.md", "--ticket", "CSOPS-142",
      "--system-area", "gs-rules", "--outcome", "executed",
      "--asset", "CREATE Risk Rule (1I00ABC) — acme-prod/rules-engine/r1.md",
      "--asset", "MODIFY Alert Rule (1I00DEF) — KB doc pending next /gs-superadmin:refresh"], { cwd: t4 });
    check("T-4: journal-append (executed) exits 0", jr.status === 0, jr.stderr || jr.stdout);
    jr = runNode(JOURNAL_SCRIPT, ["journal-append", "--slug", "acme-prod",
      "--plan", "acme-prod/changes/2026-08-16-t4-plan.md", "--ticket", "none",
      "--system-area", "gs-journey", "--outcome", "partial", "--asset", "none"], { cwd: t4 });
    check("T-4: journal-append (partial) exits 0", jr.status === 0, jr.stderr || jr.stdout);

    const jrn = readFileSync(join(t4, "acme-prod", "changes", "JOURNAL.md"), "utf8");
    const entries = jrn.split(/^## /m).slice(1).map((e) => "## " + e);
    // Hard gate: the guard fails open, so a journaling regression shows up
    // as a short file — fail here with the count, never a TypeError below.
    check("T-4: 8 entries written (6 guard entries from 5 spawns + 2 journal-append)",
      entries.length === 8, entries.length);
    if (entries.length === 8) {
      const labels = entries.map((e) =>
        e.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2, l.indexOf(":"))));
      const GUARD = [0, 1, 2, 3, 4, 5];
      const NOTE_FREE = [0, 1, 2, 3, 5];

      // FRAME — byte-uniform on every entry, both writers. Area and ticket
      // segments allow interior spaces (journal.mjs's --system-area is
      // printable-clamped free text, which keeps spaces) but never "·" —
      // printable/oneLine strip or the writers never emit it — so the
      // three-segment split below is unambiguous.
      const HEADING = /^## \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z · [^\n·]+ · [^\n·]+$/;
      const headings = entries.map((e) => e.split("\n")[0]);
      check("T-4 frame: heading `## <ISO ms Z> · <area> · <ticket|no-ticket>` on all 8",
        headings.every((h) => HEADING.test(h)), headings);
      check("T-4 frame: blank line after the heading on all 8",
        entries.every((e) => e.split("\n")[1] === ""));
      // The blank-line entry SEPARATOR is frame too: no heading may sit
      // directly under a non-blank line anywhere in the file.
      check("T-4 frame: every heading is preceded by a blank line (entry separator)",
        !/[^\n]\n## /.test(jrn));
      check("T-4 frame: `- kind:` first bullet, `- operator:` second and non-empty, on all 8",
        entries.every((e) => e.split("\n")[2].startsWith("- kind: ") && /^- operator: \S/.test(e.split("\n")[3])));
      check("T-4 frame: `- kb-snapshot:` is the last bullet on all 8",
        labels.every((ls) => ls[ls.length - 1] === "kb-snapshot"));

      // Heading↔body agreement — the emitter takes area/ticket for the
      // heading while each writer re-spells both in its own field lines;
      // nothing else compares the two halves of the same entry.
      const headParts = headings.map((h) => h.split(" · "));
      check("T-4 frame: heading area equals the body `- system-area:` on all 8",
        entries.every((e, i) => e.includes(`\n- system-area: ${headParts[i][1]}\n`)),
        headParts.map((p) => p[1]));
      check("T-4 frame: heading ticket agrees with the body ticket value on all 8",
        entries.every((e, i) => {
          const body = /^- ticket: ([^\n·]+?)(?: · plan: .*)?$/m.exec(e)?.[1].trim();
          return body && (headParts[i][2] === "no-ticket" ? body === "none" : headParts[i][2] === body);
        }), headParts.map((p) => p[2]));

      // Per-writer field lists — exact label sequences, hand-spelled from v4.
      const HOOK_SEQ = "kind,operator,action,system-area,target,command,outcome,ticket,kb-snapshot";
      const HOOK_SEQ_NOTED = "kind,operator,action,system-area,target,command,outcome,note,ticket,kb-snapshot";
      check("T-4 guard: field sequence invariant across the 5 note-free variants (incl. unknown + ticketed)",
        NOTE_FREE.every((i) => labels[i].join(",") === HOOK_SEQ),
        NOTE_FREE.map((i) => labels[i].join(",")));
      check("T-4 guard: blind finding inserts the CONDITIONAL note before the ticket line",
        labels[4].join(",") === HOOK_SEQ_NOTED, labels[4]);
      check("T-4 script: field sequence with one `assets` line per --asset",
        labels[6].join(",") === "kind,operator,plan,system-area,ticket,assets,assets,kb-snapshot" &&
          labels[7].join(",") === "kind,operator,plan,system-area,ticket,assets,kb-snapshot",
        [labels[6].join(","), labels[7].join(",")]);

      // No bullet may carry an empty or "undefined" value — the emitter's
      // options-bag boundary must never land a mis-keyed slot in the record.
      check("T-4: no empty or `undefined` bullet value on any entry",
        entries.every((e) => e.split("\n").filter((l) => l.startsWith("- "))
          .every((l) => { const v = l.slice(l.indexOf(":") + 1).trim(); return v !== "" && v !== "undefined"; })));

      // Kind literals — the v4 adjudication record, pinned at CONTRACT level.
      // DELIBERATE dual pin (A-2): journal-ops/guard-fixtures pin the
      // writers' behavior; this suite pins the same literals as contract —
      // a deliberate rename must redden both homes.
      check("T-4: guard kind is `command (guard-approved)` on all 6",
        GUARD.every((i) => entries[i].includes("- kind: command (guard-approved)")));
      check("T-4: journal-append kind is `change-plan execution` (NOT the prose nickname)",
        entries[6].includes("- kind: change-plan execution") && entries[7].includes("- kind: change-plan execution"));

      // Ticket placement — combined line hook-only; own line script-only —
      // and the marker's VALUES land in heading + combined line (guard path).
      check("T-4: guard writes the combined ticket·plan line on all 6",
        GUARD.every((i) => /^- ticket: \S+ · plan: \S+$/m.test(entries[i])));
      check("T-4: ticketed guard entry carries the marker values in heading and combined line",
        headings[5].endsWith("· CSOPS-142") &&
          entries[5].includes("- ticket: CSOPS-142 · plan: acme-prod/changes/2026-08-16-t4-plan.md"));
      check("T-4: no-ticket guard headings substitute `no-ticket`",
        [0, 1, 2, 3, 4].every((i) => headings[i].endsWith("· no-ticket")));
      check("T-4: journal-append writes ticket on its OWN line (no `· plan:`)",
        /^- ticket: CSOPS-142$/m.test(entries[6]) && /^- ticket: none$/m.test(entries[7]));
      check("T-4: script headings — key when ticketed, no-ticket substitution otherwise",
        headings[6].endsWith("· gs-rules · CSOPS-142") && headings[7].endsWith("· gs-journey · no-ticket"));

      // Variant honesty: the outcome variants must be genuinely distinct so
      // "sequence invariant across variants" asserts something. Wording
      // ownership stays with guard-fixtures (pointers in the header above).
      check("T-4: ≥3 distinct outcome lines across the guard variants",
        new Set([0, 1, 2, 3, 4].map((i) => /^- outcome: .*$/m.exec(entries[i])?.[0])).size >= 3,
        [0, 1, 2, 3, 4].map((i) => /^- outcome: .*$/m.exec(entries[i])?.[0]));
      check("T-4: unknown command journals fail-closed in the action line, area `unknown`",
        entries[1].includes("- action: not in catalog") && headings[1].includes("· unknown ·"));
      check("T-4 script: plan line carries the outcome word (executed | partially executed)",
        /^- plan: \S+ \(executed\)$/m.test(entries[6]) &&
          /^- plan: \S+ \(partially executed — see plan\)$/m.test(entries[7]));

      // Subset closure — the standing "no other fields exist" check. The
      // exact sequences above pin the SAMPLED variants; this one applies to
      // every entry generically, so a FUTURE variant added without a
      // sequence pin still fails loudly on any new bullet label.
      const T4_LABELS = new Set(["kind", "operator", "action", "system-area", "target",
        "command", "outcome", "note", "ticket", "kb-snapshot", "plan", "assets"]);
      check("T-4: no bullet label outside the v4 grammar on any entry",
        labels.every((ls) => ls.every((l) => T4_LABELS.has(l))),
        labels.flat().filter((l) => !T4_LABELS.has(l)));
    }

    // GP-B5 DS-42 (the checkJs flip): the guard's 6-way outcome union must
    // never be narrowed by the type gate (T-5, design tenet 2). Its BEHAVIOR
    // is pinned by guard-fixtures, which drives every basis through the real
    // hook and asserts each outcome sentence (failed-event, exit-code,
    // error-flag, interrupted, success-event, inferred-unverified); that suite
    // runs first in the same CI job and reds on any dropped branch, so no
    // source-text pin of the branches is needed here. What only this suite
    // pins is the DOCUMENTED union: the T-4 typedef's six labels in precedence
    // order, and the guard's "Execution outcome" precedence comment — the
    // block T-4 names as the union's referent — still enumerating exactly six
    // steps (derived from the comment's numbering, not a hand list). Pure
    // source reads, deliberately outside the journaling fixture's entry-count
    // gate above so they run on every invocation.
    const jlSrc = readFileSync(join(HERE, "..", "scripts", "journal-lib.mjs"), "utf8");
    const basisText = /@typedef \{([^}]*)\} JournalOutcomeBasis/.exec(jlSrc)?.[1] ?? "";
    const basisLabels = basisText.match(/"[a-z-]+"/g) ?? [];
    check("T-4/T-5: JournalOutcomeBasis still lists exactly the six basis labels, in precedence order (un-narrowed)",
      JSON.stringify(basisLabels) === JSON.stringify([
        '"failed-event"', '"exit-code"', '"error-flag"', '"interrupted"', '"success-event"', '"inferred-unverified"',
      ]), basisLabels);
    const guardSrc = readFileSync(HOOK, "utf8");
    const oStart = guardSrc.indexOf("// Execution outcome.");
    const oEnd = guardSrc.indexOf("const kbRef =", oStart);
    const outcomeBlock = oStart === -1 || oEnd === -1 ? "" : guardSrc.slice(oStart, oEnd);
    const steps = [...outcomeBlock.matchAll(/^\s*\/\/ {3}(\d+)\. /gm)].map((m) => Number(m[1]));
    check("T-5: the guard's outcome precedence comment still enumerates exactly steps 1-6 (the documented union, un-narrowed)",
      JSON.stringify(steps) === JSON.stringify([1, 2, 3, 4, 5, 6]), steps);
  } finally {
    removeTempDir(t4);
  }
}

// ── T-10 · engagement snapshot, executed through the real producer ───────────
// ENG-1: the snapshot scripts/engagement.mjs writes, pulled through the real
// process over the fictional acme tenant (test/fixtures/engagement/ — the fake
// CLI behind --bin), once with step detail and once without, and the committed
// fixture snapshot beside them. Key sets are hand-spelled from the frozen
// typedef (R-10), never imported: a field added, dropped or renamed at the
// producer reds here until the typedef and this pin move together. What the
// values MEAN is the engagement suite's (it holds the producer to a straight
// count of the fixture's rows); this section owns the SHAPE.
{
  const t10 = makeTempDir("contract-conformance-t10");
  try {
    const ENGINE = join(HERE, "..", "scripts", "engagement.mjs");
    const FAKE = join(HERE, "fixtures", "engagement", "fake-gs-admin.mjs");
    const links = join(t10, "links.json");
    writeFiles(t10, {
      "ws/.gs-superadmin/.keep": "",
      "links.json": JSON.stringify({ "tpl-nps": { reading: "tracked-link-present", asOf: "2026-09-01" }, "tpl-renew-b": { reading: "links-none-tracked", asOf: "2026-09-01" } }),
    });
    writeFiles(join(t10, "kb"), kbFiles("acme-prod"));
    const ACCOUNTS_ON = ["--accounts", "--accounts-busiest", "3", "--accounts-low", "2", "--accounts-bounce", "2", "--accounts-low-min-delivered", "4"];
    const categories = join(t10, "categories.json");
    writeFiles(t10, { "categories.json": JSON.stringify({ bounceReasons: FIXTURE_BOUNCE_CATEGORIES }) });
    const produce = (run, extra) => {
      const out = join(t10, `${run}.json`);
      const r = runNode(ENGINE, [
        "run", "--workspace", join(t10, "ws"), "--bin", FAKE, "--kb", join(t10, "kb", "acme-prod"), "--today", "2026-09-15",
        "--pulled-at", "2026-09-15T09:00:00-07:00", "--from", "2026-06", "--internal-domain", "acme.com", "--page-size", "400",
        "--link-settings", links, "--run", run, "--out", out, ...extra,
      ]);
      check(`T-10: the producer runs over the fixture tenant (${run})`, r.status === 0, r.stderr.slice(-400));
      return r.status === 0 ? JSON.parse(readFileSync(out, "utf8")) : null;
    };
    const withSteps = produce("t10-steps", ["--step-detail", "--health", "--failure-categories", categories, ...ACCOUNTS_ON]);
    const plain = produce("t10-plain", ["--health", "--failure-categories", categories, ...ACCOUNTS_ON]);
    // The adapter's default: neither the account grain nor the health facts are pulled unless asked for.
    const noAccounts = produce("t10-noacc", []);
    const fixture = JSON.parse(readFileSync(join(HERE, "fixtures", "engagement", "snapshot-acme.json"), "utf8"));

    const keys = (o) => Object.keys(o).sort().join(",");
    const list = (...names) => names.slice().sort().join(",");
    const MEASURES = ["sent", "delivered", "bounced", "rejected", "unsubscribed", "spamComplaints", "failed", "opened", "clicked"];
    const ROW_BASE = ["programId", "month", "recipientClass", "provenance", "pulledAt"];
    const STATES = ["tracked", "not-tracked", "unknown"];
    const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
    const count = (v) => Number.isInteger(v) && v >= 0;
    const rows = (s, table, rowKeys) => Array.isArray(s.facts[table]) && s.facts[table].length > 0 && s.facts[table].every((r) => keys(r) === rowKeys);

    for (const [which, s, steps, accounts] of /** @type {Array<[string, *, boolean, boolean]>} */ ([["produced with step detail", withSteps, true, true], ["produced without step detail", plain, false, true], ["produced without accounts (the default)", noAccounts, false, false], ["the committed fixture snapshot", fixture, true, true]])) {
      if (!s) continue;
      const at = (label) => `T-10 (${which}): ${label}`;
      check(at("top level is exactly {schemaVersion 1, kind engagement, meta, dimensions, facts, honesty, reconciliation, caveats}"),
        keys(s) === list("schemaVersion", "kind", "meta", "dimensions", "facts", "honesty", "reconciliation", "caveats") && s.schemaVersion === 1 && s.kind === "engagement", keys(s));
      check(at("meta carries exactly the typedef keys; source jo-engagement; pulledAt has a UTC offset"),
        keys(s.meta) === list("source", "params", "pulledAt", "timeZone", "tenantHost", "cliVersion", "pluginVersion", "window", "incompleteFrom", "dateBasis", "stepDetail", "accounts", "participantRecords", "health", "refresh", "metricAvailability") &&
          s.meta.source === "jo-engagement" && /T\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(s.meta.pulledAt) && s.meta.stepDetail === steps, keys(s.meta));
      check(at("window is {from, to, start, endExclusive}; incompleteFrom is a day"), keys(s.meta.window) === list("from", "to", "start", "endExclusive") && MONTH.test(s.meta.window.from) && /^\d{4}-\d\d-\d\d$/.test(s.meta.incompleteFrom), s.meta.window);
      check(at("dateBasis names ExecutedDate months, and ao_emails' CreatedAt only with step detail"),
        keys(s.meta.dateBasis) === list("object", "field", "grain", "stepDetail") && s.meta.dateBasis.object === "email_log_v2" && s.meta.dateBasis.field === "ExecutedDate" && s.meta.dateBasis.grain === "month" &&
          (steps ? keys(s.meta.dateBasis.stepDetail) === "field,object" && s.meta.dateBasis.stepDetail.field === "CreatedAt" : s.meta.dateBasis.stepDetail === null), s.meta.dateBasis);
      check(at("participantRecords is {pulled, reason}: pulled with step detail, else the reason a reader shows"),
        keys(s.meta.participantRecords) === "pulled,reason" && (steps ? s.meta.participantRecords.pulled === true && s.meta.participantRecords.reason === null : s.meta.participantRecords.pulled === false && s.meta.participantRecords.reason === "step-detail-off"), s.meta.participantRecords);
      check(at("accounts is {pulled, reason}: pulled, or the reason a reader shows; with the account grain not pulled the account table and the account dimension are empty arrays, never absent and never partly filled, and a caveat says so"),
        keys(s.meta.accounts) === "pulled,reason" && Array.isArray(s.facts.byAccount) && Array.isArray(s.dimensions.accounts) &&
          (accounts ? s.meta.accounts.pulled === true && s.meta.accounts.reason === null && s.facts.byAccount.length > 0 && !s.caveats.some((c) => c.id === "accounts-not-pulled")
            : s.meta.accounts.pulled === false && s.meta.accounts.reason === "accounts-off" && s.facts.byAccount.length === 0 && s.dimensions.accounts.length === 0 && s.caveats.some((c) => c.id === "accounts-not-pulled")), s.meta.accounts);
      check(at("accountAvailability reads the marker, and reads a snapshot made before the switch existed (no marker) as pulled"),
        isDeepStrictEqual(accountAvailability(s), s.meta.accounts) && isDeepStrictEqual(accountAvailability({ ...s, meta: { ...s.meta, accounts: undefined } }), { pulled: true, reason: null }));
      check(at("refresh is exactly {mode, why, repullMonths, pulledMonths, carriedMonths, carriedPrograms, fullPrograms, previousPulledAt}"),
        keys(s.meta.refresh) === list("mode", "why", "repullMonths", "pulledMonths", "carriedMonths", "carriedPrograms", "fullPrograms", "previousPulledAt") && ["full", "selective"].includes(s.meta.refresh.mode), s.meta.refresh);

      const d = s.dimensions;
      check(at(`dimensions are exactly {programs, templates, accounts, months${steps ? ", steps" : ""}} — steps only with step detail`), keys(d) === (steps ? list("programs", "templates", "accounts", "months", "steps") : list("programs", "templates", "accounts", "months")), keys(d));
      check(at("program rows: id, name, a statuses LIST, model, modelName, audienceType, supergroup, group, folderId, and (S3b) schedule {classification, cronExpression, timeZoneName, asOf} or null"),
        d.programs.length > 0 && d.programs.every((p) => keys(p) === list("id", "name", "statuses", "model", "modelName", "audienceType", "supergroup", "group", "folderId", "schedule") && Array.isArray(p.statuses) && (p.schedule === null || (keys(p.schedule) === list("classification", "cronExpression", "timeZoneName", "asOf") && typeof p.schedule.classification === "string"))) &&
          d.programs.some((p) => p.schedule?.classification === "recurring") && d.programs.some((p) => p.schedule === null), d.programs[0]);
      check(at("template rows: id, name, uses[{programId, stepName, stepOrder, stepCount, asOf}] — asOf (S3b) the doc's date the step name is as of, null with no design"),
        d.templates.length > 0 && d.templates.every((t) => keys(t) === "id,name,uses" && t.uses.length > 0 && t.uses.every((u) => keys(u) === list("programId", "stepName", "stepOrder", "stepCount", "asOf") && count(u.stepCount) && (u.stepCount === 1 || (u.stepName === null && u.stepOrder === null)) && (u.stepCount > 0 ? typeof u.asOf === "string" : u.asOf === null))), d.templates[0]);
      check(at("account rows: an opaque key and a name; months are YYYY-MM"), (d.accounts.length > 0 || !accounts) && d.accounts.every((a) => keys(a) === "key,name" && typeof a.key === "string") && d.months.every((m) => MONTH.test(m)), d.accounts[0]);
      if (steps) check(at("step rows: programId, stepId, name, order, templateId, variantId, variantName"), d.steps.length > 0 && d.steps.every((x) => keys(x) === list("programId", "stepId", "name", "order", "templateId", "variantId", "variantName")), d.steps[0]);

      check(at(`facts are exactly {byTemplate, byAccount, responses, responseParticipants, uniques, health${steps ? ", byStep" : ""}} — byStep only with step detail`),
        keys(s.facts) === (steps ? list("byTemplate", "byStep", "byAccount", "responses", "responseParticipants", "uniques", "health") : list("byTemplate", "byAccount", "responses", "responseParticipants", "uniques", "health")), keys(s.facts));
      check(at("byTemplate rows: the row base, templateId and the nine additive measures"), rows(s, "byTemplate", list(...ROW_BASE, "templateId", ...MEASURES)), s.facts.byTemplate[0]);
      if (accounts) check(at("byAccount rows: the row base, bucket, accountKey and the nine measures; accountKey is set exactly on bucket account"),
        rows(s, "byAccount", list(...ROW_BASE, "bucket", "accountKey", ...MEASURES)) && s.facts.byAccount.every((r) => ["account", "other", "no-company-link"].includes(r.bucket) && (r.bucket === "account") === (r.accountKey !== null)) &&
          new Set(s.facts.byAccount.map((r) => r.bucket)).size === 3, s.facts.byAccount[0]);
      if (steps) check(at("byStep rows: the row base, stepId, variantId, templateId and the nine measures"), rows(s, "byStep", list(...ROW_BASE, "stepId", "variantId", "templateId", ...MEASURES)), s.facts.byStep[0]);
      const sendRows = [...s.facts.byTemplate, ...s.facts.byAccount, ...(steps ? s.facts.byStep : [])];
      check(at("Delivered is the attempts that went out and did not bounce: no row holds more delivered plus bounced than sent"),
        sendRows.every((r) => r.delivered + r.bounced <= r.sent) && sendRows.some((r) => r.bounced > 0));
      // HLT-1, additive: the error rate's numerator, on every send row.
      check(at("failed is the attempts that bounced or were rejected, each once: on every send row it is at least the larger of the two counts and at most their sum, and never more than sent"),
        sendRows.every((r) => r.failed >= Math.max(r.bounced, r.rejected) && r.failed <= r.bounced + r.rejected && r.failed <= r.sent) && sendRows.some((r) => r.failed > 0));
      check(at("every send row: additive measures are whole numbers >= 0, class internal|external, provenance pulled|carried, month YYYY-MM"),
        sendRows.every((r) => MEASURES.every((m) => count(r[m])) && ["internal", "external"].includes(r.recipientClass) && ["pulled", "carried"].includes(r.provenance) && MONTH.test(r.month) && typeof r.pulledAt === "string"));
      check(at("responses rows: programId, month, submitted, partiallySubmitted, provenance, pulledAt; the denominator is its own program-grain table"),
        rows(s, "responses", list("programId", "month", "submitted", "partiallySubmitted", "provenance", "pulledAt")) && s.facts.responseParticipants.length > 0, s.facts.responses[0]);
      check(at("responseParticipants rows: programId, participants, submitted, partiallySubmitted — the response rate's all-time basis, the two counts within the denominator"),
        s.facts.responseParticipants.every((r) => keys(r) === list("programId", "participants", "submitted", "partiallySubmitted") && count(r.participants) && count(r.submitted) && count(r.partiallySubmitted) && r.submitted + r.partiallySubmitted <= r.participants), s.facts.responseParticipants[0]);
      check(at("meta.params echoes the run's inputs: window, selector, internalDomains, unsubscribeLinks, testAccounts, stepDetail, accounts, repullMonths, pageSize, health (with its categories and expected reasons)"),
        keys(s.meta.params) === list("window", "selector", "internalDomains", "unsubscribeLinks", "testAccounts", "stepDetail", "accounts", "repullMonths", "pageSize", "health") && keys(s.meta.params.health) === "categories,expectedReasons,lookbackDays,pull" && keys(s.meta.params.health.categories) === "bounceReasons,participantFailures" && Array.isArray(s.meta.params.testAccounts) && s.meta.params.health.pull === accounts && Array.isArray(s.meta.params.unsubscribeLinks) && s.meta.params.unsubscribeLinks.every((l) => typeof l === "string"), keys(s.meta.params));
      check(at("uniques rows: programId, scope window|month, month (null on window), people, accounts, participantRecords, external{…}, provenance, pulledAt"),
        rows(s, "uniques", list("programId", "scope", "month", "people", "accounts", "participantRecords", "external", "provenance", "pulledAt")) &&
          s.facts.uniques.every((r) => keys(r.external) === "accounts,participantRecords,people" && ["window", "month"].includes(r.scope) && (r.scope === "window") === (r.month === null) && (steps ? count(r.participantRecords) : r.participantRecords === null && r.external.participantRecords === null)), s.facts.uniques[0]);

      // HLT-1, additive: the health facts and their part-by-part marker.
      const PARTS = ["bounceReasons", "participantFailures", "participantStates", "lastSends", "schedules", "failureSamples"];
      const DAY = /^\d{4}-\d\d-\d\d$/;
      const h = s.facts.health;
      const hm = s.meta.health;
      const text = (v) => v === null || (typeof v === "string" && v.length > 0);
      check(at("meta.health is {pulled, reason, asOf, dayWindow, parts} plus categories when pulled (S3b); with health not pulled it is the reason a reader shows (health-off), no day window and no parts, and every health table (the six) is an empty array, never absent"),
        keys(hm) === (hm.pulled ? list("pulled", "reason", "asOf", "dayWindow", "parts", "categories") : list("pulled", "reason", "asOf", "dayWindow", "parts")) && keys(h) === list(...PARTS) && PARTS.every((p) => Array.isArray(h[p])) && hm.pulled === accounts &&
          (hm.pulled || (hm.reason === "health-off" && hm.asOf === null && hm.dayWindow === null && keys(hm.parts) === "" && PARTS.every((p) => h[p].length === 0) && !s.caveats.some((c) => c.id === "health-incomplete"))), hm);
      check(at("healthAvailability reads the marker, and reads a snapshot made before health facts existed (no marker) as not pulled, with the reason"),
        isDeepStrictEqual(healthAvailability(s), hm) && isDeepStrictEqual(healthAvailability({ ...s, meta: { ...s.meta, health: undefined } }), { pulled: false, reason: "predates-health", asOf: null, dayWindow: null, parts: {} }));
      // The runs with accounts on are the runs with health on.
      if (accounts) {
      check(at("meta.health, pulled: the day silence is counted from, the days held by day {start, endExclusive}, each of the six parts as {pulled, reason, basis} (basis one of window, lookback, all-time, as-documented, sample), and categories per reason part as {counted, reason, ids, configured}"),
        hm.pulled === true && hm.reason === null && DAY.test(hm.asOf) && keys(hm.dayWindow) === "endExclusive,start" && DAY.test(hm.dayWindow.start) && hm.dayWindow.start <= hm.asOf && hm.asOf < hm.dayWindow.endExclusive &&
          keys(hm.parts) === list(...PARTS) && PARTS.every((p) => keys(hm.parts[p]) === "basis,pulled,reason" && typeof hm.parts[p].pulled === "boolean" && ["window", "lookback", "all-time", "as-documented", "sample"].includes(hm.parts[p].basis) && (hm.parts[p].pulled ? hm.parts[p].reason === null : typeof hm.parts[p].reason === "string")) &&
          keys(hm.categories) === "bounceReasons,participantFailures" && Object.values(hm.categories).every((c) => keys(c) === list("counted", "reason", "ids", "configured") && typeof c.counted === "boolean" && (c.counted ? c.reason === null : typeof c.reason === "string") && Array.isArray(c.ids) && Array.isArray(c.configured)), hm);
      check(at("facts.health is exactly the six tables, each an array, and a part that was not read is an empty one"),
        keys(h) === list(...PARTS) && PARTS.every((p) => Array.isArray(h[p]) && (hm.parts[p].pulled || h[p].length === 0)), keys(h));
      check(at("bounceReasons rows: programId, templateId, month, recipientClass, bounceType, message, category, count, provenance, pulledAt — a category id with the category's label as the message, or other with no message; a whole count, below zero only on an other row of an overlapping list (none here)"),
        h.bounceReasons.length > 0 && h.bounceReasons.every((r) => keys(r) === list("programId", "templateId", "month", "recipientClass", "bounceType", "message", "category", "count", "provenance", "pulledAt") && Number.isInteger(r.count) && r.count !== 0 && (r.count > 0 || r.category === "other") && MONTH.test(r.month) &&
          ["internal", "external"].includes(r.recipientClass) && ["pulled", "carried"].includes(r.provenance) && typeof r.category === "string" && (r.category === "other" ? r.message === null : typeof r.message === "string" && r.message.length > 0) && text(r.bounceType)) &&
          h.bounceReasons.every((r) => r.count > 0), h.bounceReasons[0]);
      check(at("participantFailures rows: programId, message, category, expected, participants, occurrences; participantStates rows: programId, state, participants; failureSamples rows: programId, part, message (text, never null)"),
        h.participantFailures.length > 0 && h.participantFailures.every((r) => keys(r) === list("programId", "message", "category", "expected", "participants", "occurrences") && count(r.participants) && r.participants > 0 && count(r.occurrences) && typeof r.category === "string" && typeof r.expected === "boolean" && (r.category === "other" ? r.message === null : text(r.message))) &&
          h.participantStates.length > 0 && h.participantStates.every((r) => keys(r) === list("programId", "state", "participants") && count(r.participants) && text(r.state)) &&
          h.failureSamples.length > 0 && h.failureSamples.every((r) => keys(r) === list("programId", "part", "message") && ["bounceReasons", "participantFailures"].includes(r.part) && typeof r.message === "string" && r.message.length > 0), [h.participantFailures[0], h.participantStates[0], h.failureSamples[0]]);
      check(at("lastSends rows: programId, name, a statuses LIST, selected, lastSendDay (a day inside the day window, or null), lastSendMonth (YYYY-MM or null) — one per program in the pull"),
        h.lastSends.length >= d.programs.length && d.programs.every((p) => h.lastSends.some((r) => r.programId === p.id && r.selected === true)) &&
          h.lastSends.every((r) => keys(r) === list("programId", "name", "statuses", "selected", "lastSendDay", "lastSendMonth") && Array.isArray(r.statuses) && typeof r.selected === "boolean" &&
            (r.lastSendDay === null || (DAY.test(r.lastSendDay) && r.lastSendDay >= hm.dayWindow.start && r.lastSendDay < hm.dayWindow.endExclusive)) && (r.lastSendMonth === null || MONTH.test(r.lastSendMonth))), h.lastSends[0]);
      check(at("schedules rows: programId, asOf, source (kb or live), scheduleType, classification, cronExpression, timeZoneName, lastRunSuccess (boolean or null), lastSuccessTime, nextRunTime, runningNow — a live row is as of the pull"),
        h.schedules.length > 0 && h.schedules.every((r) => keys(r) === list("programId", "asOf", "source", "scheduleType", "classification", "cronExpression", "timeZoneName", "lastRunSuccess", "lastSuccessTime", "nextRunTime", "runningNow") &&
          [true, false, null].includes(r.lastRunSuccess) && typeof r.classification === "string" && ["kb", "live"].includes(r.source) && (r.source !== "live" || r.asOf === s.meta.pulledAt)) && h.schedules.some((r) => r.lastRunSuccess === false) && h.schedules.some((r) => r.source === "live"), h.schedules[0]);
      check(at("every stored message is MASKED or a category label: no address, no run of five or more digits, in any health table, the samples included"),
        [...h.bounceReasons, ...h.participantFailures, ...h.failureSamples].every((r) => r.message === null || (!r.message.includes("@") && !/\d{5,}/.test(r.message))) && h.failureSamples.some((r) => /<email>|<id>|<number>/.test(r.message)) && h.bounceReasons.some((r) => r.category !== "other"));
      }

      const av = s.meta.metricAvailability;
      const tpl = Object.values(av.clicks.templates);
      check(at("metricAvailability is {clicks{templates, programs}, responses{programs}}, per template with a per-program roll-up"),
        keys(av) === "clicks,responses" && keys(av.clicks) === "programs,templates" && keys(av.responses) === "programs" && tpl.length > 0 && keys(av.clicks.programs) === d.programs.map((p) => p.id).sort().join(",") && keys(av.responses.programs) === keys(av.clicks.programs));
      check(at("a template's availability is {state, evidence{clickHistory{everClicked, firstMonth, lastMonth}, linkSettings}}; a link-settings reading is {reading, asOf}"),
        tpl.every((t) => keys(t) === "evidence,state" && STATES.includes(t.state) && keys(t.evidence) === "clickHistory,linkSettings" && keys(t.evidence.clickHistory) === "everClicked,firstMonth,lastMonth" && typeof t.evidence.clickHistory.everClicked === "boolean" &&
          (t.evidence.linkSettings === null || (keys(t.evidence.linkSettings) === "asOf,reading" && ["tracked-link-present", "links-none-tracked", "unreadable"].includes(t.evidence.linkSettings.reading)))), tpl[0]);
      check(at("all three tracking states occur in the fixture pull"), new Set(tpl.map((t) => t.state)).size === 3, tpl.map((t) => t.state));
      check(at("a program roll-up is {state, templates{tracked, notTracked, unknown}}; a response availability is {state, evidence{surveyParticipants}}"),
        Object.values(av.clicks.programs).every((p) => keys(p) === "state,templates" && STATES.includes(p.state) && keys(p.templates) === "notTracked,tracked,unknown") &&
          Object.values(av.responses.programs).every((p) => keys(p) === "evidence,state" && STATES.includes(p.state) && keys(p.evidence) === "surveyParticipants"));
      // V0 shape 1: what a program's state MEANS is part of the contract.
      const rolled = Object.values(av.clicks.programs);
      const want = ({ tracked, notTracked, unknown }) => (tracked + notTracked + unknown > 0 && tracked === tracked + notTracked + unknown ? "tracked" : tracked + notTracked + unknown > 0 && notTracked === tracked + notTracked + unknown ? "not-tracked" : "unknown");
      check(at("a program roll-up is tracked only when EVERY template is, not-tracked only when every one is, and any mix is unknown; the counts are whole numbers"),
        rolled.every((p) => [p.templates.tracked, p.templates.notTracked, p.templates.unknown].every(count) && p.state === want(p.templates)) && rolled.some((p) => p.state === "unknown" && p.templates.tracked > 0) && rolled.some((p) => p.state === "tracked"), rolled);
      check(at("reconciliation is {ok, checks[{id, ok, compared, mismatches, examples, drift, driftExamples}]}: closed months fail, the incomplete period drifts; caveats are [{id, detail}]"),
        keys(s.reconciliation) === "checks,ok" && s.reconciliation.checks.length >= (accounts ? 4 : 3) && s.reconciliation.checks.some((c) => c.id === "accounts-sum-to-program") === accounts && s.reconciliation.checks.every((c) => keys(c) === "compared,drift,driftExamples,examples,id,mismatches,ok" && count(c.drift) && count(c.mismatches) && c.ok === (c.mismatches === 0)) &&
          s.reconciliation.ok === s.reconciliation.checks.every((c) => c.ok) && s.caveats.every((c) => keys(c) === "detail,id"), s.reconciliation.checks.map((c) => c.id));
      check(at("openSnapshot admits it"), openSnapshot(s) === s);
    }

    // The freeze itself: the version constant, the refusal, and the header that
    // carries the contract (a typedef that stops naming a pinned key is a
    // contract edit, and must arrive with this pin's own edit).
    check("T-10: schemaVersion is 1 and any other value is refused loudly", T10_SCHEMA_VERSION === 1 && [2, 0, "1", null].every((v) => { try { openSnapshot({ ...fixture, schemaVersion: v }); return false; } catch (e) { return /refusing to read it \(T-10\)/.test(e.message); } }));
    const engSrc = readFileSync(ENGINE, "utf8");
    const header = engSrc.slice(engSrc.indexOf("// ── T-10 ·"), engSrc.indexOf("// ── The source-adapter interface"));
    const named = (k) => new RegExp(`@property \\{[^\\n]*\\} \\[?${k}\\]?( |$)`, "m").test(header);
    const PINNED = ["schemaVersion", "kind", "meta", "dimensions", "facts", "honesty", "reconciliation", "caveats", "byTemplate", "byStep", "byAccount", "responses", "responseParticipants", "uniques", "metricAvailability", "participantRecords", "accounts", "incompleteFrom", "pulledAt", "health", "bounceReasons", "participantFailures", "participantStates", "lastSends", "schedules", "failureSamples", ...MEASURES];
    check("T-10: the producer's header is marked FROZEN and names every pinned top-level key, table and measure", /FROZEN \(ENG-1, 2026-10-03\)/.test(header) && PINNED.every(named), PINNED.filter((k) => !named(k)));
    check("T-10: the header also states the adapter interface (plan / fetch / reduce) and the transport seam", /@typedef \{object\} EngagementSourceAdapter/.test(engSrc) && /@typedef \{object\} EngagementTransport/.test(engSrc));
  } finally {
    removeTempDir(t10);
  }
}

// ── T-11 · dashboard spec, executed through its one writer ───────────────────
// DSH-1: the spec scripts/dashboard-spec.mjs writes — a new draft saved as it
// stands (the defaults), and one changed through set — and the committed
// fixture spec beside them. Key sets are hand-spelled from the frozen typedef,
// never imported: a field added, dropped or renamed at the writer reds here
// until the typedef, its description and this pin move together. What a value
// MEANS is the spec suite's (test/dashboard-spec.mjs); this section owns the
// SHAPE.
{
  const t11 = makeTempDir("contract-conformance-t11");
  try {
    const WRITER = join(HERE, "..", "scripts", "dashboard-spec.mjs");
    const KB = join(t11, "acme-prod");
    writeFiles(t11, { "acme-prod/_manifest.json": JSON.stringify({ slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com", environment: "production", inventory: {} }) });
    const write = (slug, sets) => {
      const steps = [["draft", "--slug", slug], ...(sets.length ? [["set", "--slug", slug, ...sets.flatMap(([p, v]) => ["--set", p + "=" + JSON.stringify(v)])]] : []), ["save", "--slug", slug]];
      const ok = steps.every(([mode, ...args]) => runNode(WRITER, [mode, "--kb", KB, ...args]).status === 0);
      check("T-11: the writer drafts" + (sets.length ? ", sets" : "") + " and saves (" + slug + ")", ok);
      return ok ? JSON.parse(readFileSync(join(KB, "dashboards", slug, "spec.json"), "utf8")) : null;
    };
    const defaults = write("t11-defaults", []);
    const changed = write("t11-changed", [
      ["sources.0.params.internalDomains", ["acme.com"]], ["accounts.pull", true], ["sources.0.params.stepDetail", true],
      ["groups.rules", [{ kind: "characteristic", level: "supergroup", characteristic: "sendsSurveys", is: true, label: "Surveys" }, { kind: "folder", level: "group", folders: [{ id: "202", label: "Renewals" }] }]],
      ["groups.overrides.p-pilot", { supergroup: "Internal" }],
      ["pages.0.panels", [{ id: "programs", tab: "engagement", type: "table", title: "Programs", query: { groupBy: ["program"], metrics: ["sent", "openRate"] } }]],
    ]);
    const fixture = JSON.parse(readFileSync(join(HERE, "fixtures", "engagement", "spec-acme.json"), "utf8"));

    const keys = (o) => Object.keys(o).sort().join(",");
    const list = (...names) => names.slice().sort().join(",");
    const TAB_IDS = ["engagement", "health", "templates", "about"];
    const STATUSES = ["PROCESSING", "PAUSE", "NEW", "STOP"];
    const whole = (v, min) => Number.isInteger(v) && v >= min;
    for (const [which, s] of /** @type {Array<[string, *]>} */ ([["the defaults", defaults], ["changed through set", changed], ["the committed fixture spec", fixture]])) {
      if (!s) continue;
      const at = (label) => "T-11 (" + which + "): " + label;
      check(at("top level is exactly {schemaVersion 1, kind dashboard-spec, slug, title, owner, purpose, tenantHost, sources, globalFilters, accounts, groups, health, pages, freshness, refresh, publish, native}"),
        keys(s) === list("schemaVersion", "kind", "slug", "title", "owner", "purpose", "tenantHost", "sources", "globalFilters", "accounts", "groups", "health", "pages", "freshness", "refresh", "publish", "native") &&
          s.schemaVersion === 1 && s.kind === "dashboard-spec" && typeof s.slug === "string" && typeof s.title === "string" && s.tenantHost === "acme.gainsightcloud.com", keys(s));
      check(at("a source is {adapter jo-engagement, params}; params are exactly {windowMonths, selector{sentSince, names, ids}, internalDomains, unsubscribeLinks, testAccounts, pinnedAccounts, stepDetail, repullMonths} — the step-detail switch a boolean"),
        s.sources.length >= 1 && s.sources.every((src) => keys(src) === "adapter,params" && src.adapter === "jo-engagement" &&
          keys(src.params) === list("windowMonths", "selector", "internalDomains", "unsubscribeLinks", "testAccounts", "pinnedAccounts", "stepDetail", "repullMonths") && keys(src.params.selector) === "ids,names,sentSince" &&
          whole(src.params.windowMonths, 1) && whole(src.params.repullMonths, 1) && typeof src.params.stepDetail === "boolean" &&
          [src.params.internalDomains, src.params.unsubscribeLinks, src.params.testAccounts, src.params.pinnedAccounts, src.params.selector.names, src.params.selector.ids].every(Array.isArray)), s.sources[0]);
      check(at("globalFilters are {id, enabled} for dateRange, programs, group and status, and {id, enabled, default all|external} for recipientClass"),
        s.globalFilters.map((f) => f.id).join() === "dateRange,programs,group,status,recipientClass" && s.globalFilters.every((f) => typeof f.enabled === "boolean" && keys(f) === (f.id === "recipientClass" ? "default,enabled,id" : "enabled,id")) &&
          ["all", "external"].includes(s.globalFilters.at(-1).default), s.globalFilters);
      check(at("accounts is exactly {pull, busiest, lowEngagement, mostBounces, lowEngagementMinDelivered}: the switch a boolean, the four selection counts whole numbers"),
        keys(s.accounts) === list("pull", "busiest", "lowEngagement", "mostBounces", "lowEngagementMinDelivered") && typeof s.accounts.pull === "boolean" && ["busiest", "lowEngagement", "mostBounces", "lowEngagementMinDelivered"].every((k) => whole(s.accounts[k], 0)), s.accounts);
      check(at("groups is exactly {rules, overrides}: every rule carries a kind and one of the two levels, an override names a supergroup, a group or both"),
        keys(s.groups) === "overrides,rules" && Array.isArray(s.groups.rules) && s.groups.rules.every((r) => ["characteristic", "folder", "namePattern", "programField", "manual"].includes(r.kind) && ["supergroup", "group"].includes(r.level)) &&
          Object.values(s.groups.overrides).every((o) => Object.keys(o).length > 0 && Object.keys(o).every((k) => ["supergroup", "group"].includes(k))), s.groups);
      check(at("health is {silentDays}, freshness {maxAgeDays}, refresh {cadence, ownerNote}, publish {target none, config {}}, native {reports[]}"),
        keys(s.health) === "silentDays" && whole(s.health.silentDays, 1) && keys(s.freshness) === "maxAgeDays" && whole(s.freshness.maxAgeDays, 1) && keys(s.refresh) === "cadence,ownerNote" && ["weekly", "monthly", "quarterly", "manual"].includes(s.refresh.cadence) &&
          keys(s.publish) === "config,target" && s.publish.target === "none" && keys(s.publish.config) === "" && keys(s.native) === "reports" && Array.isArray(s.native.reports), [s.health, s.freshness, s.refresh, s.publish, s.native]);
      check(at("a page is exactly {id, preset admin|exec, title, statusDefault, tabs, panels, accountNames, sourceDetail}; statusDefault is a list of statuses or null for every status; tabs are the four, in order, each {id, enabled}, About on"),
        s.pages.length >= 1 && s.pages.every((p) => keys(p) === list("id", "preset", "title", "statusDefault", "tabs", "panels", "accountNames", "sourceDetail") && ["admin", "exec"].includes(p.preset) &&
          (p.statusDefault === null || (Array.isArray(p.statusDefault) && p.statusDefault.length > 0 && p.statusDefault.every((x) => STATUSES.includes(x)))) &&
          p.tabs.map((t) => t.id).join() === TAB_IDS.join() && p.tabs.every((t) => keys(t) === "enabled,id" && typeof t.enabled === "boolean") && p.tabs.find((t) => t.id === "about").enabled === true &&
          typeof p.accountNames === "boolean" && typeof p.sourceDetail === "boolean" && Array.isArray(p.panels)), s.pages[0]);
      check(at("a panel is {id, tab, type, title, query{metrics, groupBy?, sort?, having?, limit?}, columns?}: a query for the engine, never a widget of its own"),
        s.pages.flatMap((p) => p.panels).every((pn) => ["id", "tab", "type", "title", "query"].every((k) => k in pn) && Object.keys(pn).every((k) => ["id", "tab", "type", "title", "query", "columns"].includes(k)) && ["kpi", "bar", "line", "table", "watchlist"].includes(pn.type) &&
          Array.isArray(pn.query.metrics) && pn.query.metrics.length > 0 && Object.keys(pn.query).every((k) => ["groupBy", "metrics", "sort", "having", "limit"].includes(k))), s.pages[0].panels[0]);
      check(at("openSpec admits it"), openSpec(s) === s);
    }
    if (defaults) {
      check("T-11 defaults: the admin page shows Active programs at first and every tab; the exec page every status, with Health and Templates off and no account names (R23, R6); accounts and step detail are off; the cadence is monthly (R8)",
        isDeepStrictEqual(defaults.pages.map((p) => [p.id, p.preset, p.statusDefault, p.tabs.filter((t) => t.enabled).map((t) => t.id).join(), p.accountNames]), [["admin", "admin", ["PROCESSING"], "engagement,health,templates,about", true], ["exec", "exec", null, "engagement,about", false]]) &&
          defaults.accounts.pull === false && isDeepStrictEqual([defaults.accounts.busiest, defaults.accounts.lowEngagement, defaults.accounts.mostBounces, defaults.accounts.lowEngagementMinDelivered], [20, 15, 15, 10]) &&
          defaults.sources[0].params.stepDetail === false && defaults.refresh.cadence === "monthly" && isDeepStrictEqual(defaults.groups, { rules: [], overrides: {} }), defaults.pages);
    }
    check("T-11: schemaVersion is 1 and any other value is refused loudly", T11_SCHEMA_VERSION === 1 && [2, 0, "1", null].every((v) => { try { openSpec({ ...fixture, schemaVersion: v }); return false; } catch (e) { return /refusing to read it \(T-11\)/.test(e.message); } }));
    const src = readFileSync(WRITER, "utf8");
    const header = src.slice(src.indexOf("// ── T-11 ·"), src.indexOf("import { existsSync"));
    const named = (k) => new RegExp("@property \\{[^\\n]*\\} \\[?(params\\.)?" + k + "\\]?( |$)", "m").test(header);
    const PINNED = ["schemaVersion", "kind", "slug", "title", "owner", "purpose", "tenantHost", "sources", "globalFilters", "accounts", "groups", "health", "pages", "freshness", "refresh", "publish", "native",
      "adapter", "params", "windowMonths", "selector", "internalDomains", "unsubscribeLinks", "testAccounts", "pinnedAccounts", "stepDetail", "repullMonths", "rules", "overrides", "level", "preset", "statusDefault", "tabs", "panels", "accountNames", "sourceDetail", "query", "columns"];
    check("T-11: the writer's header is marked FROZEN and names every pinned field", /FROZEN \(DSH-1, 2026-10-04\)/.test(header) && PINNED.every(named), PINNED.filter((k) => !named(k)));
  } finally {
    removeTempDir(t11);
  }
}

if (failures) {
  console.log(`\ncontract-conformance: ${failures} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`contract-conformance: all ${passed} checks passed`);
