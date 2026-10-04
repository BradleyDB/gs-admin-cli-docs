#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard-groups.mjs — program grouping for an engagement dashboard (DSH-5).
//
// A dashboard spec (T-10's sibling contract T-11, frozen at its producer,
// dashboard-spec.mjs) carries `groups`: rules that put every program in a
// supergroup and a group, and per-program overrides on top. This file is the
// ONE resolver of those rules, and the one validator of their shape (the spec
// writer calls it; it never re-states a rule kind).
//
//   resolveGroups   programs + groups → an assignment per program. Pure and
//                   deterministic: overrides first, then the rules in the
//                   order they are listed, each level on its own; a program no
//                   rule reaches lands in "Ungrouped".
//   applyGroups     a snapshot + groups → the same snapshot with every
//                   program's supergroup and group filled in (a new object;
//                   the caller that owns the snapshot file writes it).
//   suggestionInput a snapshot → a compact table of what a person needs in
//                   order to PROPOSE groupings: names, statuses, models,
//                   folders, the two derived characteristics, send volume.
//                   Proposing is judgment and is not done here.
//
// Subcommands (both read-only over the tenant; neither writes a spec):
//   resolve        --snapshot <file> --spec <file> [--previous <snapshot>]
//                  prints the assignment counts and "N new programs ungrouped"
//   suggest-input  --snapshot <file> --out <file>
//                  writes the compact table; prints counts only
//
// What a program's characteristics are read from (all already in a snapshot):
//   model, audience   the program dimension (jo p list)
//   sendsSurveys      a survey model, or survey participants of its own; a
//                     program whose survey data could not be read is unknown
//   recurring         its schedules as the KB documents them, classified by
//                     the schedule audit's rule; no KB doc is unknown
// An unknown characteristic matches no rule, in either direction: the program
// falls through to the next rule, and to "Ungrouped" at the end.
//
// Folders: the CLI exposes a program's folder ID only, never its name or its
// parent, so a folder rule groups by id and takes its label from the person
// (a folder with no label reads "Folder <id>").
//
// Citations: DSH-n are work items and Rnn rulings of the maintainer's
// unpublished JO-dashboards plan; the decision each produced is stated beside
// the token.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import("./engagement.mjs").T10Snapshot} T10Snapshot
 * @typedef {import("./dashboard-spec.mjs").T11Groups} T11Groups
 * @typedef {import("./dashboard-spec.mjs").T11GroupRule} T11GroupRule
 *
 * @typedef {object} ProgramTraits what a rule may test
 * @property {string} id
 * @property {?string} name
 * @property {string[]} statuses
 * @property {?string} model
 * @property {?string} modelName
 * @property {?string} audienceType
 * @property {?string} folderId
 * @property {?boolean} sendsSurveys  null = could not be determined
 * @property {?boolean} recurring     null = could not be determined
 *
 * @typedef {object} GroupAssignment
 * @property {string} id
 * @property {string} supergroup
 * @property {string} group
 * @property {{supergroup: ?string, group: ?string}} by  what decided each level: "override", "rule <n>" (1-based, in the listed order), or null for Ungrouped
 */
import { resolve } from "node:path";
import { makeCliHelpers, readJsonFile, writeFileAtomicSync, isMainModule, cmpKey } from "./doc-lib.mjs";
import { openSnapshot, healthAvailability, runQuery, statusLabel } from "./engagement-query.mjs";

export const UNGROUPED = "Ungrouped";
export const GROUP_LEVELS = Object.freeze(["supergroup", "group"]);
// Programs of these models send a survey by design (a Dynamic Program may too:
// that is read from its survey participants).
export const SURVEY_MODELS = Object.freeze(["CSAT_SURVEY_V2", "GENERIC_SURVEY_V2"]);

const isText = (v) => typeof v === "string" && v.trim() !== "";
const fold = (v) => String(v ?? "").toLowerCase();

