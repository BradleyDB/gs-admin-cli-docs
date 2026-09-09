#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// journal-ops.mjs — fixture tests for scripts/journal.mjs
//
// The change-request skill's execution steps delegate the attribution marker
// and the plan-completion journal entry (kind `change-plan execution`) to
// these verbs instead of transcribing
// SKILL.md fences, so what is checked here is exactly what a real executing
// session produces: marker shape and freshness, argument validation (bad
// ticket / missing plan / unknown slug fail loudly), entry format, and — the
// integration that motivates the whole design — the guard hook honoring a
// change-start marker. Builds throwaway workspaces under the OS temp dir;
// never touches real state.
//
// Run:  node plugins/gs-superadmin/test/journal-ops.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, existsSync, symlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "scripts", "journal.mjs");
const HOOK = join(HERE, "..", "hooks", "gs-admin-guard.mjs");
const ROOT = join(tmpdir(), `gs-superadmin-journal-ops-${process.pid}`);

const PLAN = "acme-prod/changes/2026-07-02-enterprise-nps-risk-cta.md";

function makeWorkspace(name, slugs = ["acme-prod"]) {
  const dir = join(ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, ".gs-superadmin"), { recursive: true });
  for (const slug of slugs) {
    mkdirSync(join(dir, slug, "changes"), { recursive: true });
    writeFileSync(join(dir, slug, "_manifest.json"), JSON.stringify({
      slug, baseUrl: "https://acme.gainsightcloud.com", environment: "production", inventory: {},
    }));
  }
  writeFileSync(join(dir, PLAN.replace("acme-prod", slugs[0])), "# plan\n");
  return dir;
}

function run(cwd, ...args) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf8" });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch { /* non-JSON output = failure path */ }
  return { code: res.status, json, err: res.stderr.trim(), out: res.stdout.trim() };
}

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
}

// ── change-start ─────────────────────────────────────────────────────────────
let ws = makeWorkspace("start");
const markerOf = (d) => join(d, ".gs-superadmin", "active-change.json");

let r = run(ws, "change-start", "--ticket", "CSOPS-142", "--plan", PLAN, "--slug", "acme-prod");
check("change-start: ok", r.code === 0 && r.json?.ok === true, r);
let marker = JSON.parse(readFileSync(markerOf(ws), "utf8"));
check("change-start: marker has ticket/plan/slug", marker.ticket === "CSOPS-142" && marker.plan === PLAN && marker.slug === "acme-prod", marker);
const age = Date.now() - Date.parse(marker.started_at);
check("change-start: started_at is fresh ISO-8601", Number.isFinite(age) && age >= 0 && age < 60_000, marker.started_at);
check("change-start: reports replaced false on first write", r.json.replaced === false, r.json);

// Re-run replaces the marker (a new execution supersedes a leftover one)
r = run(ws, "change-start", "--ticket", "none", "--plan", PLAN, "--slug", "acme-prod");
marker = JSON.parse(readFileSync(markerOf(ws), "utf8"));
check("change-start: re-run replaces marker (replaced true, ticket none)", r.json?.replaced === true && marker.ticket === "none", { r, marker });

// Slug given in the wrong case is normalized to the on-disk casing
r = run(ws, "change-start", "--ticket", "CSOPS-142", "--plan", PLAN, "--slug", "Acme-PROD");
marker = JSON.parse(readFileSync(markerOf(ws), "utf8"));
check("change-start: slug case-normalized to on-disk name", r.code === 0 && marker.slug === "acme-prod", { r, marker });

