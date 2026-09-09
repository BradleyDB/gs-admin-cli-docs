// ─────────────────────────────────────────────────────────────────────────────
// doc-lib.mjs — shared KB-doc rendering + parsing helpers
//
// Shared KB-doc helpers live here because each has multiple consumers that must
// never drift (precedent: journal-lib.mjs, the change journal's shared emitter).
// Two families — the doc WRITERS (filename rule + renderers) and their read-side
// counterparts, the doc PARSING PRIMITIVES — import either, never re-implement:
//
// - docBaseName(): the doc-filename rule for an asset id, imported by every
//   writer of KB doc files (manifest.mjs `stub`, describe-batch.mjs,
//   template-doc.mjs). Sanitized ids get a short raw-id hash so distinct ids
//   that clean to the same base ("t 1" vs "t_1") can never collide, even
//   across separate runs; ids that are already clean (the normal case) keep
//   their plain name.
// - canonicalFingerprint(): the content fingerprint of a parsed describe
//   payload (volatile modified/updated keys dropped, keys sorted, sha1) —
//   computed by describe-batch.mjs on every documented mark and compared by
//   its --if-changed gate, so a platform event that bumps modifiedDate en
//   masse doesn't trigger a mass re-document of unchanged assets.
// - renderTemplateDoc(): the compact email-template doc (metadata + the
//   plain-text body; the ~50 KB entity-escaped HTML rendering is dropped and
//   stays re-fetchable from the tenant by id). Imported by template-doc.mjs
//   (standalone, for one-off payloads such as UI-export id recovery) and by
//   describe-batch.mjs's template doc-mode (bulk runs), so the two paths write
//   identical docs for the same payload.
// - STUB_MARKER / STUB_MARKER_RE + escapeRe(): the stub-doc marker contract
//   (T-3) and the regex-literal escape — single copies; writers/detectors and
//   regex builders import them, never re-spell (see the sections below).
// - normalizeText() / extractFencedJson() / topBullets() / listMdFiles(): the
//   read-side primitives that turn KB markdown back into data — BOM/CRLF
//   normalization, the first ```json fence body, the top `- key:` metadata
//   bullets, and a directory's sorted .md paths. Imported by jo-report.mjs's
//   index build so fence-scanning and BOM handling have exactly one
//   implementation each (see the section at the foot of this file for the
//   caller-normalizes contract).
// - parseDocJson() / docMeta() + NO_NAME / docH1(): the SEMANTIC layer over
//   those primitives (GP-B5 DS-24) — the null-signal fence→payload guard and
//   the T-3 KbDocMeta resolution with its name sentinel and H1 fallback.
//   Imported by tenant-deps.mjs, relationships-build.mjs, and
//   jo-report-deps.mjs (whose docJsonBody composes the envelope unwrap on
//   top); a new KB-doc reader starts HERE, not at the raw primitives —
//   check-doc-drift check 9 sweeps for regrown copies.
// - renderProgramDoc(): the compact journey-program doc (same two consumers:
//   program-doc.mjs standalone, describe-batch.mjs's program doc-mode). A
//   `jo p describe --id` payload runs ~287 KB/program, dominated by flow-canvas
//   geometry in the step JSON (node coordinates, transforms, selection/UI
//   state) that carries no admin semantics. The compactor keeps the semantic
//   skeleton — node types/names, branch conditions, participant source
//   (any subtree under a PowerList-named key is preserved VERBATIM —
//   relationships-build and Phase 6 prose synthesis parse it), email-template
//   GSID references, timers/waits — and drops ONLY the geometry/UI keys in
//   PROGRAM_GEOMETRY_KEYS below, everywhere in the payload. Unknown keys are
//   always KEPT (fail-open to keeping data); embedded JSON strings (keys
//   ending in "json", e.g. stepJson) are parsed so their geometry can be
//   stripped too, and land in the doc as parsed objects. The full payload
//   stays re-fetchable from the tenant by id (stated in the doc header, like
//   template docs).
//
// ── Program payload shape — 1.0.4-scoped assumptions ───────────────────────
// The `jo p describe` payload is UNDOCUMENTED CLI internals (same rationale as
// relationships-build.mjs's `_flatMappings` note). Observed on CLI v1.0.4:
// ~287 KB/program dominated by flow-canvas layout inside embedded step JSON.
// The compaction is deliberately conservative about that shape: only the
// enumerated geometry/UI keys are dropped, everything unrecognized is kept, so
// a payload this note mis-describes loses nothing semantic — worst case is a
// bigger doc. Re-verify after any CLI upgrade; if a newer CLI's payload
// disagrees, trust the payload and update this list and its fixtures together.
//
// This file is also the plugin's OS-PORTABILITY LAYER (wave-2 of the
// portability plan): every rule that exists because operating systems disagree
// — shell quoting, BOM tolerance, filename legality, case folding, locale
// pinning, surrogate-safe truncation, launcher suffixes, rename retries,
// reparse-point visibility — lives here as one named, exported function, and
// consumers import it rather than re-encoding the rule (the point-fix version
// is rejected in review; see the "portability primitives" section at the foot
// of this file).
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────

// ── T-3 · KB docs (read-side authority) ──────────────────────────────────────
/**
 * FROZEN (B5 P1, 2026-08-16; scheduled amendment A1 executed W2/B3,
 * 2026-08-16 — the stub-marker sync sentence now points at the exported
 * constant below; v4 B11, 2026-09-01 — envelope-rule homes cited by SYMBOL
 * and enumerated COMPLETE against the tree, reader roster names the DS-24
 * semantic layer; found by the DS-24/DS-25 review rounds, Bradley-approved
 * in-session; v5 B13, 2026-09-02 — the raw-describe family gains the designer
 * COMPOSITE variant and its writer/reader move here, Bradley-approved at the
 * W9 design checkpoint).
 * The four KB doc formats and the one read contract. Writers: renderTemplateDoc /
 * renderProgramDoc / renderRawDescribeDoc / renderDesignerDoc (this file —
 * describe-batch drives all four; the designer composite is the raw describe
 * doc for data-designer with ONE plugin-owned key, `_kb`, holding each task's
 * `--task-id` drilldown and each field's `--field` detail verbatim plus the
 * per-item outcome — KbDesignerComposite below; designerDocProgress is its
 * resume reader), manifest.mjs stub verb (metadata stubs). Readers: tenant-deps and
 * relationships-build (via the DS-24 semantic layer parseDocJson + docMeta;
 * tenant-deps' extractDesignerUsages additionally reads `_kb`);
 * jo-report-deps (parseDocJson, wrapped by its own docJsonBody — its KbDocMeta
 * resolution is its own docH1 / topBullets / NO_NAME composition); and
 * jo-report, the sanctioned RAW consumer (extractFencedJson / topBullets /
 * listMdFiles directly, so fence errors survive as parseErrors — see the
 * portability enumeration below). All of them over the primitives
 * normalizeText / extractFencedJson / topBullets / listMdFiles below.
 *
 * Common shape, all four formats:  `# <name>` H1 · blockquote provenance line ·
 * `- key: <domain>/<id>` (+ `- id:` / `- name:` where known) · one json
 * code-fenced payload block. (v5: this line no longer STARTS with a fence
 * marker — inside a JSDoc comment that opened a code block and hid every
 * typedef below it from the checkJs gate since the freeze.)
 *
 * @typedef {object} KbDocMeta         topBullets + H1-fallback resolution
 * @property {?string} id
 * @property {?string} name            "(none recorded)" sentinel resolves to H1
 *
 * String contract (cross-file — manifest.mjs stub writer ↔ jo-report.mjs
 * parseJourneyDoc): a doc whose pre-fence text carries the stub marker AT
 * THE START OF A LINE is a STUB — its fence holds a raw list item, not a
 * describe payload. Single
 * source: STUB_MARKER / STUB_MARKER_RE exported below (scheduled amendment
 * A1, executed W2/DS-13 2026-08-16) — both sites consume the exports, and
 * the marker VALUE is pinned by fixture for docs written by older versions.
 * @typedef {"stub"|"full"} KbDocDepth
 *
 * Designer composite (v5, GP-B5 W9): a data-designer raw describe doc whose
 * unwrapped body carries `_kb`. Everything else in the body is the CLI's own
 * template describe, byte-verbatim; a body WITHOUT `_kb` is a summary-only
 * doc and reads exactly as before (task rows field-blind). Producer:
 * describe-batch's designer doc-mode through renderDesignerDoc; readers:
 * designerDocProgress (resume) and tenant-deps' extractDesignerUsages. A task
 * absent from taskDetails, or a field absent from fieldDetails, is
 * summary-only for THAT item — honesty is per item, never per doc.
 * @typedef {object} KbDesignerComposite
 * @property {1}      version
 * @property {string} templateFingerprint   canonicalFingerprint of the template
 *                                          payload the drilldowns belong to
 * @property {string} capturedAt            ISO
 * @property {{task: string, field: string}} flags  the drilldown flag spellings
 *                                          used (catalog-verified at run time)
 * @property {Object<string, {status: "pending"|"ok"|"failed", error?: string,
 *             fieldListUnparsed?: string}>} tasks   keyed taskId ("pending" =
 *                                          the invocation's spawn budget ran out
 *                                          before this item — resumes next run)
 * @property {Object<string, Object<string, {status: "pending"|"ok"|"failed",
 *             error?: string, suffix?: string, duplicates?: number,
 *             permanent?: true, spelling?: string,
 *             source: "show"|"join"|"union"}>>} fields   keyed taskId, then the
 *                                          SUFFIX-STRIPPED label; `duplicates`
 *                                          counts FURTHER rows with the same
 *                                          label (case-insensitive) on the task —
 *                                          `--field` resolves the first match, so
 *                                          one detail serves the first row only;
 *                                          `spelling` = the label spelling the CLI
 *                                          resolved (stripped or full); `permanent`
 *                                          = the CLI refused EVERY spelling with
 *                                          its not-found sentence — a recorded gap
 *                                          that never blocks the entry and is not
 *                                          retried until the template changes
 * @property {Object<string, DesignerTaskDetail>} taskDetails   keyed taskId — the
 *                                          drilldown's `_task*` tables verbatim
 * @property {Object<string, Object<string, Array<{_key: string, _value: string}>>>} fieldDetails
 *                                          keyed taskId, then label — the
 *                                          `_taskFieldDetail` rows verbatim
 *
 * Envelope rule: describe payloads may wrap the asset in { data: {...} } —
 * unwrap exactly one level, object-shaped only. Read-side homes, complete as
 * of v5 (every production spelling in the tree at 2026-09-02): describe-batch's
 * `unwrapOnce` helper (ONE spelling serving its doc writer and the designer
 * resume reader), jo-report's parseJourneyDoc and jo-report-deps'
 * docJsonBody (all three array-guarded, falling back to the payload), and
 * tenant-deps' extractors: extractRuleUsages / extractReportUsages
 * (object-only, no array guard, falling back to {} — they REQUIRE the
 * envelope), extractDesignerUsages (array-guarded, falling back to the payload
 * — F-342: it indexed the wrapper until B11) and extractExternalAction
 * (array-guarded). Same-file spellings over LIVE payloads, outside this KB
 * rule: jo-report's liveEntriesFrom (a `jo p list` page) and this file's
 * parseLiveDepsAreas (a dm-deps payload). The lock is build/check-doc-drift.mjs
 * check 9's "KB-doc envelope unwrap" row: a FIFTH FILE copying the current
 * spelling goes red; a respelled unwrap, or a second one inside a sanctioned
 * file, is the accepted residual (A-2) — the construction-tier fix (one shared
 * unwrap primitive every extractor calls, which would also have prevented
 * F-342) is the deeper option, deferred. Parse failures return null, never
 * throw — callers must count docs vs parsed and surface the honesty stats
 * (F-228).
 */
