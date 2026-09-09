#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// contract-conformance.mjs — EXECUTES the frozen contracts against produced
// artifacts (GP-B5 DS-18 build note; promoted per the review-gate rule after
// this probe class caught the v2 contract defects: enumerate real keys and
// nullability instead of trusting prose).
//
//   T-2 (scripts/manifest.mjs header): drive the manifest verbs in a temp
//   workspace and assert key presence/nullability on the file they write —
//   environment/last_refresh present-and-nullable from init, the stamp's
//   always-present-nullable itemsPath/describeCommand/listCommand (v2 delta 2),
//   dateField's tri-state (string / null / ABSENT — never null-for-unknown),
//   crawl_mode (not `crawl` — v2 delta 1), GsExclusion/GsBlock shapes with
//   decidedAt and the conditional recheckAfter, inventory-entry key sets, and
//   the legacy bare-ISO-string stamp a reader must tolerate (v2 delta 10).
//
//   T-1 (build/extract-catalog.mjs header): key-set conformance on the BUNDLED
//   plugin catalog (reference/catalog.json) — the artifact the guard and setup
//   actually consume. (build/test-extract-catalog.mjs runs the same
//   conformance on the committed repo catalog and a generated fixture one.)
//
//   T-3 (scripts/doc-lib.mjs header, GP-B5 DS-13): the stub-marker string
//   contract executed through the real parser — the LITERAL back-compat
//   value pin, the marker-is-the-signal control, and the line-anchoring
//   negative. (The writer→parser round trip through the real stub verb
//   lives in test/jo-report.mjs; test/doc-lib-fixtures.mjs pins the
//   exported constants directly.)
//
//   T-4 (scripts/journal-lib.mjs header, GP-B5 DS-15): the journal entry
//   grammar executed through BOTH real writers (guard hook PostToolUse,
//   journal.mjs journal-append) — frame uniformity, exact per-writer field
//   sequences, kind literals, ticket placement, and the label-subset
//   closure of "no other fields exist".
//
// The two observed-vs-typedef discrepancies this suite's probes found were
// adjudicated as CONTRACT v3 (B2, 2026-08-16, Bradley-approved in-session):
// endpoint entries carry {name, method, path}, and `char` is
// artifact-lane-only. The pins below assert them as contract.
//
// Run:  node plugins/gs-superadmin/test/contract-conformance.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";
import { parseJourneyDoc } from "../scripts/jo-report.mjs";
import { STUB_MARKER } from "../scripts/doc-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_SCRIPT = join(HERE, "..", "scripts", "manifest.mjs");
const BUNDLED_CATALOG = join(HERE, "..", "reference", "catalog.json");

let failures = 0;
let passed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; return; }
  failures++;
  console.log(`FAIL  ${label}`);
  if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// ── T-2 · _manifest.json, executed through the single writer ─────────────────
