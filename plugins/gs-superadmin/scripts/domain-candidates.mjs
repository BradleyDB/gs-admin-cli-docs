#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// domain-candidates.mjs — deterministic domain-candidate enumeration and the
// index-or-exclude diff behind setup Phase 4's candidate gate (F-108).
//
// The problem this owns: "which list commands COULD be KB domains" used to
// live in model recall at first index, so a list nobody thought of stayed
// invisible forever, and a deliberate skip was indistinguishable from an
// oversight. Here the candidate set is DERIVED from the catalog, the decision
// state comes from the manifest (domains_indexed[].listCommand /
// domains_excluded), and the gate refuses to pass while any candidate is
// undecided.
//
// Verbs (read-only — this script never writes the manifest or any file):
//   diff   --manifest <path> [--require-decided]
//     Candidate = artifact-lane command, provably non-mutating
//     (mutating === false), not CLI-hidden, runnable tenant-wide (no
//     CATALOG-DECLARED required CLI-exposed flags — drops per-asset sublists
//     like list-task-outputs — EXCEPT flags with a small declared enum
//     (F-226): those commands are runnable tenant-wide in one invocation per
//     enum value, so they stay candidates carrying a `requiredEnumFlags`
//     marker rather than silently leaving the universe; the CLI enforces SOME
//     requirements only at runtime with no catalog trace (F-219), so such
//     sublists still surface as candidates — flagged `likelyPerAsset` when
//     the summary names a parent asset, never silently dropped on a prose
//     heuristic: a wrong drop would bury a real domain, the exact F-108
//     failure), and list-shaped:
//     actionKey starts with "list", OR the summary's first word is "List"
//     (the second prong catches list commands whose actionKey is spelled
//     differently — topics, events, s3-tasks).
//     Each candidate maps to exactly one state:
//       indexed   — some domains_indexed entry's recorded listCommand
//                   resolves to this command (alias spellings and flag tokens
//                   tolerated)
//       excluded  — domains_excluded carries its canonical path
//       blocked   — domains_blocked carries its canonical path (F-218): the
//                   candidate COULD NOT be evaluated (its list command fails
//                   server-side), so it is neither adoptable nor honestly
//                   excludable. A block satisfies --require-decided — the
//                   alternative is forcing a false permanent exclusion — but
//                   unlike an exclusion it never goes quiet: the diff surfaces
//                   it BY NAME on every run, with its reason and suggested
//                   name, and warns when its recheckAfter date has passed.
//       undecided — none of the above: the gate's work list
//     Undecided candidates get a suggested KB domain name
//     (<namespace>-<actionKey minus the list- prefix>) collision-checked
//     against existing domains and bare namespaces — a renamed domain
//     silently re-adds the whole inventory under a new key prefix and the
//     re-index guard cannot catch it, so the suggestion ships with the
//     enumeration.
//     --require-decided exits 1 (after printing the JSON) while any candidate
//     is undecided OR any indexed domain still lacks a listCommand recording
//     (a legacy manifest — backfill by re-running that domain's upsert-batch
//     with --list-command; the diff cannot be computed without it).
//   check  --manifest <path> --file <list.json> --id-field <dot.path>
//          [--items-path <dot.path>] [--allow-empty] [--allow-partial]
//     The GLOBAL overlap test for one candidate's captured rows: every
//     extracted id is tested against the ids of EVERY inventory entry in
//     EVERY domain — "is this row already indexed ANYWHERE", never "does a
//     domain of this name exist". Testing per-apparent-domain is exactly what
//     let a filtered view of an already-indexed list (list-rest-connections
//     vs the connectors domain, carrying the same connectionId VALUES — the
//     dot-path may differ, see next) read as new. Fails loudly when the id
//     field resolves to no value on any row — a connection-shaped payload's
//     id path follows the endpoint AND the CLI version that captured it:
//     nested (pnpConnectionsInfo.connectionId) from `cn list` at CLI 1.0.8
//     and from `re r list-rest-connections` at every version, top-level
//     (connectionId) from `cn list` at 1.0.9 (F-388) — so a guessed or stale
//     path returns undefined for every row — and equally when it resolves on only SOME rows
//     (F-216): the overlap verdict would then cover the resolvable subset only,
//     which is how an already-indexed subset reads as "all indexed" and earns a
//     permanent exclusion over rows nobody tested. --allow-partial opts into
//     answering anyway, and WITHHOLDS allIndexed/noneIndexed when it does — a
//     partial extraction gets counts, never a decision flag.
//     Zero-row honesty (F-224): a payload with NO locatable items array is
//     fatal unless --allow-empty is passed — exactly upsert-batch's contract —
//     because "no array found" is far more often a typo'd --items-path or a
//     captured error-wrapper body than a genuinely empty tenant list. And
//     however 0 rows are reached (a real empty array, or --allow-empty), the
//     decision flags are WITHHELD (null) with a loud warning: a 0-row check
//     answered nothing, and the pre-fix confident `noneIndexed: true` fed
//     setup Phase 4's ADOPT branch a permanent ledger decision over a payload
//     this script never actually read.
//
// Output: one JSON object on stdout. Non-zero exit + stderr message on error
// (and on a failed --require-decided gate).
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  idPathHint,
  ZERO_RESOLVE_HEAD,
  readJsonFile,
  findItemsArray,
  extractIds,
  makeCliHelpers,
  findWorkspaceCatalog,
  makeCommandResolver,
  recordedDomainsByPath,
  indexedElsewhere,
} from "./doc-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const verb = argv[0];

