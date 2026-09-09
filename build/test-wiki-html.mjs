#!/usr/bin/env node
// Fixture tests for build/build-wiki.mjs (F-079).
//
// The generator's failure modes are silent by nature: the CI drift check only
// proves the committed HTML matches a rebuild, so a parsing defect that mangles
// output stably would pass forever (the class F-075 closed for the sibling
// build-comparison-html.mjs — this suite is the same shape, reusing its
// temp-rig harness pattern). Pins the markdown grammar's behaviors — including
// the F-078 GFM `\|` table-cell escape and the F-076 code-span stash
// hardening — plus link routing, byte-stability, and (against the committed
// tree) that every outbound non-hash anchor the wiki emits resolves to a file
// that exists next to it, including both comparison-guide.html entry points
// from F-077. Since T-9 v4 (S-D2, 2026-09-05) the grammar is single code in
// build/lib.mjs, and this suite is its home: the T-9 block at the end pins
// the shared block parser and inline core with hand-spelled expectations,
// each mutation-proved in memory.
//
// Zero dependencies. Each run copies the generator into a temp rig with the
// directory shape it expects (../data, ../reference, ../build/wiki-assets);
// the repo tree is never touched.

import {
  readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync, existsSync, mkdtempSync, readdirSync, statSync, symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ROOT, renderInlineCore, escapeHtml, splitPipeRow, parseBlocks } from "./lib.mjs";
import { FIXTURE_README, FIXTURE_NOTICE_META, noticeOf, stripTags, noticeParagraphsOf } from "./notice-fixture.mjs";
import { spawnSync } from "node:child_process";

const GENERATOR = join(ROOT, "build", "build-wiki.mjs");
const ASSETS = join(ROOT, "build", "wiki-assets");

let passed = 0;
const failures = [];
const ok = (name, cond) => {
  if (cond) passed++;
  else failures.push(name);
};

// Minimal catalog: the generator reads meta.cliVersion, meta.generatedAt and
// commands.length and embeds the rest verbatim for the runtime app (which
// these tests never run). The meta is the shared notice fixture's
// (build/notice-fixture.mjs) — the [DATE] rule must override the fixture
// README's stale date/pin — and there are no commands.
const FIXTURE_CATALOG = { meta: FIXTURE_NOTICE_META, commands: [] };

// The six DOC_ORDER slugs the generator requires on disk.
const DOC_SLUGS = ["architecture", "auth", "mcp", "lane2-runtime", "output-formats", "building-on-gs-admin"];

// Build the rig, drop `markdown` in as architecture.md, run the generator,
// return { status, stderr, html }. `link` ("argv1" | "preserve") invokes the
// copied generator THROUGH a junction to the rig's build dir — the two sides
// of build/lib.mjs's isMainModule realpath test (F-208 standard, DS-47 review
// round); `linkUnavailable` is returned when links cannot be created here.
function runGenerator(markdown, { link = null, readme = FIXTURE_README, catalog = FIXTURE_CATALOG } = {}) {
  const rig = mkdtempSync(join(tmpdir(), "wiki-html-test-"));
  try {
    mkdirSync(join(rig, "build", "wiki-assets"), { recursive: true });
    mkdirSync(join(rig, "data"));
    mkdirSync(join(rig, "reference", "workflows"), { recursive: true });
    writeFileSync(join(rig, "build", "gen.mjs"), readFileSync(GENERATOR));
    // lib.mjs rides along beside the copied script (DS-16): the script under
    // test imports it, and the copy's own location roots ROOT at the rig.
    copyFileSync(join(ROOT, "build", "lib.mjs"), join(rig, "build", "lib.mjs"));
    writeFileSync(join(rig, "build", "wiki-assets", "app.css"), readFileSync(join(ASSETS, "app.css")));
    writeFileSync(join(rig, "build", "wiki-assets", "app.js"), readFileSync(join(ASSETS, "app.js")));
    writeFileSync(join(rig, "data", "catalog.json"), JSON.stringify(catalog));
    writeFileSync(join(rig, "README.md"), readme);
    for (const slug of DOC_SLUGS) {
      writeFileSync(join(rig, "reference", slug + ".md"), slug === "architecture" ? markdown : `# ${slug}\n\nStub.\n`);
    }
    writeFileSync(join(rig, "reference", "workflows", "index.md"), "# Workflows\n\nFixture index.\n");
    writeFileSync(join(rig, "reference", "workflows", "rollout.md"), "# Workflow: Test Flow\n\nFixture body.\n");
    let argv = [join(rig, "build", "gen.mjs")];
    if (link) {
      // "junction" works unprivileged on Windows; the type is ignored on
      // POSIX. F-137 rule: only cannot-create-links errors may downgrade to
      // a skip.
      const linkDir = join(rig, "build-link");
      try { symlinkSync(join(rig, "build"), linkDir, "junction"); }
      catch (e) {
        if (["EPERM", "EACCES", "ENOSYS"].includes(e?.code)) return { status: null, stderr: "", html: null, linkUnavailable: true };
        throw e;
      }
      argv = [...(link === "preserve" ? ["--preserve-symlinks-main"] : []), join(linkDir, "gen.mjs")];
    }
    const res = spawnSync(process.execPath, argv, { encoding: "utf8" });
    const outPath = join(rig, "wiki", "index.html");
    const html = existsSync(outPath) ? readFileSync(outPath, "utf8") : null;
    return { status: res.status, stderr: res.stderr ?? "", html };
  } finally {
    rmSync(rig, { recursive: true, force: true });
  }
}

// Pull one embedded JSON payload (DOCS / WORKFLOWS / CATALOG) back out of the page.
function embedded(html, name) {
  const m = html.match(new RegExp(`^window\\.${name}=(.*);$`, "m"));
  return m ? JSON.parse(m[1]) : null;
}

