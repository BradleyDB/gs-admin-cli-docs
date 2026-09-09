#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scaffold.mjs (test) — fixtures for scripts/scaffold.mjs, the workspace
// scaffold writer (bus F-396).
//
// Every arm drives a COPY of the shipped writer placed inside a scratch
// "plugin" under the OS temp dir (<tmp>/fake-plugin/scripts/scaffold.mjs, with
// doc-lib.mjs beside it and a fake templates/ tree two levels up), so the
// templates it resolves from its own real path are the scratch ones and the
// suite can move a template between runs. Workspaces are scratch directories
// with a .gs-superadmin/ inside. Predictions written before the first run;
// every arm PASS on the shipped writer.
//
//   S1  no .gs-superadmin/ → exit 1 naming the setup order (every verb)
//   S2  fresh: apply copies the two §1 files verbatim + their pristine copies;
//       the pack is NOT copied (not adopted); counts.copied = 2
//   S3  current: a second apply changes no byte; counts.current = 2
//   S4  refreshable: template moves, workspace copy unedited → apply refreshes
//       W and P in place; counts.refreshed = 1
//   S5  offer: template moves, workspace copy EDITED → W untouched, W.new = the
//       new template, P unchanged, offers names it; a second apply is idempotent
//   S6  accept: W = new template, P = new, .new gone; apply → current
//   S7  keep: P = new, W keeps the edits, .new gone; apply → current (no re-ask)
//   S8  defer: P = new, .new stays; apply → current with pendingNew = 1
//   S9  removed: W deleted with P present → not re-created; counts.removed = 1
//   S16 removed + a decision verb (F-404): accept/keep/defer exit 1 naming the
//       state; W stays absent, no .new — mutant: drop the guard → W reappears
//   S17 accept on a CONVENTIONS.md carrying the legacy decline comment (F-403)
//       writes the standalone marker before overwriting — the answer survives
//   S10 adoptable (legacy): W present, no P, W == template → P written, W untouched
//   S11 untracked (legacy): W present, no P, W != template → offer + .new
//   S12 pack: only in scope once .gs-superadmin/conventions/ exists or
//       --adopt-pack (which creates it and copies the pack as fresh)
//   S13 check is read-only: byte-identical workspace tree before and after, and
//       it reports the would-be states (behind, untracked, pendingNew)
//   S14 CRLF-insensitive: an unedited copy saved with CRLF still refreshes
//   S15 decision on a path out of scope (a pack file, pack not adopted) → exit 1
//       naming the pack; a bare `accept` with no path → exit 1
//
// Run:  node plugins/gs-superadmin/test/scaffold.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTempDir, removeTempDir, writeFiles, runNode } from "../../../test/rig.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHIPPED = join(HERE, "..", "scripts", "scaffold.mjs");
const DOC_LIB = join(HERE, "..", "scripts", "doc-lib.mjs");

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`PASS  ${label}`);
  else {
    failures++;
    console.log(`FAIL  ${label}`);
    if (detail !== undefined) console.log(`      ${typeof detail === "string" ? detail.slice(0, 700) : JSON.stringify(detail).slice(0, 700)}`);
  }
}

const OM_V1 = "# Operating Model v1\n\n- bullet one\n- bullet two\n";
const OM_V2 = "# Operating Model v2\n\n- bullet one\n- bullet two\n- bullet three (new template)\n";
const CONV_V1 = "# Conventions\n\n> yours to edit\n";
const PACK_INDEX = "# Pack index\n";
const PACK_NAMING = "# Naming\n";