// Shared argv helpers (F-238) — the F-165/F-171 last-token rule lives in
// doc-lib now; booleans are read with argv.includes, never opt().
const { opt, fail, out, finish } = makeCliHelpers("domain-candidates.mjs", argv);

if (verb !== "diff" && verb !== "check") {
  fail("usage: domain-candidates.mjs <diff|check> --manifest <path> [...]");
}
const manifestPath = opt("--manifest");
if (!manifestPath) fail("--manifest <path> is required");
if (!existsSync(manifestPath)) fail(`manifest not found: ${manifestPath} — run setup's init first`);
let manifest;
try {
  manifest = readJsonFile(manifestPath); // BOM-tolerant (doc-lib, F-118)
} catch (e) {
  fail(`manifest is corrupt (${e.message}): ${manifestPath}`);
}
if (typeof manifest !== "object" || manifest === null || typeof manifest.inventory !== "object" || manifest.inventory === null) {
  fail(`manifest has unexpected shape (missing "inventory" object): ${manifestPath}`);
}

// ── Catalog resolution + command-line matching — shared doc-lib helpers
// (F-232): findWorkspaceCatalog walks up from the manifest dir to the FIRST
// directory containing .gs-superadmin, tries that one workspace catalog, then
// the plugin's bundled reference copy; makeCommandResolver owns the
// token/alias/longest-prefix rules. describe-batch.mjs imports the same pair;
// the guard hook keeps its own deliberately self-contained copy (no-import
// tenet) with a comment naming doc-lib — three copies collapsed to one
// implementation plus that sanctioned copy.
const catalog = findWorkspaceCatalog(dirname(resolve(manifestPath)), join(here, "..", "reference", "catalog.json"));
if (!catalog) fail("no catalog found (workspace or bundled) — cannot derive the candidate set; refusing");
const { known, namespaceNames, resolveLine: resolveCommand } = makeCommandResolver(catalog);

