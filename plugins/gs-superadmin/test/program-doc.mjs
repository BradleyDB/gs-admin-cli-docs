#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// program-doc.mjs (test) — fixture tests for scripts/program-doc.mjs
//
// Covers: compact doc from a describe payload (scalar bullets, re-fetch note,
// compaction header), the geometry drop-list applied everywhere (including
// inside parsed embedded JSON), unknown keys kept (fail-open to keeping data),
// the PowerList verbatim guarantee (drop-list keys inside a PowerList subtree
// survive), embedded-JSON strings parsed (and a non-JSON "…json" string left
// alone), filename sanitizing, batch behavior with an unparseable file and a
// payload with no program id, and the all-files-failed exit code. These checks
// lock the standalone path; the batch-vs-standalone parity check lives in
// test/describe-batch.mjs (describe-batch.mjs's program doc-mode imports the
// same renderer from doc-lib.mjs). Fixtures under the OS temp dir — no real
// state, all data fictional (acme).
//
// Run:  node plugins/gs-superadmin/test/program-doc.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "program-doc.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-program-doc-${process.pid}`);
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)?.slice(0, 400)}`);
  }
}

const fMain = join(ROOT, "main.json");
writeFileSync(fMain, JSON.stringify({
  result: true,
  data: {
    programId: "prog acme/0001",
    name: "Acme Onboarding Journey",
    status: "ACTIVE",
    modifiedDate: "2026-01-15",
    width: 1440, // top-level geometry — dropped
    stepJson: JSON.stringify({
      nodes: [
        {
          type: "EMAIL", name: "Send welcome", templateId: "tpl-gsid-acme-0001",
          x: 120, y: 340, transform: "translate(1,2)", style: { color: "#fff" },
          futureSemanticField: "kept even though unknown",
        },
        { type: "BRANCH", name: "Opened?", condition: "openRate > 0", position: { x: 9, y: 9 } },
        { type: "WAIT", name: "Wait 3 days", timerValue: 3, intervalUnit: "DAY" },
      ],
      powerListConfig: { sourceType: "DATA_DESIGNER", datasetName: "acme_actives", width: 77, style: "raw" },
      viewport: { zoom: 0.8 },
    }),
    metaJson: "not actually json here", // "…json" key that isn't JSON — left alone
  },
}));

const fNoId = join(ROOT, "no-id.json");
writeFileSync(fNoId, JSON.stringify({ data: { foo: 1 } }));

const fBad = join(ROOT, "bad.json");
writeFileSync(fBad, "{ not json");

const OUT = join(ROOT, "docs");
const res = spawnSync(process.execPath, [SCRIPT, "--out-dir", OUT, fMain, fNoId, fBad], { encoding: "utf8" });
let summary = null;
try { summary = JSON.parse(res.stdout); } catch { /* asserted below */ }

check("batch: exit 0 when some files succeed", res.status === 0, { status: res.status, stderr: res.stderr });
check("batch: summary counts 1 written / 2 failed", summary?.written?.length === 1 && summary?.failed?.length === 2, summary);
check("batch: no-id payload failure names the missing field", summary?.failed?.some((f) => /programId/.test(f.error)), summary?.failed);
check("batch: unparseable file named in failed[]", summary?.failed?.some((f) => f.file === fBad), summary?.failed);

const mainName = readdirSync(OUT).find((f) => /^prog_acme_0001-[0-9a-f]{8}\.md$/.test(f));
check("doc: sanitized filename gets a deterministic hash suffix", Boolean(mainName), readdirSync(OUT));
const doc = readFileSync(join(OUT, mainName), "utf8");
check("doc: title heading + key/id/name bullets", doc.startsWith("# Acme Onboarding Journey") && doc.includes("- key: journey/prog acme/0001") && doc.includes("- id: prog acme/0001"), doc.slice(0, 200));
check("doc: scalar bullets from the compacted program object", doc.includes("- status: ACTIVE") && doc.includes("- modifiedDate: 2026-01-15") && !doc.includes("- width:") && !doc.includes("- stepJson:"), doc.slice(0, 400));
check("doc: re-fetch note carries the real id", doc.includes("jo p describe --id prog acme/0001"), doc);
check("doc: geometry dropped at top level and inside parsed stepJson", !/"x":/.test(doc) && !doc.includes('"transform"') && !doc.includes("#fff") && !doc.includes('"viewport"') && !doc.includes('"width": 1440'), doc);
check("doc: semantic skeleton kept (types, names, condition, timer, template ref)", doc.includes('"templateId": "tpl-gsid-acme-0001"') && doc.includes('"condition": "openRate > 0"') && doc.includes('"timerValue": 3'), doc);
check("doc: unknown keys kept — drop-list fails open to keeping data", doc.includes('"futureSemanticField": "kept even though unknown"'), doc);
check("doc: PowerList subtree verbatim — even drop-list keys inside it survive", doc.includes('"width": 77') && doc.includes('"style": "raw"') && doc.includes('"datasetName": "acme_actives"'), doc);
check("doc: embedded stepJson parsed to an object, non-JSON …json string left alone", doc.includes("embedded JSON parsed: stepJson") && !doc.includes('\\"nodes\\"') && doc.includes('"metaJson": "not actually json here"'), doc.slice(0, 600));

// Real JO describe envelope (S5-V finding F1): the program lives under
// data.advancedOutreach — data itself carries no programId/id.
const fJo = join(ROOT, "jo-envelope.json");
writeFileSync(fJo, JSON.stringify({
  result: true,
  requestId: "req-fixture-0001",
  data: {
    advancedOutreach: {
      advancedOutreachId: "ao-fixture-0001",
      advancedOutreachName: "Acme Renewal Journey",
      advancedOutreachStatus: "PROCESSING",
      advancedOutreachModel: "DRIPV2",
      stepJson: JSON.stringify([{ stepId: "s1", stepType: "START", order: 1, x: 5 }]),
    },
    versions: [],
  },
}));
{
  const resJo = spawnSync(process.execPath, [SCRIPT, "--out-dir", OUT, fJo], { encoding: "utf8" });
  let joSummary = null;
  try { joSummary = JSON.parse(resJo.stdout); } catch { /* asserted below */ }
  check("jo envelope: real describe shape renders (id from data.advancedOutreach)", resJo.status === 0 && joSummary?.written?.[0]?.id === "ao-fixture-0001", joSummary);
  const joDoc = readFileSync(join(OUT, readdirSync(OUT).find((f) => f.startsWith("ao-fixture-0001"))), "utf8");
  check(
    "jo envelope: title/name/key/scalars from advancedOutreach; geometry still dropped in embedded JSON",
    joDoc.startsWith("# Acme Renewal Journey") && joDoc.includes("- key: journey/ao-fixture-0001") &&
      joDoc.includes("- advancedOutreachStatus: PROCESSING") && !joDoc.includes("- advancedOutreachName:") &&
      joDoc.includes("jo p describe --id ao-fixture-0001") && !/"x":/.test(joDoc),
    joDoc.slice(0, 400)
  );
}

// A payload carrying BOTH a top-level programId and a JO envelope keeps the
// top-level id (legacy precedence preserved; S5-V post-rider review fix).
const fDual = join(ROOT, "dual-id.json");
writeFileSync(fDual, JSON.stringify({
  data: { programId: "outer-x", name: "Outer Wins", advancedOutreach: { advancedOutreachId: "inner-y", advancedOutreachName: "Inner Loses" } },
}));
{
  const resDual = spawnSync(process.execPath, [SCRIPT, "--out-dir", OUT, fDual], { encoding: "utf8" });
  let dualSummary = null;
  try { dualSummary = JSON.parse(resDual.stdout); } catch { /* asserted below */ }
  check("dual shape: top-level programId beats the JO envelope id", resDual.status === 0 && dualSummary?.written?.[0]?.id === "outer-x", dualSummary);
}

// ── wave-2 portability: case-collision dedup (F-139, mirroring template-doc) ──
// F-125 made all four per-run dedup Sets case-insensitive, but only template-doc
// and the manifest stub were pinned — this site could regress with the suite
// green (F-139). Distinct ids differing only by case are ONE file on
// Windows/macOS, so the -dup suffix must fire on every OS or the second doc
// silently overwrites the first while the summary still claims both written.
{
  const fUpper = join(ROOT, "case-upper.json");
  const fLower = join(ROOT, "case-lower.json");
  writeFileSync(fUpper, JSON.stringify({ data: { programId: "PRG-A", name: "Upper" } }));
  writeFileSync(fLower, JSON.stringify({ data: { programId: "prg-a", name: "Lower" } }));
  const outC = join(ROOT, "docs-collide");
  const resC = spawnSync(process.execPath, [SCRIPT, "--out-dir", outC, fUpper, fLower], { encoding: "utf8" });
  let sumC = null;
  try { sumC = JSON.parse(resC.stdout); } catch { /* asserted below */ }
  const filesC = readdirSync(outC);
  check(
    "collision: case-colliding programIds get distinct files on every OS (F-125/F-139)",
    sumC?.written?.length === 2 && filesC.length === 2 && filesC.some((f) => f.includes("-dup")),
    { written: sumC?.written?.length, filesC }
  );
}

// F-381: --out-dir is read through the shared opt() — a bare trailing flag draws
// the one "requires a value" message every sibling script emits, not a usage line.
{
  const resBare = spawnSync(process.execPath, [SCRIPT, fMain, "--out-dir"], { encoding: "utf8" });
  check("trailing bare --out-dir rejected with the shared opt() message (F-381)", resBare.status === 1 && /--out-dir requires a value/.test(resBare.stderr), resBare.stderr);
}
const resAllBad = spawnSync(process.execPath, [SCRIPT, "--out-dir", OUT, fBad], { encoding: "utf8" });
check("batch: exit 1 when every file fails", resAllBad.status === 1, { status: resAllBad.status, stdout: resAllBad.stdout });


// ── W10 / F-360: the summary survives a pipe past the first chunk ─────────────
// 70 payloads → one stdout write over 8 KB. Prediction: GREEN here (Linux and
// Windows pipes are synchronous) and GREEN on macOS ONLY with the fix — pre-fix,
// macOS truncated the write at 8,192 bytes on the synchronous exit (F-356's
// measured mechanism), so this case's discriminating home is the release
// matrix's macOS leg; locally it pins the size crossing and the exit-code path.
{
  const big = join(ROOT, "big-w10");
  mkdirSync(big, { recursive: true });
  const bigFiles = [];
  for (let i = 0; i < 70; i++) {
    const f = join(big, `p-${i}.json`);
    writeFileSync(f, JSON.stringify({ data: { programId: `big-prog-${String(i).padStart(3, "0")}`, name: `Big program ${i}` } }));
    bigFiles.push(f);
  }
  const resBig = spawnSync(process.execPath, [SCRIPT, "--out-dir", join(big, "docs"), ...bigFiles], { encoding: "utf8" });
  let bigSummary = null;
  try { bigSummary = JSON.parse(resBig.stdout); } catch { /* asserted below */ }
  check("F-360: a 70-doc summary (> 8 KB, one write) parses whole through a pipe and exits 0",
    resBig.status === 0 && bigSummary?.written?.length === 70 && Buffer.byteLength(resBig.stdout) > 8192,
    { status: resBig.status, bytes: Buffer.byteLength(resBig.stdout), written: bigSummary?.written?.length });
}
rmSync(ROOT, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : "\nAll program-doc checks passed");
process.exit(failures ? 1 : 0);
