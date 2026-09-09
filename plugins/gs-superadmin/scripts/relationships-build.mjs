#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// relationships-build.mjs — sanctioned Phase 6 relationship-map generator
//
// Two live E2E runs in a row hand-rolled `_flatMappings` parsers for exactly
// this synthesis (the same signal that produced describe-batch.mjs). This is
// the sanctioned version: it reads the full-describe KB docs already on disk
// (each embeds its describe JSON in a fenced ```json block — no CLI calls,
// no model context), derives the four relationship maps deterministically,
// and writes them with the coverage-header convention Phase 6 requires.
//
//   node relationships-build.mjs --manifest <slug>/_manifest.json \
//     --out-dir <slug>/relationships [--rules-domain rules-engine] \
//     [--chains-domain rules-engine-chains] [--scorecard-domain scorecard] \
//     [--journey-domain journey] [--templates-domain journey-email-templates] \
//     [--date YYYY-MM-DD]
//
// Outputs (in --out-dir): field-to-rule.md · field-to-scorecard.md ·
// process-maps.md · program-to-template.md. One JSON summary on stdout;
// non-zero exit + stderr on error.
//
// ── Journey ↔ Rules Engine — why there is NO journey→rule map ───────────────
// Rules Engine rules do not load participants into Journey Orchestrator
// programs: programs draw participants from Power Lists, backed by CSV
// uploads, ad-hoc queries, or Data Designer / DD-template datasets — never a
// rule. That is Gainsight product architecture (tenant-agnostic), and it was
// live-confirmed by a full GSID cross-reference between rule and program docs
// finding zero shared-id edges. process-maps.md states this instead of
// inviting a hand-built program→rule map. The journey-side edges that ARE
// derivable from deep docs:
// - program → email template: GSID co-occurrence between a program doc's
//   payload JSON and the email-template inventory ids → program-to-template.md
//   (below).
// - program → Power List → source (CSV / query / Data Designer): parseable
//   from the PowerList config block in each program's step JSON (preserved
//   verbatim by the program-doc compactor) — not yet automated; Phase 6 prose
//   synthesis.
//
// ── program-to-template matching (basis: SEMANTICS_BASIS) ────────────────────
// Email-template ids appear verbatim in a program's step JSON wherever an
// email node references the template (raw and compacted program docs both
// carry them — the compactor never drops reference values). Matching is
// token-based, not substring: each program payload is tokenized into maximal
// [A-Za-z0-9_-] runs (plus the -/_-separated segments of each run, so an id
// embedded in a composite token still matches), and a template id counts as
// referenced only when it appears as a whole token or a whole -/_-delimited
// segment — never mid-string (id `1234` can't match inside `51234`). Because
// segments match, an id that equals a full segment of a longer, different id
// WOULD false-positive — safe here because template ids are 36-char
// high-entropy GSIDs (no -/_ inside, no id is a segment of another); if
// --templates-domain is ever pointed at a domain with short or structured
// ids, revisit this before trusting the map. Template ids and titles come from the
// MANIFEST INVENTORY (any depth): a metadata stub's id still identifies an
// edge, so stubbed template domains are usable and the coverage header says
// exactly that instead of pretending stubs were excluded.
//
// ── `_flatMappings` payload semantics (basis: SEMANTICS_BASIS) ──────────────
// This block is the schema documentation for a payload the CLI does not
// document. Every statement below was verified against live `re rules
// describe` output on CLI 1.0.4, then re-checked at the 1.0.6 adoption
// against the package's own mapper source (rules-list-mapper.js) — re-verify
// after any CLI upgrade; if a newer CLI's payload disagrees with this note,
// trust the payload and update this script and its fixtures together.
// Re-checked at the 1.0.7, 1.0.8 and 1.0.9 adoptions: rules-list-mapper.js is
// byte-identical across all three upgrades, so the 1.0.6-verified semantics below
// (including the path scoping) carry over unchanged.
//
// 1.0.6 delta (mapper-source-verified, not live; PATH-SCOPED — the scoping
// was pinned at the 0.26.0 review gate, correcting the adoption audit's
// claim that it covered both paths): `_flatMappings` survives with the same
// row keys on both enrichment paths, but the paths now differ:
// - `re r list-and-describe` (enrichRuleDetail): `tgtObject` is BLANKED for
//   external actions (`areaName: callExternalAPI` — the target is a callout
//   parameter, not a Gainsight object) and for task-id targets (`t1`, `t2`,
//   … — internal task refs). Both previously leaked through as bogus target
//   objects. This script's empty-tgtObject skip drops such rows from the
//   write index.
// - `re r describe` (enrichRuleDetailWithDrilldown) — the per-item describe
//   most KB docs come from — still builds `tgtObject` the OLD, unfiltered
//   way at 1.0.6, so docs from that path can still carry callout/task-id
//   targets, which enter the write index exactly as they did on 1.0.4.
// - The `_criteriaCount` and `_areaNames` row fields are gone on both paths
//   (this script never read either; no behavior change here).
//
// - The describe payload nests the rule at `data.ruleDetails` (this script
//   also finds `_flatMappings` anywhere in the payload, for envelope drift).
//   Rule display name: `ruleName`; enabled flag: `active` (boolean).
// - `_flatMappings` is an ARRAY of per-action field mappings, one entry per
//   mapped field: `srcObject`.`srcField` → `tgtObject`.`tgtField`, keyed by
//   `actionType` (with `areaName` naming the action's delivery area, plus
//   `srcType`/`tgtType`/`identifier` which this script does not need).
// - actionType semantics (all values observed on 1.0.4):
//     DATA_SYNC, BULK_API  — data-load/update writes: the action writes
//                            tgtObject.tgtField (areas: loadToCompany,
//                            loadToPeople, loadToUser, loadToLead,
//                            loadToSurvey, mda, sfdc). → field-to-rule map.
//     SET_SCOREV2          — scorecard scoring (area scorecardV2). Linkage
//                            rides in tgtField: `scorecard` → srcField is a
//                            scorecard GSID; `measure` → srcField is a measure
//                            GSID; `score` → srcField MAY be a JSON-map string
//                            `{ "<scorecardGSID>": "<measureGSID>", … }` (the
//                            JSON-map form has also been seen on `measure` —
//                            both are handled). Other tgtFields (`account`,
//                            `comment`, `scorevalue`) carry per-score values,
//                            not linkage. → field-to-scorecard map.
//     REST_API             — the action is delivered over an internal REST
//                            call; areaName says what it is: NativeCta =
//                            create Call To Action (tgtObject `Call To
//                            Action`, tgtField `Name`'s srcField is the CTA
//                            name source) → process-maps; NativeSp (success
//                            plan), callExternalAPI (external API call),
//                            loadtoactivity (activity load) are recognized
//                            and counted but not mapped. Areas outside that
//                            list are reported like unknown actionTypes,
//                            never absorbed.
//     CONDITIONAL          — conditional-logic branch metadata (area
//                            scorecardV2); no direct field write to map.
//   Any actionType NOT listed above is UNKNOWN to this generator: its entries
//   are never silently dropped — they are counted and listed (with the rules
//   that carry them) in field-to-rule.md's actionType accounting section and
//   in the JSON summary (`unknownActionTypes`).
// - Scorecard describe docs (from `sc measures --name`) embed the measure
//   tree: nodes carry `levelType` (`GROUP`/`MEASURE`), `measureId`, `name`,
//   and nest via `children`. GSID→name resolution walks every scorecard doc's
//   tree (classify by levelType, never by position — same rule as the
//   operating model's scorecard note). A SET_SCOREV2 measure GSID that
//   resolves to no documented scorecard measure is a DANGLING reference —
//   flagged in field-to-scorecard.md (a real tenant-hygiene signal: the
//   measure was deleted, or its scorecard isn't in the KB).
//
// Coverage headers: each output file opens with the Phase 6 coverage
// convention — which domains it was built from (full-doc counts), which were
// excluded as metadata stubs (with the `--deep` re-run command), and how many
// describes failed. When the rules domain has NO full docs at all, the maps
// carry a "pending deep ingest" note instead of a thin map built from stubs.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
// The scorecard measure walk lives once, in doc-lib (GP-B5 W10, F-361 — the
// inline copy here was byte-identical to tenant-deps' under a "keep in sync"
// comment; the review round moved the one copy to the primitives' home so
// this map builder never loads the deps-report stack to reach it).
import { parseDocJson, docMeta, topBullets, normalizeText, listMdFiles, readJsonFile, makeCliHelpers, collectScorecardMeasures, resolveRecordedDomains, laneTable } from "./doc-lib.mjs";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));