const dir = makeTempDir("contract-conformance");
try {
  const M = join(dir, "acme-prod", "_manifest.json");
  const readM = () => JSON.parse(readFileSync(M, "utf8"));
  const verb = (v, args) => runNode(MANIFEST_SCRIPT, [v, "--manifest", M, ...args]);

  // init: nullable fields are PRESENT from birth (freeze deltas 1–2).
  let r = verb("init", ["--slug", "acme-prod", "--base-url", "https://acme.gainsightcloud.com"]);
  check("init exits 0", r.status === 0, r.stderr);
  let m = readM();
  check("T-2: slug + baseUrl recorded", m.slug === "acme-prod" && m.baseUrl === "https://acme.gainsightcloud.com");
  check("T-2: environment PRESENT and null when not stated at init", "environment" in m && m.environment === null);
  check("T-2: last_refresh PRESENT and null from init", "last_refresh" in m && m.last_refresh === null);
  check("T-2: created is ISO", typeof m.created === "string" && ISO.test(m.created));
  check("T-2: inventory map present from init", m.inventory && typeof m.inventory === "object");
  const T2_TOP_KEYS = new Set([
    "slug", "baseUrl", "environment", "created", "last_refresh", "inventory",
    "domains_indexed", "domains_excluded", "domains_blocked", "crawl_mode",
  ]);
  check("T-2: no top-level key outside the typedef", Object.keys(m).every((k) => T2_TOP_KEYS.has(k)), Object.keys(m));

  // upsert-batch, minimal flags: the stamp's three command/path keys are
  // ALWAYS-PRESENT NULLABLE (v2 delta 2), dateField ABSENT for unknown (never
  // null-for-unknown — the tri-state's third state).
  writeFiles(dir, {
    "templates.json": JSON.stringify({ emailTemplates: [
      { templateId: "t-1", title: "Welcome A", modifiedDate: "2026-01-05T00:00:00.000Z" },
      { templateId: "t-2", title: "Welcome B", modifiedDate: null },
    ] }),
    "rules.json": JSON.stringify([{ id: "r-1", name: "Rule One" }]),
  });
  r = verb("upsert-batch", ["--file", join(dir, "templates.json"), "--domain", "journey-email-templates", "--id-field", "templateId", "--name-field", "title"]);
  check("upsert-batch (minimal flags) exits 0", r.status === 0, r.stderr);
  m = readM();
  let stamp = m.domains_indexed?.["journey-email-templates"];
  check("T-2: stamp written as an object keyed by namespace", stamp && typeof stamp === "object");
  check("T-2: stamp.at is ISO", ISO.test(stamp?.at ?? ""));
  check("T-2: stamp.idField recorded", stamp?.idField === "templateId");
  check("T-2: itemsPath ALWAYS PRESENT, null when unrecorded (v2 delta 2)", "itemsPath" in stamp && stamp.itemsPath === null);
  check("T-2: describeCommand ALWAYS PRESENT, null until recorded", "describeCommand" in stamp && stamp.describeCommand === null);
  check("T-2: listCommand ALWAYS PRESENT, null until recorded", "listCommand" in stamp && stamp.listCommand === null);
  check("T-2: dateField ABSENT when unknown — never null-for-unknown", !("dateField" in stamp), stamp);

  // Inventory entries: required keys present, every key inside the typedef.
  const T2_ENTRY_KEYS = new Set(["id", "name", "domain", "modified_date", "status", "depth", "last_verified", "doc_path", "fingerprint", "error"]);
  const e1 = m.inventory["journey-email-templates/t-1"];
  check("T-2: inventory keyed <domain>/<id>", !!e1, Object.keys(m.inventory));
  check("T-2: entry id/domain/status present", e1?.id === "t-1" && e1?.domain === "journey-email-templates" && e1?.status === "pending");
  check("T-2: entry keys all inside the typedef", Object.values(m.inventory).every((e) => Object.keys(e).every((k) => T2_ENTRY_KEYS.has(k))),
    Object.values(m.inventory).flatMap((e) => Object.keys(e)));

  // Recording pass: dateField string = recorded; itemsPath/describeCommand/
  // listCommand move null → recorded string; modified_date null = recorded-none.
  r = verb("upsert-batch", [
    "--file", join(dir, "templates.json"), "--domain", "journey-email-templates", "--id-field", "templateId",
    "--name-field", "title", "--date-field", "modifiedDate", "--items-path", "emailTemplates",
    "--describe-command", "gs-admin --json jo email template --id {id}",
    "--list-command", "gs-admin --json jo email templates",
  ]);
  check("upsert-batch (recording flags) exits 0", r.status === 0, r.stderr);
  m = readM();
  stamp = m.domains_indexed["journey-email-templates"];
  check("T-2: dateField string = recorded", stamp.dateField === "modifiedDate");
  check("T-2: itemsPath recorded", stamp.itemsPath === "emailTemplates");
  check("T-2: describeCommand recorded", stamp.describeCommand === "gs-admin --json jo email template --id {id}");
  check("T-2: listCommand recorded", stamp.listCommand === "gs-admin --json jo email templates");
  check("T-2: modified_date carries the item's date", m.inventory["journey-email-templates/t-1"].modified_date === "2026-01-05T00:00:00.000Z");
  check("T-2: modified_date null = recorded-none (explicitly none)",
    "modified_date" in m.inventory["journey-email-templates/t-2"] && m.inventory["journey-email-templates/t-2"].modified_date === null,
    m.inventory["journey-email-templates/t-2"]);

  // --no-date-field on a fresh domain: dateField null = recorded-none.
  r = verb("upsert-batch", ["--file", join(dir, "rules.json"), "--domain", "rules-engine-rules", "--id-field", "id", "--name-field", "name", "--no-date-field"]);
  check("upsert-batch --no-date-field exits 0", r.status === 0, r.stderr);
  m = readM();
  check("T-2: dateField null = recorded-none", m.domains_indexed["rules-engine-rules"].dateField === null,
    m.domains_indexed["rules-engine-rules"]);

  // crawl_mode: the key is crawl_mode (v2 delta 1 — no manifest ever carries
  // a `crawl` key), values from the two-value union.
  r = verb("crawl", ["--set", "deep"]);
  check("crawl --set deep exits 0", r.status === 0, r.stderr);
  m = readM();
  check("T-2: crawl_mode key spelled crawl_mode (v2 delta 1)", m.crawl_mode === "deep" && !("crawl" in m));

  // GsExclusion: exactly {reason, decidedAt}.
  r = verb("exclude", ["--command", "connectors jobs list", "--reason", "fixture: considered and declined"]);
  check("exclude exits 0", r.status === 0, r.stderr);
  m = readM();
  const excl = m.domains_excluded?.["connectors jobs list"];
  check("T-2: exclusion keyed by canonical command path", !!excl, m.domains_excluded);
  check("T-2: GsExclusion is exactly {reason, decidedAt}",
    excl && Object.keys(excl).sort().join(",") === "decidedAt,reason" && ISO.test(excl.decidedAt), excl);

  // GsBlock: decidedAt present (freeze delta 5); recheckAfter conditional.
  r = verb("block", ["--command", "scorecard measures list", "--reason", "fixture: could not look"]);
  check("block (no recheck) exits 0", r.status === 0, r.stderr);
  m = readM();
  const b1 = m.domains_blocked?.["scorecard measures list"];
  check("T-2: GsBlock without --recheck-after is exactly {reason, decidedAt}",
    b1 && Object.keys(b1).sort().join(",") === "decidedAt,reason" && ISO.test(b1.decidedAt), b1);
  r = verb("block", ["--command", "report definitions list", "--reason", "fixture: rate limited", "--recheck-after", "2026-12-01"]);
  check("block --recheck-after exits 0", r.status === 0, r.stderr);
  m = readM();
  const b2 = m.domains_blocked?.["report definitions list"];
  check("T-2: recheckAfter present as YYYY-MM-DD when passed",
    b2 && Object.keys(b2).sort().join(",") === "decidedAt,reason,recheckAfter" && b2.recheckAfter === "2026-12-01", b2);

  // Legacy bare-ISO-string stamp (v2 delta 10): a pre-recording manifest may
  // carry a STRING where the stamp object lives; the writer must tolerate it
  // (typeof branch) and upgrade it to an object on the next stamp.
  m = readM();
  m.domains_indexed["legacy-domain"] = "2025-01-01T00:00:00.000Z";
  writeFileSync(M, JSON.stringify(m, null, 2));
  writeFiles(dir, { "legacy.json": JSON.stringify([{ id: "l-1", name: "Legacy" }]) });
  r = verb("upsert-batch", ["--file", join(dir, "legacy.json"), "--domain", "legacy-domain", "--id-field", "id"]);
  check("legacy string stamp tolerated by the writer (v2 delta 10)", r.status === 0, r.stderr);
  m = readM();
  const lg = m.domains_indexed["legacy-domain"];
  check("legacy string stamp upgraded to an object on re-stamp",
    lg && typeof lg === "object" && "itemsPath" in lg && lg.itemsPath === null, lg);
} finally {
  removeTempDir(dir);
}

