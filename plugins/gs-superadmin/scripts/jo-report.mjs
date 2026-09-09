#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// jo-report.mjs — JO email-report dispatcher, KB-doc parsers, index builder,
// and shared output plumbing (ER-1/ER-2/ER-3 of the email-report program).
//
// The email-report skill answers questions about Journey Orchestrator email
// templates and programs (search / program / audit-active / deps) from the
// per-tenant KB docs, without passing bulk payloads through model context.
// This file is the shared foundation:
//
// - Parsers (ER-1): KB journey docs (the fenced describe payload, incl. the
//   stringified-JSON layers) and KB template docs (doc-lib.mjs's
//   renderTemplateDoc output). Both defensive — a malformed layer lands in
//   parseErrors, never throws out of the parser.
// - `index` subcommand (ER-2): folds every KB journey + template doc into one
//   local index file (contract C1), optionally overlaying live statuses from
//   captured `gs-admin --json jo p list` pages. Stdout is a summary only;
//   the multi-MB index goes to --out.
// - Output plumbing (ER-3): markdown report renderer (uniform header +
//   mandatory "Caveats & data gaps" section + re-run footer), RFC-4180 CSV,
//   collision-safe report pathing, summary-JSON emitter (contract C2).
//
// Mode dispatch (contract C3): `jo-report.mjs <index|search|program|
// audit-active|deps>` — `index` is built in here; each report mode lives in
// a sibling module `./jo-report-<mode>.mjs` (dynamic import) that imports
// these helpers, so mode sessions never edit this file.
//
// ── Journey-doc payload shape — v1.0.4-scoped assumptions ────────────────────
// The fenced JSON is UNDOCUMENTED CLI internals (same rationale as
// doc-lib.mjs's program-payload note). Observed across every journey doc of a
// real sandbox KB, 2026-07-12 (per AGENTS.md data hygiene, no tenant
// identifiers or live counts here — measurements live outside the repo):
// - data.advancedOutreach: id/name/status (status is an ARRAY, e.g.
//   ["PROCESSING"]), advancedOutreachModel/ModelName, advancedOutreachStartDate.
// - stepJson (stringified in raw docs; already parsed in compacted docs) is
//   EITHER an array of classic steps (the overwhelming majority; ACTION steps
//   embed emailActionJson, stringified again, carrying emailTemplateId/Name
//   and variantMappings) OR a flow-canvas object {nodes:[...]} (a small
//   DYNAMIC_PROGRAM minority; email refs live in each node's stringified
//   actionConfig, and node exitTimer is a plain object, kept verbatim).
// - Schedules live under aoConfiguration (stringified) .scheduleInfo.schedules
//   and/or per participant source's scheduleInfo (stringified). Observed
//   entries use `type:"CRON"` — scheduleType is normalized from
//   scheduleType ?? type (the plan's ONE-TIME/RECURRING values were not
//   observed in this KB; see VALIDATION.md).
// - participantSourceConfigurations[]: mappingInformation (stringified map),
//   customMappings (stringified map keyed by field gsid — normalized to an
//   array here), config (stringified; filters.conditions[] entries wrap the
//   field in leftOperand{objectName, fieldName, label}).
// Every embedded layer is parsed via embedded(): string → JSON.parse,
// object/array → as-is, so both raw and compacted doc generations parse
// (requirement confirmed S1, 2026-07-12). Re-verify after any CLI upgrade.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import {
  normalizeText, extractFencedJson, topBullets, listMdFiles, NO_NAME,
  stripBom, isMainModule, STUB_MARKER_RE, makeCliHelpers, readKbIdentity,
  shq, POSIX_QUOTE_CAVEAT, needsPosixQuoteCaveat, readJsonFile, resolveRecordedDomains, laneTable } from "./doc-lib.mjs";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
// The journey and template KB folders are resolved from the manifest's
// recordings (F-429; doc-lib resolveRecordedDomains — the one home): a lane's
// identity is its list command, its folder name is per-workspace data. The
// literals are the no-recording fallback only. The resolution (dirs + basis)
// is written INTO the index (`domains`) beside the build's `warnings`, so the
// four report modes — which read the index, never the KB folders — can carry
// what the build saw (F-429 second pass, consumer-parity; writeModeReport).
const { lanes: JO_LANES, defaults: JO_DEFAULTS } = laneTable({ journey: "journey", templates: "templates" });
function resolveJoDirs(kbDir, inventory, warnings) {
  let domainsIndexed = {};
  try {
    const m = readJsonFile(join(kbDir, "_manifest.json"));
    if (m && typeof m === "object" && m.domains_indexed && typeof m.domains_indexed === "object") domainsIndexed = m.domains_indexed;
  } catch { /* readKbIdentity already warned about an unreadable manifest */ }
  const res = resolveRecordedDomains({
    startDir: kbDir,
    domainsIndexed,
    inventory,
    lanes: JO_LANES,
    defaults: JO_DEFAULTS,
    bundledCatalogPath: join(HERE, "..", "reference", "catalog.json"),
  });
  warnings.push(...res.warnings);
  return { dirs: res.dirs, basis: res.basis };
}

// The KB-doc read-side primitives (fence body, `- key:` bullets, BOM/CRLF
// normalization, .md dir listing) are the single copy in doc-lib.mjs — import,
// never re-implement. (This file's fence-parse keeps a deliberate
// error-reporting variant over the raw primitive — parseErrors instead of
// parseDocJson's null signal — registered as a check-doc-drift check-9
// allowance.) extractFencedJson is part of this module's ER-1 public surface
// (test/jo-report.mjs imports it from here), so re-export the shared copy to
// keep that surface intact.
export { extractFencedJson };

// ── generic helpers ──────────────────────────────────────────────────────────

export const nowIso = () => new Date().toISOString();

const firstOf = (v) =>
  Array.isArray(v) ? (v.length ? String(v[0]) : null) : v == null ? null : String(v);

// describe-batch.mjs writes this sentinel for entries stubbed without a name —
// NO_NAME is doc-lib's single copy (docMeta resolves it there); never index it
// as a real program name. An EMPTY string is no name either — docMeta's rule
// (a missing or empty `- name:` resolves to the H1) for the VALUE, applied to
// every name this index reads: a bullet (then `?? h1`), a payload's
// advancedOutreachName (then the doc-derived name), a live list row (then
// null). What counts as a program at all is decided separately, on evidence
// (liveEntriesFrom) — nullifying a value never demotes a record (GP-B5
// W8/DS-47 + review round: the two readers had diverged on "" alone).
const realName = (v) => (v == null || v === "" || v === NO_NAME ? null : v);

// Parse one possibly-stringified JSON layer. Raw docs carry these layers as
// strings; compacted docs (doc-lib.mjs renderProgramDoc) carry them already
// parsed — both generations must work. Returns null for empty/absent values;
// a string that fails to parse is recorded in errors and returns null.
function embedded(value, where, errors) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return value;
  const t = value.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try {
    return JSON.parse(t);
  } catch (e) {
    errors.push(`${where}: ${e.message}`);
    return null;
  }
}

// ── flag parsing (contract C3 flag surface) ──────────────────────────────────

