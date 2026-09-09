#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// er-gaps.mjs (test) — fixtures for scripts/er-gaps.mjs (GP-B5 DS-29).
//
// Covers: the TTL-stale selection (full-depth + lastVerified only, oldest
// first — the on-disk order IS the budget-cut order, so a wrong sort spends
// the budget on the wrong programs), the stub backlog counted from the
// MANIFEST's depth/status (documented|failed at depth metadata; pending and
// other domains excluded — the describe-batch --upgrade predicate, NOT the
// index's narrower doc-shape stubs), liveOnly/template work lists keyed by
// each domain's RECORDED idField (falling back to "id" — a wrong key would
// make upsert-batch refuse the file as an accidental rekey), the ER-15
// tokenless join (tokens null is the gap; [] is affirmatively-no-tokens;
// orphan docs excluded from the batchable list and counted separately, so
// mark's all-or-nothing contract can never refuse the whole backfill), the
// summary total excluding orphans, BOM-tolerant index+manifest reads, and the
// failure-honesty contract: missing args, a bad TTL, an absent index, and an
// absent manifest each refuse loudly with exit 1 naming er-gaps.mjs — never a
// confidently empty work list.
//
// Fixtures use the fictional acme tenant, under the OS temp dir (shared rig).
//
// Run:  node plugins/gs-superadmin/test/er-gaps.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "er-gaps.mjs");

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)}`);
  }
}

// Distinct, asymmetric fixture values per category (F-188 discipline: no two
// cases share a count, so a summary wired to the wrong list cannot pass).
const fresh = new Date(Date.now() - 60_000).toISOString(); // within any sane TTL
const index = {
  programs: {
    "p-fresh": { id: "p-fresh", depth: "full", lastVerified: fresh },
    "p-old-2025": { id: "p-old-2025", depth: "full", lastVerified: "2025-11-05T00:00:00Z" },
    "p-old-2024": { id: "p-old-2024", depth: "full", lastVerified: "2024-03-09T00:00:00Z" },
    "p-shallow": { id: "p-shallow", depth: "metadata", lastVerified: "2024-01-01T00:00:00Z" },
    "p-unverified": { id: "p-unverified", depth: "full" },
  },
  templates: {
    "t-tokenless": { id: "t-tokenless", tokens: null },
    "t-none": { id: "t-none", tokens: [] },
    "t-tokened": { id: "t-tokened", tokens: [{ id: "tok1" }] },
    "t-orphan": { id: "t-orphan", tokens: null },
    "t-broken": { tokens: null }, // no id: must be skipped, not crash
  },
  gaps: {
    liveOnly: [
      { id: "lp-1", name: "Acme Live Only One" },
      { id: "lp-2", name: "Acme Live Only Two" },
      { id: "lp-3", name: "Acme Live | Piped" },
    ],
    referencedTemplatesMissing: ["tm-1", "tm-2"],
    stubs: ["decoy-doc-shape-stub"], // the NARROWER notion: must NOT feed stubPrograms
  },
};
const manifest = {
  baseUrl: "https://acme.gainsightcloud.com",
  domains_indexed: {
    journey: { idField: "programId" },
    // journey-email-templates deliberately has NO idField recording → "id".
    "journey-email-templates": {},
  },
  inventory: {
    "journey/stub-a": { domain: "journey", depth: "metadata", status: "documented" },
    "journey/stub-b": { domain: "journey", depth: "metadata", status: "failed" },
    "journey/stub-pending": { domain: "journey", depth: "metadata", status: "pending" },
    "journey/full-a": { domain: "journey", depth: "full", status: "documented" },
    "scorecard/stub-other": { domain: "scorecard", depth: "metadata", status: "documented" },
    "journey-email-templates/t-tokenless": { domain: "journey-email-templates", depth: "full", status: "documented" },
    "journey-email-templates/t-none": { domain: "journey-email-templates", depth: "full", status: "documented" },
    // t-orphan deliberately absent: rekey cleanup keeps doc files by design.
  },
};

const ROOT = makeTempDir("er-gaps-test");
try {
  writeFiles(ROOT, {
    ".gs-superadmin/tmp/er-index.json": JSON.stringify(index),
    "acme-prod/_manifest.json": JSON.stringify(manifest),
  });
  const run = (...args) => runNode(SCRIPT, args, { cwd: ROOT });
  const readList = (f) => JSON.parse(readFileSync(join(ROOT, ".gs-superadmin/tmp", f), "utf8"));

  let r = run("acme-prod/_manifest.json", "14");
  const sum = r.status === 0 ? JSON.parse(r.stdout) : null;
  check("runs green and prints one summary JSON line", r.status === 0 && sum !== null, r);
  check("summary: recorded idFields surface (journey recorded, templates fall back to id)",
    sum && sum.idFields.journey === "programId" && sum.idFields["journey-email-templates"] === "id", sum);
  // F-429 second pass (consumer-parity): the summary is this script's only
  // surface, so the resolver's basis and warnings ride it beside the folder
  // names instead of being dropped. Default names here — no list recordings.
  check("summary: domains + domainBasis + warnings (the resolver's honesty signals reach the one surface)",
    sum && sum.domains?.journey === "journey" && sum.domainBasis?.journey === "default (no recording)" && Array.isArray(sum.warnings) && sum.warnings.length === 0, { domains: sum?.domains, basis: sum?.domainBasis, warnings: sum?.warnings });
  check("summary: per-category counts (stale 2, stubs 2, liveOnly 3, templates 2, tokenless 1, orphans 1)",
    sum && sum.stalePrograms === 2 && sum.stubPrograms === 2 && sum.liveOnlyPrograms === 3 &&
      sum.missingTemplates === 2 && sum.tokenlessTemplates === 1 && sum.tokenlessOrphanDocs === 1, sum);
  check("summary: total sums the batchable categories and excludes orphan docs",
    sum && sum.total === 2 + 2 + 3 + 2 + 1, sum);

  check("stale list: full manifest keys, oldest lastVerified first (budget-cut order)",
    JSON.stringify(readList("er-gap-stale.json")) === JSON.stringify(["journey/p-old-2024", "journey/p-old-2025"]),
    readList("er-gap-stale.json"));
  check("liveOnly list: keyed by the RECORDED journey idField, names carried",
    JSON.stringify(readList("er-gap-liveonly.json")) === JSON.stringify([
      { name: "Acme Live Only One", programId: "lp-1" },
      { name: "Acme Live Only Two", programId: "lp-2" },
      { name: "Acme Live | Piped", programId: "lp-3" },
    ]), readList("er-gap-liveonly.json"));
  check("templates list: keyed by the fallback id field",
    JSON.stringify(readList("er-gap-templates.json")) === JSON.stringify([{ id: "tm-1" }, { id: "tm-2" }]),
    readList("er-gap-templates.json"));
  check("tokenless list: joined against the manifest (orphan and id-less entries excluded)",
    JSON.stringify(readList("er-gap-tokenless.json")) === JSON.stringify(["journey-email-templates/t-tokenless"]),
    readList("er-gap-tokenless.json"));
  check("orphan list: the unbatchable tokenless docs, reported not batched",
    JSON.stringify(readList("er-gap-tokenless-orphans.json")) === JSON.stringify(["journey-email-templates/t-orphan"]),
    readList("er-gap-tokenless-orphans.json"));

  // TTL 0: every full+lastVerified program in the past is stale — the fresh one
  // joins, the shallow and unverified ones still cannot.
  r = run("acme-prod/_manifest.json", "0");
  const sum0 = r.status === 0 ? JSON.parse(r.stdout) : null;
  check("ttl 0: fresh full program becomes stale too; depth/lastVerified gates hold",
    sum0 && sum0.stalePrograms === 3 &&
      JSON.stringify(readList("er-gap-stale.json")) ===
        JSON.stringify(["journey/p-old-2024", "journey/p-old-2025", `journey/p-fresh`]),
    { sum0, list: readList("er-gap-stale.json") });

  // BOM-tolerant reads: PS 5.1 rewrites prepend one to either file.
  writeFiles(ROOT, {
    ".gs-superadmin/tmp/er-index.json": Buffer.from("\uFEFF" + JSON.stringify(index), "utf8"),
    "acme-prod/_manifest.json": Buffer.from("\uFEFF" + JSON.stringify(manifest), "utf8"),
  });
  r = run("acme-prod/_manifest.json", "14");
  check("BOM'd index and manifest still parse (PS 5.1 rewrite reality)",
    r.status === 0 && JSON.parse(r.stdout).total === 10, r);

  // F-434 (release-gate review of 0.37.0): the resolver's startDir is the SLUG
  // directory, so the docs-on-disk tie-break lists the real KB folders — with
  // cwd (the workspace root) it listed nothing and er-gaps could pick a
  // different domain than jo-report on the same manifest.
  writeFiles(ROOT, {
    "acme-prod/journey/p-fresh.md": "# p-fresh\n\n- key: journey/p-fresh\n- id: p-fresh\n",
    "acme-prod/_manifest.json": JSON.stringify({
      ...manifest,
      inventory: {},
      domains_indexed: {
        "aaa-probe": { idField: "programId", listCommand: "gs-admin --json jo p list" },
        journey: { idField: "programId", listCommand: "gs-admin --json jo programs list" },
        "journey-email-templates": {},
      },
    }),
  });
  r = run("acme-prod/_manifest.json", "14");
  {
    const s = r.status === 0 ? JSON.parse(r.stdout) : null;
    check("F-434: two domains recording the programs list, no inventory — er-gaps reads the one whose folder holds docs (the slug dir is the KB root), not the probe that sorts first",
      s && s.domains?.journey === "journey" && s.domainBasis?.journey === "manifest recording (ambiguous)" && (s.warnings ?? []).some((w) => /reading journey \(its folder holds 1 doc\(s\) on disk\)/.test(w)),
      { status: r.status, domains: s?.domains, basis: s?.domainBasis, warnings: s?.warnings, stderr: r.stderr.slice(0, 200) });
  }
  writeFiles(ROOT, { "acme-prod/_manifest.json": JSON.stringify(manifest) });

  r = run();
  check("missing manifest argument refuses with usage naming the script",
    r.status === 1 && /er-gaps\.mjs: usage/.test(r.stderr), r);
  r = run("acme-prod/_manifest.json", "14", "extra");
  check("extra argument refuses with usage", r.status === 1 && /usage/.test(r.stderr), r);
  r = run("acme-prod/_manifest.json", "soon");
  check("non-numeric TTL refuses loudly instead of silently selecting nothing",
    r.status === 1 && /ttl-days/.test(r.stderr) && r.stdout.trim() === "", r);
  // Number("") === 0: an unset-but-quoted shell variable must refuse, never
  // read as "everything is stale" (review round, B7).
  r = run("acme-prod/_manifest.json", "");
  check("empty TTL argument refuses loudly, never coerces to 0",
    r.status === 1 && /empty argument/.test(r.stderr) && r.stdout.trim() === "", r);
  r = run("acme-prod/_manifest.json", "  ");
  check("whitespace-only TTL argument refuses the same way",
    r.status === 1 && /empty argument/.test(r.stderr) && r.stdout.trim() === "", r);
  r = run("acme-prod/absent-manifest.json", "14");
  check("absent manifest refuses loudly, naming the path",
    r.status === 1 && r.stderr.includes("absent-manifest.json"), r);
} finally {
  removeTempDir(ROOT);
}

// Absent index: its own rig, so the missing file is the only difference.
const ROOT2 = makeTempDir("er-gaps-noindex");
try {
  writeFiles(ROOT2, { "acme-prod/_manifest.json": JSON.stringify(manifest) });
  const r = runNode(SCRIPT, ["acme-prod/_manifest.json", "14"], { cwd: ROOT2 });
  check("absent index refuses loudly pointing at step 3 — never 'no gaps'",
    r.status === 1 && r.stderr.includes("er-index.json") && /step-3/.test(r.stderr) && r.stdout.trim() === "", r);
} finally {
  removeTempDir(ROOT2);
}

console.log("");
if (failures > 0) {
  console.log(`${failures} er-gaps check(s) FAILED`);
  process.exit(1);
}
console.log("All er-gaps checks passed");