// ── Semantics verification basis ─────────────────────────────────────────────
// One pinned statement of what the hardcoded semantics below were verified
// against, emitted verbatim into every map that dates them and cited by name
// from the comment blocks that describe them — a CLI adoption updates this
// line, not six. Bare version numbers on purpose: this is a historical
// vintage, not a current-version claim (build/check-stale-facts.mjs).
// Editing this string also changes four emitted lines in the committed expected
// maps, so test/relationships-build.mjs fails byte-for-byte until you refresh
// them: RELATIONSHIPS_EXPECTED_REFRESH=1 node plugins/gs-superadmin/test/relationships-build.mjs
// PowerShell: $env:RELATIONSHIPS_EXPECTED_REFRESH = '1'; node plugins/gs-superadmin/test/relationships-build.mjs
// (the inline VAR=value prefix is bash-only — PowerShell fails at runtime on that
// token and the refresh never runs, F-255; then review that diff — it must be this
// string and nothing else).
const SEMANTICS_BASIS = "verified live on CLI 1.0.4, re-verified statically at 1.0.6, 1.0.7, 1.0.8 and 1.0.9";

const argv = process.argv.slice(2);
// Shared argv helpers (F-238) — the F-165/F-171 last-token rule (extended by
// F-205) lives in doc-lib now. The skills tell the model to APPEND
// --<x>-domain flags to the fence when tenant domain names differ from the
// defaults (setup Phase 6), so a trailing flag whose value rendered empty
// would silently build the maps against the DEFAULT domain — wrong or empty
// maps at exit 0. Every opt() call site here takes a value (no boolean
// flags), so the guard cannot misfire on a valid spelling.
const { opt, fail } = makeCliHelpers("relationships-build.mjs", argv);