// C3's frozen flag grammar, exported so mode modules pass these instead of
// re-declaring (and mis-declaring) which flags repeat. Modes may ADD names.
export const C3_REPEATABLE = ["query", "name", "object", "field", "live-list"];
export const C3_BOOLEAN = ["active-only", "all", "include-paused"];

// argv → { flag: value | [values] | true, _: positionals }. Repeatable flags
// always collect into arrays; unknown flags are the caller's to validate.
export function parseFlags(argv, { repeatable = C3_REPEATABLE, boolean = C3_BOOLEAN } = {}) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      flags._.push(a);
      continue;
    }
    const name = a.slice(2);
    if (boolean.includes(name)) {
      flags[name] = true;
      continue;
    }
    const v = argv[++i];
    // a following --flag is a missing value, not a value — never swallow it
    if (v === undefined || v.startsWith("--")) throw new Error(`--${name} requires a value`);
    if (repeatable.includes(name)) (flags[name] ??= []).push(v);
    else if (name in flags) throw new Error(`--${name} given twice (not repeatable)`);
    else flags[name] = v;
  }
  return flags;
}

// ── ER-1a: journey-doc parser ────────────────────────────────────────────────

// The fence-body reader (extractFencedJson) and top `- key:` bullet parser
// (topBullets) are the shared doc-lib.mjs primitives, imported above.
// parseJourneyDoc runs normalizeText before calling them (caller-normalizes).

const normSchedule = (s) => ({
  scheduleType: s.scheduleType ?? s.type ?? null,
  cronExpression: s.cronExpression ?? null,
  nextRunTime: s.nextRunTime ?? null,
  lastSuccessTime: s.lastSuccessTime ?? null,
  lastRunSuccess: s.lastRunSuccess ?? null,
  runningNow: s.runningNow ?? null,
  timeZoneName: s.timeZoneName ?? null,
  jobType: s.jobType ?? null,
});

const normCondition = (c) => {
  const lo = c?.leftOperand && typeof c.leftOperand === "object" ? c.leftOperand : {};
  return {
    objectName: c.objectName ?? lo.objectName ?? null,
    fieldName: c.fieldName ?? lo.fieldName ?? null,
    fieldLabel: c.fieldLabel ?? lo.fieldLabel ?? lo.label ?? null,
    comparisonOperator: c.comparisonOperator ?? null,
    filterAlias: c.filterAlias ?? c.alias ?? null,
  };
};

// ── C1 v2: normalized program-side token bindings (ER-15/ER-17/ER-19) ───────
// ONE shape covering BOTH generations' binding entries:
// - classic `variantTokenMapping` OBJECT: tokenMapping.tokens[{name, value
//   {type:"field"|"value", field, fieldName, label, fieldLabel, objectName}}]
//   plus sibling surveyTokenMappings[{id, surveyToken{surveyId, surveyName}}]
// - flow-canvas `variantTokenMapping` ARRAY: [{id, tokenType:"STANDARD"|
//   "SurveyToken", tokenMapping{name, value{type:"FIELD"|"DYNAMIC_QUERY_V2"|
//   "value", label, fieldConfig{field, objectName}|{fieldId}}}, surveyToken}]
// The human label collapses to fieldLabel ?? label and the API handle to
// field ?? fieldName — verified lossless (case-insensitively) across every
// real classic binding at P-2 scale; flow-canvas carries one of each.
function normTokenEntry(e) {
  if (!e || typeof e !== "object") return null;
  const tokenKey = e.id ?? e.tokenKey ?? e.tokenMapping?.name ?? e.name ?? null;
  if (tokenKey == null) return null;
  const t = { tokenKey: String(tokenKey), kind: "literal", label: null, objectName: null, fieldName: null, fieldId: null, survey: null };
  const st = e.surveyToken;
  if ((typeof e.tokenType === "string" && /survey/i.test(e.tokenType)) || (st && typeof st === "object")) {
    t.kind = "survey";
    if (st && typeof st === "object" && (st.surveyId != null || st.surveyName != null))
      t.survey = { surveyId: st.surveyId ?? null, surveyName: st.surveyName ?? null };
    return t;
  }
  const v = e.tokenMapping?.value ?? e.value;
  if (!v || typeof v !== "object") return t;
  const type = String(v.type ?? "").toLowerCase();
  const fc = v.fieldConfig && typeof v.fieldConfig === "object" ? v.fieldConfig : {};
  if (type === "field") {
    t.kind = "field";
    t.label = v.fieldLabel ?? v.label ?? null;
    t.objectName = fc.objectName ?? v.objectName ?? v.object ?? null;
    t.fieldName = fc.field ?? v.field ?? v.fieldName ?? null;
  } else if (fc.fieldId != null || type === "dynamic_query_v2") {
    t.kind = "calc"; // calc-bound: label is the only resolvable handle
    t.label = v.fieldLabel ?? v.label ?? null;
    t.fieldId = fc.fieldId ?? null;
  }
  return t; // anything else (observed: type "value") stays kind "literal"
}

// Email-template references + token bindings + bound assets from a step/node
// action config — ONE copy for both stepJson shapes, so a newly-discovered
// variant-mapping key can never be fixed in one shape and missed in the other.
// `nodeSurveyId` is the flow-canvas node's top-level surveyIdFromEmailActionV2
// (classic steps have none).
function applyEmailRefs(step, action, { nodeSurveyId = null, where = "", errors = [] } = {}) {
  if (!action || typeof action !== "object") return;
  step.emailTemplateId = action.emailTemplateId != null ? String(action.emailTemplateId) : null;
  step.emailTemplateName = action.emailTemplateName ?? null;
  const ids = new Set();
  const seenTokens = new Set();
  for (const vm of Array.isArray(action.variantMappings) ? action.variantMappings : []) {
    const vtm = vm?.variantTokenMapping;
    const tid = vtm?.templateId ?? vm?.templateId;
    if (tid != null) ids.add(String(tid));
    // binding entries, both generations (see normTokenEntry)
    const entries = Array.isArray(vtm)
      ? vtm
      : vtm && typeof vtm === "object"
        ? [
            ...(Array.isArray(vtm.tokenMapping?.tokens) ? vtm.tokenMapping.tokens : []),
            ...(Array.isArray(vtm.surveyTokenMappings) ? vtm.surveyTokenMappings : []),
          ]
        : [];
    for (const e of entries) {
      const tok = normTokenEntry(e);
      if (!tok || seenTokens.has(tok.tokenKey)) continue;
      seenTokens.add(tok.tokenKey);
      step.tokens.push(tok);
    }
  }
  step.variantTemplateIds = [...ids];

  // boundAssets (ER-17): SURVEY only for now — id+name reconciled from the
  // flow-canvas node's surveyInfo, the classic surveyTokenMappings (already in
  // step.tokens), and surveyIdFromEmailActionV2. Future asset types are
  // additive population of the same field (no schema bump).
  const addAsset = (id, name) => {
    const sid = id != null ? String(id) : null;
    if (sid == null && name == null) return;
    const existing = step.boundAssets.find((a) => a.type === "SURVEY" && a.id === sid);
    if (existing) {
      if (existing.name == null && name != null) existing.name = name;
      return;
    }
    step.boundAssets.push({ type: "SURVEY", id: sid, name: name ?? null });
  };
  const si = action.globalConfigInfo?.surveyInfo;
  if (si && typeof si === "object" && (si.surveyId != null || si.surveyName != null)) addAsset(si.surveyId, si.surveyName);
  for (const tok of step.tokens) if (tok.kind === "survey" && tok.survey) addAsset(tok.survey.surveyId, tok.survey.surveyName);
  const v2 = nodeSurveyId ?? action.surveyIdFromEmailActionV2 ?? null;
  if (v2 != null && !step.boundAssets.some((a) => a.type === "SURVEY" && a.id === String(v2))) {
    if (step.boundAssets.some((a) => a.type === "SURVEY"))
      // sources disagree — keep both (named source first) and flag it; the
      // program report surfaces this as a caveat, per the ER-17 ruling
      errors.push(`${where}: surveyIdFromEmailActionV2 '${v2}' disagrees with the named survey source — named source listed first`);
    addAsset(v2, null);
  }
  // a flow-canvas SurveyToken carries no identity of its own — when the step
  // binds exactly one survey, that IS the token's survey
  const surveyAssets = step.boundAssets.filter((a) => a.type === "SURVEY");
  if (surveyAssets.length === 1)
    for (const tok of step.tokens)
      if (tok.kind === "survey" && tok.survey == null)
        tok.survey = { surveyId: surveyAssets[0].id, surveyName: surveyAssets[0].name };
}

