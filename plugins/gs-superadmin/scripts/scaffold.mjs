#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scaffold.mjs — the workspace scaffold writer (bus F-396).
//
// Setup used to copy the user-editable templates (the operating model, the
// conventions file, an adopted build-standards pack) ONCE — "copy only if the
// destination does not exist" — and never look at them again, so a workspace
// scaffolded before a template changed kept the old prose forever (F-396: the
// pre-0.36 operating model still taught placeholder substitution after DS-43
// retired it). The CLI lane never had that problem: setup regenerates the
// catalog from the installed CLI on every run and §8 reports version skew.
// This script gives the plugin's own scaffolded prose the same courtesy —
// offer the upgrade, never force it — and is the ONE writer of the record that
// makes the offer decidable (A-10).
//
// The mapping: every file under <plugin>/templates/ ↔ .gs-superadmin/<same
// relative path>. The `conventions/` subtree (the §2 pack) is in scope only
// once adopted (`.gs-superadmin/conventions/` exists, or `--adopt-pack`).
//
// The record: `.gs-superadmin/scaffold/<same relative path>` holds the PRISTINE
// bytes of the template as the user last saw or decided it — the dpkg
// "conffile" model. No manifest field (a manifest is per-slug; these files are
// per-workspace) and no hand-maintained version marker (a marker is a claim
// someone forgets to bump; bytes are the fact). Three hashes decide everything:
// B = the bundled template, P = the pristine copy, W = the workspace file.
//
//   W absent, P absent            fresh        apply: W=B, P=B
//   W absent, P present           removed      nothing — the user removed it, that is a decision
//   W present, P absent, W==B     adoptable    apply: P=B (a legacy workspace, unmodified)
//   W present, P absent, W!=B     untracked    apply: offer (legacy; cannot know whether it was edited)
//   P present, B==P               current      nothing (however edited W is)
//   P present, B!=P, W==P         refreshable  apply: W=B, P=B (unedited copy, template moved)
//   P present, B!=P, W!=P         offer        apply: write W.new=B, list it — NEVER overwrite an edited file
//
// An offer is answered once, by verb: `accept <rel>` (W=B, P=B, .new removed),
// `keep <rel>` (P=B, .new removed — the user keeps their edits), `defer <rel>`
// (P=B, .new stays for a hand merge). All three advance P to B, so the same
// template version is never asked about twice — P is the ask-once marker.
//
// Hashes are computed over doc-lib's normalizeText (BOM stripped, CRLF folded):
// an editor's line-ending flip is not an edit; anything else is. Bytes WRITTEN
// are the template's, verbatim.
//
// `check` is read-only and is what the SessionStart hook (scripts/plugin-link.mjs)
// spawns for its one-sentence courtesy — a spawn, not an import: that script is
// builtins-only by declaration (check-imports RESTRICTED, DS-43), and a spawn
// degrades to one sentence if this file ever breaks. Only counts travel; every
// write happens here, from setup's fences.
//
// Inert direction: no `.gs-superadmin/` directory in cwd is a setup-order error
// for every verb — fail loudly (setup's Phase 2 creates the directory first).
// The templates come from THIS file's own location (Node resolves the main
// module's real path through the workspace link, so this is the plugin root) (…/scripts/../templates),
// never from the environment (plugin-link's chain-of-custody rule).
//
// Zero dependencies — Node built-ins plus doc-lib (the plugin-scripts lane).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCliHelpers, normalizeText, writeFileAtomicSync, removeFileSync } from "./doc-lib.mjs";

const SELF = basename(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const { fail, finish } = makeCliHelpers(SELF, argv);

const WORKSPACE_DIR = ".gs-superadmin";
const SCAFFOLD_DIR = "scaffold";
const PACK_DIR = "conventions";
const NEW_SUFFIX = ".new";
const VERBS = new Set(["check", "apply", "accept", "keep", "defer"]);
const DECISIONS = new Set(["accept", "keep", "defer"]);

const verb = argv[0];
if (!verb || !VERBS.has(verb)) {
  fail(`usage: ${SELF} check [--json] | apply [--adopt-pack] | accept|keep|defer <template-relative-path>`);
}

/** @param {string} p */
const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};
/** @param {string} p */
const isFile = (p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};
/** @param {Buffer} buf */
const hashOf = (buf) => createHash("sha256").update(normalizeText(buf.toString("utf8"))).digest("hex");