// ── Characteristics (R25): what a "characteristic" rule tests ────────────────
// `type` is the type `is` must have; `of` reads the trait; `say` words the rule.
export const CHARACTERISTICS = Object.freeze({
  model: { label: "Program model", type: "string", of: (p) => p.model, say: (is) => `programs whose model is ${is}` },
  audience: { label: "Audience", type: "string", of: (p) => p.audienceType, say: (is) => `programs sent to ${is === "USER" ? "internal users" : is === "CUSTOMER" ? "customers" : is}` },
  sendsSurveys: { label: "Sends surveys", type: "boolean", of: (p) => p.sendsSurveys, say: (is) => `programs that ${is ? "send" : "do not send"} a survey` },
  recurring: { label: "Recurring schedule", type: "boolean", of: (p) => p.recurring, say: (is) => `programs ${is ? "on a recurring schedule" : "whose schedule does not recur"}` },
});
export const PROGRAM_FIELDS = Object.freeze(["model", "modelName", "audienceType", "folderId", "status"]);
export const NAME_MATCHES = Object.freeze(["contains", "startsWith", "endsWith", "segment"]);

// ── Rule kinds, as data: how each is validated, matched and described ────────
// match(rule, program) → the label the rule gives this program, or null.
const folderLabel = (f) => (isText(f.label) ? f.label.trim() : `Folder ${f.id}`);
const nameSegment = (rule, p) => {
  const part = String(p.name ?? "").split(rule.delimiter)[rule.index];
  // A name with no such segment (no delimiter in it at all, when index > 0) matches nothing.
  return part !== undefined && part.trim() !== "" && String(p.name).includes(rule.delimiter) ? part.trim() : null;
};
export const RULE_KINDS = Object.freeze({
  characteristic: {
    fields: ["characteristic", "is", "label"],
    check: (r, bad) => {
      const c = CHARACTERISTICS[r.characteristic];
      if (!c) return bad("characteristic", `must be one of ${Object.keys(CHARACTERISTICS).join(", ")}`);
      if (typeof r.is !== c.type) bad("is", `must be a ${c.type} for the ${r.characteristic} characteristic`);
      if (!isText(r.label)) bad("label", "is required: the name of the group this rule fills");
    },
    match: (r, p) => {
      const v = CHARACTERISTICS[r.characteristic].of(p);
      return v != null && v === r.is ? r.label.trim() : null;
    },
    describe: (r) => CHARACTERISTICS[r.characteristic].say(r.is),
  },
  folder: {
    fields: ["folders"],
    check: (r, bad) => {
      if (!Array.isArray(r.folders) || !r.folders.length) return bad("folders", "must list at least one folder as {id, label?}");
      r.folders.forEach((f, i) => {
        if (!f || typeof f !== "object" || !isText(f.id)) bad(`folders[${i}].id`, "must be the folder's id, as text");
        else if (f.label != null && !isText(f.label)) bad(`folders[${i}].label`, "must be text when given");
        else for (const k of Object.keys(f)) if (!["id", "label"].includes(k)) bad(`folders[${i}].${k}`, "is not a field of a folder (id, label)");
      });
    },
    match: (r, p) => {
      const f = r.folders.find((x) => x.id === p.folderId);
      return f && p.folderId != null ? folderLabel(f) : null;
    },
    describe: (r) => `programs by folder: ${r.folders.map((f) => `${folderLabel(f)} (folder id ${f.id})`).join("; ")}. Folder names are not available from Gainsight, so each label is the one given here`,
  },
  namePattern: {
    fields: ["match", "text", "label", "delimiter", "index"],
    check: (r, bad) => {
      if (!NAME_MATCHES.includes(r.match)) return bad("match", `must be one of ${NAME_MATCHES.join(", ")}`);
      if (r.match === "segment") {
        if (typeof r.delimiter !== "string" || r.delimiter === "") bad("delimiter", "is required for a segment match: the text that separates the parts of a name");
        if (!Number.isInteger(r.index) || r.index < 0) bad("index", "must be a whole number from 0: which part of the name is the group");
        if (r.label != null) bad("label", "is not used with a segment match: the group is the segment's own text");
      } else {
        if (!isText(r.text)) bad("text", "is required: the text a program name must hold");
        if (!isText(r.label)) bad("label", "is required: the name of the group this rule fills");
      }
    },
    match: (r, p) => {
      if (r.match === "segment") return nameSegment(r, p);
      const [name, text] = [fold(p.name), fold(r.text.trim())];
      return (r.match === "contains" ? name.includes(text) : r.match === "startsWith" ? name.startsWith(text) : name.endsWith(text)) ? r.label.trim() : null;
    },
    describe: (r) =>
      r.match === "segment"
        ? `programs by name: part ${r.index + 1} of the name, split on "${r.delimiter}", is the group`
        : `programs whose name ${{ contains: "contains", startsWith: "starts with", endsWith: "ends with" }[r.match]} "${r.text.trim()}" (letter case ignored)`,
  },
  programField: {
    fields: ["field", "is", "label"],
    check: (r, bad) => {
      if (!PROGRAM_FIELDS.includes(r.field)) return bad("field", `must be one of ${PROGRAM_FIELDS.join(", ")}`);
      if (!isText(r.is)) bad("is", "must be the value the field holds, as text");
      if (!isText(r.label)) bad("label", "is required: the name of the group this rule fills");
    },
    // A program carries a LIST of statuses: any one matching is a match.
    match: (r, p) => ((r.field === "status" ? p.statuses.includes(r.is) : p[r.field] != null && p[r.field] === r.is) ? r.label.trim() : null),
    describe: (r) => (r.field === "status" ? `programs whose status is ${statusLabel(r.is)}, as of each refresh` : `programs whose ${r.field} is ${r.is}`),
  },
  manual: {
    fields: ["programIds", "label"],
    check: (r, bad) => {
      if (!Array.isArray(r.programIds) || !r.programIds.length || !r.programIds.every(isText)) bad("programIds", "must list at least one program id, as text");
      if (!isText(r.label)) bad("label", "is required: the name of the group this rule fills");
    },
    match: (r, p) => (r.programIds.includes(p.id) ? r.label.trim() : null),
    describe: (r) => `${r.programIds.length} program(s) picked by hand`,
  },
});