// ---------------------------------------------------------------- main fixture
const FIXTURE = `# Fixture Title

Intro paragraph with **bold**, *starred em*, _underscored em_, and 2 * 3 * 4 staying plain.

Two spans \`one\` mid \`two\` end.

A guarded span: \`**not bold** [not](link) a|b\` stays literal.

Links: [Arch](architecture.md), [Jo](domains/journey.md), [Home](domains/index.md),
[WF](workflows/rollout.md), [Ext](https://example.com/x), [Anchor](#sec),
[Plugin](../plugins/gs-superadmin/README.md), [Root](../README.md),
[Comp](comparison-guide.md).

###### Six deep

---

- item one
  continues here
- item two

1. first
2. second

> Quote line
> - alpha
> - beta

> Two-line quote sentence with
> \`re x list|describe\` inside.

- pipe item spans
  \`a|b\` continuation

Escaped \\| pipe in prose.

\`\`\`
<b>&</b> | pipe
\`\`\`

## Tables

| Col A | Col B |
|---|---|
| a \\| b | plain |
| x | y | z |
| solo |
`;

const run = runGenerator(FIXTURE);
ok("generator exits 0 on the fixture corpus", run.status === 0);
ok("wiki/index.html is written", run.html !== null);

if (run.html) {
  const docs = embedded(run.html, "DOCS");
  const wf = embedded(run.html, "WORKFLOWS");
  ok("DOCS payload embeds all six guide pages", Array.isArray(docs) && docs.length === 6);
  const arch = docs?.find((d) => d.slug === "architecture")?.html ?? "";

  // headings / hr
  ok("h1 renders", arch.includes("<h1>Fixture Title</h1>"));
  ok("h6 renders", arch.includes("<h6>Six deep</h6>"));
  ok("hr renders", arch.includes("<hr>"));

  // inline formatting
  ok("bold renders", arch.includes("<strong>bold</strong>"));
  ok("starred emphasis renders", arch.includes("<em>starred em</em>"));
  ok("underscored emphasis renders", arch.includes("<em>underscored em</em>"));
  ok("bare arithmetic stars stay plain", arch.includes("2 * 3 * 4 staying plain"));

  // code spans (the F-076-hardened stash path)
  ok("two spans restore in order, exactly once", arch.includes("Two spans <code>one</code> mid <code>two</code> end."));
  ok(
    "code-span contents are immune to emphasis/link/table parsing",
    arch.includes("<code>**not bold** [not](link) a|b</code>")
  );
  ok("no stash sentinel leaks into output (no NUL byte anywhere)", !/\u0000/.test(run.html));

  // link routing (resolveLink)
  ok("sibling doc routes to #/doc/", arch.includes('<a href="#/doc/architecture">Arch</a>'));
  ok("domain doc routes to #/domain/", arch.includes('<a href="#/domain/journey">Jo</a>'));
  ok("domains index routes to #/home", arch.includes('<a href="#/home">Home</a>'));
  ok("workflow doc routes to #/workflow/", arch.includes('<a href="#/workflow/rollout">WF</a>'));
  ok("external link opens in a new tab", arch.includes('<a href="https://example.com/x" target="_blank" rel="noopener">Ext</a>'));
  ok("bare anchor passes through", arch.includes('<a href="#sec">Anchor</a>'));

  // F-082: out-of-corpus .md links become plain relative hrefs, never dead
  // #/doc/ hash routes; comparison-guide.md maps to its real standalone page
  ok(
    "out-of-corpus plugin link is a relative href, not a hash route (F-082)",
    arch.includes('<a href="../plugins/gs-superadmin/README.md">Plugin</a>')
  );
  ok("out-of-corpus root link is a relative href (F-082)", arch.includes('<a href="../README.md">Root</a>'));
  ok("comparison-guide.md maps to the standalone page (F-082)", arch.includes('<a href="comparison-guide.html">Comp</a>'));
  ok("no #/doc/ route escapes the reference corpus (F-082)", !arch.includes("#/doc/plugins/") && !arch.includes("#/doc/README"));

  // lists
  ok("list continuation line joins its item", arch.includes("<li>item one continues here</li>"));
  ok("second list item renders", arch.includes("<li>item two</li>"));
  ok("ordered list renders", arch.includes("<ol><li>first</li><li>second</li></ol>"));

  // blockquote (recursive)
  ok("blockquote renders its paragraph", arch.includes("<blockquote><p>Quote line</p>"));
  ok("blockquote renders its nested list", arch.includes("<li>alpha</li><li>beta</li></ul></blockquote>"));

  // F-080: a pipe inside a code span is text, not a table signal
  ok(
    "code-span pipe does not split a blockquote sentence (F-080)",
    arch.includes("<blockquote><p>Two-line quote sentence with <code>re x list|describe</code> inside.</p></blockquote>")
  );
  ok(
    "code-span pipe does not tear a list continuation out of its item (F-080)",
    arch.includes("<li>pipe item spans <code>a|b</code> continuation</li>")
  );
  ok("escaped pipe in prose renders as a bare pipe (F-080)", arch.includes("Escaped | pipe in prose."));

  // code fence
  ok("fence contents are HTML-escaped verbatim", arch.includes("<pre><code>&lt;b&gt;&amp;&lt;/b&gt; | pipe</code></pre>"));

  // tables — F-078: GFM \| escape
  ok("escaped pipe renders as a literal pipe in ONE cell", arch.includes("<td>a | b</td><td>plain</td>"));
  ok("no stray backslash survives the escaped pipe", !arch.includes("<td>a \\</td>"));
  ok("row wider than the header drops extra cells", arch.includes("<td>x</td><td>y</td></tr>") && !arch.includes("<td>z</td>"));
  ok("row narrower than the header pads with empty cells", arch.includes("<td>solo</td><td></td>"));
  ok("header cells render as th", arch.includes("<th>Col A</th><th>Col B</th>"));

  // workflows payload
  ok("workflow title strips the Workflow: prefix", wf?.items?.[0]?.title === "Test Flow");
  ok("workflows index page renders", (wf?.index?.html ?? "").includes("Fixture index."));

  // version stamp from the catalog
  ok("topbar cites the catalog cliVersion", run.html.includes(">v0.0.0-test</span>"));

  // byte-stability: same inputs → same bytes
  const rerun = runGenerator(FIXTURE);
  ok("output is byte-stable across runs", rerun.html === run.html);
}

