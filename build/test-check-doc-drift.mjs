#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// test-check-doc-drift.mjs — fixture suite for build/check-doc-drift.mjs
// (GP-B5 DS-18: at 1,286 lines the drift checker was the largest untested
// build file — its 14 checks guarded the tree while nothing guarded THEM, so a
// regression in any check demotes it to decoration silently, which is the
// F-258 class the checker polices in others).
//
// Method (test-check-instance-data precedent, scaled up): copy the WORKING-TREE
// version of every tracked file into a scratch git repo under the OS temp dir —
// the checker roots itself at its own script location and scans that repo's
// `git ls-files` — prove the baseline GREEN, then apply one mutation per case
// and prove the checker goes RED with the check's own message. Mutations are
// applied to the SCRATCH copies with in-memory snapshot/restore (A-11
// discipline); the real tree is never touched. Because every mutant here is a
// committed assertion that the checker FAILS on the defect it claims to catch,
// this suite is the checker's standing mutation battery.
//
// The full-tree copy is deliberate: check 8 sweeps every tracked file and
// check 5/9/12 enumerate real directories, so a synthetic mini-tree would need
// to counterfeit the whole repo surface and would rot with it. Copying the
// real tree keeps the baseline case exactly "the tree we ship is green".
//
// Run:  node build/test-check-doc-drift.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
// The registry engine, imported statically for the definition-site pin (19k):
// the rig's copy is byte-identical, and check-imports refuses a non-literal
// dynamic specifier (the F-267/lexer contract).
import { sweepDefectClasses } from "./defect-classes.mjs";
import { ROOT } from "./lib.mjs";
import { execFileSync } from "node:child_process";
import {
  makeTempDir, removeTempDir, copyTrackedTree, initScratchGitRepo, gitAddAll, runNode, snapshotFiles, writeFiles,
} from "../test/rig.mjs";


let failures = 0;
let passed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; return; }
  failures++;
  console.log(`FAIL  ${label}`);
  if (detail !== undefined) console.log(`      ${typeof detail === "string" ? detail.slice(0, 600) : JSON.stringify(detail)}`);
}