function classicStep(s, i, errors) {
  const step = {
    order: s.order ?? i + 1,
    stepId: s.stepId ?? null,
    stepName: s.stepName ?? null,
    stepType: s.stepType ?? null,
    actionType: s.actionType ?? null,
    outboundAction: s.outboundAction ?? null,
    emailTemplateId: null,
    emailTemplateName: null,
    variantTemplateIds: [],
    tokens: [],
    boundAssets: [],
    timer: null,
  };
  if (s.stepType === "TIMER")
    step.timer = { timerType: s.timerType ?? null, timerValue: s.timerValue ?? null, uiTimerValue: s.uiTimerValue ?? null };
  applyEmailRefs(step, embedded(s.emailActionJson, `steps[${i}].emailActionJson`, errors), {
    where: `steps[${i}]`,
    errors,
  });
  return step;
}

// Flow-canvas node (DYNAMIC_PROGRAM stepJson = {nodes:[...]}) → step entry.
// Email refs live in the node's actionConfig (stringified in raw docs).
// exitTimer is a plain object in observed payloads and its shape differs from
// classic TIMER steps — kept verbatim rather than inventing a normalization.
function nodeStep(n, i, errors) {
  const step = {
    order: n.order ?? i + 1,
    stepId: n.id ?? null,
    stepName: n.name ?? null,
    stepType: n.type ?? n.nodeType ?? null,
    actionType: n.actionType ?? null,
    outboundAction: null,
    emailTemplateId: null,
    emailTemplateName: null,
    variantTemplateIds: [],
    tokens: [],
    boundAssets: [],
    timer: embedded(n.exitTimer, `steps[${i}].exitTimer`, errors) ?? n.exitTimer ?? null,
  };
  applyEmailRefs(step, embedded(n.actionConfig, `steps[${i}].actionConfig`, errors), {
    nodeSurveyId: n.surveyIdFromEmailActionV2 ?? null,
    where: `steps[${i}]`,
    errors,
  });
  return step;
}

// Parse one KB journey doc into a C1 program entry. Never throws on doc
// content: stubs come back depth:"stub" with no errors — BOTH forms: fence-less
// metadata docs AND manifest.mjs `stub` docs, which DO carry a ```json fence
// (the raw list item, not a describe payload) plus a marker blockquote;
// malformed layers accumulate into parseErrors. lastVerified and live-status
// overlay are the index builder's job, not the parser's.
export function parseJourneyDoc(md, docPath = "") {
  md = normalizeText(md);
  const parseErrors = [];
  // Fence presence alone cannot mean full depth: detect the stub verb's own
  // marker in the pre-fence header. Single source: doc-lib's STUB_MARKER
  // (T-3) — manifest.mjs's `stub` writer emits the string; this detector
  // tests STUB_MARKER_RE, the regex derived from it.
  const fenceAt = md.indexOf("```");
  const isMetadataStub = STUB_MARKER_RE.test(fenceAt === -1 ? md : md.slice(0, fenceAt));
  const bullets = topBullets(md);
  const h1 = /^# (.*)$/m.exec(md)?.[1] ?? null;
  const entry = {
    id: bullets.id ?? null,
    name: realName(bullets.name) ?? h1 ?? null,
    status: null,
    statusSource: "kb",
    model: null,
    modelName: null,
    startDate: null,
    depth: "stub",
    docPath,
    lastVerified: null,
    schedules: [],
    steps: [],
    sources: [],
  };

  const fence = extractFencedJson(md);
  if (fence == null) return { entry, parseErrors };

  let payload;
  try {
    payload = JSON.parse(fence);
  } catch (e) {
    parseErrors.push(`fenced JSON: ${e.message}`);
    return { entry, parseErrors };
  }
  const data =
    payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : payload;
  const ao =
    data?.advancedOutreach && typeof data.advancedOutreach === "object" && !Array.isArray(data.advancedOutreach)
      ? data.advancedOutreach
      : data;
  if (!ao || typeof ao !== "object" || Array.isArray(ao)) {
    parseErrors.push("payload: no advancedOutreach object found");
    return { entry, parseErrors };
  }

  if (!isMetadataStub) entry.depth = "full";
  if (ao.advancedOutreachId != null) entry.id = String(ao.advancedOutreachId);
  entry.name = realName(ao.advancedOutreachName) ?? entry.name;
  entry.status = firstOf(ao.advancedOutreachStatus);
  entry.model = ao.advancedOutreachModel ?? null;
  entry.modelName = ao.advancedOutreachModelName ?? null;
  entry.startDate = ao.advancedOutreachStartDate ?? null;

  const addSchedules = (si, where) => {
    const obj = embedded(si, where, parseErrors);
    const list = obj && typeof obj === "object" ? obj.schedules : null;
    if (Array.isArray(list)) for (const s of list) if (s && typeof s === "object") entry.schedules.push(normSchedule(s));
  };
  const aoConf = embedded(ao.aoConfiguration, "aoConfiguration", parseErrors);
  if (aoConf && typeof aoConf === "object") addSchedules(aoConf.scheduleInfo, "aoConfiguration.scheduleInfo");
  addSchedules(ao.scheduleInfo, "scheduleInfo");

  const sj = embedded(ao.stepJson, "stepJson", parseErrors);
  if (Array.isArray(sj)) entry.steps = sj.map((s, i) => classicStep(s ?? {}, i, parseErrors));
  else if (sj && typeof sj === "object" && Array.isArray(sj.nodes))
    entry.steps = sj.nodes.map((n, i) => nodeStep(n ?? {}, i, parseErrors));

  const configs = Array.isArray(ao.participantSourceConfigurations) ? ao.participantSourceConfigurations : [];
  for (const [ci, c] of configs.entries()) {
    if (!c || typeof c !== "object") continue;
    const src = {
      configId: c.participantSourceConfigurationId ?? c.gsid ?? null,
      type: c.participantSourceType ?? null,
      name: c.participantSourceName ?? null,
      // C1 v2 (ER-20 schema, shipped S8; resolution logic is S9's): the raw
      // provenance pointers, verbatim from the payload — no resolution here.
      participantSourceCollectionId: c.participantSourceCollectionId ?? null,
      participantSourceType: c.participantSourceType ?? null,
      participantOperationType: c.participantOperationType ?? null,
      mappings: { standard: {}, custom: [] },
      conditions: [],
    };
    const mi = embedded(c.mappingInformation, `sources[${ci}].mappingInformation`, parseErrors);
    if (mi && typeof mi === "object" && !Array.isArray(mi)) src.mappings.standard = mi;
    const cm = embedded(c.customMappings, `sources[${ci}].customMappings`, parseErrors);
    if (Array.isArray(cm)) src.mappings.custom = cm;
    else if (cm && typeof cm === "object")
      src.mappings.custom = Object.entries(cm).map(([id, v]) => ({ id, ...(v && typeof v === "object" ? v : { value: v }) }));
    const cfg = embedded(c.config, `sources[${ci}].config`, parseErrors);
    const conds = cfg && typeof cfg === "object" ? cfg.filters?.conditions : null;
    if (Array.isArray(conds)) src.conditions = conds.filter((x) => x && typeof x === "object").map(normCondition);
    addSchedules(c.scheduleInfo, `sources[${ci}].scheduleInfo`);
    entry.sources.push(src);
  }

  return { entry, parseErrors };
}

