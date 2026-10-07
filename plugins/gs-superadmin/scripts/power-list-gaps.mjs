#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// power-list-gaps.mjs — Power List rule work-list builder (F-487).
//
// A journey program on a QUERY_BUILDER source draws its participants from a
// Power List, and a Power List is a hidden rule: ruleType
// ADVANCED_OUTREACH_QUERY_BUILDER, absent from every `re r list` page, present
// to `re r describe --id <ruleId>` — the `ruleId` key on the source itself
// (NOT the collection id, which differs from it on a share of program
// versions; measured 2026-10-06, 1,686 source rows: 100% carry ruleId, 23%
// differ). No list crawl can capture these rules, so this script derives the
// work list from the program docs already on disk, and the ingest path
// (setup Phase 5, refresh) registers and documents what is missing:
//
//   1. node power-list-gaps.mjs <slug>/_manifest.json
//        → .gs-superadmin/tmp/pl-gap-rules.json  — JSON array of
//          { <rules idField>: ruleId, ruleName: <the source's name> }, the
//          `manifest.mjs upsert-batch --file` shape, keyed by the rules
//          domain's RECORDED idField (a wrong key would be refused as a rekey)
//        → .gs-superadmin/tmp/pl-gap-keys.json   — every referenced rule whose
//          doc is NOT readable on disk, as full manifest keys
//          ("<rules-domain>/<ruleId>"): the missing ones above, the ones the
//          manifest already holds but has not documented (pending / stale /
//          failed), and the ones it calls documented whose doc is gone or
//          unparseable — the `describe-batch.mjs --keys-file` shape, so the
//          batch documents THESE entries and no other pending/stale rule the
//          domain holds (a plain refresh is detect-only for everything it did
//          not register itself)
//        → .gs-superadmin/tmp/pl-gap-redoc.json  — the documented-but-unreadable
//          subset as keys, for `manifest.mjs mark --keys-file … --status stale`
//          (describe-batch selects pending/stale/failed; a documented entry
//          must be marked before the keys file can reach it)
//   2. manifest.mjs upsert-batch --partial --domain <rules-domain> --file … --id-field <idField> --name-field ruleName
//      (+ manifest.mjs mark --keys-file pl-gap-redoc.json --status stale when redoc > 0)
//   3. describe-batch.mjs --domain <rules-domain> --keys-file … (the recorded `re r describe --id {id}`), until moreRemaining is false
//
// The rules lane holds Power List docs beside the Rules Engine rules (one
// describe command, one folder, the raw doc shape); readers tell them apart
// by ruleType, and the deps tools attribute a Power List's objects to the
// programs that reference it, never to a rule asset.
//
// Output: ONE summary JSON line (the only part that enters model context) —
// the resolved lane folders (+ basis, warnings), the rules idField, programs
// scanned / stubs skipped, Power List sources seen, distinct rule ids, how
// many are documented / already queued in the manifest / missing, how many
// were written. A missing argument or an unreadable manifest refuses loudly,
// exit 1, naming this script (F-306) — never a confidently empty work list.
// A missing journey folder is reported (journeyDirMissing: true) with an
// empty list, exit 0: nothing to register until programs are documented.
//
// Zero dependencies — Node built-ins + doc-lib + the two JO modules.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCliHelpers, readJsonFile, resolveRecordedDomains, laneTable, listMdFiles } from "./doc-lib.mjs";
import { parseJourneyDoc } from "./jo-report.mjs";
import { classifySource, powerListRuleId, locateKbDoc, parsePowerListDoc } from "./jo-report-deps.mjs";
const here = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const { fail } = makeCliHelpers("power-list-gaps.mjs", argv);
if (argv.length !== 1) fail("usage: node power-list-gaps.mjs <slug>/_manifest.json");
const TMP = ".gs-superadmin/tmp";
const OUT = `${TMP}/pl-gap-rules.json`;
const OUT_KEYS = `${TMP}/pl-gap-keys.json`;
const OUT_REDOC = `${TMP}/pl-gap-redoc.json`;
let mf;
try {
  mf = readJsonFile(argv[0]);
} catch (e) {
  fail(`${argv[0]}: ${e?.message ?? e} — pass the workspace's _manifest.json`);
}
if (!mf || typeof mf !== "object") fail(`${argv[0]}: not a manifest object`);
const slugDir = dirname(resolve(argv[0]));
// Lane folders are per-workspace data (F-429): resolved from the manifest's
// recordings through doc-lib's one resolver; the literals are the
// no-recording fallback. startDir is the slug directory (er-gaps precedent).
const RESOLVED = resolveRecordedDomains({
  startDir: slugDir,
  domainsIndexed: mf.domains_indexed,
  inventory: mf.inventory,
  ...laneTable({ journey: "journey", rules: "rules" }),
  bundledCatalogPath: join(here, "..", "reference", "catalog.json"),
});
const LANES = RESOLVED.dirs;
const recorded = (mf.domains_indexed ?? {})[LANES.rules];
const idField = recorded && typeof recorded === "object" && typeof recorded.idField === "string" ? recorded.idField : "ruleId";
const inventory = mf.inventory && typeof mf.inventory === "object" ? mf.inventory : {};

