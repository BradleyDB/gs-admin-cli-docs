#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// er-gaps.mjs — email-report gap-fill work-list builder (GP-B5 DS-29).
//
// Reads the step-3 index (`.gs-superadmin/tmp/er-index.json` — cwd-relative by
// contract: email-report runs every step from the workspace root) plus the
// workspace manifest, and writes the step-4c work lists beside the index:
//
//   er-gap-stale.json             JSON array of FULL manifest keys
//                                 ("journey/<id>"), oldest-lastVerified first —
//                                 exactly the shape `manifest.mjs mark
//                                 --keys-file` consumes, so the budget cut
//                                 happens on disk via --limit, in file order,
//                                 never through model context.
//   er-gap-liveonly.json          array of `{ <journey idField>: id, name }` —
//                                 the `manifest.mjs upsert-batch --file` shape.
//   er-gap-templates.json         array of `{ <template idField>: id }` (same
//                                 consumer, journey-email-templates domain).
//   er-gap-tokenless.json         array of FULL manifest keys
//                                 ("journey-email-templates/<id>"), id-ordered
//                                 — the ER-15 backfill list, joined against the
//                                 manifest (rule below).
//   er-gap-tokenless-orphans.json the tokenless doc keys that joined to NO
//                                 manifest entry (reported as a caveat count,
//                                 never batched).
//
// It prints a one-line summary JSON — recorded idFields, per-category counts,
// total — the only part that enters model context.
//
// Input shapes this script rides on (the sync the skill used to carry as a
// keep-in-sync warning; stated once, here, at the consumer):
//   - er-index.json gaps/programs/templates — scripts/jo-report.mjs
//     buildIndex() (C1 v2: template entries carry tokens[]|null — null means
//     the doc predates token metadata, the ER-15 backfill gap class; [] means
//     the payload affirmatively had none — not a gap)
//   - stub backlog + recorded idFields — scripts/manifest.mjs (`next --upgrade`
//     predicate; domains_indexed). Items files are keyed by each domain's
//     RECORDED idField — upsert-batch refuses a mismatch as an accidental
//     rekey.
//
// Stub backlog = what describe-batch --upgrade will actually select (manifest
// depth "metadata", status documented|failed), NOT ix.gaps.stubs (index
// doc-shape stubs — a different, narrower notion that misses shallow-crawl
// stub docs).
//
// ER-15 join rule: tokenless template ids are DOC-derived (the index parses
// them out of the KB files), so they are joined against the manifest before
// they become a work list — an orphaned doc (rekey cleanup keeps doc files by
// design, and list-invisible recovery docs never had a list row) would
// otherwise put an unknown key in the batch, and mark's all-or-nothing
// contract would refuse the WHOLE backfill on every run. (The stale list needs
// no join: the index takes lastVerified from the inventory itself, so those
// keys exist by construction.)
//
// Usage: node er-gaps.mjs <slug>/_manifest.json <ttl-days>
//   <ttl-days> — the workspace's Journeys freshness TTL in days (default 14).
// Reads are BOM-tolerant (doc-lib readJsonFile); a missing argument, an
// unreadable index or manifest, or a non-numeric TTL refuses loudly, exit 1,
// naming this script (F-306 convention) — never a confidently empty work list.
//
// Zero dependencies — Node built-ins + doc-lib only.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCliHelpers, readJsonFile, resolveRecordedDomains, laneTable } from "./doc-lib.mjs";
const here = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const { fail } = makeCliHelpers("er-gaps.mjs", argv);
if (argv.length < 1 || argv.length > 2) fail("usage: node er-gaps.mjs <slug>/_manifest.json <ttl-days>");
const TMP = ".gs-superadmin/tmp";
let ix;
try {
  ix = readJsonFile(`${TMP}/er-index.json`);
} catch (e) {
  fail(`${TMP}/er-index.json: ${e?.message ?? e} — run the step-3 index build first; an unreadable index must not read as "no gaps"`);
}
let mf;
try {
  mf = readJsonFile(argv[0]);
} catch (e) {
  fail(`${argv[0]}: ${e?.message ?? e} — pass the workspace's _manifest.json`);
}
// Number("") and Number("  ") are 0, so an empty argument (an unset shell
// variable, quoted) would silently mean "everything is stale" — refuse it
// like any other non-number instead of spending the 4c budget on it.
if (argv[1] !== undefined && String(argv[1]).trim() === "") fail(`<ttl-days> must be a non-negative number, got an empty argument`);
const ttlDays = Number(argv[1] ?? 14);
if (!Number.isFinite(ttlDays) || ttlDays < 0) fail(`<ttl-days> must be a non-negative number, got: ${argv[1]}`);
// The journey and template domain NAMES are per-workspace data (F-429):
// resolved from the manifest's recordings through doc-lib's one resolver, the
// literals as the no-recording fallback. cwd is the workspace root by this
// script's contract, so the workspace catalog search starts there.
// The summary is this script's ONLY surface, so the resolver's basis and
// warnings (an ambiguity, a no-catalog fallback) are emitted beside the
// folder names rather than dropped (F-429 second pass, consumer-parity).
// startDir is the SLUG directory (the manifest's own folder), not the workspace
// root: the resolver walks UP from it for the catalog and lists the KB folders
// UNDER it for the docs-on-disk tie-break — passing cwd made that rung read an
// empty root and pick a different domain than jo-report on the same manifest
// (release-gate review of 0.37.0, F-434).
const JO_RESOLVED = resolveRecordedDomains({
  startDir: dirname(resolve(argv[0])),
  domainsIndexed: mf.domains_indexed,
  inventory: mf.inventory,
  ...laneTable({ journey: "journey", templates: "templates" }),
  bundledCatalogPath: join(here, "..", "reference", "catalog.json"),
});
const JO = JO_RESOLVED.dirs;
const fieldFor = (domain) => {
  const r = (mf.domains_indexed ?? {})[domain];
  return r && typeof r === "object" && typeof r.idField === "string" ? r.idField : "id";
};
const keyed = (field, value, extra = {}) => ({ ...extra, [field]: value });
const gaps = ix.gaps ?? {};
const ttlMs = ttlDays * 86400e3;
const stale = Object.values(ix.programs ?? {})
  .filter((p) => p.depth === "full" && p.lastVerified && Date.now() - Date.parse(p.lastVerified) > ttlMs)
  .sort((a, b) => String(a.lastVerified).localeCompare(String(b.lastVerified), "en"))
  .map((p) => p.id);