const ROOT = makeTempDir("scaffold-test");
try {
  const PLUGIN = join(ROOT, "fake-plugin");
  mkdirSync(join(PLUGIN, "scripts"), { recursive: true });
  copyFileSync(SHIPPED, join(PLUGIN, "scripts", "scaffold.mjs"));
  copyFileSync(DOC_LIB, join(PLUGIN, "scripts", "doc-lib.mjs"));
  writeFiles(PLUGIN, {
    "templates/operating-model.md": OM_V1,
    "templates/CONVENTIONS.md": CONV_V1,
    "templates/conventions/index.md": PACK_INDEX,
    "templates/conventions/naming.md": PACK_NAMING,
  });
  const WRITER = join(PLUGIN, "scripts", "scaffold.mjs");
  const setTemplate = (rel, text) => writeFileSync(join(PLUGIN, "templates", rel), text, "utf8");

  const run = (ws, args) => {
    const res = runNode(WRITER, args, { cwd: ws });
    let json = null;
    try {
      json = JSON.parse(res.stdout);
    } catch {
      json = null;
    }
    return { res, json };
  };
  let n = 0;
  const newWs = () => {
    const ws = join(ROOT, `ws-${++n}`);
    mkdirSync(join(ws, ".gs-superadmin"), { recursive: true });
    return ws;
  };
  const W = (ws, rel) => join(ws, ".gs-superadmin", rel);
  const P = (ws, rel) => join(ws, ".gs-superadmin", "scaffold", rel);
  const N = (ws, rel) => join(ws, ".gs-superadmin", `${rel}.new`);
  const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);
  const stateOf = (json, rel) => json?.files?.find((f) => f.rel === rel)?.state ?? null;
  /** Every file under a directory with its bytes, for the read-only proof. */
  const snapshot = (dir) => {
    const out = {};
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else out[relative(dir, p).replace(/\\/g, "/")] = readFileSync(p, "utf8");
      }
    };
    walk(dir);
    return out;
  };
  const resetTemplates = () => {
    setTemplate("operating-model.md", OM_V1);
    setTemplate("CONVENTIONS.md", CONV_V1);
  };

  // ── S1 no workspace ────────────────────────────────────────────────────────
  {
    const bare = join(ROOT, "bare");
    mkdirSync(bare, { recursive: true });
    for (const v of [["check"], ["apply"], ["accept", "operating-model.md"]]) {
      const { res } = run(bare, v);
      check(`S1 ${v[0]}: no .gs-superadmin/ → exit 1 naming setup's Phase 2`, res.status === 1 && /no \.gs-superadmin\/ directory/.test(res.stderr) && /Phase 2/.test(res.stderr), res.stderr);
    }
  }

  // ── S2 fresh · S3 current ──────────────────────────────────────────────────
  {
    const ws = newWs();
    const a = run(ws, ["apply"]);
    check("S2 fresh: exit 0, both §1 files copied verbatim, pristine copies written, pack NOT copied", a.res.status === 0 && a.json?.ok === true && read(W(ws, "operating-model.md")) === OM_V1 && read(W(ws, "CONVENTIONS.md")) === CONV_V1 && read(P(ws, "operating-model.md")) === OM_V1 && read(P(ws, "CONVENTIONS.md")) === CONV_V1 && !existsSync(W(ws, "conventions")) && a.json?.counts?.copied === 2 && a.json?.counts?.inScope === 2 && a.json?.packInScope === false, a.json ?? a.res.stderr);
    check("S2 fresh: the summary reports the tree as it now IS (current x2), no offers, next null", a.json?.counts?.current === 2 && a.json?.offers?.length === 0 && a.json?.next === null, a.json?.counts);
    const before = snapshot(join(ws, ".gs-superadmin"));
    const b = run(ws, ["apply"]);
    check("S3 current: a second apply changes no byte; counts.current = 2, nothing copied/refreshed/offered", b.res.status === 0 && JSON.stringify(snapshot(join(ws, ".gs-superadmin"))) === JSON.stringify(before) && b.json?.counts?.current === 2 && b.json?.counts?.copied === 0 && b.json?.counts?.refreshed === 0 && b.json?.counts?.offered === 0, b.json?.counts);
  }

  // ── S4 refreshable ─────────────────────────────────────────────────────────
  {
    const ws = newWs();
    run(ws, ["apply"]);
    setTemplate("operating-model.md", OM_V2);
    const c = run(ws, ["check"]);
    check("S4 check before apply: the moved template reads refreshable (behind = 1), CONVENTIONS current", stateOf(c.json, "operating-model.md") === "refreshable" && stateOf(c.json, "CONVENTIONS.md") === "current" && c.json?.counts?.behind === 1, c.json?.files);
    const a = run(ws, ["apply"]);
    check("S4 refreshable: unedited copy + moved template → W and P refreshed in place, counts.refreshed = 1, then current", a.res.status === 0 && read(W(ws, "operating-model.md")) === OM_V2 && read(P(ws, "operating-model.md")) === OM_V2 && a.json?.counts?.refreshed === 1 && stateOf(a.json, "operating-model.md") === "current" && !existsSync(N(ws, "operating-model.md")), a.json?.counts);
    resetTemplates();
  }

  // ── S5 offer · S6 accept ───────────────────────────────────────────────────
  {
    const ws = newWs();
    run(ws, ["apply"]);
    const EDITED = OM_V1 + "\n- my local bullet\n";
    writeFileSync(W(ws, "operating-model.md"), EDITED, "utf8");
    setTemplate("operating-model.md", OM_V2);
    const a = run(ws, ["apply"]);
    check("S5 offer: edited copy + moved template → W untouched, W.new = new template, P unchanged, offers names it, counts.offered = 1", a.res.status === 0 && read(W(ws, "operating-model.md")) === EDITED && read(N(ws, "operating-model.md")) === OM_V2 && read(P(ws, "operating-model.md")) === OM_V1 && a.json?.offers?.length === 1 && a.json?.offers?.[0]?.rel === "operating-model.md" && /local edits/.test(a.json?.offers?.[0]?.why ?? "") && a.json?.counts?.offered === 1 && a.json?.counts?.pendingNew === 1 && typeof a.json?.next === "string", a.json ?? a.res.stderr);
    const before = snapshot(join(ws, ".gs-superadmin"));
    const b = run(ws, ["apply"]);
    check("S5 offer is idempotent: a second apply changes no byte and offers again (the ask is the skill's, once)", JSON.stringify(snapshot(join(ws, ".gs-superadmin"))) === JSON.stringify(before) && b.json?.offers?.length === 1, b.json?.counts);
    const d = run(ws, ["accept", "operating-model.md"]);
    check("S6 accept: W = new template, P = new, .new removed, decided.stateAfter current", d.res.status === 0 && read(W(ws, "operating-model.md")) === OM_V2 && read(P(ws, "operating-model.md")) === OM_V2 && !existsSync(N(ws, "operating-model.md")) && d.json?.decided?.verb === "accept" && d.json?.decided?.stateAfter === "current", d.json ?? d.res.stderr);
    const e = run(ws, ["apply"]);
    check("S6 after accept: apply reports current, no offers", stateOf(e.json, "operating-model.md") === "current" && e.json?.offers?.length === 0, e.json?.files);
    resetTemplates();
  }

  // ── S7 keep · S8 defer ─────────────────────────────────────────────────────
  {
    const ws = newWs();
    run(ws, ["apply"]);
    const EDITED = OM_V1 + "\n- kept edit\n";
    writeFileSync(W(ws, "operating-model.md"), EDITED, "utf8");
    setTemplate("operating-model.md", OM_V2);
    run(ws, ["apply"]);
    const k = run(ws, ["keep", "operating-model.md"]);
    check("S7 keep: W keeps the edits, P = new template, .new removed", k.res.status === 0 && read(W(ws, "operating-model.md")) === EDITED && read(P(ws, "operating-model.md")) === OM_V2 && !existsSync(N(ws, "operating-model.md")) && k.json?.decided?.verb === "keep", k.json ?? k.res.stderr);
    const k2 = run(ws, ["apply"]);
    check("S7 keep recorded: the next apply reads current — the same template version is never asked about twice", stateOf(k2.json, "operating-model.md") === "current" && k2.json?.offers?.length === 0 && k2.json?.counts?.pendingNew === 0, k2.json?.files);

    // defer: edit again, move the template again, defer
    const EDITED2 = EDITED + "- another edit\n";
    writeFileSync(W(ws, "operating-model.md"), EDITED2, "utf8");
    const OM_V3 = OM_V2 + "- bullet four\n";
    setTemplate("operating-model.md", OM_V3);
    const o = run(ws, ["apply"]);
    check("S8 setup: the second move is offered again (P was v2, W edited)", stateOf(o.json, "operating-model.md") === "offer" && read(N(ws, "operating-model.md")) === OM_V3, o.json?.files);
    const f = run(ws, ["defer", "operating-model.md"]);
    check("S8 defer: W keeps the edits, P = v3, .new STAYS", f.res.status === 0 && read(W(ws, "operating-model.md")) === EDITED2 && read(P(ws, "operating-model.md")) === OM_V3 && read(N(ws, "operating-model.md")) === OM_V3 && f.json?.decided?.pendingNew === true, f.json ?? f.res.stderr);
    const f2 = run(ws, ["check"]);
    check("S8 deferred: check reads current with pendingNew = 1 and behind = 0 (the hook names the waiting .new, not a stale copy)", stateOf(f2.json, "operating-model.md") === "current" && f2.json?.counts?.pendingNew === 1 && f2.json?.counts?.behind === 0, f2.json?.counts);
    resetTemplates();
  }

  // ── S9 removed ─────────────────────────────────────────────────────────────
  {
    const ws = newWs();
    run(ws, ["apply"]);
    rmSync(W(ws, "CONVENTIONS.md"));
    const a = run(ws, ["apply"]);
    check("S9 removed: a file the user deleted (pristine present) is not re-created; counts.removed = 1", a.res.status === 0 && !existsSync(W(ws, "CONVENTIONS.md")) && stateOf(a.json, "CONVENTIONS.md") === "removed" && a.json?.counts?.removed === 1 && a.json?.counts?.copied === 0, a.json?.files);
    setTemplate("CONVENTIONS.md", CONV_V1 + "\nmoved\n");
    const b = run(ws, ["apply"]);
    check("S9 removed stays removed even when its template moves", !existsSync(W(ws, "CONVENTIONS.md")) && !existsSync(N(ws, "CONVENTIONS.md")) && stateOf(b.json, "CONVENTIONS.md") === "removed", b.json?.files);
    resetTemplates();
  }

  // ── S10 adoptable · S11 untracked (legacy workspaces, no pristine copies) ──
  {
    const ws = newWs();
    writeFileSync(W(ws, "operating-model.md"), OM_V1, "utf8"); // unmodified legacy copy
    writeFileSync(W(ws, "CONVENTIONS.md"), CONV_V1 + "\n- an org rule\n", "utf8"); // edited legacy copy
    const c = run(ws, ["check"]);
    check("S10/S11 check: legacy copies read adoptable (unmodified) and untracked (differs); counts.untracked counts only the differing one", stateOf(c.json, "operating-model.md") === "adoptable" && stateOf(c.json, "CONVENTIONS.md") === "untracked" && c.json?.counts?.untracked === 1 && c.json?.counts?.adoptable === 1, c.json?.files);
    const a = run(ws, ["apply"]);
    check("S10 adoptable: P written, W untouched, counts.adopted = 1, then current", read(P(ws, "operating-model.md")) === OM_V1 && read(W(ws, "operating-model.md")) === OM_V1 && a.json?.counts?.adopted === 1 && stateOf(a.json, "operating-model.md") === "current", a.json?.counts);
    check("S11 untracked: offered — W untouched, .new = template, no P yet, offers.why names tracking", read(W(ws, "CONVENTIONS.md")) === CONV_V1 + "\n- an org rule\n" && read(N(ws, "CONVENTIONS.md")) === CONV_V1 && !existsSync(P(ws, "CONVENTIONS.md")) && a.json?.offers?.length === 1 && /predates template tracking/.test(a.json?.offers?.[0]?.why ?? ""), a.json?.offers);
    const k = run(ws, ["keep", "CONVENTIONS.md"]);
    const k2 = run(ws, ["check"]);
    check("S11 keep on a legacy offer records it: P written, .new gone, check reads current", k.res.status === 0 && read(P(ws, "CONVENTIONS.md")) === CONV_V1 && !existsSync(N(ws, "CONVENTIONS.md")) && stateOf(k2.json, "CONVENTIONS.md") === "current", k2.json?.files);
  }

  // ── S12 pack scope ─────────────────────────────────────────────────────────
  {
    const ws = newWs();
    const a = run(ws, ["apply"]);
    check("S12 pack not adopted: pack files out of scope, directory not created", a.json?.counts?.inScope === 2 && !existsSync(W(ws, "conventions")), a.json?.counts);
    const b = run(ws, ["apply", "--adopt-pack"]);
    check("S12 --adopt-pack: creates conventions/, copies the pack as fresh with pristine copies, inScope = 4, packInScope true", b.res.status === 0 && read(W(ws, "conventions/index.md")) === PACK_INDEX && read(W(ws, "conventions/naming.md")) === PACK_NAMING && read(P(ws, "conventions/naming.md")) === PACK_NAMING && b.json?.counts?.inScope === 4 && b.json?.counts?.copied === 2 && b.json?.packInScope === true, b.json?.counts);
    const c = run(ws, ["apply"]);
    check("S12 adopted pack stays in scope without the flag (the directory is the marker)", c.json?.counts?.inScope === 4 && c.json?.counts?.current === 4, c.json?.counts);
    rmSync(W(ws, "conventions/naming.md"));
    const d = run(ws, ["apply"]);
    check("S12 a deleted pack file stays removed", stateOf(d.json, "conventions/naming.md") === "removed" && !existsSync(W(ws, "conventions/naming.md")), d.json?.files);
  }

  // ── S13 check is read-only ─────────────────────────────────────────────────
  {
    const ws = newWs();
    writeFileSync(W(ws, "operating-model.md"), OM_V1 + "\nedit\n", "utf8"); // legacy edited → would be offered
    const before = snapshot(join(ws, ".gs-superadmin"));
    const c = run(ws, ["check", "--json"]);
    check("S13 check: byte-identical tree before and after; reports would-be states (untracked 1, fresh 1) and writes no .new", c.res.status === 0 && JSON.stringify(snapshot(join(ws, ".gs-superadmin"))) === JSON.stringify(before) && stateOf(c.json, "operating-model.md") === "untracked" && stateOf(c.json, "CONVENTIONS.md") === "fresh" && c.json?.counts?.copied === 0 && c.json?.counts?.offered === 0 && !existsSync(N(ws, "operating-model.md")), c.json?.counts);
  }

  // ── S14 CRLF-insensitive ───────────────────────────────────────────────────
  {
    const ws = newWs();
    run(ws, ["apply"]);
    writeFileSync(W(ws, "operating-model.md"), "\uFEFF" + OM_V1.replace(/\n/g, "\r\n"), "utf8"); // an editor's re-save: BOM + CRLF, no edit
    setTemplate("operating-model.md", OM_V2);
    const a = run(ws, ["apply"]);
    check("S14 CRLF/BOM re-save is not an edit: the moved template refreshes in place (LF bytes of the template), no offer", read(W(ws, "operating-model.md")) === OM_V2 && a.json?.counts?.refreshed === 1 && a.json?.offers?.length === 0, a.json?.counts);
    resetTemplates();
  }

  // ── S15 decision argument errors ───────────────────────────────────────────
  {
    const ws = newWs();
    run(ws, ["apply"]);
    const a = run(ws, ["accept", "conventions/index.md"]);
    check("S15 decision on a pack file with the pack not adopted → exit 1 naming the pack", a.res.status === 1 && /not a scaffolded template in scope/.test(a.res.stderr) && /pack is not adopted/.test(a.res.stderr), a.res.stderr);
    const b = run(ws, ["accept"]);
    check("S15 bare accept → exit 1 asking for the rel", b.res.status === 1 && /needs the offer's template-relative path/.test(b.res.stderr), b.res.stderr);
    const c = run(ws, ["bogus"]);
    check("S15 unknown verb → exit 1 with usage", c.res.status === 1 && /usage:/.test(c.res.stderr), c.res.stderr);
    check("S15 the workspace is untouched by the refused verbs", statSync(W(ws, "operating-model.md")).isFile() && !existsSync(W(ws, "conventions")), null);
  }

  // ── S16 removed + decision verbs (F-404) ──────────────────────────────────
  {
    resetTemplates();
    for (const verb of ["accept", "keep", "defer"]) {
      const ws = newWs();
      run(ws, ["apply"]);
      rmSync(W(ws, "CONVENTIONS.md"));
      const r = run(ws, [verb, "CONVENTIONS.md"]);
      check(`S16 ${verb} on a removed file: exit 1 naming the state; W stays absent; no .new`,
        r.res.status === 1 && /is removed/.test(r.res.stderr) && /stays removed/.test(r.res.stderr) && !existsSync(W(ws, "CONVENTIONS.md")) && !existsSync(N(ws, "CONVENTIONS.md")), r.res.stderr);
    }
  }

  // ── S17 accept migrates the legacy decline comment to the marker file (F-403) ──
  {
    resetTemplates();
    const ws = newWs();
    run(ws, ["apply"]);
    writeFileSync(W(ws, "CONVENTIONS.md"), CONV_V1 + "\n<!-- gs-superadmin: conventions-pack declined -->\n", "utf8");
    setTemplate("CONVENTIONS.md", CONV_V1 + "\n> a moved template\n");
    const a = run(ws, ["apply"]);
    check("S17 the legacy-declined CONVENTIONS.md is an offer when its template moves (edited, by the comment)", stateOf(a.json, "CONVENTIONS.md") === "offer", a.json?.files);
    const d = run(ws, ["accept", "CONVENTIONS.md"]);
    check("S17 accept writes .gs-superadmin/conventions-pack-declined before overwriting, so the decline survives (mutant: drop the migration → no marker)",
      d.res.status === 0 && existsSync(W(ws, "conventions-pack-declined")) && !/conventions-pack declined/.test(read(W(ws, "CONVENTIONS.md")) ?? ""), d.res.stderr);
    resetTemplates();
  }
} finally {
  removeTempDir(ROOT);
}

console.log(failures === 0 ? "\nAll scaffold fixtures passed." : `\n${failures} scaffold fixture(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