// ── T-1 · bundled plugin catalog conformance ─────────────────────────────────
{
  const cat = JSON.parse(readFileSync(BUNDLED_CATALOG, "utf8"));
  // The key lists below are deliberately re-derived from the frozen typedef
  // rather than shared with build/test-extract-catalog.mjs (which runs the
  // same conformance on the committed repo catalog): no lane both suites may
  // import exists for assertion material (R-10 keeps the rig plumbing-only),
  // and independent derivation is the house testing standard. A T-1 amendment
  // updates BOTH suites — grep T1_COMMAND_KEYS.
  // Non-empty floors first: `every` over empty arrays is vacuously true
  // (B2 review, finder A).
  check("T-1: non-vacuous — artifact commands, endpoints, and both flag families exist",
    cat.commands.filter((c) => c.lane === "artifact").length > 0 &&
      cat.commands.reduce((n, c) => n + c.endpoints.length, 0) > 0 &&
      cat.commands.filter((c) => c.lane === "artifact").reduce((n, c) => n + c.flags.length, 0) > 0 &&
      cat.commands.filter((c) => c.lane !== "artifact").reduce((n, c) => n + c.flags.length, 0) > 0);
  const T1_COMMAND_KEYS = [
    "id", "lane", "domain", "path", "shortPath", "group", "subGroup", "subSubGroup",
    "groupPath", "groupTitles", "name", "actionKey", "summary", "description",
    "mutating", "cliHidden", "mcpTool", "mcpHidden", "outputFormat", "flags",
    "examples", "afterHelpNotes", "endpoints",
  ].sort().join(",");
  const T1_FLAG_KEYS = ["name", "flag", "char", "type", "required", "default", "enum", "csv", "description", "cliExposed"].sort().join(",");
  const FLAG_KEYS_NO_CHAR = T1_FLAG_KEYS.split(",").filter((k) => k !== "char").join(",");
  check("T-1: bundled catalog commands carry exactly the typedef keys",
    cat.commands.every((c) => Object.keys(c).sort().join(",") === T1_COMMAND_KEYS));
  check("T-1: bundled artifact flags carry the ten keys (char null-valued at the pin)",
    cat.commands.filter((c) => c.lane === "artifact").every((c) => c.flags.every((f) => Object.keys(f).sort().join(",") === T1_FLAG_KEYS)));
  check("T-1 v3: runtime/static flags omit char (artifact-lane-only key)",
    cat.commands.filter((c) => c.lane !== "artifact").every((c) => c.flags.every((f) => Object.keys(f).sort().join(",") === FLAG_KEYS_NO_CHAR)));
  check("T-1 v3: endpoint entries carry exactly name+method+path",
    cat.commands.every((c) => c.endpoints.every((e) => Object.keys(e).sort().join(",") === "method,name,path")));
  // F-287 value-rule projection (independently derived — see the note above
  // about the sibling suite): "default" tracks the manifest's singular
  // `endpoint` FIELD, not entry count, so single-entry arrays must exist in
  // both name shapes.
  {
    const singles = cat.commands.map((c) => c.endpoints).filter((e) => e.length === 1);
    check("T-1 v3 (F-287): single-entry endpoint arrays exist in both name shapes",
      singles.some((e) => e[0].name === "default") && singles.some((e) => e[0].name !== "default"));
  }
  check("T-1: counts of record hold on the bundled catalog",
    cat.meta.counts.totalCliCommands === cat.commands.length &&
      cat.meta.counts.mcpTools === cat.commands.filter((c) => c.mcpTool).length);
}

