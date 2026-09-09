#!/usr/bin/env node
// Fixture tests for build/build-comparison-html.mjs.
//
// The generator's failure modes are silent by nature: the CI drift check only
// proves the committed HTML matches a rebuild, so a parsing defect that mangles
// output stably would pass forever. These fixtures pin every parsing behavior
// the F-059..F-066 and F-067..F-075 batches fixed, plus the fail-loudly
// contract, plus byte-stability of the committed page.
//
// Zero dependencies. Each run copies the generator into a temp rig with the
// directory shape it expects (../reference, ../wiki) and executes it as a
// child process; the repo tree is never touched.

import {
  readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync, existsSync, mkdtempSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ROOT } from "./lib.mjs";
import { FIXTURE_README, FIXTURE_NOTICE_META, noticeOf, stripTags, noticeParagraphsOf } from "./notice-fixture.mjs";
import { spawnSync } from "node:child_process";

const GENERATOR = join(ROOT, "build", "build-comparison-html.mjs");

let passed = 0;
const failures = [];
const ok = (name, cond) => {
  if (cond) passed++;
  else failures.push(name);
};

// GP-18: the generator reads README.md's notice blockquote and the catalog
// meta at build time. The rig's defaults carry a fixture blockquote whose
// wording is deliberately NOT the real one and a date/pin the fixture meta
// must OVERRIDE; the byte-stability run passes the real files instead.

const FIXTURE_CATALOG = { meta: FIXTURE_NOTICE_META };

/**
 * @param {string} markdown  the rig's reference/comparison-guide.md
 * @param {{ readme?: string, catalog?: string | object }} [opts]  README.md text; catalog as an object or its JSON text
 */
