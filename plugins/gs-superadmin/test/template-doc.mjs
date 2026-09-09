#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// template-doc.mjs (test) — fixture tests for scripts/template-doc.mjs
//
// Covers: compact doc from a describe payload (decoded subject, verbatim plain
// body, metadata bullets, re-fetch note), HTML fields dropped, empty-plainText
// fallback via tag stripping, filename sanitizing, variants section, batch
// behavior with an unparseable file, and the all-files-failed exit code. These
// checks also lock the standalone path after the rendering moved to the shared
// doc-lib.mjs (describe-batch.mjs's template doc-mode imports the same
// renderer; the batch-vs-standalone parity check lives in test/describe-batch.mjs).
// Fixtures under the OS temp dir.
//
// Run:  node plugins/gs-superadmin/test/template-doc.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
// The template payloads live in the shared reader payload corpus
// (test/fixtures/reader-payloads.mjs) — the tracer renders the same objects.
import { TEMPLATE_MAIN, TEMPLATE_FALLBACK, TEMPLATE_VARIANTS, TEMPLATE_VARIANT_B, TEMPLATE_TOKENS } from "./fixtures/reader-payloads.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "template-doc.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-template-doc-${process.pid}`);
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

const payload = (emailTemplate, variants = []) =>
  JSON.stringify({ result: true, data: { emailTemplate, variants } });

const fMain = join(ROOT, "main.json");
writeFileSync(fMain, payload(TEMPLATE_MAIN));

const fFallback = join(ROOT, "fallback.json");
writeFileSync(fFallback, payload(TEMPLATE_FALLBACK));

const fVariants = join(ROOT, "variants.json");
writeFileSync(fVariants, payload(TEMPLATE_VARIANTS, [TEMPLATE_VARIANT_B]));

// ER-15: token metadata (_tokens + a tokenMappings survey entry) → "## Tokens"
const fTokens = join(ROOT, "tokens.json");
writeFileSync(fTokens, payload(TEMPLATE_TOKENS));

const fBad = join(ROOT, "bad.json");
writeFileSync(fBad, "{ not json");

const OUT = join(ROOT, "docs");
const res = spawnSync(process.execPath, [SCRIPT, "--out-dir", OUT, fMain, fFallback, fVariants, fTokens, fBad], { encoding: "utf8" });
let summary = null;
try { summary = JSON.parse(res.stdout); } catch { /* asserted below */ }

check("batch: exit 0 when some files succeed", res.status === 0, { status: res.status, stderr: res.stderr });
check("batch: summary counts 4 written / 1 failed", summary?.written?.length === 4 && summary?.failed?.length === 1, summary);
check("batch: bad file named in failed[]", summary?.failed?.[0]?.file === fBad, summary?.failed);

const mainName = readdirSync(OUT).find((f) => /^tpl_1_weird-[0-9a-f]{8}\.md$/.test(f));
check("doc: sanitized filename gets a deterministic hash suffix (tpl 1/weird)", Boolean(mainName), readdirSync(OUT));
const mainDoc = readFileSync(join(OUT, mainName), "utf8");
check("doc: title heading", mainDoc.startsWith("# Welcome & Hello"), mainDoc.slice(0, 60));
check("doc: subject entity-decoded", mainDoc.includes("- subject: Hi & welcome"), mainDoc);
check("doc: plain body verbatim", mainDoc.includes("this is the plain searchable body"), mainDoc);
check("doc: HTML/editor content dropped", !mainDoc.includes("HTML ONLY MARKER") && !mainDoc.includes("EDITOR ONLY MARKER") && !mainDoc.includes("&lt;"), mainDoc);
check("doc: re-fetch note carries the real id", mainDoc.includes("jo email template --id tpl 1/weird"), mainDoc);
check("doc: metadata bullets (created/modified with names)", mainDoc.includes("- created: 2023-04-14 03:04:53 UTC by Jordan") && mainDoc.includes("by Leah"), mainDoc);

const fbDoc = readFileSync(join(OUT, "tpl-2.md"), "utf8");
check("fallback: derived-from-HTML note present", fbDoc.includes("derived from HTML"), fbDoc);
check("fallback: tags/styles stripped, entities decoded", fbDoc.includes("Milestone deadline is approaching & near") && !fbDoc.includes("<p>") && !fbDoc.includes("color:red"), fbDoc);

const vDoc = readFileSync(join(OUT, "tpl-3.md"), "utf8");
check("variants: section emitted with variant body", vDoc.includes("## Variants") && vDoc.includes("### Variant B") && vDoc.includes("Variant body content lives here."), vDoc);
check("variants: absent when variants array empty", !mainDoc.includes("## Variants"), null);

// ER-15 (C1 v2): "## Tokens" written ABOVE the body from _tokens[] +
// tokenMappings; absent entirely when the payload had no token metadata
const tDoc = readFileSync(join(OUT, "tpl-4.md"), "utf8");
check("tokens: section above the body with the C1 v2 array", tDoc.indexOf("## Tokens") < tDoc.indexOf("## Body (plain text)") && tDoc.includes('"displayName": "Product Name"') && tDoc.includes('"defaultValue": "Your Product"'), tDoc);
check("tokens: survey identity from tokenMappings (synthesized SURVEY entry)", tDoc.includes('"tokenKey": "gs-t2"') && tDoc.includes('"surveyName": "Intake"'), tDoc);
check("tokens: subject stays verbatim in the doc (resolution is report-time)", tDoc.includes("- subject: T ${subj::gs-t1}"), tDoc);
check("tokens: section absent when the payload carries no token metadata", !mainDoc.includes("## Tokens") && !vDoc.includes("## Tokens"), null);

const resAllBad = spawnSync(process.execPath, [SCRIPT, "--out-dir", OUT, fBad], { encoding: "utf8" });
check("batch: exit 1 when every file fails", resAllBad.status === 1, { status: resAllBad.status, stdout: resAllBad.stdout });

// ── wave-2 portability: case-collision dedup + BOM'd captures ────────────────
{
  // F-125: distinct ids that differ only by case are one FILE on
  // Windows/macOS — the -dup suffix must fire on every OS, or the second doc
  // silently overwrites the first while the summary claims both written.
  const fUpper = join(ROOT, "upper.json");
  const fLower = join(ROOT, "lower.json");
  writeFileSync(fUpper, payload({ templateId: "TPL-A", title: "Upper", plainTextContent: "Body long enough to keep." }));
  writeFileSync(fLower, payload({ templateId: "tpl-a", title: "Lower", plainTextContent: "Body long enough to keep." }));
  const outC = join(ROOT, "docs-collide");
  const resC = spawnSync(process.execPath, [SCRIPT, "--out-dir", outC, fUpper, fLower], { encoding: "utf8" });
  const sumC = JSON.parse(resC.stdout);
  const filesC = readdirSync(outC);
  check("collision: case-colliding ids get distinct files on every OS (F-125)", sumC.written.length === 2 && filesC.length === 2 && filesC.some((f) => f.includes("-dup")), { written: sumC.written.length, filesC });

  // F-118: a BOM-prefixed capture (the PowerShell-redirect normal case on
  // Windows) parses instead of landing in failed[] with a misattributed
  // JSON error. BOM built via fromCharCode — never a literal (F-130 rule).
  const fBom = join(ROOT, "bom.json");
  writeFileSync(fBom, String.fromCharCode(0xfeff) + payload({ templateId: "tpl-bom", title: "Bommed", plainTextContent: "Body long enough to keep." }));
  const resB = spawnSync(process.execPath, [SCRIPT, "--out-dir", outC, fBom], { encoding: "utf8" });
  const sumB = JSON.parse(resB.stdout);
  check("bom: BOM-prefixed capture parses and documents (F-118)", resB.status === 0 && sumB.written.length === 1 && sumB.failed.length === 0, sumB);
}


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
    writeFileSync(f, payload({ templateId: `big-tpl-${String(i).padStart(3, "0")}`, title: `Big template ${i}`, plainTextContent: "Body long enough to keep." }));
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
console.log(failures ? `\n${failures} failure(s)` : "\nAll template-doc checks passed");
process.exit(failures ? 1 : 0);