import { createHash } from "node:crypto";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  statSync,
  realpathSync,
  existsSync,
  accessSync,
  constants as fsConstants,
} from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Escape a literal string for RegExp() embedding — the single copy (covers
// the metacharacters significant outside a character class; `-` and `/` need
// no escape there). Import, never re-spell the character class.
export const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ── Stub-marker string contract (T-3) — the single source ────────────────────
// Semantics, writer/detector roster, and the pre-fence rule: T-3 header above.
// Both sites import these exports (GP-B5 DS-13) — never re-spell the literal
// in code; a SECOND detector site should hoist an isStubDoc(md) helper here
// rather than re-implementing the pre-fence slice. The VALUE is pinned by
// hand-spelled fixtures (doc-lib-fixtures + contract-conformance's legacy
// doc): stubs written by earlier plugin versions live in user KBs, so
// changing this string is a format break, not a refactor.
export const STUB_MARKER = "> **Metadata-only stub**";
// Detector form — the marker at the start of any line, derived from
// STUB_MARKER so writer and detector cannot diverge.
export const STUB_MARKER_RE = new RegExp("^" + escapeRe(STUB_MARKER), "m");

// Content fingerprint of a PARSED describe payload — the "did this asset really
// change?" primitive behind describe-batch.mjs's --if-changed gate (recorded via
// manifest.mjs mark --fingerprint). Always fingerprint the parsed payload, never
// the rendered doc: doc-modes and renderers change across plugin versions, and a
// renderer tweak must not read as a tenant-side content change. Canonicalization:
// object keys sorted, keys matching the volatile regex below dropped at any
// depth, arrays kept in order; sha1 hex of the canonical JSON. The volatile
// blocklist stays deliberately tight (/modified|updated/i — the timestamp/actor
// fields platform events bump en masse): a false KEEP costs one unnecessary
// re-document (the safe direction); a false DROP silently misses real changes.
const VOLATILE_KEY = /modified|updated/i;
export function canonicalFingerprint(payload) {
  const canon = (node) => {
    if (Array.isArray(node)) return node.map(canon);
    if (!node || typeof node !== "object") return node;
    const out = {};
    for (const k of Object.keys(node).sort()) {
      if (VOLATILE_KEY.test(k)) continue;
      out[k] = canon(node[k]);
    }
    return out;
  };
  return createHash("sha1").update(JSON.stringify(canon(payload))).digest("hex");
}

// Doc filename for an asset id — the single copy; import, never re-implement.
// Beyond the charset whitelist, two Windows filename-legality rules force the
// hash suffix (F-126): reserved DOS device names (NUL/CON/COM1/…, with or
// without an extension — `NUL.md` resolves to the device on the Windows
// versions that still reserve these names, so the payload would be silently
// discarded), and an 80-char cap on the cleaned id (belt-and-braces for
// MAX_PATH; the raw-id hash already guarantees uniqueness after truncation).
// The cleaned id is pure ASCII by construction, so the cap can never split a
// surrogate pair.
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const DOC_BASE_MAX = 80;
export function docBaseName(id) {
  const s = String(id);
  let clean = s.replace(/[^A-Za-z0-9._-]/g, "_");
  const reserved = WINDOWS_RESERVED_NAME.test(clean);
  const truncated = clean.length > DOC_BASE_MAX;
  if (truncated) clean = clean.slice(0, DOC_BASE_MAX);
  return clean === s && !reserved && !truncated
    ? clean
    : `${clean}-${createHash("sha1").update(s).digest("hex").slice(0, 8)}`;
}

// Collision-suffix rule for doc filenames — the single copy (F-156; import,
// never re-implement). Distinct ids can collide as FILENAMES on case-folding
// filesystems ("Company" vs "company" — F-125), so every doc writer must
// suffix on collision, on every OS. Before F-156 the rule was half-shared:
// the manifest stub verb appended "~" (outside docBaseName's charset) while
// the doc writers appended "-dup", each checking only its own in-run Set — so
// a stub pass followed by a deep pass over a colliding pair could orphan a
// stub doc beside a -dup doc. This claimer is keyed on the files ALREADY ON
// DISK as well as in-run claims, and every caller uses the same "-dup"
// suffix, so which id owns which filename is decided once (first writer) and
// respected by every later pass. Ownership on disk is exact-case: a stem
// matching case-insensitively but not exactly belongs to a DIFFERENT id
// (docBaseName preserves case), so the claim moves to the suffixed name; an
// exact match is this id's own earlier doc and is reused (rerun idempotency).
// The disk snapshot is taken lazily at the first claim — before the pass's
// first write — and in-run claims are tracked case-insensitively on top.
// Honest residual (example corrected — F-187): distinct ids whose docBaseName
// output is byte-identical still share a name across separate runs, because the
// filesystem key cannot tell them apart; separating them needs id-level filename
// tracking. Ids that merely CLEAN to the same string are NOT this case:
// docBaseName appends a hash of the RAW id whenever cleaning changed anything
// (F-126), so "a/b" -> "a_b-3ec69c85" while "a_b" -> "a_b". Reaching the residual
// takes one id spelled as another's sanitized+hash output — docBaseName("a/b")
// and docBaseName("a_b-3ec69c85") both return "a_b-3ec69c85" — or an 8-hex sha1
// prefix collision between two clean ids. Narrow, but silent when it lands: the
// exact-case disk match reads the second id's write as the first id's own doc
// and reuses the name.
export function docNameClaimer(dir) {
  const claimedLower = new Set();
  /** @type {Map<string, Set<string>> | null} */
  let disk = null; // lower-cased stem -> Set of exact on-disk stems
  return (id) => {
    if (disk === null) {
      disk = new Map();
      let names = [];
      try {
        names = readdirSync(dir);
      } catch {
        /* dir not created yet — nothing on disk to respect */
      }
      for (const n of names) {
        if (!/\.md$/i.test(n)) continue;
        const stem = n.slice(0, -3);
        const lower = stem.toLowerCase();
        if (!disk.has(lower)) disk.set(lower, new Set());
        // The line above guarantees the key; the cast states that to the
        // strictNullChecks ratchet (Map.get is `| undefined` by signature).
        /** @type {Set<string>} */ (disk.get(lower)).add(stem);
      }
    }
    let base = docBaseName(id);
    for (;;) {
      const spellings = disk.get(base.toLowerCase());
      const foreignOnDisk = spellings != null && !spellings.has(base);
      if (!claimedLower.has(base.toLowerCase()) && !foreignOnDisk) break;
      base += "-dup";
    }
    claimedLower.add(base.toLowerCase());
    return base;
  };
}

// Entity decode (amp last, so &amp;lt; stays a literal `&lt;` only after one pass)
export const decode = (s) =>
  String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

// Strip an HTML rendering down to readable text: decode, drop style/script/head
// blocks and comments, break on block ends, strip tags, decode once more (the
// decoded HTML often carries its own entities), collapse whitespace.
export function htmlToText(html) {
  let s = decode(html);
  s = s.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<\/(p|div|tr|li|h[1-6]|table|br)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decode(s);
  return s.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

function bodyOf(node) {
  const plain = decode(node.plainTextContent ?? "").trim();
  if (plain.length >= 20) return { text: plain, derived: false };
  const html = node.htmlContent ?? node.editorContent ?? "";
  if (!html) return { text: plain, derived: false };
  return { text: htmlToText(html), derived: true };
}

const dateOf = (t, strField, msField) =>
  t[strField] ?? (Number.isFinite(t[msField]) ? new Date(t[msField]).toISOString() : "unknown");

// ── template token metadata (ER-15, C1 v2) ───────────────────────────────────
// C1 v2 template token entries from a describe payload: the CLI-synthesized
// per-variant `_tokens[]` (per the P-2 ruling — never the raw `tokens` map or
// builderMetadata), enriched with survey identity from `tokenMappings`.
// Nesting live-verified 2026-07-25 (sweep tester checklist item 17):
// tokenMappings.<store>.<tokenKey>.surveyToken — one store key ("MDA")
// observed; entries are keyed by the token's own key, and surveyToken carries
// {surveyId, surveyName, …}. The read below is pinned to that two-level shape
// (the store level stays generic in case a non-MDA store ever appears).
// Returns null when the payload carries no token metadata at all (the doc then
// has no "## Tokens" section, which downstream reads as "predates token
// metadata").
export function templateTokens(payload) {
  const t = payload?.data?.emailTemplate;
  const raw = Array.isArray(t?._tokens) ? t._tokens : null;
  const mappings = t?.tokenMappings ?? payload?.data?.tokenMappings ?? null;

  // tokenKey → {surveyId, surveyName}: tokenMappings.<store>.<tokenKey>.surveyToken.
  const surveys = new Map();
  if (mappings && typeof mappings === "object" && !Array.isArray(mappings)) {
    for (const store of Object.values(mappings)) {
      if (!store || typeof store !== "object" || Array.isArray(store)) continue;
      for (const [key, entry] of Object.entries(store)) {
        const st =
          entry && typeof entry === "object" && !Array.isArray(entry) ? entry.surveyToken : null;
        if (st && typeof st === "object" && (st.surveyId != null || st.surveyName != null) && !surveys.has(String(key)))
          surveys.set(String(key), { surveyId: st.surveyId ?? null, surveyName: st.surveyName ?? null });
      }
    }
  }

  if (raw == null && surveys.size === 0) return null;

  // Keep in sync with parseTemplateDoc's "## Tokens" reader (jo-report.mjs):
  // this array IS the C1 v2 template tokens[] shape, written verbatim.
  const out = [];
  for (const e of raw ?? []) {
    if (!e || typeof e !== "object" || e.tokenKey == null) continue;
    const key = String(e.tokenKey);
    out.push({
      tokenKey: key,
      displayName: e.displayName ?? null,
      defaultValue: e.defaultValue ?? null,
      tokenType: e.tokenType ?? null,
      variant: e.variant ?? null,
      survey: surveys.get(key) ?? null,
    });
  }
  for (const [key, survey] of surveys)
    if (!out.some((o) => o.tokenKey === key))
      out.push({ tokenKey: key, displayName: null, defaultValue: null, tokenType: "SURVEY", variant: null, survey });
  return out;
}

// Render one captured `jo email template --id` describe payload into the
// compact doc. Returns { id, doc }; throws when the payload carries no
// data.emailTemplate.templateId. `key` overrides the manifest-key bullet
// (batch runs pass the entry's real key; standalone defaults to the standard
// journey-email-templates/<id>).
/** @param {*} payload  @param {{key?: string}} [opts] */
export function renderTemplateDoc(payload, { key } = {}) {
  const t = payload?.data?.emailTemplate;
  if (!t || t.templateId == null) throw new Error("no data.emailTemplate.templateId in payload");
  const id = String(t.templateId);

  const body = bodyOf(t);
  const variants = Array.isArray(payload.data.variants) ? payload.data.variants : [];
  const tokens = templateTokens(payload);
  const lines = [
    `# ${t.title ?? id}`,
    "",
    `- key: ${key ?? `journey-email-templates/${id}`}`,
    `- subject: ${decode(t.subject ?? "")}`,
    `- folderId: ${t.folderId ?? "unknown"} · active: ${t.active ?? "unknown"} · transactional: ${t.transactional ?? "unknown"}`,
    `- variants: ${t.variantCount ?? variants.length} · builderVersion: ${t.builderVersion ?? "unknown"} · system: ${t.system ?? "unknown"} · published: ${t.published ?? "unknown"}`,
    `- created: ${dateOf(t, "createdDateStr", "createdDate")} by ${t.createdByName ?? "unknown"}`,
    `- modified: ${dateOf(t, "modifiedDateStr", "modifiedDate")} by ${t.modifiedByName ?? "unknown"}`,
    "",
    "> Full HTML body not stored (~50 KB/template) — re-fetch:",
    `> \`gs-admin --json jo email template --id ${id}\``,
    "",
    // ER-15 (C1 v2): token metadata persisted so reports can resolve
    // ${token-id} references to display names. Written ABOVE the body so body
    // text can never shadow the section; absent entirely (not empty) when the
    // payload carried no token metadata. Keep in sync with parseTemplateDoc's
    // "## Tokens" reader in jo-report.mjs.
    ...(tokens != null ? ["## Tokens", "", "```json", JSON.stringify(tokens, null, 2), "```", ""] : []),
    "## Body (plain text)",
    "",
    ...(body.derived ? ["_(derived from HTML — plain-text body was empty)_", ""] : []),
    body.text || "_(empty body)_",
    "",
  ];
  if (variants.length) {
    lines.push("## Variants", "");
    for (const v of variants) {
      const vb = bodyOf(v);
      lines.push(
        `### ${v.variantName ?? v.name ?? "unnamed variant"}`,
        "",
        `- subject: ${decode(v.subject ?? "")}`,
        "",
        ...(vb.derived ? ["_(derived from HTML — plain-text body was empty)_", ""] : []),
        vb.text || "_(empty body)_",
        ""
      );
    }
  }
  return { id, doc: lines.join("\n") };
}

// Geometry/UI keys dropped by the program compactor — case-insensitive, and
// deliberately a DROP-list, not a keep-list: an unknown key is always kept.
// Every entry must be unambiguous CANVAS vocabulary. Key names that are also
// real semantic fields elsewhere in the CLI surface stay OFF the list even
// when v1.0.4 journey payloads only use them for geometry — they are one-off
// scalars, so keeping them costs bytes while dropping them risks meaning
// (catalog-confirmed collisions: `selected` = default selected value,
// `scale` = numeric decimal places, `offset` = pagination offset, `points`
// = score points). The size win comes from the coordinate keys below.
const PROGRAM_GEOMETRY_KEYS = new Set([
  "x", "y", "posx", "posy", "positionx", "positiony", "position", "positions",
  "coordinates", "coords", "transform", "transforms", "translate",
  "zoom", "rotation", "width", "height", "dimensions", "bounds", "boundingbox",
  "layout", "canvas", "ui", "uistate", "style", "styles", "css", "color",
  "bgcolor", "icon", "iconurl", "viewport", "geometry", "edgepoints",
  "anchor", "anchors", "handlebounds", "sourceposition", "targetposition",
  "dragging", "zindex", "minimap",
]);
// Participant-source guarantee: anything under a PowerList-named key is kept
// verbatim — never compacted — so program → Power List → source stays fully
// parseable from compacted docs (and relationships derivation never depends on
// the drop-list being right).
const keepVerbatim = (key) => /powerlist/i.test(key);

// Deep-strip geometry/UI keys from a program payload. Embedded JSON strings
// (keys ending "json", e.g. stepJson) are parsed so their geometry is stripped
// too — they stay parsed objects in the result (recorded in parsedJsonKeys).
export function compactProgramPayload(payload) {
  let dropped = 0;
  const parsedJsonKeys = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (keepVerbatim(k)) { out[k] = v; continue; }
      if (PROGRAM_GEOMETRY_KEYS.has(k.toLowerCase())) { dropped++; continue; }
      if (/json$/i.test(k) && typeof v === "string") {
        const t = v.trim();
        if (t.startsWith("{") || t.startsWith("[")) {
          try {
            const parsed = walk(JSON.parse(t));
            parsedJsonKeys.add(k);
            out[k] = parsed;
            continue;
          } catch { /* not JSON after all — keep the string untouched */ }
        }
      }
      out[k] = walk(v);
    }
    return out;
  };
  return { value: walk(payload), dropped, parsedJsonKeys: [...parsedJsonKeys].sort() };
}