function runGenerator(markdown, { readme = FIXTURE_README, catalog = FIXTURE_CATALOG } = {}) {
  const rig = mkdtempSync(join(tmpdir(), "cmp-html-test-"));
  try {
    mkdirSync(join(rig, "build"));
    mkdirSync(join(rig, "data"));
    mkdirSync(join(rig, "reference"));
    mkdirSync(join(rig, "wiki"));
    writeFileSync(join(rig, "build", "gen.mjs"), readFileSync(GENERATOR));
    // lib.mjs rides along beside the copied script (DS-16): the script under
    // test imports it, and the copy's own location roots ROOT at the rig.
    copyFileSync(join(ROOT, "build", "lib.mjs"), join(rig, "build", "lib.mjs"));
    writeFileSync(join(rig, "reference", "comparison-guide.md"), markdown);
    writeFileSync(join(rig, "data", "catalog.json"), typeof catalog === "string" ? catalog : JSON.stringify(catalog));
    writeFileSync(join(rig, "README.md"), readme);
    const res = spawnSync(process.execPath, [join(rig, "build", "gen.mjs")], {
      encoding: "utf8",
    });
    const outPath = join(rig, "wiki", "comparison-guide.html");
    const html = existsSync(outPath) ? readFileSync(outPath, "utf8") : null;
    return { status: res.status, stderr: res.stderr ?? "", html };
  } finally {
    rmSync(rig, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- main fixture
const FIXTURE = `# Fixture Title

Standfirst with "quotes" and \`code\`.

Lead paragraph.

- lead bullet renders

## Inline

Two spans \`a/*.json\` and \`b/*.html\` on one line.

A span with \`**literal**\` inside.

Literal marker text @@GSC0@@ stays untouched.

A [titled](guide.md "The Title") link and a [paren](gu(id)e.md) link.

A [plugin link](../plugins/gs-superadmin/README.md), an [arch](architecture.md),
a [domain](domains/journey.md), an [external](https://example.com/x), an [anchor](#x).

Emphasis stress: 2 * 3 * 4 stays plain.

Escaped \\| pipe in prose.

**Use the CLI, *not* the raw API.**

#### H4 heading

###### H6 heading

1. first ordered
2. second ordered

- top
  - nested a
  - nested b
- next
  1. nested ordered

Wrapped count line:
173. That number must stay in this paragraph.

Wrapped comparison line:
>= 50 rows stays in this paragraph too.

> A real quote
> across two lines.

> Quote with list:
> - alpha
> - beta

## Tables

| Left | Client secret | CLI lane | Both lanes |
|---|---|---|---|
| **Client credentials** | plain | **M2M client** | **both** |
| \`a \\| b\` escaped pipe | short |
| x | y | z | extra | dropped |

|  |  |
|---|---|
| blankhead-a | blankhead-b |

## Use-case guide

Intro before cards renders.

### Card one

**Use the gs-admin CLI.**

Body text one.

**Use M2M OAuth.**

### Card two

**Used together, both lanes cover everything.**

Body text two.

### Card three

**Use the CLI (see $' notes).**

## Dup

First.

## Dup

Second.

*Footer line.*
`;

const main = runGenerator(FIXTURE);
ok("fixture builds clean (exit 0)", main.status === 0 && main.html !== null);
const H = main.html ?? "";

// F-059 — code spans protected; quotes escaped; titled + paren links
ok("same-line * spans stay literal", H.includes("<code>a/*.json</code>") && H.includes("<code>b/*.html</code>") && !/<code>a\/<em>/.test(H));
ok("** inside code stays literal", H.includes("<code>**literal**</code>"));
ok("double quotes escaped", H.includes("&quot;quotes&quot;"));
ok("titled link keeps title attr", /<a href="index\.html#\/doc\/guide" title="The Title">titled<\/a>/.test(H));
ok("paren URL survives whole", H.includes('href="index.html#/doc/gu(id)e"'));

// F-060 — heading depth + ordered lists
ok("h4 renders", H.includes("<h4>H4 heading</h4>"));
ok("h6 renders", H.includes("<h6>H6 heading</h6>"));
ok("ordered list renders as <ol>", H.includes("<ol>") && H.includes("<li>first ordered</li>"));

// F-061 — nothing silently dropped
ok("lead bullet renders", H.includes("lead bullet renders"));
ok("use-case intro renders", H.includes("Intro before cards renders."));

// F-062 — lane word boundaries
ok("'Client secret' header gets no lane class", H.includes("<th>Client secret</th>"));
ok("'CLI lane' header keeps col-a", H.includes('<th class="col-a">CLI lane</th>'));
ok("'M2M client' pill is lane b", H.includes('<span class="pill b">M2M client</span>'));

// F-063 — separator with trailing whitespace dropped
ok("no dash row rendered as cells", !/<td>-+<\/td>/.test(H));

// F-064 — nested structure
ok("nested <ul> inside <li>", /<li>top[\s\S]{0,40}<ul>/.test(H));
ok("nested <ol> inside <li>", /<li>next[\s\S]{0,40}<ol>/.test(H));
ok("quote with list renders real <li>", /<div class="note">[\s\S]*?<li>alpha<\/li>/.test(H) && !H.includes("- alpha"));
ok("simple quote stays flat", H.includes('<div class="note">A real quote across two lines.</div>'));

// F-065 — link resolution
ok("plugin README path correct", H.includes('href="../plugins/gs-superadmin/README.md"'));
ok("reference doc routes into wiki", H.includes('href="index.html#/doc/architecture"'));
ok("domain doc routes to #/domain/", H.includes('href="index.html#/domain/journey"'));
ok("external + anchor pass through", H.includes('href="https://example.com/x"') && H.includes('href="#x"'));

// F-066 — slug dedup
ok("dup section ids deduplicate", H.includes('<section id="dup">') && H.includes('<section id="dup-2">'));

// F-067 — verdict pill: leading-only, word boundary, $-literal
ok("leading verdict becomes pill", H.includes('<span class="pill a">gs-admin CLI</span>'));
ok("later verdict stays in body", H.includes("<p><strong>Use M2M OAuth.</strong></p>"));
ok("'Used …' is not a pill", H.includes("<p><strong>Used together, both lanes cover everything.</strong></p>") && !/pill [ab"]+>Used together/.test(H));
ok("$' in pill stays literal", H.includes("CLI (see $' notes)</span>"));

// F-068 — blank header preserved, not promoted
ok("blank header row kept as header", /<thead><tr><th><\/th><th><\/th><\/tr><\/thead>/.test(H));
ok("first body row stays in body", /<td class="rowlabel">blankhead-a<\/td>/.test(H));

// F-069 / F-070 — regressions: wrapped lines stay in their paragraphs
ok("wrapped '173.' line stays prose", H.includes("Wrapped count line: 173. That number must stay in this paragraph."));
ok("wrapped '>=' line stays prose", H.includes("Wrapped comparison line: &gt;= 50 rows stays in this paragraph too."));

// F-071 — marker text in prose is inert
ok("literal @@GSC0@@ survives", H.includes("Literal marker text @@GSC0@@ stays untouched."));

// T-9 v4 (S-D2) — the GFM \| prose unescape is core-level now, so this page
// follows the same rule the wiki has followed since F-080: a bare pipe,
// never a visible backslash.
ok("escaped pipe in prose renders as a bare pipe (F-080 via T-9 v4)", H.includes("Escaped | pipe in prose.") && !H.includes("Escaped \\| pipe"));

// F-072 — guarded emphasis
ok("arithmetic asterisks stay plain", H.includes("2 * 3 * 4 stays plain"));
ok("italics inside bold render", H.includes("<em>not</em>") && !H.includes("<em>Use"));

// F-073 — both-lane
ok("'Both lanes' header gets col-ab", H.includes('<th class="col-ab">Both lanes</th>'));
ok("'both' pill is lane ab", H.includes('<span class="pill ab">both</span>'));

// F-074 — table cells: escaped pipe, padding, truncation
ok("escaped pipe carries through", H.includes("<code>a | b</code>"));
ok("short row padded to header width", /<td class="rowlabel"><code>a \| b<\/code> escaped pipe<\/td><td>short<\/td><td><\/td><td><\/td>/.test(H));
ok("long row truncated to header width", H.includes("<td>extra</td>") === false || !H.includes("dropped"));

// ---------------------------------------------------------------- fail-loudly
const preH1 = runGenerator("Stray paragraph.\n\n# Title\n\nBody.\n");
ok("pre-h1 content fails the build", preH1.status === 1 && preH1.html === null && preH1.stderr.includes("precede the h1"));

const noH1 = runGenerator("Just a paragraph, no title.\n");
ok("missing h1 fails the build", noH1.status === 1 && noH1.html === null && noH1.stderr.includes("no h1 title"));

const sepOnly = runGenerator("# T\n\nStand.\n\n## Sec\n\n|---|---|\n");
ok("separator-only table fails cleanly (no TypeError)", sepOnly.status === 1 && sepOnly.html === null && sepOnly.stderr.includes("only separator rows") && !sepOnly.stderr.includes("TypeError"));

const nestedH2 = runGenerator("# T\n\nStand.\n\n## Sec\n\n> ## nested heading\n");
ok("unplaceable block type fails the build", nestedH2.status === 1 && nestedH2.html === null && nestedH2.stderr.includes("unhandled block type"));

// ---------------------------------------------------------------- byte-stability
const real = runGenerator(readFileSync(join(ROOT, "reference", "comparison-guide.md"), "utf8"), {
  readme: readFileSync(join(ROOT, "README.md"), "utf8"),
  catalog: readFileSync(join(ROOT, "data", "catalog.json"), "utf8"),
});
ok("real guide builds clean", real.status === 0);
ok("committed comparison-guide.html matches a fresh rebuild",
  real.html === readFileSync(join(ROOT, "wiki", "comparison-guide.html"), "utf8"));

// ---------------------------------------------------------------- GP-18 notice
// The page carries README.md's notice VERBATIM and BY CONSTRUCTION (the
// generator reads the blockquote at build time; the [DATE] rule's values come
// from the catalog meta). Rig arms: the fixture README's own wording appears
// (live read), the fixture's 1999-12-31 / 0.0.1 is overridden by the fixture
// meta's 2031-01-02 / 0.0.0-test (computed date), Support expectations does
// not ride, a README without the blockquote fails the build. Committed-tree
// arm: the shipped notice equals README.md's paragraphs with the real
// catalog's date — and the self-check proves that arm can red.
{
  const n = noticeOf(H);
  const ps = noticeParagraphsOf(n);
  ok("GP-18 rig: the notice footer renders above the source footer with the page's eyebrow heading",
    /<footer class="notice"><p class="eyebrow">Notice<\/p>/.test(H) && H.indexOf('<footer class="notice">') < H.indexOf("<footer>Footer line."));
  ok("GP-18 rig: Currency first (both paragraphs), then Unaffiliated; Support expectations does not ride",
    ps.length === 3 && ps[0].startsWith("Currency.") && ps[1].startsWith("Fixture second currency paragraph") && ps[2].startsWith("Unaffiliated community project.") && !n.includes("Support expectations"));
  ok("GP-18 rig: the date and the pin are COMPUTED from the catalog meta, not copied from the README",
    ps[0].includes("last updated on 2031-01-02 (against @gainsight/gs-admin-cli@0.0.0-test)") && !n.includes("1999-12-31") && !n.includes("0.0.1"));
  ok("GP-18 rig: the notice renders through this page's inline wrapper (code span, plain external link)",
    n.includes("<code>code</code>") && n.includes('<a href="https://support.example.com">support link</a>'));
  const edited = runGenerator(FIXTURE, { readme: FIXTURE_README.replace("Fixture unaffiliated sentence", "EDITED unaffiliated sentence") });
  ok("GP-18 rig: an edited README changes the rebuilt page (the read is live)", noticeOf(edited.html).includes("EDITED unaffiliated sentence"));
  const noQuote = runGenerator(FIXTURE, { readme: "# No notice\n\nProse.\n" });
  ok("GP-18 rig: a README without the notice blockquote fails the build through the fail() collector",
    noQuote.status === 1 && noQuote.html === null && /no blockquote carrying/.test(noQuote.stderr) && !/TypeError/.test(noQuote.stderr));
  const { noticeParagraphs, readJsonFile } = await import("./lib.mjs");
  const cmpMod = await import("./build-comparison-html.mjs");
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const meta = readJsonFile(join(ROOT, "data", "catalog.json")).meta;
  const expected = (md) => noticeParagraphs(md, meta).map((p) => stripTags(cmpMod.inline(p)));
  const shipped = noticeParagraphsOf(noticeOf(readFileSync(join(ROOT, "wiki", "comparison-guide.html"), "utf8")));
  ok("GP-18 committed: comparison-guide.html's notice is README.md's blockquote verbatim, with the catalog's date and pin",
    shipped.length === 3 && JSON.stringify(shipped) === JSON.stringify(expected(readme)) && shipped[0].includes(`last updated on ${String(meta.generatedAt).slice(0, 10)} (against @gainsight/gs-admin-cli@${meta.cliVersion})`));
  ok("GP-18 committed self-check: a README edit without a rebuild reads as a mismatch",
    JSON.stringify(shipped) !== JSON.stringify(expected(readme.replace("This project is not affiliated", "This project is not connected"))));
}

// ---------------------------------------------------------------- report
if (failures.length) {
  console.error(`test-comparison-html: ${failures.length} FAILED, ${passed} passed`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`test-comparison-html: all ${passed} assertions passed`);
