// ─────────────────────────────────────────────────────────────────────────────
// dashboard-theme.mjs — a dashboard page's look, as data (UX-1, R28): the
// DEFAULT theme every page renders in when its spec names none, the ONE
// validator a brand theme (T-11 `theme`, UX-2) passes through, and the one
// emitter of the page's token block.
//
// A theme is brand-facing token VALUES only: the text and surface colours,
// the chart series colours, a system font stack, a radius, and an optional
// logo. The status colours (stale, error, warning, ok, the two tracking
// states) are not part of a theme: they keep one meaning on every page.
//
// What the validator does, token by token, never as a whole:
//   - text contrast at WCAG AA (4.5:1) in both themes: the text colours
//     against every surface the page draws them on; a control border at 3:1
//   - chart series distinguishable from each other and from the background
//     (OKLab distance, under normal vision and under simulated protan and
//     deutan vision), with the same thresholds the design guidance the
//     builder followed uses
//   - a dark set DERIVED from the light one when a theme gives none, then
//     checked like a given one
//   - a token that fails is REPLACED by the default theme's value, and the
//     replacement is recorded as a note the page's About tab shows: a brand
//     colour that cannot be read is never drawn, and never silently dropped
//
// PURE, import-free, written in the JavaScript a browser also runs (a page
// may inline it one day; nothing here needs Node).
//
// Citations: UX-n are work items and Rnn rulings of the maintainer's
// unpublished JO-dashboards plan; the decision each produced is stated beside
// the token.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ThemeColors    the text and surface tokens of one scheme (light or dark), each a #rrggbb
 * @property {string} fg            body text
 * @property {string} muted         secondary text (notes, labels, ticks); must still read at AA
 * @property {string} bg            the page surface
 * @property {string} soft          a raised surface (the filter bar, tiles, table heads)
 * @property {string} line          hairlines (table rules, grid)
 * @property {string} control       the border of a control (3:1 against the page surface)
 * @property {string} accent        links, the current tab, focus
 * @property {string} note          the surface of a notice
 * @property {string} shade         the provisional-period band, a mark's highlight
 *
 * @typedef {object} Theme          T-11 `theme`, as a spec carries it (every member optional; absent = the default's)
 * @property {Partial<ThemeColors>} [colors]      the light scheme
 * @property {Partial<ThemeColors>} [dark]        the dark scheme; absent = derived from the light one
 * @property {string[]} [series]                  chart series colours, light, in slot order (1 to 8)
 * @property {string[]} [seriesDark]              the same slots for dark; absent = derived
 * @property {string} [font]                      a system font stack (family names the page can rely on without a download)
 * @property {number} [radius]                    corner radius in px, 0 to 16
 * @property {?string} [logo]                     a data URI, PNG or JPEG, at most 200 KB before encoding
 * @property {ThemeNote[]} [notes]                what the validator replaced when the theme was stored (UX-2 writes them)
 *
 * @typedef {object} ThemeNote
 * @property {string} token         e.g. "colors.muted", "series[3]", "dark.fg", "font"
 * @property {*} given              the value the theme gave
 * @property {*} replacedWith       the default's value, now in force
 * @property {string} reason        why, in words
 *
 * @typedef {object} ResolvedTheme  every token with a value, both schemes, ready for tokensCss
 * @property {ThemeColors} colors
 * @property {ThemeColors} dark
 * @property {ReadonlyArray<string>} series
 * @property {ReadonlyArray<string>} seriesDark
 * @property {string} font
 * @property {number} radius
 * @property {?string} logo
 */

// ── The default theme (UX-1): the look a page has with no brand input ────────
// Text and surfaces are neutral; the chart series are the validated reference
// palette's eight categorical slots, light and dark (the dataviz guidance's
// documented instance, adopted as the default rather than picked by eye).
/** @type {Readonly<ResolvedTheme>} */
export const DEFAULT_THEME = Object.freeze({
  colors: Object.freeze({ fg: "#1c2330", muted: "#5b6575", bg: "#ffffff", soft: "#f3f5f8", line: "#d5dae2", control: "#747d8a", accent: "#1f5fbf", note: "#eef3fb", shade: "#e9edf3" }),
  dark: Object.freeze({ fg: "#e6e9ee", muted: "#9aa4b2", bg: "#14181f", soft: "#1c222c", line: "#333c49", control: "#6b7686", accent: "#7fb0ff", note: "#1a2534", shade: "#222a36" }),
  series: Object.freeze(["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]),
  seriesDark: Object.freeze(["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"]),
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  radius: 6,
  logo: null,
});
// The status tokens: fixed, outside any theme (UX-1 build note). Every light
// value reads at AA on every light surface; every dark value on every dark one.
export const STATUS_TOKENS = Object.freeze({
  light: Object.freeze({ stale: "#9c4f00", error: "#c22f2f", warn: "#7a6000", ok: "#0a7a0a", "not-tracked": "#5b6575", unknown: "#6e5fb3" }),
  dark: Object.freeze({ stale: "#f0a850", error: "#f07070", warn: "#e0c060", ok: "#5fcf5f", "not-tracked": "#9aa4b2", unknown: "#b3a6f0" }),
});
export const MONO_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
export const COLOR_KEYS = Object.freeze(Object.keys(DEFAULT_THEME.colors));
export const MAX_SERIES = 8;
export const LOGO_MAX_BYTES = 200 * 1024;
// A system font stack: family names a page can rely on with no download. A
// name outside this list is not refused by the spec (a brand's face is exactly
// what UX-2 will be handed); the validator replaces the stack with the default
// and says so.
export const SYSTEM_FONTS = Object.freeze([
  "system-ui", "-apple-system", "BlinkMacSystemFont", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded",
  "Segoe UI", "Segoe UI Variable", "Roboto", "Helvetica Neue", "Helvetica", "Arial", "Noto Sans", "Ubuntu", "Cantarell", "Liberation Sans",
  "Verdana", "Tahoma", "Trebuchet MS", "Calibri", "Georgia", "Times New Roman", "Times", "Cambria", "Garamond", "Palatino",
  "SF Mono", "Menlo", "Consolas", "Liberation Mono", "Courier New", "Monaco",
  "sans-serif", "serif", "monospace", "cursive", "fantasy", "math",
]);

// ── Thresholds (the dataviz guidance's, restated here as data) ───────────────
export const THRESHOLDS = Object.freeze({
  textContrast: 4.5, // WCAG AA, normal text
  controlContrast: 3, // a control's boundary against the page surface
  seriesVsSurface: 15, // OKLab ΔE ×100 between a series colour and the surface: a mark must be seen
  seriesNormal: 15, // OKLab ΔE ×100 between neighbouring slots under normal vision (the hard floor)
  seriesCvd: 6, // the same under simulated protan and deutan vision; the floor, legal with the page's secondary encoding (legend, labels, the table)
  darkBand: Object.freeze([0.48, 0.67]), // OKLCH L for a series colour on a dark surface
});

// ── Colour math (sRGB → linear → OKLab; WCAG contrast; CVD simulation) ───────
export const HEX_RE = /^#[0-9a-f]{6}$/i;
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) => { c = Math.max(0, Math.min(1, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const linear = (h) => hexToRgb(h).map(toLinear);
const relLum = (h) => { const [r, g, b] = linear(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** WCAG contrast ratio of two #rrggbb colours. */
export const contrast = (a, b) => { const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
/** @param {number[]} rgb linear RGB @returns {[number, number, number]} L, a, b */
function oklabFromLinear(rgb) {
  const [r, g, b] = rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
/** @param {number[]} lab L, a, b @returns {number[]} linear RGB */
function linearFromOklab(lab) {
  const [L, a, b] = lab;
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
export const oklab = (h) => oklabFromLinear(linear(h));
const hexFromOklab = (lab) => rgbToHex(linearFromOklab(lab).map(fromLinear));
// Machado, Oliveira & Fernandes (2009), severity 1.0, on linear RGB: the simulation the thresholds were calibrated to.
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
/** @param {number[]} rgb @param {number[][]} M @returns {[number, number, number]} */
const simulate = (rgb, M) => /** @type {[number, number, number]} */ (M.map((row) => Math.max(0, Math.min(1, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]))));
/** OKLab distance ×100 between two colours, under normal vision or a simulated deficiency. */
export function deltaE(h1, h2, kind = null) {
  const [p, q] = [linear(h1), linear(h2)].map((rgb) => oklabFromLinear(kind ? simulate(rgb, CVD[kind]) : rgb));
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
const round = (n) => Math.round(n * 100) / 100;

// ── Derivations: a dark set from a light one ─────────────────────────────────
// What each token is for decides where its dark lightness lands: surfaces go
// dark (the lightest light surface becomes the darkest dark one), text goes
// light, rules sit between. The hue is kept and the chroma softened, so a
// brand's tint survives the flip.
const DARK_RANGE = Object.freeze({ bg: [0.18, 0.6], soft: [0.18, 0.6], note: [0.18, 0.6], shade: [0.18, 0.6], fg: [0.6, 0.4], muted: [0.6, 0.4], accent: [0.6, 0.4], line: [0.35, 0.45], control: [0.35, 0.45] });
/** A text, surface or rule colour for the dark scheme, derived from the light one. */
export function flipForDark(hex, token) {
  const [L, a, b] = oklab(hex);
  const [base, span] = DARK_RANGE[token] ?? [0.18, 0.6];
  const soften = base >= 0.6 ? 0.7 : 0.5;
  return hexFromOklab([base + (1 - L) * span, a * soften, b * soften]);
}
/** A series colour for the dark scheme: the same hue and chroma, its lightness moved into the dark band. */
export function seriesForDark(hex) {
  const [L, a, b] = oklab(hex);
  const [lo, hi] = THRESHOLDS.darkBand;
  return hexFromOklab([Math.max(lo, Math.min(hi, L)), a, b]);
}

// ── The validator ────────────────────────────────────────────────────────────
const isHex = (v) => typeof v === "string" && HEX_RE.test(v);
const lower = (h) => h.toLowerCase();
/** The family names of a font stack, unquoted. */
export const fontFamilies = (stack) => String(stack).split(",").map((f) => f.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
/** Whether every family of a stack is one a page can rely on without a download. */
export const isSystemStack = (stack) => { const fams = fontFamilies(stack); return fams.length > 0 && fams.every((f) => SYSTEM_FONTS.includes(f)) && !/[{};@\\]|url\(/i.test(String(stack)); };
/**
 * What a logo data URI holds: its type and decoded size, read from the URI
 * alone (the first bytes of a PNG and a JPEG have one base64 spelling each).
 * @param {*} uri
 * @returns {{ok: true, type: "image/png"|"image/jpeg", bytes: number} | {ok: false, problem: string}}
 */
export function readLogo(uri) {
  if (typeof uri !== "string") return { ok: false, problem: "must be a data URI" };
  const m = uri.match(/^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!m) return { ok: false, problem: "must be a base64 data URI of a PNG or a JPEG (data:image/png;base64,… or data:image/jpeg;base64,…); an SVG is not accepted, it can carry script" };
  const type = /** @type {"image/png"|"image/jpeg"} */ (m[1]);
  const data = m[2];
  const magic = type === "image/png" ? "iVBORw0KGgo" : "/9j/";
  if (!data.startsWith(magic)) return { ok: false, problem: `says it is a ${type.slice(6).toUpperCase()} but its bytes do not start like one` };
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((data.length * 3) / 4) - padding;
  if (bytes > LOGO_MAX_BYTES) return { ok: false, problem: `is ${Math.round(bytes / 1024)} KB before encoding; the cap is ${LOGO_MAX_BYTES / 1024} KB` };
  return { ok: true, type, bytes };
}
/**
 * The SHAPE of a theme, for the spec's validator: every problem with the path
 * of its field. Quality (contrast, distinguishability) is validateTheme's,
 * which never refuses.
 * @param {*} theme @param {string} [at] the path prefix
 * @returns {Array<{path: string, problem: string}>}
 */
export function themeShapeProblems(theme, at = "theme") {
  const problems = [];
  const bad = (path, problem) => problems.push({ path, problem });
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) return [{ path: at, problem: "must be an object (or absent for the default look)" }];
  for (const k of Object.keys(theme)) if (!["colors", "dark", "series", "seriesDark", "font", "radius", "logo", "notes"].includes(k)) bad(`${at}.${k}`, "is not a field of a theme (colors, dark, series, seriesDark, font, radius, logo, notes)");
  for (const scheme of ["colors", "dark"]) {
    const c = theme[scheme];
    if (c === undefined) continue;
    if (!c || typeof c !== "object" || Array.isArray(c)) { bad(`${at}.${scheme}`, `must be an object of colours (${COLOR_KEYS.join(", ")})`); continue; }
    for (const [k, v] of Object.entries(c)) {
      if (!COLOR_KEYS.includes(k)) bad(`${at}.${scheme}.${k}`, `is not a colour token (${COLOR_KEYS.join(", ")})`);
      else if (!isHex(v)) bad(`${at}.${scheme}.${k}`, "must be a colour as #rrggbb");
    }
  }
  for (const list of ["series", "seriesDark"]) {
    const s = theme[list];
    if (s === undefined) continue;
    if (!Array.isArray(s) || !s.length || s.length > MAX_SERIES) bad(`${at}.${list}`, `must be a list of 1 to ${MAX_SERIES} colours, in slot order`);
    else s.forEach((v, i) => { if (!isHex(v)) bad(`${at}.${list}[${i}]`, "must be a colour as #rrggbb"); });
  }
  if (theme.font !== undefined && (typeof theme.font !== "string" || !theme.font.trim() || theme.font.length > 200 || /[{};@\\]|url\(/i.test(theme.font))) bad(`${at}.font`, "must be a font stack: family names separated by commas, nothing else");
  if (theme.radius !== undefined && !(Number.isInteger(theme.radius) && theme.radius >= 0 && theme.radius <= 16)) bad(`${at}.radius`, "must be a whole number of pixels from 0 to 16");
  if (theme.logo !== undefined && theme.logo !== null) { const r = readLogo(theme.logo); if (r.ok === false) bad(`${at}.logo`, r.problem); }
  if (theme.notes !== undefined) {
    if (!Array.isArray(theme.notes)) bad(`${at}.notes`, "must be a list of the validator's notes");
    else theme.notes.forEach((n, i) => { if (!n || typeof n !== "object" || typeof n.token !== "string" || typeof n.reason !== "string" || !("given" in n) || !("replacedWith" in n)) bad(`${at}.notes[${i}]`, "must be {token, given, replacedWith, reason}"); });
  }
  return problems;
}

/**
 * The theme a page renders in: every token given, derived or defaulted, and a
 * note for every token the validator replaced. Never refuses: a theme that
 * is wrong everywhere resolves to the default with a note per token.
 * @param {?Theme} [theme] T-11 `theme`, already shape-valid (themeShapeProblems is empty); null or absent = the default
 * @returns {{theme: ResolvedTheme, notes: ThemeNote[], derivedDark: boolean}}
 */
export function validateTheme(theme) {
  const t = theme ?? {};
  /** @type {ThemeNote[]} */
  const notes = [];
  const note = (token, given, replacedWith, reason) => notes.push({ token, given, replacedWith, reason });
  const D = DEFAULT_THEME;

  // ── The light scheme: given tokens, the default for the rest ──────────────
  const given = (scheme) => Object.fromEntries(COLOR_KEYS.map((k) => [k, isHex(t[scheme]?.[k]) ? lower(t[scheme][k]) : null]));
  const light = given("colors");
  const colors = /** @type {ThemeColors} */ (Object.fromEntries(COLOR_KEYS.map((k) => [k, light[k] ?? D.colors[k]])));
  checkScheme(colors, light, D.colors, "colors", note);

  // ── The dark scheme: given, or derived from the light one, then checked ───
  const derivedDark = t.dark === undefined;
  const darkGiven = given("dark");
  const dark = /** @type {ThemeColors} */ (Object.fromEntries(COLOR_KEYS.map((k) => {
    if (darkGiven[k]) return [k, darkGiven[k]];
    // No dark value: derive it from the light one when the light one was given, else the default's dark.
    return [k, light[k] ? flipForDark(light[k], k) : D.dark[k]];
  })));
  // A derived token that fails falls back like a given one; the note says it was derived.
  const darkSource = Object.fromEntries(COLOR_KEYS.map((k) => [k, darkGiven[k] ? darkGiven[k] : light[k] ? `derived from colors.${k}` : null]));
  checkScheme(dark, darkSource, D.dark, "dark", note);

  // ── Series: given slots, the default's for the rest; dark derived or given ─
  const seriesGiven = Array.isArray(t.series) ? t.series.map(lower) : [];
  const series = D.series.map((v, i) => seriesGiven[i] ?? v);
  checkSeries(series, seriesGiven, D.series, colors.bg, "series", note);
  const seriesDarkGiven = Array.isArray(t.seriesDark) ? t.seriesDark.map(lower) : [];
  const seriesDark = D.seriesDark.map((v, i) => seriesDarkGiven[i] ?? (seriesGiven[i] ? seriesForDark(series[i]) : v));
  const seriesDarkSource = seriesDark.map((_, i) => seriesDarkGiven[i] ?? (seriesGiven[i] ? `derived from series[${i}]` : null));
  checkSeries(seriesDark, seriesDarkSource, D.seriesDark, dark.bg, "seriesDark", note, true);

  // ── Font, radius, logo ────────────────────────────────────────────────────
  let font = D.font;
  if (typeof t.font === "string" && t.font.trim()) {
    if (isSystemStack(t.font)) font = t.font.trim();
    else note("font", t.font, D.font, `a page makes no network request and embeds no font, so only system families can be relied on; ${fontFamilies(t.font).filter((f) => !SYSTEM_FONTS.includes(f)).map((f) => `"${f}"`).join(", ")} is not one`);
  }
  const radius = Number.isInteger(t.radius) && t.radius >= 0 && t.radius <= 16 ? t.radius : D.radius;
  const logo = typeof t.logo === "string" && readLogo(t.logo).ok ? t.logo : null;
  return { theme: { colors, dark, series, seriesDark, font, radius, logo }, notes, derivedDark };
}
/** Text contrast per token against every surface it is drawn on; a failing token takes the default's value. */
function checkScheme(scheme, source, fallback, prefix, note) {
  const surfaces = ["bg", "soft", "note", "shade"];
  const fails = (token, min, ...against) => against.map((s) => [s, round(contrast(scheme[token], scheme[s]))]).filter(([, c]) => c < min);
  // Surfaces first: a surface that reads as text, or text that reads as a surface, would fail every check after it.
  for (const token of ["fg", "muted", "accent"]) {
    const low = fails(token, THRESHOLDS.textContrast, ...surfaces);
    if (low.length && scheme[token] !== fallback[token]) {
      note(`${prefix}.${token}`, source[token] ?? scheme[token], fallback[token], `text must read at ${THRESHOLDS.textContrast}:1 on every surface; it reads ${low.map(([s, c]) => `${c}:1 on ${s}`).join(", ")}`);
      scheme[token] = fallback[token];
      // The surfaces it failed on may be the fault: a surface too close to the default text is replaced too.
      for (const [s] of fails(token, THRESHOLDS.textContrast, ...surfaces)) {
        if (scheme[s] === fallback[s]) continue;
        note(`${prefix}.${s}`, source[s] ?? scheme[s], fallback[s], `the default ${token} text does not read at ${THRESHOLDS.textContrast}:1 on it either`);
        scheme[s] = fallback[s];
      }
    }
  }
  const control = round(contrast(scheme.control, scheme.bg));
  if (control < THRESHOLDS.controlContrast && scheme.control !== fallback.control) {
    note(`${prefix}.control`, source.control ?? scheme.control, fallback.control, `a control's border must read at ${THRESHOLDS.controlContrast}:1 on the page surface; it reads ${control}:1`);
    scheme.control = fallback.control;
  }
  const line = round(contrast(scheme.line, scheme.bg));
  if (line < 1.2 && scheme.line !== fallback.line) {
    note(`${prefix}.line`, source.line ?? scheme.line, fallback.line, `a hairline must be visible on the page surface; it reads ${line}:1`);
    scheme.line = fallback.line;
  }
}
/** Each series slot against the surface and its neighbours; a failing slot takes the default's. */
function checkSeries(series, source, fallback, surface, prefix, note, dark = false) {
  const [lo, hi] = THRESHOLDS.darkBand;
  for (let i = 0; i < series.length; i++) {
    if (series[i] === fallback[i]) continue;
    const vsSurface = round(deltaE(series[i], surface));
    const why = [];
    if (vsSurface < THRESHOLDS.seriesVsSurface) why.push(`it is too close to the page surface (distance ${vsSurface}, at least ${THRESHOLDS.seriesVsSurface} needed)`);
    if (dark) { const L = oklab(series[i])[0]; if (L < lo - 0.05 || L > hi + 0.05) why.push(`its lightness (${round(L)}) is outside the dark band (${lo} to ${hi})`); }
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= series.length) continue;
      const normal = round(deltaE(series[i], series[j]));
      const cvd = round(Math.min(deltaE(series[i], series[j], "protan"), deltaE(series[i], series[j], "deutan")));
      if (normal < THRESHOLDS.seriesNormal) why.push(`slots ${i + 1} and ${j + 1} are too alike (distance ${normal}, at least ${THRESHOLDS.seriesNormal} needed)`);
      else if (cvd < THRESHOLDS.seriesCvd) why.push(`slots ${i + 1} and ${j + 1} are too alike under colour-blind vision (distance ${cvd}, at least ${THRESHOLDS.seriesCvd} needed)`);
    }
    if (why.length) {
      note(`${prefix}[${i}]`, source[i] ?? series[i], fallback[i], why.join("; "));
      series[i] = fallback[i];
    }
  }
}

// ── The token block ──────────────────────────────────────────────────────────
/**
 * The page's token block, the ONE place every colour, font and radius a page
 * uses is declared: the brand-facing tokens in the first block of each pair,
 * the status tokens in their own block (never part of a theme), light and
 * dark; and the light pair again for print, so paper is never dark.
 * @param {ResolvedTheme} theme
 */
export function tokensCss(theme) {
  const brand = (c, series) => `--font:${theme.font};--mono:${MONO_FONT};--radius:${theme.radius}px;` + COLOR_KEYS.map((k) => `--${k}:${c[k]}`).join(";") + ";" + series.map((v, i) => `--series-${i + 1}:${v}`).join(";");
  const status = (s) => Object.entries(s).map(([k, v]) => `--status-${k}:${v}`).join(";");
  return `
:root{color-scheme:light dark;${brand(theme.colors, theme.series)}}
:root{${status(STATUS_TOKENS.light)}}
@media (prefers-color-scheme:dark){:root{${brand(theme.dark, theme.seriesDark)}}}
@media (prefers-color-scheme:dark){:root{${status(STATUS_TOKENS.dark)}}}
@media print{:root{color-scheme:light;${brand(theme.colors, theme.series)}}:root{${status(STATUS_TOKENS.light)}}}
`;
}
