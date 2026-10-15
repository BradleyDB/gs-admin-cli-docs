#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard-theme.mjs (test) — fixtures for a dashboard page's look (UX-1):
// scripts/dashboard-theme.mjs (the default theme as data, the theme validator,
// the token emitter) and how the page builder and the spec writer use it.
//
// Four theme fixtures under fixtures/engagement/themes/ (each a T-11 `theme`):
//   low-contrast   text colours that cannot be read on the surfaces → each
//                  falls back to the default's value, with a note naming the
//                  ratio it read at
//   alike-series   two chart colours a reader could not tell apart → the
//                  second falls back, with a note; its neighbours are kept
//   good           a brand palette, light and dark, that passes every check →
//                  kept untouched, no note
//   light-only     the same light palette with no dark set → a dark set is
//                  derived, and the result passes text contrast
// The expectations are measured, not eyeballed: contrast and distance come
// from the module's own colour math, checked here against WCAG's published
// ratios for known pairs.
//
// Run:  node plugins/gs-superadmin/test/dashboard-theme.mjs
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { DEFAULT_THEME, STATUS_TOKENS, COLOR_KEYS, THRESHOLDS, LOGO_MAX_BYTES, SYSTEM_FONTS, contrast, deltaE, oklab, validateTheme, themeShapeProblems, readLogo, tokensCss, isSystemStack, flipForDark, seriesForDark } from "../scripts/dashboard-theme.mjs";
import { buildPage, inlinedSources, TOKENS } from "../scripts/dashboard-page.mjs";
import { openSpec, validateSpec, describeSpec } from "../scripts/dashboard-spec.mjs";
import { applyGroups } from "../scripts/dashboard-groups.mjs";
import * as engine from "../scripts/engagement-query.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEMES = join(HERE, "fixtures", "engagement", "themes");
const theme = (name) => JSON.parse(readFileSync(join(THEMES, `${name}.json`), "utf8"));
const SPEC = openSpec(JSON.parse(readFileSync(join(HERE, "fixtures", "engagement", "spec-acme.json"), "utf8")));
const PULLED = engine.openSnapshot(JSON.parse(readFileSync(join(HERE, "fixtures", "engagement", "snapshot-acme.json"), "utf8")));
const SOURCES = inlinedSources();

