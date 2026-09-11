#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// manifest.mjs — deterministic operations on a gs-superadmin _manifest.json
//
// The model decides WHAT to record (which fields a domain's list output uses,
// what to write in asset docs); this script owns file integrity: atomic writes
// (temp + rename), shape validation, and status transitions. Bulk list payloads
// are read from files, never through model context.
//
// Verbs (all take --manifest <path>):
//   init          --slug <s> --base-url <u>          create if absent (never clobbers;
//                 [--environment production|sandbox]  backfills environment if missing)
//   upsert-batch  --file <list.json> --domain <ns> --id-field <f>
//                 [--name-field <f>] [--date-field <f> | --no-date-field]
//                 [--items-path <a.b>]
//                 [--describe-command "gs-admin --json <ns> <cmd> --id {id}" | none]
//                 [--list-command "gs-admin --json <ns> <list-cmd> …"]
//                 [--allow-rekey] [--allow-redate] [--allow-empty]
//                 [--partial] [--orphans-file <path>]
//                 new→pending · newer date→stale · unchanged→untouched;
//                 stamps domains_indexed[domain] = {at, idField, itemsPath,
//                 describeCommand, dateField} even for an empty list, so
//                 "listed, tenant has none" is distinguishable from "never
//                 listed". The date field is recorded like the id field:
//                 --date-field <f> records the field, --no-date-field records
//                 null ("explicitly none"), and a re-run that omits both
//                 reuses the recording (dateFieldSource: "recorded" /
//                 "recorded-none" in the summary) — refresh runs never
//                 re-derive it. An explicit flag that contradicts an existing
//                 recording on a populated domain hard-fails (the redate
//                 guard; --allow-redate overrides a deliberate change).
//                 A date field whose values on every row of a ≥2-row list
//                 sit within two seconds of each other and within ten
//                 minutes of now (ISO or epoch numbers alike) is refused as
//                 a per-call generated timestamp (F-418, `sc scheme list` at
//                 CLI 1.0.9 — the domain would flip stale on every refresh
//                 forever); --allow-generated-date overrides, --no-date-field
//                 --allow-redate is the remedy. A --name-field absent on
//                 every row is refused the way the id and date fields are
//                 (F-421); an unchanged row whose stored name is null takes
//                 the incoming name (`namesBackfilled`), so a domain indexed
//                 with the wrong name field is repaired by one re-run with
//                 the right one, then `stub` to re-title its stub docs.
//                 Adopting a field over a legacy stamp (no dateField key)
//                 or a recorded-none domain backfills null stored dates
//                 without marking stale (`baselined` in the summary) —
//                 change detection starts on the next refresh. The summary
//                 also reports incomingCount vs existingEntries with an
//                 under-pagination warning when the incoming list is smaller
//                 than the domain's non-failed inventory (upsert-batch never
//                 removes entries; deletion is a separate, deliberate verb).
//                 --partial (F-313) declares the file a DELIBERATE subset —
//                 a gap-fill or targeted registration, smaller than the
//                 domain by construction. The under-pagination warning is
//                 skipped (its re-page advice is wrong for a declared
//                 subset) and the domains_indexed stamp is left untouched
//                 (a subset is not list-coverage evidence; `at` keeps saying
//                 when the domain was last actually LISTED). A partial upsert
//                 into a NEVER-listed domain proceeds — the list-invisible
//                 recovery case (F-316) — writing no stamp and warning that
//                 the domain has no list coverage. Partial upserts refuse the
//                 recording flags (--list-command / --describe-command /
//                 --date-field / --no-date-field — recordings are index-time
//                 facts) and --allow-rekey (orphan detection diffs the FULL
//                 incoming list against the domain; a subset would orphan
//                 everything it doesn't mention); the id-field guards still
//                 fire under --partial, with remedy text routing key-scheme
//                 changes to a full-list rekey instead of the refused flag
//                 (F-317).
//                 --describe-command records the domain's describe-batch
//                 command template at index time (describe-batch.mjs defaults
//                 to it when --command is omitted; its read-only fail-closed
//                 catalog gate still validates the recorded command at use).
//                 `--describe-command none` records the operator's DECISION
//                 that the domain has no usable per-item describe (list-only:
//                 its stubs are complete docs; describe-batch refuses to run
//                 the sentinel). The recording has THREE states — a template,
//                 the sentinel, and unrecorded (null/absent; every legacy
//                 stamp) — and readers keep them apart (gate-3 F-346; the
//                 catalog cannot decide describability: scorecards describe
//                 through another command group, connector jobs through a
//                 flag). A re-index that omits the flag keeps the existing
//                 recording.
//                 --list-command records the list command that PRODUCED the
//                 domain (F-108) — domain-candidates.mjs diff matches it
//                 against the catalog's candidate set, which is what makes the
//                 candidate-vs-indexed diff mechanical. Same carry-forward as
//                 describeCommand: a re-run that omits the flag keeps the
//                 recording; legacy manifests backfill on their next
//                 refresh/re-index.
//                 --allow-empty treats a
//                 payload with no items array as an empty list (stamp-only)
//                 instead of failing — pass it only when the list is
//                 genuinely empty. An --items-path that resolves to a real
//                 non-array value still fails (wrong path ≠ empty list).
//                 Re-index guard: fails when --id-field differs from the
//                 recorded idField of a domain with inventory entries (the
//                 wrong --id-field would duplicate every asset as pending);
//                 manifests stamped before idField was recorded (bare
//                 timestamps) fall back to a shape heuristic (zero key
//                 overlap AND a different majority id shape, ≥3 entries);
//                 --allow-rekey overrides a deliberate key-scheme change.
//                 A rekey strands the old-key entries: they are reported as
//                 orphaned (count; full key list written to --orphans-file,
//                 ready for the remove verb) — never hand-delete them.
//   remove        --key <domain/id> | --keys-file <json-array-of-keys>
//                 delete inventory entries (e.g. rekey orphans); reports the
//                 removed entries' doc_path values so stale docs can be
//                 cleaned up — the script never deletes doc files itself
//                 | --domain <name> [--allow-populated]
//                 de-register a domains_indexed coverage stamp (F-333: the
//                 sanctioned exit for a phantom stamp — a typo'd --domain
//                 stamps a domain with zero entries that then pollutes
//                 emptyDomains and the candidate gate's indexed count, and
//                 hand-editing is barred; an --id-field matching no row was
//                 the other cause until F-388 round 2 made it a failure);
//                 refuses while the domain still holds inventory entries
//                 unless --allow-populated (stamp only; entries stay); cannot
//                 combine with entry removal; idempotent on an absent stamp
//   mark          --key <domain/id> | --keys-file <json-array-of-keys>
//                 --status <pending|stale|documented|failed>
//                 [--limit N] [--error <msg>] [--depth metadata|full]
//                 [--doc-path <path>] [--fingerprint <40-hex-sha1>]
//                 --keys-file marks a batch (a skill's on-disk work list —
//                 bulk ids never route through model context): all-or-nothing,
//                 one unknown key means zero writes; --limit N takes the first
//                 N keys in file order (work lists are priority-ordered, e.g.
//                 oldest-first) and 0 is valid (marks nothing) so a computed
//                 budget of zero needs no special-casing by the caller;
//                 --fingerprint/--doc-path are per-asset recordings and are
//                 rejected with --keys-file, as is --limit without it.
//                 documented stamps last_verified; depth keeps the entry's
//                 existing depth unless --depth is given (else defaults full);
//                 --doc-path records where the doc landed (remove reports it);
//                 --fingerprint records the content fingerprint of the
//                 documented describe payload (doc-lib.mjs
//                 canonicalFingerprint — describe-batch.mjs's --if-changed
//                 gate compares against it). Stored only on documented marks;
//                 failed/stale marks leave any existing fingerprint untouched.
//   next          [--limit N] [--statuses a,b] [--domain <ns>] [--upgrade]
//                 batch to work on (default 25, pending,stale,failed; failed
//                 entries sort after the rest so persistent failures never
//                 starve untried assets);
//                 --upgrade selects metadata-depth entries instead — stubs
//                 awaiting full ingest (the --deep flow), including ones whose
//                 last ingest attempt failed, so --deep retries are possible
//   stub          --file <list.json> --domain <ns> --id-field <f> --out-dir <dir>
//                 [--name-field <f>] [--items-path <a.b>]
//                 write one metadata-only stub doc per item (shallow crawl) and
//                 mark entries documented at depth metadata; never downgrades
//                 an entry that has (or ever had) a full doc, whatever its status.
//                 The stub banner branches on the domain's recorded
//                 describeCommand (F-334; three states since gate-3 F-346): a
//                 template → the "--deep" full-ingest pointer; the `none`
//                 sentinel → "list-only (complete)" with NO --deep line (the
//                 stub is the asset's complete doc — setup forbids advertising
//                 --deep for list-only domains); UNRECORDED (null/absent — a
//                 legacy stamp, or an operator who never passed the flag) →
//                 "completeness UNKNOWN" naming both ways to resolve it. The
//                 pre-F-346 rule read unrecorded as list-only, so a
//                 describable domain indexed without the flag got a durable
//                 false "complete" claim. The summary reports describeState.
//   exclude       --command "<canonical path>" (--reason "<why>"
//                 (--check <check-output.json> [--covered-by <domain>] |
//                 --no-check "<why no overlap check was possible>")
//                 [--recheck-after YYYY-MM-DD] | --remove)
//                 persist an index-or-exclude decision (F-108): records in
//                 domains_excluded (keyed by the canonical command path
//                 domain-candidates.mjs diff prints) that a candidate list
//                 command is DELIBERATELY not indexed, with the reason and
//                 decidedAt — so a re-run can tell "considered and declined"
//                 from "nobody ever looked". Re-excluding updates the reason;
//                 --remove lifts the exclusion (deliberate re-litigation).
//                 Excluding a command that is currently BLOCKED lifts the block
//                 in the same write — a decision supersedes "could not look".
//                 The verdict is bound to the overlap check's NUMBERS, never to
//                 prose that cites one (F-449: a "covered by data-management"
//                 exclusion was recorded on 253 of 586 rows, burying ~333
//                 objects, while the same evidence on another tenant was
//                 correctly adopted): a record write takes exactly one of
//                 --check (the file `domain-candidates.mjs check --out` wrote —
//                 its rows/uniqueIds/alreadyIndexed/matchedByDomain are copied
//                 into the entry as `evidence`) or --no-check (an explicit
//                 reason no check could run, e.g. the payload carries no items
//                 array; stored as `noCheck`). --covered-by <domain> is the
//                 coverage claim and is REFUSED unless the check says every
//                 unique id is indexed under that one domain; conversely a
//                 check that says exactly that is refused WITHOUT --covered-by
//                 (the claim is structural in both directions). A partial
//                 check is refused outright. --recheck-after gives the
//                 permanent decision the same review affordance a block has.
//   block         --command "<canonical path>" (--reason "<why>"
//                 [--recheck-after YYYY-MM-DD] | --remove)
//                 persist "this candidate COULD NOT be evaluated" (F-218):
//                 records in domains_blocked (same canonical-path key as
//                 exclude) that the candidate's list command failed — e.g.
//                 a deterministic server-side error — so the gate can pass
//                 without forcing a false exclusion. Semantically the OPPOSITE
//                 of exclude: an exclusion says "we looked and said no" and
//                 goes quiet forever; a block says "we could not look" and the
//                 diff keeps surfacing the candidate by name on every run.
//                 Blocking an EXCLUDED command fails (already decided — lift
//                 the exclusion first). --remove lifts the block.
//   crawl         [--set shallow|deep]                get/record the crawl mode
//   report                                            counts by status and domain
//                 (+ domains_indexed / domains_excluded / domains_blocked /
//                 emptyDomains) and `lookback`: per indexed domain, the days
//                 since ITS OWN domains_indexed[domain].at (minimum 1; null
//                 when the stamp carries no `at`) plus `lookbackDefault` (7)
//                 — refresh derives each domain's change window from this,
//                 never from a workspace-wide stamp (F-417: the retired
//                 touch-refresh verb stamped last_refresh = now regardless
//                 of which domains an interrupted crawl reached, so every
//                 unreached domain silently lost its window on the next
//                 run; a per-domain stamp written by the upsert itself
//                 cannot be wrong about coverage). `touch-refresh` is gone —
//                 an unknown verb; last_refresh stays in the manifest as a
//                 legacy field nothing derives from.
//
// Output: one JSON object on stdout. Non-zero exit + stderr message on error.
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────

