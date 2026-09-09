#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// er-count.mjs — email-report page-entry counter (GP-B5 DS-29).
//
// Prints the largest array length found in a JSON payload — for a captured
// list page, the page's entry count. The email-report skill runs it on each
// captured `jo p list` page to decide when to stop paging WITHOUT reading a
// payload into model context (the bulk-JSON tenet). It used to ship as an
// inline transcription the skill wrote to `.gs-superadmin/tmp/er-count.mjs`
// on every run; DS-29 ships it here and the transcription is deleted.
//
// Traversal contract (kept exactly as the transcription behaved): arrays are
// measured but NOT descended into — a list entry's own nested arrays (a
// program's steps, say) must never outvote the entry array itself. A payload
// with no arrays prints 0. Since GP-B5 DS-30 the traversal lives in doc-lib,
// shared with capture.mjs --paginate — which owns the page LOOP and its stop
// rule; this script remains the count-one-captured-page tool. Since gate-3
// (F-351, then F-354/F-355) the two share the rows-array DECISION itself
// (doc-lib decideEntryArray): the rows array is the spine's single candidate
// (root / root child / `data` child) or the one --items-path names, and the
// shapes capture refuses as `unrecognized-shape` — arrays only off the
// spine, several spine arrays of different lengths (a bundle such as `jo cta
// options`), an --items-path naming no array — are refused HERE too, exit 1
// with the same reason, under the F-306 convention below: a page whose rows
// cannot be decided is a FAILED sweep page, never "0 entries". (F-354 was this
// script printing a silent 0 on the off-spine shape; F-355 was it answering
// 98 on the bundle capture refused.)
//
// Usage: node er-count.mjs <payload.json> [--items-path <dotted>] — prints one integer.
// The read is BOM-tolerant (doc-lib readJsonFile — PS 5.1 redirects prepend
// one, fatal to a bare JSON.parse). A missing argument, missing file, or
// malformed payload refuses loudly, exit 1, naming this script (F-306
// convention): a page that cannot be read is a FAILED sweep page, never
// "0 entries".
//
// Zero dependencies — Node built-ins + doc-lib only.
// ─────────────────────────────────────────────────────────────────────────────
import { makeCliHelpers, readJsonFile, decideEntryArray, entryDecisionReason, DOTTED_PATH_RE } from "./doc-lib.mjs";

const argv = process.argv.slice(2);
const { opt, fail } = makeCliHelpers("er-count.mjs", argv);
const USAGE = "usage: node er-count.mjs <payload.json> [--items-path <dotted>]";
const itemsPath = opt("--items-path");
const positional = argv.filter((a, i) => a !== "--items-path" && argv[i - 1] !== "--items-path");
if (positional.length !== 1 || positional[0].startsWith("--")) fail(USAGE);
if (itemsPath !== undefined && !DOTTED_PATH_RE.test(itemsPath)) fail(`--items-path must be a dotted key path (e.g. data.rows) — ${USAGE}`);
const file = positional[0];
let d;
try {
  d = readJsonFile(file);
} catch (e) {
  fail(`${file}: ${e?.message ?? e} — treat this page as a failed sweep page, not as 0 entries`);
}
const { decision } = decideEntryArray(d, itemsPath !== undefined ? { itemsPath } : {});
const reason = entryDecisionReason(decision);
if (reason) fail(`${file}: ${reason} — treat this page as a FAILED sweep page, not as 0 entries`);
console.log(decision.kind === "rows" ? decision.count : 0);
