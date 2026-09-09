#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// plugin-link.mjs — the workspace plugin link writer (GP-B5 DS-43 v2).
//
// Maintains ONE directory link, `.gs-superadmin/plugin` → the loaded plugin's
// root, so every skill fence addresses bundled scripts as
// `node .gs-superadmin/plugin/scripts/<x>.mjs …` — a relative forward-slash
// path every tool shell resolves — instead of through the `CLAUDE_PLUGIN_ROOT`
// placeholder only the plugin loader substitutes (the F-163/F-166/F-175/F-185
// surviving-literal family; DS-43 note §2). Two callers, one job (A-10):
//
//   hook  : hooks/hooks.json SessionStart — every plugin session that starts in
//           a workspace repoints the link to the plugin the loader actually
//           loaded (the plugin cache is versioned per directory and old
//           versions persist, so a link written once would run OLD scripts
//           after an upgrade — measured, note §0 item 3). Never blocks a
//           session (tenet 2).
//   CLI   : setup's first-run fence, run right after `.gs-superadmin/` is
//           created — the one placeholder fence left in any skill.
//
// MODE IS DECIDED BY ARGV, PINNED: `--hook` selects hook mode; anything else is
// CLI mode. Hook mode reads NOTHING from stdin (the SessionStart payload is
// not consulted — cwd is the workspace, measured note §0 item 6) and never
// blocks on it.
//
// Chain of custody (note §3): the target is `realpath(dirname(dirname(self)))`
// — this file's OWN real path, two levels up. Never `process.env.
// CLAUDE_PLUGIN_ROOT`, never a recorded path, never anything read from the
// workspace: the loader invoked this script by the path it substituted, and
// that is the whole evidence of which plugin is loaded. (test/plugin-link.mjs
// pins it with CLAUDE_PLUGIN_ROOT pointed elsewhere in the environment.)
//
// Inert outside a workspace (tenet 7): no `./.gs-superadmin/` DIRECTORY in cwd
// → no filesystem effect, exit 0 — hook mode silent, CLI mode says so on
// stderr (setup's transcript must not read a no-op as a link).
//
// Reconcile (note §2.2):
//   absent                                → create
//   lstat is a link, realpath === target  → no-op            (case-folded on
//                                           win32: lib.mjs isMainModule's rule)
//   lstat is a link, differs or dangling  → unlinkSync, then create
//   exists and is NOT a link              → REFUSE, never delete, report
//                                           (a real directory there is a
//                                           user's, or a git checkout's)
// `unlinkSync` is the ONLY removal call, ever: measured — `rmdirSync` on a
// POSIX symlink is ENOTDIR, and `rmSync({recursive:true})` must never be
// pointed at a link on principle (note §0 item 7). The link type is the ONE
// platform branch: an NTFS junction on win32 (no elevation, no Developer
// Mode), a directory symlink elsewhere.
//
// Failure direction (tenet 2): hook mode exits 0 ALWAYS and reports through
// one `hookSpecificOutput.additionalContext` line naming the failure and the
// remedy ("run /gs-superadmin:setup"); CLI mode prints the same text on
// stderr and exits non-zero so setup stops. Success: hook silent (unless a
// belt or the OneDrive note below has something to say), CLI one stdout line
// naming the target so setup's transcript shows which plugin the workspace is
// linked to. The script ends through process.exitCode — never process.exit
// after a stdout write (the F-360 class; check 19's stdout-then-exit row).
//
// Belt (note §3, git-shared workspace): inside a git work tree,
// `git check-ignore -q .gs-superadmin/plugin` not exiting 0 is REPORTED
// (setup §6 writes the ignore entry; on Windows git would otherwise track the
// junction's CONTENTS as files — measured) — never fatal.
//
// OneDrive (note E7): on win32, a workspace under %OneDrive% gets one
// sentence in the success context naming it as OneDrive-rooted and pointing
// at the operating model's link bullet — the junction was measured to work
// with the sync engine running over a 45-second window; longer-window
// behaviour is the declared residual.
//
// Zero dependencies — Node built-ins ONLY (build/check-imports.mjs
// RESTRICTED, mode "builtins", id DS-43): this runs at every session start,
// and a local import would widen the syntax-failure surface.
// ─────────────────────────────────────────────────────────────────────────────
import { lstatSync, realpathSync, symlinkSync, unlinkSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HOOK_MODE = process.argv.slice(2).includes("--hook");
const WORKSPACE_DIR = ".gs-superadmin";
const LINK_REL = ".gs-superadmin/plugin";
const REMEDY = "fenced plugin commands will fail with ENOENT there until /gs-superadmin:setup succeeds in this workspace";

/** @param {string} a @param {string} b */
function samePath(a, b) {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** @param {unknown} e */
function errCode(e) {
  return e instanceof Error ? /** @type {NodeJS.ErrnoException} */ (e).code : undefined;
}

/** @param {unknown} e */
function errText(e) {
  const code = errCode(e);
  return e instanceof Error ? `${code ? code + ": " : ""}${e.message}` : String(e);
}

/**
 * Report one outcome and end the process. Hook mode: exit 0 always; anything
 * to say goes out as ONE SessionStart hookSpecificOutput JSON. CLI mode: the
 * target line on stdout, notes on stderr, failure text on stderr + exit 1.
 * @param {{ ok: boolean, line?: string, notes: string[], failure?: string }} r
 */
function conclude(r) {
  const said = [...(r.failure ? [r.failure] : []), ...r.notes];
  if (HOOK_MODE) {
    if (said.length) {
      process.stdout.write(
        JSON.stringify({
          // The boundary is conclude()'s to own, not each note's (bus F-401): notes carry
          // no terminal punctuation, so a bare space ran two of them into one sentence
          // ("… be offered the rest 3 scaffolded file(s) predate …"). Owning it here means
          // every note added later inherits the boundary instead of re-learning this.
          hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `gs-superadmin plugin link: ${said.join(" · ")}` },
        }) + "\n",
      );
    }
    process.exitCode = 0;
    return;
  }
  if (r.line) process.stdout.write(r.line + "\n");
  for (const n of r.notes) process.stderr.write(`plugin-link.mjs: ${n}\n`);
  if (r.failure) process.stderr.write(`plugin-link.mjs: ${r.failure}\n`);
  process.exitCode = r.ok ? 0 : 1;
}

function main() {
  const cwd = process.cwd();
  /** @type {string[]} */
  const notes = [];

  // Inert outside a workspace (tenet 7).
  let wsIsDir = false;
  try {
    wsIsDir = statSync(join(cwd, WORKSPACE_DIR)).isDirectory();
  } catch {
    wsIsDir = false;
  }
  if (!wsIsDir) {
    // CLI mode says so on STDOUT (Gate-2 review of 0.36.1, F-395): setup's
    // fence relays the printed line and stops on a non-zero exit, so a
    // stderr-only note under exit 0 read as success with nothing to relay
    // when the directory step had not run. Exit stays 0 — tenet 7, the
    // script is inert outside a workspace — but the line names the state.
    return conclude({
      ok: true,
      line: HOOK_MODE ? undefined : `(nothing linked) no ${WORKSPACE_DIR}/ directory in ${cwd} — not a gs-superadmin workspace; create it first, then re-run`,
      notes: [],
    });
  }

  // Target: this file's own real path, two levels up. The realpath is the
  // resolver's own (not a CLI-entry test), and one resolve is enough: every
  // prefix of a canonical path is canonical, so dirname(dirname(...)) of the
  // real path needs no second pass (F-395).
  const selfPath = fileURLToPath(import.meta.url);
  const target = dirname(dirname(realpathSync(selfPath)));
  const link = join(cwd, WORKSPACE_DIR, "plugin");

  /** @type {"created" | "repointed" | "current"} */
  let outcome;
  let st = null;
  try {
    st = lstatSync(link);
  } catch (e) {
    if (errCode(e) !== "ENOENT") {
      return conclude({ ok: false, notes, failure: `could not inspect ${LINK_REL} (${errText(e)}); ${REMEDY}` });
    }
  }
  if (st !== null && !st.isSymbolicLink()) {
    return conclude({
      ok: false,
      notes,
      failure:
        `${LINK_REL} exists and is not a link (a real ${st.isDirectory() ? "directory" : "file"}) — refusing to touch it; ` +
        `move or remove it yourself, then run /gs-superadmin:setup to create the link`,
    });
  }
  if (st === null) {
    outcome = "created";
  } else {
    let current = null;
    try {
      current = realpathSync(link);
    } catch {
      current = null; // dangling
    }
    if (current !== null && samePath(current, target)) {
      outcome = "current";
    } else {
      try {
        unlinkSync(link);
      } catch (e) {
        return conclude({ ok: false, notes, failure: `could not remove the stale link at ${LINK_REL} (${errText(e)}); ${REMEDY}` });
      }
      outcome = "repointed";
    }
  }
  if (outcome !== "current") {
    try {
      symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    } catch (e) {
      return conclude({ ok: false, notes, failure: `plugin link could not be created at ${LINK_REL} → ${target} (${errText(e)}); ${REMEDY}` });
    }
  }

  // Belt: the link must be git-ignored wherever the workspace is a git work
  // tree (setup §6 writes the entry). Reported, never fatal.
  const inTree = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd, encoding: "utf8" });
  if (!inTree.error && inTree.status === 0 && inTree.stdout.trim() === "true") {
    const ign = spawnSync("git", ["check-ignore", "-q", LINK_REL], { cwd, encoding: "utf8" });
    if (ign.error || ign.status !== 0) {
      notes.push(
        ign.error || ign.status !== 1
          ? `could not verify that ${LINK_REL} is git-ignored (git check-ignore ${ign.error ? errText(ign.error) : `exited ${ign.status}`}) — make sure the workspace .gitignore lists ${WORKSPACE_DIR}/`
          : `${LINK_REL} is NOT git-ignored in this work tree — add ${WORKSPACE_DIR}/ to the workspace .gitignore (re-running /gs-superadmin:setup writes it), or git will track the plugin's contents through the link`,
      );
    }
  }

  // OneDrive (E7): name it so the user knows; the long-window behaviour is
  // the declared residual.
  const od = process.platform === "win32" ? process.env.OneDrive : undefined;
  // Containment, not a bare prefix (F-395): cwd IS the OneDrive root or sits
  // under it with a separator at the boundary — a sibling whose name merely
  // starts with the root's basename (OneDriveBackup) is not OneDrive-rooted.
  const odR = od ? resolve(od) : null;
  const cwdR = resolve(cwd);
  const underOneDrive =
    odR !== null &&
    (samePath(cwdR, odR) || (cwdR.length > odR.length && samePath(cwdR.slice(0, odR.length), odR) && (cwdR[odR.length] === sep || cwdR[odR.length] === "/")));
  if (underOneDrive) {
    notes.push(
      `this workspace is OneDrive-rooted (${od}); the link is a junction the sync engine was measured to leave alone over a short window — ` +
        `see the operating model's plugin-link bullet if fenced commands ever fail through it`,
    );
  }

  // Scaffold vintage (bus F-396): one courtesy sentence per session start when
  // scaffolded files are behind the plugin's templates, predate tracking, or
  // have a `.new` waiting. Read-only, and a SPAWN of scripts/scaffold.mjs
  // (`check --json`) — never an import: this file is builtins-only (RESTRICTED
  // DS-43), so a broken scaffold script degrades to one sentence, not a failed
  // session start. Only counts travel; setup owns every write. Hook mode only —
  // setup's first-run fence runs the scaffold step itself right after this. A
  // plugin build without the script (a fixture plugin) says nothing.
  if (HOOK_MODE) {
    const scaffoldScript = join(dirname(realpathSync(selfPath)), "scaffold.mjs");
    let hasScaffold = false;
    try {
      hasScaffold = statSync(scaffoldScript).isFile();
    } catch {
      hasScaffold = false;
    }
    if (hasScaffold) {
      const sc = spawnSync(process.execPath, [scaffoldScript, "check", "--json"], { cwd, encoding: "utf8", timeout: 15000 });
      /** @type {{behind?: number, untracked?: number, pendingNew?: number} | null} */
      let counts = null;
      if (!sc.error && sc.status === 0) {
        try {
          counts = JSON.parse(sc.stdout).counts ?? null;
        } catch {
          counts = null;
        }
      }
      if (counts === null) {
        notes.push(`scaffold vintage could not be read (scaffold.mjs check ${sc.error ? errText(sc.error) : `exited ${sc.status}`}) — run /gs-superadmin:setup, which reports the cause`);
      } else {
        if ((counts.behind ?? 0) > 0) notes.push(`${counts.behind} scaffolded file(s) are behind the plugin's templates — run /gs-superadmin:setup to refresh the unedited ones and be offered the rest`);
        if ((counts.untracked ?? 0) > 0) notes.push(`${counts.untracked} scaffolded file(s) predate template tracking — run /gs-superadmin:setup once to record them`);
        if ((counts.pendingNew ?? 0) > 0) notes.push(`${counts.pendingNew} .new template(s) await reconciliation under ${WORKSPACE_DIR}/ — see the operating model's scaffold bullet`);
      }
    }
  }

  return conclude({ ok: true, line: `${LINK_REL} -> ${target} (${outcome})`, notes });
}

try {
  main();
} catch (e) {
  conclude({ ok: false, notes: [], failure: `unexpected error (${errText(e)}); ${REMEDY}` });
}
