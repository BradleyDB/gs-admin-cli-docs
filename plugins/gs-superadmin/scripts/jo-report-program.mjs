#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// jo-report-program.mjs — `program` mode of the JO email-report (ER-5).
//
// Program → its email content: resolve each --name to one program, then show
// its status, model, step flow, and the email templates its steps send.
// Loaded by jo-report.mjs's dispatcher (contract C3).
//
//   jo-report.mjs program --index <er-index.json> --name '<name-or-id>'
//     [--name …] [--deep] [--include-paused] --report <dir> [--csv-dir <dir>]
//
// Semantics (requirements confirmed S2, 2026-07-12):
// - Resolution ladder per --name: exact id → exact name (case-insensitive) →
//   substring (case-insensitive). Multiple matches are NEVER guessed — they
//   come back in the summary JSON's ambiguities[] for the agent to resolve
//   with the user; zero matches lands in warnings. Resolved programs still
//   report even when siblings are ambiguous.
// - SHALLOW by default ("where is it used"): one step-flow table per program,
//   one line per step, email steps showing template title + subject only.
// - --deep expands every email step into a full section: template title,
//   subject, full plain-text body inline (no truncation), variants
//   (name + subject + body), and a per-email Tokens table (token id → label →
//   bound source → default — the raw-id diagnostic surface, ER-15). Spelled
//   --deep, not --depth: "depth" stays reserved for C1's KB doc depth
//   (full|stub).
// - Tokens (ER-15, ruled P-2 2026-07-16): every rendered subject/body resolves
//   ${...} tokens through the shared resolver — the program's own step
//   bindings win, the template's author label is the fallback, unresolvable
//   ids stay raw. Applies to the step table, deep sections, and both CSVs.
// - Surveys (ER-17): each email step's bound survey (C1 boundAssets, SURVEY
//   type) renders as a step-table column (name), a `Survey: <name> (<id>)`
//   line in deep sections, and a survey_bound/survey_name/survey_id column
//   trio in program-emails.csv. No survey URLs anywhere (ruled). Multiple
//   surveys on one step comma-join.
// - CSVs are depth-independent (contract C2 v2): body_chars + the KB doc path
//   always; --addbody (ER-18, default OFF) ADDS a full-text `body` column
//   (token-resolved, variant rows included) — it never swaps columns, and a
//   run without the flag emits exactly the columns it did before.
//
// Adds mode flags --deep and --addbody on top of the C3 surface (C3 allows
// additions; recorded in the plan's as-shipped notes).
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from "node:fs";
import { join } from "node:path";
// Portability primitives (doc-lib): the one sq/shq/caveat copy (F-123).
import { sq, shq } from "./doc-lib.mjs";
import {
  parseFlags,
  C3_BOOLEAN,
  loadIndex,
  isActive,
  writeModeReport,
  mdTable,
  toCsv,
  emitSummary,
  fail,
  kbDocDisplayPath,
  renderTokens,
  stepSurveys,
  tokenMetadataCaveat,
} from "./jo-report.mjs";

// ── resolution ladder (exported for tests) ───────────────────────────────────

// A JSON.parse'd index inherits Object.prototype, so id-keyed lookups must be
// own-property checks: --name constructor must fall through to the name
// rungs, never "resolve" to a prototype member.
const own = (obj, key) => (obj != null && Object.hasOwn(obj, key) ? obj[key] : undefined);

// One --name value → { query, resolvedBy, matches[] }. Each rung only runs if
// the previous found nothing, so an exact name can never be diluted by its own
// substring matches. matches.length === 1 ⇒ resolved; >1 ⇒ ambiguity (never
// guessed); 0 ⇒ not found.
export function resolveProgram(index, query) {
  const programs = Object.values(index.programs ?? {});
  const q = String(query);
  const byId = own(index.programs, q);
  if (byId) return { query: q, resolvedBy: "id", matches: [byId] };
  const lower = q.toLowerCase();
  const exact = programs.filter((p) => (p.name ?? "").toLowerCase() === lower);
  if (exact.length) return { query: q, resolvedBy: "name", matches: exact };
  const sub = programs.filter((p) => (p.name ?? "").toLowerCase().includes(lower));
  return { query: q, resolvedBy: sub.length ? "substring" : null, matches: sub };
}

// ── per-program rendering ────────────────────────────────────────────────────