// F-076 bounds-guard probe (separate run — its input deliberately contains a
// sentinel-shaped byte sequence, which the main fixture's strict no-NUL
// assertion must never see): a never-issued stash index must restore untouched,
// not as <code>undefined</code>. The sequence is untypeable in markdown, so it
// is injected programmatically.
{
  const NUL = String.fromCharCode(0);
  const probe = `# Probe\n\nA real span \`kept\` beside a fake sentinel ${NUL}GSC99${NUL} in prose.\n`;
  const res = runGenerator(probe);
  ok("bounds probe: generator exits 0", res.status === 0);
  const arch = res.html ? (embedded(res.html, "DOCS")?.find((d) => d.slug === "architecture")?.html ?? "") : "";
  ok("bounds probe: never-issued sentinel index does not become <code>undefined</code>", !arch.includes("<code>undefined</code>"));
  ok("bounds probe: real code span still restores exactly once", arch.includes("<code>kept</code>"));
  ok("bounds probe: the fake sentinel text passes through untouched", arch.includes("GSC99"));
}

// T-9 v4 (S-D2): behaviours the wiki GAINED from the shared block parser,
// pinned at the rig level (the generator's real layout over the real
// parser): nested list items, the star hr form, and the fail-loud contract —
// a separator-only table is a non-zero exit with no page written, never a
// silently dropped block.
{
  const gained = runGenerator("# G\n\n- top\n  - child\n  - second\n- next\n  1. sub\n\n***\n");
  const arch = gained.html ? (embedded(gained.html, "DOCS")?.find((d) => d.slug === "architecture")?.html ?? "") : "";
  ok("T-9 v4 rig: a 2-space-indented marker nests as a child list", arch.includes("<li>top<ul><li>child</li><li>second</li></ul></li>"));
  ok("T-9 v4 rig: an ordered child nests as <ol>", arch.includes("<li>next<ol><li>sub</li></ol></li>"));
  ok("T-9 v4 rig: the *** hr form renders", arch.includes("<hr>"));
  const sepOnly = runGenerator("# S\n\n|---|---|\n");
  ok("T-9 v4 rig: a separator-only table fails the build loudly (non-zero exit, no page, the reason on stderr)",
    sepOnly.status !== 0 && sepOnly.html === null && /only separator rows/.test(sepOnly.stderr));
}

// ── GP-18 · the currency / unaffiliated notice ───────────────────────────────
// The page carries README.md's notice VERBATIM and BY CONSTRUCTION: the
// generator reads the README's blockquote at build time (lib.mjs's emitter)
// and computes the [DATE] rule's values from the catalog meta. Rig arms prove
// the read is live (the fixture README's own wording appears; an edited
// README changes the page; a README without the blockquote fails the build)
// and the date is computed (the fixture README says 1999-12-31 / 0.0.1, the
// page must say the catalog's 2031-01-02 / 0.0.0-test). The committed-tree
// arm below is the verbatim check itself: the shipped page's notice text
// equals README.md's paragraphs with the real catalog's date substituted.
{
  const r = runGenerator("# T\n\nBody.\n");
  const n = noticeOf(r.html);
  const ps = noticeParagraphsOf(n);
  ok("GP-18 rig: the notice footer renders on the page shell, under the content column, with its heading", /<div class="contentcol">\s*<main class="content" id="content"><\/main>\s*<footer class="notice"><h4>Notice<\/h4>/.test(r.html ?? ""));
  ok("GP-18 rig: Currency first (both its paragraphs), then Unaffiliated; Support expectations does not ride",
    ps.length === 3 && ps[0].startsWith("Currency.") && ps[1].startsWith("Fixture second currency paragraph") && ps[2].startsWith("Unaffiliated community project.") && !n.includes("Support expectations"));
  ok("GP-18 rig: the date and the pin are COMPUTED from the catalog meta, not copied from the README",
    ps[0].includes("last updated on 2031-01-02 (against @gainsight/gs-admin-cli@0.0.0-test)") && !n.includes("1999-12-31") && !n.includes("0.0.1"));
  ok("GP-18 rig: the notice's markdown renders through the page's inline wrapper (code, em, external link opens in a new tab)",
    n.includes("<code>code</code>") && n.includes("<em>em</em>") && n.includes('<a href="https://support.example.com" target="_blank" rel="noopener">support link</a>'));
  const edited = runGenerator("# T\n\nBody.\n", { readme: FIXTURE_README.replace("Fixture unaffiliated sentence", "EDITED unaffiliated sentence") });
  ok("GP-18 rig: an edited README changes the rebuilt page (the read is live, not a template)", noticeOf(edited.html).includes("EDITED unaffiliated sentence") && !noticeOf(edited.html).includes("Fixture unaffiliated sentence"));
  const noQuote = runGenerator("# T\n\nBody.\n", { readme: "# No notice here\n\nJust prose.\n" });
  ok("GP-18 rig: a README without the notice blockquote fails the build loudly", noQuote.status !== 0 && noQuote.html === null && /no blockquote carrying/.test(noQuote.stderr));
  const noDate = runGenerator("# T\n\nBody.\n", { readme: FIXTURE_README.replace("last updated on 1999-12-31", "last updated recently") });
  ok("GP-18 rig: a Currency paragraph without the date phrase fails the build (nothing to substitute)", noDate.status !== 0 && noDate.html === null && /nothing to substitute/.test(noDate.stderr));
}
// Committed tree: the shipped notice text equals README.md's blockquote
// paragraphs (selected/ordered by the same emitter, the real catalog's date
// substituted), both sides rendered through the wiki's inline wrapper and
// tag-stripped. Self-check: the comparison must go red when the README text
// is edited without a rebuild — the deletion test for "verbatim".
{
  const wikiMod = await import("./build-wiki.mjs");
  const { noticeParagraphs, readJsonFile } = await import("./lib.mjs");
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const meta = readJsonFile(join(ROOT, "data", "catalog.json")).meta;
  const expected = (md) => noticeParagraphs(md, meta).map((p) => stripTags(wikiMod.renderInline(p, "reference")));
  const shipped = noticeParagraphsOf(noticeOf(readFileSync(join(ROOT, "wiki", "index.html"), "utf8")));
  ok("GP-18 committed: wiki/index.html's notice is README.md's blockquote verbatim, with the catalog's date and pin",
    shipped.length === 3 && JSON.stringify(shipped) === JSON.stringify(expected(readme)) && shipped[0].includes(`last updated on ${String(meta.generatedAt).slice(0, 10)} (against @gainsight/gs-admin-cli@${meta.cliVersion})`));
  ok("GP-18 committed self-check: a README edit without a rebuild reads as a mismatch (the verbatim arm can red)",
    JSON.stringify(shipped) !== JSON.stringify(expected(readme.replace("This project is not affiliated", "This project is not connected"))));

  // F-405: the blockquote's structure is declared — every undeclared change
  // the Gate 2 verifier found silent under the old shape-inferred loop must
  // now THROW (in-memory README mutants; the repo is never written).
  const throwsWith = (md, re) => { try { noticeParagraphs(md, meta); return false; } catch (e) { return re.test(e.message); } };
  const SUPPORT_END = "CLI itself go to Gainsight, not here.\n";
  ok("F-405: a lead-less paragraph under the README-only Support lead throws (it used to be dropped silently)",
    readme.includes(SUPPORT_END) && throwsWith(readme.replace(SUPPORT_END, SUPPORT_END + ">\n> A lead-less paragraph nobody declared.\n"), /follows the README-only \*\*Support expectations\.\*\*/));
  ok("F-405: a non-paragraph block inside the blockquote throws (it used to be skipped silently)",
    throwsWith(readme.replace(SUPPORT_END, SUPPORT_END + ">\n> - a bullet in the notice\n"), /carries a list block/));
  ok("F-405: an undeclared bold lead throws (it used to open a group nobody emitted)",
    throwsWith(readme.replace("Because this process wasn't built", "**Compatibility.** Because this process wasn't built"), /undeclared lead \*\*Compatibility\.\*\*/));
  ok("F-405: a lead opened twice throws",
    throwsWith(readme.replace(SUPPORT_END, SUPPORT_END + ">\n> **Currency.** again.\n"), /opens \*\*Currency\.\*\* twice/));
  ok("F-405: a lead-less paragraph after an EMITTED lead still rides with it (the second Currency paragraph's rule)",
    noticeParagraphs(readme.replace("for the latest information and Admin CLI package.\n", "for the latest information and Admin CLI package.\n>\n> A third currency paragraph.\n"), meta).length === 4);
}