let failures = 0;
let ran = 0;
function check(label, cond, detail) {
  ran++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)?.slice(0, 1500)}`);
  }
}
const r2 = (n) => Math.round(n * 100) / 100;
/** The problem a refused logo names (an accepted one names none). */
const problemOf = (r) => (r.ok ? "" : r.problem);
/** The type and size of an accepted logo (a refused one has neither). */
const okLogo = (r) => (r.ok ? r : { type: null, bytes: -1 });
const SURFACES = ["bg", "soft", "note", "shade"];
const TEXT = ["fg", "muted", "accent"];
/** Every text token of a scheme against every surface: the lowest ratio. */
const worstText = (scheme) => Math.min(...TEXT.flatMap((t) => SURFACES.map((s) => contrast(scheme[t], scheme[s]))));
const withTheme = (t) => openSpec({ ...structuredClone(SPEC), theme: t });
const build = (spec, pageId = "admin") => buildPage({ spec, snapshot: applyGroups(PULLED, spec.groups).snapshot, pageId, ...SOURCES });
// The page suite's no-network pattern, repeated here so a themed page is held to the same bar.
const NO_NETWORK = /\b(href|src|action|data|poster|formaction)\s*=\s*["']?\s*[hH][tT][tT][pP][sS]?:\/\/|url\(\s*["']?[hH][tT][tT][pP]|\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|(?<!\{)\bimport\s*\(|^\s*import\s|<link\b|<img\b|<iframe\b|<object\b|<embed\b|<form\b(?![^>]*data-search)|\ssrc=|url\(|@import|<base\b|http-equiv/m;
// A 1×1 PNG and the first bytes of a JPEG, as base64.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const JPEG_HEAD = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/";

// ══ The colour math, against published values ═══════════════════════════════
{
  check("contrast is WCAG's: black on white 21:1, white on white 1:1, #777777 on white 4.48:1 (the classic just-below-AA grey), #767676 on white 4.54:1 (just above)",
    r2(contrast("#000000", "#ffffff")) === 21 && contrast("#ffffff", "#ffffff") === 1 && r2(contrast("#777777", "#ffffff")) === 4.48 && r2(contrast("#767676", "#ffffff")) === 4.54);
  check("distance is OKLab's: a colour is 0 from itself, black is about 100 from white, and the simulated views make a red and a green closer than normal vision does",
    deltaE("#2a78d6", "#2a78d6") === 0 && r2(deltaE("#000000", "#ffffff")) === 100 && deltaE("#e34948", "#008300", "protan") < deltaE("#e34948", "#008300") && deltaE("#e34948", "#008300", "deutan") < deltaE("#e34948", "#008300") && r2(oklab("#ffffff")[0]) === 1 && r2(oklab("#000000")[0]) === 0);
}

// ══ The default theme (UX-1): what a page looks like with no brand input ════
{
  const d = validateTheme(null);
  check("the default theme passes its own validator untouched: no note, every token as declared, the same for an absent theme and an empty one",
    d.notes.length === 0 && isDeepStrictEqual(d.theme, { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors }, dark: { ...DEFAULT_THEME.dark }, series: [...DEFAULT_THEME.series], seriesDark: [...DEFAULT_THEME.seriesDark] }) && validateTheme({}).notes.length === 0 && validateTheme(undefined).notes.length === 0, d.notes);
  check(`the default's text reads at AA (${THRESHOLDS.textContrast}:1) on every surface in both schemes, its control border at ${THRESHOLDS.controlContrast}:1, and its hairline is visible`,
    worstText(DEFAULT_THEME.colors) >= 4.5 && worstText(DEFAULT_THEME.dark) >= 4.5 && contrast(DEFAULT_THEME.colors.control, DEFAULT_THEME.colors.bg) >= 3 && contrast(DEFAULT_THEME.dark.control, DEFAULT_THEME.dark.bg) >= 3 && contrast(DEFAULT_THEME.colors.line, DEFAULT_THEME.colors.bg) >= 1.2,
    [r2(worstText(DEFAULT_THEME.colors)), r2(worstText(DEFAULT_THEME.dark))]);
  const statusFails = Object.entries(STATUS_TOKENS).flatMap(([mode, s]) => Object.entries(s).flatMap(([k, v]) => SURFACES.map((surf) => [mode, k, surf, r2(contrast(v, DEFAULT_THEME[mode === "light" ? "colors" : "dark"][surf]))]).filter(([, , , c]) => Number(c) < 4.5)));
  check("the status tokens (stale, error, warning, ok, the two tracking states) read at AA on every surface of their scheme: they are text on the page, outside any theme", statusFails.length === 0, statusFails);
  const adjacent = (list) => list.slice(1).map((v, i) => [list[i], v]);
  check(`the default's eight chart colours are distinguishable: every neighbouring pair at least ${THRESHOLDS.seriesNormal} apart under normal vision and ${THRESHOLDS.seriesCvd} under simulated colour-blind vision, in both schemes, and every one at least ${THRESHOLDS.seriesVsSurface} from its surface`,
    [["series", "colors"], ["seriesDark", "dark"]].every(([list, scheme]) => adjacent(DEFAULT_THEME[list]).every(([a, b]) => deltaE(a, b) >= THRESHOLDS.seriesNormal && Math.min(deltaE(a, b, "protan"), deltaE(a, b, "deutan")) >= THRESHOLDS.seriesCvd) && DEFAULT_THEME[list].every((v) => deltaE(v, DEFAULT_THEME[scheme].bg) >= THRESHOLDS.seriesVsSurface)) && DEFAULT_THEME.series.length === 8 && DEFAULT_THEME.seriesDark.length === 8,
    adjacent(DEFAULT_THEME.series).map(([a, b]) => [a, b, r2(deltaE(a, b)), r2(Math.min(deltaE(a, b, "protan"), deltaE(a, b, "deutan")))]));
  check("the default's font stack is a system stack, and the page's committed token block is exactly the default theme emitted", isSystemStack(DEFAULT_THEME.font) && TOKENS === tokensCss(DEFAULT_THEME));
}