// Render one captured `jo p describe --id` payload into the compact program
// doc. Returns { id, doc }; throws when the payload carries no program id.
// `key` overrides the manifest-key bullet (batch runs pass the entry's real
// key; standalone defaults to the standard journey/<id>).
/** @param {*} payload  @param {{key?: string}} [opts] */
export function renderProgramDoc(payload, { key } = {}) {
  // Unwrap the payload envelope: `data` when present, then the JO describe
  // envelope `data.advancedOutreach` (real `jo p describe` payloads carry the
  // program there — S5-V finding F1: `data` itself holds only
  // {advancedOutreach, versions}, never a programId/id). One helper serves
  // the raw payload and the compacted value, so the two can't drift.
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const unwrapData = (x) => (isObj(x) && isObj(x.data) ? x.data : x);
  const programObj = (x) => {
    const y = unwrapData(x);
    return isObj(y) && isObj(y.advancedOutreach) ? y.advancedOutreach : y;
  };
  // Id/name resolution checks the outer data object FIRST — a synthetic
  // payload carrying a top-level programId keeps its id even if a stray
  // advancedOutreach object is also present — then falls back to the JO
  // envelope's fields.
  const d = unwrapData(payload);
  const p = programObj(payload);
  const rawId = d?.programId ?? d?.id ?? p?.advancedOutreachId ?? p?.programId ?? p?.id;
  if (rawId == null || rawId === "")
    throw new Error("no data.programId/id or data.advancedOutreach.advancedOutreachId in payload — cannot render a program doc");
  const id = String(rawId);
  const name = d?.name ?? d?.programName ?? p?.advancedOutreachName ?? p?.name ?? p?.programName ?? id;
  const compacted = compactProgramPayload(payload);
  // Scalar bullets come from the COMPACTED program object, not the raw one —
  // the raw object's embedded-JSON strings (stepJson) and dropped geometry
  // keys must not leak back in through the metadata bullets.
  const cp = programObj(compacted.value);
  const ID_NAME_KEYS = new Set(["programId", "id", "name", "programName", "advancedOutreachId", "advancedOutreachName"]);
  const scalars = Object.entries(isObj(cp) ? cp : {})
    .filter(([k]) => !ID_NAME_KEYS.has(k))
    .filter(([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v))
    .map(([k, v]) => `- ${k}: ${v === "" ? '""' : String(v)}`);
  const lines = [
    `# ${name}`,
    "",
    `- key: ${key ?? `journey/${id}`}`,
    `- id: ${id}`,
    `- name: ${name}`,
    ...scalars,
    "",
    "> Compacted program doc — flow-canvas geometry / UI state dropped from the payload",
    `> (${compacted.dropped} geometry key(s) removed${compacted.parsedJsonKeys.length ? `; embedded JSON parsed: ${compacted.parsedJsonKeys.join(", ")}` : ""}; drop-list in doc-lib.mjs, 1.0.4-scoped).`,
    "> Kept: node types/names, branch conditions, participant source (PowerList config",
    "> verbatim), email-template references, timers/waits. Full payload not stored",
    "> (~287 KB/program) — re-fetch:",
    `> \`gs-admin --json jo p describe --id ${id}\``,
    "",
    "```json",
    JSON.stringify(compacted.value, null, 2),
    "```",
    "",
  ];
  return { id, doc: lines.join("\n") };
}

// ── Raw describe doc + its designer composite variant (T-3 v5, GP-B5 W9) ─────
// The raw describe doc describe-batch writes for every domain without a compact
// renderer — hoisted here at W9 so the designer composite (below) composes on
// the same lines instead of a second copy (A-1). Byte-identical to the inline
// writer it replaced (describe-batch's suite pins the doc text).
// Scalar metadata bullets from the unwrapped body — strings/numbers/booleans/null
// only; objects (including `_kb`) never become bullets.
export const scalarBullets = (obj) =>
  Object.entries(obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {})
    .filter(([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v))
    .map(([k, v]) => `- ${k}: ${v === "" ? '""' : String(v)}`);
/**
 * @param {{name: ?string, key: string, id: string, core: *, fenceText: string, provenance: string}} p
 *   name null → H1 falls back to the id and the bullet carries NO_NAME; `core`
 *   is the caller's one-level-unwrapped body (T-3 envelope rule: the unwrap
 *   stays at the caller); `fenceText` is the fence body verbatim (pretty JSON,
 *   or the raw non-JSON stdout in raw mode); `provenance` is the blockquote line.
 */
export function renderRawDescribeDoc({ name, key, id, core, fenceText, provenance }) {
  return [
    `# ${name ?? id}`,
    "",
    provenance,
    "",
    `- key: ${key}`,
    `- id: ${id}`,
    `- name: ${name ?? NO_NAME}`,
    ...scalarBullets(core),
    "",
    "```json",
    fenceText,
    "```",
    "",
  ].join("\n");
}

// Designer composite — why three levels (CLI pin 1.0.8, routed handler
// handlers/data-preparation/templates/describe/index.js + common/task-detail.js;
// measured live 2026-09-02): the template describe carries summary task rows
// and 14 EMPTY `_task*` tables; `--task-id` empties `_tasks` and fills the
// tables for ONE task, but its show-field column is `label || fieldAlias ||
// fieldName` plus an aggregation/formula suffix — a DISPLAY projection; only
// the `--field` detail carries the system name (Field Name) with the field's
// own Source Object and Connection. The composite keeps all three verbatim
// under `_kb` (KbDesignerComposite in the T-3 header) so a reader sees
// identifiers, not display strings, and every item's outcome.

// Suffix vocabulary task-detail.js's taskFieldLabel appends as ONE trailing
// "(KEY)" group: the six canonical aggregations (common/aggregations.js
// KNOWN_AGGS) plus the formula function keys (formula/FormulaShowFieldUtil.js
// DEFAULT_FUNCTIONS), authored from the artifact at 1.0.8. A label's OWN
// trailing parenthesis stays a label ("Rollup (v2)") — the strip is keyed on
// this set, never on shape alone. `--field` resolves the STRIPPED label only
// (measured: the full "Label (MAX)" spelling is not found). Re-derive at every
// CLI adoption (MAINTAINERS.md "Designer drilldown grammar").
// The vocabulary decides the ATTEMPT ORDER of the `--field` call, not whether
// a label can resolve: describe-batch tries the stripped spelling first for a
// known key and the full spelling first otherwise, and on the CLI's own
// not-found refusal tries the other spelling once (W9 review round — the
// first derivation missed six keys the top-level expression can also carry:
// formula-structured-summary.js STRUCTURED_KEYS and formula-renderer.js's
// "anonymous" / "CASE" wrappers; the fallback makes a seventh miss a wasted
// spawn, never a permanently failed template).
export const DESIGNER_FIELD_SUFFIX_KEYS = new Set([
  "COUNT", "COUNT_DISTINCT", "MIN", "MAX", "AVG", "SUM",
  "aggregation_over_time", "calculated_field_comparison", "period_over_period_comparison",
  "period_over_period_comparison_percent", "anonymous", "CASE",
  "trend", "trend_percentage", "correlation", "covar_pop", "var_pop", "median", "stddev_pop",
  "date_datetime_to_epoch", "to_uppercase", "to_lowercase", "first_day_of_current_week",
  "last_day_of_current_week", "first_day_of_current_month", "last_day_of_current_month",
  "first_day_of_calendar_quarter", "last_day_of_calendar_quarter", "datetime_to_date", "date_diff",
  "rule_date", "add_or_subtract_n_days_from_date", "to_date", "epoch_to_date", "concat", "left",
  "right", "length", "substring", "position", "to_string", "left_trim", "right_trim", "trim", "md5",
  "sha256", "to_base64", "ceil", "floor", "sqrt", "exp", "abs", "log", "log10", "to_number", "random",
  "to_boolean", "isempty_boolean", "to_datetime", "epoch_to_datetime", "calendar_label",
  "day_of_week", "week_number", "fiscal_quarter_label", "fiscal_year_label",
  "add_or_subtract_n_days_from_dateTime",
]);
// ONE trailing parenthesized group — the grammar the CLI's display strings
// share: summarizeTask's "Label (name)" object, buildFieldDetail's
// "Label (name)" Source Object, taskFieldLabel's "Label (KEY)" suffix. The
// LAST group is the one split off (a label may carry its own parentheses:
// "Rollup (v2) (rollup_v2__gc)" → base "Rollup (v2)"). Null when there is no
// trailing group. tenant-deps' parseSummaryObject / fieldSourceObject and
// splitDesignerFieldLabel below all parse through here (A-1).
/** @param {*} v  @returns {?{base: string, group: string}} */
export function splitTrailingGroup(v) {
  const m = /^(.*\S)\s\(([^()]+)\)$/.exec(String(v ?? "").trim());
  return m ? { base: m[1].trim(), group: m[2].trim() } : null;
}
/** @param {*} v  @returns {{label: string, suffix: ?string}} */
export function splitDesignerFieldLabel(v) {
  const s = String(v ?? "").trim();
  const g = splitTrailingGroup(s);
  if (g && DESIGNER_FIELD_SUFFIX_KEYS.has(g.group)) return { label: g.base, suffix: g.group };
  return { label: s, suffix: null };
}

// The 14 `_task*` tables one `--task-id` drilldown projects (task-detail.js
// emptyTaskFields at CLI 1.0.8; measured live 2026-09-02 for extract / join /
// freeForm — pivot / union from source, the W9 arm). Declared HERE, the KB
// doc contract's home, and consumed by describe-batch (writer), this file's
// designerTaskFieldLabels, and tenant-deps (reader) — the T-5 pattern for an
// external emitter, tsc-gated: a misspelled key in any consumer is TS2551.
// The `--task-id` tables are DISPLAY projections: show-field / criteria
// columns spell `label || fieldName`, so the per-field `--field` detail is the
// only system-name carrier. DESIGNER_TASK_TABLES is the same list as data
// (the closure fixture compares it to the typedef).
/**
 * @typedef {object} DesignerTaskDetail
 * @property {Array<{_key: string, _value: string}>} [_taskDetailRows]  Task ID · Name · Type ·
 *           Parents · Children, then per kind: Source (extract: "<objectName> (<conn>)"),
 *           Join Type · Base Task · Joined Task · `Fields (<srcTaskId>)` (join),
 *           Source Task (freeForm/pivot), Show Fields (count), Group By
 * @property {Array<{_index: number, _field: string, _type: string, _calc: string}>} [_taskShowFields]
 *           `_field` = label || fieldAlias || fieldName (+ " (<suffix>)")
 * @property {Array<{_index: number, _alias: string, _lhsField: string, _lhsType: string,
 *           _operator: string, _rhsType: string, _rhsValue: string}>} [_taskCriteriaConditions]
 * @property {Array<{_expr: string}>} [_taskCriteriaExpressionRows]
 * @property {Array<{_index: number, _left: string, _op: string, _right: string}>} [_taskJoinConditions]
 *           "<object label|name|id>.<fieldName|label>" — the one NAME-first spelling
 * @property {Array<{_index: number, _field: string, _type: string, _mergedFrom: string}>} [_taskUnionMerged]
 * @property {Array<{_index: number, _field: string, _type: string, _source: string}>} [_taskUnionOther]
 * @property {Array<{_index: number, _column: string, _agg: string, _count: number}>} [_taskPivotColumns]
 * @property {Array<{_column: string, _index: number, _lhsField: string, _operator: string,
 *           _rhsType: string, _rhs: string}>} [_taskPivotConditions]   only with --pivot-column
 * @property {Array<{_key: string, _value: string}>} [_taskS3Export]
 * @property {Array<{_index: number, _field: string, _type: string}>} [_taskS3FieldOrder]
 * @property {Array<{_key: string, _value: string}>} [_taskFieldDetail]   only with --field
 * @property {Array<{_expr: string}>} [_taskFieldFormula]                only with --field
 * @property {Array<object>} [_taskFieldCase]                             only with --field
 */
export const DESIGNER_TASK_TABLES = Object.freeze([
  "_taskDetailRows", "_taskShowFields", "_taskFieldDetail", "_taskFieldFormula", "_taskFieldCase",
  "_taskJoinConditions", "_taskUnionMerged", "_taskUnionOther", "_taskS3Export", "_taskS3FieldOrder",
  "_taskCriteriaExpressionRows", "_taskCriteriaConditions", "_taskPivotColumns", "_taskPivotConditions",
]);

// The field labels one task's drilldown tables name, per kind — enumerated
// from the projection's carriers (Addendum-3 discipline: the artifact, not the
// arms): extract / freeForm / pivot / other → `_taskShowFields[]._field`;
// join → the `Fields (<srcTaskId>)` detail rows, "<source label>: f1, f2 (N)";
// union → `_taskUnionMerged[]` / `_taskUnionOther[]` `_field`. Order preserved,
// duplicates kept (the caller decides how a repeated label is handled).
// The join row is parsed BY THE GRAMMAR (A-9): the source label and the field
// labels are both free text that may contain ": " or ", ", so the value is
// split at EVERY ": " position and the one position whose comma-split yields
// exactly the declared N non-empty fields is accepted — zero or several
// qualifying positions means the row is reported UNPARSED, never guessed
// (W9 review round: a first-": " split silently mis-sliced "Extract: Company:
// Name, ARR (2)" while the count check still passed).
/**
 * @param {?DesignerTaskDetail} detail  the drilldown's `_task*` tables
 * @returns {{labels: Array<{label: string, suffix: ?string, source: "show"|"join"|"union"}>,
 *            unparsed: Array<{key: string, reason: string}>}}
 */
export function designerTaskFieldLabels(detail) {
  const d = /** @type {Record<string, *>} */ (detail && typeof detail === "object" ? detail : {});
  const arr = (k) => (Array.isArray(d[k]) ? d[k] : []);
  /** @type {Array<{label: string, suffix: ?string, source: "show"|"join"|"union"}>} */
  const labels = [];
  /** @type {Array<{key: string, reason: string}>} */
  const unparsed = [];
  for (const r of arr("_taskShowFields")) {
    if (!r || typeof r !== "object" || typeof r._field !== "string" || !r._field.trim()) continue;
    labels.push({ ...splitDesignerFieldLabel(r._field), source: "show" });
  }
  for (const r of arr("_taskDetailRows")) {
    if (!r || typeof r !== "object" || typeof r._key !== "string" || !/^Fields \(.+\)$/.test(r._key)) continue;
    const v = String(r._value ?? "");
    const m = /^(.*) \((\d+)\)$/.exec(v);
    const declared = m ? Number(m[2]) : -1;
    /** @type {string[][]} */
    const candidates = [];
    if (m) {
      const head = m[1];
      for (let i = head.indexOf(": "); i > -1; i = head.indexOf(": ", i + 1)) {
        const parts = head.slice(i + 2).split(", ");
        if (parts.length === declared && parts.every((x) => x.trim())) candidates.push(parts);
      }
    }
    if (candidates.length !== 1) {
      unparsed.push({
        key: r._key,
        reason: `${r._key}: value does not parse as "<label>: f1, f2 (N)" with exactly one split yielding N fields (${candidates.length} qualifying split(s))`,
      });
      continue;
    }
    for (const f of candidates[0]) labels.push({ ...splitDesignerFieldLabel(f), source: "join" });
  }
  for (const k of ["_taskUnionMerged", "_taskUnionOther"])
    for (const r of arr(k)) {
      if (!r || typeof r !== "object" || typeof r._field !== "string" || !r._field.trim()) continue;
      labels.push({ label: r._field.trim(), suffix: null, source: "union" });
    }
  return { labels, unparsed };
}

// Outcome arithmetic over one composite — the ONE definition of "complete"
// (describe-batch marks on it; the provenance line prints it; the resume
// reader returns it). Complete = nothing pending and nothing RETRYABLY failed:
// a duplicate label is a property of an ok field, and a PERMANENTLY failed
// field (the CLI refused every spelling of its label) is a recorded gap the
// doc states per item — neither is an unfinished item, or the entry could
// never be marked and the spawn budget would re-buy the same refusal on every
// run (W9 review round).
/** @param {KbDesignerComposite} kb */
export function designerDrilldownStats(kb) {
  const tasks = Object.values(kb.tasks ?? {});
  const fields = Object.values(kb.fields ?? {}).flatMap((m) => Object.values(m ?? {}));
  const s = {
    tasksTotal: tasks.length, tasksOk: 0, tasksFailed: 0, tasksPending: 0,
    fieldsTotal: fields.length, fieldsOk: 0, fieldsFailed: 0, fieldsPermanentlyFailed: 0, fieldsPending: 0,
    duplicateLabels: 0, unparsedFieldLists: 0, complete: false,
  };
  for (const t of tasks) {
    if (!t) continue;
    if (t.status === "ok") s.tasksOk++; else if (t.status === "failed") s.tasksFailed++; else if (t.status === "pending") s.tasksPending++;
    if (typeof t.fieldListUnparsed === "string") s.unparsedFieldLists++;
  }
  for (const f of fields) {
    if (!f) continue;
    if (f.status === "ok") s.fieldsOk++;
    else if (f.status === "failed") { if (f.permanent === true) s.fieldsPermanentlyFailed++; else s.fieldsFailed++; }
    else if (f.status === "pending") s.fieldsPending++;
    if (typeof f.duplicates === "number") s.duplicateLabels += f.duplicates;
  }
  s.complete = s.tasksPending === 0 && s.tasksFailed === 0 && s.fieldsPending === 0 && s.fieldsFailed === 0;
  return s;
}

// The composite doc: the template payload (envelope intact) with `_kb` set on
// the unwrapped body, rendered as a raw describe doc whose provenance line
// states the drilldown outcome — so a partial doc SAYS it is partial.
/**
 * @param {{name: ?string, key: string, id: string, payload: *, envelope: boolean,
 *          kb: KbDesignerComposite, capturedAt: string}} p
 *   `envelope` true = the body is payload.data (the caller's unwrap decided).
 */
export function renderDesignerDoc({ name, key, id, payload, envelope, kb, capturedAt }) {
  // Shallow copies keep the caller's payload unmutated and `_kb` last in key
  // order (byte-identical to a deep clone's fence, without re-serializing the
  // template on every per-spawn write — W9 review round).
  const p = envelope ? { ...payload, data: { ...payload.data, _kb: kb } } : { ...payload, _kb: kb };
  const body = envelope ? p.data : p;
  const s = designerDrilldownStats(kb);
  const outcome =
    `${s.tasksOk}/${s.tasksTotal} task(s), ${s.fieldsOk}/${s.fieldsTotal} field(s) drilled` +
    (s.tasksFailed + s.fieldsFailed ? `, ${s.tasksFailed + s.fieldsFailed} failed (retried next run)` : "") +
    (s.fieldsPermanentlyFailed ? `, ${s.fieldsPermanentlyFailed} field(s) unresolvable by the CLI (recorded gap)` : "") +
    (s.duplicateLabels ? `, ${s.duplicateLabels} duplicate label(s)` : "") +
    (s.unparsedFieldLists ? `, ${s.unparsedFieldLists} field list(s) unparsed` : "") +
    (s.complete ? "" : "; INCOMPLETE — resumes on the next describe-batch run");
  return renderRawDescribeDoc({
    name, key, id, core: body, fenceText: JSON.stringify(p, null, 2),
    provenance: `> Full describe doc (designer doc-mode: template describe + task/field drilldowns — ${outcome}) — generated by describe-batch.mjs, captured ${capturedAt}.`,
  });
}

// Resume reader: the composite's progress off an unwrapped doc body, or null
// when the body is not a composite (summary-only doc, legacy doc, a composite
// of another version, or one whose per-item records are not the shape the
// typedef states — a hand-edited or torn doc must read as "no composite" and
// start over, never reach the writer's loops and throw; W9 review round).
// Null-never-throw, like parseDocJson.
const STATUSES = new Set(["pending", "ok", "failed"]);
const isRec = (v) => !!v && typeof v === "object" && !Array.isArray(v);
/** @param {*} core  @returns {?({kb: KbDesignerComposite} & ReturnType<typeof designerDrilldownStats>)} */
export function designerDocProgress(core) {
  const kb = isRec(core) ? core._kb : null;
  if (!isRec(kb) || kb.version !== 1 || typeof kb.templateFingerprint !== "string") return null;
  for (const k of ["tasks", "fields", "taskDetails", "fieldDetails"]) if (!isRec(kb[k])) return null;
  for (const t of Object.values(kb.tasks)) if (!isRec(t) || !STATUSES.has(t.status)) return null;
  for (const m of Object.values(kb.fields)) {
    if (!isRec(m)) return null;
    for (const f of Object.values(m)) if (!isRec(f) || !STATUSES.has(f.status)) return null;
  }
  for (const d of Object.values(kb.taskDetails)) if (!isRec(d)) return null;
  for (const m of Object.values(kb.fieldDetails)) {
    if (!isRec(m)) return null;
    for (const rows of Object.values(m)) if (!Array.isArray(rows)) return null;
  }
  return { kb: /** @type {KbDesignerComposite} */ (kb), ...designerDrilldownStats(kb) };
}

// ── Doc parsing primitives (read-side counterparts to the renderers above) ────
// One copy each, imported by jo-report.mjs (index build) and
// relationships-build.mjs (map synthesis) — import, never re-implement.
//
// Contract: extractFencedJson/topBullets scan on "\n" and rely on the caller
// having run normalizeText first (both parsers already do at their entry point),
// so BOM/CRLF handling stays a single, explicit step rather than being repeated
// defensively inside every primitive. Pass normalizeText(text) if a source may
// still carry a BOM or CRLF.

// BOM + CRLF/CR normalization for text read off disk. A hand-edited or
// autocrlf-checked-out doc must not leak a leading BOM or a `\r` into captured
// ids, names, bodies, or bullet matching.
export const normalizeText = (s) => String(s).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

// Body of the first ```json fence in a doc as a raw string (line-scan, so it
// works whether the payload is pretty-printed or single-line); null when there
// is no complete fenced block (metadata stubs have none). Callers JSON.parse the
// result themselves.
export function extractFencedJson(md) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.trim() === "```json");
  if (start === -1) return null;
  const end = lines.findIndex((l, i) => i > start && l.trim() === "```");
  if (end === -1) return null;
  return lines.slice(start + 1, end).join("\n");
}