// ── T-2 · _manifest.json shape (single-writer contract) ──────────────────────
/**
 * FROZEN (B5 P1, 2026-08-16 — optional-field spellings resolved against the
 * tree; v2 B1, 2026-08-16 — key names and stamp nullability re-resolved).
 * Workspace tenant manifest. Sole writer: this file (atomic temp+rename).
 * Readers: guard hook (clamps every value — tenet 4: manifest values are
 * UNTRUSTED input), describe-batch, relationships-build, tenant-deps,
 * journal.mjs, jo-report.mjs. Complete worked example:
 * test/fixtures/change-request/kb/acme-prod/_manifest.json (minimal shape).
 *
 * @typedef {object} GsManifest
 * @property {string} slug
 * @property {string} baseUrl
 * @property {?string} environment       "production"|"sandbox"|free-form;
 *                                       null = not stated at init
 * @property {string} created            ISO
 * @property {?string} last_refresh      ISO or null. LEGACY since 0.37.0 (F-417):
 *                                       written by the retired touch-refresh verb
 *                                       only; echoed by report, derived from by
 *                                       nothing — refresh windows come from
 *                                       domains_indexed[domain].at
 * @property {Object<string, GsInventoryEntry>} inventory  keyed "<domain>/<id>"
 * @property {Object<string, GsDomainStamp>}  [domains_indexed]   keyed namespace
 * @property {Object<string, GsExclusion>}    [domains_excluded]  keyed canonical
 *                                            command path (domain-candidates diff)
 * @property {Object<string, GsBlock>}        [domains_blocked]   same key space
 * @property {"shallow"|"deep"}               [crawl_mode]
 *
 * @typedef {object} GsInventoryEntry
 * @property {string} id
 * @property {string} [name]
 * @property {string} domain
 * @property {string|null} [modified_date]  null = recorded-none (explicitly none)
 * @property {"pending"|"stale"|"documented"|"failed"} status
 * @property {"metadata"|"full"} [depth]
 * @property {string} [last_verified]  ISO — stamped on documented marks
 * @property {string} [doc_path]       workspace-relative
 * @property {string} [fingerprint]    40-hex sha1 (canonicalFingerprint)
 * @property {string} [error]          failed marks only
 *
 * @typedef {object} GsDomainStamp   LEGACY NOTE: pre-recording manifests may
 *                                   carry a bare ISO timestamp STRING in place
 *                                   of a stamp object — readers branch on
 *                                   typeof (manifest.mjs's prev* reads)
 * @property {string}  at
 * @property {string}  idField
 * @property {?string} itemsPath     null = no recorded list shape (the stamp
 *                                   writes the key unconditionally)
 * @property {?string} [dateField]   string = recorded; null = recorded-none;
 *                                   ABSENT = unknown/legacy (never null-for-unknown)
 * @property {?string} describeCommand  null until recorded; validated by
 *                                   describe-batch's catalog gate at use
 * @property {?string} listCommand   null until recorded; matched against
 *                                   catalog candidates (F-108)
 *
 * @typedef {object} GsExclusion  "we looked and said no" — goes quiet
 * @property {string} reason
 * @property {string} decidedAt
 * @property {string} [coveredBy]     the coverage claim (F-449) — present only
 *                                   when the check's numbers supported it
 * @property {GsCheckEvidence} [evidence]  the overlap check's numbers, copied
 *                                   at decision time (exactly one of evidence /
 *                                   noCheck on entries written from F-449 on;
 *                                   BOTH absent = legacy, pre-evidence entry)
 * @property {string} [noCheck]       why no overlap check could run
 * @property {string} [recheckAfter]  YYYY-MM-DD
 *
 * @typedef {object} GsCheckEvidence
 * @property {number} rows
 * @property {number} uniqueIds
 * @property {number} alreadyIndexed
 * @property {Object<string, number>} matchedByDomain
 *
 * @typedef {object} GsBlock      "we could not look" (F-218) — keeps surfacing
 * @property {string} reason
 * @property {string} decidedAt
 * @property {string} [recheckAfter]  YYYY-MM-DD
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Doc filename for an asset id — the shared copy every doc writer imports
// (sanitized ids get a short raw-id hash so distinct ids that clean to the
// same base can never collide).
import { docNameClaimer, readJsonFile, writeFileAtomicSync, cmpKey, getPath as get, findItemsArray, extractIds, makeCliHelpers, STUB_MARKER, DESCRIBE_NONE, idPathHint, ZERO_RESOLVE_HEAD, findWorkspaceCatalog, makeCommandResolver } from "./doc-lib.mjs";
const here = dirname(fileURLToPath(import.meta.url));

// The date-failure head refresh/SKILL.md's post-upgrade migration note quotes
// (F-388 round 2; the zero-resolve head is doc-lib's ZERO_RESOLVE_HEAD, shared
// with the candidate gate's check verb — F-393). The note's copy-outs are held
// to what this script PRINTS by build/check-doc-drift.mjs check 20, which
// executes upsert-batch on a scratch manifest and compares segment-wise (F-392
// reopen: holding heads alone let a reworded middle clause go stale), so a
// claim about what this script does can never again outlive the script.
const UPSERT_DATE_DEAD_HEAD = "change detection would be dead";

const argv = process.argv.slice(2);
const verb = argv[0];

// Shared argv helpers (F-238) — the F-165/F-171 last-token rule lives in
// doc-lib now (a flag present as the LAST token has lost its value, e.g. an
// empty skill-fence budget substitution; for mark --limit that meant the
// control silently stopped controlling). Every flag read through opt() here
// takes a value — booleans are read with argv.includes — so the guard cannot
// misfire on a valid spelling.
const helpers = makeCliHelpers("manifest.mjs", argv);
const { opt, out, finish } = helpers;
// Explicit annotation on `fail`'s own declaration (DS-46 strict list; the type
// is doc-lib's FailFn — its comment carries the rule): every `if (!x) fail(…)`
// below narrows x only through this line.
/** @type {import("./doc-lib.mjs").FailFn} */
const fail = helpers.fail;

const VERBS = new Set(["init", "upsert-batch", "mark", "next", "stub", "crawl", "report", "remove", "exclude", "block"]);

// Domain names are model-authored kebab identifiers (setup's naming rule). A
// prototype-shaped name ("__proto__") survives the composite inventory keys
// (the slash keeps them safe) but the domains_indexed stamp write and
// report's byDomain fold use it as a BARE object key, where assignment lands
// on the PROTOTYPE: the asset is recorded, the coverage stamp silently lost,
// and report goes blind to the domain (F-215, the write-side sibling of the
// F-168 lookups). Reject at the door — same shape as exclude's canonical-path
// rule — in every verb that WRITES a domain (upsert-batch, stub).
function domainOrFail(domain) {
  if (!/^[a-z][a-z0-9_-]*$/i.test(domain)) {
    fail(
      `--domain must be a plain domain name (letters/digits/hyphen/underscore, starting with a letter, ` +
        `e.g. "rules-engine-external-actions") — got "${String(domain).slice(0, 40)}"`
    );
  }
  // The shape regex admits every OTHER Object.prototype key ("constructor",
  // "toString", "valueOf", …) and those reproduce the exact blindness the
  // "__proto__" check closed (F-225): report's fold read the inherited truthy
  // prototype member, skipped assignment, and the count mutated the GLOBAL
  // Object function while the domain vanished from byDomain AND emptyDomains.
  // The folds are now null-prototype (belt), and the door rejects the whole
  // prototype-name family mechanically (braces) — derived, never hand-listed.
  if (Object.getOwnPropertyNames(Object.prototype).includes(domain)) {
    fail(
      `--domain "${domain}" is a JavaScript Object.prototype member name — as a bare object key it ` +
        `corrupts accumulator folds (F-215/F-225); pick a domain name that isn't a prototype member`
    );
  }
}
// Hard cap on an exclude/block --reason (F-222). See the check site for why it
// is set well above the observed working distribution rather than near it.
const REASON_MAX = 1000;
// The three enumerations T-2 declares as unions. Each Set is TYPED AGAINST its
// union, so a member added here but not to the typedef is red under both
// configs (the sync mechanism A-2 asks for — measured at the 0.36.3 gate: with
// the Sets typed Set<string>, drift on any of the six sides was green); the
// reverse drift (typedef gains a member the Set rejects) stays green — the
// conservative direction, the predicate then under-promises. Each predicate is
// what the checker reads as a NARROWING — a bare Set.has() proves membership at
// runtime but leaves the value a string to tsc, so the writes below (e.status,
// e.depth, m.crawl_mode) could not be held to the typedef; since load()/save()
// carry the GsManifest type, they are (DS-46 strict list, manifest.mjs
// admission). The cast inside each predicate widens the Set for the lookup only.
/** @type {ReadonlySet<GsInventoryEntry["status"]>} */
const STATUSES = new Set(["pending", "stale", "documented", "failed"]);
/** @type {ReadonlySet<NonNullable<GsInventoryEntry["depth"]>>} */
const DEPTHS = new Set(["metadata", "full"]);
/** @type {ReadonlySet<NonNullable<GsManifest["crawl_mode"]>>} */
const CRAWL_MODES = new Set(["shallow", "deep"]);
/** @param {string} s @returns {s is GsInventoryEntry["status"]} */
const isStatus = (s) => /** @type {ReadonlySet<string>} */ (STATUSES).has(s);
/** @param {string} s @returns {s is NonNullable<GsInventoryEntry["depth"]>} */
const isDepth = (s) => /** @type {ReadonlySet<string>} */ (DEPTHS).has(s);
/** @param {string} s @returns {s is NonNullable<GsManifest["crawl_mode"]>} */
const isCrawlMode = (s) => /** @type {ReadonlySet<string>} */ (CRAWL_MODES).has(s);

if (!VERBS.has(verb)) fail(`usage: manifest.mjs <${[...VERBS].join("|")}> --manifest <path> [...]`);
// `||` with the never-returning fail: manifestPath is a string from here on,
// inside load()/save() too (a separate `if (!x) fail()` guard does not narrow a
// module-level const inside functions declared after it — DS-46 strict list).
const manifestPath = opt("--manifest") || fail("--manifest <path> is required");

/**
 * The manifest, parsed and shape-checked (T-2). Two signatures, so the one
 * caller that may see "no manifest yet" (init) handles null and every other
 * verb gets the manifest or a failure exit — never a null to forget.
 * @overload
 * @param {{ mustExist: false }} o
 * @returns {GsManifest|null}
 */
/**
 * @overload
 * @param {{ mustExist?: true }} [o]
 * @returns {GsManifest}
 */
/**
 * @param {{ mustExist?: boolean }} [o]
 * @returns {GsManifest|null}
 */
function load({ mustExist = true } = {}) {
  if (!existsSync(manifestPath)) {
    if (mustExist) fail(`manifest not found: ${manifestPath} — run the init verb first`);
    return null;
  }
  let m;
  try {
    // readJsonFile tolerates a leading BOM (F-118): the manifest is written
    // BOM-less by save(), but a PowerShell hand-repair would re-encode it, and
    // the "corrupt" error below must not fire for one invisible byte.
    m = readJsonFile(manifestPath);
  } catch (e) {
    fail(
      `manifest is corrupt (${e.message}): ${manifestPath} — refusing to touch it; ` +
        `restore from git/backup or move it aside and re-run setup`
    );
  }
  if (typeof m !== "object" || m === null || typeof m.inventory !== "object" || m.inventory === null) {
    fail(`manifest has unexpected shape (missing "inventory" object): ${manifestPath}`);
  }
  return m;
}