const MODEL_LABELS = { DYNAMIC_PROGRAM: "Program", DRIPV2: "Email Chain" };
const modelLabel = (p) => p.modelName ?? MODEL_LABELS[p.model] ?? p.model ?? "unknown";

// Always single-quoted (house rule: quote every value in emitted gs-admin
// commands), with embedded quotes escaped — template ids come from doc
// content and are not guaranteed shell-safe. sq is the doc-lib copy (F-123).
const FETCH_HINT = (id) => `fetch: \`gs-admin --json jo email template --id ${sq(id)}\``;

// A fenced block that cannot be broken by its own content: the fence is one
// backtick longer than the longest backtick run inside the body.
export function fencedBlock(text) {
  const longest = Math.max(2, ...[...(text ?? "").matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(longest + 1);
  return `${fence}text\n${text ?? ""}\n${fence}`;
}

// All template ids a step sends: the primary emailTemplateId plus any
// variant-mapped ids (deduped, primary first — C1 keeps them separate).
function stepTemplateIds(step) {
  const ids = [];
  if (step.emailTemplateId) ids.push(step.emailTemplateId);
  for (const v of step.variantTemplateIds ?? []) if (!ids.includes(v)) ids.push(v);
  return ids;
}

// Step-table survey cell (shared stepSurveys accessor): names only (id-only
// entries show the id), comma-joined for the rare multi-survey step. No URLs
// (ruled).
const surveyCell = (step) => stepSurveys(step).map((a) => a.name ?? a.id ?? "").filter(Boolean).join(", ");

// Token-resolution context for a template rendered inside this step: the
// program binding wins, the template author label is the fallback (ER-15).
const tokenCtx = (step, tpl) => ({ stepTokens: step?.tokens ?? null, templateTokens: tpl?.tokens ?? null });

// One-line detail cell for the shallow step-flow table.
function stepDetail(step, templates) {
  const ids = stepTemplateIds(step);
  if (ids.length) {
    const tpl = own(templates, ids[0]);
    const title = tpl?.title ?? step.emailTemplateName ?? ids[0];
    const subject = tpl?.subject ? ` — subject: ${renderTokens(tpl.subject, tokenCtx(step, tpl))}` : "";
    const noDoc = tpl ? "" : " (no KB doc)";
    const variants = ids.length > 1 ? ` (+${ids.length - 1} variant template(s))` : "";
    // a step can carry variant mappings with NO primary emailTemplateId —
    // never present its first variant as the step's primary email
    const kind = step.emailTemplateId ? "email" : "email (variant-mapped only)";
    return `${kind}: ${title}${noDoc}${subject}${variants}`;
  }
  if (step.timer != null)
    return `timer: ${
      typeof step.timer === "object"
        ? step.timer.uiTimerValue ?? step.timer.timerValue ?? JSON.stringify(step.timer)
        : step.timer
    }`;
  if (step.outboundAction) return step.outboundAction;
  if (step.actionType) return step.actionType;
  return "";
}

// The --deep per-email Tokens table (ER-15): the raw-id diagnostic surface —
// token id → label → bound source → default. Step-bound tokens first (the
// binding is the truth in program context), then template-only tokens (author
// labels, unbound). defaultValue appears here and nowhere else (ruled).
export function tokensTable(step, templates) {
  const tplTokens = new Map();
  for (const id of stepTemplateIds(step))
    for (const t of own(templates, id)?.tokens ?? [])
      if (t?.tokenKey != null && !tplTokens.has(t.tokenKey)) tplTokens.set(t.tokenKey, t);
  const rows = [];
  const seen = new Set();
  for (const t of step.tokens ?? []) {
    if (t?.tokenKey == null || seen.has(t.tokenKey)) continue;
    seen.add(t.tokenKey);
    const tt = tplTokens.get(t.tokenKey);
    let label = t.label ?? tt?.displayName ?? "—";
    let source = "—";
    if (t.kind === "field") source = `${t.objectName ?? "?"}.${t.fieldName ?? "?"}`;
    else if (t.kind === "calc") source = `calc field ${t.fieldId ?? "(id unknown)"} — source not resolvable`;
    else if (t.kind === "survey") {
      label = t.survey?.surveyName ? `Survey: ${t.survey.surveyName}` : label;
      source = `survey${t.survey?.surveyId ? ` ${t.survey.surveyId}` : ""}`;
    } else if (t.kind === "literal") source = "literal value";
    rows.push([t.tokenKey, label, source, tt?.defaultValue ?? "—"]);
  }
  for (const [key, tt] of tplTokens) {
    if (seen.has(key)) continue;
    const label = tt.survey?.surveyName ? `Survey: ${tt.survey.surveyName}` : tt.displayName ?? "—";
    rows.push([key, label, "(template author label — no program binding)", tt.defaultValue ?? "—"]);
  }
  return rows.length ? mdTable(["token id", "label", "bound source", "default"], rows) : null;
}

// Deep block for ONE template (primary or variant-mapped): subject, full
// body (token-resolved — ER-15), and the template doc's own variants.
// Missing KB doc → fetch hint instead of silence.
function templateBlock(id, templates, role, step) {
  const tpl = own(templates, id);
  const lines = [];
  if (!tpl) {
    lines.push(`- ${role} template \`${id}\`: **no KB doc — body not available**; ${FETCH_HINT(id)}`);
    return { lines, missing: true };
  }
  const ctx = tokenCtx(step, tpl);
  lines.push(`**${role} template: ${tpl.title ?? "(untitled)"}** (\`${id}\`)`, "");
  lines.push(`- subject: ${tpl.subject != null ? renderTokens(tpl.subject, ctx) : "(none)"}`);
  lines.push(`- KB doc: ${kbDocDisplayPath(tpl.docPath)}`, "");
  lines.push(tpl.bodyIncluded ? fencedBlock(renderTokens(tpl.body, ctx)) : "_KB doc is metadata-only — no captured body._");
  for (const v of tpl.variants ?? []) {
    lines.push("", `**Variant: ${v.name ?? "(unnamed)"}**`, "");
    if (v.subject) lines.push(`- subject: ${renderTokens(v.subject, ctx)}`, "");
    lines.push(fencedBlock(renderTokens(v.body, ctx)));
  }
  return { lines, missing: false };
}

// Full markdown section for one resolved program. Returns the section plus
// what the caveats/CSV builders need (email rows, missing template ids).
export function renderProgram(program, index, { deep = false, includePaused = false } = {}) {
  const templates = index.templates ?? {};
  const missingIds = new Set();
  const emailRows = []; // one row per (step, template) — the CSV's shape
  const lines = [`## ${program.name ?? "(unnamed)"} (${program.id})`, ""];
  lines.push(
    `- status: ${program.status ?? "unknown"} (${program.statusSource}) — active: ${
      isActive(program, { includePaused }) ? "yes" : "no"
    }`
  );
  lines.push(`- model: ${modelLabel(program)}${program.model ? ` (\`${program.model}\`)` : ""}`);
  if (Number.isFinite(program.startDate)) lines.push(`- start date: ${new Date(program.startDate).toISOString()}`);
  lines.push(`- KB doc: ${kbDocDisplayPath(program.docPath)}${program.depth === "stub" ? " — **stub (steps unknown)**" : ""}`, "");

  const steps = program.steps ?? [];
  if (!steps.length) {
    lines.push(
      program.depth === "stub"
        ? "_KB doc is a stub — step flow not captured; refresh via describe-batch and re-index._"
        : "_program has no steps in its KB doc._"
    );
    return { section: lines.join("\n"), emailRows, missingIds, surveyDisagreements: [] };
  }

  lines.push(
    mdTable(
      ["#", "type", "step", "detail", "survey"],
      steps.map((s) => [s.order, s.stepType ?? "", s.stepName ?? "", stepDetail(s, templates), surveyCell(s)])
    )
  );

  const surveyDisagreements = [];
  for (const step of steps) {
    const ids = stepTemplateIds(step);
    const surveys = stepSurveys(step);
    // an id-only SURVEY asset alongside a named one means the payload's
    // survey sources disagreed (parser keeps both, named source first) —
    // surfaced as a caveat per the ER-17 ruling
    if (surveys.length > 1 && surveys.some((a) => a.name == null) && surveys.some((a) => a.name != null))
      surveyDisagreements.push(
        `step ${step.order} (${step.stepName ?? "unnamed"}): survey sources disagreed — the named source is listed first, the bare id came from surveyIdFromEmailActionV2`
      );
    // "primary" means THE step's emailTemplateId — a step can carry variant
    // mappings with no primary at all, and its first variant must not be
    // promoted by position
    const isPrimary = (id) => step.emailTemplateId != null && id === step.emailTemplateId;
    for (const id of ids) {
      const tpl = own(templates, id);
      if (!tpl) missingIds.add(id);
      const ctx = tokenCtx(step, tpl);
      emailRows.push({
        programId: program.id,
        programName: program.name,
        stepOrder: step.order,
        stepName: step.stepName,
        role: isPrimary(id) ? "primary" : "variant",
        templateId: id,
        templateTitle: tpl?.title ?? step.emailTemplateName ?? null,
        subject: tpl?.subject != null ? renderTokens(tpl.subject, ctx) : null,
        bodyChars: tpl?.bodyIncluded ? (tpl.body ?? "").length : null,
        docPath: tpl?.docPath ?? null,
        // ER-17 trio (always) + ER-18 body (written only with --addbody)
        surveyBound: surveys.length > 0,
        surveyNames: surveys.map((a) => a.name).filter(Boolean).join(", "),
        surveyIds: surveys.map((a) => a.id).filter(Boolean).join(", "),
        body: tpl?.bodyIncluded ? renderTokens(tpl.body ?? "", ctx) : null,
      });
    }
    if (deep && ids.length) {
      lines.push("", `### Step ${step.order} — ${step.stepName ?? "email"}`, "");
      if (surveys.length)
        lines.push(`Survey: ${surveys.map((a) => `${a.name ?? "(unnamed)"} (${a.id ?? "id unknown"})`).join(", ")}`, "");
      for (const id of ids) {
        const { lines: block } = templateBlock(id, templates, isPrimary(id) ? "Primary" : "Variant-mapped", step);
        lines.push(...block, "");
      }
      const tt = tokensTable(step, templates);
      if (tt) lines.push("**Tokens** (id → label → bound source → default):", "", tt, "");
    }
  }

  return { section: lines.join("\n"), emailRows, missingIds, surveyDisagreements };
}

// ── CLI entry (dispatcher contract: export run(argv)) ────────────────────────

// shq is the doc-lib copy (F-123) — imported above with sq.

const USAGE =
  "usage: jo-report.mjs program --index <er-index.json> --name <name-or-id> [--name …] " +
  "[--deep] [--addbody] [--include-paused] --report <dir> [--csv-dir <dir>]";

export async function run(argv) {
  let flags;
  try {
    flags = parseFlags(argv, { boolean: [...C3_BOOLEAN, "deep", "addbody"] });
  } catch (e) {
    fail(`${e.message}\n${USAGE}`);
  }
  const names = flags.name ?? [];
  if (!flags.index || !names.length || !flags.report) fail(USAGE);
  // an empty --name would substring-match EVERY named program (''.includes)
  // and dump the whole tenant into ambiguities — reject it loudly instead
  if (names.some((n) => !String(n).trim())) fail("--name values must be non-empty");
  const opts = { deep: flags.deep === true, includePaused: flags["include-paused"] === true };
  const addBody = flags.addbody === true; // ER-18 (C2 v2): opt-in body column

  const index = loadIndex(flags.index);
  const warnings = [];
  const ambiguities = [];
  const resolved = []; // distinct programs to report (two queries may resolve to one program)
  const seen = new Set();
  let notFound = 0;
  for (const q of names) {
    const r = resolveProgram(index, q);
    if (r.matches.length === 1) {
      if (!seen.has(r.matches[0].id)) {
        seen.add(r.matches[0].id);
        resolved.push(r.matches[0]);
      }
    } else if (r.matches.length > 1) {
      ambiguities.push({
        query: r.query,
        resolvedBy: r.resolvedBy,
        matches: r.matches.map((p) => ({ id: p.id, name: p.name, status: p.status })),
      });
      warnings.push(`--name '${q}' matched ${r.matches.length} programs (${r.resolvedBy}) — not guessed; see ambiguities`);
    } else {
      notFound++;
      warnings.push(`--name '${q}' matched no program (tried id, exact name, substring)`);
    }
  }

  const sections = [];
  const allEmailRows = [];
  const missingIds = new Set();
  const allSurveyDisagreements = [];
  let stubCount = 0;
  for (const p of resolved) {
    const { section, emailRows, missingIds: miss, surveyDisagreements } = renderProgram(p, index, opts);
    sections.push(section);
    allEmailRows.push(...emailRows);
    allSurveyDisagreements.push(...surveyDisagreements.map((d) => `${p.name ?? p.id}: ${d}`));
    for (const id of miss) missingIds.add(id);
    if (p.depth === "stub") stubCount++;
  }

  const caveats = [];
  if (stubCount)
    caveats.push(`${stubCount} resolved program doc(s) are stubs — step flow and email content unknown until re-described.`);
  caveats.push(...allSurveyDisagreements);
  // ER-15 backfill honesty, scoped to the templates this run touched
  const touchedTemplates = new Set(allEmailRows.map((r) => r.templateId));
  const tokenCaveat = tokenMetadataCaveat(index, touchedTemplates);
  if (tokenCaveat) caveats.push(tokenCaveat);
  if (missingIds.size)
    caveats.push(
      `${missingIds.size} referenced template(s) have no KB doc — bodies not available; ` +
        `fetch each with \`gs-admin --json jo email template --id '<id>'\` (ids: ${[...missingIds].sort().join(", ")}).`
    );
  // scoped to the RESOLVED programs: a partial live sweep elsewhere in the
  // index must not suppress the warning for a program whose own status is
  // still KB-cached
  const kbResolved = resolved.filter((p) => p.statusSource !== "live").length;
  if (kbResolved)
    caveats.push(
      `${kbResolved} of ${resolved.length} resolved program status(es) are KB-cached (no or partial live sweep) — verify before acting on active/inactive.`
    );
  if (!opts.deep && resolved.length)
    caveats.push("shallow report (default): email bodies omitted — re-run with `--deep` for full subject/body/variant content.");

  const modeArgs = [
    ...names.map((n) => `--name ${shq(n)}`),
    opts.deep ? "--deep" : null,
    addBody ? "--addbody" : null,
    opts.includePaused ? "--include-paused" : null,
  ].filter(Boolean);
  // The shared tail (rerun line, POSIX-quote caveat, report write, CSV dir)
  // lives in jo-report.mjs — F-362. No resolved program → nothing worth a
  // report file (write: false — the caveat is still counted, nothing is
  // written, no directory is created); the summary carries the
  // ambiguities/warnings the agent needs to come back with a better name.
  const { outPath, csvDir } = writeModeReport({ mode: "program", flags, modeArgs, sections, caveats, warnings, index, write: resolved.length > 0 });
  if (!resolved.length) warnings.push("no program resolved — report not written");

  if (csvDir) {
    writeFileSync(
      join(csvDir, "program-steps.csv"),
      toCsv(
        ["program_id", "program_name", "order", "step_type", "step_name", "detail"],
        resolved.flatMap((p) =>
          (p.steps ?? []).map((s) => [p.id, p.name, s.order, s.stepType, s.stepName, stepDetail(s, index.templates ?? {})])
        )
      ),
      "utf8"
    );
    // C2 v2: body_chars + kb_doc_path ALWAYS; the ER-17 survey trio is part
    // of the row; --addbody (ER-18) ADDS a trailing full-text body column —
    // without the flag the columns are exactly the no-flag set (never a swap).
    writeFileSync(
      join(csvDir, "program-emails.csv"),
      toCsv(
        [
          "program_id", "program_name", "step_order", "step_name", "role", "template_id", "template_title", "subject",
          "survey_bound", "survey_name", "survey_id", "body_chars", "kb_doc_path",
          ...(addBody ? ["body"] : []),
        ],
        allEmailRows.map((r) => [
          r.programId,
          r.programName,
          r.stepOrder,
          r.stepName,
          r.role,
          r.templateId,
          r.templateTitle,
          r.subject,
          String(r.surveyBound),
          r.surveyNames,
          r.surveyIds,
          r.bodyChars,
          r.docPath,
          ...(addBody ? [r.body] : []),
        ])
      ),
      "utf8"
    );
  }

  emitSummary({
    mode: "program",
    reportPath: outPath,
    ...(csvDir ? { csvDir } : {}),
    ambiguities,
    counts: {
      requested: names.length,
      resolved: resolved.length,
      ambiguous: ambiguities.length,
      notFound,
      emailRows: allEmailRows.length,
      templatesMissing: missingIds.size,
    },
    caveatCount: caveats.length,
    warnings,
  });
}