const manifestPath = opt("--manifest");
const outDir = opt("--out-dir");
if (!manifestPath || !outDir) {
  fail("required: --manifest <slug>/_manifest.json --out-dir <slug>/relationships");
}
// Domain FOLDER names default from the manifest's recordings (F-429): a
// lane's identity is the list command its docs came from, its spelling is
// per-workspace data. The flags stay as explicit overrides; the literal
// defaults are the fallback for a lane with no recording (or no catalog).
// Resolved below, once the manifest is loaded.
const domainFlag = {
  rules: opt("--rules-domain"),
  chains: opt("--chains-domain"),
  scorecard: opt("--scorecard-domain"),
  journey: opt("--journey-domain"),
  templates: opt("--templates-domain"),
};
const date = opt("--date", new Date().toISOString().slice(0, 10));
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("--date must be YYYY-MM-DD");

let manifest;
try {
  // Read-only: this script never writes the manifest (mutating verbs stay in
  // manifest.mjs); it only needs per-domain status/depth for the coverage
  // headers.
  manifest = readJsonFile(resolve(manifestPath)); // BOM-tolerant (doc-lib, F-118/F-151)
} catch (e) {
  fail(`cannot read manifest ${manifestPath}: ${e.message}`);
}
const inventory = manifest.inventory ?? {};
const slugDir = dirname(resolve(manifestPath));

// F-429 lane resolution — the lanes and their no-recording defaults come from
// doc-lib's RECORDED_LANES (the one home, F-429 fourth pass), keyed the way
// this script reports them.
const { lanes: LANE_LIST_PATHS, defaults: LANE_DEFAULTS } = laneTable({
  rules: "rules",
  chains: "chains",
  scorecard: "scorecards",
  journey: "journey",
  templates: "templates",
});
// The explicit --<lane>-domain flags go INTO the resolver as overrides: it
// decides what was read (dirs), why (basis — "flag --<lane>-domain" when a
// flag won) and which warnings apply, so the JSON summary and every map's
// coverage header quote the same facts. Applying the flags after the fact
// left the resolver's "resolved from the recordings" warning in every map
// header for a lane the flag had actually overridden (release-gate review of
// 0.37.0, F-434).
const recordedLanes = resolveRecordedDomains({
  startDir: slugDir,
  domainsIndexed: manifest.domains_indexed,
  inventory,
  lanes: LANE_LIST_PATHS,
  defaults: LANE_DEFAULTS,
  overrides: domainFlag,
  bundledCatalogPath: join(here, "..", "reference", "catalog.json"),
});
const domainDirs = recordedLanes.dirs;
const domainDirBasis = recordedLanes.basis;
const rulesDomain = domainDirs.rules;
const chainsDomain = domainDirs.chains;
const scorecardDomain = domainDirs.scorecard;
const journeyDomain = domainDirs.journey;
const templatesDomain = domainDirs.templates;

// ── Per-domain coverage from the inventory ───────────────────────────────────
function domainCoverage(domain) {
  const c = { total: 0, full: 0, metadata: 0, failed: 0, pending: 0 };
  for (const [key, e] of Object.entries(inventory)) {
    if ((e.domain ?? key.split("/")[0]) !== domain) continue;
    c.total++;
    if (e.status === "documented" && e.depth === "metadata") c.metadata++;
    else if (e.status === "documented") c.full++;
    else if (e.status === "failed") c.failed++;
    else c.pending++;
  }
  return c;
}
const coverage = {
  [rulesDomain]: domainCoverage(rulesDomain),
  [chainsDomain]: domainCoverage(chainsDomain),
  [scorecardDomain]: domainCoverage(scorecardDomain),
  [journeyDomain]: domainCoverage(journeyDomain),
  [templatesDomain]: domainCoverage(templatesDomain),
};

// ── Doc readers ──────────────────────────────────────────────────────────────
// KB doc shape (describe-batch.mjs / stub output): `# <name>`, then metadata
// lines (`- key:`, `- id:`, `- name:`), then the raw payload in one fenced
// ```json block. Stubs have no ```json payload with mappings — they parse to
// "no mappings" and are excluded by the coverage header, never crashed on.
// The KB-doc read-side primitives (dir .md listing, BOM/CRLF normalization,
// fence-parse guard, KbDocMeta resolution) are the single copy in doc-lib.mjs
// — import, never re-implement. parseDocJson/docMeta replaced this file's
// hand-synced copies at GP-B5 DS-24 (the docMeta copy had already diverged:
// undefined where doc-lib resolves T-3's null — output-invisible through the
// ??/truthiness reads below, pinned by the differential corpus). The two
// wrappers kept local carry this script's own return contracts: a
// domain-relative dir that yields [] when absent; text normalized at read (so
// a GSID key never carries a trailing \r its clean JSON-payload twin lacks).
function listDocs(domain) {
  return listMdFiles(join(slugDir, domain)) ?? [];
}
function docText(path) {
  return normalizeText(readFileSync(path, "utf8"));
}
// Find the object carrying `_flatMappings`: the canonical 1.0.4 home
// (data.ruleDetails) first, then an iterative whole-payload walk only as the
// envelope-drift fallback (iterative so a deeply nested payload can't blow the
// call stack; canonical-first so a second `_flatMappings`-shaped object
// elsewhere in a payload can never shadow the real one).
function findRuleDetails(payload) {
  const canonical = payload?.data?.ruleDetails;
  if (canonical && Array.isArray(canonical._flatMappings)) return canonical;
  const stack = [payload];
  while (stack.length) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      for (const x of node) stack.push(x);
    } else if (node && typeof node === "object") {
      if (Array.isArray(node._flatMappings)) return node;
      for (const k of Object.keys(node)) stack.push(node[k]);
    }
  }
  return null;
}