/** @param {GsManifest} m */
function save(m) {
  // atomic temp+rename with the Windows retry (F-133 — an AV/sync-client lock
  // window used to abort a batch's mark loop mid-run): doc-lib's single copy,
  // shared with the orphan list below and every other integrity-owning writer
  writeFileAtomicSync(manifestPath, JSON.stringify(m, null, 2) + "\n");
}

// get / findItems live in doc-lib (getPath / findItemsArray — F-108): the
// candidate gate's check verb must parse a captured list payload exactly as
// upsert-batch does, so the implementations are shared. findItemsArray throws;
// this wrapper keeps the script's fail-with-usage-message contract.
function findItems(data, itemsPath, idField, allowEmpty = false) {
  try {
    return findItemsArray(data, itemsPath, idField, allowEmpty);
  } catch (e) {
    fail(e.message);
  }
}

// User-supplied JSON files (list payloads, key lists) may carry a UTF-8 BOM —
// PowerShell 5.1's `Out-File -Encoding utf8` writes one, and bare JSON.parse
// throws on it. readJsonFile (doc-lib, F-118 — this file's local copy was the
// pattern the shared helper consolidates) strips it; UTF-16 output
// (PowerShell 5.1's `>`) stays fatal.

// A --keys-file is bulk input from a skill's scratch step: a JSON array of
// "<domain>/<id>" strings. One reader serves every verb that takes one (remove,
// mark), so the shape rule can't drift between them. What each verb DOES with
// missing keys stays the verb's own contract — remove tolerates already-gone
// keys (cleanup is idempotent), mark refuses the whole batch (F-162).
function readKeysFile(path) {
  let arr;
  try {
    arr = readJsonFile(path);
  } catch (e) {
    fail(`cannot parse ${path}: ${e.message}`);
  }
  if (!Array.isArray(arr) || !arr.every((k) => typeof k === "string")) {
    fail(`--keys-file must contain a JSON array of "<domain>/<id>" strings`);
  }
  return arr;
}

// stale iff the live date is newer than the recorded one (tolerates non-ISO strings)
function newerThan(live, recorded) {
  if (live == null) return false;
  if (recorded == null) return true;
  // Epoch-ms values (numbers or numeric strings) first: Date.parse of a numeric
  // string is NaN, which used to demote them to string inequality — change was
  // detected but ordering wasn't, so an out-of-order OLDER date flipped stale.
  // Guard "" explicitly: Number("") is 0, not a date.
  if (live !== "" && recorded !== "") {
    const na = Number(live), nb = Number(recorded);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na > nb;
  }
  const a = Date.parse(live), b = Date.parse(recorded);
  if (!Number.isNaN(a) && !Number.isNaN(b)) return a > b;
  return String(live) !== String(recorded);
}

