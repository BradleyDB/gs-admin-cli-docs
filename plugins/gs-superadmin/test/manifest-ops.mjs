#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// manifest-ops.mjs — tests for scripts/manifest.mjs crawl / stub / depth verbs
//
// Covers: crawl get/set/invalid, next --domain filtering, stub writing
// metadata docs + marking depth, stub never downgrading a full doc,
// next --upgrade selecting stubs awaiting deep ingest, the deep-ingest
// completion transition, the upsert-batch re-index guard (recorded
// idField + legacy shape-heuristic fallback), the date-field recording
// (--date-field / --no-date-field stamps, recorded fallback, redate guard +
// --allow-redate, baseline adoption over null-stored dates, epoch-ms
// ordering in newerThan), the under-count warning and the --partial
// deliberate-subset declaration (F-313), the mass-stale advisory,
// mark --fingerprint validation, and mark --keys-file/--limit batch marking
// (all-or-nothing, file-order limit, BOM tolerance — F-162). Fixtures live
// under the OS temp dir; no real state.
//
// Run:  node plugins/gs-superadmin/test/manifest-ops.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "manifest.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-manifest-ops-${process.pid}`);
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });

function run(verb, args) {
  const res = spawnSync(process.execPath, [SCRIPT, verb, ...args], { encoding: "utf8" });
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch { /* non-JSON output (failure path) */ }
  return { code: res.status, json, stderr: res.stderr.trim() };
}

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)}`);
  }
}

const M = join(ROOT, "acme-sbx", "_manifest.json");
run("init", ["--manifest", M, "--slug", "acme-sbx", "--base-url", "https://a.example", "--environment", "sandbox"]);

// Inventory: 3 templates (bulk domain) + 1 rule (small domain)
const listFile = join(ROOT, "templates.json");
writeFileSync(listFile, JSON.stringify({
  data: [
    { templateId: "t-1", title: "Welcome", folderName: "Onboarding", active: true, variantCount: 2 },
    { templateId: "t-2", title: "Renewal|Alert", folderName: "CS", active: false, variantCount: 1 },
    { templateId: "t 3", title: "Spaces In Id", folderName: "CS", active: true, variantCount: 0 },
  ],
}));
const rulesFile = join(ROOT, "rules.json");
writeFileSync(rulesFile, JSON.stringify({ data: [{ id: "r-1", name: "Risk Rule" }] }));
// The templates domain records a describe command (it is describable in real
// life — the F-334 banner branch below keys on exactly this recording).
run("upsert-batch", ["--manifest", M, "--file", listFile, "--domain", "journey-email-templates", "--id-field", "templateId", "--name-field", "title", "--describe-command", "gs-admin --json jo email-template describe --id {id}"]);
run("upsert-batch", ["--manifest", M, "--file", rulesFile, "--domain", "rules-engine-rules", "--id-field", "id", "--name-field", "name"]);

// ── crawl mode ────────────────────────────────────────────────────────────────
let r = run("crawl", ["--manifest", M]);
check("crawl: unset reads as null", r.code === 0 && r.json?.crawl_mode === null, r);
r = run("crawl", ["--manifest", M, "--set", "shallow"]);
check("crawl: --set shallow records and echoes", r.code === 0 && r.json?.crawl_mode === "shallow", r);
check("crawl: persisted to disk", JSON.parse(readFileSync(M, "utf8")).crawl_mode === "shallow", null);
r = run("crawl", ["--manifest", M, "--set", "basic"]); // pre-rename value must not sneak in
check("crawl: invalid mode rejected (exit 1)", r.code === 1 && /shallow or deep/.test(r.stderr), r);

// ── next --domain ─────────────────────────────────────────────────────────────
r = run("next", ["--manifest", M, "--domain", "rules-engine-rules"]);
check("next: --domain filters to that domain only", r.json?.count === 1 && r.json.entries[0].key === "rules-engine-rules/r-1", r);

// ── stub: never downgrades a full doc ────────────────────────────────────────
run("mark", ["--manifest", M, "--key", "journey-email-templates/t-1", "--status", "documented"]);
const outDir = join(ROOT, "acme-sbx", "journey-email-templates");
r = run("stub", ["--manifest", M, "--file", listFile, "--domain", "journey-email-templates", "--id-field", "templateId", "--name-field", "title", "--out-dir", outDir]);
check("stub: stubs pending entries, skips the full-documented one", r.json?.stubbed === 2 && r.json?.skippedFull === 1, r);
check("stub: no stub file written for the full-documented entry", !existsSync(join(outDir, "t-1.md")), readdirSync(outDir));
check("stub: sanitized ids get a deterministic hash-suffixed filename", readdirSync(outDir).some((f) => /^t_3-[0-9a-f]{8}\.md$/.test(f)), readdirSync(outDir));

const stubDoc = readFileSync(join(outDir, "t-2.md"), "utf8");
check("stub: describable domain's doc carries the stub banner and --deep pointer, never the list-only text (F-334)", /Metadata-only stub/.test(stubDoc) && /--deep journey-email-templates/.test(stubDoc) && !/list-only \(complete\)/.test(stubDoc), stubDoc.slice(0, 200));
check("stub: doc carries list-payload fields", /- title: Renewal\|Alert/.test(stubDoc) && /- active: false/.test(stubDoc), stubDoc);

let inv = JSON.parse(readFileSync(M, "utf8")).inventory;
check("stub: marks documented at depth metadata with doc_path", inv["journey-email-templates/t-2"].status === "documented" && inv["journey-email-templates/t-2"].depth === "metadata" && /t-2\.md$/.test(inv["journey-email-templates/t-2"].doc_path), inv["journey-email-templates/t-2"]);
check("mark: plain documented defaults to depth full", inv["journey-email-templates/t-1"].depth === "full", inv["journey-email-templates/t-1"]);

// ── next --upgrade (the --deep flow) ─────────────────────────────────────────
r = run("next", ["--manifest", M, "--domain", "journey-email-templates", "--upgrade"]);
check("next: --upgrade returns only metadata stubs", r.json?.count === 2 && r.json.entries.every((e) => e.depth === "metadata"), r);

// Deep-ingest completion: full mark removes it from the upgrade queue
run("mark", ["--manifest", M, "--key", "journey-email-templates/t-2", "--status", "documented", "--depth", "full"]);
r = run("next", ["--manifest", M, "--domain", "journey-email-templates", "--upgrade"]);
check("next: --upgrade drops entries after full ingest", r.json?.count === 1 && r.json.entries[0].key === "journey-email-templates/t 3", r);

// stub is idempotent-safe on re-run: re-stubs remaining metadata stub, skips both fulls
r = run("stub", ["--manifest", M, "--file", listFile, "--domain", "journey-email-templates", "--id-field", "templateId", "--name-field", "title", "--out-dir", outDir]);
check("stub: re-run skips full docs, refreshes the metadata stub", r.json?.stubbed === 1 && r.json?.skippedFull === 2, r);

// mark without --depth must not promote a metadata stub out of the upgrade queue
r = run("mark", ["--manifest", M, "--key", "journey-email-templates/t 3", "--status", "documented"]);
check("mark: documented without --depth keeps existing metadata depth", r.json?.depth === "metadata", r);
r = run("next", ["--manifest", M, "--domain", "journey-email-templates", "--upgrade"]);
check("next: --upgrade still offers the un-promoted stub", r.json?.count === 1 && r.json.entries[0].key === "journey-email-templates/t 3", r);

// stub never downgrades a full doc even when refresh flipped the entry to stale
writeFileSync(join(outDir, "t-2.md"), "# full doc sentinel\n");
run("mark", ["--manifest", M, "--key", "journey-email-templates/t-2", "--status", "stale"]);
r = run("stub", ["--manifest", M, "--file", listFile, "--domain", "journey-email-templates", "--id-field", "templateId", "--name-field", "title", "--out-dir", outDir]);
check("stub: stale entry with a full doc is skipped, not downgraded", r.json?.stubbed === 1 && r.json?.skippedFull === 2, r);
check("stub: the stale full doc file is untouched", readFileSync(join(outDir, "t-2.md"), "utf8").includes("full doc sentinel"), null);
inv = JSON.parse(readFileSync(M, "utf8")).inventory;
check("stub: stale full entry keeps status stale + depth full", inv["journey-email-templates/t-2"].status === "stale" && inv["journey-email-templates/t-2"].depth === "full", inv["journey-email-templates/t-2"]);

// mark rejects invalid depth
r = run("mark", ["--manifest", M, "--key", "rules-engine-rules/r-1", "--status", "documented", "--depth", "shallow"]);
check("mark: invalid depth rejected (exit 1)", r.code === 1 && /metadata or full/.test(r.stderr), r);

// ── domains_indexed: "listed, empty" is distinct from "never listed" ─────────
const emptyFile = join(ROOT, "connectors.json");
writeFileSync(emptyFile, JSON.stringify({ data: [] }));
r = run("upsert-batch", ["--manifest", M, "--file", emptyFile, "--domain", "connectors", "--id-field", "id"]);
check("upsert: empty list succeeds with added 0", r.code === 0 && r.json?.added === 0, r);

r = run("report", ["--manifest", M]);
check("report: empty domain stamped in domains_indexed with {at, idField, itemsPath}", typeof r.json?.domains_indexed?.connectors?.at === "string" && r.json?.domains_indexed?.connectors?.idField === "id" && r.json?.domains_indexed?.connectors?.itemsPath === null, r);
check("report: emptyDomains lists it", Array.isArray(r.json?.emptyDomains) && r.json.emptyDomains.includes("connectors"), r);
check("report: populated domains stamped too, not in emptyDomains", r.json?.domains_indexed?.["journey-email-templates"]?.idField === "templateId" && !r.json.emptyDomains.includes("journey-email-templates"), r);
check("report: never-listed domain absent from domains_indexed", !("data-designer-sources" in (r.json?.domains_indexed ?? {})), r);
// F-427: report echoes `environment`, so refresh step 1's backfill branch is
// decided from the command step 1 prescribes. A recorded value is echoed; a
// legacy manifest with NO key reads null (same as one initialised without
// --environment), and a hand-removed key is restored by init's backfill.
check("f427: report echoes the recorded environment", r.json?.environment === "sandbox", r.json?.environment);
{
  const legacy = JSON.parse(readFileSync(M, "utf8"));
  const savedEnv = legacy.environment;
  delete legacy.environment;
  writeFileSync(M, JSON.stringify(legacy, null, 2) + "\n");
  const rr = run("report", ["--manifest", M]);
  check("f427: a legacy manifest with no environment key reports environment null (the backfill trigger)", rr.code === 0 && rr.json?.environment === null && Object.hasOwn(rr.json ?? {}, "environment"), rr.json?.environment);
  run("init", ["--manifest", M, "--environment", savedEnv]);
  check("f427: init backfills it and report echoes the restored value", run("report", ["--manifest", M]).json?.environment === savedEnv, null);
}

// ── Re-index guard: wrong --id-field must not silently duplicate a domain ────
const uuid = (n) => `${String(n).padStart(8, "0")}-1111-4111-8111-1234567890ab`;
const guardedFile = join(ROOT, "guarded.json");
// folderId is a second uuid-shaped column: wrong field, same shape as the right one
writeFileSync(guardedFile, JSON.stringify({
  data: [1, 2, 3].map((n) => ({ id: uuid(n), folderId: uuid(100 + n), name: `sf_object_${n}` })),
}));
run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "guarded", "--id-field", "id", "--name-field", "name"]);

// Wrong field, different shape (name): recorded-field mismatch → hard fail
r = run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "guarded", "--id-field", "name"]);
check("guard: wrong id-field rejected (exit 1, names both fields)", r.code === 1 && /--id-field name does not match --id-field id/.test(r.stderr) && /--allow-rekey/.test(r.stderr), r);

// Wrong field, SAME shape (folderId — both uuid): the shape heuristic is blind
// to this; the recorded idField catches it directly.
r = run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "guarded", "--id-field", "folderId"]);
check("guard: same-shape wrong id-field rejected via recorded idField", r.code === 1 && /--id-field folderId does not match --id-field id/.test(r.stderr), r);
check("guard: rejected upserts leave no duplicates", Object.keys(JSON.parse(readFileSync(M, "utf8")).inventory).filter((k) => k.startsWith("guarded/")).length === 3, null);

// Pagination case: same field, all-new ids (zero overlap, same shape) → allowed
const pageFile = join(ROOT, "guarded-page2.json");
writeFileSync(pageFile, JSON.stringify({ data: [4, 5, 6].map((n) => ({ id: uuid(n), folderId: uuid(100 + n), name: `sf_object_${n}` })) }));
r = run("upsert-batch", ["--manifest", M, "--file", pageFile, "--domain", "guarded", "--id-field", "id"]);
check("guard: later page with same id-field passes (zero overlap is fine)", r.code === 0 && r.json?.added === 3 && r.json?.matchedExisting === 0, r);

// Deliberate re-key with --allow-rekey → allowed, and the recorded field moves
r = run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "guarded", "--id-field", "name", "--allow-rekey"]);
check("guard: --allow-rekey overrides", r.code === 0 && r.json?.added === 3, r);
check("guard: --allow-rekey re-records the new idField", JSON.parse(readFileSync(M, "utf8")).domains_indexed?.guarded?.idField === "name", null);

// Going back to the original field is itself a re-key now
r = run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "guarded", "--id-field", "id"]);
check("guard: reverting the field without --allow-rekey is rejected", r.code === 1 && /does not match --id-field name/.test(r.stderr), r);
r = run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "guarded", "--id-field", "id", "--allow-rekey"]);
check("guard: matchedExisting reported on re-upsert", r.json?.matchedExisting === 3 && r.json?.unchanged === 3, r);

// Small domain (<3 entries): the old shape heuristic never fired here; the
// recorded idField protects from the very first entry.
const tinyFile = join(ROOT, "tiny.json");
writeFileSync(tinyFile, JSON.stringify({ data: [{ id: uuid(7), folderId: uuid(107), name: "only_one" }] }));
run("upsert-batch", ["--manifest", M, "--file", tinyFile, "--domain", "tiny", "--id-field", "id"]);
r = run("upsert-batch", ["--manifest", M, "--file", tinyFile, "--domain", "tiny", "--id-field", "folderId"]);
check("guard: domain with 1 entry still protected by recorded idField", r.code === 1 && /does not match --id-field id/.test(r.stderr), r);

// Empty domain: the recorded field was never validated by data and there is
// nothing to duplicate — switching fields is allowed and re-recorded.
r = run("upsert-batch", ["--manifest", M, "--file", emptyFile, "--domain", "connectors", "--id-field", "connectorId"]);
check("guard: id-field switch on an empty domain passes", r.code === 0, r);
check("guard: empty-domain switch re-records idField", JSON.parse(readFileSync(M, "utf8")).domains_indexed?.connectors?.idField === "connectorId", null);

// Legacy fallback: a pre-0.9.10 manifest stamped domains_indexed with a bare
// timestamp string — no recorded field to compare, so the shape heuristic
// still applies (and same-shape wrong fields still slip it, its known limit).
run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "legacy", "--id-field", "id", "--name-field", "name"]);
const legacyM = JSON.parse(readFileSync(M, "utf8"));
legacyM.domains_indexed.legacy = "2026-01-01T00:00:00.000Z";
writeFileSync(M, JSON.stringify(legacyM, null, 2) + "\n");
r = run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "legacy", "--id-field", "name"]);
check("guard: legacy stamp falls back to shape heuristic (different shape fails)", r.code === 1 && /--id-field name looks wrong/.test(r.stderr), r);
r = run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "legacy", "--id-field", "id"]);
check("guard: legacy stamp upgraded to {at, idField} on next successful upsert", r.code === 0 && JSON.parse(readFileSync(M, "utf8")).domains_indexed?.legacy?.idField === "id", r);

// ── --allow-empty: stamping a domain whose empty payload has no items array ──
const noArrayFile = join(ROOT, "no-array.json");
writeFileSync(noArrayFile, JSON.stringify({ message: "no results", pageInfo: { returned: 0 } }));
r = run("upsert-batch", ["--manifest", M, "--file", noArrayFile, "--domain", "journey-surveys", "--id-field", "id"]);
check("allow-empty: array-less payload fails without the flag", r.code === 1 && /--items-path/.test(r.stderr), r);
r = run("upsert-batch", ["--manifest", M, "--file", noArrayFile, "--domain", "journey-surveys", "--id-field", "id", "--allow-empty"]);
check("allow-empty: array-less payload stamps the domain as listed-empty", r.code === 0 && r.json?.added === 0, r);
r = run("report", ["--manifest", M]);
check("allow-empty: stamped domain shows in emptyDomains", r.json?.emptyDomains.includes("journey-surveys"), r);

// ── Rekey orphans: old-key entries are reported and removable, never hand-edited ──
// "guarded" is id-keyed with 6 uuid entries + 3 name-keyed leftovers from the
// rekey dance above; rekeying to name strands the 6 uuid-keyed ones.
const orphansFile = join(ROOT, "orphans.json");
r = run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "guarded", "--id-field", "name", "--allow-rekey", "--orphans-file", orphansFile]);
check("rekey: orphaned old-key entries counted", r.code === 0 && r.json?.orphanedKeys === 6, r);
const orphanKeys = JSON.parse(readFileSync(orphansFile, "utf8"));
check("rekey: --orphans-file holds the full key list", Array.isArray(orphanKeys) && orphanKeys.length === 6 && orphanKeys.every((k) => k.startsWith("guarded/")), orphanKeys);

r = run("remove", ["--manifest", M, "--keys-file", orphansFile]);
check("remove: --keys-file drops all orphans", r.code === 0 && r.json?.removed === 6 && r.json?.missing.length === 0, r);
check("remove: only the re-keyed entries remain in the domain", Object.keys(JSON.parse(readFileSync(M, "utf8")).inventory).filter((k) => k.startsWith("guarded/")).length === 3, null);

r = run("remove", ["--manifest", M, "--key", "guarded/never-existed"]);
check("remove: missing key reported, not fatal", r.code === 0 && r.json?.removed === 0 && r.json?.missing[0] === "guarded/never-existed", r);
r = run("remove", ["--manifest", M, "--key", "journey-email-templates/t-2"]);
check("remove: doc_path of a removed entry reported for cleanup", r.code === 0 && r.json?.removed === 1 && r.json?.docPaths.some((p) => /t-2\.md$/.test(p)), r);
r = run("remove", ["--manifest", M]);
check("remove: no selector rejected (exit 1)", r.code === 1 && /--key|--keys-file/.test(r.stderr), r);

// ── F-206: remove dedupes its key list the way mark does (F-169) ─────────────
// A key listed twice (pagination overlap in a model-assembled deletion list)
// must not be reported both removed AND missing — the phantom `missing` entry
// sends a reader chasing a non-existent inventory mismatch.
const dupDomainFile = join(ROOT, "dupdom.json");
writeFileSync(dupDomainFile, JSON.stringify({ data: [{ id: "d-1", name: "Dup One" }, { id: "d-2", name: "Dup Two" }] }));
run("upsert-batch", ["--manifest", M, "--file", dupDomainFile, "--domain", "dupdom", "--id-field", "id", "--name-field", "name"]);
const dupRemoveFile = join(ROOT, "remove-dup.json");
writeFileSync(dupRemoveFile, JSON.stringify(["dupdom/d-1", "dupdom/d-1"]));
r = run("remove", ["--manifest", M, "--keys-file", dupRemoveFile]);
check("remove: doubled keys-file key removed once, no phantom missing", r.code === 0 && r.json?.removed === 1 && r.json?.missing.length === 0, r);
const dupRemoveFile2 = join(ROOT, "remove-dup2.json");
writeFileSync(dupRemoveFile2, JSON.stringify(["dupdom/d-2"]));
r = run("remove", ["--manifest", M, "--key", "dupdom/d-2", "--keys-file", dupRemoveFile2]);
check("remove: --key duplicating a keys-file entry folds too", r.code === 0 && r.json?.removed === 1 && r.json?.missing.length === 0, r);

// ── Rekey orphans on a LEGACY stamp: the shape-heuristic path captures too ───
// A pre-0.9.10 manifest has no recorded idField; a deliberate rekey there must
// still report/write orphans, or the SKILL's follow-up remove finds no file.
run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "legacy2", "--id-field", "id", "--name-field", "name"]);
const legacy2M = JSON.parse(readFileSync(M, "utf8"));
legacy2M.domains_indexed.legacy2 = "2026-01-01T00:00:00.000Z"; // bare legacy stamp
writeFileSync(M, JSON.stringify(legacy2M, null, 2) + "\n");
// gate-3 F-352: the orphan list is written atomically through doc-lib's single
// copy — a parent directory that does not exist yet is created, not a crash.
const legacyOrphans = join(ROOT, "orphans-dir-that-did-not-exist", "legacy-orphans.json");
r = run("upsert-batch", ["--manifest", M, "--file", guardedFile, "--domain", "legacy2", "--id-field", "name", "--allow-rekey", "--orphans-file", legacyOrphans]);
check("rekey: legacy-stamped rekey still reports orphans", r.code === 0 && r.json?.orphanedKeys === 3, r);
check("rekey: legacy-stamped rekey writes --orphans-file", existsSync(legacyOrphans) && JSON.parse(readFileSync(legacyOrphans, "utf8")).length === 3, null);

// ── mark --doc-path records where the doc landed ─────────────────────────────
r = run("mark", ["--manifest", M, "--key", "rules-engine-rules/r-1", "--status", "documented", "--doc-path", "acme-sbx/rules-engine-rules/r-1.md"]);
check("mark: --doc-path recorded on the entry", r.code === 0 && JSON.parse(readFileSync(M, "utf8")).inventory["rules-engine-rules/r-1"].doc_path === "acme-sbx/rules-engine-rules/r-1.md", r);

// ── next: failed entries sort last so they never starve untried assets ──────
const sortFile = join(ROOT, "sortdom.json");
writeFileSync(sortFile, JSON.stringify({ data: [{ id: "a-1" }, { id: "z-9" }] }));
run("upsert-batch", ["--manifest", M, "--file", sortFile, "--domain", "sortdom", "--id-field", "id"]);
run("mark", ["--manifest", M, "--key", "sortdom/a-1", "--status", "failed", "--error", "boom"]);
r = run("next", ["--manifest", M, "--domain", "sortdom", "--limit", "1"]);
check("next: pending beats an alphabetically-earlier failed entry", r.json?.entries[0]?.key === "sortdom/z-9", r);

// ── next --upgrade: a failed ingest attempt stays retryable ──────────────────
run("mark", ["--manifest", M, "--key", "journey-email-templates/t 3", "--status", "failed", "--error", "simulated deep-ingest failure"]);
r = run("next", ["--manifest", M, "--domain", "journey-email-templates", "--upgrade"]);
check("next: --upgrade keeps a failed metadata stub in the queue", r.json?.count === 1 && r.json.entries[0].key === "journey-email-templates/t 3" && r.json.entries[0].status === "failed", r);

// ── BOM tolerance: PowerShell 5.1 Out-File -Encoding utf8 prefixes a BOM ────
const bomFile = join(ROOT, "bom.json");
writeFileSync(bomFile, "\uFEFF" + JSON.stringify({ data: [{ id: "b-1", name: "Bommed" }] }));
r = run("upsert-batch", ["--manifest", M, "--file", bomFile, "--domain", "bomdom", "--id-field", "id", "--name-field", "name"]);
check("upsert: UTF-8 BOM-prefixed list file parses", r.code === 0 && r.json?.added === 1, r);

// ── --describe-command: recorded describe recipes in domains_indexed ─────────
const recipeFile = join(ROOT, "recipes.json");
writeFileSync(recipeFile, JSON.stringify({ data: [{ id: "rec-1", name: "Recipe One" }] }));
r = run("upsert-batch", ["--manifest", M, "--file", recipeFile, "--domain", "recipedom", "--id-field", "id", "--name-field", "name", "--describe-command", "gs-admin --json re r describe --id {id}"]);
check("recipe: upsert with --describe-command succeeds", r.code === 0 && r.json?.added === 1, r);
const di = JSON.parse(readFileSync(M, "utf8")).domains_indexed?.recipedom;
check("recipe: describeCommand recorded alongside {at, idField, itemsPath}", di?.describeCommand === "gs-admin --json re r describe --id {id}" && di?.idField === "id", di);
r = run("upsert-batch", ["--manifest", M, "--file", recipeFile, "--domain", "recipedom", "--id-field", "id", "--name-field", "name"]);
check("recipe: re-index without the flag keeps the recording", r.code === 0 && JSON.parse(readFileSync(M, "utf8")).domains_indexed?.recipedom?.describeCommand === "gs-admin --json re r describe --id {id}", r);
r = run("upsert-batch", ["--manifest", M, "--file", recipeFile, "--domain", "recipedom", "--id-field", "id", "--name-field", "name", "--describe-command", "gs-admin --json re r describe --name {name}"]);
check("recipe: passing the flag again overwrites the recording", r.code === 0 && JSON.parse(readFileSync(M, "utf8")).domains_indexed?.recipedom?.describeCommand === "gs-admin --json re r describe --name {name}", r);
r = run("upsert-batch", ["--manifest", M, "--file", recipeFile, "--domain", "recipedom", "--id-field", "id", "--describe-command", "node evil.mjs {id}"]);
check("recipe: non-gs-admin template rejected (exit 1)", r.code === 1 && /gs-admin command template/.test(r.stderr), r);
r = run("upsert-batch", ["--manifest", M, "--file", recipeFile, "--domain", "recipedom", "--id-field", "id", "--describe-command", "gs-admin --json re r describe --id rec-1"]);
check("recipe: template without {id}/{name} rejected (exit 1)", r.code === 1 && /\{id\} or \{name\}/.test(r.stderr), r);
check("recipe: rejected templates leave the recording untouched", JSON.parse(readFileSync(M, "utf8")).domains_indexed?.recipedom?.describeCommand === "gs-admin --json re r describe --name {name}", null);
check("recipe: domain indexed without the flag records describeCommand null", JSON.parse(readFileSync(M, "utf8")).domains_indexed?.bomdom?.describeCommand === null, null);

// ── itemsPath carry-forward (S5-V F3): maintenance upserts must not degrade ──
// the recorded list shape — same rule as describeCommand: only passing the
// flag again changes the recording.
const ipFile = join(ROOT, "items-path.json");
writeFileSync(ipFile, JSON.stringify({ data: [{ id: "ip-1", name: "Item Path One" }] }));
r = run("upsert-batch", ["--manifest", M, "--file", ipFile, "--domain", "ipdom", "--id-field", "id", "--name-field", "name", "--items-path", "data"]);
check("itemsPath: recorded when passed", r.code === 0 && JSON.parse(readFileSync(M, "utf8")).domains_indexed?.ipdom?.itemsPath === "data", r);
const ipGapFile = join(ROOT, "items-path-gap.json");
writeFileSync(ipGapFile, JSON.stringify([{ id: "ip-2" }])); // bare-array maintenance/gap-fill work file
r = run("upsert-batch", ["--manifest", M, "--file", ipGapFile, "--domain", "ipdom", "--id-field", "id"]);
check(
  "itemsPath: a bare-array upsert without --items-path keeps the prior recording (F3 carry-forward)",
  r.code === 0 && JSON.parse(readFileSync(M, "utf8")).domains_indexed?.ipdom?.itemsPath === "data",
  JSON.parse(readFileSync(M, "utf8")).domains_indexed?.ipdom
);
const ipNestedFile = join(ROOT, "items-path-nested.json");
writeFileSync(ipNestedFile, JSON.stringify({ data: { items: [{ id: "ip-3", name: "Nested" }] } }));
r = run("upsert-batch", ["--manifest", M, "--file", ipNestedFile, "--domain", "ipdom", "--id-field", "id", "--name-field", "name", "--items-path", "data.items"]);
check("itemsPath: passing the flag again re-records", r.code === 0 && JSON.parse(readFileSync(M, "utf8")).domains_indexed?.ipdom?.itemsPath === "data.items", r);
check("itemsPath: a never-recorded domain still stamps null", JSON.parse(readFileSync(M, "utf8")).domains_indexed?.bomdom?.itemsPath === null, null);

// ── --allow-empty must not mask a wrong --items-path on a data-bearing payload ─
const wrongPathFile = join(ROOT, "wrong-path.json");
writeFileSync(wrongPathFile, JSON.stringify({ data: { items: [{ id: "x-1" }], meta: { count: 1 } } }));
r = run("upsert-batch", ["--manifest", M, "--file", wrongPathFile, "--domain", "wrongpath", "--id-field", "id", "--items-path", "data.meta", "--allow-empty"]);
check("allow-empty: --items-path resolving to a non-array still fails", r.code === 1 && /not an array/.test(r.stderr), r);

// ── Date-field recording: stamp, recorded fallback, redate guard, adoption ──
const dj = () => JSON.parse(readFileSync(M, "utf8"));

// --date-field recorded in the stamp alongside the existing keys
const datedFile = join(ROOT, "dated.json");
writeFileSync(datedFile, JSON.stringify({ data: [
  { id: "d-1", name: "Dated One", modifiedDate: "2026-01-05T00:00:00Z" },
  { id: "d-2", name: "Dated Two", modifiedDate: "2026-01-06T00:00:00Z" },
] }));
r = run("upsert-batch", ["--manifest", M, "--file", datedFile, "--domain", "dated", "--id-field", "id", "--name-field", "name", "--date-field", "modifiedDate"]);
check("date: --date-field recorded in the stamp alongside idField", r.code === 0 && r.json?.dateFieldSource === "explicit" && dj().domains_indexed?.dated?.dateField === "modifiedDate" && dj().domains_indexed?.dated?.idField === "id", r);

// --no-date-field records dateField: null — distinct from legacy-absent
const undatedFile = join(ROOT, "undated.json");
writeFileSync(undatedFile, JSON.stringify({ data: [{ id: "u-1", name: "Undated One" }, { id: "u-2", name: "Undated Two" }] }));
r = run("upsert-batch", ["--manifest", M, "--file", undatedFile, "--domain", "undated", "--id-field", "id", "--name-field", "name", "--no-date-field"]);
const undatedStamp = dj().domains_indexed?.undated;
check("date: --no-date-field records dateField null (hasOwnProperty-distinct)", r.code === 0 && r.json?.dateFieldSource === "explicit-none" && Object.prototype.hasOwnProperty.call(undatedStamp ?? {}, "dateField") && undatedStamp.dateField === null, r);
check("date: legacy omit path keeps the dateField key ABSENT (never materializes null)", !Object.prototype.hasOwnProperty.call(dj().domains_indexed?.bomdom ?? {}, "dateField"), dj().domains_indexed?.bomdom);

// both flags together rejected
r = run("upsert-batch", ["--manifest", M, "--file", datedFile, "--domain", "dated", "--id-field", "id", "--date-field", "modifiedDate", "--no-date-field"]);
check("date: --date-field + --no-date-field together rejected (exit 1)", r.code === 1 && /exactly one/.test(r.stderr), r);

// recorded fallback: flag omitted on re-upsert → recording applies the dates
const datedFile2 = join(ROOT, "dated-2.json");
writeFileSync(datedFile2, JSON.stringify({ data: [
  // updatedAt carried too (F-388 round 2): the redate arm below moves the
  // recording to it, and a date field that resolves on no row is now refused —
  // a redate to a dead field is the typo case, not a scheme change.
  { id: "d-1", name: "Dated One", modifiedDate: "2026-02-01T00:00:00Z", updatedAt: "2026-02-01T00:00:00Z" },
  { id: "d-2", name: "Dated Two", modifiedDate: "2026-01-06T00:00:00Z", updatedAt: "2026-01-06T00:00:00Z" },
] }));
r = run("upsert-batch", ["--manifest", M, "--file", datedFile2, "--domain", "dated", "--id-field", "id", "--name-field", "name"]);
check("date: omitted flag reuses the recording (dateFieldSource recorded)", r.code === 0 && r.json?.dateFieldSource === "recorded" && r.json?.dateField === "modifiedDate", r);
check("date: newer incoming date flips stale with no flag passed", r.json?.stale === 1 && r.json?.unchanged === 1 && dj().inventory["dated/d-1"].status === "stale" && dj().inventory["dated/d-1"].modified_date === "2026-02-01T00:00:00Z", r);

// epoch-ms ordering: Date.parse can't rank numeric strings; newerThan must
const epochFile = join(ROOT, "epoch.json");
writeFileSync(epochFile, JSON.stringify({ data: [{ id: "e-1", ts: "1720000000000" }] }));
run("upsert-batch", ["--manifest", M, "--file", epochFile, "--domain", "epoch", "--id-field", "id", "--date-field", "ts"]);
writeFileSync(epochFile, JSON.stringify({ data: [{ id: "e-1", ts: "1719999999999" }] }));
r = run("upsert-batch", ["--manifest", M, "--file", epochFile, "--domain", "epoch", "--id-field", "id"]);
check("date: OLDER epoch-ms value stays unchanged (numeric ordering, not string inequality)", r.code === 0 && r.json?.unchanged === 1 && r.json?.stale === 0, r);
writeFileSync(epochFile, JSON.stringify({ data: [{ id: "e-1", ts: "1720000000001" }] }));
r = run("upsert-batch", ["--manifest", M, "--file", epochFile, "--domain", "epoch", "--id-field", "id"]);
check("date: newer epoch-ms value flips stale", r.code === 0 && r.json?.stale === 1, r);

// recorded-none domain re-upserted with no flag: null→null, all unchanged
r = run("upsert-batch", ["--manifest", M, "--file", undatedFile, "--domain", "undated", "--id-field", "id", "--name-field", "name"]);
check("date: recorded-none re-upsert is all-unchanged (dateFieldSource recorded-none)", r.code === 0 && r.json?.dateFieldSource === "recorded-none" && r.json?.unchanged === 2 && r.json?.stale === 0, r);

// ── Redate guard: explicit flag contradicting the recording hard-fails ──────
const datedStatuses = () => JSON.stringify(Object.fromEntries(Object.entries(dj().inventory).filter(([k]) => k.startsWith("dated/")).map(([k, e]) => [k, e.status])));
const statusesBefore = datedStatuses();
r = run("upsert-batch", ["--manifest", M, "--file", datedFile2, "--domain", "dated", "--id-field", "id", "--date-field", "updatedAt"]);
check("redate: differing explicit field rejected, names both fields + --allow-redate", r.code === 1 && /--date-field updatedAt/.test(r.stderr) && /--date-field modifiedDate/.test(r.stderr) && /--allow-redate/.test(r.stderr), r);
check("redate: rejected upsert leaves statuses untouched", datedStatuses() === statusesBefore, null);
r = run("upsert-batch", ["--manifest", M, "--file", undatedFile, "--domain", "undated", "--id-field", "id", "--date-field", "modifiedDate"]);
check("redate: recorded-none → explicit field rejected", r.code === 1 && /none \(--no-date-field\)/.test(r.stderr) && /--allow-redate/.test(r.stderr), r);
r = run("upsert-batch", ["--manifest", M, "--file", datedFile2, "--domain", "dated", "--id-field", "id", "--no-date-field"]);
check("redate: recorded field → --no-date-field rejected", r.code === 1 && /--allow-redate/.test(r.stderr), r);
r = run("upsert-batch", ["--manifest", M, "--file", datedFile2, "--domain", "dated", "--id-field", "id", "--date-field", "updatedAt", "--allow-redate"]);
check("redate: --allow-redate overrides and re-records", r.code === 0 && dj().domains_indexed?.dated?.dateField === "updatedAt", r);

// ── Baseline adoption: real field over null-stored dates, no false staleness ─
const adoptFile = join(ROOT, "adopt.json");
writeFileSync(adoptFile, JSON.stringify({ data: [
  { id: "a-1", name: "Adopt One", modifiedDate: "2026-03-01T00:00:00Z" },
  { id: "a-2", name: "Adopt Two", modifiedDate: "2026-03-02T00:00:00Z" },
] }));
run("upsert-batch", ["--manifest", M, "--file", adoptFile, "--domain", "adoptdom", "--id-field", "id", "--name-field", "name"]);
check("adopt: pre-adoption entries stored modified_date null", dj().inventory["adoptdom/a-1"].modified_date === null, dj().inventory["adoptdom/a-1"]);
r = run("upsert-batch", ["--manifest", M, "--file", adoptFile, "--domain", "adoptdom", "--id-field", "id", "--name-field", "name", "--date-field", "modifiedDate"]);
check("adopt: legacy null→value adoption baselines — no guard, no staleness", r.code === 0 && r.json?.baselined === 2 && r.json?.stale === 0, r);
check("adopt: dates backfilled + stamp upgraded with dateField", dj().inventory["adoptdom/a-1"].modified_date === "2026-03-01T00:00:00Z" && dj().domains_indexed?.adoptdom?.dateField === "modifiedDate", dj().inventory["adoptdom/a-1"]);
writeFileSync(adoptFile, JSON.stringify({ data: [
  { id: "a-1", name: "Adopt One", modifiedDate: "2026-04-01T00:00:00Z" },
  { id: "a-2", name: "Adopt Two", modifiedDate: "2026-03-02T00:00:00Z" },
] }));
r = run("upsert-batch", ["--manifest", M, "--file", adoptFile, "--domain", "adoptdom", "--id-field", "id"]);
check("adopt: change detection starts on the next refresh (advanced date → stale)", r.code === 0 && r.json?.stale === 1 && r.json?.unchanged === 1, r);

// recorded-none adoption needs --allow-redate, and baselines rather than stales
const nullAdoptFile = join(ROOT, "null-adopt.json");
writeFileSync(nullAdoptFile, JSON.stringify({ data: [{ id: "n-1", name: "Null One", modifiedDate: "2026-03-05T00:00:00Z" }] }));
run("upsert-batch", ["--manifest", M, "--file", nullAdoptFile, "--domain", "nulladopt", "--id-field", "id", "--no-date-field"]);
r = run("upsert-batch", ["--manifest", M, "--file", nullAdoptFile, "--domain", "nulladopt", "--id-field", "id", "--date-field", "modifiedDate", "--allow-redate"]);
check("adopt: recorded-none adoption via --allow-redate baselines, not stales", r.code === 0 && r.json?.baselined === 1 && r.json?.stale === 0 && dj().inventory["nulladopt/n-1"].modified_date === "2026-03-05T00:00:00Z", r);

// baseline never leaks: a stored-null entry under an already-recorded field
// still flips stale when a date arrives — that null is missing data, not legacy
const leakFile = join(ROOT, "leak.json");
writeFileSync(leakFile, JSON.stringify({ data: [
  { id: "l-1", name: "Leak One", modifiedDate: "2026-01-01T00:00:00Z" },
  { id: "l-2", name: "Leak Two", modifiedDate: null },
] }));
run("upsert-batch", ["--manifest", M, "--file", leakFile, "--domain", "leakdom", "--id-field", "id", "--date-field", "modifiedDate"]);
writeFileSync(leakFile, JSON.stringify({ data: [
  { id: "l-1", name: "Leak One", modifiedDate: "2026-01-01T00:00:00Z" },
  { id: "l-2", name: "Leak Two", modifiedDate: "2026-01-09T00:00:00Z" },
] }));
r = run("upsert-batch", ["--manifest", M, "--file", leakFile, "--domain", "leakdom", "--id-field", "id"]);
check("adopt: baseline never leaks — stored-null under a recorded field flips stale", r.code === 0 && r.json?.baselined === 0 && r.json?.stale === 1 && dj().inventory["leakdom/l-2"].status === "stale", r);

// bare-timestamp legacy stamp: --date-field adopts, no guard, stamp upgraded
run("upsert-batch", ["--manifest", M, "--file", adoptFile, "--domain", "barelegacy", "--id-field", "id", "--name-field", "name"]);
const bareM = dj();
bareM.domains_indexed.barelegacy = "2026-01-01T00:00:00.000Z";
writeFileSync(M, JSON.stringify(bareM, null, 2) + "\n");
r = run("upsert-batch", ["--manifest", M, "--file", adoptFile, "--domain", "barelegacy", "--id-field", "id", "--date-field", "modifiedDate"]);
check("adopt: bare-timestamp legacy stamp adopts without the guard", r.code === 0 && r.json?.baselined === 2 && r.json?.stale === 0, r);
check("adopt: bare stamp upgraded with idField + dateField", dj().domains_indexed?.barelegacy?.idField === "id" && dj().domains_indexed?.barelegacy?.dateField === "modifiedDate", dj().domains_indexed?.barelegacy);

// empty domain: nothing recorded was ever validated — switching is allowed
r = run("upsert-batch", ["--manifest", M, "--file", emptyFile, "--domain", "connectors", "--id-field", "connectorId", "--date-field", "modifiedAt"]);
check("date: empty domain accepts a date field and records it", r.code === 0 && dj().domains_indexed?.connectors?.dateField === "modifiedAt", r);
r = run("upsert-batch", ["--manifest", M, "--file", emptyFile, "--domain", "connectors", "--id-field", "connectorId", "--no-date-field"]);
check("date: empty-domain date-field switch allowed + re-recorded", r.code === 0 && dj().domains_indexed?.connectors?.dateField === null, r);

// ── Under-count warning: shortfall is pagination evidence, never deletion ───
const pageFullFile = join(ROOT, "page-full.json");
writeFileSync(pageFullFile, JSON.stringify({ data: [1, 2, 3, 4, 5].map((n) => ({ id: `p-${n}`, name: `Paged ${n}` })) }));
run("upsert-batch", ["--manifest", M, "--file", pageFullFile, "--domain", "pagedom", "--id-field", "id", "--name-field", "name"]);
const pageShortFile = join(ROOT, "page-short.json");
writeFileSync(pageShortFile, JSON.stringify({ data: [1, 2].map((n) => ({ id: `p-${n}`, name: `Paged ${n}` })) }));
r = run("upsert-batch", ["--manifest", M, "--file", pageShortFile, "--domain", "pagedom", "--id-field", "id"]);
check("undercount: short list warns with both counts", r.code === 0 && r.json?.incomingCount === 2 && r.json?.existingEntries === 5 && r.json.warnings.some((w) => /under-pagination/.test(w)), r);
check("undercount: warning never removes entries", Object.keys(dj().inventory).filter((k) => k.startsWith("pagedom/")).length === 5, null);
run("mark", ["--manifest", M, "--key", "pagedom/p-3", "--status", "failed", "--error", "boom"]);
run("mark", ["--manifest", M, "--key", "pagedom/p-4", "--status", "failed", "--error", "boom"]);
run("mark", ["--manifest", M, "--key", "pagedom/p-5", "--status", "failed", "--error", "boom"]);
r = run("upsert-batch", ["--manifest", M, "--file", pageShortFile, "--domain", "pagedom", "--id-field", "id"]);
check("undercount: failed entries excluded — equal counts produce no warning", r.code === 0 && r.json?.existingEntries === 2 && r.json?.warnings.length === 0, r);

// ── --partial: a declared subset is not pagination evidence (F-313) ──────────
// Gap-fill work lists are smaller than the domain BY CONSTRUCTION; the caller
// declares that instead of learning to ignore the warning. The declaration
// must not degrade the index: the coverage stamp stays untouched, recordings
// cannot change, rekey orphan diffs are refused, and a never-listed domain
// proceeds stamp-less with a warning (F-316 — the list-invisible recovery
// case; the 0.32.6 refusal broke the flows that exist for it).
const gapFullFile = join(ROOT, "gap-full.json");
writeFileSync(gapFullFile, JSON.stringify([1, 2, 3, 4, 5].map((n) => ({ id: `g-${n}`, name: `Gap ${n}` }))));
r = run("upsert-batch", ["--manifest", M, "--file", gapFullFile, "--domain", "gapdom", "--id-field", "id", "--name-field", "name", "--list-command", "gs-admin --json jo p list"]);
check("partial: seed full index records listCommand", r.code === 0 && dj().domains_indexed?.gapdom?.listCommand === "gs-admin --json jo p list", r);
// Pin the stamp's `at` so "untouched" is provable byte-for-byte, not by timing.
{
  const mm = dj();
  mm.domains_indexed.gapdom.at = "2026-01-01T00:00:00.000Z";
  writeFileSync(M, JSON.stringify(mm, null, 2));
}
const gapShortFile = join(ROOT, "gap-short.json");
writeFileSync(gapShortFile, JSON.stringify([{ id: "g-9", name: "Gap Nine" }, { id: "g-1", name: "Gap One" }]));
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "gapdom", "--id-field", "id", "--name-field", "name", "--partial"]);
check("partial: short list raises NO under-pagination warning", r.code === 0 && r.json?.partial === true && r.json?.incomingCount === 2 && r.json?.existingEntries === 5 && !r.json.warnings.some((w) => /under-pagination/.test(w)), r);
check("partial: rows still land (new pending + existing matched)", r.json?.added === 1 && r.json?.matchedExisting === 1 && dj().inventory["gapdom/g-9"]?.status === "pending", r);
check("partial: coverage stamp untouched (at + recordings preserved)", dj().domains_indexed?.gapdom?.at === "2026-01-01T00:00:00.000Z" && dj().domains_indexed?.gapdom?.listCommand === "gs-admin --json jo p list", dj().domains_indexed?.gapdom);
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "gapdom", "--id-field", "id"]);
check("partial: undeclared short list still warns, and the warning routes to --partial", r.code === 0 && r.json?.partial === false && r.json.warnings.some((w) => /under-pagination/.test(w) && /declare itself with --partial/.test(w)), r);
// F-425: the remedy is derived from the flags the run passed. A re-list that
// passed --list-command (every refresh upsert, by refresh step 3) is a
// full-list run by declaration, and --partial refuses to combine with it —
// so the warning must say so instead of advising the flag the script would
// reject. Sibling the tester did not list: --allow-rekey has its own
// refusal arm and blocks --partial the same way.
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "gapdom", "--id-field", "id", "--list-command", "gs-admin --json jo p list"]);
{
  const w = r.json?.warnings.find((x) => /under-pagination/.test(x)) ?? "";
  check("f425: a short RE-LIST (--list-command passed) warns, names the flag it passed and says --partial is NOT the remedy", r.code === 0 && /This run passed --list-command/.test(w) && /--partial is NOT the remedy/.test(w) && /refuses to combine with --list-command/.test(w), w.slice(-300));
  check("f425: the re-list warning never advises the --partial the refusal would reject", !/declare itself with --partial/.test(w), w.slice(-200));
}
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "gapdom", "--id-field", "id", "--allow-rekey"]);
{
  const w = r.json?.warnings.find((x) => /under-pagination/.test(x)) ?? "";
  check("f425 sibling: a short list with --allow-rekey names that flag as the --partial blocker", r.code === 0 && /This run passed --allow-rekey/.test(w) && !/declare itself with --partial/.test(w), w.slice(-300));
}
// F-316: a partial registration into a NEVER-listed domain is the
// list-invisible recovery case — it proceeds, writes no stamp, and warns
// (naming the typo exit), instead of the 0.32.6 refusal that broke the
// documented recovery flows.
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "neverdom", "--id-field", "id", "--partial"]);
check("partial: never-listed domain proceeds with entries landed", r.code === 0 && r.json?.partial === true && r.json?.added === 2 && dj().inventory["neverdom/g-9"]?.status === "pending", r);
check("partial: never-listed domain gets NO stamp", !("neverdom" in (dj().domains_indexed ?? {})), dj().domains_indexed);
check("partial: never-listed warning names the state and the remove-verb exit", r.json.warnings.some((w) => /never been listed/.test(w) && /remove/.test(w)) && !r.json.warnings.some((w) => /under-pagination/.test(w)), r);
check("partial: never-listed warning claims the landing only when rows landed", r.json.warnings.some((w) => /entries are in the manifest now/.test(w)), r);
// F-324: the landed-conditional's NEGATIVE arm, pinned. The typo-exit
// sentence claims "the entries are in the manifest now" — on an all-skipped
// or empty file nothing landed and the claim would be false, so the warning
// must name the never-listed state WITHOUT that sentence (the F-315 lesson:
// a conditional's absent arm needs its own negative, or `landed = 1` ships
// green — this round's tester mutant survived on exactly that line).
// F-388 round 2 moved the all-skipped arrangement: an --id-field resolving on
// NO row is now a failure that writes nothing (below), so the negative arm is
// reached the honest way — an EMPTY declared list (--allow-empty), where
// nothing landed and the landing claim would equally be false.
const neverSkipFile = join(ROOT, "never-skip.json");
writeFileSync(neverSkipFile, JSON.stringify([{ name: "idless one" }, { name: "idless two" }]));
r = run("upsert-batch", ["--manifest", M, "--file", neverSkipFile, "--domain", "neverdom2", "--id-field", "id", "--name-field", "name", "--partial"]);
check(
  "partial (F-388): an all-skipped subset file FAILS loudly (wrong id path) and stamps nothing",
  r.code === 1 && /--id-field id resolves to no value on any of the 2 row\(s\)/.test(r.stderr) && /nothing was written/.test(r.stderr) && !Object.hasOwn(dj().domains_indexed ?? {}, "neverdom2"),
  r
);
const neverEmptyFile = join(ROOT, "never-empty.json");
writeFileSync(neverEmptyFile, JSON.stringify([]));
r = run("upsert-batch", ["--manifest", M, "--file", neverEmptyFile, "--domain", "neverdom2", "--id-field", "id", "--name-field", "name", "--partial", "--allow-empty"]);
check(
  "partial: never-listed EMPTY file warns the state WITHOUT the typo-exit landing claim (F-324)",
  r.code === 0 && r.json?.skipped === 0 &&
    r.json.warnings.some((w) => /never been listed/.test(w) && !/entries are in the manifest now/.test(w)),
  r
);
check("partial: never-listed all-skipped file still gets NO stamp", !("neverdom2" in (dj().domains_indexed ?? {})), dj().domains_indexed);
r = run("upsert-batch", ["--manifest", M, "--file", emptyFile, "--domain", "neverdom3", "--id-field", "id", "--partial"]);
check(
  "partial: never-listed empty file warns the state WITHOUT the typo-exit landing claim (F-324)",
  r.code === 0 && r.json.warnings.some((w) => /never been listed/.test(w) && !/entries are in the manifest now/.test(w)),
  r
);
// F-317: the id-field guards still fire under --partial, but their remedy
// text must not advise adding --allow-rekey to THIS invocation (--partial
// refuses it — the 0.32.6/0.32.7 text was a documented dead-end). The
// partial arm routes a key-scheme change to a full-list rekey; the
// non-partial arm keeps the "or pass --allow-rekey" advice. Both arms
// pinned, each with the negative that excludes the other's advice (F-315).
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "gapdom", "--id-field", "name", "--partial"]);
check("partial: re-index guard fires with full-list-rekey remedy, never 'or pass --allow-rekey'", r.code === 1 && /full-list operation/.test(r.stderr) && !/or pass --allow-rekey/.test(r.stderr), r);
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "gapdom", "--id-field", "name"]);
check("partial: non-partial re-index guard keeps the --allow-rekey advice", r.code === 1 && /or pass --allow-rekey/.test(r.stderr) && !/full-list operation/.test(r.stderr), r);
// Shape-heuristic arm: legacy bare-timestamp stamp (no recorded idField),
// numeric existing keys, uuid incoming subset (matchedExisting 0 by
// construction — the liveOnly gap-list shape) → heuristic fires; under
// --partial its remedy must route to the full-list rekey too.
{
  const mm = dj();
  mm.domains_indexed.shapedom = "2026-01-01T00:00:00.000Z";
  for (const n of [1, 2, 3]) mm.inventory[`shapedom/${n}`] = { id: String(n), name: `S${n}`, domain: "shapedom", modified_date: null, status: "documented" };
  writeFileSync(M, JSON.stringify(mm, null, 2));
}
const shapeUuidFile = join(ROOT, "shape-uuid.json");
writeFileSync(shapeUuidFile, JSON.stringify([{ id: "3f2a1b4c-0d5e-4f6a-8b7c-9d0e1f2a3b4c", name: "U1" }]));
r = run("upsert-batch", ["--manifest", M, "--file", shapeUuidFile, "--domain", "shapedom", "--id-field", "id", "--partial"]);
check("partial: shape heuristic fires with full-list-rekey remedy, never 'or pass --allow-rekey'", r.code === 1 && /shapes differ/.test(r.stderr) && /full-list operation/.test(r.stderr) && !/or pass --allow-rekey/.test(r.stderr), r);
// F-316 × F-317 interaction (executed in the F-317 verdict round, pinned
// here — a documented retest step needs a committed counterpart, the F-324
// lesson): a NEVER-listed domain that already holds entries of a differing
// shape trips the shape guard under --partial, and its remedy must carry the
// never-listed clause — such a domain has no listable full set, so the
// full-list-rekey routing alone would be a dead-end; it re-registers keyed
// by the field its existing entries used.
{
  const mm = dj();
  for (const n of [7, 8, 9]) mm.inventory[`nevershape/${n}`] = { id: String(n), name: `N${n}`, domain: "nevershape", modified_date: null, status: "documented" };
  writeFileSync(M, JSON.stringify(mm, null, 2));
}
r = run("upsert-batch", ["--manifest", M, "--file", shapeUuidFile, "--domain", "nevershape", "--id-field", "id", "--partial"]);
check(
  "partial: shape guard on a NEVER-listed domain carries the re-register-by-existing-field clause (F-317)",
  r.code === 1 && /shapes differ/.test(r.stderr) && /re-register keyed by the field/.test(r.stderr) && !/or pass --allow-rekey/.test(r.stderr),
  r
);
// One check per refusal arm, each asserting its OWN flag in the failure text
// (F-314): a shared assertion over a multi-arm guard lets a dropped arm ship
// green behind its siblings. The --no-date-field arm must run on a domain
// recorded --no-date-field (connectors, from the date tests above): on a
// domain with a real recorded date field the redate guard refuses the same
// combination for an unrelated reason and would mask the missing arm.
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "gapdom", "--id-field", "id", "--partial", "--list-command", "gs-admin --json jo p list"]);
check("partial: recording flags refused (--list-command)", r.code === 1 && /--list-command/.test(r.stderr) && /index-time facts/.test(r.stderr), r);
// F-315: pin the offender-naming AS naming. The pre-F-314 blanket message
// contained all four flag names, so it satisfied every per-arm assertion
// above at once — a revert to it shipped green (tester mutant PM-5). A
// single-offender refusal must NOT mention the flags that were not passed…
check("partial: the refusal names ONLY the offender", r.code === 1 && /--list-command/.test(r.stderr) && !/--describe-command|--date-field|--no-date-field/.test(r.stderr), r);
// …and a multi-offender refusal must name each offender passed (pins the
// join, so "name the first flag only" can't ship either).
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "gapdom", "--id-field", "id", "--partial", "--list-command", "gs-admin --json jo p list", "--date-field", "modifiedDate"]);
check("partial: a multi-flag refusal names every offender and no other", r.code === 1 && /--list-command/.test(r.stderr) && /--date-field/.test(r.stderr) && !/--describe-command|--no-date-field/.test(r.stderr), r);
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "gapdom", "--id-field", "id", "--partial", "--date-field", "modifiedDate"]);
check("partial: recording flags refused (--date-field)", r.code === 1 && /--date-field/.test(r.stderr) && /index-time facts/.test(r.stderr), r);
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "gapdom", "--id-field", "id", "--partial", "--describe-command", "gs-admin --json jo p describe --id {id}"]);
check("partial: recording flags refused (--describe-command)", r.code === 1 && /--describe-command/.test(r.stderr) && /index-time facts/.test(r.stderr), r);
r = run("upsert-batch", ["--manifest", M, "--file", emptyFile, "--domain", "connectors", "--id-field", "connectorId", "--partial", "--no-date-field"]);
check("partial: recording flags refused (--no-date-field, on a recorded-none domain)", r.code === 1 && /--no-date-field/.test(r.stderr) && /index-time facts/.test(r.stderr), r);
r = run("upsert-batch", ["--manifest", M, "--file", gapShortFile, "--domain", "gapdom", "--id-field", "id", "--partial", "--allow-rekey"]);
check("partial: --allow-rekey refused (orphan diff needs the full list)", r.code === 1 && /orphan/.test(r.stderr), r);
// Orthogonality: --partial exempts only the coverage heuristic — a dropped
// row is about the rows actually submitted and must stay loud (F-220).
const gapSkipFile = join(ROOT, "gap-skip.json");
writeFileSync(gapSkipFile, JSON.stringify([{ id: "g-2", name: "Gap Two" }, { name: "idless row (stuck INIT)" }]));
r = run("upsert-batch", ["--manifest", M, "--file", gapSkipFile, "--domain", "gapdom", "--id-field", "id", "--name-field", "name", "--partial"]);
check("partial: skipped-row warning stays live", r.code === 0 && r.json?.skipped === 1 && r.json.warnings.some((w) => /NOT written/.test(w)) && !r.json.warnings.some((w) => /under-pagination/.test(w)), r);

// ── Skipped-row warning: a dropped tenant asset must be looked at (F-220) ────
// The live shape: an 11-row list where 1 real connection (INIT status, never
// finished initialising) has no id — pre-fix it vanished with "skipped": 1
// and warnings: [], and the count guard cannot see it (the incoming list has
// already had the row dropped before extraction).
const skipFile = join(ROOT, "skip-rows.json");
writeFileSync(
  skipFile,
  JSON.stringify({
    data: [
      { info: { cid: "k-1" }, name: "Conn One" },
      { info: { cid: "k-2" }, name: "Conn Two" },
      // Fictional acme-style connection (F-231): the fixture pins the SHAPE —
      // a real connection whose row carries no id because it never finished
      // initialising — never a live vendor name.
      { info: {}, name: "acme-payroll-feed (stuck INIT)" },
    ],
  })
);
r = run("upsert-batch", ["--manifest", M, "--file", skipFile, "--domain", "skipdom", "--id-field", "info.cid", "--name-field", "name"]);
check(
  "skipped: dropped row raises a warning naming count and the sample's name field (F-220)",
  r.code === 0 &&
    r.json?.skipped === 1 &&
    r.json.warnings.some((w) => /1 of 3 incoming row\(s\) carry no value at info\.cid/.test(w) && w.includes("acme-payroll-feed (stuck INIT)")),
  r.json
);
// without --name-field the sample falls back to the row's keys
r = run("upsert-batch", ["--manifest", M, "--file", skipFile, "--domain", "skipdom", "--id-field", "info.cid"]);
check(
  "skipped: sample without a name field names the row's keys",
  r.code === 0 && r.json.warnings.some((w) => /row keys: info, name/.test(w)),
  r.json?.warnings
);
// non-fire: a fully-keyed list must not warn (the ordinary path stays quiet)
r = run("upsert-batch", ["--manifest", M, "--file", pageShortFile, "--domain", "skipdom2", "--id-field", "id", "--name-field", "name"]);
check("skipped: no dropped rows → no skipped warning", r.code === 0 && r.json?.skipped === 0 && !r.json.warnings.some((w) => /NOT written/.test(w)), r.json);

// ── Prototype-shaped domain rejected at the door (F-215) ─────────────────────
// "__proto__" survives the composite inventory keys but the stamp write and
// report's byDomain fold assign it as a bare key — asset recorded, coverage
// stamp landing on the prototype, report blind to the domain. Now rejected.
const protoFile = join(ROOT, "proto-dom.json");
writeFileSync(protoFile, JSON.stringify({ data: [{ id: "p-1", name: "P One" }] }));
r = run("upsert-batch", ["--manifest", M, "--file", protoFile, "--domain", "__proto__", "--id-field", "id"]);
check(
  "domain: __proto__ rejected by upsert-batch (exit 1), nothing written",
  r.code === 1 && /plain domain name/.test(r.stderr) && !Object.hasOwn(dj().inventory, "__proto__/p-1") && !Object.hasOwn(dj().domains_indexed ?? {}, "__proto__"),
  { code: r.code, stderr: r.stderr?.slice(0, 120) }
);
r = run("stub", ["--manifest", M, "--file", protoFile, "--domain", "__proto__", "--id-field", "id", "--out-dir", join(ROOT, "proto-out")]);
check("domain: __proto__ rejected by stub too (exit 1)", r.code === 1 && /plain domain name/.test(r.stderr), r.stderr?.slice(0, 120));
r = run("upsert-batch", ["--manifest", M, "--file", protoFile, "--domain", "proto-ok-dom", "--id-field", "id"]);
check("domain: ordinary kebab domain still accepted (F-215 non-fire)", r.code === 0 && r.json?.added === 1, r);

// ── F-225: the REST of the prototype-member family + fold hardening ─────────
// "__proto__" was rejected by shape, but "constructor"/"toString"/… passed the
// regex and reproduced the same blindness one layer down: report's fold read
// the inherited truthy prototype member, skipped assignment, and the count
// mutated the GLOBAL Object function while the domain vanished from byDomain
// AND emptyDomains. Door + fold are both hardened; these pin each.
r = run("upsert-batch", ["--manifest", M, "--file", protoFile, "--domain", "constructor", "--id-field", "id"]);
check(
  "domain: prototype member name rejected at the door by upsert-batch (F-225)",
  r.code === 1 && /prototype member/.test(r.stderr) && !Object.hasOwn(dj().domains_indexed ?? {}, "constructor"),
  { code: r.code, stderr: r.stderr?.slice(0, 140) }
);
r = run("stub", ["--manifest", M, "--file", protoFile, "--domain", "toString", "--id-field", "id", "--out-dir", join(ROOT, "proto-out")]);
check("domain: prototype member name rejected by stub too (F-225)", r.code === 1 && /prototype member/.test(r.stderr), r.stderr?.slice(0, 140));
// Fold safety on a PRE-FIX manifest that already carries such a domain (the
// door can't retro-reject data on disk): report must fold it as an OWN key
// with numeric counts, never onto the prototype.
const protoRepM = join(ROOT, "proto-report-manifest.json");
writeFileSync(
  protoRepM,
  JSON.stringify({
    slug: "acme-sbx",
    baseUrl: "https://acme.example",
    created: "2026-01-01T00:00:00.000Z",
    last_refresh: null,
    inventory: {
      "constructor/x-1": { id: "x-1", name: "X One", domain: "constructor", status: "pending" },
      "toString/y-1": { id: "y-1", name: "Y One", domain: "toString", status: "documented" },
    },
    domains_indexed: { constructor: { at: "2026-01-01T00:00:00.000Z", idField: "id" } },
  })
);
r = run("report", ["--manifest", protoRepM]);
check(
  "report: prototype-member domains fold as OWN keys with numeric counts (F-225)",
  r.code === 0 &&
    Object.hasOwn(r.json?.byDomain ?? {}, "constructor") &&
    r.json.byDomain.constructor?.pending === 1 &&
    Object.hasOwn(r.json?.byDomain ?? {}, "toString") &&
    r.json.byDomain.toString?.documented === 1 &&
    Array.isArray(r.json?.emptyDomains) &&
    !r.json.emptyDomains.includes("constructor"),
  r.json
);

// ── Mass-stale advisory: en-masse flips point at the date field, not edits ──
const massFile = join(ROOT, "mass.json");
const massItems = (d) => Array.from({ length: 12 }, (_, i) => ({ id: `m-${i}`, modifiedDate: d }));
writeFileSync(massFile, JSON.stringify({ data: massItems("2026-01-01T00:00:00Z") }));
run("upsert-batch", ["--manifest", M, "--file", massFile, "--domain", "massdom", "--id-field", "id", "--date-field", "modifiedDate"]);
writeFileSync(massFile, JSON.stringify({ data: massItems("2026-01-02T00:00:00Z") }));
r = run("upsert-batch", ["--manifest", M, "--file", massFile, "--domain", "massdom", "--id-field", "id"]);
check("advisory: mass stale flip warns to verify the date field first", r.code === 0 && r.json?.stale === 12 && r.json.warnings.some((w) => /verify the date field/.test(w)), r);

// ── mark --fingerprint: stored on documented marks, strict 40-hex shape ──────
const FP = "a".repeat(40);
r = run("mark", ["--manifest", M, "--key", "pagedom/p-1", "--status", "documented", "--fingerprint", FP]);
check("fingerprint: stored on a documented mark", r.code === 0 && dj().inventory["pagedom/p-1"].fingerprint === FP, r);
r = run("mark", ["--manifest", M, "--key", "pagedom/p-1", "--status", "failed", "--error", "x"]);
check("fingerprint: failed mark leaves the fingerprint untouched", r.code === 0 && dj().inventory["pagedom/p-1"].fingerprint === FP, dj().inventory["pagedom/p-1"]);
r = run("mark", ["--manifest", M, "--key", "pagedom/p-2", "--status", "documented", "--fingerprint", "B".repeat(40)]);
check("fingerprint: uppercase hex accepted and stored lowercase", r.code === 0 && dj().inventory["pagedom/p-2"].fingerprint === "b".repeat(40), r);
r = run("mark", ["--manifest", M, "--key", "pagedom/p-2", "--status", "documented", "--fingerprint", "not-a-fingerprint"]);
check("fingerprint: malformed value rejected (exit 1)", r.code === 1 && /40-char hex/.test(r.stderr), r);

// ── wave-3 (F-162): mark --keys-file/--limit — batch marking off a work list ─
// The keys file is a skill scratch product (JSON array of full keys, priority-
// ordered); --limit cuts in FILE order, and the batch is all-or-nothing: one
// unknown selected key means zero writes.
{
  const batchListFile = join(ROOT, "batchdom.json");
  writeFileSync(batchListFile, JSON.stringify({ data: ["a", "b", "c", "d"].map((s) => ({ id: `k-${s}`, name: s })) }));
  run("upsert-batch", ["--manifest", M, "--file", batchListFile, "--domain", "batchdom", "--id-field", "id", "--name-field", "name"]);
  const batchStatuses = () => Object.fromEntries(Object.entries(dj().inventory).filter(([k]) => k.startsWith("batchdom/")).map(([k, e]) => [k, e.status]));

  // deliberately NOT alphabetical: file order is the producer's priority order
  const worklist = join(ROOT, "batch-worklist.json");
  writeFileSync(worklist, JSON.stringify(["batchdom/k-c", "batchdom/k-a", "batchdom/k-b"]));
  r = run("mark", ["--manifest", M, "--keys-file", worklist, "--status", "stale", "--limit", "2"]);
  check("mark: --keys-file marks the first N in file order, summary {marked, status}", r.code === 0 && r.json?.marked === 2 && r.json?.status === "stale" && batchStatuses()["batchdom/k-c"] === "stale" && batchStatuses()["batchdom/k-a"] === "stale", { r, statuses: batchStatuses() });
  check("mark: --limit leaves keys beyond the cut untouched", batchStatuses()["batchdom/k-b"] === "pending" && batchStatuses()["batchdom/k-d"] === "pending", batchStatuses());

  r = run("mark", ["--manifest", M, "--keys-file", worklist, "--status", "failed", "--limit", "0"]);
  check("mark: --limit 0 is valid and marks zero", r.code === 0 && r.json?.marked === 0, r);
  check("mark: --limit 0 left every status untouched", batchStatuses()["batchdom/k-c"] === "stale" && batchStatuses()["batchdom/k-b"] === "pending", batchStatuses());

  r = run("mark", ["--manifest", M, "--keys-file", worklist, "--status", "pending"]);
  check("mark: --keys-file without --limit marks the whole list", r.code === 0 && r.json?.marked === 3 && batchStatuses()["batchdom/k-c"] === "pending", r);

  // BOM tolerance: the work list may come back through a PowerShell hand-repair.
  // BOM built via fromCharCode so this file never contains the codepoint
  // (check-doc-drift check 8 rationale).
  const bomKeysFile = join(ROOT, "batch-bom-keys.json");
  writeFileSync(bomKeysFile, String.fromCharCode(0xfeff) + JSON.stringify(["batchdom/k-d"]));
  r = run("mark", ["--manifest", M, "--keys-file", bomKeysFile, "--status", "stale"]);
  check("mark: BOM-prefixed keys file parses", r.code === 0 && r.json?.marked === 1 && batchStatuses()["batchdom/k-d"] === "stale", r);

  // all-or-nothing: an unknown SELECTED key refuses the whole batch
  const mixedList = join(ROOT, "batch-mixed.json");
  writeFileSync(mixedList, JSON.stringify(["batchdom/k-a", "batchdom/never-was", "batchdom/k-b"]));
  const beforeRefused = JSON.stringify(batchStatuses());
  r = run("mark", ["--manifest", M, "--keys-file", mixedList, "--status", "failed"]);
  check("mark: one unknown key rejects the batch (exit 1, names it)", r.code === 1 && /no inventory entry: batchdom\/never-was/.test(r.stderr) && /nothing marked/.test(r.stderr), r);
  check("mark: refused batch wrote nothing", JSON.stringify(batchStatuses()) === beforeRefused, batchStatuses());
  r = run("mark", ["--manifest", M, "--keys-file", mixedList, "--status", "stale", "--limit", "1"]);
  check("mark: unknown key beyond the --limit cut is never selected", r.code === 0 && r.json?.marked === 1 && batchStatuses()["batchdom/k-a"] === "stale", r);

  // usage-error surface
  r = run("mark", ["--manifest", M, "--key", "batchdom/k-a", "--keys-file", worklist, "--status", "stale"]);
  check("mark: --key + --keys-file rejected (exit 1)", r.code === 1 && /not both/.test(r.stderr), r);
  const nonArray = join(ROOT, "batch-non-array.json");
  writeFileSync(nonArray, JSON.stringify({ keys: ["batchdom/k-a"] }));
  r = run("mark", ["--manifest", M, "--keys-file", nonArray, "--status", "stale"]);
  check("mark: non-array keys file rejected (exit 1)", r.code === 1 && /JSON array/.test(r.stderr), r);
  r = run("mark", ["--manifest", M, "--keys-file", worklist, "--status", "documented", "--fingerprint", FP]);
  check("mark: --fingerprint with --keys-file rejected (per-asset)", r.code === 1 && /per-asset/.test(r.stderr), r);
  r = run("mark", ["--manifest", M, "--keys-file", worklist, "--status", "documented", "--doc-path", "x.md"]);
  check("mark: --doc-path with --keys-file rejected (per-asset)", r.code === 1 && /per-asset/.test(r.stderr), r);
  r = run("mark", ["--manifest", M, "--key", "batchdom/k-a", "--status", "stale", "--limit", "1"]);
  check("mark: --limit without --keys-file rejected (exit 1)", r.code === 1 && /--limit only applies/.test(r.stderr), r);
  r = run("mark", ["--manifest", M, "--keys-file", worklist, "--status", "stale", "--limit", "-1"]);
  check("mark: negative --limit rejected (exit 1)", r.code === 1 && /non-negative/.test(r.stderr), r);

  // F-165: a flag left as the LAST token has lost its value — the exact shape
  // both gap-fill fences render if the budget placeholder substitutes empty.
  // Read as "absent", --limit would silently stop bounding the batch, so this
  // is pinned by CONSEQUENCE (nothing written) as well as by exit code: the
  // pre-fix behavior was exit 0 with the whole list marked.
  const beforeBare = JSON.stringify(batchStatuses());
  r = run("mark", ["--manifest", M, "--keys-file", worklist, "--status", "documented", "--limit"]);
  check("mark: trailing bare --limit rejected, not read as absent (F-165)", r.code === 1 && /--limit requires a value/.test(r.stderr), r);
  check("mark: trailing bare --limit wrote nothing (F-165)", JSON.stringify(batchStatuses()) === beforeBare, batchStatuses());
  // The adjacent spelling already errored pre-fix; locked so the two stay
  // consistent rather than diverging again.
  r = run("mark", ["--manifest", M, "--keys-file", worklist, "--status", "documented", "--limit", ""]);
  check("mark: --limit with an empty value still rejected (F-165)", r.code === 1 && /non-negative/.test(r.stderr), r);
  // The guard lives in opt(), so it covers every value-taking flag — not just
  // the budget one that exposed it.
  r = run("mark", ["--manifest", M, "--keys-file", worklist, "--status"]);
  check("mark: trailing bare --status rejected too (opt-level guard, F-165)", r.code === 1 && /--status requires a value/.test(r.stderr), r);
  r = run("report", ["--manifest"]);
  check("report: trailing bare --manifest rejected (opt-level guard, F-165)", r.code === 1 && /--manifest requires a value/.test(r.stderr), r);
  // Converse: a valued --limit still works, so the guard did not just break the flag.
  r = run("mark", ["--manifest", M, "--keys-file", worklist, "--status", "stale", "--limit", "1"]);
  check("mark: valued --limit still bounds the batch (F-165 converse)", r.code === 0 && r.json?.marked === 1, r);

  // ── review-gate F-168: inherited-prototype keys must be UNKNOWN, not truthy ─
  // The inventory is JSON.parse output, so "__proto__"/"toString" are truthy at
  // plain lookup; pre-fix, mark reported success while assigning onto the
  // prototype and writing nothing, and remove counted a no-op delete as removed.
  const protoKeys = join(ROOT, "batch-proto.json");
  writeFileSync(protoKeys, JSON.stringify(["__proto__"]));
  const beforeProto = readFileSync(M, "utf8");
  r = run("mark", ["--manifest", M, "--keys-file", protoKeys, "--status", "stale"]);
  check("mark: __proto__ key is unknown -> exit 1, zero writes (F-168)", r.code === 1 && /no inventory entry/.test(r.stderr) && readFileSync(M, "utf8") === beforeProto, r);
  writeFileSync(protoKeys, JSON.stringify(["toString"]));
  r = run("remove", ["--manifest", M, "--keys-file", protoKeys]);
  check("remove: prototype key reported missing, removed 0 (F-168)", r.code === 0 && r.json?.removed === 0 && r.json?.missing[0] === "toString", r);

  // ── review-gate F-169: duplicate keys collapse before the --limit cut ───────
  const dupKeys = join(ROOT, "batch-dup.json");
  writeFileSync(dupKeys, JSON.stringify(["batchdom/k-a", "batchdom/k-a", "batchdom/k-b"]));
  r = run("mark", ["--manifest", M, "--keys-file", dupKeys, "--status", "failed", "--limit", "2"]);
  check("mark: duplicate key neither consumes budget nor inflates marked (F-169)", r.code === 0 && r.json?.marked === 2 && batchStatuses()["batchdom/k-a"] === "failed" && batchStatuses()["batchdom/k-b"] === "failed", { r, statuses: batchStatuses() });

  // ── review-gate F-171: a duplicated flag whose trailing repeat is bare fails ─
  r = run("mark", ["--manifest", M, "--keys-file", worklist, "--status", "stale", "--limit", "1", "--limit"]);
  check("mark: valued --limit with a bare trailing repeat rejected (F-171)", r.code === 1 && /--limit requires a value/.test(r.stderr), r);
}

// ── wave-2 portability: filename legality + case-collision (F-125/F-126) ─────
{
  const { docBaseName, docNameClaimer, cmpName, cmpKey, shq, needsPosixQuoteCaveat } = await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "doc-lib.mjs")).href);
  // F-126: reserved Windows device names are hash-suffixed — with or without
  // an extension — so a doc write can never target NUL/CON/COM1 on the
  // Windows versions that still reserve them.
  check("docBaseName: reserved device name hash-suffixed (F-126)", /^NUL-[0-9a-f]{8}$/.test(docBaseName("NUL")), docBaseName("NUL"));
  check("docBaseName: reserved name with extension hash-suffixed", /^con\.backup-[0-9a-f]{8}$/.test(docBaseName("con.backup")), docBaseName("con.backup"));
  check("docBaseName: near-reserved names untouched (NUL2, CONSOLE)", docBaseName("NUL2") === "NUL2" && docBaseName("CONSOLE") === "CONSOLE", null);
  // F-126: 80-char cap, hash-suffixed for uniqueness after truncation
  const long = "x".repeat(100);
  check("docBaseName: long ids capped at 80 + hash", /^x{80}-[0-9a-f]{8}$/.test(docBaseName(long)), docBaseName(long));
  check("docBaseName: clean short ids stay identity", docBaseName("Company") === "Company", null);

  // F-128/F-140: the report comparators are pinned to "en" so row order is
  // identical across machines. Pinned as BEHAVIOR, not implementation: both
  // comparators must order a known locale-divergent pair the "en" way. The
  // second assertion locks the PAIR itself — if someone swapped in an
  // all-locales-agree pair the first check would silently become vacuous.
  // Honest residual: on a machine whose default ICU locale already IS English,
  // dropping the "en" argument entirely still passes here, because there the
  // default and the pin coincide. These checks fire on any non-English default
  // — which is precisely the machine the pin exists to protect — and on any
  // mutant that swaps "en" for a different explicit locale.
  const sgn = (n) => Math.sign(n);
  const A = "z";
  const B = String.fromCharCode(0x00e4); // a-umlaut: sorts after z in sv, with a in en
  check(
    "cmpName: pinned to en for a locale-divergent pair (F-128/F-140)",
    sgn(cmpName(A, B)) === sgn(A.localeCompare(B, "en", { sensitivity: "base" })),
    { got: sgn(cmpName(A, B)), en: sgn(A.localeCompare(B, "en", { sensitivity: "base" })) }
  );
  check(
    "cmpKey: pinned to en for a locale-divergent pair (F-128/F-140)",
    sgn(cmpKey(A, B)) === sgn(A.localeCompare(B, "en")),
    { got: sgn(cmpKey(A, B)), en: sgn(A.localeCompare(B, "en")) }
  );
  check(
    "comparator pin: the chosen pair really is locale-divergent (guards the two checks above)",
    sgn(A.localeCompare(B, "en", { sensitivity: "base" })) !== sgn(A.localeCompare(B, "sv", { sensitivity: "base" })) &&
      sgn(A.localeCompare(B, "en")) !== sgn(A.localeCompare(B, "sv")),
    { en: sgn(A.localeCompare(B, "en")), sv: sgn(A.localeCompare(B, "sv")) }
  );

  // F-144: ICU treats default-ignorable codepoints (NUL, soft hyphen) as
  // completely ignorable, so without the code-unit tiebreaker two DISTINCT
  // NUL-composite strings compare 0 and composite sort keys get nothing from
  // their delimiter. The codepoints are built via fromCharCode so this file
  // never contains them (check-doc-drift check 8 rationale).
  {
    const NUL = String.fromCharCode(0);
    const p = "A" + NUL + "BC"; // fields split A|BC
    const q = "AB" + NUL + "C"; // fields split AB|C — a different composite
    check("cmpKey: NUL-composite distinct strings never compare 0 (F-144)", cmpKey(p, q) !== 0, { cmp: cmpKey(p, q) });
    check("cmpName: collation-ignorable-only difference still breaks ties (F-144)", cmpName(p, q) !== 0, { cmp: cmpName(p, q) });
    check("comparator tiebreak is deterministic and antisymmetric (F-144)", sgn(cmpKey(p, q)) === -sgn(cmpKey(q, p)), { pq: cmpKey(p, q), qp: cmpKey(q, p) });
  }

  // F-142: the backslash is OUT of shq's bare-token set. Bash eats unquoted
  // backslashes silently, so a Windows path must come out single-quoted —
  // and, carrying no apostrophe, must NOT trigger the PowerShell caveat
  // (single quotes preserve backslashes verbatim; no escape sequence is
  // produced). Bare POSIX tokens still pass through unquoted.
  {
    const winPath = "C:\\Temp\\ws\\er-index.json";
    check("shq: Windows path is single-quoted, never bare (F-142)", shq(winPath) === `'${winPath}'`, shq(winPath));
    check("shq: quoted Windows path draws no PowerShell caveat (F-142)", !needsPosixQuoteCaveat(shq(winPath)), shq(winPath));
    check("shq: clean POSIX tokens still pass bare (F-142)", shq("slug/reports-adhoc") === "slug/reports-adhoc" && shq("--query") === "--query", null);
  }

  // F-125/F-156: stub's dedup fires case-insensitively — distinct ids that
  // collide as FILENAMES on Windows/macOS get the shared -dup suffix on every
  // OS (the old stub-only "~" suffix is gone; one rule for every doc writer).
  const collideFile = join(ROOT, "collide.json");
  writeFileSync(collideFile, JSON.stringify({ data: [{ id: "Company", name: "Upper" }, { id: "company", name: "Lower" }] }));
  run("upsert-batch", ["--manifest", M, "--file", collideFile, "--domain", "collidedom", "--id-field", "id", "--name-field", "name"]);
  const collideOut = join(ROOT, "acme-sbx", "collidedom");
  r = run("stub", ["--manifest", M, "--file", collideFile, "--domain", "collidedom", "--id-field", "id", "--name-field", "name", "--out-dir", collideOut]);
  const written = readdirSync(collideOut);
  check("stub: case-colliding ids get distinct filenames on every OS (F-125)", r.json?.stubbed === 2 && written.length === 2 && written.some((f) => f.includes("-dup")) && !written.some((f) => f.includes("~")), { stubbed: r.json?.stubbed, written });

  // F-156: docNameClaimer unit checks — the disk-keyed half the CLI fixtures
  // above cannot see. (1) A case-colliding file from an EARLIER pass blocks
  // the plain name whatever this run's order; (2) an exact-case match is this
  // id's own doc and is reused (rerun idempotency); (3) claims stack -dup
  // deterministically past both disk and in-run collisions.
  {
    const claimDir = join(ROOT, "claimer-seed");
    mkdirSync(claimDir, { recursive: true });
    writeFileSync(join(claimDir, "Company.md"), "# other id's doc\n");
    const claim = docNameClaimer(claimDir);
    check("claimer: on-disk case-collider forces the suffix, any order (F-156)", claim("company") === "company-dup", null);
    check("claimer: in-run claims stack past disk claims (F-156)", claim("COMPANY") === "COMPANY-dup-dup", null);
    const claimAgain = docNameClaimer(claimDir);
    check("claimer: exact-case on-disk match is reused — rerun idempotent (F-156)", claimAgain("Company") === "Company", null);
    const claimEmpty = docNameClaimer(join(ROOT, "claimer-nonexistent"));
    check("claimer: missing dir seeds empty, plain name claimed (F-156)", claimEmpty("Company") === "Company", null);
  }
}

// ── F-108: listCommand recording + the exclude verb ──────────────────────────
{
  const lj = () => JSON.parse(readFileSync(M, "utf8"));
  const lcFile = join(ROOT, "lc.json");
  writeFileSync(lcFile, JSON.stringify({ data: [{ id: "lc-1", name: "LC One" }] }));
  r = run("upsert-batch", ["--manifest", M, "--file", lcFile, "--domain", "lcdom", "--id-field", "id", "--name-field", "name", "--list-command", "gs-admin --json cn list"]);
  check("listCommand: recorded in the stamp when passed", r.code === 0 && lj().domains_indexed?.lcdom?.listCommand === "gs-admin --json cn list", r);
  r = run("upsert-batch", ["--manifest", M, "--file", lcFile, "--domain", "lcdom", "--id-field", "id"]);
  check("listCommand: carries forward when the flag is omitted", r.code === 0 && lj().domains_indexed?.lcdom?.listCommand === "gs-admin --json cn list", r);
  r = run("upsert-batch", ["--manifest", M, "--file", lcFile, "--domain", "lcdom", "--id-field", "id", "--list-command", "gs-admin --json cn list --limit 500"]);
  check("listCommand: passing the flag again re-records", r.code === 0 && lj().domains_indexed?.lcdom?.listCommand === "gs-admin --json cn list --limit 500", r);
  r = run("upsert-batch", ["--manifest", M, "--file", lcFile, "--domain", "lcdom", "--id-field", "id", "--list-command", "cn list"]);
  check("listCommand: non-gs-admin command line rejected (exit 1)", r.code === 1 && /--list-command must be a single gs-admin command line/.test(r.stderr), r);
  check("listCommand: rejected value leaves the recording untouched", lj().domains_indexed?.lcdom?.listCommand === "gs-admin --json cn list --limit 500", null);
  check("listCommand: a never-recorded domain stamps null", lj().domains_indexed?.bomdom?.listCommand === null, null);

  // exclude: the durable index-or-exclude record (domains_excluded)
  r = run("exclude", ["--manifest", M, "--command", "rules-engine rules list-rest-connections", "--reason", "subsumed by the connectors domain"]);
  check("exclude: a record write without --check or --no-check is refused — the decision records its evidence (F-449, exit 1)", r.code === 1 && /exactly one of --check/.test(r.stderr) && !Object.hasOwn(lj().domains_excluded ?? {}, "rules-engine rules list-rest-connections"), r);
  r = run("exclude", ["--manifest", M, "--command", "rules-engine rules list-rest-connections", "--reason", "subsumed by the connectors domain", "--no-check", "fixture: no capture"]);
  check("exclude: records {reason, decidedAt, noCheck} keyed by canonical path", r.code === 0 && r.json?.updated === false && r.json?.kind === "judgment" && lj().domains_excluded?.["rules-engine rules list-rest-connections"]?.reason === "subsumed by the connectors domain" && lj().domains_excluded?.["rules-engine rules list-rest-connections"]?.noCheck === "fixture: no capture" && typeof lj().domains_excluded?.["rules-engine rules list-rest-connections"]?.decidedAt === "string", r);
  r = run("report", ["--manifest", M]);
  check("report: domains_excluded exposed", r.json?.domains_excluded?.["rules-engine rules list-rest-connections"]?.reason === "subsumed by the connectors domain", r.json?.domains_excluded);
  r = run("exclude", ["--manifest", M, "--command", "rules-engine rules list-rest-connections", "--reason", "filtered view of an already-indexed list", "--no-check", "fixture: no capture"]);
  check("exclude: re-excluding updates and reports the previous reason", r.code === 0 && r.json?.updated === true && r.json?.previousReason === "subsumed by the connectors domain", r);
  r = run("exclude", ["--manifest", M, "--command", "rules-engine rules list-rest-connections"]);
  check("exclude: missing --reason rejected (exit 1)", r.code === 1 && /--reason/.test(r.stderr), r);
  r = run("exclude", ["--manifest", M, "--command", "gs-admin --json cn list", "--reason", "x"]);
  check("exclude: full command line rejected — canonical path only (exit 1)", r.code === 1 && /canonical command path/.test(r.stderr), r);
  r = run("exclude", ["--manifest", M, "--command", "__proto__", "--reason", "x"]);
  check("exclude: prototype-polluting key rejected by the path shape (exit 1)", r.code === 1 && /canonical command path/.test(r.stderr), r);
  check("exclude: rejected key wrote nothing to the prototype", lj().domains_excluded?.constructor !== undefined && !Object.hasOwn(lj().domains_excluded, "__proto__"), null);
  // F-227: the word ceiling is an anti-garbage bound, not a mirror of the
  // catalog's current max path (5 words) — the old {0,4} ceiling equalled that
  // max, so the first 6-word CLI path would have been undecidable entirely.
  r = run("exclude", ["--manifest", M, "--command", "one two three four five six", "--reason", "ceiling probe - six words must be recordable", "--no-check", "fixture"]);
  check("exclude: 6-word canonical path accepted — ceiling sits above the catalog max (F-227)", r.code === 0 && r.json?.ok === true, r);
  run("exclude", ["--manifest", M, "--command", "one two three four five six", "--remove"]);
  r = run("exclude", ["--manifest", M, "--command", "w1 w2 w3 w4 w5 w6 w7 w8 w9 w10 w11", "--reason", "x"]);
  check("exclude: 11-word garbage still rejected by the ceiling (F-227)", r.code === 1 && /canonical command path/.test(r.stderr), r);
  r = run("exclude", ["--manifest", M, "--command", "connectors list", "--reason", "référence"]);
  check("exclude: non-ASCII reason rejected (exit 1)", r.code === 1 && /printable ASCII/.test(r.stderr), r);
  r = run("exclude", ["--manifest", M, "--command", "connectors list", "--reason", "x".repeat(1001)]);
  check("exclude: over-long reason rejected (exit 1)", r.code === 1 && /too long/.test(r.stderr), r);
  // F-222: the reject side alone let the cap sit INSIDE the working distribution
  // for a whole tenant round. These pin the ACCEPT side — a reason at the length
  // the live ledger actually produced, and one at the cap itself — so a future
  // tightening turns the suite red instead of silently trimming the rationales
  // that need the most explanation.
  r = run("exclude", ["--manifest", M, "--command", "connectors list", "--reason", "x".repeat(292), "--no-check", "fixture"]);
  check(
    "exclude: a 292-char reason (the live ledger's longest) is accepted — F-222",
    r.code === 0 && lj().domains_excluded?.["connectors list"]?.reason.length === 292,
    r
  );
  r = run("exclude", ["--manifest", M, "--command", "connectors list", "--reason", "y".repeat(1000), "--no-check", "fixture"]);
  check("exclude: a reason exactly at the cap is accepted — F-222", r.code === 0, r);
  r = run("block", ["--manifest", M, "--command", "connectors activity", "--reason", "z".repeat(900)]);
  check(
    "block: shares the raised reason cap with exclude — F-222",
    r.code === 0 && lj().domains_blocked?.["connectors activity"]?.reason.length === 900,
    r
  );
  r = run("exclude", ["--manifest", M, "--command", "rules-engine rules list-rest-connections", "--remove"]);
  check("exclude: --remove lifts the exclusion", r.code === 0 && r.json?.removed === true && !Object.hasOwn(lj().domains_excluded ?? {}, "rules-engine rules list-rest-connections"), r);
  r = run("exclude", ["--manifest", M, "--command", "rules-engine rules list-rest-connections", "--remove"]);
  check("exclude: --remove of an absent record reports removed false", r.code === 0 && r.json?.removed === false, r);
  r = run("exclude", ["--manifest", M, "--command", "connectors list", "--reason", "x", "--remove"]);
  check("exclude: --remove with --reason rejected (exit 1)", r.code === 1 && /takes no --reason/.test(r.stderr), r);

  // block: "could not evaluate" record (domains_blocked, F-218) — same key
  // shape as exclude, opposite semantics (never a decision, never goes quiet)
  r = run("block", ["--manifest", M, "--command", "journey emails connectors", "--reason", "HTTP 500 - deterministic across 3 attempts", "--recheck-after", "2027-01-01"]);
  check(
    "block: records {reason, decidedAt, recheckAfter} keyed by canonical path",
    r.code === 0 &&
      r.json?.updated === false &&
      lj().domains_blocked?.["journey emails connectors"]?.reason === "HTTP 500 - deterministic across 3 attempts" &&
      typeof lj().domains_blocked?.["journey emails connectors"]?.decidedAt === "string" &&
      lj().domains_blocked?.["journey emails connectors"]?.recheckAfter === "2027-01-01",
    r
  );
  r = run("report", ["--manifest", M]);
  check("report: domains_blocked exposed", r.json?.domains_blocked?.["journey emails connectors"]?.recheckAfter === "2027-01-01", r.json?.domains_blocked);
  r = run("block", ["--manifest", M, "--command", "journey emails connectors", "--reason", "still 500 on retry"]);
  check("block: re-blocking updates and reports the previous reason", r.code === 0 && r.json?.updated === true && /HTTP 500/.test(r.json?.previousReason ?? ""), r);
  check("block: re-block without --recheck-after drops the stale date", !Object.hasOwn(lj().domains_blocked?.["journey emails connectors"] ?? {}, "recheckAfter"), lj().domains_blocked);
  r = run("block", ["--manifest", M, "--command", "journey emails connectors", "--reason", "x", "--recheck-after", "next week"]);
  check("block: malformed --recheck-after rejected (exit 1)", r.code === 1 && /YYYY-MM-DD/.test(r.stderr), r);
  r = run("block", ["--manifest", M, "--command", "gs-admin --json jo e connectors", "--reason", "x"]);
  check("block: full command line rejected — canonical path only (exit 1)", r.code === 1 && /canonical command path/.test(r.stderr), r);
  r = run("block", ["--manifest", M, "--command", "__proto__", "--reason", "x"]);
  check("block: prototype-polluting key rejected by the path shape (exit 1)", r.code === 1 && /canonical command path/.test(r.stderr), r);
  // a block must never overwrite a decision
  run("exclude", ["--manifest", M, "--command", "connectors widgets", "--reason", "organizational containers", "--no-check", "fixture"]);
  r = run("block", ["--manifest", M, "--command", "connectors widgets", "--reason", "x"]);
  check("block: blocking an EXCLUDED command rejected — a block cannot overwrite a decision (exit 1)", r.code === 1 && /already EXCLUDED/.test(r.stderr), r);
  // a decision supersedes a block: exclude lifts it in the same write
  r = run("exclude", ["--manifest", M, "--command", "journey emails connectors", "--reason", "looked at last - genuinely reference data", "--no-check", "fixture"]);
  check(
    "exclude: excluding a blocked command lifts the block in the same write (blockLifted)",
    r.code === 0 && r.json?.blockLifted === true && !Object.hasOwn(lj().domains_blocked ?? {}, "journey emails connectors") && lj().domains_excluded?.["journey emails connectors"]?.reason === "looked at last - genuinely reference data",
    r
  );
  r = run("exclude", ["--manifest", M, "--command", "connectors list", "--reason", "x", "--no-check", "fixture", "--recheck-after", "2027-01-01"]);
  check("exclude: --recheck-after recorded on an exclusion — the permanent decision gets the review affordance a block has (F-449)", r.code === 0 && lj().domains_excluded?.["connectors list"]?.recheckAfter === "2027-01-01", r);
  r = run("exclude", ["--manifest", M, "--command", "connectors list", "--reason", "x", "--no-check", "fixture", "--recheck-after", "soon"]);
  check("exclude: malformed --recheck-after rejected (exit 1)", r.code === 1 && /YYYY-MM-DD/.test(r.stderr), r);
  r = run("exclude", ["--manifest", M, "--command", "connectors list", "--remove", "--recheck-after", "2027-01-01"]);
  check("exclude: --recheck-after with --remove rejected (exit 1)", r.code === 1 && /never with --remove/.test(r.stderr), r);
  check("exclude: rejected --remove left the record in place", Object.hasOwn(lj().domains_excluded ?? {}, "connectors list"), lj().domains_excluded);

  // F-449 — the verdict is bound to the check's numbers. The check outputs
  // below are the shape domain-candidates.mjs check --out writes (pinned in
  // test/domain-candidates.mjs; this suite exercises what exclude DOES with
  // them). The live instance: 253 of 586 recorded as "covered by
  // data-management, more completely".
  const checkOf = (name, o) => {
    const p = join(dirname(M), `check-${name}.json`);
    writeFileSync(p, JSON.stringify({ ok: true, rows: o.rows, idsExtracted: o.rows, unresolvedRows: o.unresolved ?? 0, partial: o.partial ?? false, uniqueIds: o.rows, alreadyIndexed: o.matched, allIndexed: o.partial || o.rows === 0 ? null : o.matched === o.rows, noneIndexed: o.partial || o.rows === 0 ? null : o.matched === 0, matchedByDomain: o.byDomain ?? {}, sampleMatches: [], warnings: [] }));
    return p;
  };
  const partial253 = checkOf("partial-253", { rows: 586, matched: 253, byDomain: { "data-management": 253 } });
  r = run("exclude", ["--manifest", M, "--command", "report list-objects", "--reason", "Redundant plus schema reference - covered more completely by data-management", "--check", partial253, "--covered-by", "data-management"]);
  check("exclude: --covered-by on a partial overlap is REFUSED, quoting the numbers (the live F-449 instance)", r.code === 1 && /NOT covered by data-management/.test(r.stderr) && /253 of 586/.test(r.stderr) && /Adopt the candidate/.test(r.stderr) && !Object.hasOwn(lj().domains_excluded ?? {}, "report list-objects"), r);
  r = run("exclude", ["--manifest", M, "--command", "report list-objects", "--reason", "judgment: rows are a schema reference feed", "--check", partial253]);
  check("exclude: the same check without --covered-by records a judgment exclusion carrying the evidence", r.code === 0 && r.json?.kind === "judgment" && lj().domains_excluded?.["report list-objects"]?.evidence?.alreadyIndexed === 253 && lj().domains_excluded?.["report list-objects"]?.evidence?.uniqueIds === 586 && lj().domains_excluded?.["report list-objects"]?.evidence?.matchedByDomain?.["data-management"] === 253 && !Object.hasOwn(lj().domains_excluded?.["report list-objects"] ?? {}, "coveredBy") && !Object.hasOwn(lj().domains_excluded?.["report list-objects"] ?? {}, "noCheck"), r);
  run("exclude", ["--manifest", M, "--command", "report list-objects", "--remove"]);
  const all59 = checkOf("all-59", { rows: 59, matched: 59, byDomain: { "data-management": 59 } });
  r = run("exclude", ["--manifest", M, "--command", "journey data-designer list", "--reason", "filtered view of data-management", "--check", all59]);
  check("exclude: a check that proves coverage is REFUSED without --covered-by (the claim is structural both ways)", r.code === 1 && /record it as one: --covered-by data-management/.test(r.stderr), r);
  r = run("exclude", ["--manifest", M, "--command", "journey data-designer list", "--reason", "filtered view of data-management", "--check", all59, "--covered-by", "rules-engine"]);
  check("exclude: --covered-by naming a domain the check did not match is refused", r.code === 1 && /NOT covered by rules-engine/.test(r.stderr), r);
  r = run("exclude", ["--manifest", M, "--command", "journey data-designer list", "--reason", "filtered view of data-management", "--check", all59, "--covered-by", "data-management"]);
  check("exclude: --covered-by accepted when every id sits under that one domain; kind coverage, evidence recorded", r.code === 0 && r.json?.kind === "coverage" && lj().domains_excluded?.["journey data-designer list"]?.coveredBy === "data-management" && lj().domains_excluded?.["journey data-designer list"]?.evidence?.rows === 59, r);
  const split = checkOf("split", { rows: 6, matched: 6, byDomain: { connectors: 3, "data-designer": 3 } });
  r = run("exclude", ["--manifest", M, "--command", "data-designer sources list", "--reason", "3 connections plus 3 sentinel rows split across two domains", "--check", split]);
  check("exclude: all-indexed across TWO domains is a judgment exclusion — allowed without --covered-by", r.code === 0 && r.json?.kind === "judgment", r);
  r = run("exclude", ["--manifest", M, "--command", "data-designer sources list", "--reason", "x", "--check", split, "--covered-by", "connectors"]);
  check("exclude: --covered-by one of two covering domains is refused (3 of 6 under it)", r.code === 1 && /NOT covered by connectors/.test(r.stderr) && /connectors: 3, data-designer: 3/.test(r.stderr), r);
  const partialExtract = checkOf("partial-extract", { rows: 10, matched: 4, unresolved: 6, partial: true, byDomain: { connectors: 4 } });
  r = run("exclude", ["--manifest", M, "--command", "connectors px", "--reason", "x", "--check", partialExtract]);
  check("exclude: a PARTIAL check is refused outright — it answers for the resolvable subset only", r.code === 1 && /PARTIAL/.test(r.stderr) && /6 row\(s\)/.test(r.stderr), r);
  const empty = checkOf("empty", { rows: 0, matched: 0 });
  r = run("exclude", ["--manifest", M, "--command", "connectors px", "--reason", "empty on this tenant - 0 rows", "--check", empty, "--recheck-after", "2030-06-01"]);
  check("exclude: a 0-row check (answer withheld) still records a judgment exclusion with its evidence and a recheck date", r.code === 0 && r.json?.kind === "judgment" && lj().domains_excluded?.["connectors px"]?.evidence?.rows === 0 && lj().domains_excluded?.["connectors px"]?.recheckAfter === "2030-06-01", r);
  r = run("exclude", ["--manifest", M, "--command", "connectors px", "--reason", "x", "--check", empty, "--covered-by", "connectors"]);
  check("exclude: --covered-by on a withheld (0-row) check is refused, naming the withheld answer", r.code === 1 && /answer is withheld \(0 rows\)/.test(r.stderr), r);
  r = run("exclude", ["--manifest", M, "--command", "connectors px", "--reason", "x", "--no-check", "no items array", "--covered-by", "connectors"]);
  check("exclude: --covered-by with --no-check is refused — a coverage claim needs the numbers", r.code === 1 && /needs the check's numbers/.test(r.stderr), r);
  r = run("exclude", ["--manifest", M, "--command", "connectors px", "--reason", "x", "--no-check", "n", "--check", empty]);
  check("exclude: --check and --no-check together refused", r.code === 1 && /exactly one of --check/.test(r.stderr), r);
  const notCheck = join(dirname(M), "check-not-a-check.json");
  writeFileSync(notCheck, JSON.stringify({ data: [{ id: 1 }] }));
  r = run("exclude", ["--manifest", M, "--command", "connectors px", "--reason", "x", "--check", notCheck]);
  check("exclude: a --check file that is not a check output (a captured list) is refused", r.code === 1 && /not a domain-candidates.mjs check output/.test(r.stderr), r);
  writeFileSync(notCheck, "{not json");
  r = run("exclude", ["--manifest", M, "--command", "connectors px", "--reason", "x", "--check", notCheck]);
  check("exclude: an unparseable --check file is refused", r.code === 1 && /cannot parse --check/.test(r.stderr), r);
  r = run("exclude", ["--manifest", M, "--command", "connectors px", "--reason", "x", "--check", empty, "--covered-by", "Data Management"]);
  check("exclude: --covered-by must be a domain name (exit 1)", r.code === 1 && /must be a manifest domain name/.test(r.stderr), r);
  r = run("block", ["--manifest", M, "--command", "connectors list", "--remove", "--recheck-after", "2027-01-01"]);
  check("block: --recheck-after with --remove rejected (exit 1)", r.code === 1 && /applies only when recording a block/.test(r.stderr), r);
  run("block", ["--manifest", M, "--command", "connectors jobs", "--reason", "x"]);
  r = run("block", ["--manifest", M, "--command", "connectors jobs", "--remove"]);
  check("block: --remove lifts the block", r.code === 0 && r.json?.removed === true && !Object.hasOwn(lj().domains_blocked ?? {}, "connectors jobs"), r);
}

// ── stub banner: the three recorded describe states (F-334 → gate-3 F-346) ──
// The banner is the doc's own completeness claim, so it may only say what the
// recording KNOWS. A recorded template means the stub is a shallow placeholder
// and --deep is its upgrade path (pinned on the journey-email-templates
// fixture above). A recorded `--describe-command none` is the operator's
// list-only decision: the stub is the asset's complete doc. NOTHING recorded
// (an operator who never passed the flag, or a legacy stamp) claims neither —
// the pre-F-346 rule read that state as list-only, so a describable domain
// indexed without the flag had every stub stamped "complete". Every variant
// keeps the STUB_MARKER blockquote (jo-report's parseJourneyDoc keys depth
// "stub" on it — the fence holds a raw list item either way).
{
  const M3 = join(ROOT, "f334", "_manifest.json");
  run("init", ["--manifest", M3, "--slug", "f334", "--base-url", "https://a.example"]);
  const jobsFile = join(ROOT, "f334-jobs.json");
  writeFileSync(jobsFile, JSON.stringify({ data: [{ jobId: "j-1", jobName: "Nightly Sync" }] }));
  const jobsDir = join(ROOT, "f334", "connectors-jobs");
  const stubJobs = () => run("stub", ["--manifest", M3, "--file", jobsFile, "--domain", "connectors-jobs", "--id-field", "jobId", "--name-field", "jobName", "--out-dir", jobsDir]);
  // (1) UNRECORDED — the F-346 repro: a describable domain indexed without the
  // flag must never be stamped complete, and must never advertise a --deep
  // that has no recording to run.
  run("upsert-batch", ["--manifest", M3, "--file", jobsFile, "--domain", "connectors-jobs", "--id-field", "jobId", "--name-field", "jobName", "--no-date-field"]);
  r = stubJobs();
  const unrecStub = readFileSync(join(jobsDir, "j-1.md"), "utf8");
  check("stub F-346: no recorded describe command → completeness UNKNOWN banner, marker kept, describeState reported",
    r.json?.stubbed === 1 && r.json?.describeState === "unrecorded" && /Metadata-only stub/.test(unrecStub) && /completeness UNKNOWN/.test(unrecStub), unrecStub.slice(0, 250));
  check("stub F-346: the unrecorded banner claims neither completeness nor a working --deep, and names both ways to resolve it",
    !/list-only \(complete\)/.test(unrecStub) && !/^> `\/gs-superadmin:setup --deep/m.test(unrecStub) &&
      /--describe-command "gs-admin/.test(unrecStub) && /--describe-command none/.test(unrecStub), unrecStub.slice(0, 400));
  // (2) LIST-ONLY — the recorded decision; carries forward on an omitting re-index.
  run("upsert-batch", ["--manifest", M3, "--file", jobsFile, "--domain", "connectors-jobs", "--id-field", "jobId", "--name-field", "jobName", "--describe-command", "none"]);
  check("upsert F-346: --describe-command none is stored verbatim (skips the template grammar)",
    JSON.parse(readFileSync(M3, "utf8")).domains_indexed["connectors-jobs"].describeCommand === "none", null);
  run("upsert-batch", ["--manifest", M3, "--file", jobsFile, "--domain", "connectors-jobs", "--id-field", "jobId", "--name-field", "jobName"]);
  check("upsert F-346: an omitting re-index keeps the recorded none",
    JSON.parse(readFileSync(M3, "utf8")).domains_indexed["connectors-jobs"].describeCommand === "none", null);
  r = stubJobs();
  const jobStub = readFileSync(join(jobsDir, "j-1.md"), "utf8");
  check("stub F-346: recorded none → list-only (complete) banner, marker kept", r.json?.stubbed === 1 && r.json?.describeState === "list-only" && /Metadata-only stub/.test(jobStub) && /list-only \(complete\)/.test(jobStub) && /everything the CLI can say/.test(jobStub), jobStub.slice(0, 250));
  check("stub: list-only banner never advertises --deep", !/--deep/.test(jobStub), jobStub.slice(0, 250));
  // (3) LEGACY bare-timestamp stamp: nothing is known — the unrecorded banner,
  // never the old --deep default that promised a run with no recording.
  const m3 = JSON.parse(readFileSync(M3, "utf8"));
  m3.domains_indexed["connectors-jobs"] = "2026-01-01T00:00:00.000Z";
  writeFileSync(M3, JSON.stringify(m3, null, 2) + "\n");
  r = stubJobs();
  const legacyStub = readFileSync(join(jobsDir, "j-1.md"), "utf8");
  check("stub F-346: legacy bare-timestamp stamp → completeness UNKNOWN, neither complete nor --deep-pointed",
    r.json?.stubbed === 1 && r.json?.describeState === "unrecorded" && /completeness UNKNOWN/.test(legacyStub) && !/list-only \(complete\)/.test(legacyStub) && !/^> `\/gs-superadmin:setup --deep/m.test(legacyStub), legacyStub.slice(0, 250));
  // (4) DESCRIBABLE — a recorded template; describeState says so.
  run("upsert-batch", ["--manifest", M3, "--file", jobsFile, "--domain", "connectors-jobs", "--id-field", "jobId", "--name-field", "jobName", "--describe-command", "gs-admin --json cn jobs --describe {id}"]);
  r = stubJobs();
  check("stub F-346: recorded template → full-ingest banner with the --deep pointer, describeState describable",
    r.json?.describeState === "describable" && /--deep connectors-jobs/.test(readFileSync(join(jobsDir, "j-1.md"), "utf8")), r.json);
}

// ── remove --domain: de-register a coverage stamp (F-333) ────────────────────
// The sanctioned exit for a phantom domains_indexed stamp: a typo'd --domain
// exits 0 with added 0 and still stamps the domain (an --id-field matching no
// row did too, until F-388 round 2 made it a failure) — which then pollutes emptyDomains and the
// candidate gate's indexed count, with hand-editing barred. Entry removal and
// stamp removal stay separate kinds; a populated domain refuses without
// --allow-populated so a typo'd remove cannot silently strip real coverage.
{
  const M4 = join(ROOT, "f333", "_manifest.json");
  run("init", ["--manifest", M4, "--slug", "f333", "--base-url", "https://a.example"]);
  const realFile = join(ROOT, "f333-real.json");
  writeFileSync(realFile, JSON.stringify({ data: [{ id: "c-1", name: "Conn" }] }));
  run("upsert-batch", ["--manifest", M4, "--file", realFile, "--domain", "connectors", "--id-field", "id", "--name-field", "name", "--no-date-field"]);
  // The F-333 premise, RETIRED by F-388 round 2: an --id-field that matches no
  // row now FAILS (exit 1) and stamps nothing — rung 0 for that phantom cause.
  // The typo'd --domain cause remains, so remove --domain stays; the phantom
  // below is made the way that cause makes it (an empty declared list).
  r = run("upsert-batch", ["--manifest", M4, "--file", realFile, "--domain", "conektors", "--id-field", "absent.field", "--no-date-field"]);
  // F-391: the rows here are {id, name} on a (typo'd) non-connector domain, so
  // the failure carries the domain-NEUTRAL sentence — the connection-shape
  // hint would be noise (the NEGATIVE pin); the positive pin follows.
  check("upsert (F-388/F-391): id-field matching no row FAILS with the neutral shape hint (no connection shape here), WITHOUT the recorded-field clause (no recording here), and stamps NOTHING (the F-333 phantom cause removed)", r.code === 1 && /--id-field absent\.field resolves to no value on any of the 1 row\(s\)/.test(r.stderr) && /an id path must name a key the rows actually carry/.test(r.stderr) && /inspect a row and pass the dot-path the installed CLI actually emits/.test(r.stderr) && !/pnpConnectionsInfo/.test(r.stderr) && !/recorded idField of domain/.test(r.stderr) && !Object.hasOwn(JSON.parse(readFileSync(M4, "utf8")).domains_indexed, "conektors"), r);
  r = run("upsert-batch", ["--manifest", M4, "--file", realFile, "--domain", "connectors", "--id-field", "absent.field", "--no-date-field"]);
  check("upsert (F-391): the SAME plain rows on the connectors domain carry the connection-shape hint (both paths, both CLI versions) — the domain alone selects it", r.code === 1 && /pnpConnectionsInfo\.connectionId/.test(r.stderr) && /top-level connectionId/.test(r.stderr) && /1\.0\.8/.test(r.stderr) && /1\.0\.9/.test(r.stderr) && !/an id path must name a key/.test(r.stderr), r);
  const flatConnFile = join(ROOT, "f391-flat-conn.json");
  writeFileSync(flatConnFile, JSON.stringify({ data: [{ connectionId: "c-1", connectionName: "Conn" }] }));
  r = run("upsert-batch", ["--manifest", M4, "--file", flatConnFile, "--domain", "rules-engine", "--id-field", "absent.field", "--no-date-field"]);
  check("upsert (F-391): connection-shaped ROWS (connectionId at the root) on a non-connector domain still carry the connection-shape hint — the rows alone select it", r.code === 1 && /pnpConnectionsInfo\.connectionId/.test(r.stderr) && !/an id path must name a key/.test(r.stderr), r);
  const emptyTypoFile = join(ROOT, "f333-empty.json");
  writeFileSync(emptyTypoFile, JSON.stringify({ data: [] }));
  r = run("upsert-batch", ["--manifest", M4, "--file", emptyTypoFile, "--domain", "conektors", "--id-field", "id", "--no-date-field", "--allow-empty"]);
  check("upsert: a typo'd --domain over an empty list exits 0 and stamps a zero-entry domain (the surviving F-333 phantom cause)", r.code === 0 && r.json?.added === 0 && Object.hasOwn(JSON.parse(readFileSync(M4, "utf8")).domains_indexed, "conektors"), r);
  r = run("report", ["--manifest", M4]);
  check("report: the phantom stamp pollutes emptyDomains", r.json?.emptyDomains?.includes("conektors") === true, r.json?.emptyDomains);
  r = run("remove", ["--manifest", M4, "--domain", "conektors"]);
  check("remove --domain: zero-entry stamp removed (removed true, entries 0)", r.code === 0 && r.json?.removed === true && r.json?.entries === 0, r);
  r = run("report", ["--manifest", M4]);
  check("remove --domain: report no longer lists the phantom anywhere", !r.json.emptyDomains.includes("conektors") && !Object.hasOwn(r.json.domains_indexed, "conektors"), r.json);
  r = run("remove", ["--manifest", M4, "--domain", "conektors"]);
  check("remove --domain: idempotent re-run reports removed false (exit 0)", r.code === 0 && r.json?.removed === false, r);
  r = run("remove", ["--manifest", M4, "--domain", "connectors"]);
  check("remove --domain: populated domain refused, naming the entry count and the override", r.code === 1 && /still holds 1 inventory entry —/.test(r.stderr) && /--allow-populated/.test(r.stderr), r);
  check("remove --domain: refused run left the stamp in place", Object.hasOwn(JSON.parse(readFileSync(M4, "utf8")).domains_indexed, "connectors"), null);
  r = run("remove", ["--manifest", M4, "--domain", "connectors", "--allow-populated"]);
  check("remove --domain: --allow-populated de-registers coverage, entries stay", r.code === 0 && r.json?.removed === true && r.json?.entries === 1 && Object.hasOwn(JSON.parse(readFileSync(M4, "utf8")).inventory, "connectors/c-1"), r);
  r = run("remove", ["--manifest", M4, "--domain", "x", "--key", "connectors/c-1"]);
  check("remove --domain: combining with --key refused (one removal kind per invocation)", r.code === 1 && /one removal kind per invocation/.test(r.stderr), r);
  r = run("remove", ["--manifest", M4, "--key", "connectors/c-1", "--allow-populated"]);
  check("remove: --allow-populated without --domain refused (never silently ignored)", r.code === 1 && /applies only with --domain/.test(r.stderr), r);
}

// ── F-388 round 2: a recorded id/date path that resolves on NO row is a failure ──
// The tester's measured reopen: flat CLI 1.0.9 connector rows fed to the
// RECORDED nested paths (refresh's own instruction — reuse the recording)
// exited 0 / ok true / added 0 with an under-pagination mis-diagnosis, and a
// dead recorded dateField read every later refresh as unchanged forever. Both
// now fail before anything is written, name the cause and the one-run remedy,
// and the remedy then works — pinned end to end on the two connection shapes
// (the flat row DERIVED from the 1.0.9 package source, not captured; acme).
{
  const M5 = join(ROOT, "f388", "_manifest.json");
  run("init", ["--manifest", M5, "--slug", "acme-f388", "--base-url", "https://a.example"]);
  const m5 = () => JSON.parse(readFileSync(M5, "utf8"));
  const exists = (p) => { try { readFileSync(p); return true; } catch { return false; } };
  const nestedFile = join(ROOT, "f388-cn-nested.json");
  writeFileSync(nestedFile, JSON.stringify({ data: [
    { pnpConnectionsInfo: { connectionId: "conn-sf-1", connectionName: "Acme Prod SFDC", connectionType: "SFDC", modifiedDateStr: "2026-01-10T00:00:00Z" } },
    { pnpConnectionsInfo: { connectionId: "conn-s3-2", connectionName: "Acme S3 Drop", connectionType: "S3", modifiedDateStr: "2026-01-12T00:00:00Z" } },
  ] }));
  const NESTED = ["--items-path", "data", "--id-field", "pnpConnectionsInfo.connectionId", "--name-field", "pnpConnectionsInfo.connectionName"];
  r = run("upsert-batch", ["--manifest", M5, "--file", nestedFile, "--domain", "connectors", ...NESTED, "--date-field", "pnpConnectionsInfo.modifiedDateStr"]);
  check("f388: the 1.0.8-era index — nested id/name/date paths recorded, 2 added", r.code === 0 && r.json?.added === 2 && m5().domains_indexed.connectors.idField === "pnpConnectionsInfo.connectionId" && m5().domains_indexed.connectors.dateField === "pnpConnectionsInfo.modifiedDateStr", r);
  const flatFile = join(ROOT, "f388-cn-flat.json");
  writeFileSync(flatFile, JSON.stringify({ data: [
    { connectionId: "conn-sf-1", connectionName: "Acme Prod SFDC", connectionType: "SFDC", connectionStatus: "AUTHORIZED", authorizationType: "OAUTH" },
    { connectionId: "conn-s3-2", connectionName: "Acme S3 Drop", connectionType: "S3", connectionStatus: "AUTHORIZED", authorizationType: "ACCESS_KEY" },
  ] }));
  const before = JSON.stringify(m5());
  // CLAIM A (tester): reusing the recording used to exit 0 / ok true / added 0.
  r = run("upsert-batch", ["--manifest", M5, "--file", flatFile, "--domain", "connectors", ...NESTED]);
  check("f388 A: flat rows against the RECORDED nested id path FAIL (exit 1) — names the recording, the shape hint and the --allow-rekey route",
    r.code === 1 && /--id-field pnpConnectionsInfo\.connectionId resolves to no value on any of the 2 row\(s\)/.test(r.stderr) && /the recorded idField of domain connectors/.test(r.stderr) && /top-level connectionId from cn list at 1\.0\.9/.test(r.stderr) && /--allow-rekey/.test(r.stderr) && /--orphans-file/.test(r.stderr) && r.json === null, r);
  check("f388 A: nothing written — manifest byte-identical", JSON.stringify(m5()) === before, null);
  r = run("upsert-batch", ["--manifest", M5, "--file", flatFile, "--domain", "connectors", "--items-path", "data", "--id-field", "connectionId", "--name-field", "connectionName"]);
  check("f388: the flat path against the nested recording still trips the re-index guard (the round-1 parenthetical)", r.code === 1 && /does not match --id-field pnpConnectionsInfo\.connectionId/.test(r.stderr), r);
  // CLAIM B (tester): the rekey run reused a DEAD recorded dateField and read every row unchanged forever.
  const orphans = join(ROOT, "f388-orphans.json");
  const REKEY = ["--items-path", "data", "--id-field", "connectionId", "--name-field", "connectionName", "--allow-rekey", "--orphans-file", orphans];
  r = run("upsert-batch", ["--manifest", M5, "--file", flatFile, "--domain", "connectors", ...REKEY]);
  check("f388 B: the rekey run with the DEAD recorded dateField FAILS — names the recording, 'change detection would be dead', the connectors case and both --allow-redate decisions",
    r.code === 1 && /--date-field pnpConnectionsInfo\.modifiedDateStr \(the recording for domain connectors\) resolves to no value on any of the 2 row\(s\) — the key is absent on every row .* — change detection would be dead/.test(r.stderr) && /--date-field <the field the installed CLI emits> --allow-redate/.test(r.stderr) && /--no-date-field --allow-redate/.test(r.stderr) && /Modified column/.test(r.stderr), r);
  check("f388 B: nothing written — still the nested recording, no orphans file", JSON.stringify(m5()) === before && !exists(orphans), null);
  // The remedy the note now prescribes, in one run: rekey + redate (this v2 row carries no modified date → --no-date-field).
  r = run("upsert-batch", ["--manifest", M5, "--file", flatFile, "--domain", "connectors", ...REKEY, "--no-date-field", "--allow-redate"]);
  check("f388 remedy: rekey + redate in ONE run — exit 0, 2 unchanged, no duplicates, orphans file empty, flat paths recorded",
    r.code === 0 && r.json?.unchanged === 2 && r.json?.added === 0 && Object.keys(m5().inventory).filter((k) => k.startsWith("connectors/")).length === 2 && JSON.parse(readFileSync(orphans, "utf8")).length === 0 && m5().domains_indexed.connectors.idField === "connectionId" && m5().domains_indexed.connectors.dateField === null, r);
  // A v2 row that DOES carry a modified date: redate to it, then change detection is alive on the next refresh (the tester's case D, inverted).
  const flatDated = join(ROOT, "f388-cn-flat-dated.json");
  // The stored dates came from the old scheme; a redate COMPARES the new field's
  // values against them (it does not baseline — entries hold non-null dates), so
  // equal timestamps read unchanged and a later one flips exactly that row.
  const dated = (d2) => JSON.stringify({ data: [
    { connectionId: "conn-sf-1", connectionName: "Acme Prod SFDC", connectionType: "SFDC", modifiedDate: "2026-01-10T00:00:00Z" },
    { connectionId: "conn-s3-2", connectionName: "Acme S3 Drop", connectionType: "S3", modifiedDate: d2 },
  ] });
  writeFileSync(flatDated, dated("2026-01-12T00:00:00Z"));
  r = run("upsert-batch", ["--manifest", M5, "--file", flatDated, "--domain", "connectors", "--items-path", "data", "--id-field", "connectionId", "--name-field", "connectionName", "--date-field", "modifiedDate", "--allow-redate"]);
  check("f388 remedy: --date-field <flat field> --allow-redate records the field and compares — equal timestamps read unchanged, nothing baselined", r.code === 0 && r.json?.unchanged === 2 && r.json?.stale === 0 && r.json?.baselined === 0 && m5().domains_indexed.connectors.dateField === "modifiedDate", r);
  writeFileSync(flatDated, dated("2026-02-09T00:00:00Z"));
  r = run("upsert-batch", ["--manifest", M5, "--file", flatDated, "--domain", "connectors", "--items-path", "data", "--id-field", "connectionId", "--name-field", "connectionName"]);
  check("f388 remedy: change detection is ALIVE after the redate — a moved date flips exactly that row stale", r.code === 0 && r.json?.stale === 1 && r.json?.unchanged === 1, r);
  // Typo protection at adoption (explicit flag, no recording): a dead explicit date field fails too.
  r = run("upsert-batch", ["--manifest", M5, "--file", flatFile, "--domain", "connectors-typo", "--items-path", "data", "--id-field", "connectionId", "--date-field", "modifiedDateStr"]);
  check("f388: an EXPLICIT date field resolving on no row fails at adoption too, without the recording clause, and stamps nothing", r.code === 1 && /--date-field modifiedDateStr resolves to no value on any of the 2 row\(s\)/.test(r.stderr) && !/the recording for domain/.test(r.stderr) && !Object.hasOwn(m5().domains_indexed, "connectors-typo"), r);
  // Partial mode: a healthy subset is unaffected; a dead recorded date field routes the decision to a FULL-list run.
  r = run("upsert-batch", ["--manifest", M5, "--file", flatDated, "--domain", "connectors", "--items-path", "data", "--id-field", "connectionId", "--partial"]);
  check("f388 partial: a healthy subset upsert is unaffected", r.code === 0 && r.json?.partial === true && r.json?.unchanged === 2, r);
  // F-392 (Gate-2 review of 0.36.1): a declared subset is EXEMPT from the date
  // refusal — email-report's gap-fill work lists are id/name-only by
  // construction, recordings cannot change under --partial, and null-stored
  // dates flip stale when a full refresh brings a value. No refusal, no warning.
  r = run("upsert-batch", ["--manifest", M5, "--file", flatFile, "--domain", "connectors", "--items-path", "data", "--id-field", "connectionId", "--partial"]);
  check("f392 partial: rows with NO date key under --partial are accepted (declared subset), no refusal, no date warning", r.code === 0 && r.json?.partial === true && r.json?.unchanged === 2 && r.json?.datePresentRows === 0 && !r.json.warnings.some((w) => /carry no/.test(w)), r);
  // F-392: the refusal's predicate is PATH ABSENT, never value null — rows that
  // carry the key with a null value are data (setup Phase 4) and pass on the
  // FULL path with no refusal and no warning.
  const nullDated = join(ROOT, "f392-null-dated.json");
  writeFileSync(nullDated, JSON.stringify({ data: [
    { connectionId: "conn-sf-1", connectionName: "Acme Prod SFDC", connectionType: "SFDC", modifiedDate: null },
    { connectionId: "conn-s3-2", connectionName: "Acme S3 Drop", connectionType: "S3", modifiedDate: null },
  ] }));
  r = run("upsert-batch", ["--manifest", M5, "--file", nullDated, "--domain", "connectors", "--items-path", "data", "--id-field", "connectionId", "--name-field", "connectionName"]);
  check("f392 FULL: a date key PRESENT with null values on every row is data — exit 0, unchanged 2, datePresentRows 2 / dateResolvedRows 0, no warning", r.code === 0 && r.json?.unchanged === 2 && r.json?.datePresentRows === 2 && r.json?.dateResolvedRows === 0 && r.json.warnings.length === 0, r);
  // F-392: partial ABSENCE on a full list is a counted warning, never silent.
  const halfDated = join(ROOT, "f392-half-dated.json");
  writeFileSync(halfDated, JSON.stringify({ data: [
    { connectionId: "conn-sf-1", connectionName: "Acme Prod SFDC", connectionType: "SFDC", modifiedDate: "2026-02-09T00:00:00Z" },
    { connectionId: "conn-s3-2", connectionName: "Acme S3 Drop", connectionType: "S3" },
  ] }));
  r = run("upsert-batch", ["--manifest", M5, "--file", halfDated, "--domain", "connectors", "--items-path", "data", "--id-field", "connectionId", "--name-field", "connectionName"]);
  check("f392 FULL: the date key absent on SOME rows → exit 0 with a warning naming the counts and the --allow-redate re-decision, datePresentRows 1", r.code === 0 && r.json?.datePresentRows === 1 && r.json.warnings.some((w) => /1 of 2 incoming row\(s\) carry no modifiedDate key at all \(1 do\)/.test(w) && /--allow-redate/.test(w)), r);
  // F-392: the email-report gap-fill shape — a journey domain that recorded a
  // dateField at setup, then an id/name-only work list registered --partial.
  const jList = join(ROOT, "f392-journey.json");
  writeFileSync(jList, JSON.stringify({ data: [{ journeyId: "p-1", name: "Acme Onboarding", modifiedDate: "2026-01-01T00:00:00Z" }] }));
  r = run("upsert-batch", ["--manifest", M5, "--file", jList, "--domain", "journey", "--items-path", "data", "--id-field", "journeyId", "--name-field", "name", "--date-field", "modifiedDate"]);
  const gap = join(ROOT, "f392-er-gap.json");
  writeFileSync(gap, JSON.stringify([{ journeyId: "p-2", name: "Acme Renewal" }, { journeyId: "p-3", name: "Acme Expansion" }]));
  r = run("upsert-batch", ["--manifest", M5, "--file", gap, "--domain", "journey", "--id-field", "journeyId", "--name-field", "name", "--partial"]);
  check("f392: email-report's gap-fill (id/name-only rows, --partial, journey dateField recorded) registers the programs — exit 0, added 2, no date warning", r.code === 0 && r.json?.added === 2 && r.json?.partial === true && !r.json.warnings.some((w) => /carry no|change detection/.test(w)) && m5().inventory["journey/p-2"]?.status === "pending", r);
  r = run("upsert-batch", ["--manifest", M5, "--file", nestedFile, "--domain", "connectors", "--items-path", "data", "--id-field", "connectionId", "--partial"]);
  check("f388 partial: a stale id path under --partial fails and routes the rekey to a FULL-list run", r.code === 1 && /resolves to no value on any of the 2 row\(s\)/.test(r.stderr) && /FULL-list upsert-batch with the new --id-field plus --allow-rekey/.test(r.stderr) && /never on a subset/.test(r.stderr), r);
}

// ── F-417 / F-418 / F-419 (the 1.0.9 adoption's tester round) ─────────────────
{
  const M6 = join(ROOT, "f417", "_manifest.json");
  run("init", ["--manifest", M6, "--slug", "acme-f417", "--base-url", "https://a.example"]);
  const m6 = () => JSON.parse(readFileSync(M6, "utf8"));
  const rowsFile = (name, rows) => { const p = join(ROOT, name); writeFileSync(p, JSON.stringify({ data: rows })); return p; };
  let r;
  // F-417: report.lookback is per domain, from each domain's own `at`; touch-refresh is gone.
  r = run("upsert-batch", ["--manifest", M6, "--file", rowsFile("f417-a.json", [{ id: "a1", name: "A", modifiedDate: "2026-01-01T00:00:00Z" }]), "--domain", "alpha", "--items-path", "data", "--id-field", "id", "--name-field", "name", "--date-field", "modifiedDate"]);
  check("f417 setup: alpha indexed", r.code === 0 && r.json?.added === 1, r.stderr);
  const m = m6();
  m.domains_indexed.beta = { at: new Date(Date.now() - 11.5 * 86400000).toISOString(), idField: "id", itemsPath: "data", describeCommand: null, dateField: "modifiedDate" };
  m.domains_indexed.gamma = { idField: "id", itemsPath: "data", describeCommand: null, dateField: null }; // legacy stamp, no `at`
  m.domains_indexed.delta = { at: new Date(Date.now() + 3600000).toISOString(), idField: "id", itemsPath: "data", describeCommand: null, dateField: null }; // clock skew: a stamp an hour in the FUTURE must still read 1, never 0 or negative
  m.last_refresh = new Date().toISOString(); // a stale workspace-wide stamp must NOT shorten any window
  writeFileSync(M6, JSON.stringify(m, null, 2));
  r = run("report", ["--manifest", M6]);
  const lb = r.json?.lookback ?? {};
  check("f417: report.lookback — a domain listed just now reads 1 day (minimum), one listed 11.5 days ago reads 12 (ceiling), a legacy stamp with no `at` reads null, a stamp an hour in the future reads 1 (the floor); lookbackDefault 7",
    r.code === 0 && lb.alpha?.days === 1 && lb.beta?.days === 12 && lb.gamma?.days === null && lb.gamma?.at === null && lb.delta?.days === 1 && r.json?.lookbackDefault === 7,
    JSON.stringify(lb));
  check("f417: the workspace-wide last_refresh (set to now) did not shorten beta's 12-day window — the window is per domain", lb.beta?.days === 12, null);
  r = run("touch-refresh", ["--manifest", M6]);
  check("f417: touch-refresh is retired — unknown verb, non-zero exit, nothing written", r.code !== 0 && m6().last_refresh === m.last_refresh, r.stderr);
  // F-418: a per-call generated timestamp is refused; --allow-generated-date overrides; old shared dates and single rows pass.
  const nowIso = new Date(Date.now() - 4000).toISOString();
  const gen = rowsFile("f418-gen.json", [{ id: "s1", name: "Scheme 1", modifiedAt: nowIso }, { id: "s2", name: "Scheme 2", modifiedAt: nowIso }, { id: "s3", name: "Scheme 3", modifiedAt: nowIso }]);
  const before = JSON.stringify(m6());
  const GEN = ["--manifest", M6, "--file", gen, "--domain", "scorecard-schemes", "--items-path", "data", "--id-field", "id", "--name-field", "name"];
  r = run("upsert-batch", [...GEN, "--date-field", "modifiedAt"]);
  check("f418: three rows sharing ONE date value seconds from now → REFUSED (exit 1), names the spread (0 ms), the sc scheme list case and both remedies; nothing written",
    r.code === 1 && /resolves on all 3 row\(s\) to values within 0 ms of each other, \d+ s from now/.test(r.stderr) && /sc scheme list/.test(r.stderr) && /--no-date-field --allow-redate/.test(r.stderr) && /--allow-generated-date/.test(r.stderr) && JSON.stringify(m6()) === before,
    r.stderr.slice(0, 300));
  r = run("upsert-batch", [...GEN, "--date-field", "modifiedAt", "--allow-generated-date"]);
  check("f418: --allow-generated-date overrides — exit 0, 3 added, modifiedAt recorded", r.code === 0 && r.json?.added === 3 && m6().domains_indexed["scorecard-schemes"].dateField === "modifiedAt", r.stderr);
  const oldShared = "2026-08-28T20:59:26Z";
  const old = rowsFile("f418-old.json", [{ id: "g1", name: "G1", modifiedDate: oldShared }, { id: "g2", name: "G2", modifiedDate: oldShared }, { id: "g3", name: "G3", modifiedDate: oldShared }]);
  r = run("upsert-batch", ["--manifest", M6, "--file", old, "--domain", "measure-groups", "--items-path", "data", "--id-field", "id", "--name-field", "name", "--date-field", "modifiedDate"]);
  check("f418 boundary: three rows sharing one OLD date (a platform event) are NOT the signature — exit 0, 3 added", r.code === 0 && r.json?.added === 3, r.stderr);
  const single = rowsFile("f418-one.json", [{ id: "x1", name: "X", modifiedDate: new Date().toISOString() }]);
  r = run("upsert-batch", ["--manifest", M6, "--file", single, "--domain", "singleton", "--items-path", "data", "--id-field", "id", "--name-field", "name", "--date-field", "modifiedDate"]);
  check("f418 boundary: ONE row modified this minute is data, not the signature — exit 0, 1 added", r.code === 0 && r.json?.added === 1, r.stderr);
  const mixed = rowsFile("f418-mixed.json", [{ id: "y1", name: "Y1", modifiedAt: nowIso }, { id: "y2", name: "Y2", modifiedAt: "2026-01-01T00:00:00Z" }]);
  r = run("upsert-batch", ["--manifest", M6, "--file", mixed, "--domain", "mixed", "--items-path", "data", "--id-field", "id", "--name-field", "name", "--date-field", "modifiedAt"]);
  check("f418 boundary: two DISTINCT values, one of them now — not the signature — exit 0", r.code === 0 && r.json?.added === 2, r.stderr);
  // The recorded case: a workspace that recorded the generated field at setup hits the refusal on its next refresh, and the documented remedy clears it.
  r = run("upsert-batch", [...GEN]);
  check("f418 recorded: the next refresh of a domain that RECORDED the generated field is refused, naming the recording", r.code === 1 && /\(the recording for domain scorecard-schemes\) resolves on all 3 row\(s\) to values within/.test(r.stderr), r.stderr.slice(0, 200));
  r = run("upsert-batch", [...GEN, "--no-date-field", "--allow-redate"]);
  check("f418 remedy: --no-date-field --allow-redate re-dates the domain — exit 0, dateField null recorded, 3 unchanged", r.code === 0 && r.json?.unchanged === 3 && m6().domains_indexed["scorecard-schemes"].dateField === null, r.stderr);
  // F-418 reopened (tester round 2): the REAL payload shape — epoch-millisecond NUMBERS stamped row by row, a
  // millisecond apart — must be refused too; the first guard parsed only ISO strings and required one distinct value.
  const nowMs = Date.now() - 3000;
  const real = rowsFile("f418-real.json", [{ id: "r1", name: "R1", modifiedAt: nowMs }, { id: "r2", name: "R2", modifiedAt: nowMs + 1 }, { id: "r3", name: "R3", modifiedAt: nowMs + 1 }]);
  const REAL = ["--manifest", M6, "--file", real, "--domain", "schemes-real", "--items-path", "data", "--id-field", "id", "--name-field", "name"];
  r = run("upsert-batch", [...REAL, "--date-field", "modifiedAt"]);
  check("f418 real shape: epoch-ms NUMBERS one millisecond apart, seconds from now → REFUSED naming the spread and the epoch case", r.code === 1 && /values within 1 ms of each other, \d+ s from now/.test(r.stderr) && /epoch-millisecond/.test(r.stderr), r.stderr.slice(0, 220));
  const realIso = rowsFile("f418-real-iso.json", [{ id: "r1", name: "R1", modifiedAt: new Date(nowMs).toISOString() }, { id: "r2", name: "R2", modifiedAt: new Date(nowMs + 1).toISOString() }, { id: "r3", name: "R3", modifiedAt: new Date(nowMs + 1).toISOString() }]);
  r = run("upsert-batch", ["--manifest", M6, "--file", realIso, "--domain", "schemes-iso", "--items-path", "data", "--id-field", "id", "--name-field", "name", "--date-field", "modifiedAt"]);
  check("f418 real shape: ISO strings one millisecond apart (2 distinct values) → REFUSED — distinctness is a cluster, not equality", r.code === 1 && /values within 1 ms of each other/.test(r.stderr), r.stderr.slice(0, 200));
  const oldMs = Date.parse(oldShared);
  const realOld = rowsFile("f418-real-old.json", [{ id: "o1", name: "O1", modifiedAt: oldMs }, { id: "o2", name: "O2", modifiedAt: oldMs + 1 }, { id: "o3", name: "O3", modifiedAt: oldMs + 1 }]);
  r = run("upsert-batch", ["--manifest", M6, "--file", realOld, "--domain", "schemes-old", "--items-path", "data", "--id-field", "id", "--name-field", "name", "--date-field", "modifiedAt"]);
  check("f418 real shape boundary: epoch-ms numbers clustered but 11 days OLD → not refused, exit 0", r.code === 0 && r.json?.added === 3, r.stderr);
  const secs = rowsFile("f418-secs.json", [{ id: "s1", name: "S1", modifiedAt: Math.floor(nowMs / 1000) }, { id: "s2", name: "S2", modifiedAt: Math.floor(nowMs / 1000) }]);
  r = run("upsert-batch", ["--manifest", M6, "--file", secs, "--domain", "schemes-secs", "--items-path", "data", "--id-field", "id", "--name-field", "name", "--date-field", "modifiedAt"]);
  check("f418 real shape: epoch SECONDS (< 1e11) are scaled and refused too", r.code === 1 && /generated per call/.test(r.stderr), r.stderr.slice(0, 160));
  // F-421: a --name-field absent on every row is refused; an unchanged row backfills a null name; stub re-titles.
  const rulesNoName = rowsFile("f421-rules.json", [{ ruleId: "rule-1", ruleName: "Acme Renewal CTA", modifiedDate: "2026-01-01T00:00:00Z" }, { ruleId: "rule-2", ruleName: "Acme Risk Score", modifiedDate: "2026-01-02T00:00:00Z" }, { ruleId: "rule-3", ruleName: "Acme Onboarding", modifiedDate: "2026-01-03T00:00:00Z" }]);
  const before421 = JSON.stringify(m6());
  r = run("upsert-batch", ["--manifest", M6, "--file", rulesNoName, "--domain", "rules-engine", "--items-path", "data", "--id-field", "ruleId", "--name-field", "name", "--date-field", "modifiedDate"]);
  check("f421: --name-field absent on every row → REFUSED (exit 1) naming the field, the row-derived key hint and the repair; nothing written", r.code === 1 && /--name-field name resolves to no value on any of the 3 row\(s\)/.test(r.stderr) && /the first row's keys: ruleId, ruleName, modifiedDate/.test(r.stderr) && /namesBackfilled/.test(r.stderr) && JSON.stringify(m6()) === before421, r.stderr.slice(0, 220));
  // F-426(b): the hint is derived from the offending rows, never a fixed
  // rules-engine example — template rows carry `title`, and the refusal on
  // them must name that, not `ruleName`.
  const tmplNoName = rowsFile("f426-templates.json", [{ templateId: "t-1", title: "Welcome", folderName: "Onboarding" }, { templateId: "t-2", title: "Renewal", folderName: "CS" }]);
  r = run("upsert-batch", ["--manifest", M6, "--file", tmplNoName, "--domain", "journey-email-templates", "--items-path", "data", "--id-field", "templateId", "--name-field", "templateName", "--no-date-field"]);
  check("f426: the name-field refusal on template rows names the keys THOSE rows carry (title), and never the rules-engine example", r.code === 1 && /the first row's keys: templateId, title, folderName/.test(r.stderr) && !/ruleName/.test(r.stderr) && !/re r list/.test(r.stderr), r.stderr.slice(0, 260));
  // A pre-guard workspace: seed three nameless entries by hand (what the old silent path produced), then repair.
  const md = m6();
  for (const [id, d] of [["rule-1", "2026-01-01T00:00:00Z"], ["rule-2", "2026-01-02T00:00:00Z"], ["rule-3", "2026-01-03T00:00:00Z"]]) md.inventory[`rules-engine/${id}`] = { id, name: null, domain: "rules-engine", modified_date: d, status: "documented", depth: "metadata" };
  md.domains_indexed["rules-engine"] = { at: new Date().toISOString(), idField: "ruleId", itemsPath: "data", describeCommand: null, dateField: "modifiedDate" };
  writeFileSync(M6, JSON.stringify(md, null, 2));
  r = run("upsert-batch", ["--manifest", M6, "--file", rulesNoName, "--domain", "rules-engine", "--items-path", "data", "--id-field", "ruleId", "--name-field", "ruleName"]);
  const inv = m6().inventory;
  check("f421 repair: re-run with the RIGHT field backfills every null name on unchanged rows — namesBackfilled 3, unchanged 3, stale 0, status untouched", r.code === 0 && r.json?.namesBackfilled === 3 && r.json?.unchanged === 3 && r.json?.stale === 0 && inv["rules-engine/rule-1"].name === "Acme Renewal CTA" && inv["rules-engine/rule-1"].status === "documented", JSON.stringify(r.json).slice(0, 200));
  // A backfill fills NULL names only: an unchanged row whose incoming name differs from the stored one must not be
  // renamed by it (renames arrive through the stale branch with a newer date, never through a repair).
  const rulesRenamed = rowsFile("f421-rules-renamed.json", [{ ruleId: "rule-1", ruleName: "Acme Renewal CTA", modifiedDate: "2026-01-01T00:00:00Z" }, { ruleId: "rule-2", ruleName: "RENAMED WITHOUT A NEWER DATE", modifiedDate: "2026-01-02T00:00:00Z" }, { ruleId: "rule-3", ruleName: "Acme Onboarding", modifiedDate: "2026-01-03T00:00:00Z" }]);
  r = run("upsert-batch", ["--manifest", M6, "--file", rulesRenamed, "--domain", "rules-engine", "--items-path", "data", "--id-field", "ruleId", "--name-field", "ruleName"]);
  check("f421 repair is idempotent and fills NULL only: a second run backfills 0 and an unchanged row's stored name is never overwritten", r.code === 0 && r.json?.namesBackfilled === 0 && r.json?.unchanged === 3 && m6().inventory["rules-engine/rule-2"].name === "Acme Risk Score", JSON.stringify(r.json).slice(0, 160));
  const stubDir = join(ROOT, "f421-stubs");
  r = run("stub", ["--manifest", M6, "--file", rulesNoName, "--domain", "rules-engine", "--items-path", "data", "--id-field", "ruleId", "--name-field", "ruleName", "--out-dir", stubDir]);
  const stubFiles = existsSync(stubDir) ? readdirSync(stubDir) : [];
  const stubBody = stubFiles.length ? readFileSync(join(stubDir, stubFiles[0]), "utf8") : "";
  check("f421 repair step 2: `stub` over the same list re-writes the metadata stubs under their NAMES (H1 is the name, not the bare id)", r.code === 0 && r.json?.stubbed === 3 && /^# Acme /m.test(stubBody) && !/^# rule-\d/m.test(stubBody), (stubBody.split("\n")[0] ?? "") + " · " + JSON.stringify(r.json).slice(0, 120));
  // F-419: the count-guard warning names the scope-limited case and points at the notes.
  r = run("upsert-batch", ["--manifest", M6, "--file", rowsFile("f419-short.json", [{ id: "g1", name: "G1", modifiedDate: oldShared }]), "--domain", "measure-groups", "--items-path", "data", "--id-field", "id", "--name-field", "name"]);
  const w419 = (r.json?.warnings ?? []).find((w) => /smaller than the domain/.test(w)) ?? "";
  check("f419: the under-pagination warning names the SCOPE-LIMITED case, points at index-scope-notes and names jo email templates", r.code === 0 && /SCOPE-LIMITED domain/.test(w419) && /index-scope-notes\.md/.test(w419) && /jo email templates/.test(w419), w419.slice(0, 200));
}

// ── F-429: a renamed or misspelled --domain on a run that identifies an existing
// domain is refused. The signal is the run's own recording flags (what it
// DECLARES), canonicalized through the catalog; id overlap is deliberately not
// a signal (name-keyed domains share id values — see the doc-lib comment).
{
  const M9 = join(ROOT, "f429", "_manifest.json");
  run("init", ["--manifest", M9, "--slug", "acme-f429", "--base-url", "https://a.example", "--environment", "sandbox"]);
  const m9 = () => JSON.parse(readFileSync(M9, "utf8"));
  const connFile = join(ROOT, "f429-conn.json");
  writeFileSync(connFile, JSON.stringify({ data: [{ connectionId: "c-1", connectionName: "Acme SFDC" }, { connectionId: "c-2", connectionName: "Acme S3" }] }));
  r = run("upsert-batch", ["--manifest", M9, "--file", connFile, "--domain", "connections", "--id-field", "connectionId", "--name-field", "connectionName", "--no-date-field", "--list-command", "gs-admin --json cn list"]);
  check("f429 seed: the workspace records its connections domain from cn list (the DS-32 spelling)", r.code === 0 && r.json?.added === 2 && m9().domains_indexed?.connections?.listCommand === "gs-admin --json cn list", r);
  const before = JSON.stringify(m9());
  r = run("upsert-batch", ["--manifest", M9, "--file", connFile, "--domain", "connectors", "--id-field", "connectionId", "--name-field", "connectionName", "--no-date-field", "--list-command", "gs-admin --json cn list"]);
  check("f429: the refresh example's --domain connectors is REFUSED — its --list-command is the recorded listCommand of connections; nothing written, no second domain", r.code === 1 && /--domain connectors matches no recording/.test(r.stderr) && /--list-command is the recorded listCommand of domain connections/.test(r.stderr) && JSON.stringify(m9()) === before, r.stderr.slice(0, 260));
  r = run("upsert-batch", ["--manifest", M9, "--file", connFile, "--domain", "connectors", "--id-field", "connectionId", "--no-date-field", "--list-command", "gs-admin   --json connectors list"]);
  check("f429: an alias-spelled list command (connectors list vs recorded cn list) still identifies the recorded domain — canonicalized through the catalog", r.code === 1 && /recorded listCommand of domain connections/.test(r.stderr) && JSON.stringify(m9()) === before, r.stderr.slice(0, 200));
  const chainsFile = join(ROOT, "f429-chains.json");
  writeFileSync(chainsFile, JSON.stringify({ data: [{ jobExecutionSetId: "x-1", name: "Acme Nightly" }] }));
  r = run("upsert-batch", ["--manifest", M9, "--file", chainsFile, "--domain", "connectors-chains", "--id-field", "jobExecutionSetId", "--name-field", "name", "--no-date-field", "--list-command", "gs-admin --json cn chains"]);
  check("f429 negative: a genuinely new domain from a different list command still indexes (exit 0, stamped)", r.code === 0 && r.json?.added === 1 && m9().domains_indexed?.["connectors-chains"]?.listCommand === "gs-admin --json cn chains", r);
  // No --partial arm here (F-429 second pass): the exemption a --partial run
  // enjoys is enforced upstream by the F-313/F-314 guard rail (--partial
  // cannot combine with a recording flag) and pinned by the "partial:
  // never-listed …" arms above; the arm that stood here exercised nothing of
  // this block and failed pre-fix only as a cascade of the refusal arm.
  r = run("upsert-batch", ["--manifest", M9, "--file", connFile, "--domain", "connexions", "--id-field", "connectionId", "--no-date-field"]);
  check("f429 boundary (documented limit): with NO recording flag the run declares nothing about its list, so an unrecorded name is taken as new — the refusal is flag-derived, not id-derived, which is why refresh passes --list-command on every upsert", r.code === 0 && r.json?.added === 2, r);
  // F-432 (release-gate review of 0.37.0): a domain's identity is its LIST
  // command. Every list-only domain records `--describe-command none`, and two
  // lists of one asset type share a describe template — neither is a rename.
  const jobsFile = join(ROOT, "f432-jobs.json");
  writeFileSync(jobsFile, JSON.stringify({ data: [{ jobId: "j-1", jobName: "Acme Nightly Load" }] }));
  // Each arm records a DIFFERENT canonical list (flags fold away in the
  // catalog canonicalization, so `cn list --page 2` IS `cn list`); the shared
  // rows file is deliberate — id overlap is not a signal.
  r = run("upsert-batch", ["--manifest", M9, "--file", jobsFile, "--domain", "sc-listonly", "--id-field", "jobId", "--name-field", "jobName", "--no-date-field", "--list-command", "gs-admin --json sc list", "--describe-command", "none"]);
  const firstNone = r.code === 0;
  r = run("upsert-batch", ["--manifest", M9, "--file", jobsFile, "--domain", "jobs-listonly", "--id-field", "jobId", "--name-field", "jobName", "--no-date-field", "--list-command", "gs-admin --json cn jobs", "--describe-command", "none"]);
  check("f432: a SECOND list-only domain (`--describe-command none`) with its own list command is accepted — the `none` sentinel is never an identity signal", firstNone && r.code === 0 && r.json?.added === 1 && !(r.json?.warnings ?? []).some((w) => /describeCommand/.test(w)), r);
  r = run("upsert-batch", ["--manifest", M9, "--file", jobsFile, "--domain", "jobs-archived", "--id-field", "jobId", "--name-field", "jobName", "--no-date-field", "--list-command", "gs-admin --json jo p list", "--describe-command", "gs-admin --json cn job --id {id}"]);
  const shared = r.code === 0;
  r = run("upsert-batch", ["--manifest", M9, "--file", jobsFile, "--domain", "jobs-shared-describe", "--id-field", "jobId", "--name-field", "jobName", "--no-date-field", "--list-command", "gs-admin --json rp list", "--describe-command", "gs-admin --json cn job --id {id}"]);
  check("f432: a new domain sharing another domain's real describe command but with its OWN list command proceeds with a warning naming the sharing domain — not refused", shared && r.code === 0 && r.json?.added === 1 && (r.json?.warnings ?? []).some((w) => /--describe-command is the recorded describeCommand of domain jobs-archived/.test(w) && /proceeds/.test(w)), r);
  r = run("upsert-batch", ["--manifest", M9, "--file", jobsFile, "--domain", "jobs-renamed", "--id-field", "jobId", "--name-field", "jobName", "--no-date-field", "--list-command", "gs-admin --json report list", "--describe-command", "none"]);
  check("f432 (control): a LIST-command collision (alias spelling of a recorded list) is still refused, whatever the describe command says", r.code === 1 && /--list-command is the recorded listCommand of domain jobs-shared-describe/.test(r.stderr), r.stderr.slice(0, 200));
}

rmSync(ROOT, { recursive: true, force: true });

console.log(failures ? `\n${failures} failure(s)` : "\nAll manifest ops checks passed");
process.exit(failures ? 1 : 0);
