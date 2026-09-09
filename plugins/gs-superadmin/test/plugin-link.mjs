#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// plugin-link.mjs (test) — fixtures for scripts/plugin-link.mjs, the workspace
// plugin-link writer (GP-B5 DS-43 v2; design note §6 item 1).
//
// Every arm drives a COPY of the shipped writer placed inside a scratch
// "plugin" under the OS temp dir (<tmp>/fake-plugin/scripts/plugin-link.mjs),
// so the target it derives from its own real path is the scratch plugin — and
// so the suite can prove the target is derived from self even when
// CLAUDE_PLUGIN_ROOT in the environment points elsewhere (the
// env-must-not-decide arm). The link type is the writer's own platform branch
// (junction on win32, directory symlink elsewhere), so each CI leg proves its
// own type. Fixture links (stale, dangling) are created with the same branch.
//
// Arms (predictions written before the first run — every one PASS on the
// shipped writer on all three OS legs):
//   A1  inert outside a workspace (no .gs-superadmin/ dir; a FILE of that
//       name too): no link, exit 0, hook silent, CLI says so on stderr
//   A2  create: the link exists, is a link, resolves to the scratch plugin —
//       NOT to the directory CLAUDE_PLUGIN_ROOT names in the env — and a
//       script runs through it by the relative forward-slash path
//   A3  no-op when current: second run leaves it, hook silent, CLI "(current)"
//   A4  repoint when stale: a link hand-pointed at another directory is
//       repointed, and that directory's contents survive (the probe's P3 row:
//       the writer's removal is unlinkSync)
//   A5  repoint when dangling
//   A6  refuse a real directory: not a link → exit 1 (CLI) / exit 0 with valid
//       SessionStart hookSpecificOutput JSON (hook), and the directory AND its
//       file are untouched
//   A7  platform pin (P3c): rmSync({recursive:true}) on the link leaves the
//       target intact — the property the design's "never rmSync through a
//       link" rule rests on, measured on all three OSes before the build
//   A8  hooks.json carries the SessionStart entry in the hook-command form
//       (delete it → this arm reds: the note's mutation proof)
//   A9  check-ignore belt: inside a git work tree with no ignore entry the
//       writer REPORTS (stderr / additionalContext) and still exits 0 with the
//       link created; with `.gs-superadmin/` ignored it says nothing
//   A10 OneDrive: on win32 a workspace under %OneDrive% is named in the
//       success context; elsewhere the env var is ignored (pins the platform
//       conjunct both ways)
//   A11 mode is argv, not stdin: hook mode fed a SessionStart payload naming
//       another cwd still links process.cwd() and never blocks on stdin
//   A12 win32 only: a link whose stored target differs from the real path in
//       CASE only is "current" (the case-folded compare — lib.mjs isMainModule's
//       rule); skipped with a reason elsewhere
//
// Fixtures live under the OS temp dir (shared rig) — no real state.
//
// Run:  node plugins/gs-superadmin/test/plugin-link.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, lstatSync, realpathSync, readFileSync, mkdirSync, symlinkSync, rmSync, unlinkSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempDir, removeTempDir, writeFiles, runNode, initScratchGitRepo } from "../../../test/rig.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHIPPED = join(HERE, "..", "scripts", "plugin-link.mjs");
const HOOKS_JSON = join(HERE, "..", "hooks", "hooks.json");
const WIN = process.platform === "win32";
const LINK_TYPE = WIN ? "junction" : "dir";

let failures = 0;
function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    console.log(`      ${JSON.stringify(detail)}`);
  }
}
function skip(label, why) {
  console.log(`SKIP  ${label} — ${why}`);
}

const same = (a, b) => (WIN ? a.toLowerCase() === b.toLowerCase() : a === b);
const isLink = (p) => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};
const resolvesTo = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
};
const mkLink = (target, path) => symlinkSync(target, path, LINK_TYPE);