/**
 * Whether a groups object is one the resolver can run: every problem, each
 * with the path of the field it is about. Empty when it is.
 * @param {unknown} groups
 * @param {string} [at] the path prefix of `groups` in its file
 * @returns {Array<{path: string, problem: string}>}
 */
export function validateGroups(groups, at = "groups") {
  const problems = [];
  const g = /** @type {any} */ (groups);
  if (!g || typeof g !== "object" || Array.isArray(g)) return [{ path: at, problem: "must be an object {rules, overrides}" }];
  for (const k of Object.keys(g)) if (!["rules", "overrides"].includes(k)) problems.push({ path: `${at}.${k}`, problem: "is not a field of groups (rules, overrides)" });
  if (!Array.isArray(g.rules)) problems.push({ path: `${at}.rules`, problem: "must be a list (an empty one groups nothing)" });
  for (const [i, r] of (Array.isArray(g.rules) ? g.rules : []).entries()) {
    const path = `${at}.rules[${i}]`;
    const bad = (field, problem) => { problems.push({ path: `${path}.${field}`, problem }); };
    if (!r || typeof r !== "object" || Array.isArray(r)) { problems.push({ path, problem: "must be a rule object" }); continue; }
    const kind = RULE_KINDS[r.kind];
    if (!kind) { bad("kind", `must be one of ${Object.keys(RULE_KINDS).join(", ")}`); continue; }
    if (!GROUP_LEVELS.includes(r.level)) bad("level", `must be ${GROUP_LEVELS.join(" or ")}: which of the two levels this rule fills`);
    if (r.within != null && (r.level !== "group" || !isText(r.within))) bad("within", "names the supergroup a GROUP rule applies inside; it must be text, on a rule whose level is group");
    // A key the kind does not have is refused, never ignored: a misspelt `within` would otherwise widen the rule to every supergroup.
    for (const k of Object.keys(r)) if (!["kind", "level", "within", ...kind.fields].includes(k)) bad(k, `is not a field of a ${r.kind} rule (kind, level, within, ${kind.fields.join(", ")})`);
    kind.check(r, bad);
    if (isText(r.label) && r.label.trim() === UNGROUPED) bad("label", `"${UNGROUPED}" is where a program no rule reaches lands; a rule may not use the name`);
  }
  const o = g.overrides;
  if (o == null || typeof o !== "object" || Array.isArray(o)) problems.push({ path: `${at}.overrides`, problem: "must be an object keyed by program id (an empty one overrides nothing)" });
  else {
    for (const [id, v] of Object.entries(o)) {
      const path = `${at}.overrides.${id}`;
      if (!v || typeof v !== "object" || Array.isArray(v) || !Object.keys(v).length) { problems.push({ path, problem: "must be {supergroup?, group?} with at least one of the two" }); continue; }
      for (const [k, label] of Object.entries(v)) {
        if (!GROUP_LEVELS.includes(k)) problems.push({ path: `${path}.${k}`, problem: `is not a level (${GROUP_LEVELS.join(", ")})` });
        else if (!isText(label)) problems.push({ path: `${path}.${k}`, problem: "must be the group's name, as text" });
      }
    }
  }
  return problems;
}