const rig = makeTempDir("doc-drift-test");
try {
  copyTrackedTree(ROOT, rig);
  initScratchGitRepo(rig);
  const CHECKER = join(rig, "build", "check-doc-drift.mjs");
  const run = () => runNode(CHECKER, [], { cwd: rig });
  const at = (rel) => join(rig, rel);
  // A string-replace mutation that silently no-ops turns its case into a false
  // alarm on a healthy checker (the anchor rotted, not the gate) — so an
  // unchanged file is a hard error at the point of rot (B2 review, altitude).
  const mutate = (rel, fn) => {
    const before = readFileSync(at(rel), "utf8");
    const after = fn(before);
    if (after === before) throw new Error(`mutation anchor stale: ${rel} — the mutant did not apply`);
    writeFileSync(at(rel), after);
  };

  // ── baseline: the tree we ship is green ────────────────────────────────────
  const base = run();
  check("baseline: working tree passes the checker", base.status === 0, base.stderr || base.stdout);
  check("baseline: pass line reports its coverage", /Doc-drift check passed/.test(base.stdout), base.stdout);

  // Pick a real user skill + a labeled catalog row to mutate against, so the
  // cases survive tree evolution instead of hardcoding today's skill list.
  const PLUGIN_README = "plugins/gs-superadmin/README.md";
  const skills = readdirSync(at("plugins/gs-superadmin/skills"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(at(`plugins/gs-superadmin/skills/${d.name}/SKILL.md`)))
    .map((d) => d.name);
  const userSkill = skills.find((s) => s !== "dev-canary");
  if (!userSkill) {
    // Every later case depends on this; falling through would crash mid-suite
    // on an undefined path and mask the summary (B2 review, finder A).
    console.log("FAIL  rig sanity: no user skill found to mutate against");
    console.log(`      ${JSON.stringify(skills)}`);
    process.exit(1);
  }

  // ── checks 1+2: a skill reference must resolve both ways ───────────────────
  {
    const snap = snapshotFiles([at(PLUGIN_README), at("README.md")]);
    try {
      const bogus = new RegExp(`/gs-superadmin:${userSkill}\\b`, "g");
      mutate(PLUGIN_README, (s) => s.replace(bogus, `/gs-superadmin:${userSkill}-zzz`));
      mutate("README.md", (s) => s.replace(bogus, `/gs-superadmin:${userSkill}-zzz`));
      const res = run();
      // Match check 1's OWN wording, per README arm — `skill "<name>"` alone is
      // a substring of check 3's collateral failure, which let a deleted
      // check 1 pass this case (B2 review, finder C — mutation-proved).
      check("check 1: unmentioned skill goes red in the plugin README arm",
        res.status === 1 && res.stderr.includes(`${PLUGIN_README}: skill "${userSkill}" exists but is never mentioned`), res.stderr);
      check("check 1: unmentioned skill goes red in the root README arm",
        res.stderr.includes(`README.md: skill "${userSkill}" exists but is never mentioned`), res.stderr);
      check("check 2: reference to a nonexistent skill goes red", res.stderr.includes(`-zzz`) && /does not exist/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // ── check 3: invocation label contradicting frontmatter ────────────────────
  {
    const snap = snapshotFiles([at(PLUGIN_README)]);
    try {
      // Flip the FIRST labeled catalog row, whichever label it carries.
      mutate(PLUGIN_README, (s) =>
        s.split("\n").map((line) => {
          if (!line.trimStart().startsWith("|") || !/\/gs-superadmin:[a-z0-9-]+/.test(line)) return line;
          if (line.includes("slash + natural language")) return line.replace("slash + natural language", "slash only");
          if (line.includes("slash only")) return line.replace("slash only", "slash + natural language");
          return line;
        }).join("\n"));
      const res = run();
      check("check 3: flipped invocation labels go red", res.status === 1 && /invocation label/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // One helper for every add-a-probe-file case: write + stage, run the body,
  // then delete + re-stage in a finally — the hand-rolled repetitions had
  // already drifted on whether the deletion was staged, which lets one case's
  // probe bleed into the next (B2 review, simplification).
  const withScratchFiles = (files, fn) => {
    writeFiles(rig, files);
    gitAddAll(rig);
    try {
      return fn();
    } finally {
      for (const rel of Object.keys(files)) rmSync(at(rel), { force: true });
      gitAddAll(rig);
    }
  };

  // ── check 17: a .mjs under a dev-only strip path goes red (W8.5 review) ────
  // Both strip paths, each named in the message; the probe names are unique
  // to this arm so no other check's collateral can satisfy the assertion.
  {
    withScratchFiles({ "dev/zzz-stripprobe.mjs": "// fixture probe (scratch rig only)\n" }, () => {
      const res = run();
      check("check 17: a .mjs under dev/ goes red, naming the strip-path rule",
        res.status === 1 && /dev\/zzz-stripprobe\.mjs: a \.mjs under a dev-only strip path/.test(res.stderr), res.stderr);
    });
    withScratchFiles({ "plugins/gs-superadmin/skills/dev-canary/zzz-canaryprobe.mjs": "// fixture probe (scratch rig only)\n" }, () => {
      const res = run();
      check("check 17: a .mjs under the dev-canary skill goes red, naming the strip-path rule",
        res.status === 1 && /dev-canary\/zzz-canaryprobe\.mjs: a \.mjs under a dev-only strip path/.test(res.stderr), res.stderr);
    });
  }

  // ── check 18: shipped plugin content naming a dev-only strip path goes red (W9 review) ──
  // A shipped skill reference pointing at dev/VALIDATION.md, and a shipped
  // script comment naming the canary skill; a /dev/null spelling stays green.
  {
    withScratchFiles({ "plugins/gs-superadmin/skills/setup/references/zzz-refprobe.md": "See the arm in dev/VALIDATION.md for the procedure.\n" }, () => {
      const res = run();
      check("check 18: a shipped skill reference naming dev/VALIDATION.md goes red at its line, naming the strip-path rule",
        res.status === 1 && /zzz-refprobe\.md:1: shipped plugin content names a dev-only strip path \(dev\/VALIDATION\.md\)/.test(res.stderr), res.stderr);
    });
    withScratchFiles({ "plugins/gs-superadmin/scripts/zzz-canaryref.txt": "token lives in skills/dev-canary/SKILL.md\n" }, () => {
      const res = run();
      check("check 18: shipped content naming the dev-canary skill goes red",
        res.status === 1 && /zzz-canaryref\.txt:1: shipped plugin content names a dev-only strip path \(skills\/dev-canary\)/.test(res.stderr), res.stderr);
    });
    withScratchFiles({ "plugins/gs-superadmin/scripts/zzz-devnull.txt": "redirect to /dev/null is fine; so is the dev branch\n" }, () => {
      const res = run();
      check("check 18 (control): /dev/null and the phrase 'dev branch' in shipped content stay green",
        res.status === 0 && !/zzz-devnull/.test(res.stderr), res.stderr);
    });
  }

  // ── check 5: runner enumeration vs the AGENTS.md battery fence ─────────────
  // Probe names are pairwise non-substrings (zzz-buildprobe / zzz-pluginprobe /
  // zzz-scriptprobe / zzz-rigprobe) so no case's assertion can be satisfied by
  // another case's collateral (B2 review, efficiency finder).
  {
    withScratchFiles({ "build/test-zzz-buildprobe.mjs": "// fixture probe (scratch rig only)\n" }, () => {
      const res = run();
      check("check 5: unlisted build/test-*.mjs runner goes red",
        res.status === 1 && res.stderr.includes("test-zzz-buildprobe.mjs"), res.stderr);
    });
    withScratchFiles({ "plugins/gs-superadmin/test/zzz-pluginprobe.mjs": "// fixture probe (scratch rig only)\n" }, () => {
      const res = run();
      check("check 5: unlisted plugin test runner goes red",
        res.status === 1 && res.stderr.includes("zzz-pluginprobe.mjs"), res.stderr);
    });
    // A battery line commented out stops counting as listed (F-200).
    const snap = snapshotFiles([at("AGENTS.md")]);
    try {
      mutate("AGENTS.md", (s) => s.replace("\nnode build/test-wiki-html.mjs", "\n# node build/test-wiki-html.mjs"));
      const res = run();
      check("check 5: a commented-out battery line no longer counts (F-200)",
        res.status === 1 && res.stderr.includes("test-wiki-html.mjs"), res.stderr);
    } finally { snap.restore(); }
  }

  // ── check 5b: the repo-root test/ dir stays rig-only (B5 W1) ───────────────
  {
    withScratchFiles({ "test/zzz-rigprobe.mjs": "// fixture probe (scratch rig only)\n" }, () => {
      const res = run();
      check("check 5b: a suite parked in the root test/ dir goes red",
        res.status === 1 && res.stderr.includes("test/zzz-rigprobe.mjs") && /rig lane/.test(res.stderr), res.stderr);
    });
  }

  // ── check 7: version bump without a CHANGELOG entry ────────────────────────
  {
    const rel = "plugins/gs-superadmin/.claude-plugin/plugin.json";
    const snap = snapshotFiles([at(rel)]);
    try {
      const pj = JSON.parse(readFileSync(at(rel), "utf8"));
      pj.version = pj.version.replace(/\d+$/, (n) => String(Number(n) + 1));
      writeFileSync(at(rel), JSON.stringify(pj, null, 2) + "\n");
      const res = run();
      check("check 7: version/CHANGELOG divergence goes red",
        res.status === 1 && /must land together/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // ── check 8: raw invisible codepoints; genuine binaries skip and are named ─
  {
    withScratchFiles({ "notes-zzz.md": "before " + String.fromCharCode(0xfeff) + " after\n" }, () => {
      const res = run();
      check("check 8: a raw interior U+FEFF in a tracked file goes red",
        res.status === 1 && res.stderr.includes("notes-zzz.md") && /U\+FEFF/i.test(res.stderr), res.stderr);
    });
    withScratchFiles({ "asset-zzz.bin": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe, 0x00, 0x01]) }, () => {
      const res = run();
      check("check 8: a genuine binary is skipped, named, and stays green",
        res.status === 0 && res.stdout.includes("asset-zzz.bin"), res.stdout);
    });
  }

  // ── check 9: portability-rule definitions vs the sanctioned list ───────────
  {
    // Needle assembled so THIS file never contains the strip spelling whole.
    const stripSpelling = "replace(/^" + "\\uFEFF/, " + '"")';
    const rel = "plugins/gs-superadmin/scripts/journal.mjs"; // not sanctioned for the BOM rule
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + `\nconst zzzProbe = (x) => String(x).${stripSpelling};\n`);
      const res = run();
      check("check 9: an unsanctioned BOM-strip definition goes red",
        res.status === 1 && res.stderr.includes(rel) && /not sanctioned/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    // Reverse direction: a sanctioned file that stops defining its rule.
    // (Target re-aimed at B5 W3/DS-16: build/lib.mjs is now the build lane's
    // single sanctioned strip copy — the two retired per-reader copies no
    // longer carry the spelling at all.)
    const sanctioned = "build/lib.mjs";
    const snap2 = snapshotFiles([at(sanctioned)]);
    try {
      mutate(sanctioned, (s) => s.replace("replace(/^" + "\\uFEFF/", "replace(/^ZZZ/"));
      const res = run();
      check("check 9: a sanctioned file that stops defining its rule goes red",
        res.status === 1 && /no longer defines it/.test(res.stderr), res.stderr);
    } finally { snap2.restore(); }
    // Prose-lock direction: the doc-lib enumeration must name every sanctioned path.
    const docLib = "plugins/gs-superadmin/scripts/doc-lib.mjs";
    const snap3 = snapshotFiles([at(docLib)]);
    try {
      mutate(docLib, (s) => s.replace("the build lane's shared module build/lib.mjs", "the build lane's shared module"));
      const res = run();
      check("check 9: enumeration prose dropping a sanctioned path goes red (F-199)",
        res.status === 1 && /enumeration does not name/.test(res.stderr), res.stderr);
    } finally { snap3.restore(); }
    // Scope direction (B5 W1): the SHARED rig is not a test — a portability
    // rule growing in it must be swept like any other unsanctioned copy.
    const snap4 = snapshotFiles([at("test/rig.mjs")]);
    try {
      mutate("test/rig.mjs", (s) => s + `\nconst zzzRigProbe = (x) => String(x).${stripSpelling};\n`);
      const res = run();
      check("check 9: a portability definition growing in the shared rig goes red",
        res.status === 1 && res.stderr.includes("test/rig.mjs") && /not sanctioned/.test(res.stderr), res.stderr);
    } finally { snap4.restore(); }
    // F-289: the two shared-definition rows (DS-13's grep-proved single-sourcing
    // claims, promoted to committed rows). Needles assembled so this file never
    // contains either whole.
    const stubNeedle = "Metadata-" + "only stub";
    const snap5 = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + `\n// stray copy: "> **${stubNeedle}**"\n`);
      const res = run();
      check("check 9: a re-spelled stub-marker literal outside doc-lib goes red (F-289)",
        res.status === 1 && res.stderr.includes(rel) && res.stderr.includes("stub-marker literal"), res.stderr);
    } finally { snap5.restore(); }
    const BSx = String.fromCharCode(92);
    const escClass = "[.*+?^${}()|[" + BSx + "]" + BSx + BSx + "]";
    const snap6 = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + `\nconst zzzEsc = (x) => String(x).replace(/${escClass}/g, "x");\n`);
      const res = run();
      check("check 9: a re-spelled regex-escape character class outside doc-lib goes red (F-289)",
        res.status === 1 && res.stderr.includes(rel) && res.stderr.includes("regex-escape character class"), res.stderr);
    } finally { snap6.restore(); }
    // DS-24: the two rows the wrapper-hoist round added. A regrown fence-parse
    // copy cannot avoid calling the raw primitive; a respelled name sentinel
    // cannot avoid the literal. Needles assembled so this file never contains
    // either whole. journal.mjs (rel) is sanctioned for neither.
    const fenceNeedle = "extractFenced" + "Json(";
    const snap7 = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + `\nconst zzzFence = (t) => { const f = ${fenceNeedle}t); return f == null ? null : JSON.parse(f); };\n`);
      const res = run();
      check("check 9: a regrown raw fence-parse consumer outside doc-lib/jo-report goes red (DS-24)",
        res.status === 1 && res.stderr.includes(rel) && res.stderr.includes("KB-doc fence parse"), res.stderr);
    } finally { snap7.restore(); }
    const sentinelNeedle = "(none " + "recorded)";
    const snap8 = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + `\nconst zzzNoName = "${sentinelNeedle}";\n`);
      const res = run();
      check("check 9: a re-spelled name-sentinel literal outside doc-lib goes red (DS-24)",
        res.status === 1 && res.stderr.includes(rel) && res.stderr.includes("name-sentinel literal"), res.stderr);
    } finally { snap8.restore(); }
    // DS-25: the two T-9 renderer-sentinel rows (single home: build/lib.mjs).
    // Seed each spelling into a BUILD-lane file with no allowance —
    // build/build-wiki.mjs is exactly the file a "just re-inline it" revert
    // would target. Needles assembled so this file never contains either.
    const gscNeedle = BSx + "u0000" + "GSC";
    const snap9 = snapshotFiles([at("build/build-wiki.mjs")]);
    try {
      mutate("build/build-wiki.mjs", (s) => s + `\nconst zzzStash = "${gscNeedle}0";\n`);
      const res = run();
      check("check 9: a re-inlined inline code-span sentinel outside build/lib.mjs goes red (DS-25)",
        res.status === 1 && res.stderr.includes("build/build-wiki.mjs") && res.stderr.includes("inline code-span sentinel"), res.stderr);
    } finally { snap9.restore(); }
    const pipeNeedle = '"PIPE" + String.fromCh' + "arCode(0)";
    const snap10 = snapshotFiles([at("build/build-comparison-html.mjs")]);
    try {
      mutate("build/build-comparison-html.mjs", (s) => s + `\nconst zzzPipe = String.fromCharCode(0) + ${pipeNeedle};\n`);
      const res = run();
      check("check 9: a re-inlined pipe-cell sentinel outside build/lib.mjs goes red (DS-25)",
        res.status === 1 && res.stderr.includes("build/build-comparison-html.mjs") && res.stderr.includes("pipe-cell sentinel"), res.stderr);
    } finally { snap10.restore(); }
    // DS-42 / T-3 v4: the KB-doc envelope-unwrap row — the T-3 header's
    // "read-side homes" list is COMPLETE and this row keeps it so. Seed the
    // one-level unwrap's type test into a file the allowance does not name
    // (journal.mjs). Needle assembled so this file never contains it whole.
    const envNeedle = '.data === "obj' + 'ect"';
    const snap11 = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + `\nconst zzzEnvelope = (p) => (p && typeof p${envNeedle} ? p.data : p);\n`);
      const res = run();
      check("check 9: a fifth KB-doc envelope-unwrap home outside the T-3 list goes red (DS-42)",
        res.status === 1 && res.stderr.includes(rel) && res.stderr.includes("KB-doc envelope unwrap"), res.stderr);
    } finally { snap11.restore(); }
  }

  // ── check 10: bash-only continuation inside a skill fence ──────────────────
  {
    const rel = `plugins/gs-superadmin/skills/${userSkill}/SKILL.md`;
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + "\n```bash\necho zzz \\\n  --more\n```\n");
      const res = run();
      check("check 10: trailing-backslash continuation in a skill fence goes red",
        res.status === 1 && /backslash line continuation/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // ── check 10 (DS-43 inversion): the placeholder has ONE site — setup's link fence ──
  // Mutants from the design note's §6 item 3, each restoring one retired shape:
  //   10a a placeholder fence restored in a NON-setup skill → red naming the
  //       skill and line (the F-163→F-185 family regrowing)
  //   10b the bare name in a non-setup skill's prose (a warning paragraph
  //       coming back) → red naming the line
  //   10c setup's pinned link fence deleted → red "no longer fencing it"
  //       (a fresh workspace could never get its link)
  //   10d a SECOND placeholder fence in setup → red with the pinned count
  //   10e the retired `<plugin-root>` spelling back in a reference file → red
  //   10f the operating model's link bullet losing its ENOENT remedy → red
  //   10g the operating model naming the placeholder again → red
  //   10h (F-387 reopen) a POINTER to the retired warning — no token, just its
  //       vocabulary ("the surviving-placeholder rule from step 2 applies …
  //       substitute the plugin's root directory …") — restored in a non-setup
  //       skill → red naming the file, line and phrase (the tester's repro grep,
  //       as a gate)
  //   10i the same pointer in a reference file → red
  //   10j the same pointer in the operating model → red
  //   (control: setup's own pinned warning carries the vocabulary inside its
  //   window and the baseline stays green — asserted by the baseline arm)
  {
    const nonSetup = skills.find((s) => s !== "dev-canary" && s !== "setup");
    const rel = `plugins/gs-superadmin/skills/${nonSetup}/SKILL.md`;
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + "\n```\nnode \"${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs\" report --manifest <slug>/_manifest.json\n```\n");
      const res = run();
      check("check 10a: a placeholder fence restored in a non-setup skill goes red naming the skill",
        res.status === 1 && res.stderr.includes(`${rel}:`) && /fence uses \$\{CLAUDE_PLUGIN_ROOT\}/.test(res.stderr) && /pinned to setup/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    try {
      mutate(rel, (s) => s + "\nIf a fenced command still shows a literal CLAUDE_PLUGIN_ROOT placeholder, do not run it as-is.\n");
      const res = run();
      check("check 10b: the bare placeholder name in a non-setup skill's prose goes red (the warning family regrowing)",
        res.status === 1 && res.stderr.includes(`${rel}:`) && /names CLAUDE_PLUGIN_ROOT in prose/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }
  {
    const rel = "plugins/gs-superadmin/skills/setup/SKILL.md";
    const snap = snapshotFiles([at(rel)]);
    const FENCE = 'node "${CLAUDE_PLUGIN_ROOT}/scripts/plugin-link.mjs"';
    try {
      mutate(rel, (s) => {
        if (!s.includes(FENCE)) throw new Error("check 10c fixture: setup's link fence not found");
        return s.replace(FENCE, "node .gs-superadmin/plugin/scripts/plugin-link.mjs");
      });
      const res = run();
      check("check 10c: setup's pinned link fence deleted goes red (no longer fencing it)",
        res.status === 1 && /no longer fencing it: setup/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    try {
      mutate(rel, (s) => s + "\n```\nnode \"${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs\" report --manifest <slug>/_manifest.json\n```\n");
      const res = run();
      check("check 10d: a second placeholder fence in setup goes red with the pinned count",
        res.status === 1 && /2 fence\(s\) use \$\{CLAUDE_PLUGIN_ROOT\}/.test(res.stderr) && /exactly 1 is pinned/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }
  {
    const rel = "plugins/gs-superadmin/skills/setup/references/document-mechanics.md";
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + "\n`node \"<plugin-root>/scripts/manifest.mjs\" report --manifest <slug>/_manifest.json`\n");
      const res = run();
      check("check 10e: the retired <plugin-root> spelling back in a reference file goes red",
        res.status === 1 && res.stderr.includes(rel) && /retired <plugin-root> spelling/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }
  {
    const rel = "plugins/gs-superadmin/templates/operating-model.md";
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => {
        if (!s.includes("ENOENT")) throw new Error("check 10f fixture: the operating model's link bullet has no ENOENT clause");
        return s.replace(/ENOENT/g, "error");
      });
      const res = run();
      check("check 10f: the operating model's link bullet losing its ENOENT remedy goes red",
        res.status === 1 && /missing \(or incomplete\) the plugin-link bullet/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    try {
      mutate(rel, (s) => s + "\n- A literal CLAUDE_PLUGIN_ROOT placeholder in a command means it was never resolved.\n");
      const res = run();
      check("check 10g: the operating model naming the placeholder again goes red",
        res.status === 1 && res.stderr.includes(`${rel}:`) && /names CLAUDE_PLUGIN_ROOT/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    try {
      mutate(rel, (s) => s + "\n- The surviving-placeholder rule from setup applies to every fenced command.\n");
      const res = run();
      check("check 10j: a pointer to the retired warning in the operating model goes red naming the phrase",
        res.status === 1 && res.stderr.includes(`${rel}:`) && /"surviving-placeholder" — a reference to the surviving-literal warning family/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }
  {
    // 10h: the F-387 reopen shape verbatim — a pointer sentence with NO token,
    // exactly as the three dangling sites read, on a non-setup skill.
    const nonSetup = skills.find((s) => s !== "dev-canary" && s !== "setup");
    const rel = `plugins/gs-superadmin/skills/${nonSetup}/SKILL.md`;
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + "\nMark the asset stale (the surviving-placeholder rule from step 2 applies to this fence too — substitute the\nplugin's root directory before running a command that still shows the literal):\n");
      const res = run();
      // F-394: the escape class used to terminate early and the replacement was
      // over-escaped — the two bugs cancelled on a path with only '.' in it.
      const cited = (res.stderr.match(new RegExp(`${rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+): "([^"]+)"`, "g")) ?? []);
      check("check 10h: a token-free pointer to the retired warning in a non-setup skill goes red naming file, line and phrase (both of its lines)",
        res.status === 1 && cited.length === 2 && /"surviving-placeholder"/.test(res.stderr) && /"substitute the plugin's root"|"shows the literal"/.test(res.stderr) && /routes around the link \(F-387 reopen\)/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }
  {
    const rel = "plugins/gs-superadmin/skills/setup/references/document-mechanics.md";
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + "\nSubstitute the plugin's root directory per the skill's placeholder rule before running anything from here.\n");
      const res = run();
      check("check 10i: a pointer to the retired warning in a reference file goes red",
        res.status === 1 && res.stderr.includes(`${rel}:`) && /which no window ever permits/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // ── check 10 · link paths (F-398): the path after .gs-superadmin/plugin/ must be tracked ──
  //   10k a fence naming a script that is not in the tree → red naming file,
  //       line and path (a renamed or moved script behind a fence)
  //   10l the plural `.gs-superadmin/plugins/` typo → red naming it as the typo
  //   (controls, asserted by the baseline arm on the real tree: setup's
  //   `scripts/<x>.mjs` placeholder and scaffold-mechanics' trailing-slash
  //   `templates/conventions/` directory token both stay green)
  {
    const nonSetup = skills.find((s) => s !== "dev-canary" && s !== "setup");
    const rel = `plugins/gs-superadmin/skills/${nonSetup}/SKILL.md`;
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + "\n```\nnode .gs-superadmin/plugin/scripts/renamed-away.mjs report --manifest <slug>/_manifest.json\n```\n");
      const res = run();
      check("check 10k: a link path naming an untracked script goes red naming file, line and path (F-398)",
        res.status === 1 && res.stderr.includes(`${rel}:`) && res.stderr.includes("scripts/renamed-away.mjs") && /names no tracked file under plugins\/gs-superadmin\//.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    try {
      mutate(rel, (s) => s + "\nRead `.gs-superadmin/plugins/scripts/manifest.mjs` before the next step.\n");
      const res = run();
      check("check 10l: the plural .gs-superadmin/plugins/ typo goes red naming it as the typo (F-398)",
        res.status === 1 && res.stderr.includes(`${rel}:`) && /the workspace link is `\.gs-superadmin\/plugin` \(singular\)/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    // F-408 (A-9): the first segment is parsed, not pattern-matched — ANY
    // segment the workspace does not have is red, not just the plural typo;
    // and a skill's non-.md reference file is in scope like its SKILL.md.
    try {
      mutate(rel, (s) => s + "\nRead `.gs-superadmin/plugn/scripts/manifest.mjs` before the next step.\n");
      const res = run();
      check("check 10m: a non-plural misspelled first segment (.gs-superadmin/plugn/) goes red as an unknown workspace entry (F-408)",
        res.status === 1 && res.stderr.includes(`${rel}:`) && /`plugn` is not a workspace entry this repo creates/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    {
      // A TRACKED non-.md reference file (the checker's scope is git ls-files):
      // the change-request sample event, appended as text — the checker reads
      // references line-wise and never parses them.
      const refJson = "plugins/gs-superadmin/skills/change-request/references/examples/request-event.sample.json";
      const refSnap = snapshotFiles([at(refJson)]);
      try {
        mutate(refJson, (s) => s + "\n// node .gs-superadmin/plugin/scripts/renamed-away.mjs\n");
        const res = run();
        check("check 10n: a link path inside a skill's non-.md reference file is swept too (F-408 scope = the placeholder half's)",
          res.status === 1 && res.stderr.includes(`${refJson}:`) && res.stderr.includes("scripts/renamed-away.mjs"), res.stderr);
      } finally { refSnap.restore(); }
    }
  }

  // ── check 21 · the documented build pipeline is package.json's (F-407) ─────
  //   21a CLAUDE.md's arrow chain missing the last generator → red naming both lists
  //   21b README's individual-steps sentence missing a build:* script → red naming it
  //   21c AGENTS.md's derived-generators sentence out of order → red
  {
    const claude = snapshotFiles([at("CLAUDE.md")]);
    try {
      mutate("CLAUDE.md", (s) => s.replace(" → emit-reader-shapes\n", "\n"));
      const res = run();
      check("check 21a: CLAUDE.md's `npm run build` chain missing a generator goes red naming the documented and the real chain (F-407)",
        res.status === 1 && /check 21: CLAUDE\.md — .*lists \[.*build-plugin-gs-superadmin\] but package\.json's build runs \[.*emit-reader-shapes\]/.test(res.stderr), res.stderr);
    } finally { claude.restore(); }
    const readme = snapshotFiles([at("README.md")]);
    try {
      mutate("README.md", (s) => s.replace("`build:reader-shapes`", "`build:reader-shape`"));
      const res = run();
      check("check 21b: README's individual-steps sentence missing a build:* script goes red naming it (F-407)",
        res.status === 1 && /check 21: README\.md — .*never names `npm run build:reader-shapes`/.test(res.stderr), res.stderr);
    } finally { readme.restore(); }
    const agents = snapshotFiles([at("AGENTS.md")]);
    try {
      mutate("AGENTS.md", (s) => s.replace("build-plugin-gs-superadmin, emit-reader-shapes.", "emit-reader-shapes, build-plugin-gs-superadmin."));
      const res = run();
      check("check 21c: AGENTS.md's derived-generators sentence out of order goes red (F-407)",
        res.status === 1 && /check 21: AGENTS\.md — .*names \[.*\] but package\.json's build derives \[/.test(res.stderr), res.stderr);
    } finally { agents.restore(); }
  }

  // ── check 22 · no runnable line names a default domain folder (F-429, fourth pass) ─
  // The criterion is the tester's: RUNNABLE lines (a fence line, or an inline
  // command span), naming a folder from doc-lib's RECORDED_LANES as a --domain
  // value, an --out-dir segment or a <slug>/<folder> path. Prose that mentions a
  // folder is not a command. Each mutant is the shape one hand sweep missed.
  {
    const rel = "plugins/gs-superadmin/skills/setup/references/document-domain-notes.md";
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + "\nFor a one-off payload run\n`node \".gs-superadmin/plugin/scripts/program-doc.mjs\" --out-dir <slug>/journey <file …>`\nthen mark it.\n");
      const res = run();
      check("check 22a: an inline command span writing under a literal default folder goes red naming the file, line and folder (the F-429 fourth-instance shape)",
        res.status === 1 && res.stderr.includes(`${rel}:`) && /names the default domain folder `journey` literally/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    try {
      mutate(rel, (s) => s + "\n```\nnode .gs-superadmin/plugin/scripts/manifest.mjs upsert-batch --manifest <slug>/_manifest.json --domain journey-email-templates --file x.json --partial\n```\n");
      const res = run();
      check("check 22b: a fenced --domain literal goes red (the third-instance shape)",
        res.status === 1 && /names the default domain folder `journey-email-templates` literally/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    try {
      mutate(rel, (s) => s + "\n```\ngs-admin --json jo p list > <slug>/journey/list.json\n```\n");
      const res = run();
      check("check 22c: a <slug>/<folder> path segment inside a fenced command goes red",
        res.status === 1 && /names the default domain folder `journey` literally/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    try {
      mutate(rel, (s) => s + "\nWith `--domain journey` the batch auto-selects the program doc-mode as its fallback.\n");
      const res = run();
      check("check 22d: prose that merely mentions a folder in a non-command span stays green (the fallback description the criterion must let through)",
        res.status === 0, res.stderr);
    } finally { snap.restore(); }
    try {
      mutate(rel, (s) => s + "\n```\nnode .gs-superadmin/plugin/scripts/describe-batch.mjs --manifest <slug>/_manifest.json --domain <journey-domain> --out-dir <slug>/<journey-domain>\n```\n");
      const res = run();
      check("check 22e: the placeholder form stays green (the remedy)", res.status === 0, res.stderr);
    } finally { snap.restore(); }
  }
  {
    // The vocabulary is read out of doc-lib's source: a table that moves or
    // changes shape must fail the reader loudly, never sweep against nothing.
    const rel = "plugins/gs-superadmin/scripts/doc-lib.mjs";
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s.replace("export const RECORDED_LANES = Object.freeze({", "export const RECORDED_LANES = Object.freeze(Object.assign({}, {"));
      const res = run();
      check("check 22f: the lane table's opener changing shape goes red at the reader, not silently as an empty sweep",
        res.status === 1 && /could not read the `folder:` literals out of/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // ── check 11: guard-residuals anchor drift ─────────────────────────────────
  {
    const snap = snapshotFiles([at(PLUGIN_README)]);
    try {
      mutate(PLUGIN_README, (s) => s.replace(/(<!--\s*guard-residuals:\s*)/, "$1zzz-bogus-residual, "));
      const res = run();
      check("check 11: README anchor id not in guard-residuals.json goes red",
        res.status === 1 && res.stderr.includes("zzz-bogus-residual"), res.stderr);
    } finally { snap.restore(); }
  }

  // ── check 12: shipped script with no MAINTAINERS row ───────────────────────
  {
    withScratchFiles({ "plugins/gs-superadmin/scripts/zzz-scriptprobe.mjs": "// fixture probe (scratch rig only)\n" }, () => {
      const res = run();
      check("check 12: shipped script missing its MAINTAINERS row goes red",
        res.status === 1 && res.stderr.includes("zzz-scriptprobe.mjs") && res.stderr.includes("MAINTAINERS"), res.stderr);
    });
  }

  // ── check 13: bash-only spellings in hand-written repo docs ────────────────
  {
    const snap = snapshotFiles([at("CONTRIBUTING.md")]);
    try {
      mutate("CONTRIBUTING.md", (s) => s + "\n```bash\nnode build/something.mjs \\\n  --flag value\n```\n");
      const res = run();
      check("check 13: backslash continuation in a hand-written doc fence goes red",
        res.status === 1 && /backslash line continuation/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // ── fence grammar core (F-329): CommonMark pairing + line-local refusals ───
  // DERIVATION RULE (F-335 — how this list stays complete): arms derive from
  // the CENSUS of the grammar's decision points — every conjunct, regex
  // character class, quantifier bound, and comparison in scanFenceMarkers —
  // not from its failure messages and not from the arms already here. The
  // census lives as the PINNING LEDGER comment at scanFenceMarkers in
  // check-doc-drift.mjs, mapping each decision point to the arm that kills
  // its mutation; an edit that adds or changes a decision point extends the
  // ledger AND its arm in the same change. (F-332 pinned one conjunct of the
  // closer predicate; the tester's F-335 sweep found its three siblings
  // unpinned, and the census then found four MORE unpinned points the sweep
  // had not named — enumerating from failures converges one hole per round,
  // enumerating from the grammar terminates.) A baseline-arm kill (the real
  // tree happening to go red) is corpus-dependent and does NOT count as
  // clause coverage.
  // Arm enumeration — one arm per grammar clause; the checker-mutant sweep is
  // DERIVED from this list (one mutant per clause an arm pins), and each arm
  // asserts the clause's OWN message at its OWN line so a different-red (a
  // regressed grammar failing elsewhere) cannot fake a pass:
  //   G1  tilde delimiter outside a fence         → refused at its line
  //   G2  indented delimiter outside a fence      → refused at its line (the
  //       F-329 repro: two 4-space strays kept the old position-parity count
  //       even and silently SHIFTED every downstream range; now each fails)
  //   G3  opener-shaped line inside an open fence → refused at its line,
  //       naming the opener (the lost-closer signature)
  //   G4  unclosed fence at EOF                   → refused at its opener
  //       (the F-183 odd-count hard fail, generalized)
  //   G5  4-backtick wrapper with ``` content     → GREEN, and the content is
  //       genuinely fence-classified (G5b: a backslash continuation inside it
  //       is found by check 13 — range correctness, not absence of failure)
  //   G6/G7 caller coverage: the same core feeds checks 5 and 10 with their
  //       own message suffixes
  //   G8  line-leading backtick run with a backtick in its info string →
  //       refused (CommonMark: a paragraph, not an opener — else one line
  //       opens a phantom span)
  //   G9  a refused line must not cascade: grammar-valid ranges stay scanned,
  //       so the pinned EXPECTED_PLUGIN_ROOT_SKILLS message cannot stack a
  //       shrink-the-guard advice on top of a stray-delimiter red
  //   G10 a closer followed by spaces/tabs still CLOSES and still EMITS its
  //       range (CommonMark: trailing whitespace is legal on a closing fence;
  //       the clause is scanFenceMarkers' rest.trim() — F-332: it carried no
  //       arm, so a tightened `rest === ""` mutant left the whole suite green)
  //   G2b a TAB-indented delimiter outside a fence is refused with G2's own
  //       message (pins the flush class as SPACE-only — F-335 census)
  //   G2c a 3-space-indented fence is legal and green (pins the {0,3} lower
  //       boundary at arm level — before this, only the corpus-dependent
  //       baseline killed a narrowing)
  //   G11 a closer LONGER than its opener still closes and emits (pins the
  //       >= comparison against an === narrowing; the equal/greater green
  //       side is G5 — F-335)
  //   G12 an indented delimiter INSIDE an open fence is content, never a
  //       closer (pins the closer's flush conjunct — F-335)
  //   G13 a tilde run inside an open backtick fence is content, never a
  //       closer or a refusal (pins the closer's character conjunct — F-335)
  //   G14 sub-3 runs (`` and ~~) at line start and a mid-line ``` are all
  //       content, file green (pins both {3,} run minimums and the ^ line
  //       anchor — F-335 census)
  //   G15 the return contract's ok field: batteryFence withholds its
  //       could-not-locate on a red file — a message-set negative, since the
  //       exit status is 1 either way (F-336: the census had stopped at the
  //       parsing loop; the ledger now mirrors the WHOLE function, return
  //       statement included, so completeness is read side-by-side with the
  //       source, not remembered)
  //   G15b the ok guard's loud half: a clean file whose battery anchor is
  //       gone must FIRE could-not-locate (found by reading the instrument's
  //       site table: a dropped ok field is falsy always and matches shipped
  //       on every anchor-bearing fixture)
  //   G16 a file whose LINE 1 is a fence opener scans from line 1 (pins the
  //       for header's start value AND its step — F-337: the header was the
  //       construct the eye read through on the way to the body, exactly as
  //       the return line was read through on the way out)
  //   G17 a file with NO trailing newline whose LAST line is a stray
  //       delimiter is still refused (pins the for header's upper bound;
  //       the narrowed-bound mutant flips a red file silently GREEN — the
  //       arc's only verdict-flipping survivor)
  //   G18 a refused line in a hand-written doc carries check 13's OWN
  //       suffix (F-337: fenceRanges has TWO call sites — check 10 and
  //       check 13 — and the fourth consumer's suffix was asserted nowhere)
  //   census gate — the enumeration itself is no longer produced by reading
  //       (F-337 closed the fourth adjacent-miss round: closer conjuncts,
  //       sibling clauses, the return line, the for header — each time the
  //       scope sentence was right and the eye-generated enumeration came up
  //       short). build/sweep-fence-grammar.mjs now derives every mutation
  //       site MECHANICALLY from the function's source and runs this suite
  //       per mutant; the gate below pins the function's normalized
  //       fingerprint so any edit reds until the sweep re-runs and the
  //       ledger plus its arms move in the same change.
  {
    const probeRel = "notes-fence-zzz.md";
    const caseRed = (label, body, needles) =>
      withScratchFiles({ [probeRel]: body }, () => {
        const res = run();
        check(label, res.status === 1 && needles.every((n) => res.stderr.includes(n)), res.stderr);
      });
    caseRed("fence G1: tilde delimiter outside a fence is refused at its line",
      "# probe\n\n~~~\nnot supported\n~~~\n",
      [`${probeRel}:3: ~~~ fence markers are not supported`]);
    // Needles pair the line-anchored prefix with the message's distinctive
    // TAIL (F-number included) — a bare standalone "F-329" needle was vacuous:
    // it matched whenever the prefix needle's own message printed (review
    // round), so it could never fail independently.
    caseRed("fence G2: two indented stray delimiters each refused at their own line (F-329)",
      "# probe\n\nprose\n\n    ```\nmore prose\n    ```\nend\n",
      [`${probeRel}:5: indented \`\`\` delimiter outside any fence — this checker's grammar is line-local`,
       `${probeRel}:7: indented \`\`\` delimiter outside any fence`,
       "or restructure the block (F-329)"]);
    caseRed("fence G3: opener-shaped line inside an open fence is refused, naming the opener",
      "# probe\n\n```\ntext\n```bash\nx\n```\n",
      [`${probeRel}:5: fence-opener-shaped line inside the fence opened at line 3`,
       "so delimiter and content cannot be confused (F-329)"]);
    caseRed("fence G4: unclosed fence at EOF is refused at its opener (F-183)",
      "# probe\n\n```bash\nnode x.mjs\n",
      [`${probeRel}:3: \`\`\` fence opened here is never closed`,
       "silently hides content (F-183)"]);
    caseRed("fence G8: line-leading backtick run with a backtick in its info string is refused (a paragraph, not an opener)",
      "# probe\n\nSpelling note:\n```json` is how a line-leading code span can look\nmore prose\n",
      [`${probeRel}:4: line-leading backtick run with a backtick in its info string`,
       "open a phantom span"]);
    withScratchFiles({ [probeRel]: "# probe\n\n````\n```bash\nplain content\n```\n````\n" }, () => {
      const res = run();
      check("fence G5: a 4-backtick wrapper carrying ``` content is legal CommonMark and stays green",
        res.status === 0, res.stderr || res.stdout);
    });
    caseRed("fence G5b: wrapper content is fence-classified — check 13 finds a continuation inside it",
      "# probe\n\n````\nnode x.mjs \\\n  --flag v\n```\n````\n",
      [`${probeRel}:4: fenced command ends in a backslash line continuation`]);
    // G10 (F-332): a closing fence may carry trailing spaces/tabs (CommonMark)
    // — it must still close AND still emit its range. Proof rides check 13
    // finding a continuation INSIDE the range (G5b's range-emission shape): a
    // grammar that refuses the decorated closer instead reds with the
    // opener-shaped/unclosed messages and never reaches check 13, so the two
    // negative assertions pin the closer clause itself, not just "some red".
    withScratchFiles({ [probeRel]: "# probe\n\n```\nnode x.mjs \\\n  --flag v\n``` \t \nend\n" }, () => {
      const res = run();
      check("fence G10: closer with trailing spaces/tabs still closes and emits its range (check 13 sees inside; no refusal fires)",
        res.status === 1 && res.stderr.includes(`${probeRel}:4: fenced command ends in a backslash line continuation`) &&
          !res.stderr.includes("fence-opener-shaped line inside the fence") &&
          !res.stderr.includes("fence opened here is never closed"), res.stderr);
    });
    // G2b (F-335): the flush class is SPACE-only — a tab-indented delimiter
    // is refused with G2's own message at its own line. A widened class
    // ([ \t]) would silently OPEN a fence there instead (different message,
    // so the needle pins the clause, not just "some red").
    caseRed("fence G2b: a tab-indented delimiter is refused as indented (flush is space-only)",
      "# probe\n\nprose\n\n\t```\nmore prose\n",
      [`${probeRel}:5: indented \`\`\` delimiter outside any fence`]);
    // G2c (F-335): 3 spaces is the last LEGAL indent — a fence at exactly 3
    // stays green, so a narrowed {0,2} bound goes red at this arm instead of
    // relying on the corpus-dependent baseline.
    withScratchFiles({ [probeRel]: "# probe\n\n   ```\n   plain content\n   ```\nend\n" }, () => {
      const res = run();
      check("fence G2c: a 3-space-indented fence is legal CommonMark and stays green",
        res.status === 0, res.stderr || res.stdout);
    });
    // G11-G13 (F-335): the closer predicate's other three conjuncts, each in
    // G10's range-emission shape — check 13 must red INSIDE the emitted range
    // while both wrong-shape messages stay absent, so a mutated conjunct
    // (which mis-closes or never closes) cannot fake the pass with a
    // different red.
    withScratchFiles({ [probeRel]: "# probe\n\n```\nnode x.mjs \\\n  --flag v\n````\nend\n" }, () => {
      const res = run();
      check("fence G11: a closer LONGER than its opener still closes and emits its range",
        res.status === 1 && res.stderr.includes(`${probeRel}:4: fenced command ends in a backslash line continuation`) &&
          !res.stderr.includes("fence-opener-shaped line inside the fence") &&
          !res.stderr.includes("fence opened here is never closed"), res.stderr);
    });
    withScratchFiles({ [probeRel]: "# probe\n\n```\n    ```\nnode x.mjs \\\n  --flag v\n```\nend\n" }, () => {
      const res = run();
      check("fence G12: an indented delimiter inside an open fence is content, never a closer",
        res.status === 1 && res.stderr.includes(`${probeRel}:5: fenced command ends in a backslash line continuation`) &&
          !res.stderr.includes("fence opened here is never closed"), res.stderr);
    });
    withScratchFiles({ [probeRel]: "# probe\n\n```\n~~~~\nnode x.mjs \\\n  --flag v\n```\nend\n" }, () => {
      const res = run();
      check("fence G13: a tilde run inside an open backtick fence is content, never a closer or a refusal",
        res.status === 1 && res.stderr.includes(`${probeRel}:5: fenced command ends in a backslash line continuation`) &&
          !res.stderr.includes("~~~ fence markers are not supported") &&
          !res.stderr.includes("fence opened here is never closed"), res.stderr);
    });
    // G14 (F-335): the shape layer's own bounds — sub-3 runs and mid-line
    // delimiters are content. Green on shipped; a widened run minimum turns
    // line 3 into a G8 refusal or line 4 into a G1 refusal, and a dropped ^
    // anchor turns the mid-line ``` into a phantom opener.
    withScratchFiles({ [probeRel]: "# probe\n\n``inline`` code at line start\n~~strike~~ note\nsee ``` fences mid-line\nend\n" }, () => {
      const res = run();
      check("fence G14: sub-3 runs at line start and a mid-line delimiter are all content (stays green)",
        res.status === 0, res.stderr || res.stdout);
    });
    // G6: the shared core feeds check 5 with its own suffix.
    {
      const snap = snapshotFiles([at("AGENTS.md")]);
      try {
        mutate("AGENTS.md", (s) => s + "\n```\nstray unclosed fence probe\n");
        const res = run();
        check("fence G6: an unclosed fence in AGENTS.md goes red through check 5's caller",
          res.status === 1 && /AGENTS\.md:\d+: ``` fence opened here is never closed/.test(res.stderr) &&
            res.stderr.includes("check 5 cannot trust any fence range"), res.stderr);
      } finally { snap.restore(); }
    }
    // G7: the shared core feeds check 10 with its own suffix.
    {
      const rel = `plugins/gs-superadmin/skills/${userSkill}/SKILL.md`;
      const snap = snapshotFiles([at(rel)]);
      try {
        mutate(rel, (s) => s + "\n```\ntext\n```bash\nx\n```\n");
        const res = run();
        check("fence G7: an opener-shaped line inside a skill fence goes red through check 10's caller",
          res.status === 1 && res.stderr.includes(rel) && /fence-opener-shaped line inside the fence/.test(res.stderr) &&
            res.stderr.includes("hides its content from check 10 (F-172)"), res.stderr);
      } finally { snap.restore(); }
    }
    // G9: a refused line must not CASCADE — the grammar-valid ranges are still
    // scanned, so a stray tilde in a skill cannot flip the pinned
    // EXPECTED_PLUGIN_ROOT_SKILLS set red with its shrink-the-guard advice
    // (review round: fenceRanges used to withhold ranges on any problem).
    {
      const rel = `plugins/gs-superadmin/skills/${userSkill}/SKILL.md`;
      const snap = snapshotFiles([at(rel)]);
      try {
        mutate(rel, (s) => s + "\n~~~\n");
        const res = run();
        check("fence G9: a single refused line goes red WITHOUT cascading into the pinned-set message",
          res.status === 1 && /~~~ fence markers are not supported/.test(res.stderr) &&
            !res.stderr.includes("no longer fencing it"), res.stderr);
      } finally { snap.restore(); }
    }
    // G15 (F-336): the G9 twin for check 5's caller. batteryFence WITHHOLDS
    // its could-not-locate failure on a red file (the `if (ok)` guard on the
    // return contract's ok field) so it cannot stack a misleading second
    // failure on the real per-line refusals. The fixture rewrites the battery
    // fence's own OPENER to a tilde run — the one input where the file is red
    // AND the anchor sits outside every grammar-valid range, so a guard
    // widened to always-true emits the cascade and only a message-set
    // negative can see it (exit status is 1 either way).
    {
      const snap = snapshotFiles([at("AGENTS.md")]);
      try {
        mutate("AGENTS.md", (s) => {
          const lines = s.split("\n");
          const anchor = lines.findIndex((l) => l.includes("node plugins/gs-superadmin/test/guard-fixtures.mjs"));
          let opener = anchor;
          while (opener >= 0 && !/^`{3,}/.test(lines[opener])) opener--;
          if (anchor < 0 || opener < 0) throw new Error("G15 fixture: battery anchor or its fence opener not found in AGENTS.md");
          lines[opener] = lines[opener].replace(/^`{3,}/, "~~~");
          return lines.join("\n");
        });
        const res = run();
        check("fence G15: red battery fence — per-line refusal present, could-not-locate WITHHELD (no cascade)",
          res.status === 1 && /AGENTS\.md:\d+: ~~~ fence markers are not supported/.test(res.stderr) &&
            res.stderr.includes("check 5 cannot trust any fence range") &&
            !res.stderr.includes("could not locate the verification-commands fence"), res.stderr);
      } finally { snap.restore(); }
    }
    // G15b (F-337 census, found by reading the instrument's site table before
    // the sweep): the LOUD half of the ok guard — on a CLEAN file whose
    // battery anchor is simply gone, could-not-locate must FIRE (G15 pins
    // only the red-file withhold; a dropped ok field is falsy always,
    // identical to shipped on every fixture that has the anchor).
    {
      const snap = snapshotFiles([at("AGENTS.md")]);
      try {
        mutate("AGENTS.md", (s) => s.split("\n").filter((l) => !l.includes("node plugins/gs-superadmin/test/guard-fixtures.mjs")).join("\n"));
        const res = run();
        check("fence G15b: clean file with the battery anchor removed — could-not-locate FIRES",
          res.status === 1 && res.stderr.includes("could not locate the verification-commands fence"), res.stderr);
      } finally { snap.restore(); }
    }
    // G16 (F-337): the loop's start value and step. Every other fixture opens
    // with "# probe", so line 1 was never a delimiter and a raised start
    // bound was invisible to the whole arm set. Opener at line 1, closer at
    // an ODD index: a start of 1 misses the opener (bogus never-closed), a
    // step of 2 misses the closer — either way the :2 needle vanishes and a
    // wrong-shape message appears.
    withScratchFiles({ [probeRel]: "```\nnode x.mjs \\\n  --flag v\n```\nend\n" }, () => {
      const res = run();
      check("fence G16: a fence opening on LINE 1 is scanned — range emitted, check 13 sees inside",
        res.status === 1 && res.stderr.includes(`${probeRel}:2: fenced command ends in a backslash line continuation`) &&
          !res.stderr.includes("fence opened here is never closed"), res.stderr);
    });
    // G17 (F-337): the loop's upper bound. Every fixture (and the corpus)
    // ends with a trailing newline, so the final split element was always ""
    // and a bound of length-1 was invisible — the mutant turns a RED file
    // silently GREEN, the arc's only verdict-flipping survivor. No trailing
    // newline here, on purpose.
    withScratchFiles({ [probeRel]: "# probe\n\nprose\n~~~" }, () => {
      const res = run();
      check("fence G17: a stray delimiter on the LAST line of a file with no trailing newline is still refused",
        res.status === 1 && res.stderr.includes(`${probeRel}:4: ~~~ fence markers are not supported`), res.stderr);
    });
    // G18 (F-337): fenceRanges' FOURTH consumer — check 13's own call site
    // and suffix (check 10's suffix has G7; this one was asserted nowhere).
    caseRed("fence G18: a refused line in a hand-written doc carries check 13's own suffix",
      "# probe\n\n~~~\nx\n~~~\n",
      [`${probeRel}:3: ~~~ fence markers are not supported`,
       "an unreadable fence hides its commands from this check exactly as it did from check 10 (F-172)"]);
    // Census gate (F-337; redesigned at F-338/F-339): the mechanical census
    // now RUNS here, on every suite run, instead of pinning a fingerprint and
    // nagging a human to run a 40-minute tool. build/sweep-fence-grammar.mjs
    // judges every mutant in memory against its committed exact-output
    // battery (~100ms, no file ever written), asserts the shipped function
    // conforms to that battery, asserts survivors match DECLARED_SURVIVORS
    // exactly, and asserts the residue check: every executable line carries a
    // mutation site or a DECLARED_INERT reason — so an edit to the function
    // is re-swept HERE, a behavioral change reds the battery, and an
    // unmodelled construct reds the residue on arrival (the F-339 class).
    // The tool sweeps the REAL tree's checker deliberately: the artifact
    // under version control is what the census claim is about.
    {
      const r = runNode(join(ROOT, "build", "sweep-fence-grammar.mjs"));
      check("fence census gate: sweep-fence-grammar green — battery PASS, declared-survivor comparison EXACT, residue clean (a survivor or unclaimed construct here is a finding, never a decision)",
        r.status === 0 && r.stdout.includes("battery: PASS")
          && r.stdout.includes("declared-survivor comparison: EXACT")
          && r.stdout.includes("residue: NONE outside DECLARED_INERT"),
        (r.stdout ?? "") + (r.stderr ?? ""));
    }
  }

  // ── check 14: captures route through the helper; the set is pinned data ────
  {
    // The policed set is data inside the checker — read it from the rig's copy
    // so the cases target a genuine member and a genuine outsider. The
    // scrape's failure mode is an EMPTY set (regex anchor rot), which would
    // silently retarget the cases — bail loudly instead (B2 review, altitude
    // finder).
    const checkerSrc = readFileSync(CHECKER, "utf8");
    const setLiteral = /CAPTURE_HELPER_SKILLS = new Set\(\[([^\]]*)\]/.exec(checkerSrc)?.[1] ?? "";
    const helperSet = new Set([...setLiteral.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]));
    const member = skills.find((s) => helperSet.has(s));
    const outsider = skills.find((s) => !helperSet.has(s) && s !== "dev-canary");
    if (helperSet.size === 0 || !member || !outsider) {
      console.log("FAIL  rig sanity: CAPTURE_HELPER_SKILLS scrape broke, or no member/outsider skill to mutate");
      console.log(`      ${JSON.stringify({ helperSet: [...helperSet], skills })}`);
      process.exit(1);
    }
    // (a) the check's core claim: a RAW gs-admin redirect capture anywhere in
    // any skill goes red with the route-through-the-helper message.
    const memberRel = `plugins/gs-superadmin/skills/${member}/SKILL.md`;
    {
      const snap = snapshotFiles([at(memberRel)]);
      try {
        mutate(memberRel, (s) => s + "\n```bash\ngs-admin --json re r list > zzz-out.json\n```\n");
        const res = run();
        check("check 14a: a raw shell-redirect capture goes red with the route-through message",
          res.status === 1 && /raw shell redirect/.test(res.stderr) && res.stderr.includes("capture.mjs"), res.stderr);
      } finally { snap.restore(); }
    }
    // (b) set drift, gain: a skill outside the set invoking the helper.
    {
      const outsiderRel = `plugins/gs-superadmin/skills/${outsider}/SKILL.md`;
      const snap = snapshotFiles([at(outsiderRel)]);
      try {
        mutate(outsiderRel, (s) => s + "\n```bash\nnode capture.mjs --out zzz.json -- gs-admin --json re r list\n```\n");
        const res = run();
        check("check 14b: an unlisted skill invoking the helper goes red (set drift, gain)",
          res.status === 1 && res.stderr.includes("CAPTURE_HELPER_SKILLS") && res.stderr.includes(outsider), res.stderr);
      } finally { snap.restore(); }
    }
    // (c) set drift, loss: a listed member that stops invoking the helper —
    // the list must stay a statement about the tree, not a stale hope.
    {
      const snap = snapshotFiles([at(memberRel)]);
      try {
        mutate(memberRel, (s) => s.replaceAll("capture.mjs", "captur3.mjs"));
        const res = run();
        check("check 14c: a listed skill that no longer invokes the helper goes red (set drift, loss)",
          res.status === 1 && /no longer invokes the capture helper/.test(res.stderr) && res.stderr.includes(member), res.stderr);
      } finally { snap.restore(); }
    }
    // (d) routing is the CAPTURE invocation grammar, not the script's name:
    // rewriting only the `--out` capture invocations (leaving any
    // `--normalize` remediation spans and prose mentions of capture.mjs)
    // must still go red — the substring version of HELPER_LINE stayed green
    // here (review round, B5 W4).
    {
      const memberSrc = readFileSync(at(memberRel), "utf8");
      // Mode flags may sit between the script name and --out (DS-30's
      // `--paginate --page-flag <v>` does) — the invocation is still the
      // helper grammar; the rewrite below must keep matching it.
      if (!/capture\.mjs"?[^\n`]*?\s--out\s/.test(memberSrc)) {
        console.log(`FAIL  rig sanity: member skill ${member} has no --out capture invocation to rewrite for 14d`);
        process.exit(1);
      }
      const snap = snapshotFiles([at(memberRel)]);
      try {
        mutate(memberRel, (s) => s.replace(/capture\.mjs("?)([^\n`]*?\s)--out\b/g, 'other-writer.mjs$1$2--out'));
        const res = run();
        check("check 14d: losing the --out captures while a --normalize mention survives still goes red",
          res.status === 1 && /no longer invokes the capture helper/.test(res.stderr) && res.stderr.includes(member), res.stderr);
      } finally { snap.restore(); }
    }
    // (e) the routing PROOF must come from code text (a fence or a backtick
    // span): an unbacktick'd PROSE sentence carrying all four grammar
    // elements must not keep a member green after its real captures are gone
    // (release-gate round — capCodeTexts' whole-line prose fallback let
    // exactly such a sentence certify routing).
    {
      const snap = snapshotFiles([at(memberRel)]);
      try {
        mutate(memberRel, (s) =>
          s.replaceAll("capture.mjs", "captur3.mjs") +
          "\nRun capture.mjs with --out somewhere.json before -- gs-admin performs the read.\n");
        const res = run();
        check("check 14e: an unbacktick'd prose sentence with the four elements cannot certify routing",
          res.status === 1 && /no longer invokes the capture helper/.test(res.stderr) && res.stderr.includes(member), res.stderr);
      } finally { snap.restore(); }
    }
    // (f) the skill's capture surface includes its references/ files (DS-32
    // moved executable mechanics there): a raw redirect written into a
    // reference file must go red exactly as one in SKILL.md would.
    {
      const refRel = "plugins/gs-superadmin/skills/setup/references/document-mechanics.md";
      const snap = snapshotFiles([at(refRel)]);
      try {
        mutate(refRel, (s) => s + "\n```bash\ngs-admin --json re r list > zzz-ref-out.json\n```\n");
        const res = run();
        check("check 14f: a raw redirect capture inside a skill reference file goes red",
          res.status === 1 && res.stderr.includes(refRel) && /raw shell redirect/.test(res.stderr), res.stderr);
      } finally { snap.restore(); }
    }
    // (g) routing seen from a reference file keeps the set green: a member
    // whose SKILL.md captures migrate into a reference must not false-red
    // CAPTURE_HELPER_SKILLS (the other direction of the same DS-32 surface).
    {
      const setupRel = "plugins/gs-superadmin/skills/setup/SKILL.md";
      const snap = snapshotFiles([at(setupRel)]);
      try {
        // The rename must not leave a LINK path naming an untracked script - since
        // F-398 that is its own red - so the link-path fences move OUT of the link
        // (a workspace tmp spelling) before the bare token is renamed; the arm stays
        // about the check-14 set, and the file ends with zero capture.mjs tokens as before.
        mutate(setupRel, (s) => s.replaceAll(".gs-superadmin/plugin/scripts/capture.mjs", ".gs-superadmin/tmp/captur3.mjs").replaceAll("capture.mjs", "captur3.mjs"));
        withScratchFiles({
          "plugins/gs-superadmin/skills/setup/references/zzz-migrated-captures.md":
            "# migrated captures (scratch probe)\n\n```bash\nnode capture.mjs --out zzz.json -- gs-admin --json re r list\n```\n",
        }, () => {
          const res = run();
          check("check 14g: helper routing that lives in a reference file still counts for the set",
            res.status === 0, res.stderr || res.stdout);
        });
      } finally { snap.restore(); }
    }
    // (h) the reference-file surface is the TRACKED tree (gate-3 F-350): an
    // UNTRACKED scratch file — written here without a git add, unlike every
    // withScratchFiles probe — carrying a raw redirect must not red the gate,
    // because check 13 (which owns the same directory) never sees it either.
    // Same body as 14f; the only difference is git membership.
    {
      const strayRel = "plugins/gs-superadmin/skills/setup/references/zzz-untracked-notes.md";
      writeFiles(rig, { [strayRel]: "# scratch notes (untracked probe)\n\n```bash\ngs-admin --json re r list > zzz-stray-out.json\n```\n" });
      try {
        const res = run();
        check("check 14h: an untracked reference file is outside check 14's surface (tracked tree, like check 13)",
          res.status === 0 && !res.stderr.includes(strayRel), res.stderr || res.stdout);
      } finally { rmSync(at(strayRel), { force: true }); }
    }
    // (i) F-351 round 4: a paginate fence over a command whose envelope carries
    // a side block must STATE its rows path. Dropping --items-path from the
    // audit reports fence must go red — this is the one pin the fix round's
    // mutation table could not kill from the suites alone (M26).
    {
      const auditRel = "plugins/gs-superadmin/skills/audit/SKILL.md";
      const snap = snapshotFiles([at(auditRel)]);
      try {
        mutate(auditRel, (s) => {
          if (!s.includes(" --items-path data.data ")) throw new Error("audit rp fence no longer carries --items-path data.data — fixture stale");
          return s.replace(" --items-path data.data ", " ");
        });
        const res = run();
        check("check 14i: the audit rp list paginate fence losing its stated --items-path goes red",
          res.status === 1 && /rp list.*does not state its rows path/.test(res.stderr) && /--items-path data\.data/.test(res.stderr), res.stderr);
      } finally { snap.restore(); }
    }
  }

  // ── check 10i (F-394): the BARE placeholder spelling inside a fence ────────
  // $CLAUDE_PLUGIN_ROOT and $env:CLAUDE_PLUGIN_ROOT must red in a non-setup
  // skill, by line; the braced-only fence test left this hole.
  {
    const nonSetup = skills.find((s) => s !== "dev-canary" && s !== "setup");
    const rel = `plugins/gs-superadmin/skills/${nonSetup}/SKILL.md`;
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + "\n```bash\nnode \"$CLAUDE_PLUGIN_ROOT/scripts/manifest.mjs\" report\n```\n");
      const res = run();
      check("check 10i: a fence spelling $CLAUDE_PLUGIN_ROOT without braces in a non-setup skill goes red by line (F-394)",
        res.status === 1 && res.stderr.includes(rel) && /without braces/.test(res.stderr) && /F-394/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    const snapPs = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + "\n```powershell\nnode \"$env:CLAUDE_PLUGIN_ROOT/scripts/manifest.mjs\" report\n```\n");
      const res = run();
      check("check 10i: the $env: spelling inside a fence goes red the same way (F-394)", res.status === 1 && /without braces/.test(res.stderr), res.stderr);
    } finally { snapPs.restore(); }
  }

  // ── check 15: the journal-kind nickname must pair with the emitter literal ──
  {
    const BT = "`";
    const kindLit = "change-plan" + " execution"; // assembled — see check 15's self-match note
    // Unpair a real site: the check must go red AT that site (per-occurrence
    // window — file-level pairing would pass journal.mjs, the motivating case).
    const rel = "plugins/gs-superadmin/test/journal-ops.mjs";
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s.replace(` (kind ${BT}${kindLit}${BT}) to`, " to"));
      const res = run();
      check("check 15: a nickname site losing its paired literal goes red at that site (F-290)",
        res.status === 1 && res.stderr.includes(rel) && /prose nickname/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    // Extraction-rot direction: the literal is READ from the writer's
    // composeJournalEntry call; if that stops being a string literal the check
    // must refuse to run, never silently check nothing.
    const writerRel = "plugins/gs-superadmin/scripts/journal.mjs";
    const snap2 = snapshotFiles([at(writerRel)]);
    try {
      mutate(writerRel, (s) => s.replace(`kind: "${kindLit}",`, "kind: KIND_LITERAL_CONST,"));
      const res = run();
      check("check 15: kind literal unreadable from the writer goes red (source of record moved)",
        res.status === 1 && /cannot read the kind literal/.test(res.stderr), res.stderr);
    } finally { snap2.restore(); }
    // Binary skip is REAL, not a dead catch (F-294): utf8 decode never throws
    // on binary, so the old catch-continue TEXT-SCANNED binaries — the F-201
    // class this checker already fixed at check 8. A genuine binary (invalid
    // UTF-8) whose bytes carry the nickname unpaired must SKIP (stay green);
    // under the dead-catch spelling this exact probe went red.
    {
      const nick = "plan-" + "completion"; // assembled — see check 15's self-match note
      const binRel = "plugins/gs-superadmin/zzz-binaryprobe.bin";
      writeFileSync(at(binRel), Buffer.concat([
        Buffer.from([0xff, 0xc0, 0x00, 0x81]),
        Buffer.from(" " + nick + " (binary probe, never paired) ", "utf8"),
        Buffer.from([0xfe, 0x80]),
      ]));
      gitAddAll(rig);
      try {
        const res = run();
        check("check 15: a genuine binary carrying unpaired nickname bytes skips, never text-scans (F-294)",
          res.status === 0, res.stderr || res.stdout);
      } finally {
        rmSync(at(binRel), { force: true });
        gitAddAll(rig);
      }
    }
  }

  // ── check 20: the refresh migration note quotes what upsert-batch PRINTS ─────
  // The check EXECUTES the writer on a scratch manifest and holds each copy-out
  // segment-wise to the real stderr (F-392 reopen: a head-presence gate let a
  // stale middle clause through). Arms: paraphrase, stale clause between intact
  // heads (the tester's M5), reordered segments, a missing copy-out, and the
  // fixture run itself failing.
  {
    const skillRel = "plugins/gs-superadmin/skills/refresh/SKILL.md";
    const writerRel = "plugins/gs-superadmin/scripts/manifest.mjs";
    const dateLine = (s) => s.split(/\r?\n/).find((l) => /^ {4}manifest\.mjs: --date-field /.test(l));
    const idLine = (s) => s.split(/\r?\n/).find((l) => /^ {4}manifest\.mjs: --id-field /.test(l));
    check("check 20 rig: the note carries one id copy-out and one date copy-out", Boolean(idLine(readFileSync(at(skillRel), "utf8")) && dateLine(readFileSync(at(skillRel), "utf8"))), null);
    const snapA = snapshotFiles([at(skillRel)]);
    try {
      mutate(skillRel, (s) => s.replace("change detection would be dead", "change detection would stop"));
      const res = run();
      check("check 20a: a paraphrased copy-out goes red by line as not a segment-wise quotation (F-388/F-392)",
        res.status === 1 && new RegExp(`${skillRel}:\\d+: this copy-out is not a segment-wise quotation`).test(res.stderr), res.stderr);
    } finally { snapA.restore(); }
    const snapB = snapshotFiles([at(writerRel)]);
    try {
      mutate(writerRel, (s) => s.replace("const argv = process.argv.slice(2);", "const argv = [];"));
      const res = run();
      check("check 20b: the fixture run failing (the writer no longer executes as the check expects) goes red as 'could not execute', never silently green",
        res.status === 1 && /check 20: could not execute upsert-batch/.test(res.stderr), res.stderr);
    } finally { snapB.restore(); }
    check("check 20c: the pass line reports the copy-outs held", /2 upsert-batch failure copy-out\(s\) held segment-wise/.test(base.stdout), base.stdout);
    const snapD = snapshotFiles([at(skillRel)]);
    try {
      mutate(skillRel, (s) => s.split(/\r?\n/).filter((l) => !/^ {4}manifest\.mjs: --id-field /.test(l)).join("\n"));
      const res = run();
      check("check 20d: deleting the id-failure copy-out goes red — 1 of 2 failures quoted (F-393)",
        res.status === 1 && /quotes 1 of upsert-batch's 2 migration failures/.test(res.stderr), res.stderr);
    } finally { snapD.restore(); }
    const snapE = snapshotFiles([at(skillRel)]);
    try {
      // the tester's M5: a fabricated clause between two intact heads
      mutate(skillRel, (s) => { const l = dateLine(s); return s.replace(l, l.replace(" — change detection would be dead", " — an invented clause the script never prints — change detection would be dead")); });
      const res = run();
      check("check 20e: a fabricated clause between two intact heads goes red (the F-392 reopen's M5, now KILLED)",
        res.status === 1 && /not a segment-wise quotation/.test(res.stderr), res.stderr);
    } finally { snapE.restore(); }
    const snapF = snapshotFiles([at(skillRel)]);
    try {
      // reordered segments: the id line's two segments swapped around the elision
      // keep the copy-out prefix so the line is still recognised as a copy-out; swap what follows it
      mutate(skillRel, (s) => { const l = idLine(s); const [a, b] = l.replace(/^ {4}manifest\.mjs: /, "").split("…").map((x) => x.trim()); return s.replace(l, `    manifest.mjs: ${b} … ${a}`); });
      const res = run();
      check("check 20f: segments out of order go red (in-order quotation, not a bag of substrings)",
        res.status === 1 && /not a segment-wise quotation/.test(res.stderr), res.stderr);
    } finally { snapF.restore(); }
  }

  // ── check 16: the token pre-flight family holds its one-canon shape ────────
  {
    // The family and its markers are data inside the checker (contracts-as-
    // data) — scrape them from the rig's copy so these cases target the real
    // canon/paraphrase sites and the real marker strings (the formula carries
    // a U+2212 minus; hand-retyping it here is exactly the kind of
    // almost-match that would silently no-op a mutant). Scrape rot bails
    // loudly (B2 review, altitude).
    const checkerSrc16 = readFileSync(CHECKER, "utf8");
    const lit16 = /const TOKEN_PREFLIGHT = \{([\s\S]*?)\};/.exec(checkerSrc16)?.[1] ?? "";
    const field16 = (k) => new RegExp(`${k}: "([^"]*)"`).exec(lit16)?.[1];
    const canonSkill = field16("canonSkill");
    const headline16 = field16("headline");
    const canonOnly16 = field16("canonOnly");
    const pointer16 = field16("pointer");
    const paraSkills16 = [...(/paraphraseSkills: \[([^\]]*)\]/.exec(lit16)?.[1] ?? "").matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
    const outsider16 = skills.find((s) => s !== canonSkill && !paraSkills16.includes(s) && s !== "dev-canary");
    if (!canonSkill || !headline16 || !canonOnly16 || !pointer16 || paraSkills16.length === 0 || !outsider16) {
      console.log("FAIL  rig sanity: TOKEN_PREFLIGHT scrape broke, or no outsider skill to mutate");
      console.log(`      ${JSON.stringify({ canonSkill, headline16, canonOnly16, pointer16, paraSkills16, outsider16 })}`);
      process.exit(1);
    }
    const canonRel = `plugins/gs-superadmin/skills/${canonSkill}/SKILL.md`;
    const paraRel = `plugins/gs-superadmin/skills/${paraSkills16[0]}/SKILL.md`;
    // (a) the canon site losing the formula — the full statement the
    // paraphrases point at must actually be there.
    {
      const snap = snapshotFiles([at(canonRel)]);
      try {
        mutate(canonRel, (s) => s.replace(canonOnly16, "remaining minus the half-life"));
        const res = run();
        check("check 16a: canon site losing the usable-life formula goes red",
          res.status === 1 && /usable-life formula/.test(res.stderr) && res.stderr.includes(canonRel), res.stderr);
      } finally { snap.restore(); }
    }
    // (b) a paraphrase site losing its pointer — a free-floating copy drifts.
    {
      const snap = snapshotFiles([at(paraRel)]);
      try {
        mutate(paraRel, (s) => s.replace(pointer16, "see the setup skill"));
        const res = run();
        check("check 16b: paraphrase site losing its canon pointer goes red",
          res.status === 1 && /no pointer to the canon/.test(res.stderr) && res.stderr.includes(paraRel), res.stderr);
      } finally { snap.restore(); }
    }
    // (c) the formula growing back at a paraphrase site — the full-second-copy
    // drift class this check exists to end.
    {
      const snap = snapshotFiles([at(paraRel)]);
      try {
        mutate(paraRel, (s) => s + `\nRemember: usable life is ${canonOnly16}.\n`);
        const res = run();
        check("check 16c: paraphrase site restating the canon formula goes red (second full copy)",
          res.status === 1 && /full second copy/.test(res.stderr) && res.stderr.includes(paraRel), res.stderr);
      } finally { snap.restore(); }
    }
    // (d) set drift, gain: a skill outside the family teaching the pre-flight.
    {
      const outRel = `plugins/gs-superadmin/skills/${outsider16}/SKILL.md`;
      const snap = snapshotFiles([at(outRel)]);
      try {
        mutate(outRel, (s) => s + "\nRun a token pre-flight before any batch here too.\n");
        const res = run();
        check("check 16d: an unlisted skill mentioning the pre-flight goes red (set drift, gain)",
          res.status === 1 && res.stderr.includes("TOKEN_PREFLIGHT family") && res.stderr.includes(outsider16), res.stderr);
      } finally { snap.restore(); }
    }
    // (e) set drift, loss: a family member whose pre-flight disappears — the
    // long-batch skill silently loses its guard, the F-221 reopening.
    {
      const snap = snapshotFiles([at(paraRel)]);
      try {
        mutate(paraRel, (s) => s.replace(/[Tt]oken pre-flight/g, "auth check"));
        const res = run();
        check("check 16e: a family member losing its pre-flight goes red (set drift, loss)",
          res.status === 1 && /lost its/.test(res.stderr) && res.stderr.includes(paraRel), res.stderr);
      } finally { snap.restore(); }
    }
    // (f) declaration rot: a family entry naming a skill that does not exist
    // (a skill removed while its entry survives) must go red rather than
    // silently shrinking the enforced surface (B7 review round; check 14's
    // CAPTURE_HELPER_SKILLS direction).
    {
      const snap = snapshotFiles([CHECKER]);
      try {
        mutate("build/check-doc-drift.mjs", (s) =>
          s.replace(`paraphraseSkills: ["${paraSkills16[0]}"`, `paraphraseSkills: ["zzz-ghost-skill", "${paraSkills16[0]}"`));
        const res = run();
        check("check 16f: a family entry naming a nonexistent skill goes red (declaration rot)",
          res.status === 1 && res.stderr.includes("zzz-ghost-skill") && /does not exist under/.test(res.stderr), res.stderr);
      } finally { snap.restore(); }
    }
  }

  // ── check 19: the defect-class registry (W10) — the CONSUMER pins ────────
  // The detectors themselves (detectRow/callClose, every decision point of
  // every mechanical row) are pinned in memory by build/test-defect-classes.mjs
  // (B15, F-364); this section pins what only the e2e run can see — the check
  // READS the registry and reds naming file:line and the class (19b, planted
  // at the F-365 site), an allowance goes stale (19c), an unreadable file
  // fails by name (19k), a scope floors (19l), the manual keys join AGENTS.md
  // both ways (19e/19f), the pass line itemizes the sweep (19j). The former
  // 19a/19b2..19b9/19o/19o2/19g/19h/19i planted cases moved to the unit
  // suite verbatim, with the argument (rule 4): the consumer runs every row
  // through the one detectRow call the unit suite pins (sweepDefectClasses:
  // `for (const row of rows) detectRow(row, lines)`), so a second row's
  // planted red here cannot go green while 19b stays red and the unit suite
  // holds that row's detector — re-measuring it here is structurally
  // determined and costs a checker run per case.
  // Predictions, written before the first run: 19b → RED naming doc-lib and
  // stdout-then-exit; 19c → RED as a STALE allowance; 19e/19f → RED; 19j → the
  // pass line carries check 19's itemization.
  {
    // 19b: the F-365 site — runDocGenerator's `helpers.out({…})` followed by
    // process.exit is the F-360 defect at its flagship site, and the tester's
    // M-T2 mutant was GREEN on the W10 tip because WRITE_RE anchored the
    // write at line start. The receiver-qualified out is now seen; this pin
    // holds BOTH the row and the shipped shape together (rename the handle or
    // narrow the pattern and this reds).
    {
      const DL = "plugins/gs-superadmin/scripts/doc-lib.mjs";
      const snap = snapshotFiles([at(DL)]);
      try {
        mutate(DL, (s) => s.replace("process.exitCode = written.length === 0 && failed.length ? 1 : 0;", "process.exit(written.length === 0 && failed.length ? 1 : 0);"));
        const res = run();
        check("check 19b: runDocGenerator ending on process.exit after helpers.out( goes red at the F-365 site naming the class",
          res.status === 1 && res.stderr.includes(DL + ":") && res.stderr.includes('defect class "stdout-then-exit"'), res.stderr);
      } finally { snap.restore(); }
    }
    // 19c: the allowance ledger reads both ways — remove the only instance
    // behind an allowance row and the row is stale.
    {
      const CAP = "plugins/gs-superadmin/scripts/capture.mjs";
      const snap = snapshotFiles([at(CAP)]);
      try {
        mutate(CAP, (s) => s.replace("% 2 !== 0", "% 3 !== 0"));
        const res = run();
        check("check 19c: an allowance row whose file no longer carries the shape goes red as stale",
          res.status === 1 && res.stderr.includes(CAP) && /sanctioned in defect class "marker-parity-arithmetic"/.test(res.stderr) && /carries no instance/.test(res.stderr), res.stderr);
      } finally { snap.restore(); }
    }
    // 19k: an UNREADABLE in-scope file is returned by name and KEEPS its
    // allowance — never a stale row (prediction: unreadable = [capture.mjs],
    // no stale row for capture.mjs, doc-lib still swept). Pinned at the
    // engine (the registry itself; the rig's copy is byte-identical): making one
    // tracked file unreadable inside the e2e rig trips the checker's other reads.
    {
      const reg = { sweepDefectClasses };
      const CAP = "plugins/gs-superadmin/scripts/capture.mjs";
      const DL = "plugins/gs-superadmin/scripts/doc-lib.mjs";
      const r = reg.sweepDefectClasses([CAP, DL], (f) => (f === CAP ? null : readFileSync(at(f), "utf8")));
      check("check 19k: an unreadable in-scope file is reported by name and never as a stale allowance",
        r.unreadable.length === 1 && r.unreadable[0] === CAP && !r.stale.some((s) => s.file === CAP) && r.filesSwept === 1, r);
    }
    // 19l: the per-scope coverage floor (prediction: RED naming the scope) —
    // the registry's shipped scope pointed at a directory that does not exist.
    {
      const REG = "build/defect-classes.mjs";
      const snap = snapshotFiles([at(REG)]);
      try {
        mutate(REG, (s) => s.replace('shipped: (f) => f.endsWith(".mjs") && f.startsWith("plugins/gs-superadmin/")', 'shipped: (f) => f.endsWith(".mjs") && f.startsWith("plugins/zz-moved/")'));
        const res = run();
        check("check 19l: a scope predicate matching zero tracked files goes red (the F-095 floor)",
          res.status === 1 && /check 19 coverage: scope "shipped" matched 0 tracked files/.test(res.stderr), res.stderr);
      } finally { snap.restore(); }
    }
    // 19e / 19f: the manual-class keys and AGENTS.md's bullets, both directions.
    {
      const snap = snapshotFiles([at("AGENTS.md")]);
      try {
        mutate("AGENTS.md", (s) => s.replace("\x60Class: malformed-shape-readers\x60", "Class malformed-shape-readers"));
        const res = run();
        check("check 19e: a manual class losing its AGENTS.md bullet goes red",
          res.status === 1 && /manual defect class "malformed-shape-readers"/.test(res.stderr), res.stderr);
      } finally { snap.restore(); }
    }
    {
      const snap = snapshotFiles([at("AGENTS.md")]);
      try {
        mutate("AGENTS.md", (s) => s + "\n- \x60Class: zz-unregistered\x60 — probe bullet\n");
        const res = run();
        check("check 19f: AGENTS.md naming an unregistered class key goes red",
          res.status === 1 && /names \x60Class: zz-unregistered\x60/.test(res.stderr), res.stderr);
      } finally { snap.restore(); }
    }
    check("check 19j: the pass line itemizes the defect-class sweep (rows, files, hits, allowances)",
      /check 19: \d+ defect-class rows swept over \d+ files, 0 unsanctioned hits, \d+\/\d+ allowance rows live/.test(base.stdout), base.stdout);
  }

  // ── coverage floor (F-095 signature) — destructive to the rig index, LAST ──
  // Unindexing every nested tree leaves only top-level .md files tracked, which
  // is exactly the F-095 shell-glob signature (nested = 0) the floor exists for.
  {
    // --ignore-unmatch: on a release branch the dev/ directory is stripped, so
    // a hard pathspec crashed this suite the first time it ever ran on a
    // release tree (release/v0.31.9 PR gate, 2026-08-25). The case's floor
    // signature is unchanged either way — dev/ holds no nested .md the floor
    // counts on once plugins/reference/wiki are unindexed.
    execFileSync("git", ["rm", "-q", "--cached", "-r", "--ignore-unmatch", "plugins", "reference", "wiki", "dev"], { cwd: rig });
    const res = run();
    check("coverage floor: a shrunken tracked-md scan exits 1 with the F-095 signature",
      res.status === 1 && /coverage floor/.test(res.stderr) && /F-095 signature/.test(res.stderr), res.stderr);
  }
} finally {
  removeTempDir(rig);
}

if (failures) {
  console.log(`\ntest-check-doc-drift: ${failures} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`test-check-doc-drift: all ${passed} checks passed`);
