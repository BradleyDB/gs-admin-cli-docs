#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard-groups.mjs (test) — fixtures for scripts/dashboard-groups.mjs
// (DSH-5): the grouping resolver, the validator of a spec's `groups`, and the
// compact table a person proposes groupings from.
//
// The programs are the fictional acme tenant's, read from the committed
// fixture snapshot (test/fixtures/engagement/snapshot-acme.json). Expected
// assignments are written by hand from what that tenant IS (its models,
// audiences, folders, names, schedules), never computed through the resolver.
//
// Run:  node plugins/gs-superadmin/test/dashboard-groups.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { makeTempDir, removeTempDir, runNode } from "../../../test/rig.mjs";
import { resolveGroups, applyGroups, validateGroups, describeRule, programTraits, suggestionInput, UNGROUPED, RULE_KINDS, CHARACTERISTICS, GROUP_LEVELS } from "../scripts/dashboard-groups.mjs";
import { openSnapshot, runQuery } from "../scripts/engagement-query.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "scripts", "dashboard-groups.mjs");
const SNAPSHOT_PATH = join(HERE, "fixtures", "engagement", "snapshot-acme.json");

let failures = 0;
let total = 0;
function check(label, cond, detail) {
  total++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)?.slice(0, 1200)}`);
  }
}

const S = openSnapshot(JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")));
const T = programTraits(S);
const trait = (id) => T.find((p) => p.id === id);
const by = (resolution) => Object.fromEntries(resolution.assignments.map((a) => [a.id, [a.supergroup, a.group]]));
const groupsOf = (rules, overrides = {}) => ({ rules, overrides });
const sg = (rule) => ({ level: "supergroup", ...rule });
const g = (rule) => ({ level: "group", ...rule });

// ── What the rules test ──────────────────────────────────────────────────────
check("fixture: the snapshot's five programs are the ones the expectations below are written for",
  isDeepStrictEqual(T.map((p) => p.id), ["p-nps", "p-onboard", "p-pilot", "p-renew", "p-unlisted"]) && S.dimensions.programs.every((p) => p.supergroup === null && p.group === null));
check("traits: model, audience, folder and statuses are the program dimension's own; a program carries a LIST of statuses",
  trait("p-nps").model === "CSAT_SURVEY_V2" && trait("p-pilot").audienceType === "USER" && trait("p-renew").folderId === "202" && isDeepStrictEqual(trait("p-renew").statuses, ["PAUSE", "NEW"]));
check("traits: sendsSurveys is true for a survey model, false for a program with no survey participants, and null when the survey data could not be read (never false)",
  trait("p-nps").sendsSurveys === true && trait("p-onboard").sendsSurveys === false &&
    programTraits({ ...S, meta: { ...S.meta, metricAvailability: { ...S.meta.metricAvailability, responses: { programs: Object.fromEntries(S.dimensions.programs.map((p) => [p.id, { state: "unknown", evidence: { surveyParticipants: null } }])) } } } })
      .map((p) => p.sendsSurveys).join() === "true,,,," );
check("traits: recurring is true for a program with a recurring schedule, false for a documented program with none, and null for a program the KB has no doc for (never false)",
  trait("p-onboard").recurring === true && trait("p-nps").recurring === true && trait("p-renew").recurring === false && trait("p-pilot").recurring === false && trait("p-unlisted").recurring === null);
check("traits: a pass-through classification is NOT a boolean (F-494): a CRON-type schedule whose cron the KB did not capture reads classification CRON, and the trait is null (unknown), never false; a one-time schedule reads false",
  (() => {
    const withLabel = (label) => programTraits({ ...S, dimensions: { ...S.dimensions, programs: S.dimensions.programs.map((p) => (p.id === "p-onboard" ? { ...p, schedule: { ...p.schedule, classification: label, cronExpression: null } } : p)) } }).find((p) => p.id === "p-onboard").recurring;
    return withLabel("CRON") === null && withLabel("unknown") === null && withLabel("one-time") === false && withLabel("no schedule captured") === false && withLabel("recurring") === true;
  })());
check("traits: recurring is read from the program dimension's schedule (ruled 2026-10-05: it rides every pull with a KB, independent of health) — with health not pulled it still reads, and a snapshot whose programs carry no schedule (pulled without a KB, or made before it existed) reads unknown for every program, never 'not recurring'",
  programTraits({ ...S, meta: { ...S.meta, health: { pulled: false, reason: "health-off", asOf: null, dayWindow: null, parts: {} } }, facts: { ...S.facts, health: { bounceReasons: [], participantFailures: [], participantStates: [], lastSends: [], schedules: [] } } }).map((p) => p.recurring).join() === T.map((p) => p.recurring).join() &&
    programTraits({ ...S, dimensions: { ...S.dimensions, programs: S.dimensions.programs.map((p) => ({ ...p, schedule: null })) } }).every((p) => p.recurring === null) &&
    programTraits({ ...S, dimensions: { ...S.dimensions, programs: S.dimensions.programs.map(({ schedule: _s, ...p }) => p) } }).every((p) => p.recurring === null) && S.dimensions.programs.some((p) => p.schedule?.classification === "recurring"));

// ── The resolver: two levels, stated precedence, Ungrouped ───────────────────
const RULES = [
  sg({ kind: "characteristic", characteristic: "sendsSurveys", is: true, label: "Surveys" }),
  sg({ kind: "characteristic", characteristic: "audience", is: "USER", label: "Internal" }),
  sg({ kind: "characteristic", characteristic: "recurring", is: true, label: "Recurring" }),
  sg({ kind: "folder", folders: [{ id: "202", label: "Renewals" }] }),
  g({ kind: "characteristic", characteristic: "model", is: "CSAT_SURVEY_V2", label: "CSAT", within: "Surveys" }),
  g({ kind: "namePattern", match: "segment", delimiter: " ", index: 1 }),
];
const full = resolveGroups({ programs: T, groups: groupsOf(RULES, { "p-pilot": { group: "Pilots" } }) });
check("two levels from program characteristics, folders and names: every program gets a supergroup and a group, each from the FIRST rule of its level that matches, an override ahead of every rule",
  isDeepStrictEqual(by(full), {
    "p-nps": ["Surveys", "CSAT"],          // a survey AND recurring: the survey rule is listed first
    "p-onboard": ["Recurring", "Onboarding"],
    "p-pilot": ["Internal", "Pilots"],     // group by override; its name would have said "Internal"
    "p-renew": ["Renewals", "Renewal"],    // not recurring (documented, no schedule); its folder decides
    "p-unlisted": [UNGROUPED, "Unlisted"], // no doc, so recurring is unknown; no folder rule names 303
  }), by(full));
check("every assignment says what decided each level: the override, the rule by its place in the list, or nothing",
  isDeepStrictEqual(full.assignments.find((a) => a.id === "p-nps").by, { supergroup: "rule 1", group: "rule 5" }) && isDeepStrictEqual(full.assignments.find((a) => a.id === "p-pilot").by, { supergroup: "rule 2", group: "override" }) &&
    isDeepStrictEqual(full.assignments.find((a) => a.id === "p-unlisted").by, { supergroup: null, group: "rule 6" }));
{
  const surveysFirst = groupsOf([RULES[0], RULES[2]]);
  const recurringFirst = groupsOf([RULES[2], RULES[0]]);
  check("precedence is the listed order: a program two supergroup rules match takes the one listed first, and swapping them swaps the answer",
    by(resolveGroups({ programs: T, groups: surveysFirst }))["p-nps"][0] === "Surveys" && by(resolveGroups({ programs: T, groups: recurringFirst }))["p-nps"][0] === "Recurring");
  check("an override decides before any rule, per level: only the level it names is taken from it",
    isDeepStrictEqual(by(resolveGroups({ programs: T, groups: groupsOf(RULES, { "p-nps": { supergroup: "Pinned" } }) }))["p-nps"], ["Pinned", "NPS"]) &&
      isDeepStrictEqual(by(resolveGroups({ programs: T, groups: groupsOf(RULES, { "p-nps": { supergroup: "Pinned", group: "By hand" } }) }))["p-nps"], ["Pinned", "By hand"]));
  const shuffled = [T[3], T[0], T[4], T[2], T[1]];
  check("deterministic: the same programs in another order, and the same call twice, give the same assignment",
    isDeepStrictEqual(resolveGroups({ programs: shuffled, groups: groupsOf(RULES) }), resolveGroups({ programs: T, groups: groupsOf(RULES) })) && isDeepStrictEqual(resolveGroups({ programs: T, groups: groupsOf(RULES) }), resolveGroups({ programs: T, groups: groupsOf(RULES) })));
}
{
  const few = groupsOf([RULES[0], RULES[4]]);
  const r = resolveGroups({ programs: T, groups: few });
  check(`a program no rule reaches lands in "${UNGROUPED}" at both levels, and is listed as ungrouped`,
    UNGROUPED === "Ungrouped" && isDeepStrictEqual(by(r)["p-onboard"], [UNGROUPED, UNGROUPED]) && isDeepStrictEqual(r.ungrouped, ["p-onboard", "p-pilot", "p-renew", "p-unlisted"]) && isDeepStrictEqual(by(r)["p-nps"], ["Surveys", "CSAT"]));
  const known = resolveGroups({ programs: T, groups: few, previousProgramIds: ["p-nps", "p-onboard", "p-pilot"] });
  const one = resolveGroups({ programs: T, groups: few, previousProgramIds: ["p-nps", "p-onboard", "p-pilot", "p-renew"] });
  check("the refresh summary line counts the NEW programs that are ungrouped: those the previous snapshot did not hold — with no previous snapshot, every ungrouped program is new",
    known.line === "2 new programs ungrouped" && isDeepStrictEqual(known.newUngrouped, ["p-renew", "p-unlisted"]) && one.line === "1 new program ungrouped" && r.line === "4 new programs ungrouped" &&
      resolveGroups({ programs: T, groups: groupsOf(RULES), previousProgramIds: [] }).line === "0 new programs ungrouped");
  check("an empty groups object groups nothing: everything is Ungrouped, and nothing is refused",
    resolveGroups({ programs: T, groups: groupsOf([]) }).ungrouped.length === 5);
}
check("an unknown characteristic matches no rule in EITHER direction: the program with no KB doc is neither recurring nor not recurring",
  by(resolveGroups({ programs: T, groups: groupsOf([sg({ kind: "characteristic", characteristic: "recurring", is: true, label: "Recurring" }), sg({ kind: "characteristic", characteristic: "recurring", is: false, label: "One-off" })]) }))["p-unlisted"][0] === UNGROUPED &&
    by(resolveGroups({ programs: T, groups: groupsOf([sg({ kind: "characteristic", characteristic: "recurring", is: false, label: "One-off" })]) }))["p-renew"][0] === "One-off");
check("a group rule with `within` applies only inside that supergroup: the same rule without it reaches every program",
  (() => {
    const scoped = by(resolveGroups({ programs: T, groups: groupsOf([RULES[0], g({ kind: "characteristic", characteristic: "audience", is: "CUSTOMER", label: "Customers", within: "Surveys" })]) }));
    const open = by(resolveGroups({ programs: T, groups: groupsOf([RULES[0], g({ kind: "characteristic", characteristic: "audience", is: "CUSTOMER", label: "Customers" })]) }));
    return scoped["p-nps"][1] === "Customers" && scoped["p-onboard"][1] === UNGROUPED && open["p-onboard"][1] === "Customers";
  })());

// ── Each rule kind ───────────────────────────────────────────────────────────
{
  const one = (rule) => by(resolveGroups({ programs: T, groups: groupsOf([sg(rule)]) }));
  const folders = one({ kind: "folder", folders: [{ id: "101", label: "Lifecycle" }, { id: "303" }] });
  check("folder: programs group by folder ID, each folder under the label given for it — and a folder with no label reads 'Folder <id>', since Gainsight gives no folder name",
    folders["p-nps"][0] === "Lifecycle" && folders["p-onboard"][0] === "Lifecycle" && folders["p-pilot"][0] === "Folder 303" && folders["p-renew"][0] === UNGROUPED);
  check("name pattern: contains, starts with and ends with match whatever the letter case",
    one({ kind: "namePattern", match: "contains", text: "RENEWAL", label: "R" })["p-renew"][0] === "R" && one({ kind: "namePattern", match: "startsWith", text: "acme nps", label: "N" })["p-nps"][0] === "N" &&
      one({ kind: "namePattern", match: "endsWith", text: "chain", label: "C" })["p-onboard"][0] === "C" && one({ kind: "namePattern", match: "startsWith", text: "nps", label: "N" })["p-nps"][0] === UNGROUPED);
  check("name pattern, segment: the named part of the name IS the group, and a name that lacks the separator matches nothing",
    one({ kind: "namePattern", match: "segment", delimiter: " ", index: 0 })["p-nps"][0] === "Acme" && one({ kind: "namePattern", match: "segment", delimiter: "|", index: 0 })["p-nps"][0] === UNGROUPED &&
      one({ kind: "namePattern", match: "segment", delimiter: " ", index: 9 })["p-nps"][0] === UNGROUPED);
  check("program field: a field of the program row equal to a value; status matches when ANY of the program's statuses is the one named",
    one({ kind: "programField", field: "modelName", is: "Dynamic Program", label: "Dynamic" })["p-renew"][0] === "Dynamic" && one({ kind: "programField", field: "status", is: "NEW", label: "Has a draft" })["p-renew"][0] === "Has a draft" &&
      one({ kind: "programField", field: "status", is: "PAUSE", label: "Paused" })["p-renew"][0] === "Paused" && one({ kind: "programField", field: "status", is: "PAUSE", label: "Paused" })["p-nps"][0] === UNGROUPED);
  check("manual: the programs listed, and no other", (() => { const m = one({ kind: "manual", programIds: ["p-pilot", "p-renew"], label: "Picked" }); return m["p-pilot"][0] === "Picked" && m["p-renew"][0] === "Picked" && m["p-nps"][0] === UNGROUPED; })());
  check("characteristic: model and audience compare the program's own value; a rule for a value no program has matches nothing",
    one({ kind: "characteristic", characteristic: "model", is: "DRIPV2", label: "Chains" })["p-onboard"][0] === "Chains" && one({ kind: "characteristic", characteristic: "model", is: "NOPE", label: "X" })["p-onboard"][0] === UNGROUPED);
}

// ── Validation: every problem names its field ────────────────────────────────
{
  const paths = (groups) => validateGroups(groups).map((p) => p.path);
  const BAD = /** @type {Array<[*, string]>} */ ([
    [{ rules: [{ kind: "nope", level: "group" }], overrides: {} }, "groups.rules[0].kind"],
    [groupsOf([{ kind: "manual", level: "top", programIds: ["a"], label: "L" }]), "groups.rules[0].level"],
    [groupsOf([sg({ kind: "manual", programIds: ["a"], label: "L", within: "X" })]), "groups.rules[0].within"],
    [groupsOf([sg({ kind: "characteristic", characteristic: "colour", is: "x", label: "L" })]), "groups.rules[0].characteristic"],
    [groupsOf([sg({ kind: "characteristic", characteristic: "recurring", is: "yes", label: "L" })]), "groups.rules[0].is"],
    [groupsOf([sg({ kind: "characteristic", characteristic: "model", is: "DRIPV2" })]), "groups.rules[0].label"],
    [groupsOf([sg({ kind: "folder", folders: [] })]), "groups.rules[0].folders"],
    [groupsOf([sg({ kind: "folder", folders: [{ id: 101 }] })]), "groups.rules[0].folders[0].id"],
    [groupsOf([sg({ kind: "namePattern", match: "regex", text: "a", label: "L" })]), "groups.rules[0].match"],
    [groupsOf([sg({ kind: "namePattern", match: "segment", index: 0 })]), "groups.rules[0].delimiter"],
    [groupsOf([sg({ kind: "namePattern", match: "segment", delimiter: "|", index: -1 })]), "groups.rules[0].index"],
    [groupsOf([sg({ kind: "namePattern", match: "contains", label: "L" })]), "groups.rules[0].text"],
    [groupsOf([sg({ kind: "programField", field: "owner", is: "x", label: "L" })]), "groups.rules[0].field"],
    [groupsOf([sg({ kind: "manual", programIds: [], label: "L" })]), "groups.rules[0].programIds"],
    [groupsOf([sg({ kind: "manual", programIds: ["a"], label: UNGROUPED })]), "groups.rules[0].label"],
    [groupsOf([g({ kind: "manual", programIds: ["a"], label: "L", withn: "Surveys" })]), "groups.rules[0].withn"],
    [groupsOf([sg({ kind: "characteristic", characteristic: "model", is: "DRIPV2", label: "L", text: "x" })]), "groups.rules[0].text"],
    [groupsOf([sg({ kind: "folder", folders: [{ id: "101", name: "Lifecycle" }] })]), "groups.rules[0].folders[0].name"],
    [groupsOf([], { "p-1": {} }), "groups.overrides.p-1"],
    [groupsOf([], { "p-1": { tier: "x" } }), "groups.overrides.p-1.tier"],
    [groupsOf([], { "p-1": { group: "" } }), "groups.overrides.p-1.group"],
    [{ rules: [] }, "groups.overrides"],
    [{ overrides: {} }, "groups.rules"],
    [{ rules: [], overrides: {}, extra: 1 }, "groups.extra"],
    [null, "groups"],
  ]);
  const wrong = BAD.filter(([groups, path]) => !paths(groups).includes(path)).map(([groups, path]) => [path, paths(groups)]);
  check(`validation: ${BAD.length} malformed groups are each refused with the path of the field at fault`, wrong.length === 0, wrong);
  check("validation: the fixture rules, an empty groups object, and every rule kind's good shape pass with no problem", validateGroups(groupsOf(RULES, { "p-pilot": { group: "Pilots" } })).length === 0 && validateGroups(groupsOf([])).length === 0);
  check("the resolver refuses groups that do not validate, loudly, naming the field — it never resolves around a broken rule",
    (() => { try { resolveGroups({ programs: T, groups: groupsOf([{ kind: "nope", level: "group" }]) }); return false; } catch (e) { return /groups\.rules\[0\]\.kind/.test(e.message); } })());
  check("an override key that names an object method is data, not a lookup into the object: a program called 'constructor' is grouped like any other",
    by(resolveGroups({ programs: [{ ...T[0], id: "constructor" }], groups: groupsOf([], { constructor: { group: "Named" } }) })).constructor[1] === "Named" &&
      by(resolveGroups({ programs: [{ ...T[0], id: "toString" }], groups: groupsOf([]) })).toString[1] === UNGROUPED);
}

// ── Descriptions, and the snapshot with its groups applied ───────────────────
{
  const said = RULES.map(describeRule);
  check("every rule reads as a sentence: its level, its label, what it matches — and a folder rule says the label is the person's, since folder names are not available",
    said.every((t) => /^(Supergroup|Group)/.test(t) && t.endsWith(".")) && /Supergroup "Surveys": programs that send a survey\./.test(said[0]) && /internal users/.test(said[1]) && /Renewals \(folder id 202\).*not available/.test(said[3]) &&
      /Group "CSAT" \(inside Surveys\)/.test(said[4]) && /part 2 of the name, split on " "/.test(said[5]), said);
  check("the rule kinds, the characteristics and the two levels are data: every kind can check, match and describe; every characteristic states its type and reads a trait",
    isDeepStrictEqual(Object.keys(RULE_KINDS), ["characteristic", "folder", "namePattern", "programField", "manual"]) && Object.values(RULE_KINDS).every((k) => [k.check, k.match, k.describe].every((f) => typeof f === "function")) &&
      Object.values(RULE_KINDS).every((k) => Array.isArray(k.fields) && k.fields.length > 0) && isDeepStrictEqual(Object.keys(CHARACTERISTICS), ["model", "audience", "sendsSurveys", "recurring"]) && isDeepStrictEqual([...GROUP_LEVELS], ["supergroup", "group"]));
  const groups = groupsOf(RULES, { "p-pilot": { group: "Pilots" } });
  const { snapshot: applied, resolution } = applyGroups(S, groups);
  check("applyGroups fills every program's supergroup and group in a NEW snapshot and leaves the one it was given untouched",
    isDeepStrictEqual(Object.fromEntries(applied.dimensions.programs.map((p) => [p.id, [p.supergroup, p.group]])), by(full)) && S.dimensions.programs.every((p) => p.supergroup === null) && applied.facts === S.facts &&
      isDeepStrictEqual(Object.keys(applied.dimensions.programs[0]), Object.keys(S.dimensions.programs[0])) && resolution.line === "0 new programs ungrouped");
  const sum = (ids) => S.facts.byTemplate.filter((r) => ids.includes(r.programId)).reduce((x, r) => x + r.sent, 0);
  const bySg = Object.fromEntries(runQuery(applied, {}, { groupBy: ["supergroup"], metrics: ["sent"] }).rows.map((r) => [r.key.supergroup, r.cells.sent.value]));
  check("the engine filters and groups by what the resolver wrote: sends by supergroup equal a straight sum of each supergroup's programs, and a supergroup filter keeps only its own",
    isDeepStrictEqual(bySg, { Internal: sum(["p-pilot"]), Recurring: sum(["p-onboard"]), Renewals: sum(["p-renew"]), Surveys: sum(["p-nps"]), [UNGROUPED]: sum(["p-unlisted"]) }) &&
      runQuery(applied, { supergroups: ["Surveys"] }, { groupBy: [], metrics: ["sent"] }).total.cells.sent.value === sum(["p-nps"]) && runQuery(applied, { groups: ["Pilots"] }, { groupBy: [], metrics: ["sent"] }).total.cells.sent.value === sum(["p-pilot"]), bySg);
  check("applyGroups says which ungrouped programs are new against the previous snapshot", applyGroups(S, groupsOf([RULES[0]]), { previous: { ...S, dimensions: { ...S.dimensions, programs: S.dimensions.programs.filter((p) => p.id !== "p-renew") } } }).resolution.line === "1 new program ungrouped");
}

// ── The table a person proposes groupings from ───────────────────────────────
{
  const input = suggestionInput(S);
  const text = JSON.stringify(input);
  check("suggestion input: one compact row per program — id, name, status in the UI's words, model, audience, folder id, the two derived characteristics, sends — and nothing about an account, a person or a message",
    input.programs.length === 5 && input.programs.every((p) => isDeepStrictEqual(Object.keys(p), ["id", "name", "status", "model", "audience", "folderId", "sendsSurveys", "recurring", "sent"])) &&
      input.programs.find((p) => p.id === "p-renew").status === "Paused + Draft" && input.programs.find((p) => p.id === "p-nps").sent === S.facts.byTemplate.filter((r) => r.programId === "p-nps").reduce((x, r) => x + r.sent, 0) &&
      !text.includes("@") && !/co-\d\d/.test(text) && !text.includes("Acme Customer") && text.length < 6000, input.programs[0]);
  check("suggestion input: the tallies show what structure the tenant already has — programs per model, audience, status, folder id and characteristic — and how names split on the separators they use",
    isDeepStrictEqual(input.tallies.folder, [{ value: "101", programs: 2 }, { value: "303", programs: 2 }, { value: "202", programs: 1 }]) && input.tallies.sendsSurveys.some((x) => x.value === "true" && x.programs === 1) &&
      input.tallies.recurring.some((x) => x.value === "null" && x.programs === 1) && input.tallies.status.some((x) => x.value === "Active" && x.programs === 4) &&
      input.nameParts.length >= 1 && input.nameParts.every((d) => d.programs > 0 && d.firstParts.length > 0));
  check("suggestion input says what cannot be known: folder names, an undetermined characteristic, and a Dynamic Program's survey type",
    input.notes.length === 3 && /Folder NAMES are not available/.test(input.notes[0]) && /null where they could not be determined/.test(input.notes[1]) && /Dynamic Program/.test(input.notes[2]));
}

// ── The CLI ──────────────────────────────────────────────────────────────────
const ROOT = makeTempDir("gs-superadmin-dashboard-groups");
try {
  const spec = join(ROOT, "spec.json");
  const draft = join(ROOT, "draft.json");
  const bad = join(ROOT, "bad.json");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(spec, JSON.stringify({ groups: groupsOf([RULES[0], RULES[4]]) }));
  writeFileSync(draft, JSON.stringify({ kind: "dashboard-spec-draft", spec: { groups: groupsOf(RULES) } }));
  writeFileSync(bad, JSON.stringify({ groups: groupsOf([{ kind: "nope", level: "group" }]) }));
  const run = (args) => {
    const r = runNode(SCRIPT, args);
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* failure path */ }
    return { code: r.status, json, stdout: r.stdout, stderr: r.stderr };
  };
  const resolved = run(["resolve", "--snapshot", SNAPSHOT_PATH, "--spec", spec]);
  check("resolve: prints counts and the summary line — programs, ungrouped, 'N new programs ungrouped', programs per supergroup and group — and never a program's name",
    resolved.code === 0 && resolved.json?.programs === 5 && resolved.json.ungrouped === 4 && resolved.json.line === "4 new programs ungrouped" && isDeepStrictEqual(resolved.json.supergroups, { Surveys: 1, [UNGROUPED]: 4 }) && !resolved.stdout.includes("Acme"), resolved.json ?? resolved.stderr);
  check("resolve: a draft file is read like a saved spec, and --previous makes 'new' mean new since that snapshot",
    run(["resolve", "--snapshot", SNAPSHOT_PATH, "--spec", draft]).json?.ungrouped === 0 && run(["resolve", "--snapshot", SNAPSHOT_PATH, "--spec", spec, "--previous", SNAPSHOT_PATH]).json?.line === "0 new programs ungrouped");
  const refused = run(["resolve", "--snapshot", SNAPSHOT_PATH, "--spec", bad]);
  check("resolve: groups that do not validate are refused with exit 1, naming the field", refused.code === 1 && /groups\.rules\[0\]\.kind/.test(refused.stderr), refused.stderr);
  const out = join(ROOT, "suggest.json");
  const suggested = run(["suggest-input", "--snapshot", SNAPSHOT_PATH, "--out", out]);
  check("suggest-input: writes the compact table to the file named and prints counts only — the names go to disk, never to stdout",
    suggested.code === 0 && existsSync(out) && isDeepStrictEqual(JSON.parse(readFileSync(out, "utf8")), JSON.parse(JSON.stringify(suggestionInput(S)))) && suggested.json?.programs === 5 && !suggested.stdout.includes("Acme"), suggested.json ?? suggested.stderr);
  check("the CLI refuses an unknown mode, a missing snapshot and a snapshot of an unknown version, each with a reason",
    run(["nope"]).code === 1 && run(["resolve", "--spec", spec]).code === 1 && (() => { writeFileSync(join(ROOT, "v2.json"), JSON.stringify({ ...S, schemaVersion: 2 })); const r = run(["resolve", "--snapshot", join(ROOT, "v2.json"), "--spec", spec]); return r.code === 1 && /refusing to read it \(T-10\)/.test(r.stderr); })());
} finally {
  removeTempDir(ROOT);
}

console.log(failures ? `\ndashboard-groups: ${failures} FAILED of ${total}` : `\ndashboard-groups: all ${total} checks passed`);
process.exit(failures ? 1 : 0);