/**
 * One rule in words, for a page's About tab and for `show`.
 * @param {T11GroupRule} rule
 * @returns {string}
 */
export function describeRule(rule) {
  const kind = RULE_KINDS[rule.kind];
  const label = "label" in rule && isText(rule.label) ? ` "${rule.label.trim()}"` : "";
  return `${rule.level === "supergroup" ? "Supergroup" : "Group"}${label}${rule.within ? ` (inside ${rule.within})` : ""}: ${kind.describe(rule)}.`;
}

// ── Traits: what the rules test, read from a snapshot ────────────────────────
/**
 * @param {T10Snapshot} snapshot
 * @returns {ProgramTraits[]} one per program of the snapshot, by id
 */
export function programTraits(snapshot) {
  const health = healthAvailability(snapshot);
  const schedulesRead = health.pulled && health.parts.schedules?.pulled === true;
  const scheduleRows = new Map();
  for (const r of schedulesRead ? snapshot.facts.health?.schedules ?? [] : []) scheduleRows.set(r.programId, [...(scheduleRows.get(r.programId) ?? []), r]);
  const responses = snapshot.meta.metricAvailability.responses.programs;
  return snapshot.dimensions.programs
    .map((p) => {
      const survey = responses[p.id]?.state;
      const rows = scheduleRows.get(p.id);
      return {
        id: p.id, name: p.name, statuses: p.statuses, model: p.model, modelName: p.modelName, audienceType: p.audienceType, folderId: p.folderId,
        // A survey model sends one by design; otherwise its own survey participants say so, and unreadable survey data says nothing.
        sendsSurveys: SURVEY_MODELS.includes(p.model) || survey === "tracked" ? true : survey === "not-tracked" ? false : null,
        // A documented program has at least one schedule row (one that says "no schedule" when it has none); an undocumented one has no row.
        recurring: rows ? rows.some((r) => r.classification === "recurring") : null,
      };
    })
    .sort((a, b) => cmpKey(a.id, b.id));
}

// ── The resolver ─────────────────────────────────────────────────────────────
/**
 * Every program → a supergroup and a group. Deterministic: the same programs
 * and the same groups give the same assignment, whatever order the programs
 * arrive in. Precedence, per level: the program's override; then the first
 * rule of that level, in the listed order, that matches (a group rule with
 * `within` only inside that supergroup); else "Ungrouped".
 * @param {{programs: ProgramTraits[], groups: T11Groups, previousProgramIds?: ?Iterable<string>}} input
 *   previousProgramIds: the programs the previous snapshot held, so "new" can be said of the ungrouped
 * @returns {{assignments: GroupAssignment[], ungrouped: string[], newUngrouped: string[], line: string}}
 *   ungrouped: programs no override and no rule reached at either level
 */