// ══ The validator over the four fixtures ════════════════════════════════════
{
  const low = validateTheme(theme("low-contrast"));
  const by = (notes) => Object.fromEntries(notes.map((n) => [n.token, n]));
  check("low-contrast: the text colours that cannot be read fall back to the default's one by one, each with a note naming the ratio it read at and the surface; the background it did read on is kept; the control border too close to the page falls back; nothing else is touched",
    isDeepStrictEqual(Object.keys(by(low.notes)).filter((k) => k.startsWith("colors.")).sort(), ["colors.accent", "colors.control", "colors.fg", "colors.muted"]) && low.theme.colors.fg === DEFAULT_THEME.colors.fg && low.theme.colors.muted === DEFAULT_THEME.colors.muted && low.theme.colors.accent === DEFAULT_THEME.colors.accent && low.theme.colors.control === DEFAULT_THEME.colors.control && low.theme.colors.bg === "#ffffff" &&
      /4\.48:1 on bg/.test(by(low.notes)["colors.fg"].reason) && by(low.notes)["colors.fg"].given === "#777777" && by(low.notes)["colors.fg"].replacedWith === DEFAULT_THEME.colors.fg && /2\.32:1 on bg/.test(by(low.notes)["colors.muted"].reason) && /border must read at 3:1/.test(by(low.notes)["colors.control"].reason) && worstText(low.theme.colors) >= 4.5 && worstText(low.theme.dark) >= 4.5,
    low.notes);
  check("low-contrast: with no dark set given, the dark scheme is derived from the light one, and a derived token that would not read falls back with a note saying it was derived",
    low.derivedDark === true && low.notes.every((n) => !n.token.startsWith("dark.") || /^derived from colors\./.test(String(n.given))) && worstText(low.theme.dark) >= 4.5);
  const alike = validateTheme(theme("alike-series"));
  check("alike-series: two chart colours a reader could not tell apart (#2a78d6 beside #2b7ad8): the second falls back to the default's slot 2 with a note naming the pair and the distance; slots 1 and 3 are kept; the dark slots derived from the kept ones pass",
    alike.notes.length === 1 && alike.notes[0].token === "series[1]" && alike.notes[0].given === "#2b7ad8" && alike.notes[0].replacedWith === DEFAULT_THEME.series[1] && /slots 2 and 1 are too alike \(distance 0\.6/.test(alike.notes[0].reason) &&
      alike.theme.series[0] === "#2a78d6" && alike.theme.series[2] === "#1baf7a" && alike.theme.series[1] === DEFAULT_THEME.series[1] && alike.theme.seriesDark.slice(0, 3).every((v, i) => deltaE(v, alike.theme.dark.bg) >= THRESHOLDS.seriesVsSurface && (i === 0 || deltaE(v, alike.theme.seriesDark[i - 1]) >= THRESHOLDS.seriesNormal)),
    alike.notes);
  const good = validateTheme(theme("good"));
  const given = theme("good");
  check("good: a brand palette, light and dark, with three chart colours, a system font and a radius passes every check untouched: no note, every given token in force, the default's for the slots it leaves out",
    good.notes.length === 0 && good.derivedDark === false && isDeepStrictEqual(good.theme.colors, given.colors) && isDeepStrictEqual(good.theme.dark, given.dark) && isDeepStrictEqual(good.theme.series.slice(0, 3), given.series) && isDeepStrictEqual(good.theme.seriesDark.slice(0, 3), given.seriesDark) && isDeepStrictEqual(good.theme.series.slice(3), DEFAULT_THEME.series.slice(3)) &&
      good.theme.font === given.font && good.theme.radius === 8 && good.theme.logo === null, good.notes);
  const lightOnly = validateTheme(theme("light-only"));
  check("light-only: the same light palette with no dark set gets a derived dark set, text light and surfaces dark with the brand's tint kept, the chart colours moved into the dark lightness band; the result reads at AA on every dark surface, and any derived token that would not is the default's, with a note",
    lightOnly.derivedDark === true && worstText(lightOnly.theme.dark) >= 4.5 && contrast(lightOnly.theme.dark.control, lightOnly.theme.dark.bg) >= 3 && oklab(lightOnly.theme.dark.bg)[0] < 0.3 && oklab(lightOnly.theme.dark.fg)[0] > 0.7 &&
      lightOnly.theme.seriesDark.slice(0, 3).every((v) => { const L = oklab(v)[0]; return L >= THRESHOLDS.darkBand[0] - 0.05 && L <= THRESHOLDS.darkBand[1] + 0.05; }) && lightOnly.notes.every((n) => /^derived from/.test(String(n.given))) && isDeepStrictEqual(lightOnly.theme.colors, given.colors),
    [lightOnly.theme.dark, lightOnly.notes]);
  check("the derivations are what they say: a surface flips dark and a text colour flips light, keeping their hue; a chart colour's lightness is clamped into the dark band and its hue kept",
    oklab(flipForDark("#f7fbff", "bg"))[0] < 0.3 && oklab(flipForDark("#102a43", "fg"))[0] > 0.8 && Math.abs(oklab(seriesForDark("#0b57d0"))[1] - oklab("#0b57d0")[1]) < 0.01 && oklab(seriesForDark("#000080"))[0] >= THRESHOLDS.darkBand[0] - 0.01 && oklab(seriesForDark("#e0e0ff"))[0] <= THRESHOLDS.darkBand[1] + 0.01);
}

// ══ Fonts, radius, logo ═════════════════════════════════════════════════════
{
  const brand = validateTheme({ font: "Brandface, \"Segoe UI\", sans-serif" });
  check("a font stack with a family the page cannot rely on (no download is ever made) falls back to the default stack with a note naming the family; a stack of system families is kept as given",
    brand.notes.length === 1 && brand.notes[0].token === "font" && /"Brandface" is not one/.test(brand.notes[0].reason) && brand.theme.font === DEFAULT_THEME.font && validateTheme({ font: "Georgia, serif" }).theme.font === "Georgia, serif" && validateTheme({ font: "Georgia, serif" }).notes.length === 0 && SYSTEM_FONTS.includes("Georgia"),
    brand.notes);
  check("a radius outside 0 to 16 or not a whole number is refused by the shape check, and a valid one is kept",
    themeShapeProblems({ radius: 17 }).some((p) => p.path === "theme.radius") && themeShapeProblems({ radius: 2.5 }).some((p) => p.path === "theme.radius") && themeShapeProblems({ radius: 0 }).length === 0 && validateTheme({ radius: 12 }).theme.radius === 12);
  const png = `data:image/png;base64,${PNG}`;
  const big = `data:image/png;base64,${PNG.slice(0, 11)}${"A".repeat(Math.ceil((LOGO_MAX_BYTES + 20000) * 4 / 3))}`;
  check("a logo is a PNG or JPEG data URI of at most 200 KB before encoding: the type is read from the bytes (a PNG claiming to be a JPEG is refused), an SVG is refused by name (it can carry script), one over the cap is refused with its size, and a good one is kept",
    readLogo(png).ok === true && okLogo(readLogo(png)).type === "image/png" && okLogo(readLogo(png)).bytes === Buffer.from(PNG, "base64").length && okLogo(readLogo(png)).bytes === 70 && readLogo(`data:image/jpeg;base64,${JPEG_HEAD}`).ok === true &&
      readLogo(`data:image/jpeg;base64,${PNG}`).ok === false && /do not start like one/.test(problemOf(readLogo(`data:image/jpeg;base64,${PNG}`))) && /SVG is not accepted/.test(problemOf(readLogo("data:image/svg+xml;base64,PHN2Zz4="))) && /over|cap/.test(problemOf(readLogo(big))) && problemOf(readLogo(big)).includes("the cap is 200 KB") && /is 2\d\d KB before encoding/.test(problemOf(readLogo(big))) &&
      readLogo("https://example.com/logo.png").ok === false && validateTheme({ logo: png }).theme.logo === png && validateTheme({ logo: "nope" }).theme.logo === null && themeShapeProblems({ logo: "nope" }).some((p) => p.path === "theme.logo"),
    [readLogo(png), problemOf(readLogo(big))]);
}

// ══ The shape check (what the spec refuses) and the token emitter ═══════════
{
  const problems = themeShapeProblems({ colors: { fg: "red", bogus: "#000000" }, dark: [], series: [], seriesDark: Array(9).fill("#000000"), font: "x; url(a)", notes: [{ token: 1 }], extra: 1 });
  const paths = problems.map((p) => p.path).sort();
  check("the shape check names every problem by its path: a colour not written as #rrggbb, a token that is not one, a dark set that is not an object, an empty or over-long series list, a font stack holding anything but family names, a malformed note, an unknown key",
    isDeepStrictEqual(paths, ["theme.colors.bogus", "theme.colors.fg", "theme.dark", "theme.extra", "theme.font", "theme.notes[0]", "theme.series", "theme.seriesDark"]) && themeShapeProblems(theme("good")).length === 0 && themeShapeProblems(null).length === 1, paths);
  const css = tokensCss(validateTheme(theme("good")).theme);
  const blocks = [...css.matchAll(/:root\{([^}]*)\}/g)].map((m) => m[1]);
  check("the token block emitted for a theme has the shape every page relies on: a brand block and a status block for light, the same pair under the dark media query, and the light pair again for print; the brand blocks carry the font, the radius, every colour token and eight series slots; the status blocks only status tokens",
    blocks.length === 6 && blocks.filter((b) => /--status-/.test(b)).length === 3 && blocks.filter((b) => !/--status-/.test(b)).every((b) => COLOR_KEYS.every((k) => b.includes(`--${k}:#`)) && (b.match(/--series-\d:#/g) ?? []).length === 8 && /--font:"Segoe UI", Roboto, sans-serif;--mono:/.test(b) && /--radius:8px/.test(b)) &&
      blocks[0].includes("--fg:#102a43") && blocks[2].includes("--fg:#e8eef5") && /@media print\{:root\{color-scheme:light;[^}]*--fg:#102a43/.test(css) && !/undefined|null/.test(css), blocks.map((b) => b.slice(0, 60)));
}

// ══ On a page: the spec carries the theme, the builder renders it, the About tab says it ══
{
  const markupOf = (html) => html.replace(/<script type="module">\n[\s\S]*?<\/script>/g, "").replace(/<script type="application\/json" id="gs-data">[\s\S]*?<\/script>/, "");
  const good = build(withTheme(theme("good")));
  const style = good.html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  check("a spec with a theme builds a page whose style sheet starts with that theme's token block (the rules after it unchanged), and whose About tab says a brand theme is in use with no replaced token",
    style.startsWith(tokensCss(validateTheme(theme("good")).theme)) && style.includes("--fg:#102a43") && !style.includes(DEFAULT_THEME.colors.fg) && good.html.includes("A brand theme: 9 colours set for light, 9 colours set for dark, 3 chart colours") && good.html.includes("Every token it sets passed the readability checks.") && !markupOf(good.html).includes("data-look-notes"),
    style.slice(0, 200));
  const low = build(withTheme(theme("low-contrast")));
  const lowStyle = low.html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  check("a theme whose text would not read never reaches a page as given: the style sheet carries the default's values for the replaced tokens, and the About tab lists each replacement with its reason (the settings' Look sentence and the notice both)",
    lowStyle.includes(`--fg:${DEFAULT_THEME.colors.fg}`) && !lowStyle.includes("--fg:#777777") && lowStyle.includes("--bg:#ffffff") && markupOf(low.html).includes("data-look-notes") && /\d+ theme tokens replaced by the default because it would not read: colors\.fg \(text must read at 4\.5:1/.test(low.html) && /\d+ tokens replaced by the default because it would not read/.test(low.html) && String(low.html.match(/(\d+) theme tokens replaced/)?.[1]) === String(validateTheme(theme("low-contrast")).notes.length),
    low.html.match(/data-look-notes[\s\S]{0,300}/)?.[0]);
  const png = `data:image/png;base64,${PNG}`;
  const logo = build(withTheme({ ...theme("good"), logo: png }));
  const markup = markupOf(logo.html);
  const stripped = logo.html.replace(`<img class="gs-logo" src="${png}" alt="">`, "");
  check("a logo rides the page as the data URI itself, in the header before the title, and nothing else: with that one element taken out the page still asks the network for nothing, and the runtime's own bytes hold no image element",
    markup.includes(`<header class="gs-head"><img class="gs-logo" src="${png}" alt=""><h1>`) && (markup.match(/<img/g) ?? []).length === 1 && !NO_NETWORK.test(stripped) && !/<img|\ssrc=/.test(SOURCES.runtimeSource) && !NO_NETWORK.test(good.html) && logo.html.includes("a logo;"),
    markup.match(/<header[^>]*>[\s\S]{0,120}/)?.[0]);
  check("an empty theme renders the default style sheet byte for byte (the About says a theme is named and sets nothing), and a leaders' page takes the same theme as the admin page",
    build(withTheme({})).html.match(/<style>([\s\S]*?)<\/style>/)[1] === build(SPEC).html.match(/<style>([\s\S]*?)<\/style>/)[1] && build(withTheme({})).html.includes("A brand theme: nothing set") && (build(withTheme(theme("good")), "exec").html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "").startsWith(tokensCss(validateTheme(theme("good")).theme)));
}

// ══ The spec writer's side: what it refuses and what it says ════════════════
{
  const with_ = (t) => validateSpec({ ...structuredClone(SPEC), theme: t });
  check("the spec validator refuses a malformed theme by field and accepts the fixtures: a colour not as #rrggbb, an SVG logo, a font with a url, an unknown key, a theme that is not an object",
    with_({ colors: { fg: "red" } }).problems.some((p) => p.path === "theme.colors.fg") && with_({ logo: "data:image/svg+xml;base64,PHN2Zz4=" }).problems.some((p) => p.path === "theme.logo") && with_({ font: "url(x)" }).problems.some((p) => p.path === "theme.font") && with_({ nope: 1 }).problems.some((p) => p.path === "theme.nope") && with_("dark").problems.some((p) => p.path === "theme") &&
      ["good", "light-only", "low-contrast", "alike-series"].every((n) => with_(theme(n)).problems.length === 0) && validateSpec(structuredClone(SPEC)).problems.length === 0);
  const look = (t) => describeSpec(openSpec({ ...structuredClone(SPEC), theme: t })).find((d) => d.label === "Look").text;
  check("the Look setting reads in words: the default when the spec names no theme; what a theme sets and what the validator replaced, with the reason, when it does; the notes a stored theme carries are counted",
    describeSpec(SPEC).find((d) => d.label === "Look").text[0].startsWith("The default look") && look(theme("good"))[0] === `A brand theme: 9 colours set for light, 9 colours set for dark, 3 chart colours, the font stack ""Segoe UI", Roboto, sans-serif", a 8px corner radius; every token it leaves out takes the default.` &&
      /^1 token replaced by the default because it would not read: series\[1\] \(slots 2 and 1 are too alike/.test(look(theme("alike-series"))[1]) && look({ ...theme("good"), notes: [{ token: "font", given: "Brandface", replacedWith: DEFAULT_THEME.font, reason: "not a system family" }] })[2] === "1 note recorded when the theme was stored." && /dark derived from the light colours/.test(look(theme("light-only"))[0]),
    look(theme("good")));
}

if (failures) {
  console.log(`\ndashboard-theme: ${failures} FAILED of ${ran}`);
  process.exit(1);
}
console.log(`\ndashboard-theme: all ${ran} checks passed`);
