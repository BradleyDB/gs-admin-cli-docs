#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// test-check-imports.mjs — self-test for build/check-imports.mjs (GP-B5 DS-18,
// B1 hand-forward from W0/DS-14: the check landed with a mutation battery that
// lived only in the commit/PR record — this commits the teeth, so a lexer or
// declaration-table regression reds CI instead of surviving in silence).
//
// Method: copy the tracked working tree into a scratch git repo (the check
// roots itself at its own script location and enumerates that repo's
// `git ls-files -- *.mjs`), prove the baseline GREEN, then one mutation per
// case must go RED with the check's own message. Mutations touch only scratch
// copies (in-memory snapshot/restore, A-11); the real tree is never touched.
//
// What the cases pin, by family:
//   LEXER — a decoy file whose only "imports" live in comments, string and
//   template literals, and a regex literal in return position (the shape whose
//   char-level mis-lex the W0 review caught — A-9) adds no edges, WITH a
//   positive control (the pass line's tracked count must rise, so the decoy
//   provably reached the scan) and a companion case that breaks the checker's
//   regex-position rule and proves the decoy then registers (B2 review,
//   finder C — the first decoy spelling could not match the import matcher
//   even unstripped);
//   a dynamic import with no resolvable literal is a FAILURE, never a skip.
//   LANE TABLE — an undeclared cross-lane edge, a bare package specifier
//   (zero-dependency tenet 5), a file outside every declared lane, a broken
//   relative import (resolves to no tracked file), and the rig itself gaining
//   a local import (test-rig's mayImport is empty) all red.
//   RESTRICTED TABLE — journal-lib (mode "none") gaining ANY import, and the
//   guard (mode "builtins") gaining a local static import, both red (R-1/R-2).
//   DECLARATION ROT — a RESTRICTED path vanishing from the tracked set, an
//   EDGE_FLOORS key naming an undeclared lane, and a LAYERS prefix matching
//   no tracked file, all red (a rename cannot silently retire the rule it
//   declares).
//   DISCOVERY FLOORS — un-tracking a whole lane's suites trips its per-lane
//   floor (the F-200 anti-shrink teeth themselves, previously unpinned —
//   B2 review, finder C).
//   SANCTIONED DYNAMIC — the guard's lazy journal-lib edge cannot silently
//   retarget or vanish.
//
// Run:  node build/test-check-imports.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
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