export function resolveGroups({ programs, groups, previousProgramIds = null }) {
  const problems = validateGroups(groups);
  if (problems.length) throw new Error(`dashboard groups: ${problems.map((p) => `${p.path} ${p.problem}`).join("; ")}`);
  const overrides = Object.assign(Object.create(null), groups.overrides);
  const firstMatch = (level, program, supergroup) => {
    for (const [i, rule] of groups.rules.entries()) {
      if (rule.level !== level || (rule.within != null && rule.within.trim() !== supergroup)) continue;
      const label = RULE_KINDS[rule.kind].match(rule, program);
      if (label != null) return { label, by: `rule ${i + 1}` };
    }
    return null;
  };
  const assignments = [...programs].sort((a, b) => cmpKey(a.id, b.id)).map((p) => {
    const over = overrides[p.id] ?? {};
    const sg = isText(over.supergroup) ? { label: over.supergroup.trim(), by: "override" } : firstMatch("supergroup", p, null);
    const supergroup = sg?.label ?? UNGROUPED;
    const g = isText(over.group) ? { label: over.group.trim(), by: "override" } : firstMatch("group", p, supergroup);
    return { id: p.id, supergroup, group: g?.label ?? UNGROUPED, by: { supergroup: sg?.by ?? null, group: g?.by ?? null } };
  });
  const ungrouped = assignments.filter((a) => a.by.supergroup == null && a.by.group == null).map((a) => a.id);
  const before = previousProgramIds ? new Set(previousProgramIds) : null;
  const newUngrouped = before ? ungrouped.filter((id) => !before.has(id)) : ungrouped;
  return { assignments, ungrouped, newUngrouped, line: `${newUngrouped.length} new program${newUngrouped.length === 1 ? "" : "s"} ungrouped` };
}

/**
 * A snapshot with every program's supergroup and group filled in from the
 * spec's groups. Returns a NEW snapshot object (the dimension rows are copied);
 * nothing else of the snapshot is touched, and nothing is written.
 * @param {T10Snapshot} snapshot
 * @param {T11Groups} groups
 * @param {{previous?: ?T10Snapshot}} [opts]
 * @returns {{snapshot: T10Snapshot, resolution: ReturnType<typeof resolveGroups>}}
 */
export function applyGroups(snapshot, groups, { previous = null } = {}) {
  const resolution = resolveGroups({ programs: programTraits(snapshot), groups, previousProgramIds: previous ? previous.dimensions.programs.map((p) => p.id) : null });
  const byId = new Map(resolution.assignments.map((a) => [a.id, a]));
  const programs = snapshot.dimensions.programs.map((p) => ({ ...p, supergroup: byId.get(p.id).supergroup, group: byId.get(p.id).group }));
  return { snapshot: { ...snapshot, dimensions: { ...snapshot.dimensions, programs } }, resolution };
}

// ── What a person needs in order to propose groupings ────────────────────────
// The separators a naming convention tends to use, and the plain space last: first words alone often show one.
const NAME_DELIMITERS = Object.freeze(["|", " - ", ":", "_", "/", " "]);
/**
 * A compact table of the snapshot's programs for whoever proposes the groups
 * (the dashboard interview): one row per program, and the tallies that show
 * which structure the tenant already has. No account, no person, no message.
 * @param {T10Snapshot} snapshot
 */