// ── Known actionType semantics (basis: SEMANTICS_BASIS) ──────────────────────
// One table drives everything: Set membership (classification), the dispatch
// branches below, and the rendered accounting text — so a new actionType can
// never be "known" to one structure and missing from another.
const DISPOSITION = {
  DATA_SYNC: "mapped — field population (above)",
  BULK_API: "mapped — field population (above)",
  SET_SCOREV2: "mapped — field-to-scorecard.md",
  REST_API:
    "NativeCta entries mapped — process-maps.md; other verified areas (NativeSp, callExternalAPI, loadtoactivity) recognized, not mapped; unlisted areas are reported below",
  CONDITIONAL: "recognized — conditional-logic metadata, no field write to map",
};
const KNOWN_ACTION_TYPES = new Set(Object.keys(DISPOSITION));
// REST_API delivery areas verified on 1.0.4. NativeCta is mapped; the rest are
// recognized-not-mapped. An area outside this list is REPORTED (same
// never-silently-drop rule as unknown actionTypes), not absorbed.
const KNOWN_REST_AREAS = new Set(["NativeCta", "NativeSp", "callExternalAPI", "loadtoactivity"]);

// ── Load rules ───────────────────────────────────────────────────────────────
const rules = []; // { name, active, maps }
const ruleStats = { docs: 0, parsed: 0, withMappings: 0 };
for (const path of listDocs(rulesDomain)) {
  ruleStats.docs++;
  const text = docText(path);
  const payload = parseDocJson(text);
  if (!payload) continue;
  ruleStats.parsed++;
  const details = findRuleDetails(payload);
  if (!details) continue;
  ruleStats.withMappings++;
  const meta = docMeta(text);
  rules.push({
    name: details.ruleName ?? meta.name ?? meta.id ?? "(unnamed rule)",
    active: details.active !== false,
    maps: details._flatMappings,
  });
}
rules.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
const tag = (r) => (r.active ? "" : " _(inactive)_");

// ── Load scorecards (GSID → name resolution) ─────────────────────────────────
const measureName = {}; // measureId -> measure name
const measureCard = {}; // measureId -> scorecard name
const measureGroup = {}; // measureId -> group name
const scorecardName = {}; // scorecardId -> scorecard name
const scorecardStats = { docs: 0, parsed: 0 };
for (const path of listDocs(scorecardDomain)) {
  scorecardStats.docs++;
  const text = docText(path);
  const meta = docMeta(text);
  const cardName = meta.name ?? meta.id ?? "(unnamed scorecard)";
  if (meta.id) scorecardName[meta.id] = cardName;
  const payload = parseDocJson(text);
  if (!payload) continue;
  scorecardStats.parsed++;
  collectScorecardMeasures(payload, cardName, { measureName, measureCard, measureGroup });
}

// ── Load chains (rule task order) ────────────────────────────────────────────
const chains = []; // { name, tasks: [ruleName…] }
const chainStats = { docs: 0, parsed: 0 };
for (const path of listDocs(chainsDomain)) {
  chainStats.docs++;
  const text = docText(path);
  const payload = parseDocJson(text);
  if (!payload) continue;
  chainStats.parsed++;
  const meta = docMeta(text);
  const tasks = [];
  (function walk(node) {
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (node._ruleName || (node.type === "BIONIC_RULE" && node.name)) tasks.push(node._ruleName || node.name);
    for (const k of Object.keys(node)) if (node[k] && typeof node[k] === "object") walk(node[k]);
  })(payload);
  chains.push({ name: meta.name ?? meta.id ?? "(unnamed chain)", tasks });
}
chains.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

// ── Load email-template inventory (id → title) ───────────────────────────────
// From the manifest, not the docs: the id IS the manifest key, and a metadata
// stub's id still identifies an edge — see the matching note in the header.
const templateName = {}; // template id -> display name
for (const [key, e] of Object.entries(inventory)) {
  if ((e.domain ?? key.split("/")[0]) !== templatesDomain) continue;
  if (e.id != null && e.id !== "") templateName[e.id] = e.name ?? String(e.id);
}
const templateIds = Object.keys(templateName).sort();