const cwd = process.cwd();
const wsDir = join(cwd, WORKSPACE_DIR);
if (!isDir(wsDir)) {
  fail(`no ${WORKSPACE_DIR}/ directory in ${cwd} — not a gs-superadmin workspace; setup's Phase 2 creates it before this step runs`);
}
const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(dirname(here), "templates");
if (!isDir(templatesDir)) {
  fail(`no templates/ directory beside this plugin's scripts/ (${templatesDir}) — the plugin install is incomplete`);
}

/**
 * Every template as a forward-slash path relative to templates/ (sorted, so
 * the summary is stable across platforms).
 * @param {string} dir
 * @param {string} prefix
 * @returns {string[]}
 */
function listTemplates(dir, prefix) {
  /** @type {string[]} */
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${d.name}` : d.name;
    if (d.isDirectory()) out.push(...listTemplates(join(dir, d.name), rel));
    else if (d.isFile()) out.push(rel);
  }
  return out.sort();
}

const adoptPack = verb === "apply" && argv.includes("--adopt-pack");
const packInScope = adoptPack || isDir(join(wsDir, PACK_DIR));
const allTemplates = listTemplates(templatesDir, "");
const inScope = allTemplates.filter((rel) => packInScope || !rel.startsWith(`${PACK_DIR}/`));

/**
 * @typedef {"fresh"|"removed"|"adoptable"|"untracked"|"current"|"refreshable"|"offer"} ScaffoldState
 * @typedef {{rel: string, state: ScaffoldState, file: string, newFile: string, pendingNew: boolean,
 *            bundled: Buffer, wsPath: string, pristinePath: string, newPath: string}} Classified
 */

/**
 * @param {string} rel
 * @returns {Classified}
 */
function classify(rel) {
  const bundled = readFileSync(join(templatesDir, rel));
  const wsPath = join(wsDir, rel);
  const pristinePath = join(wsDir, SCAFFOLD_DIR, rel);
  const newPath = wsPath + NEW_SUFFIX;
  const hB = hashOf(bundled);
  const hasW = isFile(wsPath);
  const hasP = isFile(pristinePath);
  /** @type {ScaffoldState} */
  let state;
  if (!hasW && !hasP) state = "fresh";
  else if (!hasW) state = "removed";
  else if (!hasP) state = hashOf(readFileSync(wsPath)) === hB ? "adoptable" : "untracked";
  else {
    const hP = hashOf(readFileSync(pristinePath));
    if (hP === hB) state = "current";
    else state = hashOf(readFileSync(wsPath)) === hP ? "refreshable" : "offer";
  }
  return {
    rel,
    state,
    file: `${WORKSPACE_DIR}/${rel}`,
    newFile: `${WORKSPACE_DIR}/${rel}${NEW_SUFFIX}`,
    pendingNew: isFile(newPath),
    bundled,
    wsPath,
    pristinePath,
    newPath,
  };
}

/** Write the `.new` copy only when absent or different (idempotent re-runs). @param {Classified} c */
function writeNew(c) {
  if (c.pendingNew && Buffer.compare(readFileSync(c.newPath), c.bundled) === 0) return;
  writeFileAtomicSync(c.newPath, c.bundled);
}

/** @param {Classified[]} rows @param {Record<string, string>} actions */
function summary(rows, actions) {
  const count = (/** @type {ScaffoldState} */ s) => rows.filter((r) => r.state === s).length;
  const counted = (/** @type {string} */ a) => Object.values(actions).filter((x) => x === a).length;
  const offers = rows
    .filter((r) => r.state === "offer" || r.state === "untracked")
    .map((r) => ({
      rel: r.rel,
      file: r.file,
      newFile: r.newFile,
      why: r.state === "offer" ? "the copy has local edits and the template moved" : "the copy predates template tracking and differs from the template",
    }));
  return {
    ok: true,
    script: SELF,
    verb,
    workspace: WORKSPACE_DIR,
    templatesFrom: templatesDir,
    packInScope,
    files: rows.map((r) => ({ rel: r.rel, state: r.state, action: actions[r.rel] ?? null, pendingNew: r.pendingNew })),
    counts: {
      inScope: rows.length,
      fresh: count("fresh"),
      adoptable: count("adoptable"),
      untracked: count("untracked"),
      current: count("current"),
      refreshable: count("refreshable"),
      offer: count("offer"),
      removed: count("removed"),
      // The two the hook's courtesy reads (plugin-link.mjs): behind = the
      // template moved under a tracked copy; pendingNew = a .new is waiting.
      behind: count("refreshable") + count("offer"),
      pendingNew: rows.filter((r) => r.pendingNew).length,
      copied: counted("copied"),
      adopted: counted("adopted"),
      refreshed: counted("refreshed"),
      offered: counted("offered"),
    },
    offers,
    next: offers.length
      ? `for each offer ask ONCE — replace (accept), keep yours (keep), or reconcile later (defer) — then run: node ${WORKSPACE_DIR}/plugin/scripts/${SELF} <accept|keep|defer> <rel>`
      : null,
  };
}

if (DECISIONS.has(verb)) {
  const rel = argv[1];
  if (!rel || rel.startsWith("-")) fail(`${verb} needs the offer's template-relative path (its \`rel\` in the apply summary), e.g. ${verb} operating-model.md`);
  const posix = rel.replace(/\\/g, "/");
  if (!inScope.includes(posix)) {
    fail(
      `${verb}: "${posix}" is not a scaffolded template in scope (${inScope.join(", ")})` +
        (allTemplates.includes(posix) ? ` — the ${PACK_DIR}/ pack is not adopted in this workspace` : ""),
    );
  }
  const c = classify(posix);
  // F-404 (Gate 2 for 0.36.2): a decision verb honours the state table like
  // apply does — a file the user removed stays removed; accept/defer used to
  // re-create it (and defer left a .new the session-start line reported
  // forever). Refuse loudly; the user's remedy is apply on a fresh workspace.
  if (c.state === "removed") {
    fail(`${verb}: "${posix}" is removed (you deleted the workspace copy; its pristine record is kept) — a removed file stays removed, so there is nothing to ${verb}; delete .gs-superadmin/scaffold/${posix} too if you want apply to copy it again`);
  }
  if (verb === "accept") {
    // F-403: the conventions-pack decline used to be recorded as an HTML
    // comment INSIDE the workspace CONVENTIONS.md — a file this writer owns —
    // and accept overwrote it, so setup re-asked. The decline now lives in the
    // standalone marker `.gs-superadmin/conventions-pack-declined` (the §5
    // allow-rules-declined pattern); a legacy in-file marker is migrated to it
    // here, before the overwrite, so an accept never loses an answer.
    if (isFile(c.wsPath) && /<!-- gs-superadmin: conventions-pack declined -->/.test(readFileSync(c.wsPath, "utf8"))) {
      const marker = join(wsDir, "conventions-pack-declined");
      if (!isFile(marker)) writeFileAtomicSync(marker, "");
    }
    writeFileAtomicSync(c.wsPath, c.bundled);
    writeFileAtomicSync(c.pristinePath, c.bundled);
    if (c.pendingNew) removeFileSync(c.newPath);
  } else if (verb === "keep") {
    writeFileAtomicSync(c.pristinePath, c.bundled);
    if (c.pendingNew) removeFileSync(c.newPath);
  } else {
    // defer: the answer is recorded (no re-ask for this template version); the
    // .new stays — written now if the offer never got one — for a hand merge.
    writeFileAtomicSync(c.pristinePath, c.bundled);
    if (!isFile(c.wsPath)) writeFileAtomicSync(c.wsPath, c.bundled);
    writeNew(c);
  }
  const after = classify(posix);
  await finish({
    ...summary([after], { [posix]: verb === "accept" ? "replaced" : verb === "keep" ? "kept" : "deferred" }),
    decided: { rel: posix, verb, stateAfter: after.state, pendingNew: after.pendingNew },
  });
}

const rows = inScope.map(classify);
/** @type {Record<string, string>} */
const actions = {};
if (verb === "apply") {
  if (adoptPack) mkdirSync(join(wsDir, PACK_DIR), { recursive: true });
  for (const c of rows) {
    if (c.state === "fresh") {
      writeFileAtomicSync(c.wsPath, c.bundled);
      writeFileAtomicSync(c.pristinePath, c.bundled);
      actions[c.rel] = "copied";
    } else if (c.state === "adoptable") {
      writeFileAtomicSync(c.pristinePath, c.bundled);
      actions[c.rel] = "adopted";
    } else if (c.state === "refreshable") {
      writeFileAtomicSync(c.wsPath, c.bundled);
      writeFileAtomicSync(c.pristinePath, c.bundled);
      actions[c.rel] = "refreshed";
    } else if (c.state === "offer" || c.state === "untracked") {
      writeNew(c);
      actions[c.rel] = "offered";
    }
  }
}
// Re-classify after writes so the summary reports the tree as it now IS
// (fresh → current, adoptable → current, refreshable → current; offers keep
// their state, now with pendingNew true). `check` performed no writes, so its
// rows are unchanged — read-only by construction.
await finish(summary(verb === "apply" ? inScope.map(classify) : rows, actions));