export function suggestionInput(snapshot) {
  const traits = programTraits(snapshot);
  const sent = new Map(runQuery(snapshot, {}, { groupBy: ["program"], metrics: ["sent"] }).rows.map((r) => [r.key.program, r.cells.sent.value]));
  const tally = (keyOf) => {
    const out = new Map();
    for (const p of traits) for (const k of [keyOf(p)].flat()) out.set(k, (out.get(k) ?? 0) + 1);
    return [...out].map(([value, programs]) => ({ value, programs })).sort((a, b) => b.programs - a.programs || cmpKey(String(a.value), String(b.value)));
  };
  // For each separator names use, the first part of each name that has it: a naming convention shows as a few values shared by many programs.
  const nameParts = NAME_DELIMITERS.map((delimiter) => {
    const using = traits.filter((p) => String(p.name ?? "").includes(delimiter));
    const first = new Map();
    for (const p of using) {
      const part = String(p.name).split(delimiter)[0].trim();
      first.set(part, (first.get(part) ?? 0) + 1);
    }
    return { delimiter, programs: using.length, firstParts: [...first].map(([value, programs]) => ({ value, programs })).sort((a, b) => b.programs - a.programs || cmpKey(a.value, b.value)).slice(0, 25) };
  }).filter((d) => d.programs > 0);
  return {
    kind: "dashboard-group-suggestion-input",
    tenantHost: snapshot.meta.tenantHost,
    pulledAt: snapshot.meta.pulledAt,
    window: { from: snapshot.meta.window.from, to: snapshot.meta.window.to },
    notes: [
      "Folder NAMES are not available from Gainsight: a folder shows as its id, and a folder group needs a label from the person.",
      "sendsSurveys and recurring are null where they could not be determined (survey data unreadable; no knowledge-base doc for the program).",
      "A survey's TYPE is known only through the program model (CSAT or generic survey programs). A Dynamic Program that sends a survey does not say which type.",
    ],
    programs: traits.map((p) => ({ id: p.id, name: p.name, status: p.statuses.map(statusLabel).join(" + "), model: p.modelName ?? p.model, audience: p.audienceType, folderId: p.folderId, sendsSurveys: p.sendsSurveys, recurring: p.recurring, sent: sent.get(p.id) ?? 0 })),
    tallies: {
      model: tally((p) => p.modelName ?? p.model ?? "(none)"),
      audience: tally((p) => p.audienceType ?? "(none)"),
      status: tally((p) => p.statuses.map(statusLabel)),
      sendsSurveys: tally((p) => String(p.sendsSurveys)),
      recurring: tally((p) => String(p.recurring)),
      folder: tally((p) => p.folderId ?? "(none)"),
    },
    nameParts,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const USAGE =
  "usage: dashboard-groups.mjs resolve --snapshot <snapshot.json> --spec <spec file> [--previous <snapshot.json>]  |  " +
  "dashboard-groups.mjs suggest-input --snapshot <snapshot.json> --out <file.json>";

async function main() {
  const [mode, ...argv] = process.argv.slice(2);
  const helpers = makeCliHelpers("dashboard-groups.mjs", argv);
  const { opt, finish } = helpers;
  /** @type {import("./doc-lib.mjs").FailFn} */
  const fail = helpers.fail;
  if (!["resolve", "suggest-input"].includes(mode)) fail(USAGE);
  const snapshotAt = (flag) => {
    try {
      return openSnapshot(readJsonFile(resolve(opt(flag))));
    } catch (e) {
      return fail(`${flag} ${opt(flag)}: ${e instanceof Error ? e.message : e}`);
    }
  };
  if (!opt("--snapshot")) fail(USAGE);
  const snapshot = snapshotAt("--snapshot");

  if (mode === "suggest-input") {
    if (!opt("--out")) fail(USAGE);
    const input = suggestionInput(snapshot);
    writeFileAtomicSync(resolve(opt("--out")), JSON.stringify(input, null, 1) + "\n");
    await finish({ ok: true, mode, out: resolve(opt("--out")), programs: input.programs.length, folders: input.tallies.folder.length, nameSeparators: input.nameParts.map((d) => d.delimiter) });
  }

  if (!opt("--spec")) fail(USAGE);
  let spec;
  try {
    spec = readJsonFile(resolve(opt("--spec")));
  } catch (e) {
    fail(`--spec ${opt("--spec")}: ${e instanceof Error ? e.message : e}`);
  }
  // A draft file wraps the spec; either form is read.
  const groups = (spec.spec ?? spec).groups;
  const problems = validateGroups(groups);
  if (problems.length) fail(`the spec's groups cannot be resolved: ${problems.map((p) => `${p.path} ${p.problem}`).join("; ")}`);
  const { resolution } = applyGroups(snapshot, groups, { previous: opt("--previous") ? snapshotAt("--previous") : null });
  const count = (level) => {
    const out = {};
    for (const a of resolution.assignments) out[a[level]] = (out[a[level]] ?? 0) + 1;
    return out;
  };
  await finish({ ok: true, mode, programs: resolution.assignments.length, ungrouped: resolution.ungrouped.length, newUngrouped: resolution.newUngrouped.length, line: resolution.line, supergroups: count("supergroup"), groups: count("group") });
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(`dashboard-groups.mjs: ${e?.stack ?? e}`);
    process.exit(1);
  });
}