// ── Load journey programs (template-id co-occurrence) ────────────────────────
// Token-based matching (see the header note): tokenize each program payload
// once, then check template ids by set membership — never mid-string (only
// whole tokens and whole -/_-delimited segments match; see the header note on
// the GSID assumption behind that) — and the cost stays one pass per doc
// however many templates the tenant has.
const programs = []; // { name, refs: [templateId…] }
const programStats = { docs: 0, parsed: 0, withRefs: 0 };
for (const path of listDocs(journeyDomain)) {
  programStats.docs++;
  const text = docText(path);
  // Unlike rule docs (where a stub naturally parses to "no mappings"), a
  // metadata stub's embedded list row is valid JSON — filter stubs by the
  // manifest entry's depth (same full-doc rule as manifest.mjs stub), or a
  // stubbed program would be counted as "parsed, no template references".
  // The key bullet is read through topBullets like every other bullet (gate-3
  // review round, F-353): a backtick-quoted value arrives bare there (F-341),
  // and this lane used to keep its own raw regex, so a quoted key missed the
  // inventory lookup and a stub was walked as a full doc.
  const docKey = topBullets(text).key;
  const entry = docKey ? inventory[docKey] : null;
  if (entry && !(entry.depth === "full" || (entry.depth == null && entry.last_verified != null))) continue;
  const payload = parseDocJson(text);
  if (!payload) continue; // unparseable — the coverage header accounts for these
  programStats.parsed++;
  const meta = docMeta(text);
  const tokens = new Set();
  for (const m of JSON.stringify(payload).matchAll(/[A-Za-z0-9_-]+/g)) {
    tokens.add(m[0]);
    if (/[-_]/.test(m[0])) for (const seg of m[0].split(/[-_]+/)) if (seg) tokens.add(seg);
  }
  const refs = templateIds.filter((id) => tokens.has(id));
  if (refs.length) programStats.withRefs++;
  programs.push({ name: meta.name ?? meta.id ?? "(unnamed program)", refs });
}
programs.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
const programTemplateEdges = programs.reduce((a, p) => a + p.refs.length, 0);

// ── Derive the maps ──────────────────────────────────────────────────────────
const POP_TYPES = new Set(["DATA_SYNC", "BULK_API"]);
const writeIdx = {}; // tgtObject -> tgtField -> Set(rule display)
const cardMeasureRules = {}; // scorecard name -> measure name -> Set(rule display)
const dangling = []; // { rule, measureId, scorecardHint }
const ctaRules = {}; // rule display -> Set(CTA name source)
const actionTypeCounts = {}; // actionType -> entry count
const unknownActionTypes = {}; // actionType -> Set(rule display)
const unexpectedRestAreas = {}; // REST_API areaName outside KNOWN_REST_AREAS -> Set(rule display)