const files = listMdFiles(join(slugDir, LANES.journey));
const journeyDirMissing = files == null;
let programsScanned = 0;
let stubPrograms = 0;
let sources = 0;
const rules = new Map(); // ruleId → { name, programs: Set }
for (const file of files ?? []) {
  let entry;
  try {
    entry = parseJourneyDoc(readFileSync(file, "utf8"), file).entry;
  } catch {
    continue; // an unreadable doc is the index build's problem to report, not a work item
  }
  if (entry.depth !== "full") {
    stubPrograms++;
    continue;
  }
  programsScanned++;
  for (const src of entry.sources) {
    if (classifySource(src) !== "power-list") continue;
    const id = powerListRuleId(src);
    if (id == null) continue;
    sources++;
    let r = rules.get(id);
    if (!r) {
      r = { name: src.name ?? null, programs: new Set() };
      rules.set(id, r);
    }
    if (r.name == null && src.name != null) r.name = src.name;
    r.programs.add(entry.id ?? file);
  }
}
// A referenced rule counts as documented only when its doc is READABLE on
// disk as a Power List rule (F-487 reopen, instance 4: the manifest said
// documented while the doc was gone, so refresh skipped it and the report's
// remedy remedied nothing). Four states, each with its own output:
//   documented — manifest documented at depth full AND the doc parses as a
//                Power List rule: nothing to do
//   missing    — no manifest entry: registered by the partial upsert
//                (pl-gap-rules.json) and described (keys file)
//   queued     — a manifest entry that is not documented-full (pending /
//                stale / failed): already selectable — described (keys file)
//   redoc      — documented-full in the manifest but the doc is missing,
//                unparseable or not a Power List: marked stale by the skill
//                (pl-gap-redoc.json, `manifest.mjs mark --keys-file`), then
//                described (keys file)
const byKey = (id) => `${LANES.rules}/${id}`;
const docReadable = (id) => {
  const loc = locateKbDoc(slugDir, LANES.rules, id);
  if (loc.reason) return false;
  try {
    return parsePowerListDoc(readFileSync(loc.path, "utf8")) != null;
  } catch {
    return false;
  }
};
let documented = 0;
const missing = [];
const queued = [];
const redoc = [];
for (const [id, r] of rules) {
  const e = inventory[byKey(id)];
  const readable = docReadable(id);
  if (!e || typeof e !== "object") {
    missing.push({ [idField]: id, ruleName: r.name });
    continue;
  }
  if (e.status === "documented" && e.depth === "full") {
    if (readable) documented++;
    else redoc.push(byKey(id));
    continue;
  }
  queued.push(byKey(id)); // selectable already — the keys file makes this run describe it
}
const byId = (a, b) => String(a).localeCompare(String(b), "en");
missing.sort((a, b) => byId(a[idField], b[idField]));
queued.sort(byId);
redoc.sort(byId);
const keys = [...missing.map((m) => byKey(m[idField])), ...queued, ...redoc].sort(byId);
mkdirSync(TMP, { recursive: true });
writeFileSync(OUT, JSON.stringify(missing));
writeFileSync(OUT_KEYS, JSON.stringify(keys));
writeFileSync(OUT_REDOC, JSON.stringify(redoc));
console.log(JSON.stringify({
  domains: LANES,
  domainBasis: RESOLVED.basis,
  warnings: [...RESOLVED.warnings, ...(journeyDirMissing ? [`no ${LANES.journey}/ folder under ${slugDir} — document journey programs first`] : [])],
  idField,
  journeyDirMissing,
  programsScanned,
  stubPrograms,
  powerListSources: sources,
  distinctRules: rules.size,
  documented,
  queued: queued.length,
  redoc: redoc.length,
  missing: missing.length,
  unreadable: keys.length, // every referenced rule this run must still describe (missing + queued + redoc)
  written: missing.length,
  workList: OUT,
  keysFile: OUT_KEYS,
  redocFile: OUT_REDOC,
}));