// ── T-3 · stub-marker string contract, executed through the real parser ──────
// GP-B5 DS-13: the marker is single-sourced as doc-lib's STUB_MARKER /
// STUB_MARKER_RE. The writer→parser round trip through the REAL stub verb
// already lives in test/jo-report.mjs ("journey stub (stub verb)" block —
// init/upsert/stub/parseJourneyDoc, so writer or detector desync from the
// constant fails there); this section adds the locks that round trip is
// BLIND to, all in-process on hand-spelled docs (R-10 independent
// derivation): the VALUE pin (a constant edit keeps the round trip green —
// both sites flow the same constant — but must fail on a doc written by an
// EARLIER plugin version, which lives immutably in user KBs), the
// marker-is-the-signal control, and the line-anchoring negative.
{
  const legacyDoc = [
    "# Legacy Program",
    "",
    "> **Metadata-only stub** (shallow crawl, captured 2026-01-01T00:00:00.000Z) — full ingest:",
    "> `/gs-superadmin:setup --deep journey`",
    "",
    "- key: journey/legacy-1",
    "",
    "```json",
    '{ "programId": "legacy-1", "name": "Legacy Program" }',
    "```",
    "",
  ].join("\n");
  check("T-3 back-compat VALUE pin: literal legacy stub doc detected as stub (fence present)",
    parseJourneyDoc(legacyDoc, "legacy-1.md").entry.depth === "stub");

  // Control: the marker line is the load-bearing signal — remove it and the
  // same doc reads as FULL (its fence parses), proving detection rides the
  // marker, not fence absence. Removal keys on the constant so a marker
  // rename cannot silently turn this into a no-op filter.
  const noMarker = legacyDoc.split("\n").filter((l) => !l.startsWith(STUB_MARKER)).join("\n");
  check("T-3 control: marker line removed → same doc parses as depth full",
    parseJourneyDoc(noMarker, "legacy-1.md").entry.depth === "full");

  // Anchoring negative: the marker MID-LINE in pre-fence text must NOT read
  // as a stub — the contract is marker at the start of a line (the ^…m
  // anchor a widening edit to STUB_MARKER_RE would silently drop).
  const midLine = legacyDoc.replace(
    "> **Metadata-only stub** (shallow crawl,",
    "> was \"> **Metadata-only stub**\" before deep ingest (shallow crawl,");
  check("T-3 anchoring: marker mid-line is NOT a stub (parses full)",
    parseJourneyDoc(midLine, "legacy-1.md").entry.depth === "full");
}