// ── ER-1b: template-doc parser ───────────────────────────────────────────────

// Pinned to doc-lib.mjs renderTemplateDoc output (the fixture in
// test/jo-report.mjs is generated by RUNNING template-doc.mjs, so renderer
// drift breaks the test). Known limitation, accepted: a body whose own text
// contains a line exactly matching a section heading ("## Variants") or a
// variant heading prefix ("### ") would truncate/split — the renderer writes
// bodies verbatim, so the doc format itself is ambiguous there.
const DERIVED_NOTE = "_(derived from HTML — plain-text body was empty)_";
const EMPTY_BODY = "_(empty body)_";

function bodyText(lines) {
  let derived = false;
  const kept = [];
  for (const l of lines) {
    if (l.trim() === DERIVED_NOTE) {
      derived = true;
      continue;
    }
    kept.push(l);
  }
  let text = kept.join("\n").trim();
  if (text === EMPTY_BODY) text = "";
  return { text, derived };
}

// Parse one KB template doc into a C1 template entry (metadata-only stub docs
// come back bodyIncluded:false). Never throws on doc content.
export function parseTemplateDoc(md, docPath = "") {
  md = normalizeText(md);
  const parseErrors = [];
  const lines = md.split("\n");
  const h1 = /^# (.*)$/m.exec(md)?.[1] ?? null;
  const tpl = {
    id: null,
    title: h1,
    subject: null,
    folderId: null,
    active: null,
    body: "",
    variants: [],
    // C1 v2 (ER-15): null = doc predates token metadata (no "## Tokens"
    // section); [] = the payload affirmatively had no tokens.
    tokens: null,
    docPath,
    bodyIncluded: false,
  };

  // id: the re-fetch hint carries it verbatim (survives ids the filename
  // sanitizer would mangle); the key bullet is the fallback.
  const refetch = /`gs-admin --json jo email template --id (.+?)`/.exec(md);
  if (refetch) tpl.id = refetch[1];
  const bullets = topBullets(md);
  // The key's domain prefix is whatever the workspace named the templates
  // domain (F-429) — strip the first segment, not a literal.
  if (tpl.id == null && bullets.key) tpl.id = bullets.key.replace(/^[^/]+\//, "");
  if (bullets.subject != null) tpl.subject = bullets.subject;
  if (bullets.folderId != null) {
    // "- folderId: 68 · active: true · transactional: false"
    const seg = bullets.folderId.split("·").map((s) => s.trim());
    const fid = seg[0];
    tpl.folderId = fid === "" || fid === "unknown" ? null : /^\d+$/.test(fid) ? Number(fid) : fid;
    for (const s of seg.slice(1)) {
      const m = /^active: (.*)$/.exec(s);
      if (m) tpl.active = m[1] === "true" ? true : m[1] === "false" ? false : null;
    }
  }
  if (tpl.id == null) parseErrors.push("template doc: no id found (re-fetch hint and key bullet both absent)");

  const bodyStart = lines.findIndex((l) => l.trim() === "## Body (plain text)");
  const variantsStart = lines.findIndex((l) => l.trim() === "## Variants");

  // "## Tokens" (ER-15): the renderer writes it ABOVE the body, as one fenced
  // JSON array in the C1 v2 template tokens[] shape — keep in sync with
  // doc-lib.mjs renderTemplateDoc. A heading found at/after the body section
  // is body text, not the section.
  const tokensStart = lines.findIndex((l) => l.trim() === "## Tokens");
  if (tokensStart !== -1 && (bodyStart === -1 || tokensStart < bodyStart)) {
    const sectionEnd = lines.findIndex((l, i) => i > tokensStart && l.startsWith("## "));
    const limit = sectionEnd === -1 ? lines.length : sectionEnd;
    const fenceStart = lines.findIndex((l, i) => i > tokensStart && i < limit && l.trim() === "```json");
    const fenceEnd = fenceStart === -1 ? -1 : lines.findIndex((l, i) => i > fenceStart && i < limit && l.trim() === "```");
    if (fenceStart === -1 || fenceEnd === -1) parseErrors.push("## Tokens: no fenced JSON block found");
    else {
      try {
        const parsed = JSON.parse(lines.slice(fenceStart + 1, fenceEnd).join("\n"));
        if (Array.isArray(parsed)) tpl.tokens = parsed;
        else parseErrors.push("## Tokens: fenced JSON is not an array");
      } catch (e) {
        parseErrors.push(`## Tokens: ${e.message}`);
      }
    }
  }

  if (bodyStart !== -1) {
    tpl.bodyIncluded = true;
    const end = variantsStart > bodyStart ? variantsStart : lines.length;
    tpl.body = bodyText(lines.slice(bodyStart + 1, end)).text;
  }
  if (variantsStart !== -1) {
    const section = lines.slice(variantsStart + 1);
    let current = null;
    const flush = () => {
      if (!current) return;
      // only the FIRST subject bullet is renderer metadata — a body line that
      // happens to start with "- subject: " must survive into the body
      const si = current.lines.findIndex((l) => l.startsWith("- subject: "));
      const rest = si === -1 ? current.lines : current.lines.filter((_, i) => i !== si);
      tpl.variants.push({
        name: current.name,
        subject: si === -1 ? null : current.lines[si].slice("- subject: ".length),
        body: bodyText(rest).text,
      });
    };
    for (const l of section) {
      const h = /^### (.*)$/.exec(l);
      if (h) {
        flush();
        current = { name: h[1], lines: [] };
      } else if (current) current.lines.push(l);
    }
    flush();
  }

  return { tpl, parseErrors };
}

// ── ER-3: shared output plumbing ─────────────────────────────────────────────

// Markdown-table cell: pipes and newlines would break the table grid.
export const mdCell = (v) =>
  (v == null ? "" : String(v)).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

export function mdTable(headers, rows) {
  const line = (cells) => `| ${cells.map(mdCell).join(" | ")} |`;
  return [line(headers), `|${headers.map(() => "---").join("|")}|`, ...rows.map(line)].join("\n");
}

// Uniform report document (contract C2 conventions). Modes supply sections
// (markdown strings) and caveats; the header, the mandatory "Caveats & data
// gaps" section, and the re-run footer are centralized here so no mode can
// forget them. Header wording is deliberately NOT frozen — tune freely.
export function renderReport({
  mode,
  // Report H1; the JO wording stays the default for the four JO modes.
  // tenant-deps.mjs (ER-11) passes its own — its scope is not JO.
  title = `JO report — ${mode}`,
  slug,
  baseUrl = "unknown",
  environment = "unknown",
  generatedAt = nowIso(),
  argsLine = "",
  freshness = "unknown",
  sections = [],
  caveats = [],
  rerun = "",
}) {
  const out = [
    `# ${title}`,
    "",
    `- tenant: ${slug} (${baseUrl}, ${environment})`,
    `- generated: ${generatedAt}`,
    `- mode: ${mode}${argsLine ? ` · args: ${argsLine}` : ""}`,
    `- freshness: ${freshness}`,
    "",
    ...sections.flatMap((s) => [s, ""]),
    "## Caveats & data gaps",
    "",
    ...(caveats.length ? caveats.map((c) => `- ${c}`) : ["_none identified this run_"]),
    "",
  ];
  if (rerun) out.push("---", "", `Re-run: \`${rerun}\``, "");
  return out.join("\n");
}

// Freshness line for the report header, computed from a C1 index. The live
// wording uses the sweep files' capture time (index.liveSweepAt, the newest
// live-list file mtime) — NOT the index build time, which could be days after
// the sweep and would overstate freshness.
export function freshnessLine(index) {
  const programs = Object.values(index?.programs ?? {});
  const lvs = programs.map((p) => p.lastVerified).filter(Boolean).sort();
  const live = programs.some((p) => p.statusSource === "live");
  const range = lvs.length ? `${lvs[0].slice(0, 10)} → ${lvs[lvs.length - 1].slice(0, 10)}` : "unknown";
  const liveAt = index?.liveSweepAt ?? index?.generatedAt;
  return `statuses ${live ? `live as of ${liveAt}` : "KB-cached"}; KB last_verified ${range}`;
}

// RFC-4180 CSV. Quoting is triggered by comma/quote/CR/LF as the RFC
// requires, plus pipe and edge whitespace (harmless to quote, and Gainsight
// names are full of pipes — quoting keeps them visibly one field).
export function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\r\n|]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers, rows) {
  // The leading U+FEFF is a deliberate UTF-8 BOM, same spirit as the RFC-4180
  // CRLF above (F-124): Excel-on-Windows decodes BOM-less CSV as ANSI, so
  // non-ASCII tenant text (names, snippets) would render as mojibake and then
  // be frozen into XLSX by the report skills. Tenant text stays verbatim — the
  // BOM is what makes it decode correctly; plugin-authored labels and
  // placeholders in CSV-destined cells are pure ASCII, while meaningful
  // glyphs in free-text detail (the deps reports' direction arrows) stay
  // deliberately (the F-087 convention as rescoped by F-124 Correction +
  // F-146).
  return "\uFEFF" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// Display form of a C1 docPath for "- KB doc:" report lines: the full
// absolute path when it actually exists from the current cwd (directly
// openable — Bradley, S5-V wording review), otherwise the stored
// workspace-relative path unchanged. docPath is recorded slug-relative, so a
// bare resolve() from any other cwd would confidently point at a nonexistent
// file; falling back keeps the line honest.
export function kbDocDisplayPath(docPath) {
  if (!docPath) return docPath;
  const abs = resolve(docPath);
  return existsSync(abs) ? abs : docPath;
}

// Report path `<dir>/<mode>-<YYYY-MM-DD>.md` (UTC date), suffixed -2/-3/…
// instead of ever overwriting an existing report.
export function reportPath(dir, mode, date = nowIso().slice(0, 10)) {
  let p = resolve(dir, `${mode}-${date}.md`);
  for (let n = 2; existsSync(p); n++) p = resolve(dir, `${mode}-${date}-${n}.md`);
  return p;
}

// Mode summary JSON (contract C2): the ONLY stdout of a mode run. Extra keys
// are allowed (not frozen); the base keys are always present (an explicitly-
// undefined ok/counts/… from the caller still gets its default, so
// JSON.stringify can never drop a contract key).
export function emitSummary(summary) {
  const { ok = true, mode, counts = {}, caveatCount = 0, warnings = [], ...extra } = summary;
  const out = { ok: ok ?? true, mode, ...extra, counts: counts ?? {}, caveatCount: caveatCount ?? 0, warnings: warnings ?? [] };
  console.log(JSON.stringify(out, null, 2));
  return out;
}

// ── shared mode helpers (used by ./jo-report-<mode>.mjs modules) ─────────────

// The mode modules' ONE tail (F-362). Every ./jo-report-<mode>.mjs ends the
// same way: assemble the Re-run line, push the POSIX-quote caveat when any
// emitted text carries the bash apostrophe escape, render and write the
// report, prepare the CSV directory. Until this function existed each mode
// carried a hand copy of those ~25 lines and they had already drifted: two
// scanned only the rerun line for the caveat, two scanned the sections and
// caveats too. The wider scan is the caveat's own definition ("detection on
// the EMITTED text", doc-lib F-123) and is what every mode does now. The
// mode writes its own CSVs into the returned csvDir (null unless --csv-dir
// was passed). `write: false` (program mode with nothing resolved) still
// assembles the rerun and pushes the caveat — the summary's caveatCount is
// unchanged — but writes nothing, creates no directory, and returns nulls.
/**
 * @param {{ mode: string, flags: Record<string, any>, modeArgs: string[], sections: string[], caveats: string[], warnings?: string[], index: any, write?: boolean }} p
 * @returns {{ outPath: string | null, csvDir: string | null }}
 */
export function writeModeReport({ mode, flags, modeArgs, sections, caveats, warnings = [], index, write = true }) {
  const rerun = [
    "node",
    shq(process.argv[1] ?? "jo-report.mjs"),
    mode,
    `--index ${shq(flags.index)}`,
    ...modeArgs,
    `--report ${shq(flags.report)}`,
    flags["csv-dir"] ? `--csv-dir ${shq(flags["csv-dir"])}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  // One caveat when any emitted hint carries the bash apostrophe escape —
  // detection on the emitted text (doc-lib, F-123): the rerun line, hints
  // embedded in sections, hints already inside caveats
  if (needsPosixQuoteCaveat(rerun, sections.join("\n"), caveats.join("\n"))) caveats.push(POSIX_QUOTE_CAVEAT);
  // Run-level warnings LEAD the caveats (F-429 second pass, consumer-parity —
  // the same fold tenant-deps makes): the mode's own `warnings` (a duplicate
  // term dropped, a --name that matched several programs, an --alias-prefix
  // with nothing to apply to) and the INDEX BUILD's warnings (a lane read from
  // a non-default folder, two domains recording one list, a missing folder, a
  // live overlay skipped) used to reach the stdout summary only — the index
  // step's, days before the report was written. Folded here, once, for every
  // mode, so the markdown report and the <mode>-caveats.csv carry them; the
  // summary keeps `warnings` as the run-level view and caveatCount counts
  // everything. An index written before the build recorded its warnings
  // (no `warnings` field) contributes nothing, honestly. A warning a caveat
  // already restates verbatim (the alias convention note, which
  // aliasFieldCaveats carries for both deps surfaces) is not doubled.
  const lead = [...warnings, ...(Array.isArray(index?.warnings) ? index.warnings.map((w) => `index build: ${w}`) : [])];
  caveats.unshift(...lead.filter((w) => !caveats.includes(w)));
  if (!write) return { outPath: null, csvDir: null };

  const md = renderReport({
    mode,
    slug: index.slug,
    baseUrl: index.baseUrl,
    environment: index.environment,
    generatedAt: nowIso(),
    argsLine: modeArgs.join(" "),
    freshness: freshnessLine(index),
    sections,
    caveats,
    rerun,
  });
  mkdirSync(resolve(flags.report), { recursive: true });
  const outPath = reportPath(flags.report, mode);
  writeFileSync(outPath, md, "utf8");

  let csvDir = null;
  if (flags["csv-dir"]) {
    csvDir = resolve(flags["csv-dir"]);
    mkdirSync(csvDir, { recursive: true });
    // F-397 (consumer-parity with tenant-deps-caveats.csv, F-388): the honesty
    // caveats ride the CSV/XLSX surface of EVERY mode by construction — written
    // here, once, so no mode carries its own copy of the two-line write and the
    // workbook reader sees the same "Caveats & data gaps" the markdown carries.
    // One column, one row per caveat, header-only when there are none (the
    // tenant-deps shape), so the file's presence is unconditional and the mode
    // suites' set-locks pin it; test/jo-report.mjs pins its rows to this array.
    writeFileSync(join(csvDir, `${mode}-caveats.csv`), toCsv(["caveat"], caveats.map((c) => [c])), "utf8");
  }
  return { outPath, csvDir };
}

// The confirmed cross-mode definition of "active" (S1 discovery, 2026-07-12):
// PROCESSING only; PAUSE joins via --include-paused. One predicate so modes
// can never disagree on scope.
export const ACTIVE_STATUSES = ["PROCESSING"];
export function isActive(program, { includePaused = false } = {}) {
  return ACTIVE_STATUSES.includes(program?.status) || (includePaused && program?.status === "PAUSE");
}

// ── ER-15: shared token resolution (the ONE resolver — every renderer that
//    emits template text calls these; mode modules never re-implement) ────────

// The ONE home of the token-id grammar: optional variety prefix (`subj::`,
// `embd::`, …) + optional `gs-` + rest. Token ids appear both with and
// without the `gs-` prefix (`subj::gs-X` vs `subj::X`, bare `gs-X` vs `X`) —
// key matching here and text locating in deps --scan-tokens must agree on
// that fact, so both build on these two helpers (jo-report-deps.mjs imports
// them; never re-encode the grammar).
const TOKEN_KEY_RE = /^([A-Za-z]+::)?(gs-)?(.+)$/;
// Canonical form for comparisons/dedup: the `gs-` dropped, prefix kept.
export function canonicalTokenKey(key) {
  const m = TOKEN_KEY_RE.exec(String(key).trim());
  return m ? `${m[1] ?? ""}${m[3]}` : String(key).trim();
}
// Every spelling a key can take in text (with and without `gs-`).
export function tokenKeyVariants(key) {
  const k = String(key).trim();
  const m = TOKEN_KEY_RE.exec(k);
  if (!m) return [k];
  const pre = m[1] ?? "";
  return [...new Set([k, `${pre}${m[3]}`, `${pre}gs-${m[3]}`])];
}
function tokenByKey(tokens, key) {
  if (!Array.isArray(tokens)) return null;
  const k = String(key).trim();
  const exact = tokens.find((t) => t && typeof t === "object" && t.tokenKey === k);
  if (exact) return exact;
  const nk = canonicalTokenKey(k);
  return tokens.find((t) => t && typeof t === "object" && t.tokenKey != null && canonicalTokenKey(t.tokenKey) === nk) ?? null;
}

// One ${...} token key → its display form, or null when unresolvable (the
// caller keeps the raw text — a visible artifact beats an invented label).
// Ruled ladder (P-2, 2026-07-16): program binding wins over the template's
// author label; SURVEY → {Survey: <name>}; unsubscribeText → {unsubscribe
// link}; ${%us}/${%s} system placeholders stay as-is; anything else → raw.
// stepTokens = C1 step tokens[] (program bindings), templateTokens = C1
// template tokens[] (author labels) — pass whichever the surface can reach.
export function resolveTokenKey(key, { stepTokens = null, templateTokens = null } = {}) {
  const k = String(key).trim();
  if (k.startsWith("%")) return null; // system placeholder — leave as-is
  if (k === "unsubscribeText") return "{unsubscribe link}";
  for (const tokens of [stepTokens, templateTokens]) {
    const t = tokenByKey(tokens, k);
    if (!t) continue;
    if (t.kind === "survey" || String(t.tokenType ?? "").toUpperCase() === "SURVEY") {
      const name = t.survey?.surveyName;
      if (name) return `{Survey: ${name}}`;
      continue; // unnamed survey — try the other source, else stay raw
    }
    // a program-side LITERAL binding pins the token to a fixed value — the
    // template author's field-style label would misrepresent it as a
    // per-recipient substitution, so the raw id (a visible artifact) wins
    if (tokens === stepTokens && t.kind === "literal") return null;
    const label = t.label ?? t.displayName;
    if (label) return `{${label}}`;
  }
  return null;
}

// Rendered form of a text (the .text of resolveTokensInText) — the one thin
// wrapper both mode renderers use; null/undefined pass through untouched.
export const renderTokens = (text, ctx) => resolveTokensInText(text, ctx).text;

// The step's bound surveys (C1 boundAssets, SURVEY entries — ER-17). One
// read-side accessor for every renderer; future asset types get their own.
export const stepSurveys = (step) => (step?.boundAssets ?? []).filter((a) => a?.type === "SURVEY");

// Replace every resolvable ${...} token in a text with its {Label} form.
// Unresolvable tokens (and [image::…]/[cid:…] refs, which are not ${}-shaped
// and have no metadata) stay verbatim.
export function resolveTokensInText(text, ctx = {}) {
  if (typeof text !== "string" || !text.includes("${")) return { text, resolved: 0, unresolved: 0 };
  let resolved = 0;
  let unresolved = 0;
  const out = text.replace(/\$\{([^}]+)\}/g, (raw, inner) => {
    const r = resolveTokenKey(inner, ctx);
    if (r == null) {
      if (!inner.trim().startsWith("%")) unresolved++;
      return raw;
    }
    resolved++;
    return r;
  });
  return { text: out, resolved, unresolved };
}

// Backfill honesty (ER-15 ruling): template docs written before token
// persistence carry no "## Tokens" section (tokens === null) — template-side
// labels are unavailable until the doc is re-described via gap-fill.
export function tokenlessTemplateCount(index, templateIds = null) {
  const all = Object.values(index?.templates ?? {}).filter((t) => t && typeof t === "object" && t.tokens == null);
  return templateIds == null ? all.length : all.filter((t) => templateIds.has(t.id)).length;
}
// templateIds (a Set) scopes the count to the templates a run actually
// touched (program mode); omitted = index-wide (search).
export function tokenMetadataCaveat(index, templateIds = null) {
  const n = tokenlessTemplateCount(index, templateIds);
  return n
    ? `${n} template doc(s) predate token metadata (no "## Tokens" section) — template-side token labels are unavailable ` +
        `for them (program-side bindings still resolve where a program is in context). Backfill via the skill's ` +
        `gap-fill flow (mark the docs stale → describe-batch re-fetches them).`
    : null;
}

// One loader for the C1 index (it can run to ~100 MB on a real KB) so every
// mode shares the same error path instead of four hand-rolled JSON.parse's.
export function loadIndex(path) {
  let raw;
  try {
    raw = readFileSync(resolve(path), "utf8");
  } catch (e) {
    throw new Error(`index ${path} unreadable (${e.message}) — run \`jo-report.mjs index\` first`);
  }
  try {
    return JSON.parse(stripBom(raw)); // shared strip (doc-lib) — the old inline regex spelled the BOM as a raw codepoint (F-130)
  } catch (e) {
    throw new Error(`index ${path} is not valid JSON (${e.message}) — re-run \`jo-report.mjs index\``);
  }
}

// ── ER-2: index subcommand ───────────────────────────────────────────────────

// Entries from one captured `gs-admin --json jo p list` page. The live page
// shape is unverified offline (see VALIDATION.md): accept a top-level array,
// data as an array, or any array directly under data. An entry must carry an
// id AND a name or status — bare-id objects in sibling arrays (errors, page
// info) must not become phantom programs.
function liveEntriesFrom(payload) {
  const arrays = [];
  if (Array.isArray(payload)) arrays.push(payload);
  else if (payload && typeof payload === "object") {
    if (Array.isArray(payload.data)) arrays.push(payload.data);
    else if (payload.data && typeof payload.data === "object")
      for (const v of Object.values(payload.data)) if (Array.isArray(v)) arrays.push(v);
  }
  const out = [];
  for (const arr of arrays)
    for (const e of arr) {
      if (!e || typeof e !== "object") continue;
      const id = e.advancedOutreachId ?? e.programId ?? e.id;
      // Each spelling resolved on its own (an empty first spelling must never
      // hide a filled second one). The name VALUE follows realName — "" is no
      // name — but the admission EVIDENCE is the key's presence: a row that
      // spells a name key at all is a program record, empty or not, exactly
      // as it was admitted before "" became null (review round, W8); only a
      // row with neither a name key nor a status is a bare-id sibling object.
      const name = realName(e.advancedOutreachName) ?? realName(e.name) ?? null;
      const named = e.advancedOutreachName != null || e.name != null;
      const status = firstOf(e.advancedOutreachStatus) ?? firstOf(e.status);
      if (id == null || (!named && status == null)) continue;
      out.push({ id: String(id), name, status });
    }
  return out;
}

// Build the C1 index from a KB dir. Exported for tests; the CLI entry point
// wraps it with flag parsing and file output.
export function buildIndex({ kbDir, liveListFiles = [] }) {
  const warnings = [];
  const parseErrors = [];

  // slug/baseUrl/environment from the KB manifest; fall back to the dir name
  // (requirement confirmed S1, 2026-07-12). ONE copy for both deps surfaces
  // (doc-lib readKbIdentity — GP-B5 W10, F-361: this and tenant-deps' had
  // drifted by a word and by the inventory guard).
  const { slug, baseUrl, environment, inventory } = readKbIdentity(kbDir, warnings);

  const programs = {};
  const joDomains = resolveJoDirs(kbDir, inventory, warnings);
  const joDirs = joDomains.dirs;
  const journeyFiles = listMdFiles(join(kbDir, joDirs.journey));
  if (journeyFiles == null) warnings.push(`no ${joDirs.journey}/ dir under ${kbDir}`);
  for (const file of journeyFiles ?? []) {
    const docPath = `${slug}/${joDirs.journey}/${basename(file)}`;
    let res;
    try {
      res = parseJourneyDoc(readFileSync(file, "utf8"), docPath);
    } catch (e) {
      parseErrors.push({ docPath, id: null, errors: [`unreadable: ${e.message}`] });
      continue;
    }
    const { entry, parseErrors: errs } = res;
    if (errs.length) parseErrors.push({ docPath, id: entry.id, errors: errs });
    if (entry.id == null) {
      parseErrors.push({ docPath, id: null, errors: ["no program id (bullet and payload both missing)"] });
      continue;
    }
    entry.lastVerified = inventory[`journey/${entry.id}`]?.last_verified ?? null;
    if (programs[entry.id]) warnings.push(`duplicate program id ${entry.id} (${docPath} overwrote ${programs[entry.id].docPath})`);
    programs[entry.id] = entry;
  }

  const templates = {};
  const templateFiles = listMdFiles(join(kbDir, joDirs.templates));
  if (templateFiles == null) warnings.push(`no ${joDirs.templates}/ dir under ${kbDir}`);
  for (const file of templateFiles ?? []) {
    const docPath = `${slug}/${joDirs.templates}/${basename(file)}`;
    let res;
    try {
      res = parseTemplateDoc(readFileSync(file, "utf8"), docPath);
    } catch (e) {
      parseErrors.push({ docPath, id: null, errors: [`unreadable: ${e.message}`] });
      continue;
    }
    const { tpl, parseErrors: errs } = res;
    if (errs.length) parseErrors.push({ docPath, id: tpl.id, errors: errs });
    if (tpl.id == null) continue;
    if (templates[tpl.id]) warnings.push(`duplicate template id ${tpl.id} (${docPath} overwrote ${templates[tpl.id].docPath})`);
    templates[tpl.id] = tpl;
  }

  // Live-status overlay (optional — the KB-only index must work offline).
  const liveById = new Map();
  let liveSweepAt = null;
  for (const file of liveListFiles) {
    let entries = [];
    try {
      entries = liveEntriesFrom(JSON.parse(normalizeText(readFileSync(file, "utf8"))));
      // the sweep's freshness is when the pages were CAPTURED (file mtime),
      // not when this index was built
      const mtime = statSync(file).mtime.toISOString();
      if (liveSweepAt == null || mtime > liveSweepAt) liveSweepAt = mtime;
    } catch (e) {
      warnings.push(`live-list ${file}: unreadable (${e.message})`);
      continue;
    }
    if (!entries.length) warnings.push(`live-list ${file}: no program entries recognized`);
    for (const e of entries) liveById.set(e.id, e);
  }
  const liveOnly = [];
  const kbOnly = [];
  const statusDrift = [];
  if (liveListFiles.length && liveById.size === 0) {
    // a sweep that parsed to nothing is a capture-format failure, not a
    // KB/live divergence — refusing to reconcile prevents kbOnly flooding
    // with every program while the run still reports ok
    warnings.push(`live-list: ${liveListFiles.length} file(s) yielded zero program entries — overlay skipped (verify the captured page shape; see VALIDATION.md ER-2)`);
    liveSweepAt = null;
  } else if (liveListFiles.length) {
    for (const [id, live] of liveById) {
      const p = programs[id];
      if (!p) {
        liveOnly.push({ id, name: live.name, status: live.status });
        continue;
      }
      if (live.status != null && p.status != null && live.status !== p.status)
        statusDrift.push({ id, name: p.name, kbStatus: p.status, liveStatus: live.status });
      if (live.status != null) {
        p.status = live.status;
        p.statusSource = "live";
      }
    }
    for (const p of Object.values(programs))
      if (!liveById.has(p.id)) kbOnly.push({ id: p.id, name: p.name, status: p.status });
  }

  // Cross-links: union of step emailTemplateIds and variant-mapped ids.
  const templateToPrograms = {};
  const programToTemplates = {};
  for (const p of Object.values(programs)) {
    const tplIds = new Set();
    for (const s of p.steps) {
      if (s.emailTemplateId) tplIds.add(s.emailTemplateId);
      for (const v of s.variantTemplateIds) tplIds.add(v);
    }
    if (tplIds.size) programToTemplates[p.id] = [...tplIds].sort();
    for (const t of tplIds) (templateToPrograms[t] ??= []).push(p.id);
  }
  for (const t of Object.keys(templateToPrograms)) templateToPrograms[t].sort();

  const referencedTemplatesMissing = Object.keys(templateToPrograms)
    .filter((t) => !templates[t])
    .sort();
  const stubs = Object.values(programs)
    .filter((p) => p.depth === "stub")
    .map((p) => p.id)
    .sort();

  const index = {
    generatedAt: nowIso(),
    liveSweepAt,
    slug,
    baseUrl,
    environment,
    programs,
    templates,
    links: { templateToPrograms, programToTemplates },
    gaps: { referencedTemplatesMissing, stubs, liveOnly, kbOnly, statusDrift },
    parseErrors,
    // C1 + F-429 second pass: which folders the build read and why, and the
    // build's own warnings — the report modes read the index, never the KB,
    // so this is the only way what the build saw reaches their caveats.
    domains: joDomains,
    warnings,
  };
  return { index, warnings };
}

function runIndex(argv) {
  const flags = parseFlags(argv, { repeatable: ["live-list"] });
  if (!flags.kb || !flags.out) fail("usage: jo-report.mjs index --kb <slugDir> [--live-list <file>]... --out <index.json>");
  const { index, warnings } = buildIndex({ kbDir: flags.kb, liveListFiles: flags["live-list"] ?? [] });

  // Compact on purpose: a machine artifact modes JSON.parse — a real KB can
  // yield an index in the ~100 MB range (drip programs carry hundreds of
  // steps each); pretty-printing would add ~40% for nothing.
  mkdirSync(dirname(resolve(flags.out)), { recursive: true });
  writeFileSync(resolve(flags.out), JSON.stringify(index), "utf8");

  // every gap category is counted AND sampled from one walk, so a future
  // category can never be counted but invisible in the stdout summary
  const short = (arr) => arr.slice(0, 10);
  const gapCounts = {};
  const gapsSample = {};
  for (const [k, v] of Object.entries(index.gaps)) {
    gapCounts[k] = v.length;
    gapsSample[k] = short(v);
  }
  emitSummary({
    ok: true,
    mode: "index",
    out: flags.out,
    counts: {
      programs: Object.keys(index.programs).length,
      templates: Object.keys(index.templates).length,
      programsWithTemplateLinks: Object.keys(index.links.programToTemplates).length,
      referencedTemplates: Object.keys(index.links.templateToPrograms).length,
      ...gapCounts,
      statusLive: Object.values(index.programs).filter((p) => p.statusSource === "live").length,
      parseErrors: index.parseErrors.length,
    },
    gapsSample,
    parseErrorsSample: short(index.parseErrors),
    warnings,
  });
}

// ── dispatcher (contract C3) ─────────────────────────────────────────────────

const REPORT_MODES = new Set(["search", "program", "audit-active", "deps"]);
const USAGE = "usage: jo-report.mjs <index|search|program|audit-active|deps> [flags]";

// Exported so jo-report's MODE MODULES (jo-report-<mode>.mjs, dispatched
// through this file) share the same error-exit convention — the prefix names
// jo-report.mjs because in that lane it IS the script the operator invoked.
// A SEPARATELY-INVOKED script must never borrow this instance: it mints its
// own via makeCliHelpers("<its-name>", argv) — doc-lib owns the single
// implementation, the name is a parameter — or its diagnostics blame a
// script the operator never ran (F-306: tenant-deps.mjs refusals announced
// themselves as jo-report.mjs).
// Accepted trade (F-136, WONTFIX — premise corrected at W10/F-360): on a
// Windows TTY stderr is asynchronous, so an interactive terminal run can exit
// before this message flushes — exit code 1 with no text. The original note
// said pipes are synchronous, so the tool-driven lane always sees the message;
// F-356 then MEASURED a macOS pipe dropping everything past the first ~8 KB
// chunk on a synchronous exit. What actually keeps this trade sound: a fail()
// message is ONE short stderr line, always inside the first chunk. Anything
// larger — a stdout SUMMARY — is the F-360 class and rides makeCliHelpers'
// finish() (exit in the write callback) or process.exitCode; never this path.
export const { fail } = makeCliHelpers("jo-report.mjs", process.argv.slice(2));

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "index") return runIndex(rest);
  if (REPORT_MODES.has(mode)) {
    let mod;
    try {
      mod = await import(`./jo-report-${mode}.mjs`);
    } catch (e) {
      fail(`mode '${mode}' is defined but its module ./jo-report-${mode}.mjs failed to load (${e.message})`);
    }
    if (typeof mod.run !== "function") fail(`./jo-report-${mode}.mjs does not export run(argv)`);
    return mod.run(rest);
  }
  fail(USAGE);
}

// Importable as a library (tests, mode modules); runs main only when executed.
// isMainModule (doc-lib, F-117), not a bare href compare: argv[1] through a
// junction/symlink otherwise never equals the realpath'd import.meta.url and
// the CLI exits 0 having produced nothing.
if (isMainModule(import.meta.url)) {
  main().catch((e) => fail(e?.stack ?? String(e)));
}