// ------------------------------------------- committed tree: outbound anchors
// The drift workflow guarantees the committed wiki pages match a rebuild, so
// asserting against them asserts the build's real output. Every non-hash,
// non-external href each shipped page carries — in static markup, in the
// embedded DOCS/WORKFLOWS html, or as an app.js file reference — must resolve
// to a file that exists relative to wiki/, or the wiki's outbound links are
// dead (the F-077 regression class).
{
  const wikiDir = join(ROOT, "wiki");
  const pages = readdirSync(wikiDir).filter((f) => f.endsWith(".html"));
  ok(
    "committed wiki ships at least index + comparison-guide",
    pages.includes("index.html") && pages.includes("comparison-guide.html")
  );

  let totalChecked = 0;
  const missing = [];
  const indexFileRefs = new Set();
  for (const page of pages) {
    const committed = readFileSync(join(wikiDir, page), "utf8");
    const refs = new Set();
    // href="x" in static markup and href=\"x\" inside the embedded JSON payloads
    for (const m of committed.matchAll(/href=\\?"([^"\\]+)\\?"/g)) refs.add(m[1]);
    // app.js-side file references (e.g. the COMPARISON_GUIDE const)
    for (const m of committed.matchAll(/href:\s*"([^"]+)"/g)) refs.add(m[1]);

    // Drop ONLY the known JS template-literal interpolations from the inlined
    // app source (`href="${href}"`) — exact patterns, so a markdown-emitted
    // href that happens to contain "${" is still validated, not masked.
    const APP_TEMPLATE_REFS = new Set(["${href}", "${COMPARISON_GUIDE.href}"]);
    const fileRefs = [...refs].filter(
      (h) => !h.startsWith("#") && !/^(https?:|mailto:)/.test(h) && !APP_TEMPLATE_REFS.has(h)
    );
    totalChecked += fileRefs.length;
    for (const h of fileRefs) {
      if (!existsSync(join(wikiDir, h.split("#")[0]))) missing.push(`${page} → ${h}`);
      if (page === "index.html") indexFileRefs.add(h.split("#")[0]);
    }
  }
  ok(
    `every outbound file href in every committed wiki page resolves (${totalChecked} checked across ${pages.length} pages)`,
    totalChecked > 0 && missing.length === 0
  );
  if (missing.length) console.error("  dead outbound hrefs: " + missing.join(", "));
  ok(
    "the comparison-guide outbound link (F-077) is present and resolves",
    indexFileRefs.has("comparison-guide.html") && existsSync(join(wikiDir, "comparison-guide.html"))
  );

  // Hash-route counterpart (F-082): the file sweep above is blind to #/…
  // routes by construction, so validate them against the embedded payloads —
  // every emitted #/doc/, #/workflow/, and #/domain/ href must name a slug
  // the app actually has a page for.
  const committedIndex = readFileSync(join(wikiDir, "index.html"), "utf8");
  const docSlugs = new Set((embedded(committedIndex, "DOCS") ?? []).map((d) => d.slug));
  const wfPayload = embedded(committedIndex, "WORKFLOWS") ?? { items: [] };
  const wfSlugs = new Set(wfPayload.items.map((w) => w.slug));
  const domainNs = new Set(((embedded(committedIndex, "CATALOG") ?? {}).domains ?? []).map((d) => d.namespace));
  const deadRoutes = [];
  // Skip ONLY the app source's known template interpolations — exact patterns,
  // so a markdown-emitted route containing "${" is validated, not masked
  // (renderInline escapes HTML chars but leaves "${" intact, so an author
  // typing [x](${foo}.md) WOULD reach this check).
  const APP_TEMPLATE_SLUGS = new Set(["${d.slug}", "${d.namespace}", "${c.domain}"]);
  for (const m of committedIndex.matchAll(/href=\\?"#\/(doc|workflow|domain)\/([^"\\#]+)\\?"/g)) {
    const [, kind, slug] = m;
    if (APP_TEMPLATE_SLUGS.has(slug)) continue;
    const okRoute =
      kind === "doc" ? docSlugs.has(slug) : kind === "workflow" ? wfSlugs.has(slug) : domainNs.has(slug);
    if (!okRoute) deadRoutes.push(`#/${kind}/${slug}`);
  }
  ok(
    "every emitted #/doc, #/workflow, #/domain route matches a payload slug (F-082)",
    docSlugs.size > 0 && wfSlugs.size > 0 && deadRoutes.length === 0
  );
  if (deadRoutes.length) console.error("  dead hash routes: " + [...new Set(deadRoutes)].join(", "));
}

// ── DS-47 (review round): build/lib.mjs's isMainModule, pinned on BOTH sides ──
// The build lane's copy of the CLI-entry realpath test guards both markdown
// generators' mains, so a one-sided compare would turn `npm run build:wiki`
// on a junctioned checkout into a silent exit-0 no-op (F-117) — the F-208
// standard the other two copies already meet. Through a junction the
// generator must still BUILD: under a bare spawn (the argv1 side realpathed)
// AND under --preserve-symlinks-main (the self side — the loader keeps the
// linked spelling in import.meta.url there, F-149).
{
  const viaLink = runGenerator(FIXTURE, { link: "argv1" });
  if (viaLink.linkUnavailable) {
    ok("junction invocation fixtures for build/lib.mjs isMainModule (F-208) [link creation unavailable — skipped]", true);
  } else {
    ok("junction invocation still runs the build (argv1 side realpathed, F-208)", viaLink.status === 0 && viaLink.html !== null);
    const viaPreserve = runGenerator(FIXTURE, { link: "preserve" });
    ok("junction invocation still runs the build under --preserve-symlinks-main (self side realpathed, F-149/F-208)",
      viaPreserve.status === 0 && viaPreserve.html !== null);
  }
}

// ── T-9 v4 · the shared grammar's absolute pins ──────────────────────────────
// Since the S-D2 unification (2026-09-05) both build-lane generators consume
// ONE block parser and ONE inline core from build/lib.mjs, so the corpus
// differential and the axis-tagged boundary battery this block used to run
// (DS-25's registered sync mechanism for two parsers) have nothing left to
// compare. What replaces them is the format lock the differential's tier 3
// already was — hand-spelled expectations executed on the IMPORTED grammar:
//   (a) BLOCK pins, one per former axis (and per decision-table row), on
//       lib.mjs's parseBlocks;
//   (b) INLINE pins on both generators' wrappers (they still differ only in
//       link routing and their declared extras);
//   (c) the corpus floor — every shipped markdown file parses and renders,
//       at real volume, so a grammar regression cannot hide behind a
//       shrunken sweep;
//   (d) consumption pins — both generators import the shared grammar and
//       define no line-splitting block parser of their own (the tell of a
//       regrown copy);
//   (e) instrument self-checks — every pin is mutation-proved by recompiling
//       lib.mjs's parser / core with a seeded defect in memory and asserting
//       the pin goes red. No file is touched; a seed that no longer matches
//       its slice is a hard failure at the point of rot, and each slice is
//       validated against its import before any mutant built from it is
//       trusted (the DS-47 rule).
{
  const wikiSrc = readFileSync(GENERATOR, "utf8");
  const cmpSrc = readFileSync(join(ROOT, "build", "build-comparison-html.mjs"), "utf8");
  const libSrc = readFileSync(join(ROOT, "build", "lib.mjs"), "utf8");
  const sliceBetween = (s, a, b, label) => {
    const i = s.indexOf(a);
    const j = i === -1 ? -1 : s.indexOf(b, i + a.length);
    if (i === -1 || j === -1) throw new Error(`T-9 pins: ${label} anchors not found — re-anchor the slice`);
    return s.slice(i, j);
  };
  const CORE_SLICE = sliceBetween(libSrc, "export function renderInlineCore", "\n}\n", "inline core") + "\n}";
  // The parser slice opens at its first regex constant (they precede the
  // function) and closes at the parser's own brace.
  const PARSER_SLICE = sliceBetween(libSrc, "const HR_RE = ", "\n}\n", "block parser") + "\n}";
  const WIKI_INLINE_SLICE = sliceBetween(wikiSrc, "function renderInline(", "\n}\n", "wiki inline wrapper") + "\n}";
  const CMP_INLINE_SLICE = sliceBetween(cmpSrc, "function inline(", "\n}\n", "comparison inline wrapper") + "\n}";
  const compileSlice = (slice, returns, deps) =>
    new Function(...Object.keys(deps), slice + `\n; return { ${returns.join(", ")} };`)(...Object.values(deps));
  const compileCore = (slice) => compileSlice(slice.replace(/^export /, ""), ["renderInlineCore"], { escapeHtml }).renderInlineCore;
  const compileParser = (slice) =>
    compileSlice(slice.replace("export function parseBlocks", "function parseBlocks"), ["parseBlocks"], { splitPipeRow }).parseBlocks;
  // Each wrapper compiles against a caller-supplied core (the REAL one for
  // slice validation, a seeded one for the self-checks) and a routing stub —
  // the pins below normalize hrefs away, so routing never enters them.
  const compileWikiInline = (core) =>
    compileSlice(WIKI_INLINE_SLICE, ["renderInline"], { renderInlineCore: core, resolveLink: (u) => ({ href: u, ext: false }) }).renderInline;
  const compileCmpInline = (core) =>
    compileSlice(CMP_INLINE_SLICE, ["inline"], { renderInlineCore: core, resolveLink: (u) => u }).inline;
  const seed = (slice, from, to, label) => {
    if (!slice.includes(from)) throw new Error(`T-9 self-check ${label}: seed pattern not in slice — update the mutant`);
    return slice.split(from).join(to);
  };

  // The REAL grammar layers are the generators' exports (DS-47). Importing a
  // generator must build nothing: snapshot both committed outputs first and
  // assert them untouched after the imports — the pin on the isMainModule
  // guards (an unguarded main would rewrite its output here, mtime and all).
  // A missing output is an assertion failure, never a crash (review round).
  const outStat = (p) => { const s = statSync(p, { throwIfNoEntry: false }); return s ? `${s.size}:${s.mtimeMs}` : "absent"; };
  const OUTPUTS = [join(ROOT, "wiki", "index.html"), join(ROOT, "wiki", "comparison-guide.html")];
  const outputsBefore = OUTPUTS.map(outStat);
  const wikiMod = await import("./build-wiki.mjs");
  const cmpMod = await import("./build-comparison-html.mjs");
  ok("DS-47: importing the generators' renderer layers writes neither output (both mains guarded by isMainModule; both outputs present)",
    !outputsBefore.includes("absent") && JSON.stringify(OUTPUTS.map(outStat)) === JSON.stringify(outputsBefore));
  const wiki = { mdToHtml: wikiMod.mdToHtml, renderInline: wikiMod.renderInline };
  const cmp = { inline: cmpMod.inline };

  // (d) consumption: the shared grammar is imported AND used by both, and
  // neither generator splits markdown into lines itself any more — a
  // regrown block parser cannot avoid that first step.
  const IMPORTS_GRAMMAR = /import \{[^}]*\bparseBlocks\b[^}]*\} from "\.\/lib\.mjs"/;
  const LINE_SPLIT = /\.split\(\s*(?:"\\n"|\/\\r\?\\n\/)\s*\)/;
  ok("T-9 v4: both generators import parseBlocks from lib.mjs, call it, call renderInlineCore, and split no markdown into lines themselves",
    [wikiSrc, cmpSrc].every((s) => IMPORTS_GRAMMAR.test(s) && /\bparseBlocks\(md\)/.test(s) && /return renderInlineCore\(/.test(s) && !LINE_SPLIT.test(s)));

  // (a) BLOCK pins — one per decision-table row on lib.mjs's parseBlocks.
  /** @type {Array<[string, string, unknown]>} */
  const BLOCK_PINS = [
    ["list-nesting", "- top\n  - child\n", [{ type: "list", ordered: false, items: [{ text: "top", children: ["child"], childOrdered: false }] }]],
    ["table-detection", "a | b\nx | y\n", [{ type: "p", text: "a | b x | y" }]],
    ["blockquote-strictness", ">= 50 rows required.\n", [{ type: "p", text: ">= 50 rows required." }]],
    ["hr-forms", "***\n___\n---\n", [{ type: "hr" }, { type: "hr" }, { type: "hr" }]],
    ["fence-close", "```\ncode\n``` x\nmore\n```\n", [{ type: "code", text: "code\n``` x\nmore" }]],
    ["paragraph-interrupts", "ships in\n173. more text\n", [{ type: "p", text: "ships in 173. more text" }]],
    ["paragraph-interrupts (1. does)", "ships in\n1. first\n", [{ type: "p", text: "ships in" }, { type: "list", ordered: true, items: [{ text: "first", children: [] }] }]],
    ["heading-whitespace", "#\tTabbed  \n", [{ type: "h1", text: "Tabbed" }]],
    ["list markers", "* star\n* two\n", [{ type: "list", ordered: false, items: [{ text: "star", children: [] }, { text: "two", children: [] }] }]],
    ["list continuation is indented", "- item\n  continues\nnot part\n", [{ type: "list", ordered: false, items: [{ text: "item continues", children: [] }] }, { type: "p", text: "not part" }]],
    ["paragraph lines trimmed", "  lead\n   wrapped  \n", [{ type: "p", text: "lead wrapped" }]],
    ["table separator dropped, blank header kept", "|  |  |\n|---|---|\n| a | b |\n", [{ type: "table", header: ["", ""], body: [["a", "b"]] }]],
    ["quote nests blocks", "> Q\n> - a\n", [{ type: "quote", blocks: [{ type: "p", text: "Q" }, { type: "list", ordered: false, items: [{ text: "a", children: [] }] }] }]],
    // The progress guarantee: a line no block branch takes is paragraph text,
    // consumed unconditionally — under the old while-loop shape an indented
    // heading (interrupt-shaped, heading-branch-rejected) stalled the parser
    // (found by the heading-whitespace mutant, which hung the suite to OOM).
    // No mutant here on purpose: reverting the do/while would hang, not fail.
    ["indented heading is prose (progress guard)", "  # not a heading\n", [{ type: "p", text: "# not a heading" }]],
    ["indented bullet outside a list is prose", "  - not an item\n", [{ type: "p", text: "- not an item" }]],
  ];
  const blockPinFails = (parse) =>
    BLOCK_PINS.filter(([, md, expect]) => { try { return JSON.stringify(parse(md)) !== JSON.stringify(expect); } catch { return true; } }).map(([l]) => l);
  const throwsOnSeparatorOnly = (parse) => { try { parse("|---|---|\n"); return false; } catch (e) { return /only separator rows/.test(e.message); } };
  // F-409: a separator-shaped line absorbed into prose is a throw — the
  // pipe-less GFM table is the one shape this grammar does not read, and it
  // must be loud rather than fold its dashes into a paragraph.
  const throwsOnSeparatorOutside = (parse) => { try { parse("col a | col b\n--- | ---\n1 | 2\n"); return false; } catch (e) { return /separator row outside a table/.test(e.message); } };
  const parserFails = (parse) => [
    ...blockPinFails(parse),
    ...(throwsOnSeparatorOnly(parse) ? [] : ["separator-only throws"]),
    ...(throwsOnSeparatorOutside(parse) ? [] : ["separator-shaped prose throws"]),
  ];
  ok("T-9 v4 (F-409): a pipe-less table's separator row in prose throws, naming the leading-pipe rule", throwsOnSeparatorOutside(parseBlocks));
  ok("T-9 v4 block pins: the imported parseBlocks matches every hand-spelled expectation", blockPinFails(parseBlocks).length === 0);
  if (blockPinFails(parseBlocks).length) console.error("  block pins failing: " + blockPinFails(parseBlocks).join(", "));
  ok("T-9 v4: a separator-only table throws (fail loud in both generators)", throwsOnSeparatorOnly(parseBlocks));

  // (c) the corpus floor — every markdown file either generator ships,
  // GLOBBED so a new doc joins automatically; a shrunken glob is not a pass.
  const CORPUS = [
    ...readdirSync(join(ROOT, "reference")).filter((f) => f.endsWith(".md"))
      .map((f) => [`reference/${f}`, readFileSync(join(ROOT, "reference", f), "utf8"), "reference"]),
    ...readdirSync(join(ROOT, "reference", "workflows")).filter((f) => f.endsWith(".md"))
      .map((f) => [`reference/workflows/${f}`, readFileSync(join(ROOT, "reference", "workflows", f), "utf8"), "reference/workflows"]),
  ];
  const countBlocks = (bs) => bs.reduce((n, b) => n + 1 + (b.type === "quote" ? countBlocks(b.blocks) : 0), 0);
  let corpusBlocks = 0;
  const corpusErrors = [];
  for (const [name, md, baseDir] of CORPUS) {
    try { corpusBlocks += countBlocks(parseBlocks(md)); wiki.mdToHtml(md, baseDir); }
    catch (e) { corpusErrors.push(`${name}: ${e.message}`); }
  }
  ok("T-9 v4 corpus floor: every shipped markdown file parses and renders (>=12 files, >=250 blocks)",
    corpusErrors.length === 0 && CORPUS.length >= 12 && corpusBlocks >= 250);
  if (corpusErrors.length) console.error("  corpus errors: " + corpusErrors.join("; "));

  // Slice ⇔ import, before any slice-built object seeds a mutant: the parser
  // slice over the whole corpus, the core slice and both wrapper slices over
  // the inline probes (every construct the pins name lives in one of them).
  const assertSliceMatchesImport = (label, drifted) => {
    if (drifted) throw new Error(`T-9 pins: ${label} no longer matches its import — re-anchor the slice`);
  };
  const sliceParser = compileParser(PARSER_SLICE);
  for (const [name, md] of CORPUS)
    assertSliceMatchesImport(`PARSER_SLICE on ${name}`, JSON.stringify(sliceParser(md)) !== JSON.stringify(parseBlocks(md)));
  const INLINE_PROBES = [
    "plain **bold** *em* `code` text", "an _underscored_ case and 2 * 3 * 4", "Escaped \\| pipe here",
    "see [in](auth.md#top), [ext](https://example.com/x), [anchor](#x)",
    'A [titled](guide.md "The Title") link and a [paren](gu(id)e.md) link', "quotes \"stay\" &amp; escape",
  ];
  const sliceCore = compileCore(CORE_SLICE);
  const sliceWikiInline = compileWikiInline(renderInlineCore), sliceCmpInline = compileCmpInline(renderInlineCore);
  // hrefs, ext-target, titles: routing is the per-page difference the stubs
  // above replace; every other byte must match.
  const hn = (h) => h.replace(/ href="[^"]*"/g, "").replace(/ target="_blank" rel="noopener"/g, "").replace(/ title="[^"]*"/g, "").replace(/\s+/g, " ").trim();
  for (const t of INLINE_PROBES) {
    assertSliceMatchesImport("CORE_SLICE", sliceCore(t, { renderLinks: (x) => x }) !== renderInlineCore(t, { renderLinks: (x) => x }));
    assertSliceMatchesImport("WIKI_INLINE_SLICE", hn(sliceWikiInline(t, "reference")) !== hn(wiki.renderInline(t, "reference")));
    assertSliceMatchesImport("CMP_INLINE_SLICE", hn(sliceCmpInline(t)) !== hn(cmp.inline(t)));
  }

  // (b) INLINE pins — hand-spelled expected HTML for the shared core's
  // guarantees on BOTH wrappers (escape-in-span, stash-before-everything
  // order, sentinel restore guard, strong/em, the GFM \| prose unescape).
  const ABS = [
    ["plain text", "plain text"],
    ["with **bold** run", "with <strong>bold</strong> run"],
    ["a *starred em* run", "a <em>starred em</em> run"],
    ["guarded `a|b [x](y)` span", "guarded <code>a|b [x](y)</code> span"],
    // escape-in-span: the ONLY escape a code span's content receives.
    ["entities `a<b&c>` span", "entities <code>a&lt;b&amp;c&gt;</code> span"],
    // order: stash runs BEFORE links and emphasis, restore runs LAST —
    // markup inside a span must come back verbatim.
    ["order `**x** *y* [z](q)` span", "order <code>**x** *y* [z](q)</code> span"],
    // em guard: a dangling ** tail must not become emphasis.
    ["loose **a* stays plain", "loose **a* stays plain"],
    ["see [target](auth.md) end", "see <a>target</a> end"],
    ["2 * 3 * 4 stays plain", "2 * 3 * 4 stays plain"],
    ['quotes "stay" &amp; escape', "quotes &quot;stay&quot; &amp;amp; escape"],
    // GFM \| in prose renders as a bare pipe on BOTH pages (F-080; core-level
    // since T-9 v4) — a code-span pipe is untouched by the same rule.
    ["Escaped \\| pipe and `a|b` span", "Escaped | pipe and <code>a|b</code> span"],
    // never-issued sentinel indices restore untouched (?? m), never as "".
    ["stray \u0000GSC7\u0000 end", "stray \u0000GSC7\u0000 end"],
  ];
  const failedAbs = (w, c) => {
    const bad = [];
    for (const [t, expect] of ABS) {
      const a = hn(w(t, "reference")), b = hn(c(t));
      if (a !== b || a !== expect) bad.push(t);
    }
    return bad;
  };
  ok("T-9 v4 inline pins: both wrappers match every hand-spelled expectation", failedAbs(wiki.renderInline, cmp.inline).length === 0);
  if (failedAbs(wiki.renderInline, cmp.inline).length) console.error("  inline pins failing: " + failedAbs(wiki.renderInline, cmp.inline).join(" | "));
  const wU = wiki.renderInline("an _underscored_ case", "reference"), cU = cmp.inline("an _underscored_ case");
  ok("T-9 v4 inline extras: _underscore_ em is wiki-only (wiki <em>, comparison literal)",
    wU.includes("<em>underscored</em>") && !cU.includes("<em>") && hn(wU) !== hn(cU));
  const cT = cmp.inline('a [titled](guide.md "The Title") link');
  ok("T-9 v4 inline extras: the titled link is comparison-only (title attr there, literal on the wiki)",
    / title="The Title"/.test(cT) && !/ title=/.test(wiki.renderInline('a [titled](guide.md "The Title") link', "reference")));

  // (e) instrument self-checks — seeded defects recompiled in memory. Each
  // parser mutant names the pin that must catch it (pred:KILL for every row;
  // the copy-out in the PR body is this table's measured result).
  const PARSER_MUTANTS = [
    ["blockquote-strictness", "const QUOTE_RE = /^\\s*>(\\s|$)/;", "const QUOTE_RE = /^\\s*>/;", "blockquote-strictness"],
    ["paragraph-interrupts", "|1\\.[ \\t]|", "|\\d+\\.[ \\t]|", "paragraph-interrupts"],
    ["list-nesting", "const child = items.length && lines[i].match(CHILD_MARKER_RE);", "const child = null;", "list-nesting"],
    ["fence-close", "/^```\\s*$/.test(lines[i])", 'lines[i].startsWith("```")', "fence-close"],
    ["hr-forms", "const HR_RE = /^\\s*(-{3,}|\\*{3,}|_{3,})\\s*$/;", "const HR_RE = /^\\s*-{3,}\\s*$/;", "hr-forms"],
    ["heading-whitespace", "const HEADING_RE = /^(#{1,6})[ \\t]+(.*?)\\s*$/;", "const HEADING_RE = /^(#{1,6}) (.*?)\\s*$/;", "heading-whitespace"],
    ["table separator filter", 'r.includes("-")', "false", "table separator dropped, blank header kept"],
    ["separator-only throw", 'if (!cells.length) throw new Error("table has only separator rows — nothing to render");', "", "separator-only throws"],
    ["list continuation lazy", "/^ {2,}\\S/.test(lines[i])", "/\\S/.test(lines[i])", "list continuation is indented"],
    ["star bullets", "const TOP_MARKER_RE = /^(?:([-*])|(\\d+)\\.)[ \\t]+(.*)$/;", "const TOP_MARKER_RE = /^(?:(-)|(\\d+)\\.)[ \\t]+(.*)$/;", "list markers"],
    ["paragraph trim", "buf.push(lines[i].trim());", "buf.push(lines[i]);", "paragraph lines trimmed"],
    ["quote recursion", "blocks: parseBlocks(buf.join(\"\\n\"))", "blocks: [{ type: \"p\", text: buf.join(\" \") }]", "quote nests blocks"],
    // F-409: the two rows the Gate 2 verifier found unproved — the detection
    // gate itself (a pipe-anywhere table would silently return) and the new
    // separator-shaped-prose throw.
    ["table detection gate widened to pipe-anywhere", 'if (line.startsWith("|")) {', 'if (line.includes("|")) {', "table-detection"],
    ["separator-shaped prose throw dropped", "if (SEPARATOR_SHAPED_RE.test(lines[i]) && lines[i].includes(\"-\") && lines[i].includes(\"|\"))", "if (false)", "separator-shaped prose throws"],
  ];
  for (const [label, from, to, pin] of PARSER_MUTANTS) {
    let caught = false;
    try { caught = parserFails(compileParser(seed(PARSER_SLICE, from, to, label))).includes(pin); }
    catch (e) { if (!(e instanceof SyntaxError)) throw e; }
    ok(`T-9 self-check: parser defect "${label}" is caught by the "${pin}" pin`, caught);
  }
  // Shared-core mutants: each must be caught by the inline pins on BOTH
  // wrappers (the wrappers compiled against the seeded core).
  const CORE_MUTANTS = [
    ["strong dropped", '  text = text.replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>");', ""],
    ["span escape dropped", 'codes.push("<code>" + escapeHtml(c) + "</code>");', 'codes.push("<code>" + c + "</code>");'],
    ["restore guard weakened", "?? m", '?? ""'],
    ["em guard dropped", "(^|[^*])\\*", "()\\*"],
    ["restore moved early", "  text = renderLinks(text);", "  text = renderLinks(text);\n  text = text.replace(/\\u0000GSC(\\d+)\\u0000/g, (m, n) => codes[n] ?? m);"],
    ["pipe unescape dropped", '  text = text.replaceAll("\\\\|", "|");', ""],
  ];
  for (const [label, from, to] of CORE_MUTANTS) {
    const mc = compileCore(seed(CORE_SLICE, from, to, label));
    const caught = failedAbs(compileWikiInline(mc), compileCmpInline(mc));
    ok(`T-9 self-check: shared-core defect "${label}" is caught by the inline pins`, caught.length > 0);
  }
}
// ── report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`✗ ${failures.length} assertion(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(`(${passed} passed)`);
  process.exit(1);
}
console.log(`✓ wiki generator fixtures: ${passed}/${passed} assertions passed`);
