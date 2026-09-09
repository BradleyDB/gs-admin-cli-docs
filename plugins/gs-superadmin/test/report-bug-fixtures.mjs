#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// report-bug-fixtures.mjs — skill-text fixtures for skills/report-bug/
//
// The report-bug skill is instructions executed by an LLM, so these fixtures
// lock the load-bearing text (AGENTS.md: ambiguity in a SKILL.md is a bug):
// dedup-before-drafting, the ask-once output-dir marker (durable, never
// re-asked — idempotency proof), the tenant-data scrub rule, the
// propose-never-auto-apply Known-CLI-issues bullet, the template's section
// set, placeholder⇄substitution-rule coverage, and the operating-model nudge
// that tells sessions to SUGGEST the skill. All example data is fictional.
//
// Run:  node plugins/gs-superadmin/test/report-bug-fixtures.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(HERE, "..", "skills", "report-bug");
const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
const template = readFileSync(join(SKILL_DIR, "references", "report-template.md"), "utf8");
const operatingModel = readFileSync(join(HERE, "..", "templates", "operating-model.md"), "utf8");

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)}`);
  }
}

// ── SKILL.md frontmatter and invocation model ────────────────────────────────
check("skill: user-invoked only (disable-model-invocation)", /disable-model-invocation: true/.test(skill), null);
check("skill: never transmits or commits reports", /never transmits anything/.test(skill) && /never commits a report to a git repo/.test(skill), null);

// ── Dedup before drafting ────────────────────────────────────────────────────
check("dedup: step 1 is dedup, before any drafting", /### 1 — Dedup first \(before drafting anything\)/.test(skill), null);
// F-400: the fortress known-issues ledger is the FIRST dedup source when the
// workspace marker names a checkout — the skill must read the ledger's
// title/howToTest, NAME the KI id on a match, and tell plugin users without
// a checkout to skip (never ask for one). The "fixture KI" of F-400's Lock is
// this text pin: a skill that stops instructing the read (mutant: delete the
// item) goes red here; the skill is prose an LLM executes, so the executable
// half of the lock is the ledger's own register verb in gs-fortress.
check("dedup (F-400): the fortress ledger is checked first, via the .gs-superadmin/fortress-dir marker, reading known-issues.json",
  /1\. \*\*The known-issues ledger of a gs-fortress checkout\*\*[\s\S]*`\.gs-superadmin\/fortress-dir`[\s\S]*ledger\/known-issues\.json/.test(skill), null);
check("dedup (F-400): a match NAMES the KI id and offers to register against it",
  /compare them with the\s+misbehavior being reported\. On a match, \*\*name the KI id\*\*[\s\S]*offer to register the new report\s+against that KI/.test(skill), null);
check("dedup (F-400): plugin users without a checkout skip the check and are never asked for a marker",
  /a plugin user without a\s+gs-fortress checkout has no marker and \*\*skips this check\*\* — do not ask for one/.test(skill), null);
check("dedup (F-400): the ledger read reads title AND howToTest", /`id`, `title`, and\s+`howToTest`/.test(skill), null);
check("dedup: checks Known CLI issues in the operating model", /Known CLI issues[\s\S]*operating-model\.md/.test(skill), null);
check("dedup: repeat observation appends to the existing report", /append an evidence\s+section to that file/.test(skill) && /instead of creating a new report/.test(skill), null);
// F-400 (2): the closing block prints the ledger's register command when the
// marker resolved, with the reports-dir constraint the register verb enforces.
check("close (F-400): the register command is printed when the marker resolved, --ki on a match else --new --how-to-test",
  /When the `\.gs-superadmin\/fortress-dir` marker resolved \(step 1\), add the register line/.test(skill) &&
  /Register: node ⟨fortress⟩\/plugins\/gs-fortress\/scripts\/known-issues\.mjs register ⟨report path⟩ --ki ⟨KI id⟩/.test(skill) &&
  /--new --how-to-test "⟨one public-safe sentence⟩"/.test(skill), null);
check("close (F-400): the register verb's reports-dir constraint is stated", /ledger\/upstream-feedback\/reports\//.test(skill), null);

// ── Ask-once output dir with a durable marker (idempotency) ──────────────────
check("dir: durable marker file named", /\.gs-superadmin\/upstream-reports-dir/.test(skill), null);
check("dir: marker consulted before asking, never re-asked", /marker file[\s\S]*exists, use the path[\s\S]*do not re-ask, ever/.test(skill), null);
check("dir: default location is the git-ignored workspace dir", /`\.gs-superadmin\/upstream-reports\/`/.test(skill), null);
// F-400 (3): a private repo's folder is a fine output dir (the fortress ledger's
// reports folder is one) — the warning is about PUBLIC repos, not repos.
check("dir: user can point it anywhere local, warned off PUBLIC repos only (F-400)", /never a public repo \(a\s+private repo's folder is fine\)/.test(skill) && !/never be pushed to a\s+repo/.test(skill), null);
check("dir: --dir is a one-run override that leaves the marker alone", /--dir[\s\S]*Does \*\*not\*\*\s+rewrite the recorded directory/.test(skill), null);

// ── Evidence rules ───────────────────────────────────────────────────────────
check("evidence: CLI version from the workspace catalog, cross-checked live", /catalog\.json[\s\S]*meta\.cliVersion[\s\S]*cross-checked against live `gs-admin --version`/.test(skill), null);
check("evidence: AI-agent driver line required", /driven by an AI agent \(Claude\) in Claude Code/.test(skill), null);
check("evidence: output stays verbatim, never paraphrased", /Never paraphrase error\s+text/.test(skill), null);
check("evidence: reproduction respects read-only-by-default and the guard", /never\s+re-run a mutating or unknown command just to reproduce[\s\S]*explicit go-ahead/.test(skill), null);

// ── Scrub rule ───────────────────────────────────────────────────────────────
check("scrub: tenant identifiers allowed (vendor-bound)", /\*\*Allowed\*\*: tenant identifiers/.test(skill), null);
check("scrub: tokens/secrets/auth headers never", /\*\*Never\*\*: tokens, secrets, passwords, API keys, `Authorization`\/cookie headers/.test(skill), null);

// ── Known-CLI-issues bullet is proposed, never auto-applied ──────────────────
check("propose: bullet shown and gated on a yes", /Show the\s+exact bullet text and ask whether to add it/.test(skill) && /do not edit the operating model without\s+a yes/.test(skill), null);

// ── Template: proven section set, in order ───────────────────────────────────
const sections = [
  "# Handoff → Gainsight: ⟨one-line title⟩",
  "## Summary",
  "## Environment",
  '## Prompt & task context (the "prompt" half)',
  "## Commands run (verbatim, in order)",
  "## Expected vs actual",
  "## Reproduction steps (minimal)",
  "## Reliability",
  "## Impact (AI-agent admin workflow)",
  "## Workaround",
];
let lastIdx = -1;
let ordered = true;
for (const s of sections) {
  const i = template.indexOf(s);
  if (i === -1 || i < lastIdx) ordered = false;
  lastIdx = i;
}
check("template: all proven sections present, in order", ordered, sections.filter((s) => !template.includes(s)));
check("template: dedup append block ships too", /## Additional occurrence — ⟨date⟩/.test(template), null);

// ── Template: every fenced placeholder has a substitution rule ───────────────
const fenced = [...template.matchAll(/^````$([\s\S]*?)^````$/gm)].map((m) => m[1]).join("\n");
check("template: found the two literal fenced blocks", fenced.length > 0 && /Handoff → Gainsight/.test(fenced), fenced.slice(0, 80));
const placeholders = [...new Set([...fenced.matchAll(/⟨([^⟩]+)⟩/g)].map((m) => m[1]))];
const proseOnly = template.replace(/^````$[\s\S]*?^````$/gm, ""); // rules live in the prose, outside the fences
const missingRule = placeholders.filter((p) => !proseOnly.includes(`⟨${p}⟩`));
check("template: every placeholder has a substitution rule in the prose", placeholders.length > 0 && missingRule.length === 0, missingRule);

// ── Operating model: sessions are told to SUGGEST the skill ──────────────────
check(
  "operating model: Known-CLI-issue-like misbehavior → suggest /gs-superadmin:report-bug",
  /Known-CLI-issue-like way[\s\S]*suggest `\/gs-superadmin:report-bug`/.test(operatingModel),
  null
);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll report-bug skill checks passed");
process.exit(failures ? 1 : 0);