// ── T-4 · journal entry grammar, executed through BOTH real writers ──────────
// GP-B5 DS-15, landed BEFORE the emitter hoist as the differential lock
// (A-6); grammar authored from captured output, assertions hand-spelled from
// the v4 header (R-10). Ownership split: this section owns FRAME, ORDER,
// heading↔body agreement, and the label-subset closure; entry CONTENT
// wording (outcome sentences guard-fixtures:574/:623/:654, note text
// guard-fixtures:1461) stays with the writer suites.
{
  const t4 = makeTempDir("contract-conformance-t4");
  try {
    const HOOK = join(HERE, "..", "hooks", "gs-admin-guard.mjs");
    const JOURNAL_SCRIPT = join(HERE, "..", "scripts", "journal.mjs");
    writeFiles(t4, {
      ".gs-superadmin/.keep": "",
      "acme-prod/_manifest.json": JSON.stringify({
        slug: "acme-prod", baseUrl: "https://acme.gainsightcloud.com",
        environment: "production", created: "2026-01-01T00:00:00.000Z",
        last_refresh: null, inventory: {},
      }, null, 2),
      "acme-prod/changes/2026-08-16-t4-plan.md": "# plan\n",
    });
    // The guard fails OPEN on journaling errors (exit 0 + systemMessage), so
    // every hook spawn asserts silence: a broken journal-lib import must
    // surface as a labeled FAIL quoting the alert, never a count mismatch.
    const hookPost = (command, extra = {}) => {
      const r = runNode(HOOK, [], {
        cwd: t4,
        input: JSON.stringify({
          hook_event_name: "PostToolUse", tool_name: "Bash",
          tool_input: { command }, cwd: t4, session_id: "t4-conformance", ...extra,
        }),
      });
      check("T-4: hook spawn exits 0 and journals without a fail-open alert",
        r.status === 0 && !String(r.stdout).includes("systemMessage"), r.stdout || r.stderr);
      return r;
    };
    // Guard variants (one spawn journals EVERY invocation it finds — hits
    // then unknowns — so the first covers two entries):
    //   e0 mutating + e1 unknown-fail-closed (one combined command) ·
    //   e2 exit-code failure · e3 failure event (hook_event_name override) ·
    //   e4 blind finding (conditional note) · e5 ticketed via the
    //   active-change marker — the frame's ticket substitution and the
    //   combined ticket·plan VALUES exercised through the GUARD path too.
    hookPost("gs-admin jo p save; gs-admin frobnicate everything");
    hookPost("gs-admin jo p save", { tool_response: { exit_code: 3, stdout: "", stderr: "" } });
    hookPost("gs-admin jo p save", { hook_event_name: "PostToolUseFailure", tool_error: "Command failed with exit code 1" });
    hookPost("cat > notes.md <<'EOF'\nDon't forget: gs-admin jo p save\nEOF", { tool_response: { exit_code: 0 } });
    writeFiles(t4, { ".gs-superadmin/active-change.json": JSON.stringify({
      ticket: "CSOPS-142", plan: "acme-prod/changes/2026-08-16-t4-plan.md",
      slug: "acme-prod", started_at: new Date().toISOString(),
    }) });
    hookPost("gs-admin jo p save");
    // journal.mjs variants: executed/ticketed/two assets · partial/no-ticket.
    let jr = runNode(JOURNAL_SCRIPT, ["journal-append", "--slug", "acme-prod",
      "--plan", "acme-prod/changes/2026-08-16-t4-plan.md", "--ticket", "CSOPS-142",
      "--system-area", "gs-rules", "--outcome", "executed",
      "--asset", "CREATE Risk Rule (1I00ABC) — acme-prod/rules-engine/r1.md",
      "--asset", "MODIFY Alert Rule (1I00DEF) — KB doc pending next /gs-superadmin:refresh"], { cwd: t4 });
    check("T-4: journal-append (executed) exits 0", jr.status === 0, jr.stderr || jr.stdout);
    jr = runNode(JOURNAL_SCRIPT, ["journal-append", "--slug", "acme-prod",
      "--plan", "acme-prod/changes/2026-08-16-t4-plan.md", "--ticket", "none",
      "--system-area", "gs-journey", "--outcome", "partial", "--asset", "none"], { cwd: t4 });
    check("T-4: journal-append (partial) exits 0", jr.status === 0, jr.stderr || jr.stdout);

    const jrn = readFileSync(join(t4, "acme-prod", "changes", "JOURNAL.md"), "utf8");
    const entries = jrn.split(/^## /m).slice(1).map((e) => "## " + e);
    // Hard gate: the guard fails open, so a journaling regression shows up
    // as a short file — fail here with the count, never a TypeError below.
    check("T-4: 8 entries written (6 guard entries from 5 spawns + 2 journal-append)",
      entries.length === 8, entries.length);
    if (entries.length === 8) {
      const labels = entries.map((e) =>
        e.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2, l.indexOf(":"))));
      const GUARD = [0, 1, 2, 3, 4, 5];
      const NOTE_FREE = [0, 1, 2, 3, 5];

      // FRAME — byte-uniform on every entry, both writers. Area and ticket
      // segments allow interior spaces (journal.mjs's --system-area is
      // printable-clamped free text, which keeps spaces) but never "·" —
      // printable/oneLine strip or the writers never emit it — so the
      // three-segment split below is unambiguous.
      const HEADING = /^## \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z · [^\n·]+ · [^\n·]+$/;
      const headings = entries.map((e) => e.split("\n")[0]);
      check("T-4 frame: heading `## <ISO ms Z> · <area> · <ticket|no-ticket>` on all 8",
        headings.every((h) => HEADING.test(h)), headings);
      check("T-4 frame: blank line after the heading on all 8",
        entries.every((e) => e.split("\n")[1] === ""));
      // The blank-line entry SEPARATOR is frame too: no heading may sit
      // directly under a non-blank line anywhere in the file.
      check("T-4 frame: every heading is preceded by a blank line (entry separator)",
        !/[^\n]\n## /.test(jrn));
      check("T-4 frame: `- kind:` first bullet, `- operator:` second and non-empty, on all 8",
        entries.every((e) => e.split("\n")[2].startsWith("- kind: ") && /^- operator: \S/.test(e.split("\n")[3])));
      check("T-4 frame: `- kb-snapshot:` is the last bullet on all 8",
        labels.every((ls) => ls[ls.length - 1] === "kb-snapshot"));

      // Heading↔body agreement — the emitter takes area/ticket for the
      // heading while each writer re-spells both in its own field lines;
      // nothing else compares the two halves of the same entry.
      const headParts = headings.map((h) => h.split(" · "));
      check("T-4 frame: heading area equals the body `- system-area:` on all 8",
        entries.every((e, i) => e.includes(`\n- system-area: ${headParts[i][1]}\n`)),
        headParts.map((p) => p[1]));
      check("T-4 frame: heading ticket agrees with the body ticket value on all 8",
        entries.every((e, i) => {
          const body = /^- ticket: ([^\n·]+?)(?: · plan: .*)?$/m.exec(e)?.[1].trim();
          return body && (headParts[i][2] === "no-ticket" ? body === "none" : headParts[i][2] === body);
        }), headParts.map((p) => p[2]));

      // Per-writer field lists — exact label sequences, hand-spelled from v4.
      const HOOK_SEQ = "kind,operator,action,system-area,target,command,outcome,ticket,kb-snapshot";
      const HOOK_SEQ_NOTED = "kind,operator,action,system-area,target,command,outcome,note,ticket,kb-snapshot";
      check("T-4 guard: field sequence invariant across the 5 note-free variants (incl. unknown + ticketed)",
        NOTE_FREE.every((i) => labels[i].join(",") === HOOK_SEQ),
        NOTE_FREE.map((i) => labels[i].join(",")));
      check("T-4 guard: blind finding inserts the CONDITIONAL note before the ticket line",
        labels[4].join(",") === HOOK_SEQ_NOTED, labels[4]);
      check("T-4 script: field sequence with one `assets` line per --asset",
        labels[6].join(",") === "kind,operator,plan,system-area,ticket,assets,assets,kb-snapshot" &&
          labels[7].join(",") === "kind,operator,plan,system-area,ticket,assets,kb-snapshot",
        [labels[6].join(","), labels[7].join(",")]);

      // No bullet may carry an empty or "undefined" value — the emitter's
      // options-bag boundary must never land a mis-keyed slot in the record.
      check("T-4: no empty or `undefined` bullet value on any entry",
        entries.every((e) => e.split("\n").filter((l) => l.startsWith("- "))
          .every((l) => { const v = l.slice(l.indexOf(":") + 1).trim(); return v !== "" && v !== "undefined"; })));

      // Kind literals — the v4 adjudication record, pinned at CONTRACT level.
      // DELIBERATE dual pin (A-2): journal-ops/guard-fixtures pin the
      // writers' behavior; this suite pins the same literals as contract —
      // a deliberate rename must redden both homes.
      check("T-4: guard kind is `command (guard-approved)` on all 6",
        GUARD.every((i) => entries[i].includes("- kind: command (guard-approved)")));
      check("T-4: journal-append kind is `change-plan execution` (NOT the prose nickname)",
        entries[6].includes("- kind: change-plan execution") && entries[7].includes("- kind: change-plan execution"));

      // Ticket placement — combined line hook-only; own line script-only —
      // and the marker's VALUES land in heading + combined line (guard path).
      check("T-4: guard writes the combined ticket·plan line on all 6",
        GUARD.every((i) => /^- ticket: \S+ · plan: \S+$/m.test(entries[i])));
      check("T-4: ticketed guard entry carries the marker values in heading and combined line",
        headings[5].endsWith("· CSOPS-142") &&
          entries[5].includes("- ticket: CSOPS-142 · plan: acme-prod/changes/2026-08-16-t4-plan.md"));
      check("T-4: no-ticket guard headings substitute `no-ticket`",
        [0, 1, 2, 3, 4].every((i) => headings[i].endsWith("· no-ticket")));
      check("T-4: journal-append writes ticket on its OWN line (no `· plan:`)",
        /^- ticket: CSOPS-142$/m.test(entries[6]) && /^- ticket: none$/m.test(entries[7]));
      check("T-4: script headings — key when ticketed, no-ticket substitution otherwise",
        headings[6].endsWith("· gs-rules · CSOPS-142") && headings[7].endsWith("· gs-journey · no-ticket"));

      // Variant honesty: the outcome variants must be genuinely distinct so
      // "sequence invariant across variants" asserts something. Wording
      // ownership stays with guard-fixtures (pointers in the header above).
      check("T-4: ≥3 distinct outcome lines across the guard variants",
        new Set([0, 1, 2, 3, 4].map((i) => /^- outcome: .*$/m.exec(entries[i])?.[0])).size >= 3,
        [0, 1, 2, 3, 4].map((i) => /^- outcome: .*$/m.exec(entries[i])?.[0]));
      check("T-4: unknown command journals fail-closed in the action line, area `unknown`",
        entries[1].includes("- action: not in catalog") && headings[1].includes("· unknown ·"));
      check("T-4 script: plan line carries the outcome word (executed | partially executed)",
        /^- plan: \S+ \(executed\)$/m.test(entries[6]) &&
          /^- plan: \S+ \(partially executed — see plan\)$/m.test(entries[7]));

      // Subset closure — the standing "no other fields exist" check. The
      // exact sequences above pin the SAMPLED variants; this one applies to
      // every entry generically, so a FUTURE variant added without a
      // sequence pin still fails loudly on any new bullet label.
      const T4_LABELS = new Set(["kind", "operator", "action", "system-area", "target",
        "command", "outcome", "note", "ticket", "kb-snapshot", "plan", "assets"]);
      check("T-4: no bullet label outside the v4 grammar on any entry",
        labels.every((ls) => ls.every((l) => T4_LABELS.has(l))),
        labels.flat().filter((l) => !T4_LABELS.has(l)));
    }

    // GP-B5 DS-42 (the checkJs flip): the guard's 6-way outcome union must
    // never be narrowed by the type gate (T-5, design tenet 2). Its BEHAVIOR
    // is pinned by guard-fixtures, which drives every basis through the real
    // hook and asserts each outcome sentence (failed-event, exit-code,
    // error-flag, interrupted, success-event, inferred-unverified); that suite
    // runs first in the same CI job and reds on any dropped branch, so no
    // source-text pin of the branches is needed here. What only this suite
    // pins is the DOCUMENTED union: the T-4 typedef's six labels in precedence
    // order, and the guard's "Execution outcome" precedence comment — the
    // block T-4 names as the union's referent — still enumerating exactly six
    // steps (derived from the comment's numbering, not a hand list). Pure
    // source reads, deliberately outside the journaling fixture's entry-count
    // gate above so they run on every invocation.
    const jlSrc = readFileSync(join(HERE, "..", "scripts", "journal-lib.mjs"), "utf8");
    const basisText = /@typedef \{([^}]*)\} JournalOutcomeBasis/.exec(jlSrc)?.[1] ?? "";
    const basisLabels = basisText.match(/"[a-z-]+"/g) ?? [];
    check("T-4/T-5: JournalOutcomeBasis still lists exactly the six basis labels, in precedence order (un-narrowed)",
      JSON.stringify(basisLabels) === JSON.stringify([
        '"failed-event"', '"exit-code"', '"error-flag"', '"interrupted"', '"success-event"', '"inferred-unverified"',
      ]), basisLabels);
    const guardSrc = readFileSync(HOOK, "utf8");
    const oStart = guardSrc.indexOf("// Execution outcome.");
    const oEnd = guardSrc.indexOf("const kbRef =", oStart);
    const outcomeBlock = oStart === -1 || oEnd === -1 ? "" : guardSrc.slice(oStart, oEnd);
    const steps = [...outcomeBlock.matchAll(/^\s*\/\/ {3}(\d+)\. /gm)].map((m) => Number(m[1]));
    check("T-5: the guard's outcome precedence comment still enumerates exactly steps 1-6 (the documented union, un-narrowed)",
      JSON.stringify(steps) === JSON.stringify([1, 2, 3, 4, 5, 6]), steps);
  } finally {
    removeTempDir(t4);
  }
}

if (failures) {
  console.log(`\ncontract-conformance: ${failures} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`contract-conformance: all ${passed} checks passed`);