// Validation failures — each must exit 1 with a pointed stderr message
r = run(ws, "change-start", "--ticket", "csops-142", "--plan", PLAN, "--slug", "acme-prod");
check("change-start: malformed ticket rejected", r.code === 1 && /Jira key/.test(r.err), r);
r = run(ws, "change-start", "--ticket", "CSOPS-142", "--plan", "acme-prod/changes/2099-01-01-nope.md", "--slug", "acme-prod");
check("change-start: missing plan file rejected (never re-derive the date)", r.code === 1 && /not found/.test(r.err) && /never re-derive/.test(r.err), r);
r = run(ws, "change-start", "--ticket", "CSOPS-142", "--plan", "acme-prod/2026-07-02-x.md", "--slug", "acme-prod");
check("change-start: plan outside <slug>/changes/ rejected", r.code === 1 && /changes\//.test(r.err), r);
// ".." segments would pass the slug/changes checks and then join() would
// resolve them OUTSIDE changes/ — must be rejected outright.
writeFileSync(join(ws, "acme-prod", "escaped.md"), "# not a plan\n");
r = run(ws, "change-start", "--ticket", "CSOPS-142", "--plan", "acme-prod/changes/../escaped.md", "--slug", "acme-prod");
check("change-start: '..' traversal in plan path rejected", r.code === 1 && /path segments/.test(r.err), r);
r = run(ws, "change-start", "--ticket", "CSOPS-142", "--plan", "acme-prod/changes//x.md", "--slug", "acme-prod");
check("change-start: empty plan path segment rejected", r.code === 1 && /path segments/.test(r.err), r);
r = run(ws, "change-start", "--ticket", "CSOPS-142", "--plan", PLAN, "--slug", "other-tenant");
check("change-start: unknown slug rejected, known slugs listed", r.code === 1 && /Known slugs: acme-prod/.test(r.err), r);
check("change-start: failed runs left the last good marker in place", JSON.parse(readFileSync(markerOf(ws), "utf8")).ticket === "CSOPS-142", null);
// F-205: a valued flag as the last token has lost its value — refused loudly,
// never silently defaulted (--workspace's fallback is a CWD-derived workspace,
// so the old silent path sent the marker and journal somewhere else at exit 0).
r = run(ws, "change-start", "--ticket", "none", "--plan", PLAN, "--slug", "acme-prod", "--workspace");
check("change-start: trailing bare --workspace refused (F-205)", r.code === 1 && /--workspace requires a value/.test(r.err), r);
r = run(ws, "change-start", "--ticket", "none", "--plan", PLAN, "--slug", "acme-prod", "--slug");
check("change-start: duplicated flag with bare trailing repeat refused (F-205)", r.code === 1 && /--slug requires a value/.test(r.err), r);

// Outside any workspace
const bare = join(ROOT, "bare");
mkdirSync(bare, { recursive: true });
r = run(bare, "change-start", "--ticket", "CSOPS-142", "--plan", PLAN, "--slug", "acme-prod");
check("change-start: no workspace → setup hint", r.code === 1 && /gs-superadmin:setup/.test(r.err), r);

// ── change-end ───────────────────────────────────────────────────────────────
r = run(ws, "change-end");
check("change-end: deletes the marker", r.code === 0 && r.json?.existed === true && !existsSync(markerOf(ws)), r);
r = run(ws, "change-end");
check("change-end: idempotent when no marker exists", r.code === 0 && r.json?.existed === false, r);

// ── wave-2 portability: changes-segment casing, junction tenants, clamps ─────
{
  // F-122: a `Changes/` spelling over on-disk changes/ is accepted on the
  // case-folding filesystems, and the RECORDED path is canonicalized — the
  // marker must never carry the typed casing.
  const ws2 = makeWorkspace("portability");
  let r2 = run(ws2, "change-start", "--ticket", "CSOPS-142", "--plan", PLAN.replace("changes/", "Changes/"), "--slug", "acme-prod");
  const m2 = JSON.parse(readFileSync(markerOf(ws2), "utf8"));
  check("change-start: Changes/ casing accepted, marker records canonical changes/ (F-122)", r2.code === 0 && m2.plan === PLAN, { code: r2.code, plan: m2.plan });
  // existsSync stays authoritative: casing tolerance must not resurrect a
  // missing file
  r2 = run(ws2, "change-start", "--ticket", "CSOPS-142", "--plan", "acme-prod/Changes/2099-01-01-nope.md", "--slug", "acme-prod");
  check("change-start: Changes/ casing with a missing file still fails loudly", r2.code === 1 && /not found/.test(r2.err), r2);
}
{
  // F-155: the fold's ambiguity guard — only OBSERVABLE on a case-SENSITIVE
  // fs, where changes/ and Changes/ can coexist as distinct dirs and a typed
  // Changes/ spelling would otherwise validate-and-record the changes/ file.
  // Detected, never assumed (the F-137 lesson): create the sibling and let
  // readdir say whether this fs kept it distinct; the skip branch is taken
  // only on that positive detection, not on a swallowed error.
  const ws3 = makeWorkspace("ambiguity");
  mkdirSync(join(ws3, "acme-prod", "Changes"), { recursive: true });
  const entries = readdirSync(join(ws3, "acme-prod"));
  if (entries.includes("changes") && entries.includes("Changes")) {
    writeFileSync(join(ws3, "acme-prod", "Changes", PLAN.split("/").pop()), "# decoy plan\n");
    const r3 = run(ws3, "change-start", "--ticket", "CSOPS-142", "--plan", PLAN.replace("changes/", "Changes/"), "--slug", "acme-prod");
    check("change-start: Changes/ beside changes/ fails loudly as ambiguous (F-155)", r3.code === 1 && /ambiguous/.test(r3.err), r3);
  } else {
    check("change-start: ambiguity guard (F-155) [case-folding fs — both spellings are one dir, guard unreachable here by construction]", true, null);
  }
}
{
  // F-207: case-variant TENANT dirs — the same F-155 ambiguity class one level
  // up. resolveSlug's case-insensitive fallback must refuse a --slug matching
  // two distinct dirs (it used to take the first readdir match), and validPlan
  // must refuse a --plan whose slug segment names the case-variant SIBLING (it
  // used to fold and silently rewrite it into the resolved slug's changes/).
  // Only observable where both spellings persist as distinct entries: enabled
  // per-directory on Windows via fsutil where available, natural on Linux —
  // then DETECTED like the F-155 fixture, never assumed.
  const ws4 = join(ROOT, "slug-ambiguity");
  rmSync(ws4, { recursive: true, force: true });
  mkdirSync(ws4, { recursive: true });
  if (process.platform === "win32") {
    // Best-effort: fails without the WSL optional component; detection below decides.
    spawnSync("fsutil.exe", ["file", "setCaseSensitiveInfo", ws4, "enable"], { encoding: "utf8" });
  }
  mkdirSync(join(ws4, ".gs-superadmin"), { recursive: true });
  for (const slug of ["acme-prod", "Acme-Prod"]) {
    mkdirSync(join(ws4, slug, "changes"), { recursive: true });
    writeFileSync(join(ws4, slug, "_manifest.json"), JSON.stringify({ slug, inventory: {} }));
  }
  writeFileSync(join(ws4, "acme-prod", "changes", "2026-07-02-x.md"), "# plan\n");
  writeFileSync(join(ws4, "Acme-Prod", "changes", "2026-07-02-x.md"), "# decoy plan\n");
  const entries4 = readdirSync(ws4);
  if (entries4.includes("acme-prod") && entries4.includes("Acme-Prod")) {
    // The assertions pin WHICH guard fired (--slug vs --plan segment): the two
    // F-207 guards overlap on the word "ambiguous", and a mutant that removes
    // one can be masked by the other firing downstream.
    let r4 = run(ws4, "change-start", "--ticket", "none", "--plan", "acme-prod/changes/2026-07-02-x.md", "--slug", "ACME-PROD");
    check("change-start: ambiguous --slug across case-variant tenants refused (F-207)", r4.code === 1 && /--slug "ACME-PROD" is ambiguous/.test(r4.err), r4);
    r4 = run(ws4, "change-start", "--ticket", "none", "--plan", "Acme-Prod/changes/2026-07-02-x.md", "--slug", "acme-prod");
    check("change-start: --plan naming a case-variant sibling tenant refused (F-207)", r4.code === 1 && /--plan path segment "Acme-Prod" is ambiguous/.test(r4.err), r4);
    r4 = run(ws4, "change-start", "--ticket", "none", "--plan", "acme-prod/changes/2026-07-02-x.md", "--slug", "acme-prod");
    check("change-start: exact slug + exact plan still resolve beside a case-variant sibling (F-207 control)", r4.code === 0 && r4.json?.slug === "acme-prod", r4);
  } else {
    check("change-start: case-variant tenant ambiguity guards (F-207) [case-folding fs — variants collapse, guard unreachable here by construction]", true, null);
  }
}
{
  // F-134: a tenant dir reached through a junction/symlink must resolve —
  // dirent.isDirectory() is false for reparse points. "junction" works
  // unprivileged on Windows and is ignored (plain symlink) on POSIX.
  const wsJ = join(ROOT, "junction-ws");
  rmSync(wsJ, { recursive: true, force: true });
  mkdirSync(join(wsJ, ".gs-superadmin"), { recursive: true });
  const real = join(ROOT, "junction-real-tenant");
  rmSync(real, { recursive: true, force: true });
  mkdirSync(join(real, "changes"), { recursive: true });
  writeFileSync(join(real, "_manifest.json"), JSON.stringify({ slug: "acme-prod", inventory: {} }));
  writeFileSync(join(real, "changes", "2026-07-02-x.md"), "# plan\n");
  let linked = true;
  // F-137: only errors that mean "this environment cannot create links" may
  // downgrade to the skipped-PASS branch; anything else is a coding error.
  try { symlinkSync(real, join(wsJ, "acme-prod"), "junction"); }
  catch (e) { if (["EPERM", "EACCES", "ENOSYS"].includes(e?.code)) linked = false; else throw e; }
  if (linked) {
    const rj = run(wsJ, "change-start", "--ticket", "none", "--plan", "acme-prod/changes/2026-07-02-x.md", "--slug", "acme-prod");
    check("change-start: junction/symlink tenant dir resolves (F-134)", rj.code === 0 && rj.json?.slug === "acme-prod", rj);
  } else {
    check("change-start: junction/symlink tenant dir resolves (F-134) [link creation unavailable here — skipped]", true, null);
  }
}
{
  // F-132 contract, unit level: the shared journal-lib oneLine keeps
  // non-ASCII letters (accented operator names survive their own attribution
  // line), strips control/bidi format chars, and caps without splitting a
  // surrogate pair. printable() is unchanged — it stays the clamp for
  // manifest-derived values. Codepoints built via fromCharCode so this test
  // file never carries invisible literals (the F-130 rule).
  const { oneLine, printable, composeJournalEntry, journalHeader } = await import(pathToFileURL(join(HERE, "..", "scripts", "journal-lib.mjs")).href);
  const jose = "Jos" + String.fromCharCode(0xe9);
  const bidi = String.fromCharCode(0x202e);
  const esc = String.fromCharCode(0x1b);
  const emoji = String.fromCharCode(0xd83d, 0xde00);
  check("journal-lib oneLine: keeps accented operator (F-132)", oneLine(jose, 80) === jose, JSON.stringify(oneLine(jose, 80)));
  check("journal-lib oneLine: strips bidi + control chars", oneLine("a" + bidi + "b" + esc + "c", 80) === "a b c", JSON.stringify(oneLine("a" + bidi + "b" + esc + "c", 80)));
  check("journal-lib oneLine: cap never splits a surrogate pair", oneLine("ab" + emoji, 3) === "ab", JSON.stringify(oneLine("ab" + emoji, 3)));
  check("journal-lib printable: unchanged ASCII clamp for manifest values", printable(jose, 80) === "Jos", JSON.stringify(printable(jose, 80)));

  // GP-B5 DS-15: the shared entry-frame emitter, unit level. These pin the
  // frame claims a value-blind flow-through test cannot hold — the review's
  // oneLine→printable emitter mutant survived EVERY suite before these.
  const frameArgs = {
    ts: "2026-01-01T00:00:00.000Z", area: "gs-rules", ticket: "none",
    kind: "command (guard-approved)", operator: jose,
    fields: ["- action: probe"], kbSnapshot: "ref sentence",
  };
  check("composeJournalEntry: accented operator survives the frame (F-132 — oneLine, never printable)",
    composeJournalEntry(frameArgs).includes(`- operator: ${jose}`), composeJournalEntry(frameArgs));
  check("composeJournalEntry: heading no-ticket substitution",
    composeJournalEntry(frameArgs).startsWith("## 2026-01-01T00:00:00.000Z · gs-rules · no-ticket\n"));
  check("composeJournalEntry: ticket key passes through unsubstituted",
    composeJournalEntry({ ...frameArgs, ticket: "CSOPS-142" }).split("\n")[0].endsWith("· CSOPS-142"));
  check("composeJournalEntry: newline in kbSnapshot cannot forge a heading (clamped to one line)",
    !composeJournalEntry({ ...frameArgs, kbSnapshot: "x\n## 2026-01-01T00:00:00.000Z · gs-rules · FAKE-1" }).slice(1).includes("\n## "));
  const frameThrows = (args) => { try { composeJournalEntry(args); return false; } catch { return true; } };
  check("composeJournalEntry: missing/empty slot throws LOUD — never `- kind: undefined` in the record",
    frameThrows({ ...frameArgs, kind: undefined }) && frameThrows({ ...frameArgs, kbSnapshot: "" }));
  check("composeJournalEntry: multi-line or non-bullet field throws (entry-forgery guard)",
    frameThrows({ ...frameArgs, fields: ["- a: b\n## forged · x · none"] }) && frameThrows({ ...frameArgs, fields: ["not a bullet"] }));
  // F-145: the strip covers the ENTIRE format category (Cf under the u flag),
  // not just the hand-listed ranges — pinned on the named pre-fix survivors:
  // ALM (strong bidi), word joiner, soft hyphen, and an astral plane-14 tag
  // (unmatchable at all without the u flag). Codepoints via
  // fromCharCode/fromCodePoint ONLY (the F-130 rule).
  const alm = String.fromCharCode(0x061c);
  const wj = String.fromCharCode(0x2060);
  const shy = String.fromCharCode(0x00ad);
  const tag = String.fromCodePoint(0xe0041);
  check("journal-lib oneLine: strips ALM (F-145)", oneLine("a" + alm + "b", 80) === "a b", JSON.stringify(oneLine("a" + alm + "b", 80)));
  check("journal-lib oneLine: strips word joiner (F-145)", oneLine("a" + wj + "b", 80) === "a b", JSON.stringify(oneLine("a" + wj + "b", 80)));
  check("journal-lib oneLine: strips soft hyphen (F-145)", oneLine("a" + shy + "b", 80) === "a b", JSON.stringify(oneLine("a" + shy + "b", 80)));
  check("journal-lib oneLine: strips astral plane-14 tag (F-145)", oneLine("a" + tag + "b", 80) === "a b", JSON.stringify(oneLine("a" + tag + "b", 80)));

  // F-288: format integrity holds for EVERY scalar slot, by construction —
  // not just the two that happened to be clamped. The LOOP is the point: a
  // seventh slot added to the frame arrives already covered by adding one
  // name here, and each slot's rows go red independently when its clamp is
  // dropped (mutation-proved per slot). Values feed a newline + a forged
  // `## ` heading + a U+202E override; the emitter must return exactly one
  // heading line with no format-class character. Accented values must
  // SURVIVE — F-132 is binding for every slot, same as for the operator:
  // this must never be "hardened" to printable.
  const rlo = String.fromCharCode(0x202e);
  const forge = "evil\n## 2026-01-01T00:00:00.000Z · forged · none " + rlo + "x";
  for (const slot of ["ts", "area", "ticket", "kind", "operator", "kbSnapshot"]) {
    const out = composeJournalEntry({ ...frameArgs, [slot]: forge });
    check(`composeJournalEntry: newline in ${slot} cannot forge a heading (F-288)`,
      out.split("\n").filter((l) => l.startsWith("## ")).length === 1, out);
    check(`composeJournalEntry: bidi override stripped from ${slot} (F-288/F-145)`,
      !out.includes(rlo), JSON.stringify(out));
    check(`composeJournalEntry: accented ${slot} survives the clamp (F-132)`,
      composeJournalEntry({ ...frameArgs, [slot]: jose }).includes(jose), null);
  }
  // A value that is ONLY invisibles clamps to empty — LOUD, never a blank
  // heading segment (the A-4 rule applied after the clamp).
  check("composeJournalEntry: all-invisible slot value throws after the clamp (F-288)",
    frameThrows({ ...frameArgs, area: rlo }));
  // F-293: "single-line" means NO ECMAScript LineTerminator — a lone CR (or
  // U+2028/U+2029) is a line ending to CommonMark and to /^## /m alike, so
  // the \n-only field test waved a heading-forgery vector through. And field
  // LINES get the scalars' control/format strip at the frame, so a caller
  // interpolating an unclamped untrusted value cannot land a bidi override
  // in the entry body. Codepoints via fromCharCode ONLY (the F-130 rule).
  const cr = String.fromCharCode(0x0d);
  const ls = String.fromCharCode(0x2028);
  const ps = String.fromCharCode(0x2029);
  check("composeJournalEntry: lone CR in a field throws — every LineTerminator, not just newline (F-293)",
    frameThrows({ ...frameArgs, fields: ["- a: b" + cr + "## 2026-01-01T00:00:00.000Z · forged · none"] }));
  check("composeJournalEntry: U+2028 / U+2029 in a field throw (F-293)",
    frameThrows({ ...frameArgs, fields: ["- a: b" + ls + "x"] }) &&
    frameThrows({ ...frameArgs, fields: ["- a: b" + ps + "x"] }));
  check("composeJournalEntry: bidi override stripped from field lines at the frame (F-293/F-145)",
    !composeJournalEntry({ ...frameArgs, fields: ["- action: jour" + rlo + "ney"] }).includes(rlo), null);
  // The header slug is the same untrusted directory name; the sibling emitter
  // in the same file gets the same treatment.
  const hostileHeader = journalHeader("ten" + rlo + "ant\n## forged · x · none");
  check("journalHeader: newline in slug cannot start a new line in the header (F-288)",
    !/^## /m.test(hostileHeader) && hostileHeader.startsWith("# Change journal — ten ant ## forged · x · none\n"), JSON.stringify(hostileHeader.split("\n")[0]));
  check("journalHeader: bidi override stripped from slug (F-288/F-145)",
    !hostileHeader.includes(rlo), null);
  check("journalHeader: accented slug survives (F-132)",
    journalHeader(jose + "-prod").startsWith(`# Change journal — ${jose}-prod\n`), null);
  check("journalHeader: null slug still reads unattributed",
    journalHeader(null).startsWith("# Change journal — unattributed\n"), null);
}

// ── journal-append ───────────────────────────────────────────────────────────
ws = makeWorkspace("append");
const journalPath = join(ws, "acme-prod", "changes", "JOURNAL.md");

r = run(ws, "journal-append",
  "--slug", "acme-prod", "--plan", PLAN, "--ticket", "CSOPS-142",
  "--system-area", "gs-rules", "--outcome", "executed",
  "--asset", "CREATE CTA|DRIVE|CSM Enterprise NPS Below 6 Risk Alert (1I00ABC) — acme-prod/rules-engine/r1.md",
  "--asset", "MODIFY Scorecard|Enterprise (1I00DEF) — KB doc pending next /gs-superadmin:refresh");
check("journal-append: ok, created true on first entry", r.code === 0 && r.json?.created === true, r);
let jrn = readFileSync(journalPath, "utf8");
check("journal-append: file created with the tenant header", jrn.startsWith("# Change journal — acme-prod\n\nAppend-only record"), jrn.slice(0, 80));
check("journal-append: heading is ISO ts · area · ticket", /## \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z · gs-rules · CSOPS-142/.test(jrn), jrn);
check("journal-append: kind change-plan execution", jrn.includes("- kind: change-plan execution"), jrn);
check("journal-append: operator computed, non-empty", /- operator: \S+/.test(jrn), jrn);
check("journal-append: plan line carries executed outcome", jrn.includes(`- plan: ${PLAN} (executed)`), jrn);
check("journal-append: ticket line", jrn.includes("- ticket: CSOPS-142"), jrn);
check("journal-append: one assets line per --asset", (jrn.match(/- assets: /g) ?? []).length === 2, jrn);
check("journal-append: asset line survives verbatim (pipes, em dash)", jrn.includes("- assets: CREATE CTA|DRIVE|CSM Enterprise NPS Below 6 Risk Alert (1I00ABC) — acme-prod/rules-engine/r1.md"), jrn);
check("journal-append: fixed kb-snapshot line", jrn.includes("- kb-snapshot: pre-change state cited in the plan's Impact analysis (KB paths + last_verified dates there)"), jrn);

// Second entry appends without duplicating the header; partial outcome wording
r = run(ws, "journal-append",
  "--slug", "acme-prod", "--plan", PLAN, "--ticket", "none",
  "--system-area", "gs-journey", "--outcome", "partial", "--asset", "none");
jrn = readFileSync(journalPath, "utf8");
check("journal-append: second entry appends, created false", r.json?.created === false && (jrn.match(/- kind: change-plan execution/g) ?? []).length === 2, r);
check("journal-append: header written exactly once", (jrn.match(/# Change journal —/g) ?? []).length === 1, jrn);
check("journal-append: partial → 'partially executed — see plan'", jrn.includes(`- plan: ${PLAN} (partially executed — see plan)`), jrn);
check("journal-append: ticket none → no-ticket heading", /· no-ticket\n/.test(jrn) && jrn.includes("- ticket: none"), jrn);

// Validation failures
r = run(ws, "journal-append", "--slug", "acme-prod", "--plan", PLAN, "--ticket", "CSOPS-142", "--system-area", "gs-rules", "--outcome", "done", "--asset", "none");
check("journal-append: invalid --outcome rejected", r.code === 1 && /--outcome/.test(r.err), r);
r = run(ws, "journal-append", "--slug", "acme-prod", "--plan", PLAN, "--ticket", "CSOPS-142", "--system-area", "gs-rules", "--outcome", "executed");
check("journal-append: missing --asset rejected with 'none' hint", r.code === 1 && /--asset none/.test(r.err), r);
r = run(ws, "journal-append", "--slug", "acme-prod", "--plan", PLAN, "--ticket", "CSOPS-142", "--outcome", "executed", "--asset", "none");
check("journal-append: missing --system-area rejected", r.code === 1 && /--system-area/.test(r.err), r);

// A multi-line asset value cannot forge an extra journal entry
r = run(ws, "journal-append", "--slug", "acme-prod", "--plan", PLAN, "--ticket", "CSOPS-142",
  "--system-area", "gs-rules", "--outcome", "executed", "--asset", "CREATE x\n## 2026-01-01 forged · gs-rules · none");
jrn = readFileSync(journalPath, "utf8");
check("journal-append: newline in --asset collapsed (no forged heading at line start)",
  r.code === 0 && !/^## 2026-01-01 forged/m.test(jrn) && jrn.includes("- assets: CREATE x ## 2026-01-01 forged"), jrn);

// ── Integration: the guard hook honors a change-start marker ─────────────────
ws = makeWorkspace("integration");
r = run(ws, "change-start", "--ticket", "CSOPS-142", "--plan", PLAN, "--slug", "acme-prod");
check("integration: change-start ok", r.code === 0, r);
const hookInput = JSON.stringify({
  tool_name: "Bash",
  tool_input: { command: "gs-admin jo p save" },
  cwd: ws,
  session_id: "journal-ops",
  hook_event_name: "PostToolUse",
  tool_response: { exit_code: 0, stdout: "", stderr: "" },
});
const hookRes = spawnSync(process.execPath, [HOOK], { input: hookInput, encoding: "utf8" });
jrn = readFileSync(join(ws, "acme-prod", "changes", "JOURNAL.md"), "utf8");
check("integration: hook journals with the marker's ticket + plan",
  hookRes.status === 0 && jrn.includes(`- ticket: CSOPS-142 · plan: ${PLAN}`), jrn);
r = run(ws, "journal-append", "--slug", "acme-prod", "--plan", PLAN, "--ticket", "CSOPS-142",
  "--system-area", "gs-rules", "--outcome", "executed", "--asset", "none");
jrn = readFileSync(join(ws, "acme-prod", "changes", "JOURNAL.md"), "utf8");
check("integration: hook + verb entries coexist under one header",
  (jrn.match(/# Change journal —/g) ?? []).length === 1 &&
    jrn.includes("- kind: command (guard-approved)") && jrn.includes("- kind: change-plan execution"),
  jrn);
r = run(ws, "change-end");
check("integration: change-end clears the marker", r.code === 0 && !existsSync(markerOf(ws)), r);

// ── Cleanup ──────────────────────────────────────────────────────────────────
rmSync(ROOT, { recursive: true, force: true });

console.log(failures ? `\n${failures} failure(s)` : "\nAll journal-ops fixture checks passed");
process.exit(failures ? 1 : 0);
