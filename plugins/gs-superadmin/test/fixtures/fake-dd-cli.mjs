// fake-dd-cli.mjs — a stand-in `gs-admin` for the reader-shape tracer's spawn
// of scripts/describe-batch.mjs in designer doc-mode (F-390 tester item 2:
// the drilldown reader at describe-batch.mjs ~:549/:584 is inline and
// unexported, so it is traced as a child process under the preload).
//
// Answers `--json dd t describe --template-id <id> [--task-id <t> [--field <f>]]`
// with the corpus's DESIGNER_DRILLDOWN payloads, printed as
// JSON.stringify(payload) — the tracer labels exactly those strings, so every
// JSON.parse of a level's stdout inside describe-batch lands on the
// `dd t describe` label. Nothing here parses a label string. Anything else
// (an unknown template, a field the fixture lacks) fails the way the CLI does.
import { readFileSync } from "node:fs";
import { DESIGNER_DRILLDOWN } from "./reader-payloads.mjs";

// FAKE_DD_OVERRIDE (the tracer's deletion probes): a JSON file holding a
// variant of DESIGNER_DRILLDOWN with one path removed — printed instead of
// the corpus so the reader is measured against the sparse shape.
const DD = process.env.FAKE_DD_OVERRIDE ? JSON.parse(readFileSync(process.env.FAKE_DD_OVERRIDE, "utf8")) : DESIGNER_DRILLDOWN;

// FAKE_DD_REFUSAL (F-593): the `--field` not-found sentence to print, as a
// template with {task} and {field} — the CLI reworded it at 1.0.14, so the
// suite that drives this fake chooses the wording (its DD_FIELD_REFUSALS
// table holds both, as the CLI's source spells them). Unset, the 1.0.12 one.
const REFUSAL = process.env.FAKE_DD_REFUSAL ?? 'No field found on task "{task}" matching: "{field}"';

const a = process.argv;
const at = (f) => { const i = a.indexOf(f); return i > -1 ? a[i + 1] : undefined; };
const finish = (s) => { process.stdout.write(s + "\n", () => process.exit(0)); };
const fail = (msg) => { process.stderr.write(msg + "\n"); process.exit(1); };

if (!(a.includes("dd") && a.includes("describe"))) fail("fake-dd-cli: only dd t describe is faked");
const tid = at("--template-id");
const task = at("--task-id");
const field = at("--field");
if (tid !== DD.templateId) fail("No template found");
if (!task) finish(JSON.stringify(DD.template));
else if (!field) {
  const t = DD.tasks[task];
  if (!t) fail("boom: simulated drilldown failure");
  finish(JSON.stringify(t));
} else {
  const rows = (DD.fields[task] ?? {})[field];
  if (!rows) fail(REFUSAL.replace("{task}", () => task).replace("{field}", () => field));
  finish(JSON.stringify(rows));
}