const stubs = Object.values(mf.inventory ?? {}).filter(
  (e) => e.domain === JO.journey && e.depth === "metadata" && (e.status === "documented" || e.status === "failed")
).length;
const jf = fieldFor(JO.journey);
const tf = fieldFor(JO.templates);
const liveOnly = (gaps.liveOnly ?? []).map((e) => keyed(jf, e.id, { name: e.name }));
const templates = (gaps.referencedTemplatesMissing ?? []).map((id) => keyed(tf, id));
const inv = mf.inventory ?? {};
const tokenlessAll = Object.values(ix.templates ?? {})
  .filter((t) => t && t.id && t.tokens == null)
  .map((t) => `${JO.templates}/${t.id}`)
  .sort();
const tokenless = tokenlessAll.filter((k) => Object.hasOwn(inv, k));
writeFileSync(`${TMP}/er-gap-stale.json`, JSON.stringify(stale.map((id) => `${JO.journey}/${id}`)));
writeFileSync(`${TMP}/er-gap-liveonly.json`, JSON.stringify(liveOnly));
writeFileSync(`${TMP}/er-gap-templates.json`, JSON.stringify(templates));
writeFileSync(`${TMP}/er-gap-tokenless.json`, JSON.stringify(tokenless));
writeFileSync(`${TMP}/er-gap-tokenless-orphans.json`, JSON.stringify(tokenlessAll.filter((k) => !Object.hasOwn(inv, k))));
console.log(JSON.stringify({
  idFields: { [JO.journey]: jf, [JO.templates]: tf },
  domains: JO,
  domainBasis: JO_RESOLVED.basis,
  warnings: JO_RESOLVED.warnings,
  stalePrograms: stale.length,
  stubPrograms: stubs,
  liveOnlyPrograms: liveOnly.length,
  missingTemplates: templates.length,
  tokenlessTemplates: tokenless.length,
  tokenlessOrphanDocs: tokenlessAll.length - tokenless.length,
  total: stale.length + stubs + liveOnly.length + templates.length + tokenless.length,
}));