// `- key: value` metadata bullets above the first fence / section heading, as a
// map (first value wins per key; keys are [A-Za-z0-9_]+). A value written as
// ONE inline code span (`- id: `SC-1``) yields its bare content: some KB docs
// quote bullet values that way (four domains' docs do it for every id — F-341),
// and every reader compares the value against bare ids from payloads, so the
// wrapper is grammar to parse here, once, not a pattern for each reader to
// tolerate (jo-report-deps' docKeyId used to carry its own copy). Only a
// symmetric whole-value wrap unwraps; a lone backtick or a span inside prose
// is content and stays.
export function topBullets(md) {
  const out = {};
  for (const line of md.split("\n")) {
    if (line.startsWith("```") || line.startsWith("## ")) break;
    const m = /^- ([A-Za-z0-9_]+): (.*)$/.exec(line);
    if (m && !(m[1] in out)) out[m[1]] = unwrapCodeSpan(m[2]);
  }
  return out;
}

// `X` → X for a value that is exactly one inline code span (trimmed); anything
// else — bare, partially quoted, a single backtick — returns unchanged.
const unwrapCodeSpan = (v) => {
  const t = v.trim();
  return t.length >= 2 && t.startsWith("`") && t.endsWith("`") ? t.slice(1, -1) : v;
};

// First ```json fence → parsed payload, or null on absence/malformation —
// null-never-throw, so a bad doc is a caveat, not a crash. The ONE null-signal
// fence-parse guard (GP-B5 DS-24: previously hand-synced as tenant-deps' and
// relationships-build's docJson and the parse half of jo-report-deps'
// docJsonBody; agreement proved by the differential corpus in
// test/doc-lib-fixtures.mjs BEFORE the collapse, A-6; check-doc-drift check 9
// sweeps for regrown copies). jo-report.mjs's parseProgramDoc keeps a
// DELIBERATE separate variant — it reports the parse error's text into
// parseErrors instead of collapsing to null (A-4) — registered as a check-9
// allowance, not a missed copy. Returns the RAW parsed value — describe
// envelope intact, arrays and scalars allowed: envelope posture stays at the
// callers (T-3's envelope rule), and so do the docs-vs-parsed honesty stats
// (A-3/F-228) — this function never counts.
export function parseDocJson(md) {
  const fence = extractFencedJson(md);
  if (fence == null) return null;
  try {
    return JSON.parse(fence);
  } catch {
    return null;
  }
}

// The no-recorded-name sentinel describe-batch's doc writer emits for a
// `- name:` bullet with nothing to record, and readers must resolve away
// (T-3's KbDocMeta note). Single source since the DS-24 review round —
// writer (describe-batch), readers (docMeta below, jo-report.mjs's
// realName), and display fillers all import it; check-doc-drift check 9
// sweeps for respelled literals, and the VALUE is pinned by hand in
// test/doc-lib-fixtures.mjs (docs written by earlier plugin versions carry
// the string, so it is KB format, not a free constant).
export const NO_NAME = "(none recorded)";

// The recorded describe-command value that means "this domain has no usable
// per-item describe — its stubs are complete docs" (gate-3 review round,
// F-346). A manifest's domains_indexed[<domain>].describeCommand has THREE
// states, and readers must keep them apart: a command template (describable;
// stubs are placeholders, --deep upgrades them), this sentinel (list-only, a
// recorded operator decision — the catalog cannot make it: scorecards describe
// through a different command group and connector jobs through a flag), and
// null/absent (UNRECORDED — nothing is known, so no doc may claim either
// completeness or a --deep path; legacy stamps written before this value
// existed are all in this state). Writer: manifest.mjs upsert-batch
// (--describe-command none); readers: manifest.mjs stub (the three banners),
// describe-batch.mjs (refuses to run the sentinel as a template).
export const DESCRIBE_NONE = "none";

// First `# ` H1 line's text, or null — the shared H1-fallback half of
// KbDocMeta resolution (also used standalone by jo-report-deps' designer/DM
// doc labels). NOTE: jo-report.mjs's parseTemplateDoc/parseJourneyDoc keep a
// deliberate `(.*)` variant that admits an empty H1 title.
export const docH1 = (md) => /^# (.+)$/m.exec(md)?.[1] ?? null;

// KbDocMeta resolution (T-3, typed in the header above): `- id:` / `- name:`
// top bullets with the NO_NAME sentinel and a missing or empty name resolving
// to the H1; missing values are NULL, per the typedef's {?string} — the
// pre-DS-24 relationships-build copy resolved them to undefined instead, the
// live divergence the differential corpus pinned before this single copy
// replaced both.
export function docMeta(md) {
  const b = topBullets(md);
  const h1 = docH1(md);
  return { id: b.id ?? null, name: b.name && b.name !== NO_NAME ? b.name : h1 };
}