const rig = makeTempDir("check-imports-test");
try {
  // .mjs files are what the check scans; .gitattributes keeps the scratch repo's
  // line-ending behavior identical to the real one.
  // package.json rides along (DS-42): the checker's manifest half reads it.
  // The workflow YAMLs ride along too (W8.5 review): the manifest half reads
  // their node-version lines against the @types/node major.
  copyTrackedTree(ROOT, rig, (f) => f.endsWith(".mjs") || f === ".gitattributes" || f === "package.json" || /^\.github\/workflows\/.*\.yml$/.test(f));
  initScratchGitRepo(rig);
  const CHECKER = join(rig, "build", "check-imports.mjs");
  const run = () => runNode(CHECKER, [], { cwd: rig });
  const at = (rel) => join(rig, rel);
  // Stale-anchor discipline (B2 review, altitude): a string-replace mutation
  // that no-ops must be a hard error, or its case reports a healthy gate as
  // broken when the real rot is the anchor.
  const mutate = (rel, fn) => {
    const before = readFileSync(at(rel), "utf8");
    const after = fn(before);
    if (after === before) throw new Error(`mutation anchor stale: ${rel} — the mutant did not apply`);
    writeFileSync(at(rel), after);
  };
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
  const trackedCount = (stdout) => Number(/(\d+) tracked \.mjs files/.exec(stdout)?.[1] ?? NaN);

  // ── baseline: the real tree's import graph is green ────────────────────────
  const base = run();
  check("baseline: working tree passes the check", base.status === 0, base.stderr || base.stdout);
  check("baseline: pass line reports lanes, edges, floors", /classified across .* lanes/.test(base.stdout), base.stdout);
  const baseCount = trackedCount(base.stdout);
  check("baseline: pass line carries a parseable tracked count", Number.isFinite(baseCount), base.stdout);

  // The decoy: import-shaped text in every non-code context. The regex decoy
  // is spelled so that a mis-lexed regex EXPOSES a matchable import statement
  // with a spec ("zzz-nope.mjs") that resolves to no tracked file — inert when
  // lexed correctly, loud when the A-9 rule breaks (see the companion case).
  const DECOY = {
    "build/zzz-lexer-decoy.mjs":
      '// import fakeA from "../plugins/gs-superadmin/scripts/doc-lib.mjs"\n' +
      "/* import fakeB from \"./nope.mjs\" */\n" +
      "const s = 'import fakeC from \"./nope.mjs\"';\n" +
      "const t = `import fakeD from \"./also-nope.mjs\"`;\n" +
      'function f() { return /import zzz from "zzz-nope.mjs"/; }\n' + // the W0 desync shape (A-9)
      "const g = (a, b) => a / b / 2;\n" + // division, not regex
      "export { s, t, f, g };\n",
  };

  // ── LEXER: decoys add no edges, and the decoy provably reached the scan ────
  withScratchFiles(DECOY, () => {
    const res = run();
    check("lexer: comment/string/template/regex decoys add no edges (stays green)", res.status === 0, res.stderr);
    check("lexer: positive control — the decoy file was scanned (tracked count +1)",
      trackedCount(res.stdout) === baseCount + 1, res.stdout);
  });

  // ── LEXER companion: break the regex-position rule; the decoy must register ─
  // This is the committed proof that the regex decoy has teeth: the exact
  // char-level mis-lex the W0 review caught (treating `/` after `return` as
  // division) leaks the regex body into code, where the import matcher sees
  // `import zzz from "zzz-nope.mjs"` and fails on the unknown file.
  // The code view is the registry's maskCode (F-385), so the mutant lives there.
  const LEXER = at("build/defect-classes.mjs");
  withScratchFiles(DECOY, () => {
    const snap = snapshotFiles([LEXER]);
    try {
      mutate("build/defect-classes.mjs", (s) => s.replace("KEYWORD_LEAD.has(word)", "false"));
      const res = run();
      check("lexer: with the keyword regex lead broken, the decoy's regex-body import registers and goes red",
        res.status === 1 && res.stderr.includes("zzz-nope.mjs"), res.stderr || res.stdout);
    } finally { snap.restore(); }
  });

  // ── LEXER: a nested template must not hide the import after it (F-385) ────
  // The tester's rig probe with its two controls: the plain import reds, the
  // same import under a PLAIN template reds, and the same import under the
  // NESTED-template shape F-384 measured at jo-report-program.mjs:217 (a
  // template inside `${ … }` whose body holds escaped backticks) used to stay
  // green — a single-mode lexer closes the outer template at the inner one,
  // reads the escaped backticks as openers, and is still in template mode on
  // the import line.
  const CROSS = 'import { stripBom } from "../plugins/gs-superadmin/scripts/doc-lib.mjs";\nexport { stripBom };\n';
  const NESTED = "const t = (m) => `- model: ${m.label}${m.model ? ` (\\`${m.model}\\`)` : \"\"}`;\n";
  const redOnCross = (res) => res.status === 1 && /undeclared edge/.test(res.stderr) && res.stderr.includes("zzz-nest");
  withScratchFiles({ "build/zzz-nest-control.mjs": CROSS }, () => {
    check("lexer/F-385 control: a cross-lane import alone goes red", redOnCross(run()), run().stderr);
  });
  withScratchFiles({ "build/zzz-nest-control2.mjs": "const t = `plain ${1 + 1}`;\n" + CROSS }, () => {
    check("lexer/F-385 control 2: the same import under a PLAIN template goes red — nesting, not templates, is the shape", redOnCross(run()), run().stderr);
  });
  withScratchFiles({ "build/zzz-nest-probe.mjs": NESTED + CROSS }, () => {
    const res = run();
    check("lexer/F-385 probe: the same import under the guard's NESTED-template shape goes red (the edge is seen)", redOnCross(res), res.stderr || res.stdout);
    const snap = snapshotFiles([LEXER]);
    try {
      mutate("build/defect-classes.mjs", (s) => s.replace('if (ch === "$" && nx === "{") { out[c + 1] = " "; c++; stack.push(0); prev = ""; word = ""; wordOpen = false; }', ""));
      const m = run();
      check("lexer/F-385 companion: with the substitution frame removed, the probe's edge is lost again (stays green)", m.status === 0, m.stderr || m.stdout);
    } finally { snap.restore(); }
  });
  withScratchFiles({ "build/zzz-hashbang.mjs": '#!/usr/bin/env node import zzz from "zzz-nope.mjs"\nexport const h = 1;\n' }, () => {
    const res = run();
    check("lexer/F-385: a hashbang line spelling an import is a comment (stays green)", res.status === 0, res.stderr || res.stdout);
  });

  // ── LANE TABLE: undeclared cross-lane edge ─────────────────────────────────
  withScratchFiles({
    "build/zzz-evil.mjs": 'import { stripBom } from "../plugins/gs-superadmin/scripts/doc-lib.mjs";\nexport { stripBom };\n',
  }, () => {
    const res = run();
    check("lane table: build → plugin-scripts edge goes red as undeclared",
      res.status === 1 && /undeclared edge/.test(res.stderr) && res.stderr.includes("zzz-evil.mjs"), res.stderr);
  });

  // ── LANE TABLE: bare package specifier (zero-dependency tenet) ─────────────
  withScratchFiles({ "build/zzz-bare.mjs": 'import _ from "lodash";\nexport default _;\n' }, () => {
    const res = run();
    check("lane table: bare package specifier goes red (tenet 5)",
      res.status === 1 && /bare specifier/.test(res.stderr), res.stderr);
  });

  // ── LANE TABLE: a file outside every declared lane ─────────────────────────
  withScratchFiles({ "zzz-stray.mjs": "export const x = 1;\n" }, () => {
    const res = run();
    check("lane table: a tracked .mjs outside every lane goes red",
      res.status === 1 && /not covered by any declared lane/.test(res.stderr), res.stderr);
  });

  // ── LANE TABLE: a relative import that resolves to no tracked file ─────────
  withScratchFiles({ "build/zzz-broken.mjs": 'import "./zzz-nonexistent.mjs";\n' }, () => {
    const res = run();
    check("lane table: an import resolving to a non-tracked file goes red",
      res.status === 1 && /not a tracked file/.test(res.stderr) && res.stderr.includes("zzz-nonexistent.mjs"), res.stderr);
  });

  // ── LANE TABLE: the rig itself may import nothing local (test-rig: []) ─────
  {
    const snap = snapshotFiles([at("test/rig.mjs")]);
    try {
      mutate("test/rig.mjs", (s) => 'import { stripBom } from "../plugins/gs-superadmin/scripts/doc-lib.mjs";\n' + s);
      const res = run();
      check("lane table: the rig gaining a local import goes red (test-rig imports nothing)",
        res.status === 1 && /undeclared edge/.test(res.stderr) && res.stderr.includes("test/rig.mjs"), res.stderr);
    } finally { snap.restore(); }
  }

  // ── RESTRICTED: journal-lib (mode none) gaining ANY import ─────────────────
  {
    const rel = "plugins/gs-superadmin/scripts/journal-lib.mjs";
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => 'import { basename } from "node:path";\n' + s);
      const res = run();
      check("RESTRICTED: journal-lib gaining even a builtin import goes red (R-2)",
        res.status === 1 && /declared no-import/.test(res.stderr) && res.stderr.includes(rel), res.stderr);
    } finally { snap.restore(); }
  }

  // ── RESTRICTED: the guard (mode builtins) gaining a local static import ────
  {
    const rel = "plugins/gs-superadmin/hooks/gs-admin-guard.mjs";
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => 'import { stripBom } from "../scripts/doc-lib.mjs";\n' + s);
      const res = run();
      check("RESTRICTED: the guard gaining a local static import goes red (R-1)",
        res.status === 1 && /declared builtin-only/.test(res.stderr) && res.stderr.includes(rel), res.stderr);
    } finally { snap.restore(); }
  }

  // ── DECLARATION ROT: a RESTRICTED path vanishing from the tracked set ──────
  {
    const rel = "plugins/gs-superadmin/scripts/render-cheatsheet.mjs";
    const snap = snapshotFiles([at(rel)]);
    try {
      rmSync(at(rel));
      gitAddAll(rig);
      const res = run();
      check("declaration rot: a vanished RESTRICTED file goes red, never silently retires",
        res.status === 1 && /declaration rot: RESTRICTED names/.test(res.stderr) && res.stderr.includes(rel), res.stderr);
    } finally {
      snap.restore();
      gitAddAll(rig);
    }
  }

  // ── DECLARATION ROT: EDGE_FLOORS keying an undeclared lane ─────────────────
  {
    const snap = snapshotFiles([CHECKER]);
    try {
      mutate("build/check-imports.mjs", (s) => s.replace("  build: { total: 17, sibling: 15, parent: 2 },", '  "build-zzz": { total: 17, sibling: 15, parent: 2 },'));
      const res = run();
      check("declaration rot: an EDGE_FLOORS key naming an undeclared lane goes red",
        res.status === 1 && /EDGE_FLOORS names lane/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // ── DECLARATION ROT: a LAYERS prefix matching no tracked file ──────────────
  {
    const snap = snapshotFiles([CHECKER]);
    try {
      mutate("build/check-imports.mjs", (s) => s.replace('prefix: "test/"', 'prefix: "zzz-tests/"'));
      const res = run();
      check("declaration rot: a lane whose prefix matches no tracked file goes red",
        res.status === 1 && /matches no tracked file/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // ── DISCOVERY FLOORS: un-tracking a lane's suites trips its floor ──────────
  {
    execFileSync("git", ["rm", "-q", "--cached", "-r", "plugins/gs-superadmin/test"], { cwd: rig });
    try {
      const res = run();
      check("discovery floor: a lane's edge count collapsing below its floor goes red (F-200)",
        res.status === 1 && /discovery floor: lane plugin-test/.test(res.stderr), res.stderr);
    } finally {
      gitAddAll(rig);
    }
  }

  // ── DISCOVERY FLOORS: the shape floor catches a spelling regression hub edges hide ──
  // (B5 W3, re-modelled at W8): blank every source line carrying a
  // parent-relative spec before the lex — the simulated lexer regression
  // drops all "../" edges repo-wide. build's TOTAL stays above its floor
  // (the "./lib.mjs" hub edges survive) and so does its SIBLING count, so
  // only the parent-shape floor can see the hole — and it sees it
  // structurally (the count goes to zero), however many sibling edges the
  // lane gains later (the W8 tail re-baseline this arm used to force).
  {
    const snap = snapshotFiles([CHECKER]);
    try {
      mutate("build/check-imports.mjs", (s) =>
        s.replace(
          'const src = readFileSync(join(ROOT, rel), "utf8");',
          'const src = readFileSync(join(ROOT, rel), "utf8").split("\\n").filter((l) => !l.includes("." + "./")).join("\\n");',
        ));
      const res = run();
      check("discovery floor: dropping every parent-relative spec trips the build PARENT-shape floor (hub and sibling edges cannot hide it)",
        res.status === 1 && /discovery floor: lane build yielded 0 parent-relative/.test(res.stderr), res.stderr);
      check("discovery floor: the same drop trips plugin-test's parent and deep shape floors",
        /discovery floor: lane plugin-test yielded 0 parent-relative/.test(res.stderr) && /discovery floor: lane plugin-test yielded 0 deep-relative/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }
  // ── DISCOVERY FLOORS: a floor naming a shape the classifier never yields is rot ──
  {
    const snap = snapshotFiles([CHECKER]);
    try {
      mutate("build/check-imports.mjs", (s) => s.replace("build: { total: 17, sibling: 15, parent: 2 }", "build: { total: 17, sibling: 15, parent: 2, tail: 1 }"));
      const res = run();
      check("discovery floor: an EDGE_FLOORS shape key the classifier never yields goes red as declaration rot",
        res.status === 1 && /declaration rot: EDGE_FLOORS\.build names shape "tail"/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // ── PREAMBLE RULE (DS-16): a build file re-spelling the root preamble goes red ──
  withScratchFiles({
    "build/zzz-preamble-probe.mjs":
      'import { join, dirname } from "node:path";\n' +
      'import { fileURLToPath } from "node:url";\n' +
      'export const ZZZ_ROOT = join(dirname(fileURLToPath(import' + '.meta.url)), "..");\n',
  }, () => {
    const res = run();
    check("preamble rule: a build-lane file re-spelling the root preamble goes red (F-267)",
      res.status === 1 && /re-spells the repo-root preamble/.test(res.stderr), res.stderr);
  });
  {
    const snap = snapshotFiles([CHECKER]);
    try {
      mutate("build/check-imports.mjs", (s) =>
        s.replace('PREAMBLE_HOMES = new Set(["build/lib.mjs"', 'PREAMBLE_HOMES = new Set(["build/zzz-retired.mjs"'));
      const res = run();
      check("declaration rot: a PREAMBLE_HOMES path naming no tracked file goes red",
        res.status === 1 && /PREAMBLE_HOMES names build\/zzz-retired\.mjs/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // ── RESTRICTED (DS-16): the shared module itself must stay builtin-only ────
  // The four scratch-rig harnesses copy exactly this one file beside the
  // script under test; a local import here breaks them all at spawn time.
  // The mutant's target must be inert at module scope (rig.mjs exports
  // functions only): the scratch checker imports lib.mjs itself, so an edge
  // to an EXECUTING script would crash the checker at load and prove nothing
  // about the RESTRICTED rule.
  {
    const rel = "build/lib.mjs";
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s + '\nimport "../test/rig.mjs";\n');
      const res = run();
      check("restricted: a local import growing in build/lib.mjs goes red (DS-16)",
        res.status === 1 && /build\/lib\.mjs: declared builtin-only \(DS-16\)/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }

  // ── MANIFEST (DS-42): the tenet-5 carve-out is data, enforced both ways ────
  // The import scan cannot see a package that is declared but never imported;
  // these arms prove the manifest half reds on creep (a runtime dependency
  // field; a third devDependency) and on loss (a ratified pin removed — the
  // tsc gate would silently stop running).
  {
    const snap = snapshotFiles([at("package.json")]);
    try {
      mutate("package.json", (s) => s.replace('"devDependencies": {', '"dependencies": { "left-pad": "1.3.0" },\n  "devDependencies": {'));
      const res = run();
      check("manifest: a runtime `dependencies` field in package.json goes red (tenet 5)",
        res.status === 1 && /package\.json: "dependencies" is declared/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
    const snap2 = snapshotFiles([at("package.json")]);
    try {
      mutate("package.json", (s) => s.replace('"typescript":', '"zzz-linter": "1.0.0",\n    "typescript":'));
      const res = run();
      check("manifest: a devDependency outside the ratified checker-only set goes red",
        res.status === 1 && /devDependencies beyond the ratified checker-only set: zzz-linter/.test(res.stderr), res.stderr);
    } finally { snap2.restore(); }
    const snap3 = snapshotFiles([at("package.json")]);
    try {
      mutate("package.json", (s) => s.replace(/,?\s*"typescript": "[^"]+"/, ""));
      const res = run();
      check("manifest: a ratified checker-only devDependency going missing goes red (the gate would vanish silently)",
        res.status === 1 && /ratified checker-only devDependencies missing: typescript/.test(res.stderr), res.stderr);
    } finally { snap3.restore(); }
    // The Node-major tie, both directions: the typings major moving alone
    // (the Dependabot PR #119 shape), and CI's Node major moving alone.
    const snap4 = snapshotFiles([at("package.json")]);
    try {
      mutate("package.json", (s) => s.replace(/"@types\/node": "\d+\./, '"@types/node": "26.'));
      const res = run();
      check("manifest: @types/node major moving away from CI's node-version goes red, naming both majors",
        res.status === 1 && /docs-drift\.yml: node-version 20 but package\.json pins @types\/node major 26/.test(res.stderr) &&
          /validate-plugin\.yml: node-version 20 but package\.json pins @types\/node major 26/.test(res.stderr), res.stderr);
    } finally { snap4.restore(); }
    const WF = ".github/workflows/docs-drift.yml";
    const snap5 = snapshotFiles([at(WF)]);
    try {
      mutate(WF, (s) => s.replace(/node-version: 20/, "node-version: 22"));
      const res = run();
      check("manifest: CI's node-version moving away from the @types/node major goes red, naming the workflow",
        res.status === 1 && /docs-drift\.yml: node-version 22 but package\.json pins @types\/node major 20/.test(res.stderr) &&
          !/validate-plugin\.yml: node-version/.test(res.stderr), res.stderr);
    } finally { snap5.restore(); }
    const snap6 = snapshotFiles([at(WF)]);
    try {
      mutate(WF, (s) => s.replace(/^\s*node-version: 20\n/m, ""));
      const res = run();
      check("manifest: a workflow losing its node-version line goes red (the major is read from there)",
        res.status === 1 && /docs-drift\.yml: no node-version line found/.test(res.stderr), res.stderr);
    } finally { snap6.restore(); }
  }

  // ── DYNAMIC: an unresolvable dynamic import is a failure, never a skip ─────
  withScratchFiles({
    "build/zzz-dyn.mjs": "const which = process.env.ZZZ_TARGET;\nexport const m = await import(which);\n",
  }, () => {
    const res = run();
    check("dynamic: import(<no literal>) goes red as unresolvable",
      res.status === 1 && /no resolvable literal/.test(res.stderr), res.stderr);
  });

  // ── SANCTIONED DYNAMIC: the guard's lazy edge cannot retarget or vanish ────
  {
    const rel = "plugins/gs-superadmin/hooks/gs-admin-guard.mjs";
    const snap = snapshotFiles([at(rel)]);
    try {
      mutate(rel, (s) => s.replace("../scripts/journal-lib.mjs", "../scripts/journal-lib-zzz.mjs"));
      const res = run();
      check("sanctioned dynamic: a retargeted lazy journal-lib edge goes red (floor demands the declared edge)",
        res.status === 1 && /sanctioned dynamic/.test(res.stderr), res.stderr);
    } finally { snap.restore(); }
  }
} finally {
  removeTempDir(rig);
}

if (failures) {
  console.log(`\ntest-check-imports: ${failures} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`test-check-imports: all ${passed} checks passed`);