const ROOT = makeTempDir("plugin-link-test");
try {
  // The scratch plugin: the shipped writer copied to <plugin>/scripts/, a
  // marker file, and a hello script to run through the link.
  const PLUGIN = join(ROOT, "fake-plugin");
  mkdirSync(join(PLUGIN, "scripts"), { recursive: true });
  copyFileSync(SHIPPED, join(PLUGIN, "scripts", "plugin-link.mjs"));
  writeFiles(PLUGIN, {
    "marker.txt": "fake plugin 0.0.0\n",
    "scripts/hello.mjs": 'import { realpathSync } from "node:fs"; import { fileURLToPath } from "node:url"; process.stdout.write("hello from " + realpathSync(fileURLToPath(import.meta.url)) + "\\n");\n',
  });
  const WRITER = join(PLUGIN, "scripts", "plugin-link.mjs");
  const TARGET = realpathSync(PLUGIN);
  const ELSEWHERE = join(ROOT, "elsewhere-plugin");
  mkdirSync(join(ELSEWHERE, "scripts"), { recursive: true });

  // Environment for every arm except A10: CLAUDE_PLUGIN_ROOT deliberately
  // points at the WRONG directory (the writer must ignore it); OneDrive unset
  // so a developer machine's own OneDrive does not bleed into the notes.
  /** @type {Record<string, string | undefined>} */
  const baseEnv = { ...process.env, CLAUDE_PLUGIN_ROOT: ELSEWHERE };
  delete baseEnv.OneDrive;
  const run = (ws, args, opts = {}) => runNode(WRITER, args, { cwd: ws, env: baseEnv, ...opts });
  const hookOut = (res) => {
    try {
      return JSON.parse(res.stdout);
    } catch {
      return null;
    }
  };
  const ctx = (res) => hookOut(res)?.hookSpecificOutput?.additionalContext ?? "";
  const newWs = (name) => {
    const ws = join(ROOT, name);
    mkdirSync(join(ws, ".gs-superadmin"), { recursive: true });
    return { ws, link: join(ws, ".gs-superadmin", "plugin") };
  };

  // ── A1 inert outside a workspace ───────────────────────────────────────────
  {
    const ws = join(ROOT, "ws-none");
    mkdirSync(ws);
    const h = run(ws, ["--hook"]);
    check("A1 inert (hook): no .gs-superadmin/ → exit 0, silent, nothing created", h.status === 0 && h.stdout === "" && !existsSync(join(ws, ".gs-superadmin")), h);
    const c = run(ws, []);
    // F-395 (Gate-2 review of 0.36.1): the state is said on STDOUT — setup relays the
    // printed line and stops on a non-zero exit, so a stderr-only note under exit 0
    // read as success with nothing to relay. Exit stays 0 (tenet 7).
    check("A1 inert (CLI): exit 0, stdout says (nothing linked) and names not-a-workspace, stderr empty, nothing created",
      c.status === 0 && /^\(nothing linked\) /.test(c.stdout) && /not a gs-superadmin workspace/.test(c.stdout) && c.stderr === "" && !existsSync(join(ws, ".gs-superadmin")), c);
    const wsf = join(ROOT, "ws-file");
    mkdirSync(wsf);
    writeFileSync(join(wsf, ".gs-superadmin"), "not a dir\n");
    const f = run(wsf, ["--hook"]);
    check("A1 inert: .gs-superadmin is a FILE → still inert (exit 0, silent, file untouched)",
      f.status === 0 && f.stdout === "" && readFileSync(join(wsf, ".gs-superadmin"), "utf8") === "not a dir\n", f);
  }

  // ── A2 create (env must not decide) + A3 no-op ─────────────────────────────
  {
    const { ws, link } = newWs("ws-create");
    const c = run(ws, []);
    check("A2 create (CLI): exit 0, one stdout line naming the target and (created)",
      c.status === 0 && c.stdout.trim() === `.gs-superadmin/plugin -> ${TARGET} (created)` && c.stderr === "", c);
    check("A2 create: the link is a link and resolves to the scratch plugin", isLink(link) && same(resolvesTo(link) ?? "", TARGET), { link, resolved: resolvesTo(link), TARGET });
    check("A2 env-must-not-decide: CLAUDE_PLUGIN_ROOT in the env named another dir and was ignored",
      !same(resolvesTo(link) ?? "", realpathSync(ELSEWHERE)), { resolved: resolvesTo(link), ELSEWHERE });
    check("A2 create: marker readable through the link", readFileSync(join(link, "marker.txt"), "utf8") === "fake plugin 0.0.0\n", {});
    const hello = runNode(".gs-superadmin/plugin/scripts/hello.mjs", [], { cwd: ws, env: baseEnv });
    check("A2 create: a script runs through the link by its relative forward-slash path, import.meta.url is the real path",
      hello.status === 0 && hello.stdout.trim() === `hello from ${join(TARGET, "scripts", "hello.mjs")}`, hello);
    const h = run(ws, ["--hook"]);
    check("A3 no-op (hook): current link → exit 0, silent, still resolves", h.status === 0 && h.stdout === "" && same(resolvesTo(link) ?? "", TARGET), h);
    const c2 = run(ws, []);
    check("A3 no-op (CLI): (current)", c2.status === 0 && c2.stdout.trim() === `.gs-superadmin/plugin -> ${TARGET} (current)`, c2);
  }

  // ── A4 repoint when stale (target survives removal — P3) ───────────────────
  {
    const { ws, link } = newWs("ws-stale");
    const stale = join(ROOT, "stale-plugin-0.1.0");
    writeFiles(stale, { "old.txt": "old\n", "scripts/x.mjs": "// old\n" });
    mkLink(realpathSync(stale), link);
    check("A4 fixture: the hand-pointed link resolves to the stale dir", same(resolvesTo(link) ?? "", realpathSync(stale)), { resolved: resolvesTo(link) });
    const h = run(ws, ["--hook"]);
    check("A4 repoint stale (hook): exit 0, silent, link now resolves to the plugin",
      h.status === 0 && h.stdout === "" && isLink(link) && same(resolvesTo(link) ?? "", TARGET), h);
    check("A4 P3: the stale directory's contents survived the writer's removal (unlinkSync)",
      readFileSync(join(stale, "old.txt"), "utf8") === "old\n" && existsSync(join(stale, "scripts", "x.mjs")) && readdirSync(stale).length === 2, readdirSync(stale));
    const c = run(ws, []);
    check("A4 then (CLI): (current)", c.status === 0 && /\(current\)$/.test(c.stdout.trim()), c);
    // Stale again, CLI this time: the outcome word is (repointed).
    unlinkSync(link); // remove the fixture link itself — the same call the writer uses
    mkLink(realpathSync(stale), link);
    const c2 = run(ws, []);
    check("A4 repoint stale (CLI): (repointed), target named", c2.status === 0 && c2.stdout.trim() === `.gs-superadmin/plugin -> ${TARGET} (repointed)`, c2);
  }

  // ── A5 repoint when dangling ───────────────────────────────────────────────
  {
    const { ws, link } = newWs("ws-dangling");
    mkLink(join(ROOT, "no-such-plugin"), link);
    check("A5 fixture: the link is dangling (a link that resolves to nothing)", isLink(link) && resolvesTo(link) === null, { resolved: resolvesTo(link) });
    const c = run(ws, []);
    check("A5 repoint dangling (CLI): (repointed) and resolves", c.status === 0 && /\(repointed\)$/.test(c.stdout.trim()) && same(resolvesTo(link) ?? "", TARGET), c);
  }

  // ── A6 refuse a real directory, contents untouched ─────────────────────────
  {
    const { ws, link } = newWs("ws-realdir");
    writeFiles(link, { "keep.txt": "keep\n" });
    const c = run(ws, []);
    check("A6 refuse (CLI): exit 1, stderr names the path, 'not a link', refusing, and the setup remedy",
      c.status === 1 && c.stdout === "" && /\.gs-superadmin\/plugin exists and is not a link/.test(c.stderr) && /refusing/.test(c.stderr) && /\/gs-superadmin:setup/.test(c.stderr), c);
    check("A6 refuse (CLI): the directory and its file are untouched, and it is still not a link",
      !isLink(link) && lstatSync(link).isDirectory() && readFileSync(join(link, "keep.txt"), "utf8") === "keep\n", {});
    const h = run(ws, ["--hook"]);
    const o = hookOut(h);
    check("A6 refuse (hook): exit 0 and ONE valid SessionStart hookSpecificOutput JSON naming the refusal and the remedy",
      h.status === 0 && o !== null && o.hookSpecificOutput?.hookEventName === "SessionStart" && /refusing/.test(ctx(h)) && /\/gs-superadmin:setup/.test(ctx(h)) && h.stdout.trim().split("\n").length === 1, h);
    check("A6 refuse (hook): directory still untouched", !isLink(link) && readFileSync(join(link, "keep.txt"), "utf8") === "keep\n", {});
  }

  // ── A7 platform pin: rmSync recursive on the link leaves the target intact ─
  {
    const { link } = newWs("ws-rm");
    const victim = join(ROOT, "victim-plugin");
    writeFiles(victim, { "a.txt": "a\n", "scripts/b.mjs": "// b\n" });
    mkLink(realpathSync(victim), link);
    rmSync(link, { recursive: true, force: true });
    check("A7 P3c: rmSync({recursive:true}) on the link removed the link only — target contents intact",
      !existsSync(link) && readFileSync(join(victim, "a.txt"), "utf8") === "a\n" && existsSync(join(victim, "scripts", "b.mjs")), readdirSync(victim));
  }

  // ── A8 hooks.json carries the SessionStart entry ───────────────────────────
  {
    const hooks = JSON.parse(readFileSync(HOOKS_JSON, "utf8"));
    const entries = (hooks.hooks?.SessionStart ?? []).flatMap((e) => e.hooks ?? []);
    const want = 'node "${CLAUDE_PLUGIN_ROOT}/scripts/plugin-link.mjs" --hook';
    check("A8 hooks.json: a SessionStart command entry runs plugin-link.mjs --hook in the hook-command form",
      entries.some((h) => h.type === "command" && h.command === want), entries);
  }

  // ── A9 check-ignore belt: reports, never fails ─────────────────────────────
  {
    const ws = join(ROOT, "ws-git");
    mkdirSync(ws);
    writeFileSync(join(ws, "README.md"), "# acme workspace\n");
    initScratchGitRepo(ws);
    mkdirSync(join(ws, ".gs-superadmin"));
    const link = join(ws, ".gs-superadmin", "plugin");
    const c = run(ws, []);
    check("A9 belt (CLI, not ignored): exit 0, link created, stderr reports NOT git-ignored with the remedy",
      c.status === 0 && isLink(link) && /NOT git-ignored/.test(c.stderr) && /\.gitignore/.test(c.stderr), c);
    const h = run(ws, ["--hook"]);
    check("A9 belt (hook, not ignored): exit 0, additionalContext reports it", h.status === 0 && /NOT git-ignored/.test(ctx(h)), h);
    writeFileSync(join(ws, ".gitignore"), "# gs-superadmin KB\nacme-prod/\n.gs-superadmin/\n");
    const c2 = run(ws, []);
    check("A9 belt (CLI, ignored): silent stderr, (current)", c2.status === 0 && c2.stderr === "" && /\(current\)$/.test(c2.stdout.trim()), c2);
    const h2 = run(ws, ["--hook"]);
    check("A9 belt (hook, ignored): silent", h2.status === 0 && h2.stdout === "", h2);
  }

  // ── A10 OneDrive naming (win32 only; the env var is ignored elsewhere) ─────
  {
    const { ws } = newWs("ws-onedrive");
    const env = { ...baseEnv, OneDrive: ROOT };
    const c = run(ws, [], { env });
    const h = run(ws, ["--hook"], { env });
    if (WIN) {
      check("A10 OneDrive (win32, CLI): success line + a stderr note naming the workspace as OneDrive-rooted",
        c.status === 0 && /\(created\)$/.test(c.stdout.trim()) && /OneDrive-rooted/.test(c.stderr) && /operating model/.test(c.stderr), c);
      check("A10 OneDrive (win32, hook): exit 0 and the success context names it", h.status === 0 && /OneDrive-rooted/.test(ctx(h)), h);
      const outside = newWs("ws-not-onedrive");
      const c3 = run(outside.ws, [], { env: { ...baseEnv, OneDrive: join(ROOT, "some-other-root") } });
      check("A10 OneDrive (win32): a workspace NOT under %OneDrive% gets no note", c3.status === 0 && c3.stderr === "", c3);
      // F-395: containment has a separator boundary — a SIBLING whose name merely
      // starts with the OneDrive root's basename is not OneDrive-rooted, while a
      // workspace genuinely under the root still is.
      const odRoot = join(ROOT, "OneDrive");
      const sib = join(ROOT, "OneDriveBackup", "ws-sib");
      mkdirSync(join(sib, ".gs-superadmin"), { recursive: true });
      const c4 = run(sib, [], { env: { ...baseEnv, OneDrive: odRoot } });
      check("A10 OneDrive (win32, F-395): a sibling directory sharing the root's name prefix (OneDriveBackup) gets NO note", c4.status === 0 && c4.stderr === "" && /\(created\)$/.test(c4.stdout.trim()), c4);
      const inner = join(odRoot, "ws-inner");
      mkdirSync(join(inner, ".gs-superadmin"), { recursive: true });
      const c5 = run(inner, [], { env: { ...baseEnv, OneDrive: odRoot } });
      check("A10 OneDrive (win32, F-395): a workspace under the root (separator at the boundary) is still named", c5.status === 0 && /OneDrive-rooted/.test(c5.stderr), c5);
    } else {
      check("A10 OneDrive (non-win32): the env var is ignored — no note, hook silent", c.status === 0 && c.stderr === "" && h.status === 0 && h.stdout === "", { c, h });
    }
  }

  // ── A11 mode is argv, not stdin ────────────────────────────────────────────
  {
    const { ws, link } = newWs("ws-stdin");
    const other = join(ROOT, "ws-other-cwd");
    mkdirSync(join(other, ".gs-superadmin"), { recursive: true });
    const payload = JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: other, session_id: "acme-0001" });
    const h = run(ws, ["--hook"], { input: payload });
    check("A11 hook mode with a payload on stdin naming another cwd: links process.cwd(), not the payload's cwd, and does not hang",
      h.status === 0 && h.stdout === "" && isLink(link) && !existsSync(join(other, ".gs-superadmin", "plugin")), h);
    const c = run(newWs("ws-stdin-cli").ws, [], { input: payload });
    check("A11 CLI mode (no --hook) with hook JSON on stdin is still CLI mode: stdout is the target line, not JSON",
      c.status === 0 && /^\.gs-superadmin\/plugin -> /.test(c.stdout) && hookOut(c) === null, c);
  }

  // ── A12 win32 case-fold no-op ──────────────────────────────────────────────
  {
    if (WIN) {
      const { ws, link } = newWs("ws-case");
      mkLink(TARGET.toUpperCase(), link);
      const c = run(ws, []);
      check("A12 win32: a link whose stored target differs from the real path in case only is (current), not repointed",
        c.status === 0 && /\(current\)$/.test(c.stdout.trim()), c);
    } else {
      skip("A12 win32 case-fold no-op", "case-sensitive filesystem semantics on this leg (the compare is exact here by design)");
    }
  }
  // ── A13–A16 scaffold vintage courtesy (bus F-396) ─────────────────────────
  // A second fake plugin carries scaffold.mjs + doc-lib.mjs beside the writer
  // and a templates/ tree, so the hook's spawn resolves the scratch script.
  //   A13 behind: an edited copy whose template moved → the hook names the count
  //   A14 current: everything scaffolded and unmoved → hook silent (as A3)
  //   A15 broken scaffold script → hook exit 0, link made, one sentence names it
  //   A16 legacy: a copy with no pristine record → "predate template tracking"
  {
    const PLUGIN2 = join(ROOT, "fake-plugin-2");
    mkdirSync(join(PLUGIN2, "scripts"), { recursive: true });
    copyFileSync(SHIPPED, join(PLUGIN2, "scripts", "plugin-link.mjs"));
    copyFileSync(join(HERE, "..", "scripts", "scaffold.mjs"), join(PLUGIN2, "scripts", "scaffold.mjs"));
    copyFileSync(join(HERE, "..", "scripts", "doc-lib.mjs"), join(PLUGIN2, "scripts", "doc-lib.mjs"));
    writeFiles(PLUGIN2, { "templates/operating-model.md": "# OM v1\n", "templates/CONVENTIONS.md": "# Conventions\n" });
    const WRITER2 = join(PLUGIN2, "scripts", "plugin-link.mjs");
    const SCAFFOLD2 = join(PLUGIN2, "scripts", "scaffold.mjs");
    const run2 = (ws, args) => runNode(WRITER2, args, { cwd: ws, env: baseEnv });
    const scaffold2 = (ws, args) => runNode(SCAFFOLD2, args, { cwd: ws, env: baseEnv });

    // A14 first (clean state), then A13 by moving the template under an edit.
    const { ws } = newWs("ws-scaffold");
    const s = scaffold2(ws, ["apply"]);
    check("A14 setup: scaffold apply copies the two templates (fixture sanity)", s.status === 0 && existsSync(join(ws, ".gs-superadmin", "operating-model.md")), s.stderr);
    const cur = run2(ws, ["--hook"]);
    check("A14 current: everything scaffolded and unmoved → hook silent, exit 0", cur.status === 0 && cur.stdout === "", cur);
    writeFileSync(join(ws, ".gs-superadmin", "operating-model.md"), "# OM v1\n\n- my edit\n", "utf8");
    writeFileSync(join(PLUGIN2, "templates", "operating-model.md"), "# OM v2\n", "utf8");
    const beh = run2(ws, ["--hook"]);
    check("A13 behind: an edited copy whose template moved → exit 0, additionalContext names 1 file behind and points at setup",
      beh.status === 0 && /1 scaffolded file\(s\) are behind the plugin's templates/.test(ctx(beh)) && /gs-superadmin:setup/.test(ctx(beh)), beh);
    check("A13 behind: the hook wrote nothing — no .new, the edited copy untouched (the spawn is check, read-only)",
      !existsSync(join(ws, ".gs-superadmin", "operating-model.md.new")) && readFileSync(join(ws, ".gs-superadmin", "operating-model.md"), "utf8") === "# OM v1\n\n- my edit\n", null);

    // A16 legacy: a workspace with the file but no scaffold/ record.
    const { ws: wsL } = newWs("ws-legacy");
    writeFileSync(join(wsL, ".gs-superadmin", "operating-model.md"), "# something older\n", "utf8");
    const leg = run2(wsL, ["--hook"]);
    check("A16 legacy: a copy with no pristine record → additionalContext says it predates template tracking, once-per-session courtesy",
      leg.status === 0 && /1 scaffolded file\(s\) predate template tracking/.test(ctx(leg)), leg);

    // A17 composition (bus F-401). A13–A16 each hold exactly ONE condition and assert by
    // substring, so none of them can see how sentences JOIN: with a bare-space join the
    // line reads as one run-on and every one of those substring matches still passes.
    // This arm holds TWO conditions at once and asserts on the WHOLE additionalContext —
    // each note must come back as a complete element, so the boundary is pinned for any
    // note added to this joiner later, not just for the pair that happened to expose it.
    const { ws: wsC } = newWs("ws-compose");
    writeFileSync(join(wsC, ".gs-superadmin", "operating-model.md"), "# older om\n", "utf8");
    writeFileSync(join(wsC, ".gs-superadmin", "CONVENTIONS.md"), "# older conv\n", "utf8");
    const ap = scaffold2(wsC, ["apply"]);
    check("A17 setup: two legacy copies differing from their templates are offered, leaving a .new beside each (fixture sanity)",
      ap.status === 0 && existsSync(join(wsC, ".gs-superadmin", "operating-model.md.new")) && existsSync(join(wsC, ".gs-superadmin", "CONVENTIONS.md.new")), ap.stderr);
    const comp = run2(wsC, ["--hook"]);
    const parts = ctx(comp).replace(/^gs-superadmin plugin link: /, "").split(" · ");
    check("A17 composition: two live conditions → two notes, each recovered WHOLE from the joined line (a bare-space join collapses this to one)",
      comp.status === 0 && parts.length === 2 &&
        /^2 scaffolded file\(s\) predate template tracking/.test(parts[0]) &&
        /^2 \.new template\(s\) await reconciliation/.test(parts[1]), comp);

    // A15 broken scaffold script: fail-open.
    writeFileSync(SCAFFOLD2, "this is not javascript (\n", "utf8");
    const { ws: wsB, link: linkB } = newWs("ws-broken-scaffold");
    const brk = run2(wsB, ["--hook"]);
    check("A15 broken scaffold.mjs: hook still exits 0, the link is created, and one sentence names the unreadable vintage",
      brk.status === 0 && isLink(linkB) && /scaffold vintage could not be read/.test(ctx(brk)) && /gs-superadmin:setup/.test(ctx(brk)), brk);
  }

} finally {
  removeTempDir(ROOT);
}

console.log(failures === 0 ? "\nAll plugin-link fixtures passed." : `\n${failures} plugin-link fixture(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