// Dotted-path read into parsed JSON ("a.b.c") — the single copy behind
// manifest.mjs's field extraction and domain-candidates.mjs's global overlap
// check (F-108): the two must resolve an --id-field / --items-path spelling
// identically, or the adoption gate's overlap numbers could disagree with what
// upsert-batch later records for the same payload.
export function getPath(obj, dotted) {
  return String(dotted)
    .split(".")
    .reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Locate the items array inside arbitrary `list --json` output — moved here
// verbatim from manifest.mjs (F-108) so upsert-batch and the candidate gate's
// check verb parse a captured list payload with ONE implementation. Throws on
// failure (script callers fail() with the message). allowEmpty treats "no
// items array found" as an empty list — for stamping a domain the tenant has
// none of, where the empty payload may carry no array at all; a path that
// resolves to a real non-array value is a wrong path, not an empty list, and
// stays fatal regardless.
export function findItemsArray(data, itemsPath, idField, allowEmpty = false) {
  if (itemsPath) {
    const v = getPath(data, itemsPath);
    if (!Array.isArray(v)) {
      if (v != null) {
        throw new Error(`--items-path ${itemsPath} resolves to a ${typeof v}, not an array — check the path`);
      }
      if (allowEmpty) return [];
      throw new Error(`--items-path ${itemsPath} does not resolve to an array`);
    }
    return v;
  }
  if (Array.isArray(data)) return data;
  const arrays = [];
  const queue = [data];
  while (queue.length) {
    const cur = queue.shift();
    if (typeof cur !== "object" || cur === null) continue;
    for (const v of Object.values(cur)) {
      if (Array.isArray(v)) {
        if (v.every((x) => typeof x === "object" && x !== null)) arrays.push(v);
      } else if (typeof v === "object" && v !== null) {
        queue.push(v);
      }
    }
  }
  // Prefer the array whose items actually carry the id field
  const withId = arrays.find((a) => a.length && getPath(a[0], idField) != null);
  if (withId) return withId;
  if (arrays.length) return arrays[0];
  if (allowEmpty) return [];
  throw new Error("could not locate an array of objects in the list output — pass --items-path <dot.path>");
}

// Row → id extraction over a located items array — the single copy of the row
// predicate (F-237): a row counts iff its id field resolves non-null/non-empty,
// and ids compare as strings. upsert-batch (manifest.mjs) and the candidate
// gate's check verb (domain-candidates.mjs) must apply the IDENTICAL rule, or
// check's alreadyIndexed/unresolvedRows diverge from what the KB records for
// the same payload — the F-216 class via the back door. A future tightening of
// the row rule lands here, once.
export function extractIds(items, idField) {
  return items
    .map((it) => getPath(it, idField))
    .filter((v) => v != null && v !== "")
    .map(String);
}

// The one sentence both id-path failures teach (F-388 round 2, consumer-parity):
// domain-candidates' check verb and manifest's upsert-batch fail on the SAME
// predicate (extractIds above resolving on zero of N rows) and must name the
// same shapes — a connection row's id lives at a path that follows the endpoint
// AND the CLI version that captured it (gs-fortress audit-1.0.9 §1.11: nested
// at 1.0.8 and on the rules-engine / S3 surfaces, flat from cn list at 1.0.9).
// Worded once, here, beside the predicate it explains.
export const CONNECTION_ID_PATH_HINT =
  "a connection-shaped payload's id path follows the endpoint and the CLI version that captured it " +
  "(nested pnpConnectionsInfo.connectionId from cn list at CLI 1.0.8 and from re r list-rest-connections; " +
  "top-level connectionId from cn list at 1.0.9)";
// F-391: the connection sentence is on-topic only where the payload looks
// connection-shaped — the connectors domain, or rows carrying
// pnpConnectionsInfo / connectionId at the row root or under
// pnpConnectionsInfo. A typo'd --id-field on a rules or journey domain gets
// the domain-neutral sentence instead; the operative advice ("inspect a row
// and pass the dot-path the installed CLI actually emits") is the CALLER's
// sentence in both writers and stays. One predicate + one chooser here, so
// the two zero-resolve failures cannot drift apart (consumer-parity; the
// connectors-domain message is byte-identical to before — check 20 holds the
// refresh note's copy-outs to it).
export const NEUTRAL_ID_PATH_HINT =
  "an id path must name a key the rows actually carry (a nested key as a dot.path — the shape follows the endpoint and the CLI version that captured it)";
/**
 * @param {string | null | undefined} domain  the domain the rows are for (upsert-batch's --domain; the check verb passes none)
 * @param {unknown[]} items  the rows the id path resolved on none of
 * @returns {boolean}
 */
export function looksConnectionShaped(domain, items) {
  if (domain === "connectors") return true;
  return items.some((row) => {
    if (!row || typeof row !== "object") return false;
    const r = /** @type {Record<string, unknown>} */ (row);
    if ("pnpConnectionsInfo" in r || "connectionId" in r) return true;
    const nested = r.pnpConnectionsInfo;
    return !!nested && typeof nested === "object" && "connectionId" in /** @type {object} */ (nested);
  });
}
/**
 * @param {string | null | undefined} domain
 * @param {unknown[]} items
 * @returns {string}  the shape sentence the zero-resolve failure carries
 */
export function idPathHint(domain, items) {
  return looksConnectionShaped(domain, items) ? CONNECTION_ID_PATH_HINT : NEUTRAL_ID_PATH_HINT;
}
// The zero-resolve failure HEAD both writers print (Gate-2 review of 0.36.1,
// F-393): domain-candidates check and manifest upsert-batch fail on the same
// predicate and used to spell this sentence twice ("rows" vs "row(s)"), held
// by nothing. One export; the refresh skill's copy-out of the failure this
// head opens is held to the writer's REAL stderr by build/check-doc-drift.mjs
// check 20 (it executes upsert-batch on a scratch manifest — F-392 reopen).
export const ZERO_RESOLVE_HEAD = "resolves to no value on any of the";

// ── CLI argv helpers (F-238) — the single copy of opt()/fail()/out() ─────────
// ── T-8 · Argv conventions ───────────────────────────────────────────────────
/**
 * FROZEN (B5 P1, 2026-08-16).
 * Two argv families, deliberately parallel today (DS-34 deferred consolidation):
 * @callback MakeCliHelpers (scriptName:string, argv:string[]) =>
 *   {opt:(name:string, fallback?:*)=>*, fail:(msg:string)=>never,
 *    out:(obj:*)=>void}
 *   Last-token rule (F-165/F-171): a valued flag as the LAST token has lost
 *   its value → fail, never default. Booleans via argv.includes, never opt().
 * parseFlags (jo-report.mjs:108): declarative {repeatable[], boolean[]} maps →
 *   flags object; used by the report family (6 scripts).
 */
// Rationale behind the last-token rule stated in T-8 above: the losing
// spelling is exactly what a skill fence renders when a placeholder
// substitutes empty (`--limit <budget>` with no budget), and falling back to
// the default would make the flag's presence indistinguishable from its
// absence — for a budget flag the control silently stops controlling (F-165).
// The clause also closes the duplicated-flag spelling (`--limit 1 --limit`):
// indexOf finds the valued first occurrence, but a bare trailing repeat has
// still lost a value (F-171). The guard hook keeps its own argv helpers — its
// no-import rule is declared as data and enforced by build/check-imports.mjs
// (DS-14; lane-level only — for this helper's current importers, grep
// `makeCliHelpers` across scripts/).
/**
 * The never-returning failure exit every makeCliHelpers bag carries (one
 * spelling of the type, DS-46 review round). A consumer that re-binds it —
 * `const fail = helpers.fail` — declares `@type {import("./doc-lib.mjs").FailFn}`
 * at THAT declaration: the checker honours a never-returning call only
 * through an explicitly annotated callee declaration, never a destructured
 * binding, so a `const { fail } = makeCliHelpers(…)` narrows nothing.
 * @typedef {(msg: string) => never} FailFn
 */
/**
 * @param {string} scriptName
 * @param {string[]} argv
 * @returns {{opt: {(name: string, fallback: string): string, (name: string): string|undefined}, fail: FailFn, out: (obj: *) => void, finish: (obj: *, code?: number) => Promise<never>}}
 */
export function makeCliHelpers(scriptName, argv) {
  /** @type {FailFn} */
  const fail = (msg) => {
    console.error(`${scriptName}: ${msg}`);
    process.exit(1);
  };
  // Two call signatures (DS-46 strict list): a fallback given means the
  // result is always a string; without one it may be undefined.
  /**
   * @overload
   * @param {string} name
   * @param {string} fallback
   * @returns {string}
   */
  /**
   * @overload
   * @param {string} name
   * @returns {string|undefined}
   */
  /**
   * @param {string} name
   * @param {string} [fallback]
   * @returns {string|undefined}
   */
  function opt(name, fallback) {
    const i = argv.indexOf(name);
    if (i !== -1 && (argv[i + 1] === undefined || argv[argv.length - 1] === name)) fail(`${name} requires a value`);
    return i !== -1 ? argv[i + 1] : fallback;
  }
  const out = (obj) => console.log(JSON.stringify(obj, null, 2));
  // finish(): the stdout JSON summary, then exit IN THE WRITE CALLBACK (F-356
  // measured on the release-PR macOS leg; F-360 shipped the class). stdout is
  // asynchronous when it is a pipe on macOS — the lane every skill runs these
  // scripts in — so `out(obj); process.exit(n)` loses everything past the
  // first ~8 KB chunk (a summary listing 60+ written docs measures 9.5 KB).
  // The returned promise never resolves: awaiting it stops the caller's
  // control flow exactly where process.exit did — at top level or inside an
  // async main — without unwinding every branch onto process.exitCode. A
  // script that simply ENDS after its last write needs neither: set
  // process.exitCode and return (runDocGenerator below).
  /** @type {(obj: *, code?: number) => Promise<never>} */
  const finish = (obj, code = 0) =>
    new Promise(() => {
      process.stdout.write(JSON.stringify(obj, null, 2) + "\n", () => process.exit(code));
    });
  return { opt, fail, out, finish };
}

// The one --kb existence gate for every KB-reading CLI (bus F-310; the
// single-owner rule of F-304/F-232). A --kb that does not resolve to an
// existing directory must REFUSE before any work: tenant-deps used to
// accept it and exit 0 with ok:true, 0/0 scanned in every domain, writing
// a report that asserted nothing depends on the terms — for an
// impact-analysis tool, a mistyped slug indistinguishable from a genuine
// no-dependents answer. jo-report deps mode's inline check was the
// reference implementation; it now lives here so both surfaces (and any
// future KB reader) share one copy. `fail` is the caller's own
// makeCliHelpers instance, so the refusal names the script the operator
// invoked (F-306). A null/undefined value is the caller's "flag not
// passed" state and is not this gate's business.
export function requireKbDir(kbFlagValue, fail) {
  if (kbFlagValue != null && !existsSync(resolve(kbFlagValue))) fail(`--kb ${kbFlagValue}: directory not found`);
}

/**
 * Scorecard doc payload → measure map entries. Classification by levelType,
 * never by position. The ONE walk for both consumers (tenant-deps' scorecard
 * registry and relationships-build's map loader — GP-B5 W10, F-361; moved here
 * from tenant-deps in the review round so the map builder does not load the
 * whole deps-report stack to reach a 20-line pure walk).
 * @param {*} payload
 * @param {string} cardName
 * @param {{measureName: Record<string, string>, measureCard: Record<string, string>, measureGroup: Record<string, string>}} [out]
 */
export function collectScorecardMeasures(payload, cardName, out = { measureName: {}, measureCard: {}, measureGroup: {} }) {
  (function walk(node, group) {
    if (Array.isArray(node)) {
      for (const x of node) walk(x, group);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (node.measureId && node.name) {
      if (node.levelType === "MEASURE") {
        out.measureName[node.measureId] = node.name;
        out.measureCard[node.measureId] = cardName;
        out.measureGroup[node.measureId] = group ?? "";
      }
      const g = node.levelType === "GROUP" ? node.name : group;
      if (node.children) walk(node.children, g);
    } else {
      for (const k of Object.keys(node)) if (node[k] && typeof node[k] === "object") walk(node[k], group);
    }
  })(payload, "");
  return out;
}

/**
 * Tenant identity off a KB's _manifest.json, with the ER-2 fallback rule —
 * slug from the directory name, baseUrl/environment "unknown", inventory {} —
 * and one warning naming why. ONE copy for both deps surfaces (GP-B5 W10,
 * F-361): the hand-copied twins in jo-report's buildIndex and tenant-deps'
 * run() had already drifted — one word in the warning, and one surface
 * admitting a non-object `inventory` the other refused. The stricter guard
 * is kept (A-4: a malformed manifest is untrusted input, never a registry).
 * This block sits DIRECTLY above the function (F-373: the review round found
 * it stranded above collectScorecardMeasures, so tsc bound it to nothing and
 * the parameters were unchecked any — doc-lib-fixtures now pins the binding).
 * @typedef {{slug: string, baseUrl: string, environment: string, inventory: Record<string, *>}} KbIdentity
 * @param {string} kbDir
 * @param {string[]} warnings
 * @returns {KbIdentity}
 */
export function readKbIdentity(kbDir, warnings) {
  const dir = resolve(kbDir);
  let slug = basename(dir);
  let baseUrl = "unknown";
  let environment = "unknown";
  /** @type {Record<string, *>} */
  let inventory = {};
  try {
    const manifest = JSON.parse(normalizeText(readFileSync(join(dir, "_manifest.json"), "utf8")));
    slug = manifest.slug ?? slug;
    baseUrl = manifest.baseUrl ?? baseUrl;
    environment = manifest.environment ?? environment;
    if (manifest.inventory && typeof manifest.inventory === "object") inventory = manifest.inventory;
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    warnings.push(`_manifest.json unreadable (${why}) — slug from directory name, baseUrl/environment unknown`);
  }
  return { slug, baseUrl, environment, inventory };
}

/**
 * The standalone doc-generator main, once (GP-B5 W10, F-360/F-361):
 * program-doc.mjs and template-doc.mjs were byte-identical twins around one
 * render call, and both ended with `console.log(summary); process.exit(…)` —
 * the stdout-then-exit class (F-356's mechanism in a SHIPPED script: on a
 * macOS pipe the summary a skill parses is cut at ~8 KB once ~60 docs are
 * listed). Per-file failures are collected, not fatal; the summary is
 * `{ ok, written: [{id, path, bytes}], failed: [{file, error}] }`; the exit
 * code is set on process.exitCode so the process ends naturally after the
 * write has flushed (exit 1 only when every file failed).
 * @param {{scriptName: string, render: (payload: *) => {id: string, doc: string}, argv: string[]}} opts
 */
export function runDocGenerator({ scriptName, render, argv }) {
  const helpers = makeCliHelpers(scriptName, argv);
  /** @type {FailFn} */
  const fail = helpers.fail;
  // --out-dir through the shared opt() — the one "flag requires a value" rule
  // (F-381: this main hand-read argv beside the helper bag it had just built,
  // so a bare trailing --out-dir got a usage line where every sibling script
  // says "--out-dir requires a value"); the index stays for the positional filter.
  const outIdx = argv.indexOf("--out-dir");
  const outDir = helpers.opt("--out-dir");
  if (!outDir) fail(`usage: ${scriptName} --out-dir <dir> <describe.json> […]`);
  const files = argv.filter((a, i) => i !== outIdx && i !== outIdx + 1 && !a.startsWith("--"));
  if (!files.length) fail("no describe.json files given");
  mkdirSync(resolve(outDir), { recursive: true });
  const claimName = docNameClaimer(resolve(outDir)); // shared disk-keyed collision rule (F-125/F-156)
  /** @type {Array<{id: string, path: string, bytes: number}>} */
  const written = [];
  /** @type {Array<{file: string, error: string}>} */
  const failed = [];
  for (const file of files) {
    try {
      // readJsonFile tolerates a leading BOM (F-118) — captured describe
      // payloads routinely arrive through PowerShell redirects on Windows.
      const payload = readJsonFile(file);
      const { id, doc } = render(payload);
      // case-insensitive: distinct ids collide as filenames on Windows/macOS
      // (F-125); the shared claimer suffixes -dup on every OS, keyed on disk
      // as well as this run (F-156)
      const base = claimName(id);
      const path = resolve(outDir, `${base}.md`);
      writeFileSync(path, doc, "utf8");
      written.push({ id, path: `${outDir.replace(/\\/g, "/").replace(/\/$/, "")}/${base}.md`, bytes: Buffer.byteLength(doc) });
    } catch (e) {
      failed.push({ file, error: e instanceof Error ? e.message : String(e) });
    }
  }
  helpers.out({ ok: failed.length === 0, written, failed });
  process.exitCode = written.length === 0 && failed.length ? 1 : 0;
}

// ── Catalog discovery + command-line resolution (F-232) ──────────────────────
// The workspace-catalog search and the command-line → catalog-command
// resolution existed as three near-verbatim copies under "keep in sync"
// comments — describe-batch.mjs, domain-candidates.mjs, and the guard hook —
// and the copies had already diverged. The two SCRIPTS now share these; the
// guard hook CANNOT import (its PreToolUse path is deliberately
// self-contained — the tenet is documented at the top of gs-admin-guard.mjs)
// and keeps its own copy, with a comment naming this one — keep the pair in
// sync by hand.
//
// Search rule: walk up from startDir to the FIRST directory containing
// .gs-superadmin, try that one workspace catalog, then the bundled fallback.
// A file parsing to null/0/false is corrupt, not a catalog — the next source
// is still tried. Returns null when no source yields a catalog (callers
// fail-closed).
// The F-232 workspace walk-up, as its own export (GP-B5 W5 review round —
// readAliasConvention was about to become the walk's third hand copy): the
// nearest ancestor of startDir carrying `.gs-superadmin/`, or null. The
// start dir is resolved first so a relative path walks the real ancestor
// chain instead of terminating at ".". The guard hook's copy stays the
// tenet-locked exception (R-1: it imports nothing).
export function findWorkspaceDir(startDir) {
  let dir = resolve(String(startDir));
  for (;;) {
    if (existsSync(join(dir, ".gs-superadmin"))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

export function findWorkspaceCatalog(startDir, bundledCatalogPath) {
  const wsDir = findWorkspaceDir(startDir);
  const sources = [];
  if (wsDir) sources.push(join(wsDir, ".gs-superadmin", "catalog.json"));
  if (bundledCatalogPath) sources.push(bundledCatalogPath);
  for (const p of sources) {
    try {
      const parsed = readJsonFile(p); // BOM-tolerant (F-118)
      if (!parsed) continue; // corrupt-but-parseable → try the next source
      return parsed;
    } catch { /* unreadable → try the next source */ }
  }
  return null;
}

// Command-line → catalog-command resolution over a loaded catalog: builds the
// valued-global-flag set, the namespace⇄alias maps, and the known-path table
// (canonical + short spellings), and resolves token sequences by skipping flag
// tokens (a valued GLOBAL flag consumes its value; a trailing per-command
// flag's value survives as a junk token but is neutralized by the
// longest-PREFIX match), then looking the token path up under its own
// spelling and the namespace-alias substitutions. resolveTokens takes
// argv-style tokens with the program word already removed and returns
// { cmd, rest }; resolveLine takes a recorded command line (e.g.
// "gs-admin --json sc m list --limit 10000"), dropping the program word
// launcher-suffix-tolerantly (F-120: Windows sessions record `GS-Admin.CMD`).
export function makeCommandResolver(catalog) {
  const valueFlags = new Set();
  for (const gf of catalog.globalFlags ?? []) {
    if (gf.flag && /[<[]/.test(gf.flag)) valueFlags.add(gf.flag.split(/[\s=<[]/)[0]);
  }
  const aliasToNs = new Map();
  const nsToAlias = new Map();
  const namespaceNames = new Set();
  for (const d of catalog.domains ?? []) {
    if (d.namespace) namespaceNames.add(d.namespace);
    for (const a of d.aliases ?? []) {
      aliasToNs.set(a, d.namespace);
      namespaceNames.add(a);
    }
    if (d.aliases?.length) nsToAlias.set(d.namespace, d.aliases[0]);
  }
  const known = new Map();
  let maxWords = 1;
  for (const cmd of catalog.commands ?? []) {
    for (const p of [cmd.path, cmd.shortPath]) {
      if (!p) continue;
      known.set(p, cmd);
      maxWords = Math.max(maxWords, p.split(" ").length);
    }
  }
  const resolveTokens = (tokens) => {
    const rest = [];
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.startsWith("-")) {
        if (valueFlags.has(t.split("=")[0]) && !t.includes("=")) j++; // skip flag value
        continue;
      }
      rest.push(t);
    }
    if (!rest.length) return { cmd: null, rest };
    const spellings = [rest];
    if (aliasToNs.has(rest[0])) spellings.push([aliasToNs.get(rest[0]), ...rest.slice(1)]);
    if (nsToAlias.has(rest[0])) spellings.push([nsToAlias.get(rest[0]), ...rest.slice(1)]);
    for (const cand of spellings) {
      for (let n = Math.min(maxWords, cand.length); n >= 1; n--) {
        const cmd = known.get(cand.slice(0, n).join(" "));
        if (cmd) return { cmd, rest };
      }
    }
    return { cmd: null, rest };
  };
  const resolveLine = (line) => {
    const tokens = String(line).trim().split(/\s+/);
    if (tokens.length && stripLauncherSuffix(tokens[0]) === "gs-admin") tokens.shift();
    return resolveTokens(tokens).cmd;
  };
  return { known, valueFlags, aliasToNs, nsToAlias, namespaceNames, maxWords, resolveTokens, resolveLine };
}

// ── Recorded-domain resolution (F-429) ───────────────────────────────────────
// A domain NAME is per-workspace data: setup's naming rule fixes the shape,
// the operator's manifest fixes the spelling, and two workspaces built by this
// plugin disagree (`connections` / `connector-jobs` / `report-reports` on one,
// `connectors` / `connectors-jobs` / `report` on the other). The identity of a
// domain is the list command it was indexed from — domains_indexed[<name>]
// .listCommand — resolved to its canonical catalog path. Every consumer that
// needs "the connections domain" asks this table, never a hardcoded name:
// tenant-deps (three lanes read 0 docs on the first workspace, with no
// caveat), relationships-build's defaults, and domain-candidates' diff, which
// owned this fold inline before the hoist.
/**
 * @param {unknown} domainsIndexed  manifest.domains_indexed (any shape; tolerated)
 * @param {(line: string) => ({path: string} | null | undefined)} resolveLine  makeCommandResolver(catalog).resolveLine
 * @returns {{ byPath: Map<string, string[]>, legacyDomains: string[], unresolved: Array<{domain: string, listCommand: string}> }}
 *   byPath: canonical path → recorded domain names; legacyDomains: stamps with no
 *   listCommand; unresolved: recordings this catalog cannot resolve (a renamed
 *   or removed command)
 */
export function recordedDomainsByPath(domainsIndexed, resolveLine) {
  const byPath = new Map();
  const legacyDomains = [];
  const unresolved = [];
  const di = domainsIndexed && typeof domainsIndexed === "object" ? domainsIndexed : {};
  for (const [domain, stampRaw] of Object.entries(di)) {
    const stamp = stampRaw && typeof stampRaw === "object" ? stampRaw : {};
    const lc = typeof stamp.listCommand === "string" ? stamp.listCommand : null;
    if (!lc) {
      legacyDomains.push(domain);
      continue;
    }
    const cmd = resolveLine(lc);
    if (!cmd) {
      unresolved.push({ domain, listCommand: lc });
      continue;
    }
    if (!byPath.has(cmd.path)) byPath.set(cmd.path, []);
    byPath.get(cmd.path).push(domain);
  }
  return { byPath, legacyDomains, unresolved };
}

// ── The lane table: the ONE home of "which list command is a lane, and what its
// folder is called when nothing is recorded" (F-429 fourth pass). Every reader
// derives its lanes and defaults from here — tenant-deps, the relationships
// builder, jo-report, er-gaps, describe-batch's doc-mode — and
// build/check-doc-drift.mjs reads the `folder:` literals out of THIS source
// text (the build lane may not import the plugin) to refuse any runnable line
// in a skill or template that names one of them where the workspace's
// recording decides the name. Five hand-kept copies of this table, and a
// sibling sweep that was a grep rather than an enumeration of runnable lines,
// are what let three passes each miss one shape. A script may alias the keys
// it reports (tenant-deps says `journeys`); the values come from here.
export const RECORDED_LANES = Object.freeze({
  rules: { path: "rules-engine rules list", folder: "rules-engine" },
  chains: { path: "rules-engine chains list", folder: "rules-engine-chains" },
  extActions: { path: "rules-engine rules list-external-actions", folder: "rules-engine-external-actions" },
  journey: { path: "journey programs list", folder: "journey" },
  templates: { path: "journey email templates", folder: "journey-email-templates" },
  datasets: { path: "journey data-designer list", folder: "journey-data-designer" },
  reports: { path: "report list", folder: "report" },
  jobs: { path: "connectors jobs", folder: "connectors-jobs" },
  connections: { path: "connectors list", folder: "connectors" },
  designers: { path: "data-designer templates list", folder: "data-designer" },
  scorecards: { path: "scorecard list", folder: "scorecard" },
});
/**
 * A script's lane subset as the resolver's two inputs, keyed the way that
 * script reports them.
 * @param {Record<string, keyof typeof RECORDED_LANES>} map  reported key → lane
 * @returns {{ lanes: Record<string, string>, defaults: Record<string, string> }}
 */
export function laneTable(map) {
  const lanes = {};
  const defaults = {};
  for (const [key, lane] of Object.entries(map)) {
    const row = RECORDED_LANES[lane];
    if (!row) throw new Error(`laneTable: no lane "${lane}" in RECORDED_LANES`);
    lanes[key] = row.path;
    defaults[key] = row.folder;
  }
  return { lanes, defaults };
}

/**
 * The one resolver every KB reader uses for "which folder is the <lane>
 * domain" (F-429): lane → canonical list path → the domain recorded from that
 * command → its folder name; the literal default only when nothing is
 * recorded. Callers: tenant-deps (nine lanes), relationships-build (five),
 * jo-report and er-gaps (journey + templates), describe-batch (the inverse,
 * through recordedDomainsByPath directly). One home, so a workspace that
 * spelled a domain differently is read the same way by every surface.
 * Two domains recording ONE list (a probe registration beside the real domain,
 * a half-finished rename) are an ambiguity the resolver reports and then
 * decides by evidence, never by spelling alone (F-429 second pass — on the
 * first workspace the real domain won only because it sorted first): the
 * domain holding inventory entries, else the one whose folder holds docs on
 * disk, else the first by name. The warning names which rung decided.
 * The warnings are HONESTY SIGNALS, not diagnostics: every caller carries
 * them to every surface it writes (the stdout summary, the markdown report,
 * the CSV/XLSX caveats) — consumer-parity, F-429's reopen reason.
 * @param {object} args
 * @param {string} args.startDir  where the workspace catalog search starts (walks up to .gs-superadmin); also the KB root the folder rung looks under
 * @param {unknown} args.domainsIndexed  manifest.domains_indexed
 * @param {unknown} [args.inventory]  manifest.inventory — the first tie-break rung; omit and the rung counts nothing
 * @param {Record<string, string>} args.lanes     laneKey → canonical list path
 * @param {Record<string, string>} args.defaults  laneKey → literal folder name (the no-recording fallback)
 * @param {Record<string, string | null | undefined>} [args.overrides]  laneKey → an explicit --<lane>-domain flag value; a
 *   lane with one is read from that folder with basis "flag --<lane>-domain" and produces NO recording warning —
 *   the resolver, not each caller, decides what was read, so every surface that quotes its warnings agrees
 *   with its basis (release-gate review of 0.37.0, F-434)
 * @param {string} args.bundledCatalogPath  the plugin's reference/catalog.json
 * @returns {{ dirs: Record<string, string>, basis: Record<string, string>, warnings: string[] }}
 *   basis per lane: "manifest recording" | "manifest recording (ambiguous)" | "flag --<lane>-domain" |
 *   "default (no recording)" | "default (no catalog)" | "default (list path not in this catalog)"
 */
export function resolveRecordedDomains({ startDir, domainsIndexed, inventory = null, lanes, defaults, overrides = {}, bundledCatalogPath }) {
  const dirs = { ...defaults };
  const basis = Object.fromEntries(Object.keys(lanes).map((k) => [k, "default (no recording)"]));
  const warnings = [];
  const flagged = new Set();
  for (const [lane, value] of Object.entries(overrides ?? {})) {
    if (value == null || !(lane in lanes)) continue;
    dirs[lane] = String(value);
    basis[lane] = `flag --${lane}-domain`;
    flagged.add(lane);
  }
  const catalog = findWorkspaceCatalog(startDir, bundledCatalogPath);
  if (!catalog) {
    for (const k of Object.keys(basis)) basis[k] = "default (no catalog)";
    warnings.push(
      "no catalog found (workspace .gs-superadmin/catalog.json or the plugin's bundled copy) — KB folders were read by their DEFAULT names, not from the manifest's recordings; a workspace whose domain names differ from the defaults reads empty lanes here"
    );
    return { dirs, basis, warnings };
  }
  const { known, resolveLine } = makeCommandResolver(catalog);
  const { byPath } = recordedDomainsByPath(domainsIndexed, resolveLine);
  // Inventory entries per domain (null-prototype: domain names are manifest data).
  const entriesByDomain = Object.create(null);
  for (const e of Object.values(inventory && typeof inventory === "object" ? inventory : {})) {
    if (e && typeof e === "object" && typeof e.domain === "string") entriesByDomain[e.domain] = (entriesByDomain[e.domain] ?? 0) + 1;
  }
  const docsOnDisk = (name) => (listMdFiles(join(startDir, name)) ?? []).length;
  // Among several domains recording one list: most inventory entries, else
  // docs on disk, else first by name — and say which rung decided.
  const pick = (names) => {
    const ranked = names.map((name) => ({ name, entries: entriesByDomain[name] ?? 0, docs: docsOnDisk(name) }));
    ranked.sort((a, b) => b.entries - a.entries || b.docs - a.docs || (a.name < b.name ? -1 : 1));
    const top = ranked[0];
    const why =
      top.entries > 0 && top.entries > (ranked[1]?.entries ?? 0) ? `it holds ${top.entries} inventory entr${top.entries === 1 ? "y" : "ies"}`
        : top.docs > 0 && top.docs > (ranked[1]?.docs ?? 0) ? `its folder holds ${top.docs} doc(s) on disk`
          : "first by name — no inventory entries or docs on disk separate them";
    return { name: top.name, why };
  };
  const moved = [];
  for (const [lane, path] of Object.entries(lanes)) {
    if (flagged.has(lane)) continue; // an explicit flag decided this lane — no recording warning applies
    if (!known.has(path)) {
      basis[lane] = "default (list path not in this catalog)";
      warnings.push(`lane ${lane}: list path "${path}" is not in the installed catalog — folder ${defaults[lane]} read by default name`);
      continue;
    }
    const names = (byPath.get(path) ?? []).slice().sort();
    if (!names.length) continue;
    const chosen = names.length === 1 ? { name: names[0], why: null } : pick(names);
    dirs[lane] = chosen.name;
    basis[lane] = names.length === 1 ? "manifest recording" : "manifest recording (ambiguous)";
    if (names.length > 1)
      warnings.push(`lane ${lane}: ${names.length} domains record "${path}" (${names.join(", ")}) — reading ${chosen.name} (${chosen.why}); the others are not scanned`);
    if (chosen.name !== defaults[lane]) moved.push(`${lane} → ${chosen.name} (default ${defaults[lane]})`);
  }
  if (moved.length) warnings.push(`KB folders resolved from the manifest's recordings, differing from the defaults: ${moved.join("; ")}`);
  return { dirs, basis, warnings };
}

/**
 * Which domains already hold each of these ids — the global overlap test
 * ("already indexed ANYWHERE", never "in the domain this name suggests").
 * domain-candidates' check verb decides candidates with it (hoisted here in
 * the F-429 round so the fold has one home). It is an OPERATOR signal, not an
 * unattended refusal: id values are unique per asset type, not globally —
 * name-keyed domains share names — so upsert-batch's renamed-domain guard
 * keys on the run's recording flags instead. Null-prototype counts (F-225):
 * domain names are manifest data.
 * @param {unknown} inventory  manifest.inventory
 * @param {Iterable<string|number>} ids
 * @param {?string} [excludeDomain]  the domain being written — its own entries are not "elsewhere"
 * @returns {{ matches: Array<{id: string, domains: string[]}>, byDomain: Record<string, number> }}
 */
export function indexedElsewhere(inventory, ids, excludeDomain = null) {
  const idDomains = new Map(); // id → Set of domains holding it
  const inv = inventory && typeof inventory === "object" ? inventory : {};
  for (const e of Object.values(inv)) {
    if (!e || typeof e !== "object" || e.id == null) continue;
    if (typeof e.domain === "string" && e.domain === excludeDomain) continue;
    const id = String(e.id);
    if (!idDomains.has(id)) idDomains.set(id, new Set());
    if (typeof e.domain === "string") idDomains.get(id).add(e.domain);
  }
  const byDomain = Object.create(null);
  const matches = [];
  for (const id of new Set([...ids].map(String))) {
    const doms = idDomains.get(id);
    if (!doms) continue;
    matches.push({ id, domains: [...doms].sort() });
    for (const d of doms) byDomain[d] = (byDomain[d] ?? 0) + 1;
  }
  return { matches, byDomain };
}

// ── Read-only command gate + CLI resolution (B5 W4/DS-17 hoist) ──────────────
// The two scripts that SPAWN gs-admin themselves — describe-batch.mjs and
// capture.mjs — are both invisible to the mutation guard hook (the embedded
// command never appears as a bare `gs-admin …` line the guard's matcher can
// see), so each must gate the command it is about to run, fail-closed. The
// gate and the CLI-entry resolution lived inline in describe-batch; shipping
// a second spawn-capable script by copying them would have re-opened the
// fix-one-writer-miss-the-sibling class (F-284) on a SAFETY surface, so both
// were hoisted here (A-1). describe-batch's suite pins every refusal message
// through the hoist (the pre-existing lock, A-6); capture's suite pins its
// own parameterization independently.
//
// Checks, in order (rationale + upstream history: describe-batch.mjs's
// "Read-only enforcement" comment, the block's original home):
//   1. unresolved command → refuse (fail-closed; run it directly, where the
//      guard can arbitrate);
//   2. catalog `mutating: true` → refuse;
//   3. hooks/ask-overrides.json match → refuse OUTRIGHT (verified upstream
//      mislabels; `unlessArgPresent` deliberately NOT honored — a run-now
//      template has no business in an unattended batch even in its safe mode);
//   4. positive read-shape constraint — the caller's `isRead(verb, matched)`
//      predicate must admit the resolved action (a non-mutating catalog flag
//      is NOT read-only enforcement; the predicate is each caller's policy);
//   5. declared PUT/DELETE/PATCH endpoint → refuse, independent of naming.
// The catalog `mutating` flag alone is NOT read-only enforcement, even now
// that upstream closed the mislabeled-writer class at CLI 1.0.8 (the counting
// rule — catalog `mutating: false` AND a declared PUT/DELETE/PATCH endpoint —
// went 29 → 0; counting POSTs too, 59 → 20, all 20 read-shaped fetches
// reviewed upstream; check-stale-facts pins both counts here). Checks 4 and 5
// predate that fix and stay as the forward guard against a future mislabel.
// `shapeNoun`/`runsNoun` parameterize the caller-specific message fragments
// ("a describe-shaped read" / "read-only describes") so each script's refusals
// keep naming what IT does.
// The shared per-item/scheduling read-verb allowlist BOTH spawn-capable
// scripts build their read-shape policy on (review round, B5 W4: each script
// carried its own copy, re-opening beside the hoist the exact sibling class
// the hoist closed — and the adoption-time re-audit tripwire pinned only one
// copy). The constraint is the action VERB, not "declares a GET endpoint":
// `jo p describe` is POST-only and a legitimate, shipped describe, so a GET
// requirement would refuse the whole journey lane. This set admits the
// read actions in the v1.0.9 catalog beyond the describe/list name shapes — the
// two per-item describes under other names (`jo e template`, `sc measures`),
// `jo dd get`, `jo s get`, the two `list-and-describe` combos, and the six
// scheduling/Events-Framework reads added at 1.0.6 — and is re-audited by
// hand at each CLI adoption (check-stale-facts pins the version stamp in
// this sentence). Callers COMPOSE on it: describe-batch adds the
// describe-shape regex; capture adds list shapes and `check`.
export const READ_VERB_EXACT = new Set([
  "template", "measures", "get", "list-and-describe",
  "schedules", "topics", "events", "s3-tasks", "event-curl",
]);

// Argv hygiene for a command a spawn-capable script is about to run — shared
// for the same F-284 reason as the gate below (review round: the first-token
// and operator checks were copied between the two scripts, and the operator
// set had ALREADY drifted from the guard's superset). The first token must be
// gs-admin (launcher-suffix-tolerant, F-120 — Windows sessions record
// `GS-Admin.CMD`); the spelling is only ever MATCHED, execution resolves the
// real CLI via resolveCliArgv. No shell ever runs the argv, so a shell
// operator among the tokens means pasted shell syntax — refused loudly
// rather than handed to the CLI as a literal argument. The operator set is
// the guard's superset (gs-admin-guard.mjs keeps its own self-contained
// copy — keep the two in sync by hand): exact-token matches can only come
// from pasted shell text, so THOSE cannot false-positive on real argument
// values. The PREFIX rule below CAN (release-gate round): a real value that
// starts with an operator character — an asset name beginning "|" or "<"
// fed to --search — is indistinguishable from an operator glued to its
// operand (`>out.json`), and admitting values-after-flags would let a
// pasted `--search >file` run a real capture with a wrong literal filter
// at exit 0. So a leading-operator value stays REFUSED (fail-closed), and
// the message names that case plus the guard-arbitrated direct run as the
// workaround. `commandNoun` names the caller's command slot in messages;
// `captureHint` is the caller's trailing sentence on the operator refusal.
const PLAIN_CMD_OPERATORS = new Set([
  "&&", "||", ";", "|", "&", ">", ">>", "<", "2>", "2>&1", "(", ")", "`", "{", "}",
]);
export function assertPlainGsAdminCommand({ tokens, fail, printable, commandNoun, captureHint }) {
  const bin0 = tokens[0];
  const bin0Base = stripLauncherSuffix(bin0);
  if (bin0Base !== "gs-admin") {
    // A path-prefixed binary would be silently ignored (execution resolves
    // the CLI itself) — refuse rather than run a different binary than named.
    if (bin0Base.endsWith("/gs-admin") || bin0Base.endsWith("\\gs-admin")) {
      fail(
        `${commandNoun} names a specific binary ("${printable(bin0, 40)}") but this script resolves ` +
          `the CLI itself — write plain "gs-admin" and pass the binary via --bin`
      );
    }
    fail(`${commandNoun} must be a single gs-admin invocation (got "${printable(bin0, 40)}")`);
  }
  for (const t of tokens) {
    if (PLAIN_CMD_OPERATORS.has(t) || /^[;&|<>]/.test(t)) {
      // An unsubstituted doc placeholder (`<object>`) trips the `<` prefix —
      // name that likely cause so the operator hunts the right bug (review
      // round: the plain refusal sent readers hunting for a redirect).
      const placeholderHint = /^<[^<>]*>$/.test(t)
        ? ` (this token looks like an unsubstituted <placeholder> from a doc example — substitute the real value)`
        : "";
      // A prefix-only match may be a REAL value that starts with an operator
      // character (see the header comment) — name that case and its
      // workaround instead of sending the operator hunting for a pipe.
      const valueHint = !placeholderHint && !PLAIN_CMD_OPERATORS.has(t)
        ? ` (if this is a real argument value that happens to start with an operator character —` +
          ` e.g. an asset name beginning "|" — this script cannot tell it from pasted shell` +
          ` syntax; run the command directly, where the mutation guard arbitrates)`
        : "";
      fail(
        `${commandNoun} must be one plain gs-admin command — no pipes, chains, or redirection ` +
          `("${printable(t, 20)}")${placeholderHint}${valueHint}. ${captureHint}`
      );
    }
  }
}

const GATE_WRITE_METHODS = new Set(["PUT", "DELETE", "PATCH"]);
export function assertReadOnlyCommand({ matched, rest, hooksDir, fail, printable, isRead, shapeNoun, runsNoun }) {
  const name = () => printable(matched?.path ?? rest.join(" "), 60);
  if (!matched) {
    fail(
      `command "${printable(rest.join(" "), 60)}" is not in the catalog — refusing (fail-closed). ` +
        `Run it directly so the mutation guard can arbitrate, or re-run setup to regenerate the workspace catalog.`
    );
  }
  if (matched.mutating) {
    fail(
      `command "${name()}" is MUTATING — this script runs ${runsNoun} only. ` +
        `Run mutations directly, where the guard prompts for approval.`
    );
  }
  // JSON boundary: the file's shape is the hook's (register R-7), read as
  // data — nothing past the parse is trusted: the list is admitted only if
  // it IS an array (the hook's own guard, gs-admin-guard.mjs; a non-array
  // value used to throw "not iterable" here while the hook read it as no
  // overrides — W8.5 review), each row only past the string checks below.
  /** @type {{overrides?: unknown} | null} */
  let overrides = null;
  try {
    // BOM-tolerant (readJsonFile, F-118/F-204): a Windows editor that re-saves
    // an installed copy of ask-overrides.json with a BOM must not silently
    // no-op this gate.
    overrides = readJsonFile(join(hooksDir, "ask-overrides.json"));
  } catch { /* absent or malformed → the shape + method gates below still apply */ }
  for (const o of Array.isArray(overrides?.overrides) ? overrides.overrides : []) {
    if (!o || typeof o.path !== "string") continue;
    if (o.path !== matched.path && o.path !== matched.shortPath) continue;
    if (o.whileCatalogMutatingIs !== matched.mutating) continue; // self-retiring, same rule as the hook
    fail(
      `command "${name()}" is on the ask-override list — the catalog ` +
        `marks it non-mutating but it was verified to WRITE to the tenant` +
        (typeof o.reason === "string" ? ` (${printable(o.reason, 200)})` : "") +
        `. This script runs ${runsNoun} only; run it directly, where the guard prompts for approval.`
    );
  }
  // Derive the verb from the resolved catalog path rather than the entry's
  // `name` field: a hand-trimmed workspace catalog may carry only
  // path/shortPath/mutating. `matched` rides along for callers whose policy
  // also reads actionKey (absent on trimmed catalogs — predicates must
  // tolerate that).
  const resolvedVerb = String(matched.path ?? matched.shortPath ?? rest.join(" ")).trim().split(/\s+/).pop();
  if (!isRead(resolvedVerb, matched)) {
    fail(
      `command "${name()}" is not ${shapeNoun} ` +
        `(action "${printable(String(resolvedVerb ?? ""), 40)}") — this script runs ${runsNoun} only. ` +
        `A non-mutating catalog flag is not read-only enforcement: this gate admits known read shapes and ` +
        `refuses the rest (the old mislabeled-writer class closed upstream at CLI 1.0.8; the gate stays as ` +
        `the forward guard). Run anything else directly, where the guard can arbitrate.`
    );
  }
  const writeEndpoints = (matched.endpoints ?? []).filter((e) => GATE_WRITE_METHODS.has(e?.method));
  if (writeEndpoints.length) {
    fail(
      `command "${name()}" declares a ` +
        `${printable(writeEndpoints.map((e) => e.method).join("/"), 24)} endpoint — it writes to the tenant ` +
        `despite its non-mutating catalog flag. Refusing; run it directly, where the guard can arbitrate.`
    );
  }
}

// Resolve how to run the CLI — returns an argv prefix array (no shell — the
// caller appends command args verbatim). Hoisted from describe-batch.mjs with
// its history intact: launcher shims cannot be spawned without a shell (Node's
// CVE-2024-27980 hardening throws EINVAL per spawn), and the old behavior was
// worse than a crash — every asset marked failed with an opaque "spawn EINVAL"
// and the batch exiting 0 (F-119). Refuse shims up front, before any spawn.
// Deliberately NOT shell:true — substituted values carry tenant asset names
// (untrusted, tenet 4) and cmd.exe quoting is not reliably escapable. On win32
// the EXTENSIONLESS npm shim (a POSIX sh script) is just as unspawnable — a
// direct spawn ENOENTs, the same opaque failure class (F-150); anything that
// is neither a JS entry nor .exe is refused there. POSIX keeps spawning
// extensionless shims — they work there, but only when actually on PATH
// (F-192: an unconditional `["gs-admin"]` fallback masked a missing install
// until the first spawn). Both OSes fail-closed, loudly, at resolve time.
// Callers keep resolution LAZY unless --bin was passed (F-192) — the shim
// refusals stay up-front, a bounded no-op stays CLI-independent.
/**
 * @param {{binOpt?: string, fail: FailFn}} args
 * @returns {string[]}
 */
export function resolveCliArgv({ binOpt, fail }) {
  if (binOpt) {
    const p = resolve(binOpt);
    if (!existsSync(p)) fail(`--bin not found: ${p}`);
    if (
      /\.(cmd|bat|ps1)$/i.test(p) ||
      (process.platform === "win32" && !/\.(mjs|cjs|js|exe)$/i.test(p))
    ) {
      fail(
        `--bin points at a launcher shim (${p}) that cannot be spawned without a shell — ` +
          `pass the CLI's JS entry instead (e.g. <npm-root>/@gainsight/gs-admin-cli/dist/index.js), ` +
          `or omit --bin to let this script resolve it via \`npm root -g\``
      );
    }
    return /\.(mjs|cjs|js)$/i.test(p) ? [process.execPath, p] : [p];
  }
  try {
    const npmRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    const pkgDir = join(npmRoot, "@gainsight", "gs-admin-cli");
    const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.["gs-admin"] ?? Object.values(pkg.bin ?? {})[0];
    if (bin) {
      const entry = join(pkgDir, bin);
      if (existsSync(entry)) return [process.execPath, entry];
    }
  } catch { /* fall through */ }
  if (process.platform !== "win32") {
    for (const d of (process.env.PATH ?? "").split(":")) {
      if (!d) continue;
      try { accessSync(join(d, "gs-admin"), fsConstants.X_OK); return ["gs-admin"]; } catch { /* keep looking */ }
    }
  }
  // `return` because a destructured parameter is not an explicit annotation
  // to the checker, so `fail(...)` alone is not seen as never-returning
  // (DS-46 strict list); fail exits before any value could be returned.
  return fail("could not resolve the gs-admin JS entry via `npm root -g` — pass --bin <path-to-gs-admin.js>");
}

// Sorted list of .md file paths directly in dir, or null when dir is missing or
// unreadable (the caller decides whether that is a warning or an empty set).
export function listMdFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => join(dir, f));
  } catch {
    return null;
  }
}

// ── Portability primitives (the OS-portability layer — see the header) ────────
// Each rule below exists because operating systems disagree; each lives HERE
// and only here. The sanctioned duplicates, each named by its FULL
// repo-root-relative path on a single line — check 9's prose lock matches
// whole paths, so a basename mention of a twin cannot stand in for an entry
// (F-199) — (F-151/F-158 — each copy carries a sync comment naming this file,
// and vice versa where relevant):
//   - plugins/gs-superadmin/hooks/gs-admin-guard.mjs, whose PreToolUse path
//     deliberately imports nothing (declared + enforced: build/check-imports.mjs);
//   - the dual-lane emitters build/extract-catalog.mjs and
//     build/render-cheatsheet.mjs (import-free by the same declaration)
//     and their generated verbatim plugin copies
//     plugins/gs-superadmin/scripts/extract-catalog.mjs and
//     plugins/gs-superadmin/scripts/render-cheatsheet.mjs;
//   - the build lane's shared module build/lib.mjs, whose BOM-tolerant
//     readJsonFile is the strip copy every other build-lane reader imports
//     (F-204; build/ cannot import this file — the two per-reader copies it
//     replaced were retired into it at B5 W3/DS-16; the dual-lane emitter
//     build/extract-catalog.mjs above keeps its own tenet-locked copy) and
//     whose isMainModule is the lane's copy of the CLI-entry realpath test
//     below (GP-B5 W8/DS-47: it guards the two markdown generators' mains so
//     their renderer layers import side-effect-free for the T-9 grammar pins
//     in build/test-wiki-html.mjs — one shared grammar since T-9 v4);
//   - the skill-local
//     plugins/gs-superadmin/skills/change-request/scripts/validate-request-event.mjs
//     (F-130);
//   - plugins/gs-superadmin/scripts/journal-lib.mjs's codePointSlice
//     (F-157/F-158), because that file must import NOTHING: the guard hook
//     imports it lazily as a unit, so a syntax error here would otherwise take
//     the guard's journaling lane down;
//   - plugins/gs-superadmin/scripts/plugin-link.mjs's lstat is-a-link gate
//     (GP-B5 DS-43): the workspace plugin-link writer is builtins-only by
//     declaration (it runs at every plugin session start), so it spells the
//     reparse-point test itself — to decide whether `.gs-superadmin/plugin`
//     IS a link before its one removal call, never to follow a dirent;
//   - plugins/gs-superadmin/scripts/jo-report.mjs's error-reporting
//     fence-parse variant (DS-24 review round): it consumes the raw
//     extractFencedJson primitive and records the JSON error's text into
//     parseErrors (A-4) instead of collapsing to parseDocJson's null signal —
//     a deliberate second consumer of the raw primitive, not a regrown copy;
//   - the KB-doc envelope rule's four read-side homes (T-3 v4, GP-B5 DS-42 —
//     the one-level `data` unwrap is spelled at each consumer because each
//     reads a different payload family; the T-3 header above enumerates them
//     and check 9's "KB-doc envelope unwrap" row keeps that list complete):
//     plugins/gs-superadmin/scripts/describe-batch.mjs,
//     plugins/gs-superadmin/scripts/jo-report.mjs,
//     plugins/gs-superadmin/scripts/jo-report-deps.mjs and
//     plugins/gs-superadmin/scripts/tenant-deps.mjs.
// Adding a copy means adding it to this list AND naming it from the primitive
// it copies — this list has now gone stale twice (F-151, F-158) and is now
// mechanically enforced by build/check-doc-drift.mjs check 9 (F-159; full-path
// matching per F-199): an unlisted copy, a listed file that stops defining its
// rule, or an entry this enumeration stops naming all go red in CI.

// ── T-7 · IO-boundary primitives ─────────────────────────────────────────────
/**
 * FROZEN (B5 P1, 2026-08-16; v2 B1, 2026-08-16; scheduled amendment A2
 * executed W4/B5, 2026-08-25 — the capture convention line moved to
 * route-through-the-shipped-helper, in the same PR as the helper itself).
 * The portability layer's contract surface (each rule lives HERE and only
 * here; sanctioned copies: see the enumeration above + check 9).
 *
 * @callback StripBom        (s:string) => string    exactly ONE leading U+FEFF,
 *                                                   never global (F-113)
 * @callback ReadJsonFile    (path:string) => any    BOM-tolerant JSON.parse;
 *                                                   fail direction is the CALLER's
 * @callback NormalizeText   (s:string) => string    BOM strip + CRLF→LF — run at
 *                                                   every md/doc read boundary
 * @callback ReplaceFileSync (tmp:string, dest:string) => void  bounded-retry
 *                                                   rename (win32 EPERM, F-133)
 * @callback CodePointSlice  (s:string, start:number, end:number) => string
 * @callback IsMainModule    (importMetaUrl:string) => boolean   realpaths BOTH
 *                                                   sides (F-117/F-149)
 * Conventions typed here because no code can carry them (deliberate-duplication
 * register candidates):
 *   - path joins: join(ROOT, …) — never cwd-relative reads (F-267)
 *   - spawning: argv arrays, shell:false, except npm resolution (win32 shim)
 *   - capture: PS 5.1 redirects write UTF-16/BOM — route through the shipped
 *     capture helper (scripts/capture.mjs: clean UTF-8-no-BOM write, tolerant
 *     read via --normalize); check 14 enforces routing
 */

// Single-leading-BOM strip — the same contract the guard's stdin read pins
// (F-113): exactly one leading U+FEFF, never a global strip, never "any leading
// junk". PowerShell 5.1 redirects and pipes prepend one; JSON.parse throws on it.
export const stripBom = (s) => String(s).replace(/^\uFEFF/, "");

// \u2500\u2500 dm-deps-check payload anatomy (moved here from jo-report-deps, F-320) \u2500\u2500\u2500\u2500
// The ONE parse of a captured `dm deps check` payload \u2014 every dependent area
// kept. Hosted in this shared layer because THREE surfaces must agree on the
// same bytes: both deps reports (jo-report-deps parameterizes its JO view on
// this; tenant-deps consumes it directly) AND capture.mjs --wait, whose
// import closure is doc-lib/journal-lib only and which must gate writes on
// what the readers will actually accept. Tolerant per-field, strict on the
// envelope: no `data` object or no `dependents` object \u2192 null (the caller
// warns and skips \u2014 a bad capture must never sink the KB-side report).
// Columns prefer the human displayName, falling back to the API
// fieldName/name. stripBom (F-118): --live-deps files are
// PowerShell-captured on Windows, where a leading BOM is the NORMAL case.
export function parseLiveDepsAreas(text) {
  let payload;
  try {
    payload = JSON.parse(stripBom(text));
  } catch {
    return null;
  }
  const d = payload && typeof payload === "object" ? payload.data : null;
  if (!d || typeof d !== "object") return null;
  const deps = d.dependents && typeof d.dependents === "object" ? d.dependents : null;
  if (!deps) return null;
  const areas = {};
  for (const [area, raw] of Object.entries(deps)) {
    if (!Array.isArray(raw)) continue;
    areas[area] = raw
      .filter((e) => e && typeof e === "object")
      .map((e) => ({
        id: e.entityId != null ? String(e.entityId) : null,
        name: e.entityName ?? null,
        columns: (Array.isArray(e.columnReferences) ? e.columnReferences : [])
          .filter((c) => c && typeof c === "object")
          .map((c) => c.displayName ?? c.fieldName ?? c.name)
          .filter(Boolean),
      }))
      .filter((e) => e.id != null || e.name != null);
  }
  return {
    objectName: d.objectName ?? null,
    complete: d.progressStatus?.overallStatus === "COMPLETED",
    areas,
  };
}

// The ONE readiness rule capture.mjs --wait gates on (F-320): a capture is
// ready exactly when parseLiveDepsAreas ACCEPTS it and the scan is COMPLETED
// \u2014 the predicate calls the reader, so the two can never drift (capture's
// old hand-written status probe accepted COMPLETED payloads without a
// dependents object, which the readers then skipped as unrecognizable:
// written-as-success, discarded downstream). `status` is the raw
// overallStatus when readable \u2014 for --wait's heartbeat/timeout honesty \u2014
// independent of acceptance.
export function depsCaptureReadiness(text) {
  const parsed = parseLiveDepsAreas(text);
  /** @type {string | null} */
  let status = null;
  try {
    const s = JSON.parse(stripBom(String(text)))?.data?.progressStatus?.overallStatus;
    status = typeof s === "string" ? s : null;
  } catch { /* unparseable \u2014 status stays null */ }
  return { ready: parsed != null && parsed.complete, status };
}

// ── List-page envelope scan + the rows-array DECISION (GP-B5 DS-30; gate-3 ──
// F-348/F-351; the decision moved HERE at F-354/F-355) ──────────────────────
// One walk answering what a captured list page holds and what it claims about
// the whole result set, and ONE function deciding which array is the rows
// array. Consumers: er-count.mjs (count one page) and capture.mjs --paginate
// (the page loop's stop rule and reconciliation). They share the DECISION,
// not just the traversal: the first cut of F-351 left the decision in capture
// and er-count read the scan's raw "largest array" count, so the two consumers
// of one rule disagreed on real envelopes — er-count printed a silent 0 where
// capture refused (F-354) and 98 where capture refused a bundle (F-355). The
// scan therefore no longer offers a count at all: a count exists only as the
// output of decideEntryArray, and a consumer cannot print a guess.
//
// THE SPINE. Every list envelope the CLI emits puts its rows array on the
// envelope spine — the root itself, a direct child of the root, or a direct
// child of the root's `data` — and its totals on the same spine (the root,
// `data`, or a `pageInfo` object hanging off either). Measured, not assumed:
// a read-only census of the 31 list commands runnable without a per-asset
// flag, at pin 1.0.8 on a live tenant, run twice (builder 2026-09-01, tester
// 2026-09-02, every fact computed from this scan — VALIDATION.md "gate-3 ·
// F-351"): rows at `data[]` (18), `data.<key>[]` (5), another root child (4:
// `_rows`, `objects`/`rules`/`_flatSummary` echoes), a bare root array (1);
// 3 lists empty at the time; 0 envelopes with rows OFF the spine; the only
// off-spine array anywhere an echo (`_raw.data[]` duplicating `data[]`).
//
// scanListEnvelope returns the MATERIAL: spineArrays = EVERY array on the
// spine, empty ones included (path + length, BFS order — root children before
// `data` children); offSpineArrays = non-empty arrays anywhere else (largest
// first, capped at 3); rowTotals / pageSignals as below. Arrays are MEASURED,
// never descended (a row's own nested arrays never count — er-count's
// original contract, kept). Empty spine arrays are kept on purpose (F-351
// reopen): a side block such as `rp list`'s root-level `alerts[]` is empty
// on the happy path and fills only when there is something to report, so a
// census that drops empties cannot see the one shape the ambiguity rule most
// needs evidence about. They are evidence, not candidates.
//
// decideEntryArray returns the DECISION, one of five kinds, and
// entryDecisionReason turns a refusal into the one sentence every consumer
// prints. THE MODEL (F-351 round 4, after four tunes of the same boundary —
// largest array, spine, level rank, underscore-prefix rank — each of which
// decided one unmeasured shape silently in the wrong direction; the
// tune-twice-then-redesign rule): no structural heuristic can tell the rows
// array from a side block, a bundle, or a CLI view of the rows. So the
// decision has exactly two inputs and never ranks:
//   - the rows array STATED by the caller (--items-path, the same dotted
//     path a domain's index recording carries — the skills know each
//     domain's rows path; capture does not guess it), or
//   - a spine with ONE distinct non-empty length: the single candidate, or
//     equal-length echoes (dm dropdowns `_flatDropdowns`/`data.picklistList`,
//     re list-and-describe `rules`/`_flatSummary`) — an ambiguity that
//     cannot change the count is not one.
// Everything else is refused, candidates named, largest first, no exemplar.
// The census (31 envelopes at 1.0.8, run three times) is the evidence for
// the SECOND input: every list envelope on a quiet tenant has one distinct
// non-empty length on its spine except the `jo cta options` bundle; the
// side blocks it recorded (`rp list`'s root `alerts[]`, the bundle's
// `users[]`) are EMPTY there and fill on a tenant with something to report
// — which is why the reports fence STATES its rows path.
//   rows           stated path (must be an array; may be empty), or the
//                  spine's single distinct-length candidate (first seen).
//   empty          no non-empty array anywhere: a genuinely empty page, 0.
//   ambiguous      more than one distinct non-empty length on the spine —
//                  a list with a filled side block (`rp list` + `alerts`), a
//                  bundle (`jo cta options`), a CLI view disagreeing with
//                  the payload, a columns block beside the rows: REFUSED,
//                  the same way, because the reader cannot tell them apart.
//   off-spine      no array on the spine, arrays elsewhere: a shape no census
//                  has seen; the rows may live where this scan does not look.
//                  REFUSED (a 0 here would end a sweep as a confident empty
//                  domain — F-354 was er-count still printing that 0).
//   named-missing  --items-path names no array on this page. REFUSED.
//
// Totals are collected parse-don't-validate (A-3) on the spine only: the
// root, the root's `data`, and any `pageInfo` object reached FROM the spine
// (F-348: a `pageInfo` nested under a facet used to be granted spine status by
// its key alone — the exact masquerade the rule exists to refuse). rowTotals =
// every key claiming the full row count, each with its dotted path; the
// CALLER reconciles and must treat disagreeing values as a conflict, never
// pick one silently (A-4). pageSignals = continuation/echo keys (totalPages,
// lastPage, nextAvailable, nextPage, pageNumber anywhere; returned/limit/
// pageSize only inside a pageInfo object — too generic elsewhere) PLUS
// demotions: a total-spelled key that is off-spine, non-numeric, or negative
// is reported there rather than silently dropped, but never reconciled
// against.
const ROW_TOTAL_KEYS = new Set([
  "totalRecords", "totalAfterFilters", "totalCount", "_total", "totalNumberOfObjects",
]);
const PAGE_SIGNAL_KEYS = new Set(["totalPages", "lastPage", "nextAvailable", "nextPage", "pageNumber"]);
const PAGEINFO_ONLY_KEYS = new Set(["returned", "limit", "pageSize"]);
/** @typedef {{path: string, length: number}} ArrayRef */
/**
 * @param {*} doc
 * @returns {{rowTotals: Array<{path: string, value: number}>,
 *   pageSignals: Array<{path: string, value: *}>,
 *   spineArrays: ArrayRef[], offSpineArrays: ArrayRef[]}}
 */
export function scanListEnvelope(doc) {
  const rowTotals = [];
  const pageSignals = [];
  const offSpine = [];
  const spineArrays = [];
  // Cursor-read queue: shift() on a large array is O(n) per dequeue;
  // primitives are never enqueued (they can only ever match at the parent's
  // key test) and paths are built only when something needs one. Each node
  // carries two spine facts: `spine` (totals may be read from this object's
  // scalar children) and `entryCandidate` (this array may be the rows array).
  const q = [{ v: doc, path: "", inPageInfo: false, spine: true, entryCandidate: true }];
  for (let qi = 0; qi < q.length; qi++) {
    const { v, path, inPageInfo, spine, entryCandidate } = q[qi];
    if (Array.isArray(v)) {
      if (entryCandidate) spineArrays.push({ path, length: v.length });
      else if (v.length > 0) offSpine.push({ path, length: v.length });
    } else if (v && typeof v === "object") {
      for (const k of Object.keys(v)) {
        const val = v[k];
        const isContainer = val !== null && typeof val === "object";
        const isTotalKey = ROW_TOTAL_KEYS.has(k);
        const isSignalKey = PAGE_SIGNAL_KEYS.has(k) || (inPageInfo && PAGEINFO_ONLY_KEYS.has(k));
        if (isTotalKey || isSignalKey || isContainer) {
          const childPath = path ? `${path}.${k}` : k;
          if (isTotalKey) {
            if (spine && typeof val === "number" && Number.isFinite(val) && val >= 0)
              rowTotals.push({ path: childPath, value: val });
            else pageSignals.push({ path: childPath, value: val });
          } else if (isSignalKey) {
            pageSignals.push({ path: childPath, value: val });
          }
          if (isContainer)
            q.push({
              v: val, path: childPath,
              inPageInfo: k === "pageInfo",
              // spine propagates only through `data` at the root and a
              // `pageInfo` whose parent is itself on the spine
              spine: spine && (k === "pageInfo" || (path === "" && k === "data")),
              // an array is a rows-array candidate only as a direct child of
              // the root or of the root's `data`
              entryCandidate: path === "" || path === "data",
            });
        }
      }
    }
  }
  offSpine.sort((a, b) => b.length - a.length);
  return { rowTotals, pageSignals, spineArrays, offSpineArrays: offSpine.slice(0, 3) };
}

// The dotted key path grammar --items-path accepts (capture.mjs, er-count.mjs,
// and manifest.mjs's recording all spell the rows array this way).
export const DOTTED_PATH_RE = /^[A-Za-z0-9_$][\w$]*(\.[A-Za-z0-9_$][\w$]*)*$/;

/**
 * @typedef {{kind: "rows", path: string, count: number}
 *   | {kind: "empty"}
 *   | {kind: "ambiguous", candidates: ArrayRef[]}
 *   | {kind: "off-spine", arrays: ArrayRef[]}
 *   | {kind: "named-missing", itemsPath: string, candidates: ArrayRef[]}} EntryDecision
 */
/**
 * @param {*} doc
 * @param {{itemsPath?: string}} [opts]
 * @returns {{scan: ReturnType<typeof scanListEnvelope>, decision: EntryDecision}}
 */
export function decideEntryArray(doc, { itemsPath } = {}) {
  const scan = scanListEnvelope(doc);
  const largestFirst = (xs) => [...xs].sort((a, b) => b.length - a.length);
  const nonEmpty = scan.spineArrays.filter((a) => a.length > 0);
  /** @type {EntryDecision} */
  let decision;
  if (itemsPath !== undefined) {
    const named = getPath(doc, itemsPath);
    decision = Array.isArray(named)
      ? { kind: "rows", path: itemsPath, count: named.length }
      : { kind: "named-missing", itemsPath, candidates: largestFirst(nonEmpty) };
  } else if (nonEmpty.length === 0) {
    decision = scan.offSpineArrays.length ? { kind: "off-spine", arrays: scan.offSpineArrays } : { kind: "empty" };
  } else if (new Set(nonEmpty.map((a) => a.length)).size > 1) {
    decision = { kind: "ambiguous", candidates: largestFirst(nonEmpty) };
  } else {
    decision = { kind: "rows", path: nonEmpty[0].path, count: nonEmpty[0].length };
  }
  return { scan, decision };
}

// The one sentence a refused decision prints — null for rows / empty. Every
// consumer prints THIS text (capture as the sweep's `stopped`, er-count on
// stderr), so the two can never describe one shape two ways.
/** @param {EntryDecision} d  @returns {?string} */
export function entryDecisionReason(d) {
  const arr = (a) => `${JSON.stringify(a.path)} (${a.length})`;
  switch (d.kind) {
    case "off-spine":
      return `no array on the envelope spine (root / root child / data child) but arrays exist at ` +
        d.arrays.map(arr).join(", ") +
        " — a list shape this reader does not know; nothing was counted. Inspect the page file and report the shape, or name the rows array with --items-path <dotted>";
    case "ambiguous":
      return `candidate row arrays of different lengths on the envelope spine (largest first): ` +
        d.candidates.map(arr).join(", ") +
        " — this reader cannot tell a list with a side block, a bundle of lists, or a CLI view of the rows apart, so it does not guess; nothing was counted. State the rows array with --items-path <dotted> (the path the domain's index recording carries), choosing from the candidates above";
    case "named-missing":
      return `--items-path ${d.itemsPath} names no array on this page` +
        (d.candidates.length ? ` (arrays on the envelope spine: ${d.candidates.map(arr).join(", ")})` : "") +
        " — nothing was counted; fix the path or inspect the page file";
    default:
      return null;
  }
}

// BOM-tolerant JSON file read (F-118) — for every file a USER or another tool
// may have (re)written: captured CLI payloads, manifests, config files,
// workspace catalogs. Fail direction is the caller's: this helper only removes
// the BOM false-negative, it never catches.
export function readJsonFile(path) {
  return JSON.parse(stripBom(readFileSync(path, "utf8")));
}

// POSIX single-quoting for emitted re-run/fetch hints (F-123 — six hand copies
// consolidated). Bash spelling kept deliberately: PowerShell's doubling rule
// (`''`) is NOT emitted because bash silently DROPS the apostrophe from a
// doubled quote — loud beats silent, so the hint stays bash-exact and the
// caveat below tells PowerShell users how to convert.
export const sq = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
// Quote-if-needed variant: bare tokens (POSIX paths, flags, clean ids) pass
// through so hints stay readable; anything else gets sq(). The backslash is
// deliberately NOT in the bare set (F-142): bash eats unquoted backslashes
// silently, so a bare Windows path would collapse to a still-plausible
// relative one — and the caveat detector could never fire, because no escape
// sequence is produced. Single quotes preserve backslashes verbatim.
export const shq = (s) => (/^[A-Za-z0-9_\-./:@]+$/.test(String(s)) ? String(s) : sq(s));
// One caveat line, pushed into a report's caveats section when any emitted text
// actually contains the bash apostrophe escape — detection runs on the EMITTED
// text, so the caveat can never fire for a report that quotes cleanly.
// F-371: the wording says TEXT, not "command hints". Since F-362 every mode
// scans the rerun line, the sections and the caveats alike, so the escape can
// reach a report from quoted content as well as from a hint — the old opening
// named a cause that need not be there.
export const POSIX_QUOTE_CAVEAT =
  "This report carries the bash apostrophe escape (`'\\''`) — in a command hint, in quoted " +
  "content, or both. Run command hints through the Bash tool; to paste one into PowerShell " +
  "instead, replace each `'\\''` with `''` (two single quotes) first.";
export const needsPosixQuoteCaveat = (...texts) => texts.some((t) => String(t ?? "").includes("'\\''"));

// NFC fold for every match/compare path (F-127): macOS tooling routinely emits
// NFD, so an un-normalized compare reports a clean false "no hits". Apply to
// BOTH sides of a compare, and keep matching + snippet extraction on the same
// normalized string so regex offsets stay consistent.
export const normTerm = (s) => String(s).normalize("NFC");

// Canonical compare/dedup key for user-supplied terms (F-197): NFC fold FIRST,
// then trim, then lowercase — the same chain hand-spelled at over a dozen call
// sites had drifted (raw `.toLowerCase()` producers vs eqTerm consumers), so an
// NFD or merely padded spelling made a completed `--live-deps` capture read as
// missing coverage. Route every term-keyed Set/Map and every term identity
// compare through this; keep normTerm for match/snippet paths that must stay
// case- and space-preserving.
export const termKey = (s) => normTerm(String(s)).trim().toLowerCase();

// Pinned-locale comparators (F-128): localeCompare with an undefined locale
// inherits the machine's ICU/default locale, so report row order would differ
// per machine and reports would not be diffable. "en" is a pin, not a claim of
// correct collation for every language — determinism is the contract.
// Code-unit tiebreaker (F-144): ICU treats default-ignorable codepoints (NUL,
// soft hyphen, …) as completely ignorable, so collation-equal-but-distinct
// strings would compare 0 and break the "0 only for equal inputs" expectation
// sort tiebreak chains rely on. The pinned locale still decides every
// humanly-visible ordering; the tiebreaker only breaks collation ties
// deterministically.
const cuCmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const cmpName = (a, b) => {
  const x = String(a ?? ""), y = String(b ?? "");
  return x.localeCompare(y, "en", { sensitivity: "base" }) || cuCmp(x, y);
};
export const cmpKey = (a, b) => {
  const x = String(a ?? ""), y = String(b ?? "");
  return x.localeCompare(y, "en") || cuCmp(x, y);
};

// Code-unit slice that never splits a surrogate pair (F-131): dangling halves
// at the cut edges are DROPPED — losing one visible character beats emitting
// U+FFFD into reports, CSVs, or the journal. Offsets stay code-unit-based
// (regex match indices), so this trims edges rather than re-indexing by code
// point. journal-lib.mjs keeps its own copy of this rule (F-157 — that file
// imports nothing so the guard's lazy journal import cannot fail on doc-lib's
// syntax) with a sync comment naming this one — keep the two in sync.
export function codePointSlice(s, start, end) {
  return String(s)
    .slice(start, end)
    .replace(/^[\uDC00-\uDFFF]/, "")
    .replace(/[\uD800-\uDBFF]$/, "");
}

// Launcher-suffix strip for gs-admin word matching (F-120) — the scripts' single
// copy of the rule hooks/gs-admin-guard.mjs applies in its (deliberately
// self-contained) matchers: lowercase the word, strip one .exe/.cmd/.bat/.ps1
// suffix. Keep the suffix set in sync with the guard's stripLauncherSuffix and
// its gate regex — the guard's comment names this copy.
export const stripLauncherSuffix = (name) => String(name).toLowerCase().replace(/\.(?:exe|cmd|bat|ps1)$/, "");

// CLI-entry ("run as main") test (F-117): Node's ESM loader realpath-resolves
// import.meta.url but leaves argv[1] as typed, so a bare href compare silently
// skips the CLI block for invocations through a junction/symlink (routine for
// CLAUDE_PLUGIN_ROOT: marketplace installs, OneDrive junctions, macOS /tmp) and
// the script exits 0 having done nothing. Realpath both sides — self too, not
// just argv[1]: under `node --preserve-symlinks-main` the loader keeps the
// linked spelling in import.meta.url, so a one-sided compare misses and the
// same silent no-op returns (F-149). Case-fold on win32; any resolution error
// means "not the CLI entry" (imports must never crash on a weird argv). Same
// pattern as render-cheatsheet.mjs's invokedDirectly — that file is a
// generated verbatim copy of the build/ emitter and cannot import this one,
// so it keeps its own copy by necessity.
export function isMainModule(importMetaUrl) {
  if (!process.argv[1]) return false;
  try {
    const self = realpathSync(fileURLToPath(importMetaUrl));
    const argv1 = realpathSync(resolve(process.argv[1]));
    return process.platform === "win32" ? self.toLowerCase() === argv1.toLowerCase() : self === argv1;
  } catch {
    return false;
  }
}

// Reparse-point-tolerant directory test for Dirent scans (F-134): a junction or
// symlink to a directory reports isDirectory() === false, so a tenant KB behind
// a OneDrive/Known-Folder junction would be invisible to workspace scans.
// Follow the link with statSync; a dangling link counts as not-a-directory.
// The guard hook keeps its own copy of this rule (self-containedness) with a
// sync comment naming this one.
// Accepted trades of following links (F-154 — do not "fix" either back):
// (a) a link can point OUTSIDE the workspace tree, so link-reached paths
//     (including the journal path resolved through a tenant dir) can land
//     out-of-root — that is the legitimate OneDrive/Known-Folder layout, and
//     workspace content is trusted by design (the guard documents the same
//     posture at its catalog load); (b) statSync on a DANGLING network-backed
//     junction waits out the transport timeout — zero-dep sync Node has no
//     bounded probe, and the pre-wave "skip reparse points instantly" behavior
//     was itself the F-134 defect.
export function direntIsDirectory(parentDir, dirent) {
  if (dirent.isDirectory()) return true;
  if (!dirent.isSymbolicLink()) return false;
  try {
    return statSync(join(parentDir, dirent.name)).isDirectory();
  } catch {
    return false;
  }
}

// Windows-tolerant replace/remove (F-133). renameSync over an existing target
// needs DELETE access to it on Windows — an editor, AV scanner, or sync client
// holding the file for one scan window throws EPERM/EBUSY where POSIX rename
// just wins. Retry briefly with a short synchronous backoff (Atomics.wait is
// the only zero-dep sync sleep), then rethrow LOUDLY: the retry absorbs
// transient locks only — a genuinely read-only target must still fail so the
// operator sees it, never a silent half-saved state.
const RETRYABLE_FS_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
// The one zero-dep synchronous sleep — exported so pacing loops (capture.mjs
// --wait, DS-26) share this spelling instead of re-inlining it: check 9's
// rename-retry needle keys on the Atomics spelling, so the primitive lives
// here and only here.
export function sleepMs(ms) {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function withWindowsFsRetry(op) {
  for (let attempt = 0; ; attempt++) {
    try {
      return op();
    } catch (e) {
      if (attempt >= 9 || !RETRYABLE_FS_CODES.has(e?.code)) throw e;
      sleepMs(25 * (attempt + 1));
    }
  }
}
export function replaceFileSync(from, to) {
  withWindowsFsRetry(() => renameSync(from, to));
}
// The one atomic file write (gate-3 review round, F-352): parent directory
// created, bytes written to a sibling temp file, then renamed over the target
// with the Windows retry above — so an interrupted or failed write can never
// leave a truncated file that reads as complete. Every script that OWNS a
// file's integrity writes through here (manifest.mjs's manifest + orphan list,
// capture.mjs's captures + normalize, journal.mjs's change marker); the four
// hand-spelled temp+rename copies this replaced had already drifted (the
// orphan list was a bare write with no parent mkdir). The temp name carries the
// pid so two concurrent writers of different targets never collide; `data` is
// a Buffer or a string (strings are written UTF-8, no BOM).
export function writeFileAtomicSync(target, data) {
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}`;
  writeFileSync(tmp, data);
  replaceFileSync(tmp, target);
}
export function removeFileSync(path) {
  withWindowsFsRetry(() => unlinkSync(path));
}