// Parse a SET_SCOREV2 JSON-map srcField ({ "<scorecardGSID>": "<measureGSID>" });
// returns the parsed object or null. Tolerates leading/trailing whitespace —
// a JSON-map mistaken for a bare GSID would otherwise become a bogus dangling ref.
function parseJsonMap(v) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t.startsWith("{")) return null;
  try {
    const o = JSON.parse(t);
    return o && typeof o === "object" && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

for (const r of rules) {
  const display = r.name + tag(r);
  const scIds = new Set();
  const mIds = new Set();
  let hasCta = false;
  const ctaNames = new Set();
  for (const m of r.maps) {
    const at = m.actionType ?? "(missing actionType)";
    actionTypeCounts[at] = (actionTypeCounts[at] ?? 0) + 1;
    if (!KNOWN_ACTION_TYPES.has(at)) {
      (unknownActionTypes[at] ??= new Set()).add(display);
      continue;
    }
    if (POP_TYPES.has(at)) {
      // Blank tgtObject rows come from list-and-describe-path docs at 1.0.6;
      // per-item describe docs can still carry raw task-id/callout targets,
      // which index as-is (see the `_flatMappings` semantics block up top).
      if (!m.tgtObject || !m.tgtField) continue;
      ((writeIdx[m.tgtObject] ??= {})[m.tgtField] ??= new Set()).add(display);
    } else if (at === "SET_SCOREV2") {
      const sf = m.srcField;
      if (!sf) continue;
      const addMap = (o) => {
        for (const k of Object.keys(o)) {
          scIds.add(k);
          mIds.add(o[k]);
        }
      };
      const jsonMap = parseJsonMap(sf);
      if (m.tgtField === "scorecard") scIds.add(sf);
      else if (m.tgtField === "measure") {
        if (jsonMap) addMap(jsonMap);
        else mIds.add(sf);
      } else if (m.tgtField === "score" && jsonMap) addMap(jsonMap);
    } else if (at === "REST_API") {
      // CTA detection lives INSIDE the REST_API branch: a DATA_SYNC load into an
      // object that happens to be named "Call To Action" is a field write, not a
      // CTA-creating action.
      if (m.areaName === "NativeCta" || m.tgtObject === "Call To Action") {
        hasCta = true;
        if (m.tgtField === "Name" && m.srcField) ctaNames.add(m.srcField);
      } else if (!KNOWN_REST_AREAS.has(m.areaName)) {
        (unexpectedRestAreas[m.areaName ?? "(missing areaName)"] ??= new Set()).add(display);
      }
    }
  }
  // Fixed per rule by this point — resolve once, use for both branches below.
  const scHint = [...scIds].map((s) => scorecardName[s]).filter(Boolean).sort()[0];
  for (const mid of mIds) {
    const mn = measureName[mid];
    if (!mn) {
      dangling.push({ rule: display, measureId: mid, scorecardHint: scHint });
      continue;
    }
    const cn = measureCard[mid] ?? scHint ?? "Unknown scorecard";
    const slot = ((cardMeasureRules[cn] ??= {})[mn] ??= { group: measureGroup[mid] ?? "", rules: new Set() });
    slot.rules.add(display);
  }
  if (hasCta) ctaRules[display] = ctaNames;
}
dangling.sort((a, b) => {
  const ka = `${a.measureId} ${a.rule}`;
  const kb = `${b.measureId} ${b.rule}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
});

// ── Render ───────────────────────────────────────────────────────────────────
const deepCmd = (d) => `\`/gs-superadmin:setup --deep ${d}\``;
function coverageLine(domains, extraNotes = []) {
  const built = [];
  const excluded = [];
  const notes = [];
  for (const d of domains) {
    const c = coverage[d];
    if (c.total === 0) {
      notes.push(`${d}: not indexed in this workspace`);
      continue;
    }
    if (c.full > 0) built.push(`${d} (${c.full}/${c.total} full)`);
    else if (c.metadata > 0) excluded.push(d);
    else {
      // No full docs and no stubs either (all failed/pending) — that is not a
      // stub exclusion, and --deep would select nothing; say what's true.
      notes.push(
        `${d}: no full docs to build from (${c.failed} failed, ${c.pending} pending/stale) — document the domain, then re-run`
      );
    }
    if (c.full > 0 && c.full < c.total - c.failed) {
      notes.push(`${d} is partially ingested — mappings reflect only the full docs; re-run after ${deepCmd(d)}`);
    }
    if (c.failed > 0) notes.push(`${d}: ${c.failed} asset(s) failed describe and are not represented`);
  }
  notes.push(...extraNotes);
  // The lane → folder resolver's warnings ride EVERY map's coverage header
  // (F-429 second pass, consumer-parity): a lane read from a non-default
  // folder, two domains recording one list, a no-catalog fallback are facts a
  // map reader needs, and the JSON summary is not the surface they open.
  notes.push(...recordedLanes.warnings);
  let line = `> **Coverage.** Built from full docs of: ${built.length ? built.join(", ") : "(none)"}.`;
  line += excluded.length
    ? ` Excluded (metadata stubs): ${excluded.map((d) => `${d} — re-run after ${deepCmd(d)}`).join("; ")}.`
    : " No domains excluded for this map.";
  for (const n of notes) line += `\n> ${n}.`;
  return line;
}
// A doc can be manifest-full yet unparseable (untagged fence, corrupt JSON) —
// the header must say so, not silently count it as covered.
const parseShortfall = (d, parsedCount) => {
  const miss = coverage[d].full - parsedCount;
  return miss > 0
    ? [`${d}: ${miss} full doc(s) had no parseable describe payload — their content is missing from this map (see the JSON summary)`]
    : [];
};
const rulesNotes = parseShortfall(rulesDomain, ruleStats.withMappings);
const chainsNotes = parseShortfall(chainsDomain, chainStats.parsed);
const scorecardNotes = parseShortfall(scorecardDomain, scorecardStats.parsed);
const header = (mapName) =>
  `<!-- gs-superadmin relationships · ${mapName} · generated ${date} · relationships-build.mjs -->\n\n`;
const rulesPending = coverage[rulesDomain].full === 0;
const pendingNote =
  "\n_Pending deep ingest — no fully-described rule docs to build this map from yet. " +
  `Run ${deepCmd(rulesDomain)} (or a deep crawl), then re-run this script._\n`;

// field-to-rule.md
let f2r =
  header("field-to-rule") + "# Field ↔ Rule\n\n" + coverageLine([rulesDomain, chainsDomain], [...rulesNotes, ...chainsNotes]) + "\n";
f2r += "\n## Field population — target field ← rule(s) (confirmed)\n\n";
f2r +=
  "Data-load/update actions (`DATA_SYNC`, `BULK_API`) grouped by target object, then field. " +
  "Each field lists the rule(s) whose action writes it; inactive rules are flagged.\n";
if (rulesPending) f2r += pendingNote;
else if (!Object.keys(writeIdx).length) f2r += "\n_No data-load writes found in the documented rules._\n";
else {
  for (const obj of Object.keys(writeIdx).sort()) {
    const fields = writeIdx[obj];
    f2r += `\n### → \`${obj}\` (${Object.keys(fields).length} field(s) written)\n`;
    for (const fld of Object.keys(fields).sort()) {
      f2r += `- **${fld}** ← ${[...fields[fld]].sort().join("; ")}\n`;
    }
  }
}
f2r += "\n## Rule chains → rules (confirmed)\n\n";
f2r += `Execution order from each chain's task list. Source: \`${chainsDomain}/\` docs.\n`;
if (!chains.length) f2r += "\n_No chain docs found._\n";
for (const c of chains) {
  f2r += `\n### ${c.name}\n`;
  if (c.tasks.length) c.tasks.forEach((t, i) => (f2r += `  ${i + 1}. ${t}\n`));
  else f2r += "  _(rule task names not in the describe payload; see the chain doc)_\n";
}
f2r += `\n## actionType accounting (${SEMANTICS_BASIS})\n\n`;
f2r +=
  "Every `_flatMappings` entry in the documented rules, by actionType — nothing is " +
  "silently dropped. Dispositions: mapped above / in field-to-scorecard.md / in " +
  "process-maps.md, or counted here.\n\n";
if (!Object.keys(actionTypeCounts).length) f2r += "_No mappings found._\n";
for (const at of Object.keys(actionTypeCounts).sort()) {
  const disp = KNOWN_ACTION_TYPES.has(at) ? DISPOSITION[at] : "**UNKNOWN to this generator — not classified**";
  f2r += `- \`${at}\` × ${actionTypeCounts[at]} — ${disp}\n`;
}
if (Object.keys(unknownActionTypes).length) {
  f2r += "\n### ⚠ Unknown actionTypes — mappings NOT classified\n\n";
  f2r +=
    `These actionTypes are not part of the semantics this generator hardcodes (${SEMANTICS_BASIS}). ` +
    "Their entries were counted but not mapped — inspect the rule docs " +
    "directly, and update the generator (plugin repo) if a CLI upgrade added them.\n";
  for (const at of Object.keys(unknownActionTypes).sort()) {
    f2r += `\n- \`${at}\` — carried by: ${[...unknownActionTypes[at]].sort().join("; ")}\n`;
  }
}
if (Object.keys(unexpectedRestAreas).length) {
  f2r += "\n### ⚠ Unrecognized REST_API areas — not classified\n\n";
  f2r +=
    "REST_API delivery areas outside the list this generator hardcodes (NativeCta, NativeSp, " +
    `callExternalAPI, loadtoactivity; ${SEMANTICS_BASIS}). Their entries were counted but not mapped — ` +
    "inspect the rule docs directly, and update the generator if a CLI upgrade added them.\n";
  for (const area of Object.keys(unexpectedRestAreas).sort()) {
    f2r += `\n- \`${area}\` — carried by: ${[...unexpectedRestAreas[area]].sort().join("; ")}\n`;
  }
}

// field-to-scorecard.md
let f2s =
  header("field-to-scorecard") +
  "# Field ↔ Scorecard\n\n" +
  coverageLine([rulesDomain, scorecardDomain], [...rulesNotes, ...scorecardNotes]) +
  "\n";
f2s += "\n## Measure ← scoring rule(s) (confirmed via SET_SCOREV2)\n\n";
f2s +=
  "Rule→measure linkage from each rule's `SET_SCOREV2` action mappings (measure & " +
  "scorecard GSIDs resolved against the scorecard docs' `levelType` trees).\n";
// A ref that fails to resolve is only a tenant-hygiene signal when scorecard
// docs were actually available to resolve against — otherwise it's a coverage
// gap and must be labeled as one.
const scorecardsAvailable = Object.keys(measureName).length > 0;
if (rulesPending) f2s += pendingNote;
else if (!Object.keys(cardMeasureRules).length && !dangling.length) f2s += "\n_No scoring actions found in the documented rules._\n";
else {
  for (const cn of Object.keys(cardMeasureRules).sort()) {
    f2s += `\n### ${cn}\n`;
    const measures = cardMeasureRules[cn];
    for (const mn of Object.keys(measures).sort()) {
      const { group, rules: rs } = measures[mn];
      f2s += `- **${mn}**${group ? ` (group: ${group})` : ""} ← ${[...rs].sort().join("; ")}\n`;
    }
  }
  if (dangling.length) {
    const uniqueIds = [...new Set(dangling.map((d) => d.measureId))];
    const refCounts = `${dangling.length} SET_SCOREV2 reference(s) across ${new Set(dangling.map((d) => d.rule)).size} rule(s)`;
    if (scorecardsAvailable) {
      f2s += "\n## ⚠ Dangling measure references (tenant-hygiene signal)\n\n";
      f2s +=
        `${refCounts} target ${uniqueIds.length} measure GSID(s) that resolve to no documented scorecard measure — ` +
        "the measure was deleted, or its scorecard is not in the KB. Re-verify with `sc measures`.\n\n";
    } else {
      f2s += "\n## Unresolved measure references — no scorecard docs to resolve against\n\n";
      f2s +=
        `${refCounts} could not be resolved because the KB has no scorecard doc with a parseable measure tree ` +
        "(domain stubbed, not indexed, or docs unparseable). This is a **coverage gap, not a tenant-hygiene " +
        "signal** — document the scorecard domain, then re-run this script.\n\n";
    }
    for (const d of dangling) {
      f2s += `- \`${d.measureId}\` ← ${d.rule}${d.scorecardHint ? ` (scorecard context: ${d.scorecardHint})` : ""}\n`;
    }
  }
}

// process-maps.md
let pm = header("process-maps") + "# Process Maps (rule → CTA)\n\n" + coverageLine([rulesDomain], rulesNotes) + "\n";
pm += "\n## Rule → CTA (confirmed via NativeCta actions)\n\n";
pm +=
  "Rules whose actions create a Call To Action, from each rule's `NativeCta` mappings " +
  "(the CTA name source is the `Name` mapping's srcField).\n";
if (rulesPending) pm += pendingNote;
else if (!Object.keys(ctaRules).length) pm += "\n_No CTA-creating rules found in the documented rules._\n";
else {
  pm += "\n";
  for (const rn of Object.keys(ctaRules).sort()) {
    const names = [...ctaRules[rn]].sort();
    pm += `- **${rn}**${names.length ? ` → CTA: ${names.map((n) => `\`${n}\``).join(", ")}` : ""}\n`;
  }
}
pm += "\n## Journey ↔ Rules Engine — no participant edge exists\n\n";
pm +=
  "Rules Engine rules do **not** load participants into Journey Orchestrator programs — " +
  "there is no journey → rule map to build. Programs draw participants from **Power " +
  "Lists**, backed by CSV uploads, ad-hoc queries, or Data Designer / DD-template " +
  "datasets — never a rule (Gainsight product architecture, tenant-agnostic; " +
  "live-confirmed by a full GSID cross-reference between rule and program docs finding " +
  "zero shared-id edges). The journey-side edges that ARE derivable from deep docs: " +
  "**program → email template** (generated as `program-to-template.md` alongside this " +
  "file) and **program → Power List → source** (CSV / query / Data Designer), parseable " +
  "from the PowerList config block in each program's step JSON but not yet automated — " +
  "trace it by hand in Phase 6 prose synthesis and label each edge `confirmed` (read " +
  "from a program doc's PowerList config) or `inferred`.\n";

// program-to-template.md
const journeyPending = coverage[journeyDomain].full === 0;
const journeyNotes = parseShortfall(journeyDomain, programStats.parsed);
// The templates side is inventory-driven (ids match at any depth), so the
// stub-exclusion phrasing of coverageLine would be wrong for it — state what
// is actually used instead.
const templatesNote =
  coverage[templatesDomain].total === 0
    ? [`${templatesDomain}: not indexed in this workspace — no template ids to match against`]
    : [
        `${templatesDomain}: ${templateIds.length} inventory id(s) used for template matching ` +
          `(manifest inventory, any depth — a metadata stub's id still identifies an edge)`,
      ];
let p2t =
  header("program-to-template") +
  "# Program → Email Template\n\n" +
  coverageLine([journeyDomain], [...journeyNotes, ...templatesNote]) +
  "\n";
p2t += "\n## Program → template reference(s) (confirmed via GSID co-occurrence)\n\n";
p2t +=
  "Each fully-described journey program whose doc payload references a template id from " +
  `the \`${templatesDomain}\` inventory (matched as whole tokens — see the generator header; ` +
  `${SEMANTICS_BASIS}). Raw and compacted program docs both carry the references.\n`;
if (journeyPending) {
  p2t +=
    "\n_Pending deep ingest — no fully-described journey program docs to build this map " +
    `from yet. Run ${deepCmd(journeyDomain)} (or a deep crawl), then re-run this script._\n`;
} else if (!templateIds.length) {
  p2t +=
    "\n_No email-template inventory to match against — index (and optionally document) " +
    `the ${templatesDomain} domain, then re-run this script._\n`;
} else {
  const withRefs = programs.filter((p) => p.refs.length);
  if (!withRefs.length) p2t += "\n_No template references found in the documented programs._\n";
  else {
    p2t += "\n";
    for (const p of withRefs) {
      p2t += `- **${p.name}** → ${p.refs.map((id) => `${templateName[id]} (\`${id}\`)`).join("; ")}\n`;
    }
  }
  p2t += `\n_${programs.length - withRefs.length} of ${programs.length} parsed program doc(s) reference no documented template._\n`;
}

// ── Write ────────────────────────────────────────────────────────────────────
mkdirSync(resolve(outDir), { recursive: true });
const outputs = {
  "field-to-rule.md": f2r,
  "field-to-scorecard.md": f2s,
  "process-maps.md": pm,
  "program-to-template.md": p2t,
};
const generated = [];
for (const [name, content] of Object.entries(outputs)) {
  writeFileSync(resolve(outDir, name), content, "utf8");
  generated.push(join(outDir, name).replace(/\\/g, "/"));
}

console.log(
  JSON.stringify(
    {
      ok: true,
      generated,
      date,
      coverage,
      rules: ruleStats,
      scorecards: { ...scorecardStats, measuresResolved: Object.keys(measureName).length },
      chains: chainStats,
      programs: { ...programStats, templatesKnown: templateIds.length, templateEdges: programTemplateEdges },
      actionTypes: actionTypeCounts,
      unknownActionTypes: Object.fromEntries(
        Object.entries(unknownActionTypes).map(([k, v]) => [k, [...v].sort()])
      ),
      unexpectedRestApiAreas: Object.fromEntries(
        Object.entries(unexpectedRestAreas).map(([k, v]) => [k, [...v].sort()])
      ),
      danglingMeasureRefs: dangling.length,
      // F-429 second pass: which folder each lane was read from and why, and
      // the resolver's warnings — the same facts the maps' coverage headers
      // carry, so the JSON and markdown surfaces cannot disagree on them.
      domainDirs,
      domainDirBasis,
      warnings: recordedLanes.warnings,
    },
    null,
    2
  )
);