if (verb === "init") {
  const ENVIRONMENTS = new Set(["production", "sandbox"]);
  const environment = opt("--environment");
  if (environment !== undefined && !ENVIRONMENTS.has(environment)) {
    fail("--environment must be production or sandbox");
  }
  const existing = load({ mustExist: false });
  if (existing) {
    // Backfill only — an environment already recorded is never overwritten.
    if (environment && !existing.environment) {
      existing.environment = environment;
      save(existing);
    }
    // finish(): exit in the stdout write callback, never after it (F-360 class)
    await finish({
      ok: true,
      existed: true,
      slug: existing.slug,
      environment: existing.environment ?? null,
      assets: Object.keys(existing.inventory).length,
    });
  }
  const slug = opt("--slug");
  const baseUrl = opt("--base-url");
  if (!slug || !baseUrl) fail("init requires --slug and --base-url");
  mkdirSync(dirname(resolve(manifestPath)), { recursive: true });
  save({
    slug,
    baseUrl,
    environment: environment ?? null,
    created: new Date().toISOString(),
    last_refresh: null,
    inventory: {},
  });
  out({ ok: true, existed: false, slug, environment: environment ?? null });
} else if (verb === "upsert-batch") {
  const m = load();
  const file = opt("--file");
  const domain = opt("--domain");
  const idField = opt("--id-field");
  if (!file || !domain || !idField) fail("upsert-batch requires --file, --domain, --id-field");
  domainOrFail(domain); // F-215

  let data;
  try {
    data = readJsonFile(file);
  } catch (e) {
    fail(`cannot parse ${file}: ${e.message}`);
  }
  const nameField = opt("--name-field");
  const dateField = opt("--date-field");
  const noDateField = argv.includes("--no-date-field");
  if (dateField !== undefined && noDateField) {
    fail("pass exactly one of --date-field <f> or --no-date-field, not both");
  }
  const itemsPath = opt("--items-path");
  const allowEmpty = argv.includes("--allow-empty");
  // Deliberate-subset declaration (F-313): gap-fill work lists are smaller
  // than the domain BY CONSTRUCTION, so the full-snapshot heuristics below
  // (under-pagination warning, coverage stamp, rekey orphan diff) must be
  // told, not left to guess. --items-path stays allowed — under --partial it
  // is a locator only, never a recording.
  const partial = argv.includes("--partial");
  // Describe-command recording: validated for shape only (one gs-admin command
  // with a substitution token) — describe-batch.mjs's read-only fail-closed
  // catalog gate is what decides whether the recorded command may ever run.
  const describeCommand = opt("--describe-command");
  // `none` is the recorded list-only decision (DESCRIBE_NONE, gate-3 F-346),
  // not a template — it skips the template grammar and is stored verbatim.
  if (describeCommand !== undefined && describeCommand !== DESCRIBE_NONE) {
    const first = describeCommand.trim().split(/\s+/)[0];
    if (first !== "gs-admin" || !(describeCommand.includes("{id}") || describeCommand.includes("{name}"))) {
      fail(
        `--describe-command must be a single gs-admin command template containing {id} or {name} ` +
          `(got "${describeCommand.slice(0, 60)}") — e.g. "gs-admin --json re r describe --id {id}"`
      );
    }
  }
  // List-command recording (F-108): the command that produced this domain's
  // list payload, matched by domain-candidates.mjs diff against the catalog's
  // candidate set. Shape-validated only (one gs-admin command line) — the diff
  // verb owns resolving it against the catalog and warns when it can't.
  const listCommandFlag = opt("--list-command");
  if (listCommandFlag !== undefined) {
    const first = listCommandFlag.trim().split(/\s+/)[0];
    if (first !== "gs-admin") {
      fail(
        `--list-command must be a single gs-admin command line (got "${listCommandFlag.slice(0, 60)}") ` +
          `— e.g. "gs-admin --json sc scheme list"`
      );
    }
  }
  const items = findItems(data, itemsPath, idField, allowEmpty);

  // Re-index guard: manifest keys are `<domain>/<id>` — a re-run that picks a
  // different --id-field than the original index would match nothing and
  // silently duplicate every asset as a fresh pending entry. The field each
  // index used is recorded in domains_indexed, so a mismatch is caught
  // directly — even when the wrong field yields the same id shape as the
  // right one (two uuid columns; folderId vs templateId both numeric), which
  // no heuristic can see. Manifests stamped before idField was recorded (a
  // bare timestamp string) fall back to the shape heuristic: zero overlap by
  // itself is normal (a later page of the same field is all-new assets), so
  // only fail when overlap is zero AND the id shape differs from the keys
  // already recorded — the signature of a wrong field, not of pagination.
  const shapeOf = (v) => {
    const s = String(v);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return "uuid";
    if (/^[0-9a-f]{24}$/i.test(s)) return "hex24";
    if (/^\d+$/.test(s)) return "numeric";
    return "text";
  };
  const majorityShape = (vals) => {
    const counts = new Map();
    for (const v of vals) { const s = shapeOf(v); counts.set(s, (counts.get(s) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const domainEntries = Object.values(m.inventory).filter((e) => e.domain === domain);
  const existingIds = domainEntries.map((e) => e.id);
  // Under-count guard input: non-failed entries the domain already has. Failed
  // entries are excluded — they may be gone from the tenant already, and a
  // shortfall against them is not pagination evidence.
  const existingEntries = domainEntries.filter((e) => e.status !== "failed").length;
  // Shared row predicate (F-237): this and the candidate gate's check verb
  // must extract the same ids from the same payload — one copy in doc-lib.
  const incomingIds = extractIds(items, idField);
  const existingSet = new Set(existingIds);
  const matchedExisting = incomingIds.filter((v) => existingSet.has(v)).length;
  const allowRekey = argv.includes("--allow-rekey");
  const recorded = (m.domains_indexed ?? {})[domain];
  // --partial guard rail (F-313): the refusals that keep "declared subset"
  // from quietly meaning "degraded index". Recordings and the rekey orphan
  // diff are full-list semantics. A NEVER-indexed domain is deliberately NOT
  // refused (F-316): a targeted registration into an unlisted domain is the
  // list-invisible recovery case — it proceeds, writes no stamp, and warns
  // below (the 0.32.6 refusal broke the documented flows that exist for
  // exactly that state, and a typo'd full upsert was always allowed anyway).
  // Each recording flag is its own refusal arm, collected as data and NAMED
  // in the failure (F-314): a bare four-way disjunction let a dropped arm
  // hide behind its siblings' green tests — naming the actual offender(s)
  // lets the suite pin every arm independently, and tells the operator
  // which flag to remove. Computed outside the --partial branch because the
  // under-pagination warning below reads the SAME list (F-425): a run that
  // passed a recording flag is a full-list run by its own declaration, and
  // the warning must not advise the --partial this refusal would reject.
  const recordingFlagsPassed = [
    ["--describe-command", describeCommand !== undefined],
    ["--list-command", listCommandFlag !== undefined],
    ["--date-field", dateField !== undefined],
    ["--no-date-field", noDateField],
  ].filter(([, passed]) => passed).map(([flag]) => flag);
  if (partial) {
    if (recordingFlagsPassed.length) {
      fail(
        `--partial cannot combine with ${recordingFlagsPassed.join(" / ")} — ` +
          `recordings are index-time facts about the domain's FULL list; change them on a full re-list, ` +
          `not a subset registration`
      );
    }
    if (allowRekey) {
      fail(
        `--partial cannot combine with --allow-rekey — the rekey orphan diff compares the full incoming ` +
          `list against the domain, so a declared subset would orphan every entry it doesn't mention`
      );
    }
  }
  const recordedIdField =
    recorded && typeof recorded === "object" && typeof recorded.idField === "string"
      ? recorded.idField
      : null;
  // Three-state date-field recording: a string ("this field"), null ("explicitly
  // none" — recorded via --no-date-field), or undefined (legacy stamp that
  // predates the recording, including bare-timestamp stamps). hasOwnProperty
  // distinguishes recorded-null from absent; a non-string non-null value is
  // treated as null (never trusted into the effective field).
  const hasRecordedDateField =
    recorded && typeof recorded === "object" &&
    Object.prototype.hasOwnProperty.call(recorded, "dateField");
  const recordedDateField = hasRecordedDateField
    ? (typeof recorded.dateField === "string" ? recorded.dateField : null)
    : undefined;
  // Zero-resolve is a FAILURE, never skipped-row accounting (F-388 round 2 —
  // the tester measured the silent path: flat CLI 1.0.9 connection rows fed
  // to the RECORDED nested id path exited 0, ok true, added 0, with a warning
  // that mis-diagnosed the drop as under-pagination; the re-index guard below
  // compares passed against recorded and is silent by construction when the
  // recording itself is what went stale). An id path that resolves on none of
  // N rows is a wrong or stale path — the candidate gate's check verb already
  // fails on exactly this predicate (F-216; extractIds is the one row rule),
  // so the writer does too, with the same shape hint, and stamps nothing
  // (rung 0 for the F-333 phantom: a stamp from an id-field that matched no
  // row can no longer be written; remove --domain stays for the typo'd name).
  if (items.length && !incomingIds.length) {
    const recordedNote =
      recordedIdField === idField
        ? ` This field is the recorded idField of domain ${domain}, so the list's row shape has moved under it ` +
          `(a CLI upgrade — the connectors domain at CLI 1.0.9 is the known case): ` +
          (partial
            ? `re-key on a FULL-list upsert-batch with the new --id-field plus --allow-rekey and --orphans-file <path> — never on a subset.`
            : `re-run with the new --id-field plus --allow-rekey and --orphans-file <path> (the id VALUES usually do not move, so expect the orphans file empty; a non-empty one means the ids changed too).`)
        : "";
    fail(
      `--id-field ${idField} ${ZERO_RESOLVE_HEAD} ${items.length} row(s) — nothing was written. ` +
        `${idPathHint(domain, items)}; inspect a row and pass the dot-path the installed CLI actually emits.${recordedNote}`
    );
  }
  // Renamed-domain fork guard (F-429). A --domain that matches no recording
  // used to be unconditionally NEW, and every guard on this path keys off the
  // domain's existing record (the re-index guard needs a recorded idField, the
  // count guard needs existingEntries) — so a misspelled or namespace-for-
  // domain name (`connectors` for a workspace that recorded `connections`)
  // forked the whole inventory under a second key prefix, exit 0, no warning,
  // and upsert-batch never removes entries. The signal is what the run
  // DECLARES about itself, no alias table: a recording flag it passed
  // (--list-command / --describe-command) names the command another domain
  // was indexed from. Both sides are canonicalized through the catalog when
  // one resolves (workspace copy, else bundled — two sessions recorded the
  // same list as `re r list` and `re rules list`), and compared as
  // whitespace-folded text otherwise. Id overlap is deliberately NOT a
  // signal here: id values are unique per asset type, not globally (name-
  // keyed domains share names), and the candidate gate's overlap check is an
  // operator decision, not an unattended refusal. F-316's exemption — a
  // --partial registration into an unlisted domain stays open and warns — is
  // enforced UPSTREAM by the guard rail above: --partial cannot combine with a
  // recording flag, and a run that passed none declares nothing for this block
  // to compare, so it never reaches a refusal here (F-429 second pass: a
  // `!partial` term on this condition was dead code with a recording flag and
  // an unexercised fixture arm without one).
  // A domain's IDENTITY is its list command (setup's own rule: one name per
  // list command). A describe command is shared legitimately — every list-only
  // domain records the `none` sentinel, and two lists of one asset type share
  // one describe template — so a describe-command match alone WARNS and names
  // the sharing domain; only a list-command match refuses. The `none` sentinel
  // is never a signal on either side. (Release-gate review of 0.37.0, F-432:
  // the first cut treated any describe command as identity and refused
  // setup's second list-only domain as a rename, with no override.)
  const forkNotes = [];
  if (!recorded) {
    /** @type {Array<[string, "listCommand" | "describeCommand", string | undefined]>} */
    const recordingFlagTable = [
      ["--list-command", "listCommand", listCommandFlag],
      ["--describe-command", "describeCommand", describeCommand],
    ];
    const passedRecordings = recordingFlagTable.filter(([, , v]) => typeof v === "string" && v.trim() !== "" && v !== DESCRIBE_NONE);
    if (passedRecordings.length) {
      const catalog = findWorkspaceCatalog(dirname(resolve(manifestPath)), join(here, "..", "reference", "catalog.json"));
      const resolveLine = catalog ? makeCommandResolver(catalog).resolveLine : null;
      const keyOf = (line) => {
        const c = resolveLine ? resolveLine(line) : null;
        return c ? `path:${c.path}` : `text:${String(line).trim().split(/\s+/).join(" ")}`;
      };
      const listCollisions = [];
      const describeCollisions = [];
      for (const [flag, field, value] of passedRecordings) {
        const k = keyOf(value);
        for (const [d, st] of Object.entries(m.domains_indexed ?? {})) {
          if (d === domain || !st || typeof st !== "object" || typeof st[field] !== "string" || st[field] === DESCRIBE_NONE) continue;
          if (keyOf(st[field]) === k) (field === "listCommand" ? listCollisions : describeCollisions).push(`${flag} is the recorded ${field} of domain ${d}`);
        }
      }
      if (listCollisions.length) {
        fail(
          `--domain ${domain} matches no recording, but this run identifies an existing domain: ${listCollisions.join("; ")} — ` +
            `a renamed or misspelled domain is not a new domain (it would fork the inventory under a second key prefix, ` +
            `in silence; upsert-batch never removes entries). Pass the recorded name (report's byDomain / domains_indexed). ` +
            `Nothing was written.`
        );
      }
      for (const c of describeCollisions)
        forkNotes.push(
          `--domain ${domain} is new and its ${c} — a second list of one asset type shares a describe template legitimately, ` +
            `so this run proceeds; if it was meant to be that domain, pass the recorded name instead (upsert-batch never removes entries)`
        );
    }
  }
  // Direct check: the recorded field is authoritative. Only enforced while the
  // domain has inventory entries — a domain indexed empty recorded a field no
  // data ever validated, and with nothing to duplicate a switch is harmless.
  // Remedy text is partial-aware (F-317): under --partial the guard must not
  // advise --allow-rekey — that flag is refused above, so the advice was a
  // documented dead-end. A key-scheme change is inherently a full-list
  // operation (the orphan diff needs the whole list), so the partial arm
  // routes there instead.
  if (recordedIdField && recordedIdField !== idField && existingIds.length && !allowRekey) {
    fail(
      `--id-field ${idField} does not match --id-field ${recordedIdField}, which domain ${domain} ` +
        `was indexed with (${existingIds.length} existing entries, e.g. id "${existingIds[0]}"). ` +
        `Upserting with a different id field would duplicate every asset as pending. ` +
        (partial
          ? `Re-run with --id-field ${recordedIdField} (key your items file by that field) — a ` +
            `key-scheme change is a full-list operation: perform it via a full list upsert-batch ` +
            `with --allow-rekey (plus --orphans-file <path> to capture the stranded old keys for ` +
            `the remove verb) first, never on a subset.`
          : `Re-run with --id-field ${recordedIdField}, or pass --allow-rekey if the key-scheme ` +
            `change is deliberate — with --orphans-file <path> on that same run: it captures the ` +
            `stranded old keys for the remove verb, and the list cannot be regenerated afterwards.`)
    );
  }
  if (
    !recordedIdField &&
    existingIds.length >= 3 &&
    incomingIds.length &&
    matchedExisting === 0 &&
    majorityShape(incomingIds) !== majorityShape(existingIds) &&
    !allowRekey
  ) {
    fail(
      `--id-field ${idField} looks wrong for domain ${domain}: none of the ${incomingIds.length} incoming ids ` +
        `match any of the ${existingIds.length} existing keys, and the id shapes differ ` +
        `(incoming ~${majorityShape(incomingIds)}, existing ~${majorityShape(existingIds)}, ` +
        `e.g. existing id "${existingIds[0]}"). Upserting would duplicate every asset as pending. ` +
        (partial
          ? `Pick the field that reproduces existing keys — a key-scheme change is a full-list ` +
            `operation: perform it via a full list upsert-batch with --allow-rekey (plus ` +
            `--orphans-file <path> to capture the stranded old keys for the remove verb) first, ` +
            `never on a subset (a never-listed domain has no listable full set — re-register keyed ` +
            `by the field its existing entries used).`
          : `Pick the field that reproduces existing keys, or pass --allow-rekey (with ` +
            `--orphans-file <path> on that same run — the stranded-key list cannot be regenerated ` +
            `afterwards) if the key-scheme change is deliberate.`)
    );
  }

  // Effective date field — the recorded one is authoritative when the flags are
  // omitted, so refresh runs never re-derive it (a re-derived mismatch flips the
  // whole domain falsely stale: newerThan(value, null) is true for every
  // null-stored entry, and a different field name string-compares unequal).
  let effDateField, dateFieldSource;
  if (dateField !== undefined) {
    effDateField = dateField; dateFieldSource = "explicit";
  } else if (noDateField) {
    effDateField = null; dateFieldSource = "explicit-none";
  } else if (recordedDateField !== undefined) {
    effDateField = recordedDateField;
    dateFieldSource = recordedDateField === null ? "recorded-none" : "recorded";
  } else {
    effDateField = null; dateFieldSource = "unrecorded";
  }
  // Redate guard — same shape as the idField guard above: an explicit flag that
  // contradicts an existing recording on a domain with inventory entries
  // hard-fails. Comparing stored dates against a different field would flip the
  // domain falsely stale and burn --document budget re-describing unchanged
  // assets. Never trips when the flags are omitted (the recording is reused),
  // on legacy-absent recordings (first explicit pass adopts and stamps), or on
  // empty domains (nothing recorded ever validated by data).
  const allowRedate = argv.includes("--allow-redate");
  if (
    existingIds.length &&
    (dateField !== undefined || noDateField) &&
    recordedDateField !== undefined &&
    effDateField !== recordedDateField &&
    !allowRedate
  ) {
    const show = (f) => (f === null ? "none (--no-date-field)" : `--date-field ${f}`);
    fail(
      `${show(effDateField)} does not match ${show(recordedDateField)}, which domain ${domain} ` +
        `was indexed with (${existingIds.length} existing entries). Comparing stored dates against ` +
        `a different field would flip the whole domain falsely stale and re-document unchanged ` +
        `assets. Omit the flag to reuse the recording, or pass --allow-redate if the date-scheme ` +
        `change is deliberate.`
    );
  }
  // Baseline adoption: adopting a real date field over a domain whose entries
  // were stored without one (legacy stamp, or recorded-none overridden via
  // --allow-redate) backfills null stored dates WITHOUT marking stale — change
  // detection starts on the next refresh. Entries with non-null stored dates
  // still go through newerThan, and per-item nulls under an already-recorded
  // field still flip stale (baseline never leaks into normal comparison).
  const adopting =
    typeof effDateField === "string" &&
    (recordedDateField === undefined || recordedDateField === null);

  let added = 0, stale = 0, unchanged = 0, skipped = 0, baselined = 0, dateResolved = 0, datePresent = 0;
  /** every resolved (non-null) date value, as the row carries it — the F-418 signature reads them */
  const resolvedDates = [];
  /**
   * A date value → epoch ms, or NaN. Rows carry dates three ways in this
   * catalog: ISO strings, epoch-millisecond numbers (`sc scheme list`, F-418),
   * and numeric strings; seconds-resolution epochs (< 1e11) are scaled.
   * @param {unknown} v
   * @returns {number}
   */
  const parseInstant = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? (v < 1e11 ? v * 1000 : v) : NaN;
    if (typeof v !== "string") return NaN;
    if (/^\d{9,}$/.test(v)) return parseInstant(Number(v));
    return Date.parse(v);
  };
  /** rows whose --name-field PATH exists (F-421: a field absent on every row is an operator error, not "no name") */
  let namePresent = 0, namesBackfilled = 0;
  /**
   * The first few top-level keys of a row — the one hint shape every "this
   * field resolves to nothing" message derives from the offending rows
   * themselves (F-426: the name-field refusal used to hard-code a
   * rules-engine example, advising `ruleName` for template rows that carry
   * `title`).
   * @param {unknown} it
   * @returns {string}
   */
  const rowKeys = (it) => (it && typeof it === "object" ? Object.keys(it).slice(0, 5).join(", ") : "(non-object row)");
  // Skipped-row evidence (F-220): a row with no id never reaches the KB, and
  // it is invisible to the count guard too — the guard compares EXTRACTED ids
  // against the KB, and a skipped row was dropped before extraction. Keep a
  // sample of identifying fields so the warning below can point at the actual
  // dropped assets (live case: a half-initialised connection with a full
  // payload and no connectionId yet).
  const skippedSamples = [];
  for (const it of items) {
    const id = get(it, idField);
    if (id == null || id === "") {
      skipped++;
      if (skippedSamples.length < 3) {
        const nm = nameField ? get(it, nameField) : null;
        const label =
          nm != null && nm !== ""
            ? String(nm)
            : it && typeof it === "object"
              ? `(no ${nameField ?? "name field"}; row keys: ${rowKeys(it)})`
              : `(non-object row)`;
        skippedSamples.push(label.replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 80));
      }
      continue;
    }
    const key = `${domain}/${id}`;
    const name = nameField ? get(it, nameField) ?? null : null;
    // Two facts per row, kept apart (Gate-2 review of 0.36.1, F-392): whether
    // the date PATH exists on the row (undefined = absent) and whether it
    // carries a value. A present-but-null date is data (setup Phase 4: "this
    // item has no date", never "this domain has no date field"); only an
    // ABSENT path is the dead-path signature the refusal below is for.
    const modifiedRaw = effDateField ? get(it, effDateField) : undefined;
    const modified = modifiedRaw ?? null;
    if (modifiedRaw !== undefined) datePresent++;
    if (modified != null) { dateResolved++; resolvedDates.push(modified); }
    if (nameField && get(it, nameField) !== undefined) namePresent++;
    const prev = m.inventory[key];
    if (!prev) {
      m.inventory[key] = { id: String(id), name, domain, modified_date: modified, status: "pending" };
      added++;
    } else if (adopting && prev.modified_date == null && modified != null) {
      prev.modified_date = modified;
      if (name != null) prev.name = name;
      baselined++;
    } else if (newerThan(modified, prev.modified_date)) {
      prev.modified_date = modified;
      if (name != null) prev.name = name;
      prev.status = "stale";
      stale++;
    } else {
      // An unchanged row can still carry the name a wrong --name-field once
      // dropped (F-421: 476 rules indexed with a field no row had, every name
      // null, and a corrective re-index repaired nothing because this branch
      // never wrote). A null stored name filled from a non-null incoming one
      // is a repair, not a change — status untouched, counted separately.
      if (prev.name == null && name != null) { prev.name = name; namesBackfilled++; }
      unchanged++;
    }
  }
  // A date path that is ABSENT on every row is refused, never compared
  // (F-388 round 2 — the tester measured the quiet path: newerThan is false
  // for a null incoming value, so a dead dot-path reads every row unchanged
  // forever, the mass-stale advisory can never fire, and change detection is
  // dead from that upsert on with an empty warnings array). Recorded or
  // explicit alike — an explicit typo at adoption would otherwise record a
  // field no row ever carried. Checked before anything is written. Two bounds
  // from the Gate-2 review of 0.36.1 (F-392): (a) the predicate is PATH
  // ABSENT (datePresent === 0), not value null — rows that carry the key with
  // a null value are data and pass; (b) --partial is exempt: a declared subset
  // (email-report's gap-fill work lists are id/name-only by construction)
  // legitimately carries no date column, recordings cannot change there, and
  // its null-stored dates flip stale the moment a full refresh brings a value
  // (the baseline-never-leaks rule). The partial-absence case on a FULL list
  // is a warning below, never silent.
  const idRows = items.length - skipped;
  if (!partial && typeof effDateField === "string" && idRows > 0 && datePresent === 0) {
    fail(
      `--date-field ${effDateField}${dateFieldSource.startsWith("recorded") ? ` (the recording for domain ${domain})` : ""} ` +
        `${ZERO_RESOLVE_HEAD} ${idRows} row(s) — the key is absent on every row (a null value would count as present) — ${UPSERT_DATE_DEAD_HEAD}: ` +
        `every row would read unchanged forever and nothing could ever go stale, so nothing was written. A modified-date path that ` +
        `resolved before and is absent now is the signature of a CLI list-shape change (the connectors domain's Modified column, dropped ` +
        `at CLI 1.0.9 with no top-level replacement, is the known case). Inspect a row and decide once: pass --date-field <the field the ` +
        `installed CLI emits> --allow-redate, or --no-date-field --allow-redate when the rows carry no modified date.`
    );
  }
  // A date field that is GENERATED PER CALL is refused, never compared (F-418:
  // `sc scheme list` at CLI 1.0.9 returns one `modifiedAt` shared by every row,
  // equal to the moment of the call — a server-side artefact, the handler is
  // byte-identical since 1.0.8). Recorded at setup as if it were a stored
  // modification date, it reads every row as newer than stored on EVERY
  // refresh: the whole domain flips stale forever and looks exactly like a
  // busy one (measured live: 3 of 3 stale on a no-op re-run while 17 other
  // domains read every row unchanged). The signature is loud and cheap to
  // test before anything is written: at least two id-bearing rows, every one
  // of them resolving a PARSEABLE instant, all those instants inside a
  // two-second cluster, and the cluster within ten minutes of now. Two
  // facts from the round that reopened F-418 (tester, 2026-09-08) shape the
  // predicate: the real payload carries `modifiedAt` as an epoch-millisecond
  // NUMBER, not an ISO string (Date.parse of its decimal text is NaN — the
  // first version of this guard short-circuited on exactly that), and the
  // rows are stamped one by one while the response serializes, so they land
  // a millisecond apart and "exactly one distinct value" is flaky by
  // construction. A shared OLD cluster (a platform event bumping a domain en
  // masse) is not this signature — it passes here and the mass-stale advisory
  // below covers it; a single row modified this minute is real data and
  // passes too. --allow-generated-date overrides for the one case the
  // signature cannot distinguish (every row of a ≥2-row domain genuinely
  // edited within the same two seconds as the list call).
  const GENERATED_DATE_WINDOW_MS = 10 * 60 * 1000;
  const GENERATED_DATE_CLUSTER_MS = 2000;
  const allowGeneratedDate = argv.includes("--allow-generated-date");
  if (!partial && typeof effDateField === "string" && !allowGeneratedDate && idRows >= 2 && dateResolved === idRows) {
    const instants = resolvedDates.map(parseInstant);
    if (instants.every(Number.isFinite)) {
      const lo = Math.min(...instants), hi = Math.max(...instants);
      const ageMs = Math.abs(Date.now() - hi);
      if (hi - lo <= GENERATED_DATE_CLUSTER_MS && ageMs <= GENERATED_DATE_WINDOW_MS) {
        fail(
          `--date-field ${effDateField}${dateFieldSource.startsWith("recorded") ? ` (the recording for domain ${domain})` : ""} ` +
            `resolves on all ${idRows} row(s) to values within ${hi - lo} ms of each other, ${Math.round(ageMs / 1000)} s from now — a timestamp ` +
            `generated per call, not a stored modification date (\`sc scheme list\` at CLI 1.0.9 is the known case: epoch-millisecond ` +
            `numbers stamped row by row): every refresh would read the whole domain as newer than stored and flip it stale forever, so ` +
            `nothing was written. Decide once: record --no-date-field --allow-redate (the command carries no modification date), or pass ` +
            `--allow-generated-date if every row really was modified within the same two seconds.`
        );
      }
    }
  }
  // A --name-field that is ABSENT on every id-bearing row is refused, never
  // recorded as "no name" (F-421): the id and date fields already fail this
  // way, and a name field passed wrong at index time used to write a whole
  // domain nameless with an empty warnings array — a mistake nothing stamps
  // and nothing later repairs. Path ABSENT on every row (the F-392 boundary:
  // a present-but-null name is data); a partial subset is held to it too, since
  // a gap-fill work list carries its names by construction.
  if (nameField && idRows > 0 && namePresent === 0) {
    fail(
      `--name-field ${nameField} ${ZERO_RESOLVE_HEAD} ${idRows} row(s) — the key is absent on every row, so every entry would be ` +
        `recorded nameless and every name-based lookup over this domain (deprecate's KB resolution, the stub titles) would fail — ` +
        `nothing was written. Inspect one row and pass the field it actually carries (the first row's keys: ${rowKeys(items[0])}). ` +
        `An already-nameless domain is repaired by re-running the upsert with the right field (unchanged rows backfill a ` +
        `null name — \`namesBackfilled\` in the summary) and then \`stub\` over the same list file to re-title its stub docs.`
    );
  }
  // A deliberate rekey strands every old-key entry of the domain: their keys
  // no longer match what describe accepts, so they would sit pending/stale
  // forever and double the domain's counts. Report them (and write the key
  // list to --orphans-file when asked — ready for the remove verb) instead of
  // leaving the caller to diff the manifest by hand. A rekey is detected the
  // same two ways the guard detects it: the recorded idField changed, or — on
  // a legacy bare-timestamp stamp with no recorded field — the shape heuristic
  // fired (zero overlap AND a different majority id shape) and --allow-rekey
  // overrode it.
  const rekeyDetected =
    (recordedIdField && recordedIdField !== idField) ||
    (!recordedIdField &&
      existingIds.length >= 3 &&
      incomingIds.length &&
      matchedExisting === 0 &&
      majorityShape(incomingIds) !== majorityShape(existingIds));
  /** @type {?string[]} */
  let orphaned = null;
  const orphansFile = opt("--orphans-file");
  if (allowRekey && rekeyDetected && existingIds.length) {
    const incomingSet = new Set(incomingIds);
    orphaned = Object.keys(m.inventory)
      .filter((k) => m.inventory[k].domain === domain && !incomingSet.has(m.inventory[k].id))
      .sort();
    // The one record the summary says cannot be regenerated afterwards gets
    // the same atomic write as the manifest (gate-3 F-352: it was a bare
    // writeFileSync with no parent mkdir — a missing directory crashed with a
    // raw stack trace, and an interrupted write could leave a truncated list).
    if (orphansFile) writeFileAtomicSync(orphansFile, JSON.stringify(orphaned, null, 2) + "\n");
  }
  // Coverage evidence + re-index guard record: stamp the domain as listed even
  // when the result was empty — a domain absent from this map was never
  // indexed at all — and record which field/path this index used. A re-index
  // that omits --describe-command keeps the existing recording (refresh runs
  // don't re-state it), so the only way to change a recording is to pass the
  // flag again.
  const prevDescribeCommand =
    recorded && typeof recorded === "object" && typeof recorded.describeCommand === "string"
      ? recorded.describeCommand
      : null;
  // ⚠ CALLOUT — itemsPath carry-forward (S5-V finding F3, Bradley ruling
  // 2026-07-16): itemsPath records the domain's KNOWN LIST SHAPE, not "what
  // the last upsert happened to parse". Maintenance upserts (gap-fill work
  // files are bare arrays, no --items-path) used to overwrite a real recording
  // (e.g. "data") with null, silently degrading the stamp's documentation
  // value. Now it carries forward exactly like describeCommand/dateField: an
  // upsert that doesn't pass --items-path keeps the previous recording, and
  // the ONLY way to change it is to pass the flag again. Consequence to know:
  // if a domain's real list payload shape ever changes, re-record it
  // explicitly with --items-path — auto-detection never writes this field.
  const prevItemsPath =
    recorded && typeof recorded === "object" && typeof recorded.itemsPath === "string"
      ? recorded.itemsPath
      : null;
  // listCommand carry-forward — same contract as describeCommand/itemsPath: an
  // upsert that doesn't pass --list-command keeps the previous recording, and
  // the only way to change it is to pass the flag again (F-108).
  const prevListCommand =
    recorded && typeof recorded === "object" && typeof recorded.listCommand === "string"
      ? recorded.listCommand
      : null;
  const stamp = {
    at: new Date().toISOString(),
    idField,
    itemsPath: itemsPath ?? prevItemsPath,
    describeCommand: describeCommand ?? prevDescribeCommand,
    listCommand: listCommandFlag ?? prevListCommand,
  };
  // dateField carry-forward, same pattern as describeCommand — except a legacy
  // stamp with no recording and no flag passed ("unrecorded") keeps the key
  // ABSENT: writing dateField: null there would convert "unknown" into
  // "explicitly none" and arm the redate guard against the field's eventual
  // adoption. The stamp writes the SAME effective field the comparison above
  // used — one resolution, so the two can never diverge.
  if (dateFieldSource !== "unrecorded") stamp.dateField = effDateField;
  // Partial upserts leave the stamp untouched (F-313): a targeted subset is
  // not list-coverage evidence — `at` must keep saying when the domain was
  // last actually LISTED, and recordings only change on full re-lists (the
  // guard above already refused every recording flag).
  // RATIFIED ASYMMETRY (F-325): a full upsert into a never-listed domain
  // stamps with no warning, while the same state under --partial warns (the
  // F-316 block below). That is deliberate, not an oversight. This line IS
  // the registration mechanism — every domain's FIRST stamp arrives here
  // with no prior recording, because nothing else writes domains_indexed —
  // so "never listed" is the expected precondition of every legitimate full
  // registration, and a warning here would fire on 100% of them and train
  // operators to skim past it. Under --partial the same state is anomalous:
  // a declared subset asserts membership in a full list that was never
  // taken. The typo exposure on the full path is accepted as-is: a typo'd
  // name is an operator error on the path that has always defined domain
  // names, its entries remain removable via the remove verb — and its stamp
  // via remove --domain (F-333: before that verb existed, a phantom stamp —
  // then also reachable from an --id-field that matched no row, a failure
  // since F-388 round 2 — was permanently stuck) — and no shared-shape signal distinguishes it from a genuine
  // first registration.
  if (!partial) (m.domains_indexed ??= {})[domain] = stamp;
  save(m);
  const warnings = [...forkNotes]; // a describe-command shared with another domain is noted, never refused (F-432)
  // Skipped rows get the same loud treatment as under-pagination (F-220): a
  // dropped tenant asset must be looked at, not discovered by diffing
  // `skipped` against `incomingCount` by eye.
  if (skipped > 0) {
    warnings.push(
      `${skipped} of ${items.length} incoming row(s) carry no value at ${idField} and were NOT written — ` +
        `the KB now under-represents the incoming list by ${skipped} row(s). Inspect them before accepting ` +
        `the drop: a real asset can lack its id (e.g. a connection stuck in INIT that never finished ` +
        `initialising), and only marker/garbage rows are safe to ignore. Dropped row sample(s): ` +
        `${skippedSamples.join("; ")}.`
    );
  }
  // Partial date-path absence on a FULL list (F-392): some rows carry the
  // recorded date key and some do not — the ones without are stored dateless
  // and can never go stale on their own. Said with the counts (A-3), never
  // silent; the all-absent case failed above, a declared subset is exempt.
  if (!partial && typeof effDateField === "string" && datePresent > 0 && datePresent < idRows) {
    warnings.push(
      `${idRows - datePresent} of ${idRows} incoming row(s) carry no ${effDateField} key at all (${datePresent} do) — those entries are ` +
        `stored without a date and cannot go stale until a refresh brings one. If the list's shape moved under a CLI upgrade, the ` +
        `recorded date field is stale for the rows that lack it: inspect one of them and re-decide with --date-field <f> --allow-redate.`
    );
  }
  const incomingCount = incomingIds.length;
  // A partial registration into a never-listed domain proceeds (F-316: this
  // is the list-invisible recovery case — a blocked/failed list records in
  // domains_blocked, never here) but says so loudly: no stamp was or will be
  // written, and if the domain name was a typo the entries just landed under
  // it, so the warning names the exit.
  if (partial && !recorded) {
    // The typo-exit sentence only when rows actually landed — an empty or
    // all-skipped file wrote nothing, and "the entries are in the manifest
    // now" would be false (self-review of this round).
    const landed = added + stale + unchanged + baselined;
    warnings.push(
      `domain ${domain} has never been listed (no domains_indexed stamp) — this partial registration ` +
        `records its entries WITHOUT list coverage, the honest state for a list-invisible domain.` +
        (landed
          ? ` If "${domain}" was a typo, the entries are in the manifest now: remove them with the remove ` +
            `verb (--keys-file) and re-run against the intended domain.`
          : "")
    );
  }
  // A declared subset (--partial) is exempt: the shortfall is the whole point
  // of a gap-fill, and this warning's re-page advice would be wrong for it
  // (F-313). The skipped-row and mass-stale warnings stay live regardless —
  // they are about the rows actually submitted, not about coverage.
  if (incomingCount < existingEntries && !partial) {
    // The remedy sentence is derived from the flags THIS run passed, so the
    // warning never names a flag the script itself would refuse alongside
    // them (F-425: a refresh re-list — --list-command on every upsert, by
    // refresh step 3 — was told to "declare itself with --partial", and
    // following that hit the refusal above). The blocker list is the same
    // one the refusal reads, plus --allow-rekey's own arm; the general
    // --partial remedy stays for a run that passed none of them.
    const partialBlockers = [...recordingFlagsPassed, ...(allowRekey ? ["--allow-rekey"] : [])];
    const remedy = partialBlockers.length
      ? `This run passed ${partialBlockers.join(" / ")}, so it is a full-list run by its own declaration: ` +
        `--partial is NOT the remedy here (it refuses to combine with ${partialBlockers.join(" / ")}) — re-page, ` +
        `or read the shortfall as the recency filter or scope limit above if that is what you ran.`
      : `A deliberate subset (gap-fill or targeted registration) should declare itself with --partial instead.`;
    warnings.push(
      `incoming list (${incomingCount}) is smaller than the domain's ${existingEntries} non-failed ` +
        `entries — probable under-pagination (CLI list defaults return 20–50 items with no truncation ` +
        `warning). Re-page and re-upsert before inferring any deletion; expected and ignorable only ` +
        `for a single page of a multi-page fetch, a recency-filtered list, or a SCOPE-LIMITED domain — ` +
        `a list command that cannot see the whole tenant (setup's references/index-scope-notes.md names ` +
        `them; \`jo email templates\` is one), where the shortfall is permanent and re-paging cannot ` +
        `close it. ${remedy}`
    );
  }
  // Mass-stale advisory: a large fraction flipping stale at once is the
  // signature of a wrong date field (or a platform event bumping dates en
  // masse), not of that many real edits.
  if (stale >= 10 && stale >= existingIds.length / 2) {
    warnings.push(
      `${stale} of ${existingIds.length} existing entries flipped stale in one upsert — before ` +
        `spending --document budget, verify the date field matches the one the domain was indexed ` +
        `with (dateField in domains_indexed) and check the stale set for a tight timestamp cluster ` +
        `(a platform event, not real edits).`
    );
  }
  const result = {
    ok: true, domain, added, stale, unchanged, skipped, baselined, matchedExisting,
    dateField: effDateField, dateFieldSource, datePresentRows: datePresent, dateResolvedRows: dateResolved, namePresentRows: namePresent, namesBackfilled, incomingCount, existingEntries, partial, warnings,
    totalInventory: Object.keys(m.inventory).length,
  };
  if (orphaned) {
    result.orphanedKeys = orphaned.length;
    result.orphansFile = orphansFile ?? null;
    result.orphansHint =
      "old-key entries stranded by the rekey — remove them with the remove verb (--keys-file), never by hand" +
      (orphansFile
        ? ""
        : "; this run did not pass --orphans-file, so no key list was captured and it cannot be regenerated — the count above is the only record");
  }
  out(result);
} else if (verb === "mark") {
  const key = opt("--key");
  const keysFile = opt("--keys-file");
  const status = opt("--status");
  if (key && keysFile) fail("mark takes --key <domain/id> or --keys-file <json-array-of-keys>, not both");
  const MARK_USAGE = `mark requires --key <domain/id> or --keys-file <json-array-of-keys>, and --status <${[...STATUSES].join("|")}>`;
  if ((!key && !keysFile) || !status || !isStatus(status)) fail(MARK_USAGE);
  // Parsed once into the T-2 union (or absent): the `x !== undefined && !pred(x)`
  // guard shape narrows only under strictNullChecks, and the base config
  // checks this file too.
  const depthRaw = opt("--depth");
  const depth = depthRaw === undefined ? undefined : isDepth(depthRaw) ? depthRaw : fail("--depth must be metadata or full");
  // Untrusted-input tenet: the strict 40-hex shape both matches what
  // canonicalFingerprint emits and blocks injectable text from ever being
  // stored in the manifest.
  const fingerprint = opt("--fingerprint");
  if (fingerprint !== undefined && !/^[0-9a-f]{40}$/i.test(fingerprint)) {
    fail("--fingerprint must be a 40-char hex sha1 digest");
  }
  const docPath = opt("--doc-path");
  // A fingerprint identifies ONE describe payload and a doc_path ONE file —
  // recording the same value on a whole batch is always a corruption, so the
  // batch mode refuses rather than fans out.
  if (keysFile && (fingerprint !== undefined || docPath !== undefined)) {
    fail("--fingerprint/--doc-path are per-asset recordings — not valid with --keys-file");
  }
  const limitRaw = opt("--limit");
  if (limitRaw !== undefined && !keysFile) fail("--limit only applies with --keys-file");
  // 0 is deliberately valid: budget splits can compute to zero, and the caller
  // (a skill fence) must not need conditional shell logic around that.
  if (limitRaw !== undefined && !/^\d+$/.test(limitRaw)) fail("--limit must be a non-negative integer");
  const err = opt("--error");
  // Keys files are priority-ordered by their producer (e.g. oldest-first), so
  // --limit truncates in file order — never re-sorts. Duplicates collapse to
  // their first occurrence BEFORE the cut (order-preserving), so a repeated key
  // can neither consume a budget slot nor inflate `marked` (F-169).
  // The guard above already refused the no-key/no-file case; the checker cannot
  // follow a disjunctive guard, so the single-key arm re-states it as a
  // narrowing (same message, unreachable by construction) instead of a cast.
  let keys = keysFile ? [...new Set(readKeysFile(keysFile))] : key ? [key] : fail(MARK_USAGE);
  if (limitRaw !== undefined) keys = keys.slice(0, Number.parseInt(limitRaw, 10));
  const m = load();
  // All-or-nothing (F-162, deliberately stricter than remove): a key absent
  // from the inventory means the work list and the manifest disagree, and a
  // partial batch would silently shrink the caller's budget. Zero writes.
  // hasOwn, not truthiness: the inventory is JSON.parse output and still
  // inherits Object.prototype, so a work-list key like "__proto__" or
  // "toString" is truthy at lookup — a plain check would "mark" it against the
  // prototype and report success while writing nothing (F-168).
  const unknown = keys.filter((k) => !Object.hasOwn(m.inventory, k));
  if (unknown.length) {
    const shown = unknown.slice(0, 5).join(", ");
    fail(`no inventory entry: ${shown}${unknown.length > 5 ? ` (+${unknown.length - 5} more)` : ""}${keysFile ? " — nothing marked" : ""}`);
  }
  for (const k of keys) {
    const e = m.inventory[k];
    e.status = status;
    if (status === "documented") {
      e.last_verified = new Date().toISOString();
      // Describe-based docs are the norm, but never silently promote an existing
      // metadata stub to full — that would drop it from the --upgrade queue with
      // no full doc written. Pass --depth full explicitly after a deep ingest.
      e.depth = depth ?? e.depth ?? "full";
      // Only documented marks carry a payload fingerprint; failed/stale marks
      // leave the last documented one in place for the --if-changed gate.
      if (fingerprint !== undefined) e.fingerprint = fingerprint.toLowerCase();
      delete e.error;
    } else if (depth) {
      e.depth = depth;
    }
    if (status === "failed" && err) e.error = err;
    // Where the doc landed — remove reports doc_path for stale-file cleanup, so
    // every path that writes a doc (stub, describe-batch, hand-run) records it.
    if (docPath) e.doc_path = docPath;
  }
  save(m);
  out(keysFile ? { ok: true, marked: keys.length, status } : { ok: true, key, status, depth: m.inventory[keys[0]].depth ?? null });
} else if (verb === "next") {
  const m = load();
  const limit = Number.parseInt(opt("--limit", "25"), 10);
  if (!Number.isFinite(limit) || limit < 1) fail("--limit must be a positive integer");
  const domain = opt("--domain");
  const upgrade = argv.includes("--upgrade");
  const statuses = new Set(opt("--statuses", "pending,stale,failed").split(","));
  // --upgrade: the --deep flow — metadata stubs awaiting full ingest. A failed
  // ingest attempt keeps depth metadata, so it stays selectable for retry
  // instead of silently dropping out of the queue.
  const wanted = upgrade
    ? (e) => (e.status === "documented" || e.status === "failed") && e.depth === "metadata"
    : (e) => statuses.has(e.status);
  // Failed entries sort after everything else: a deterministic failure at the
  // front of the alphabet must never starve untried assets out of the batch.
  const entries = Object.entries(m.inventory)
    .filter(([, e]) => wanted(e) && (!domain || e.domain === domain))
    .sort(([a, ea], [b, eb]) => {
      const fa = ea.status === "failed" ? 1 : 0;
      const fb = eb.status === "failed" ? 1 : 0;
      return fa - fb || cmpKey(a, b); // pinned locale (F-128) — queue order must not vary per machine
    })
    .slice(0, limit)
    .map(([key, e]) => ({ key, ...e }));
  out({ ok: true, count: entries.length, entries });
} else if (verb === "crawl") {
  const m = load();
  const set = opt("--set");
  if (set !== undefined) {
    if (!isCrawlMode(set)) fail("--set must be shallow or deep");
    m.crawl_mode = set;
    save(m);
  }
  out({ ok: true, crawl_mode: m.crawl_mode ?? null });
} else if (verb === "stub") {
  const m = load();
  const file = opt("--file");
  const domain = opt("--domain");
  const idField = opt("--id-field");
  const outDir = opt("--out-dir");
  if (!file || !domain || !idField || !outDir) {
    fail("stub requires --file, --domain, --id-field, --out-dir");
  }
  domainOrFail(domain); // F-215
  let data;
  try {
    data = readJsonFile(file);
  } catch (e) {
    fail(`cannot parse ${file}: ${e.message}`);
  }
  const nameField = opt("--name-field");
  const items = findItems(data, opt("--items-path"), idField);
  mkdirSync(resolve(outDir), { recursive: true });
  const now = new Date().toISOString();
  // The stub banner (F-334; three states since gate-3 F-346) is the doc's own
  // completeness claim, so it may only say what the recording KNOWS:
  //   describable — a template is recorded: the stub is a shallow placeholder
  //     and --deep is its upgrade path.
  //   list-only — the DESCRIBE_NONE sentinel is recorded, the operator's
  //     decision that no usable per-item describe exists: the stub IS the
  //     asset's complete doc, and a --deep pointer would tell the reader to
  //     run a command that can do nothing for it.
  //   unrecorded — null/absent: a legacy stamp, or an operator who never
  //     passed the flag. Nothing is known, so the banner claims NEITHER
  //     completeness nor a working --deep; it names both ways to resolve the
  //     state. (The pre-F-346 rule read this state as list-only, so a
  //     describable domain indexed without the flag got every stub stamped
  //     "complete" — the durable false done-marker the F-334 comment said it
  //     was avoiding.) The catalog cannot make the call for the operator:
  //     scorecards describe through a different command group and connector
  //     jobs through a flag, so a recorded decision is the only honest source.
  const stubStamp = (m.domains_indexed ?? {})[domain];
  const recordedDescribe =
    stubStamp != null && typeof stubStamp === "object" && typeof stubStamp.describeCommand === "string"
      ? stubStamp.describeCommand
      : null;
  const describeState =
    recordedDescribe === DESCRIBE_NONE ? "list-only" : recordedDescribe ? "describable" : "unrecorded";
  const banner = {
    describable: [
      `${STUB_MARKER} (shallow crawl, captured ${now}) — full ingest:`,
      `> \`/gs-superadmin:setup --deep ${domain}\``,
    ],
    "list-only": [
      `${STUB_MARKER} (list-only domain, captured ${now}) — list-only (complete):`,
      `> this domain has no per-item describe command (recorded at index time); the list payload below is everything the CLI can say.`,
    ],
    unrecorded: [
      `${STUB_MARKER} (shallow crawl, captured ${now}) — completeness UNKNOWN:`,
      `> no describe command is recorded for this domain, so this doc may or may not be complete. To resolve it,`,
      `> either record a template (\`manifest.mjs upsert-batch --describe-command "gs-admin --json <ns> <describe-cmd> --id {id}"\`)`,
      `> and then run \`/gs-superadmin:setup --deep ${domain}\`, or record \`--describe-command ${DESCRIBE_NONE}\` if no usable per-item describe exists.`,
    ],
  }[describeState];
  const claimName = docNameClaimer(resolve(outDir)); // shared disk-keyed collision rule (F-125/F-156)
  let stubbed = 0, skippedFull = 0, skippedMissing = 0;
  for (const it of items) {
    const id = get(it, idField);
    if (id == null || id === "") { skippedMissing++; continue; }
    const key = `${domain}/${id}`;
    const e = m.inventory[key];
    if (!e) { skippedMissing++; continue; } // run upsert-batch first
    // Never downgrade a full doc to a stub, whatever the entry's status —
    // refresh flips documented entries to `stale` without touching depth, and
    // entries documented before the depth field existed have last_verified but
    // no depth. Only metadata stubs and never-documented entries are stubbable.
    const hasFullDoc = e.depth === "full" || (e.depth == null && e.last_verified != null);
    if (hasFullDoc) { skippedFull++; continue; }
    // case-insensitive: distinct ids can still collide as FILENAMES on
    // Windows/macOS ("Company" vs "company" — F-125). The shared claimer
    // (doc-lib, F-156) suffixes "-dup" on every OS, keyed on disk as well as
    // this run — a stub written beside an existing full doc can never take
    // its name, whatever order the passes ran in. (The old "~" suffix here
    // also sat outside docBaseName's A-Za-z0-9._- charset.)
    const base = claimName(id);
    const relPath = `${outDir.replace(/\\/g, "/").replace(/\/$/, "")}/${base}.md`;
    const name = (nameField ? get(it, nameField) : null) ?? e.name ?? String(id);
    const fields = Object.entries(it)
      .filter(([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v))
      .map(([k, v]) => `- ${k}: ${v === "" ? '""' : String(v)}`);
    // The marker blockquote below is load-bearing: jo-report.mjs's
    // parseJourneyDoc detects it to keep the doc at depth "stub" (the fence
    // below holds a raw list item, not a describe payload). Single source:
    // doc-lib's STUB_MARKER (T-3) — imported by both sites, never re-spelled.
    // EVERY banner variant keeps the marker (F-334): it flags the fence's
    // provenance — a raw LIST item — which is true of every stub whatever the
    // domain's describability; dropping it from a variant would make a
    // legacy-stamped journey stub parse as a FULL doc.
    const doc = [
      `# ${name}`,
      "",
      ...banner,
      "",
      `- key: ${key}`,
      ...fields,
      "",
      "```json",
      JSON.stringify(it, null, 2),
      "```",
      "",
    ].join("\n");
    writeFileSync(resolve(outDir, `${base}.md`), doc, "utf8");
    e.status = "documented";
    e.depth = "metadata";
    e.last_verified = now;
    e.doc_path = relPath;
    delete e.error;
    stubbed++;
  }
  save(m);
  out({ ok: true, domain, describeState, stubbed, skippedFull, skippedMissing, outDir });
} else if (verb === "report") {
  const m = load();
  // Null-prototype accumulators (F-225): inventory domains/statuses are data
  // from a JSON file, and folding them as bare keys on a {} literal reads
  // inherited Object.prototype members for names like "constructor" — the
  // `??=` sees a truthy inherited value, skips assignment, and the `+ 1`
  // mutates the GLOBAL prototype member while the domain silently vanishes
  // from byDomain and emptyDomains. domainOrFail rejects such names at the
  // door now, but pre-fix or hand-edited manifests can still carry them —
  // the fold must be safe regardless. (JSON.stringify is prototype-blind, so
  // the output shape is unchanged.)
  const byStatus = Object.create(null);
  const byDomain = Object.create(null);
  for (const e of Object.values(m.inventory)) {
    byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    (byDomain[e.domain] ??= Object.create(null))[e.status] = (byDomain[e.domain][e.status] ?? 0) + 1;
  }
  const domainsIndexed = m.domains_indexed ?? {};
  // Indexed but no inventory entries: the tenant genuinely has none of these.
  const emptyDomains = Object.keys(domainsIndexed).filter((d) => !byDomain[d]).sort();
  // Per-domain change window (F-417): days since the domain's OWN list stamp
  // — the `at` upsert-batch writes on every full list — never since a
  // workspace-wide last_refresh. A crawl that reached 2 of 17 domains leaves
  // the other 15 with their older `at`, so the next refresh asks each of
  // them for the right span instead of one day. Minimum 1 day (a domain
  // listed minutes ago still asks for "today"); null when the stamp carries
  // no parseable `at` (legacy) — the skill's fallback is lookbackDefault.
  const LOOKBACK_DEFAULT_DAYS = 7;
  const lookback = Object.create(null);
  for (const d of Object.keys(domainsIndexed).sort()) {
    const at = domainsIndexed[d] && typeof domainsIndexed[d] === "object" ? domainsIndexed[d].at : undefined;
    const t = typeof at === "string" ? Date.parse(at) : NaN;
    lookback[d] = { at: typeof at === "string" ? at : null, days: Number.isFinite(t) ? Math.max(1, Math.ceil((Date.now() - t) / 86400000)) : null };
  }
  out({
    ok: true,
    slug: m.slug,
    baseUrl: m.baseUrl,
    // Echoed so refresh step 1's backfill branch is decided from report's
    // own output (F-427): a legacy manifest with no key reads null here,
    // the same as one initialised without --environment.
    environment: m.environment ?? null,
    total: Object.keys(m.inventory).length,
    last_refresh: m.last_refresh,
    byStatus,
    byDomain,
    lookback,
    lookbackDefault: LOOKBACK_DEFAULT_DAYS,
    domains_indexed: domainsIndexed,
    domains_excluded: m.domains_excluded ?? {},
    domains_blocked: m.domains_blocked ?? {},
    emptyDomains,
  });
} else if (verb === "exclude" || verb === "block") {
  const m = load();
  const command = opt("--command");
  const remove = argv.includes("--remove");
  const reason = opt("--reason");
  if (!command) {
    fail(`${verb} requires --command "<canonical command path>" — the exact path domain-candidates.mjs diff prints`);
  }
  // The key is a canonical catalog path ("rules-engine rules
  // list-rest-connections"): lowercase words of [a-z0-9-] separated by single
  // spaces. The strict shape keeps prototype-polluting keys ("__proto__") and
  // full command lines ("gs-admin --json cn list") out of the map — run the
  // diff verb and pass the path it prints.
  // Every word starts alphanumeric — "--json" and other flag tokens cannot
  // pass — and the program name itself is not part of a canonical path.
  // Word ceiling (F-227): an anti-garbage bound only, deliberately WELL above
  // the catalog's real maximum (5 words at the current pin) — the old {0,4}
  // ceiling EQUALLED that maximum, so the first CLI version with a 6-word
  // path would have made its candidate undecidable via exclude/block. This
  // file is deliberately catalog-independent, so the bound cannot be derived;
  // it must simply never sit near the working distribution (same F-222 lesson
  // as REASON_MAX).
  if (!/^[a-z][a-z0-9-]*( [a-z0-9][a-z0-9-]*){0,9}$/.test(command) || /^gs-admin(\s|$)/.test(command)) {
    fail(
      `--command must be a canonical command path (lowercase words, e.g. "rules-engine rules list-rest-connections", ` +
        `not a full gs-admin command line) — run domain-candidates.mjs diff and use the path it prints ` +
        `(got "${command.slice(0, 60)}")`
    );
  }
  const excluded = (m.domains_excluded ??= {});
  const blocked = (m.domains_blocked ??= {});
  // Adding a THIRD decision-record verb here? domain-candidates.mjs's
  // contradiction checks and precedence chain are hand-enumerated for the
  // current record kinds — see the F-240 note at its candidate loop: a new
  // kind means moving that enumeration to a generated pair loop, never
  // extending it by hand.
  const map = verb === "exclude" ? excluded : blocked;
  // --recheck-after belongs to a RECORD write — with --remove it would be
  // silently ignored, and an ignored control is worse than a rejected one.
  // Both record kinds take it since F-449: before that only the temporary
  // block carried a review date while the permanent exclusion carried none.
  if (argv.includes("--recheck-after") && remove) {
    fail(`--recheck-after applies only when recording ${verb === "exclude" ? "an exclusion" : "a block"} (${verb} --command ... --reason ...), never with --remove`);
  }
  if (remove) {
    if (reason !== undefined) fail(`--remove lifts ${verb === "exclude" ? "an exclusion" : "a block"}; it takes no --reason`);
    const existed = Object.hasOwn(map, command);
    if (existed) {
      delete map[command];
      save(m);
    }
    out({ ok: true, command, removed: existed });
  } else {
    if (!reason) {
      fail(
        verb === "exclude"
          ? 'exclude requires --reason "<why this list is deliberately not indexed>" (or --remove to lift an exclusion)'
          : 'block requires --reason "<why this candidate could not be evaluated>" (or --remove to lift a block)'
      );
    }
    // Untrusted-input tenet: the reason is stored in the manifest and echoed by
    // reports and the diff verb — printable ASCII only, hard length cap.
    if (!/^[\x20-\x7e]+$/.test(reason)) {
      fail("--reason must be printable ASCII (it is stored in the manifest and echoed by reports)");
    }
    // The cap exists only to stop a pasted payload or a runaway generation from
    // landing in the manifest, so it must sit clear of the working distribution
    // rather than inside it. At 300 it sat inside: on the first real tenant,
    // well-written reasons ran 269-292 chars, and the two needing the MOST
    // explanation (a judgment-call exclusion and a ten-group payload) were
    // rejected by 2-3 characters — the clamp bit hardest exactly where nuance was
    // required. A second operator's block reasons then landed at 277/289 without
    // ever being told how close they were. REASON_MAX is ~3.4x that observed
    // maximum: still a hard bound, but one only abuse can reach (F-222).
    if (reason.length > REASON_MAX) fail(`--reason too long (${reason.length} chars, max ${REASON_MAX})`);
    const recheckAfter = opt("--recheck-after");
    if (recheckAfter !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(recheckAfter)) {
      fail(`--recheck-after must be a YYYY-MM-DD date (got "${String(recheckAfter).slice(0, 20)}")`);
    }
    if (verb === "block") {
      // A block is NOT a decision: it must never overwrite one. The operator
      // who really wants to re-litigate lifts the exclusion first, on purpose.
      if (Object.hasOwn(excluded, command)) {
        fail(
          `"${command}" is already EXCLUDED (a decision) — a block records "could not look" and cannot ` +
            `overwrite "looked and said no". Lift the exclusion first (exclude --remove) if re-litigating.`
        );
      }
      const prev = Object.hasOwn(blocked, command) ? blocked[command] : null;
      blocked[command] = { reason, decidedAt: new Date().toISOString(), ...(recheckAfter ? { recheckAfter } : {}) };
      save(m);
      out({ ok: true, command, updated: prev != null, previousReason: prev?.reason ?? null });
    } else {
      // F-449 — the verdict is bound to the check's numbers. Phase 4's rule
      // ("allIndexed → exclude naming the covering domain; otherwise judgment")
      // was prose the model executed, and on one tenant it recorded "covered
      // by data-management, more completely" over a check that read 253 of
      // 586 — the same evidence another tenant correctly adopted. The rule
      // moves into this verb: a record write carries the check's numbers (or
      // an explicit reason none could run), the coverage claim is a FLAG the
      // numbers must support, and a check that proves coverage cannot be
      // filed as anything else. Prose stays free; the verdict does not.
      const checkFile = opt("--check");
      const noCheck = opt("--no-check");
      const coveredBy = opt("--covered-by");
      if ((checkFile === undefined) === (noCheck === undefined)) {
        fail(
          `exclude requires exactly one of --check <check-output.json> (the file ` +
            `domain-candidates.mjs check --out wrote for this candidate) or --no-check "<why no overlap ` +
            `check was possible>" (e.g. the payload carries no items array) — the decision records its evidence`
        );
      }
      if (coveredBy !== undefined && !/^[a-z0-9][a-z0-9-]{0,99}$/.test(coveredBy)) {
        fail(`--covered-by must be a manifest domain name (lowercase words joined by "-"; got "${coveredBy.slice(0, 40)}")`);
      }
      if (noCheck !== undefined) {
        if (!/^[\x20-\x7e]+$/.test(noCheck) || noCheck.length > REASON_MAX) {
          fail(`--no-check must be a printable ASCII reason (max ${REASON_MAX} chars) — it is stored in the manifest as noCheck`);
        }
        if (coveredBy !== undefined) {
          fail(
            `--covered-by is a coverage claim and needs the check's numbers — run ` +
              `domain-candidates.mjs check --out <file> for this candidate and pass --check <file>`
          );
        }
      }
      /** @type {GsCheckEvidence | null} */
      let evidence = null;
      if (checkFile !== undefined) {
        let c;
        try {
          c = readJsonFile(checkFile);
        } catch (e) {
          fail(`cannot parse --check ${checkFile}: ${e instanceof Error ? e.message : String(e)}`);
        }
        const isCheck =
          c && typeof c === "object" && !Array.isArray(c) && c.ok === true &&
          Number.isInteger(c.rows) && Number.isInteger(c.uniqueIds) && Number.isInteger(c.alreadyIndexed) &&
          (c.allIndexed === null || typeof c.allIndexed === "boolean") &&
          c.matchedByDomain && typeof c.matchedByDomain === "object" && !Array.isArray(c.matchedByDomain);
        if (!isCheck) {
          fail(
            `--check ${checkFile} is not a domain-candidates.mjs check output (expected ok, rows, uniqueIds, ` +
              `alreadyIndexed, allIndexed, matchedByDomain) — write it with check --out <file>`
          );
        }
        if (c.partial === true) {
          fail(
            `the check at ${checkFile} is PARTIAL (${c.unresolvedRows} row(s) resolved no id) — it answers the ` +
              `overlap question for the resolvable subset only; fix the id path or --items-path, re-run the check, then decide`
          );
        }
        // Null-prototype fold (F-225): the domain names are data from a JSON file.
        const matchedByDomain = Object.create(null);
        for (const [d, n] of Object.entries(c.matchedByDomain)) if (Number.isInteger(n)) matchedByDomain[d] = n;
        evidence = { rows: c.rows, uniqueIds: c.uniqueIds, alreadyIndexed: c.alreadyIndexed, matchedByDomain };
        const domains = Object.keys(matchedByDomain);
        const spread = domains.map((d) => `${d}: ${matchedByDomain[d]}`).join(", ");
        if (coveredBy !== undefined) {
          if (c.allIndexed !== true || matchedByDomain[coveredBy] !== c.uniqueIds) {
            fail(
              `"${command}" is NOT covered by ${coveredBy}: the check says ${c.alreadyIndexed} of ${c.uniqueIds} unique ` +
                `id(s) are indexed anywhere${spread ? ` (${spread})` : ""}` +
                `${c.allIndexed === null ? " — and the answer is withheld (0 rows)" : ""}. A coverage exclusion needs ` +
                `every id under that one domain. Adopt the candidate (upsert-batch), or — only if the rows are not ` +
                `tenant assets — exclude it as a judgment call: --reason without --covered-by.`
            );
          }
        } else if (c.allIndexed === true && domains.length === 1) {
          fail(
            `the check says every id (${c.uniqueIds} of ${c.uniqueIds}) is already indexed under ${domains[0]} — ` +
              `that is a coverage exclusion; record it as one: --covered-by ${domains[0]}`
          );
        }
      }
      // Excluding a blocked command lifts the block in the same write: the
      // command has now been looked at and decided, so "could not look" is
      // stale — leaving it would make the diff report a contradiction forever.
      const blockLifted = Object.hasOwn(blocked, command);
      if (blockLifted) delete blocked[command];
      const prev = Object.hasOwn(excluded, command) ? excluded[command] : null;
      excluded[command] = {
        reason,
        decidedAt: new Date().toISOString(),
        ...(coveredBy !== undefined ? { coveredBy } : {}),
        ...(evidence ? { evidence } : { noCheck }),
        ...(recheckAfter ? { recheckAfter } : {}),
      };
      save(m);
      out({
        ok: true, command, updated: prev != null, previousReason: prev?.reason ?? null, blockLifted,
        kind: coveredBy !== undefined ? "coverage" : "judgment",
      });
    }
  }
} else if (verb === "remove") {
  const m = load();
  const key = opt("--key");
  const keysFile = opt("--keys-file");
  const domainFlag = opt("--domain");
  // --allow-populated belongs to stamp de-registration only — anywhere else it
  // would be silently ignored, and an ignored control is worse than a rejected
  // one (the --recheck-after precedent).
  if (argv.includes("--allow-populated") && !domainFlag) {
    fail("--allow-populated applies only with --domain <name> (stamp de-registration)");
  }
  if (domainFlag && (key || keysFile)) {
    fail("remove --domain de-registers a coverage stamp and cannot combine with --key/--keys-file entry removal — one removal kind per invocation");
  }
  // Stamp de-registration (F-333): the sanctioned exit for a phantom
  // domains_indexed stamp — a typo'd --domain stamps a domain with zero
  // entries (an --id-field matching no row did too, until F-388 round 2 made
  // that a failure that stamps nothing); the stamp then shows in
  // report's byDomain/emptyDomains and the candidate gate's indexed count,
  // indistinguishable from a real "listed, tenant has none", and hand-editing
  // the manifest is barred. Deliberately NOT domainOrFail-guarded: the target
  // may be exactly the malformed name that needs removing, and a lookup by
  // hasOwn + delete is safe for any own key (JSON.parse keys are own
  // properties, "__proto__" included).
  if (domainFlag) {
    const di = m.domains_indexed ?? {};
    const entryCount = Object.values(m.inventory).filter((e) => e.domain === domainFlag).length;
    const existed = Object.hasOwn(di, domainFlag);
    if (existed && entryCount && !argv.includes("--allow-populated")) {
      fail(
        `domain ${domainFlag} still holds ${entryCount} inventory entr${entryCount === 1 ? "y" : "ies"} — removing its ` +
          `coverage stamp would leave them recorded WITHOUT list coverage. Remove the entries first ` +
          `(remove --keys-file over the domain's keys), or pass --allow-populated to de-register ` +
          `coverage only (the entries stay).`
      );
    }
    if (existed) {
      delete di[domainFlag];
      save(m);
    }
    await finish({ ok: true, domain: domainFlag, removed: existed, entries: entryCount }); // F-360 class: exit in the write callback
  }
  if (!key && !keysFile) fail("remove requires --key <domain/id>, --keys-file <json-array-of-keys>, or --domain <name>");
  // Order-preserving dedupe, mirroring mark's F-169 rule (F-206): remove keys
  // files are model-assembled from paginated reconciliation, where a key
  // spanning two pages is a plausible duplicate — without the fold, the second
  // pass reports the just-removed key as `missing`, a phantom inventory
  // mismatch for whoever reads the JSON. Also folds a --key that duplicates a
  // keys-file entry.
  let keys = key ? [key] : [];
  if (keysFile) keys = keys.concat(readKeysFile(keysFile));
  keys = [...new Set(keys)];
  const missing = [];
  const docPaths = [];
  let removed = 0;
  for (const k of keys) {
    // hasOwn for the same reason as mark's presence check (F-168): a key like
    // "toString" is truthy via the prototype, and the plain check counted it
    // as removed while deleting nothing.
    if (!Object.hasOwn(m.inventory, k)) {
      missing.push(k);
      continue;
    }
    const e = m.inventory[k];
    if (e.doc_path) docPaths.push(e.doc_path);
    delete m.inventory[k];
    removed++;
  }
  save(m);
  // doc files are reported, not deleted — removal of tenant docs stays a
  // caller decision (they may be the only copy of a rekeyed asset's old doc)
  out({ ok: true, removed, missing, docPaths, totalInventory: Object.keys(m.inventory).length });
}