// ── Candidate filter — the two-prong list-shape test plus the mechanical
// gates. mutating must be LITERALLY false: a command whose mutating flag is
// missing (malformed catalog) must never surface as "go run this".
const listShaped = (c) => /^list(-|$)/.test(c.actionKey ?? "") || /^List\b/.test(c.summary ?? "");
// Required-flag prong (F-226, Bradley option a): a required CLI-exposed flag
// with a SMALL declared enum does not make a command per-asset — it makes it
// runnable tenant-wide in N invocations (--type MDA|SFDC|…). Such commands
// stay candidates, carrying requiredEnumFlags so the gate poses them and the
// operator knows the N runs an adoption takes. A required flag with no
// declared enum (a per-asset id) still drops the command. Before this, the
// prong silently removed 4 real tenant-wide lists from the candidate universe
// — they could never be posed, and a recorded exclude against them sat inert.
const ENUM_FLAG_MAX = 8;
const requiredCliFlags = (c) => (c.flags ?? []).filter((f) => f.required && f.cliExposed !== false);
const smallEnum = (f) => Array.isArray(f.enum) && f.enum.length > 0 && f.enum.length <= ENUM_FLAG_MAX;
const tenantWide = (c) => requiredCliFlags(c).every(smallEnum);
// The marker carried on undecided/blocked entries: null for the ordinary
// no-required-flags case, else one {flag, values} per required enum flag.
const requiredEnumFlags = (c) => {
  const fs = requiredCliFlags(c).filter(smallEnum);
  return fs.length
    ? fs.map((f) => ({ flag: (f.flag ?? "").split(/[\s=<[]/)[0] || f.name || null, values: f.enum }))
    : null;
};
const isCandidate = (c) =>
  c.lane === "artifact" && c.mutating === false && !c.cliHidden && !!c.path && listShaped(c) && tenantWide(c);
// Per-asset hint (F-219): a summary naming a parent asset ("…for a rule",
// "…published on a topic", "…a rule's S3 tasks") is the observed signature of
// a sublist whose required flag the catalog fails to declare. ADVISORY ONLY —
// it orders the operator's work and predicts the runtime error, it never
// drops a candidate (false positives cost a moment's read; a false drop would
// silently bury a real domain).
const likelyPerAsset = (c) => /\b(?:for|on|of|from) a\b|\b\w+'s\b/i.test(c.summary ?? "");

if (verb === "diff") {
  const requireDecided = argv.includes("--require-decided");
  const candidates = (catalog.commands ?? []).filter(isCandidate);
  const candidateByPath = new Map(candidates.map((c) => [c.path, c]));

  const warnings = [];
  const domainsIndexed =
    manifest.domains_indexed && typeof manifest.domains_indexed === "object" ? manifest.domains_indexed : {};
  // canonical path → [domain names]: doc-lib's recordedDomainsByPath (F-429
  // hoist — tenant-deps and relationships-build resolve KB folders from the
  // same table, so "which domain is `cn list`" has one answer per manifest).
  const { byPath: indexedByPath, legacyDomains, unresolved } = recordedDomainsByPath(
    manifest.domains_indexed,
    resolveCommand
  );
  for (const { domain, listCommand: lc } of unresolved) {
    warnings.push(
      `domain "${domain}": recorded listCommand does not resolve against this catalog ` +
        `("${lc.slice(0, 80)}") — re-record it via upsert-batch --list-command; a command renamed or ` +
        `removed by a CLI upgrade also lands here, and its successor appears as a new undecided candidate`
    );
  }
  for (const [path, domains] of indexedByPath) {
    if (candidateByPath.has(path)) continue;
    for (const domain of domains) {
      warnings.push(
        `domain "${domain}" is indexed from "${path}", which is outside the candidate universe ` +
          `(not list-shaped/tenant-wide by the filter) — fine if deliberate; if this is a real tenant ` +
          `asset list the filter needs a prong, report it`
      );
    }
  }

  // Nearest-candidate hint for an unresolvable decision key (F-227): a
  // mistyped exclude/block records a phantom decision while the real
  // candidate stays undecided, and the old warning confidently misdiagnosed
  // that as an upstream rename — inviting a SECOND phantom decision. Plain
  // Levenshtein against candidate paths/shortPaths; suggest only within a
  // tight distance so a genuinely retired command gets no false hint.
  const editDistance = (a, b) => {
    if (Math.abs(a.length - b.length) > 6) return Infinity;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  };
  const nearestCandidate = (key) => {
    let best = null, bestD = Infinity;
    for (const c of candidates) {
      for (const p of [c.path, c.shortPath]) {
        if (!p) continue;
        const d = editDistance(key, p);
        if (d < bestD) { bestD = d; best = c.path; }
      }
    }
    return bestD <= Math.max(2, Math.floor(key.length / 4)) ? best : null;
  };

  // One loader for both decision maps (F-239) — the two were ~18-line
  // near-twins, and a key-resolution fix applied to one loop left the other
  // dropping records into its retired-key warning. The WORDING differences are
  // deliberate semantics (an exclusion is a decision and its record is kept; a
  // block is "could not look" and gets lifted), so remediation text and extra
  // fields are parameters, never flattened.
  /**
   * @param {*} mapRaw
   * @param {{label: string, lift: string, keepNote: string,
   *          extraFields?: Record<string, (v: any) => any>}} opts
   */
  const loadDecisionMap = (mapRaw, { label, lift, keepNote, extraFields }) => {
    const byPath = new Map();
    const source = mapRaw && typeof mapRaw === "object" ? mapRaw : {};
    for (const [key, entryRaw] of Object.entries(source)) {
      const entry = entryRaw && typeof entryRaw === "object" ? entryRaw : {};
      const cmd = known.get(key) ?? null;
      if (!cmd) {
        // Typo FIRST, upstream-rename second (F-227) — the phantom-decision
        // hazard is the likelier and the costlier of the two.
        const near = nearestCandidate(key);
        warnings.push(
          `${label} command "${key}" is not in this catalog — a TYPO'D PATH is the likeliest cause: a ` +
            `mistyped ${label === "excluded" ? "exclude" : "block"} records a phantom decision while the real ` +
            `candidate stays undecided${near ? ` (nearest candidate: "${near}")` : ""} — verify, then ` +
            `${lift} and re-record against the real path. Only a command genuinely retired or renamed ` +
            `upstream lands here legitimately (${keepNote}; a renamed successor appears as a new undecided candidate)`
        );
        continue;
      }
      // In the catalog but outside the candidate universe (F-226): the gate
      // never poses this command, so the record can decide nothing — surface
      // it rather than letting it sit silently inert.
      if (!candidateByPath.has(cmd.path)) {
        warnings.push(
          `${label} command "${key}" is in the catalog but OUTSIDE the candidate universe (filtered by the ` +
            `candidate gate) — the record is INERT: the gate never poses this command, so it decides ` +
            `nothing. ${lift[0].toUpperCase()}${lift.slice(1)}; if this really is a tenant asset list, the ` +
            `filter needs a prong — report it`
        );
      }
      const rec = {
        reason: typeof entry.reason === "string" ? entry.reason : null,
        decidedAt: entry.decidedAt ?? null,
      };
      for (const [field, coerce] of Object.entries(extraFields ?? {})) rec[field] = coerce(entry[field]);
      byPath.set(cmd.path, rec);
    }
    return byPath;
  };
  // canonical path → { reason, decidedAt }
  const excludedByPath = loadDecisionMap(manifest.domains_excluded, {
    label: "excluded",
    lift: "lift it (exclude --remove)",
    keepNote: "record kept",
  });
  // canonical path → { reason, decidedAt, recheckAfter }
  const blockedByPath = loadDecisionMap(manifest.domains_blocked, {
    label: "blocked",
    lift: "lift the block (block --remove)",
    keepNote: "lift the block",
    extraFields: { recheckAfter: (v) => (typeof v === "string" ? v : null) },
  });

  // Names already taken — suggested names must collide with none of these,
  // and never with a bare namespace or alias (the skill's naming rule).
  const takenNames = new Set(Object.keys(domainsIndexed));
  for (const e of Object.values(manifest.inventory)) {
    if (e && typeof e === "object" && typeof e.domain === "string") takenNames.add(e.domain);
  }

  const indexed = [];
  const excluded = [];
  const blocked = [];
  const undecided = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const c of candidates) {
    const inDomains = indexedByPath.get(c.path) ?? null;
    const excl = excludedByPath.get(c.path) ?? null;
    const blk = blockedByPath.get(c.path) ?? null;
    // Hand-enumerated pairwise contradiction checks below — COMPLETE for the
    // current three record kinds (indexed / excluded / blocked; verified,
    // F-240), as is the if/else-if precedence chain that follows. Adding a
    // FOURTH record kind makes this 6 pairs: do NOT extend by hand — replace
    // the enumeration with a DECISION_RECORDS table driving a generated pair
    // loop (and derive the precedence chain from the same table), or a
    // forgotten pair silently reports a contradictory manifest as clean.
    if (inDomains && excl) {
      warnings.push(
        `"${c.path}" is both indexed (domain ${inDomains.join(", ")}) and excluded — contradictory; ` +
          `lift the exclusion (exclude --remove) or remove the domain deliberately`
      );
    }
    if (inDomains && blk) {
      warnings.push(
        `"${c.path}" is indexed (domain ${inDomains.join(", ")}) but still carries a block — the block is ` +
          `stale (the list evidently ran); lift it (block --remove)`
      );
    }
    if (excl && blk && !inDomains) {
      warnings.push(
        `"${c.path}" is both excluded and blocked — contradictory ("looked and said no" vs "could not ` +
          `look"); treating it as excluded — lift whichever record is wrong`
      );
    }
    if (inDomains) {
      indexed.push({ path: c.path, shortPath: c.shortPath ?? null, domains: [...inDomains].sort() });
    } else if (excl) {
      excluded.push({ path: c.path, shortPath: c.shortPath ?? null, reason: excl.reason, decidedAt: excl.decidedAt });
    } else {
      // Undecided AND blocked candidates both carry the full identification an
      // adoption needs (namespace, summary, suggested name): a blocked
      // candidate is an undecided candidate with a recorded cause, and it must
      // stay as visible as one (F-218).
      const stem = (/^list(-|$)/.test(c.actionKey ?? "") ? c.actionKey.replace(/^list-?/, "") : c.actionKey) || c.name || "items";
      const suggestedName = `${c.domain}-${stem}`;
      const entry = {
        path: c.path,
        shortPath: c.shortPath ?? null,
        namespace: c.domain,
        actionKey: c.actionKey ?? null,
        summary: c.summary ?? null,
        suggestedName,
        nameCollision: takenNames.has(suggestedName) || namespaceNames.has(suggestedName),
        likelyPerAsset: likelyPerAsset(c),
        // F-226: non-null means "runnable tenant-wide only via these enum
        // flags" — an adoption runs the list once per value combination.
        requiredEnumFlags: requiredEnumFlags(c),
      };
      if (blk) {
        const recheckDue = blk.recheckAfter != null && blk.recheckAfter <= today;
        blocked.push({ ...entry, reason: blk.reason, decidedAt: blk.decidedAt, recheckAfter: blk.recheckAfter, recheckDue });
        if (recheckDue) {
          warnings.push(
            `blocked candidate "${c.shortPath ?? c.path}" passed its re-check date (${blk.recheckAfter}) — ` +
              `re-run its list command; on success decide it (adopt or exclude) and lift the block`
          );
        }
      } else {
        undecided.push(entry);
      }
    }
  }
  const cmpPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  indexed.sort(cmpPath);
  excluded.sort(cmpPath);
  blocked.sort(cmpPath);
  undecided.sort(cmpPath);
  legacyDomains.sort();

  // Gate verdict first, summary last: the summary is the stdout write, and the
  // exit rides its write callback (finish) — never process.exit after a stdout
  // write (F-360's class; this site was the review round's live escape).
  const gateParts = [];
  if (requireDecided && undecided.length) {
    gateParts.push(`${undecided.length} candidate(s) undecided: ${undecided.map((u) => u.shortPath ?? u.path).join(", ")}`);
  }
  if (requireDecided && legacyDomains.length) {
    gateParts.push(
      `${legacyDomains.length} indexed domain(s) lack a listCommand recording ` +
        `(backfill via upsert-batch --list-command): ${legacyDomains.join(", ")}`
    );
  }
  if (gateParts.length) {
    console.error(`domain-candidates.mjs: gate not passed — ${gateParts.join("; ")}`);
  } else if (requireDecided && blocked.length) {
    // A blocked candidate satisfies the gate (the alternative is forcing a false
    // permanent exclusion, F-218) but is NOT decided — the pass says so out loud,
    // by name, so the relay cannot summarize it away as "all candidates decided".
    console.error(
      `domain-candidates.mjs: gate passed with ${blocked.length} BLOCKED candidate(s) — could not be ` +
        `evaluated, not decided: ${blocked.map((b) => b.shortPath ?? b.path).join(", ")}. ` +
        `Re-run their list commands at the next round; on success decide each (adopt or exclude) and lift the block.`
    );
  }
  await finish({
    ok: true,
    cliVersion: catalog.meta?.cliVersion ?? null,
    candidateCount: candidates.length,
    indexedCount: indexed.length,
    excludedCount: excluded.length,
    blockedCount: blocked.length,
    undecidedCount: undecided.length,
    undecided,
    indexed,
    excluded,
    blocked,
    legacyDomains,
    warnings,
  }, gateParts.length ? 1 : 0);
} else if (verb === "check") {
  const file = opt("--file");
  const idField = opt("--id-field");
  const allowPartial = argv.includes("--allow-partial");
  // Mirror upsert-batch's --allow-empty contract (F-224): "no items array
  // found" is fatal by default. The hardwired allowEmpty=true this replaces
  // turned a typo'd --items-path or a captured {"error": ...} body into
  // rows:0 → a confident noneIndexed at exit 0 — decision-grade output over a
  // payload never read, with both loud guards (no-ids, F-216 partial) dead at
  // zero rows.
  const allowEmpty = argv.includes("--allow-empty");
  if (!file || !idField) fail("check requires --file <list.json> and --id-field <dot.path>");
  let data;
  try {
    data = readJsonFile(file);
  } catch (e) {
    fail(`cannot parse ${file}: ${e.message}`);
  }
  let items;
  try {
    items = findItemsArray(data, opt("--items-path"), idField, allowEmpty);
  } catch (e) {
    fail(
      `${e.message}${/could not locate|does not resolve to an array/.test(e.message)
        ? " — if the tenant's list is GENUINELY empty, re-run with --allow-empty; a typo'd --items-path or a captured error body must fail here, not read as an empty list"
        : ""}`
    );
  }
  // Shared row predicate (F-237): this and upsert-batch must extract the same
  // ids from the same payload — one implementation in doc-lib.
  const ids = extractIds(items, idField);
  if (items.length && !ids.length) {
    fail(
      `--id-field ${idField} ${ZERO_RESOLVE_HEAD} ${items.length} row(s) — ${idPathHint(null, items)}; ` +
        `inspect a row and pass the dot-path the installed CLI actually emits`
    );
  }
  // The partial case gets the same loud treatment as the total one (F-216).
  // Answering over the resolvable subset is the failure this whole script
  // exists to prevent, one level down: if the few rows that resolve happen to
  // be indexed, allIndexed reads true and Phase 4's rule records a PERMANENT
  // exclusion over the rows that were never tested.
  const unresolvedRows = items.length - ids.length;
  if (unresolvedRows > 0 && !allowPartial) {
    fail(
      `--id-field ${idField} resolves on only ${ids.length} of ${items.length} rows (${unresolvedRows} ` +
        `unresolved) — the overlap verdict would cover the resolvable subset ONLY, which is how an ` +
        `already-indexed subset reads as "all indexed". Inspect an unresolved row: a different dot-path, ` +
        `or --items-path to narrow a mixed array, usually fixes it. Pass --allow-partial if the rows ` +
        `genuinely carry no id — allIndexed/noneIndexed are then withheld and the candidate cannot be ` +
        `decided from this check alone`
    );
  }
  // Global id index: every inventory entry's id, across EVERY domain — the
  // subsumption question is "already indexed ANYWHERE", never "in the domain
  // this candidate's namespace suggests". doc-lib's indexedElsewhere (F-429
  // hoist): upsert-batch asks the same question of an unrecorded --domain
  // before it forks the inventory under a new name.
  const uniqueIds = [...new Set(ids)];
  const { matches, byDomain: matchedByDomain } = indexedElsewhere(manifest.inventory, uniqueIds);
  const partial = unresolvedRows > 0; // only reachable under --allow-partial
  // 0 rows answered nothing (F-224): the overlap question needs rows, so the
  // decision flags are withheld exactly as on a partial extraction — a null
  // cannot be mistaken for an answer by Phase 4's decision rule the way the
  // old vacuous `noneIndexed: true` was.
  const empty = items.length === 0;
  const warnings = [];
  if (partial) {
    warnings.push(
      `--allow-partial: ${unresolvedRows} of ${items.length} rows had no value at ${idField} and were ` +
        `NOT tested for overlap; allIndexed/noneIndexed are withheld. Decide this candidate on the ` +
        `untested rows' own evidence, and never record an exclusion citing coverage you did not measure`
    );
  }
  if (empty) {
    warnings.push(
      `0 rows extracted — allIndexed/noneIndexed are withheld: a 0-row check cannot answer the overlap ` +
        `question and must never feed a ledger decision. Inspect the captured payload first (a typo'd ` +
        `--items-path and an error-wrapper body both land here under --allow-empty); only if the tenant's ` +
        `list is genuinely empty, decide the candidate on that fact — adopt as an empty domain ` +
        `(upsert-batch --allow-empty, stamp-only) or exclude with a reason`
    );
  }
  out({
    ok: true,
    rows: items.length,
    idsExtracted: ids.length,
    unresolvedRows,
    partial,
    uniqueIds: uniqueIds.length,
    alreadyIndexed: matches.length,
    // Withheld rather than false on a partial extraction or a 0-row payload:
    // a null cannot be mistaken for an answer by the decision rule the way
    // `false` (or the old vacuous `true`) can.
    allIndexed: partial || empty ? null : uniqueIds.length > 0 && matches.length === uniqueIds.length,
    noneIndexed: partial || empty ? null : matches.length === 0,
    matchedByDomain,
    sampleMatches: matches.slice(0, 5),
    warnings,
  });
}
