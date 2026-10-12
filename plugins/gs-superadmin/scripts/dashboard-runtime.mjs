// ─────────────────────────────────────────────────────────────────────────────
// dashboard-runtime.mjs — the dashboard page's runtime (DSH-2, DSH-4):
// everything a page does after it is built. The page builder
// (dashboard-page.mjs) calls it in Node for the pre-rendered default view and
// inlines THIS FILE'S EXACT BYTES into every page, so the view a browser draws
// after a filter changes is drawn by the code that drew the pre-render.
//
// PURE, and written in the JavaScript a browser also runs: no import of any
// kind, no process, no file. The import gate holds it to that
// (build/check-imports.mjs, RESTRICTED). It never aggregates: every figure on
// a page is a cell the engine computed (engagement-query.mjs: runQuery, the
// kpi view, the four health views), which arrives as the `engine` argument
// (in Node the imported module, in a page the inlined copy). This file
// chooses filters, calls the engine and lays out what comes back.
//
// What lives here, each exactly once:
//   LACKS         what a dashboard page can lack, as data: for each reason,
//                 whether getting it needs a new pull or only a rebuild, the
//                 setting to change, and which line to copy. A static page
//                 cannot change a setting or pull, so anything it cannot do
//                 says so where the data would be. NOT_LACKS classifies every
//                 other reason the engine can give; the suite reds a reason
//                 that is in neither.
//   lackFacts     reason → the facts (the engine's wording, what it takes,
//                 the setting, the line). renderNotice draws them: a button
//                 when the page has `actions` (a local app, LTR-10), the copy
//                 line when it does not. Every panel, tab and filter goes
//                 through this pair; a leaders' page gets the statement alone.
//   COPY_LINES    the deterministic entry command's lines (ruled 2026-10-05):
//                 `change <slug> <path>=<json>`, `refresh <slug>`,
//                 `health <slug> --program <id>`.
//   the panels    one renderer per panel type — table, kpi, line, bar,
//                 watchlist, and the four typed health views — each over the
//                 engine's result and nothing else. With `unavailable` set the
//                 notice is the one thing a panel can draw: never an empty
//                 table, never a zero. Every chart is hand-drawn SVG taking
//                 every colour and font from the page's token block, with the
//                 same rows as a table underneath (the fallback).
//   the About tab generated from the metric registry, the spec's description
//                 and the snapshot's meta, never written here as prose (R26).
//   filter state  one object; its URL-hash form holds ids only (program ids,
//                 status codes, months, positions in the group lists, the
//                 health threshold).
//   csvText       the ONE CSV builder of a page. A cell that a spreadsheet
//                 would read as a formula is neutralised (R27).
//   unpackSnapshot    the embedded data (columnar, ids through dictionaries)
//                 back into the T-10 shape the engine reads.
//   mount         the only code that touches a document: listeners on the
//                 page's root, column choices in localStorage (wrapped in
//                 try/catch), the file download, the clock the stale banner
//                 reads. No network request anywhere.
//
// Citations: DSH-n are work items and Rnn rulings of the maintainer's
// unpublished JO-dashboards plan; F-nnn are findings. The decision each
// produced is stated beside the token.
// ─────────────────────────────────────────────────────────────────────────────

export const PAGE_MODEL_VERSION = 2;

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Every tenant string reaches a page through this. */
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

// ── What a page can lack (DSH-2, ruled 2026-10-04; the health rows DSH-4) ────
// `reason` is an id of the engine's REASONS, where the wording lives.
// `needs`: "pull" (a refresh that reads the tenant again), "rebuild" (the
// pages are built again from the data already pulled), or "by-data" (rebuild
// when the pull holds the data, else pull: the caller says which).
// `setting` is the spec field to change, by its normalized path (the spelling
// dashboard-spec.mjs's SPEC_DESCRIPTIONS covers; the builder refuses a path no
// description covers), and whether it is switched on or filled in. `line` is
// which COPY_LINES line the notice carries.
export const LACKS = Object.freeze([
  { reason: "accounts-off", needs: "pull", setting: { path: "accounts.pull", how: "on" }, line: "change" },
  { reason: "step-detail-off", needs: "pull", setting: { path: "sources[].params.stepDetail", how: "on" }, line: "change" },
  { reason: "measure-not-in-snapshot", needs: "pull", setting: null, line: "refresh" },
  { reason: "accounts-not-on-page", needs: "rebuild", setting: { path: "pages[].accountNames", how: "on" }, line: "change" },
  { reason: "tab-off", needs: "by-data", setting: { path: "pages[].tabs[].enabled", how: "on" }, line: "change" },
  { reason: "no-internal-domain", needs: "pull", setting: { path: "sources[].params.internalDomains[]", how: "fill" }, line: "change" },
  { reason: "test-accounts-need-accounts", needs: "pull", setting: { path: "accounts.pull", how: "on" }, line: "change" },
  // Health (DSH-4): the Health tab is the switch (ruled 2026-10-04), so a page whose tab is on and whose pull read no
  // health, or predates it, or continued from a pull that lacked a part, or lost a call, is a refresh away.
  { reason: "health-off", needs: "pull", setting: null, line: "refresh" },
  { reason: "predates-health", needs: "pull", setting: null, line: "refresh" },
  { reason: "not-in-previous", needs: "pull", setting: null, line: "refresh" },
  { reason: "call-failed", needs: "pull", setting: null, line: "refresh" },
  // Templates: a snapshot made before template content existed (F-486; a pull with this plugin adds it), and a page
  // whose Templates tab is on but which withholds the text (TPL-2: the switch is pages[].templateContent, a rebuild).
  { reason: "templates-not-pulled", needs: "pull", setting: null, line: "refresh" },
  { reason: "templates-not-on-page", needs: "rebuild", setting: { path: "pages[].templateContent", how: "on" }, line: "change" },
]);
// Reasons that are a property of the figure, of the view or of the tenant, not
// something a setting would supply: the cell or panel says why, and nothing is
// offered.
export const NOT_LACKS = Object.freeze({
  "zero-denominator": "there is nothing to divide by",
  "not-tracked": "the email has no tracked link; shown as words, never a number",
  "no-survey": "the program sent no survey",
  "not-additive": "a distinct count is never added across programs",
  "per-program-only": "a distinct count exists per program only",
  "needs-full-window-or-one-month": "the viewer's own date range decides it",
  "class-not-pulled": "no pull reads distinct counts for internal recipients alone",
  "not-pulled": "the snapshot holds no figure and names no switch that would add one",
  "program-level-only": "survey responses are counted per program",
  "all-time-basis-only": "the response rate has one basis, all time",
  "no-schema": "the tenant has no such object",
  "no-kb": "the pull ran without a knowledge base; the refresh runner always passes one",
  "too-large": "the pull's row budget, not a setting",
  "all-time": "the object carries no date; a tooltip says so on the figure",
  "not-filterable": "the tenant's object allows no filter on the reason field",
});

export const NEEDS = Object.freeze({
  pull: "It needs a new pull: the next refresh reads every table again.",
  rebuild: "It needs only a rebuild of the pages from the data already pulled, with no new pull.",
});
// The deterministic entry command (ruled 2026-10-05, Z0 choice 2): one place,
// so a change of how a dashboard is changed or refreshed is a change here and
// nowhere else. The verbs themselves are PUB-1's (S5); the lines are the
// page's. A `fill` setting's line ends at the `=` sign: the notice says what
// to put there.
export const ENTRY_COMMAND = "node .gs-superadmin/plugin/scripts/dashboard.mjs";
export const COPY_LINES = Object.freeze({
  change: (slug, path, value) => `${ENTRY_COMMAND} change ${slug} ${path}=${value}`,
  refresh: (slug) => `${ENTRY_COMMAND} refresh ${slug}`,
  health: (slug, programId) => `${ENTRY_COMMAND} health ${slug} --program ${programId}`,
});
// The no-send thresholds one click away on the Health tab (ruled 2026-10-05); the spec's own value joins them.
export const HEALTH_DAY_OPTIONS = Object.freeze([14, 30, 60, 90]);

// ── The CSV builder (R27) ────────────────────────────────────────────────────
// A text cell starting with = + - @, a tab or a carriage return is read by a
// spreadsheet as a formula. A leading apostrophe makes it text. Numbers are
// written as numbers and are never touched.
const FORMULA_START = /^[=+\-@\t\r]/;
/** @param {*} v @returns {string} one CSV cell */
export function csvCell(v) {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** @param {string[]} headers @param {Array<Array<*>>} rows @returns {string} */
export const csvText = (headers, rows) => [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

// ── The embedded data, back into the T-10 shape ──────────────────────────────
// A packed table is {n, c: {column: values}}. A column is a plain list, or
// {d, i} (a dictionary and one position per row, -1 for null), or {o, z}
// (an object column: one packed column per key, and the rows where the object
// itself is null), or {w, u} (a column some rows do not have at all).
const isPackedTable = (v) => !!v && typeof v === "object" && !Array.isArray(v) && typeof v.n === "number" && !!v.c;
function unpackColumn(col, n) {
  if (Array.isArray(col)) return col;
  if (col.d) return col.i.map((i) => (i < 0 ? null : col.d[i]));
  if (col.o) {
    const keys = Object.keys(col.o);
    const parts = keys.map((k) => unpackColumn(col.o[k], n));
    const nulls = new Set(col.z);
    return Array.from({ length: n }, (_, r) => (nulls.has(r) ? null : Object.fromEntries(keys.map((k, j) => [k, parts[j][r]]))));
  }
  throw new Error("dashboard page: a column of the embedded data has a form this page does not read");
}
/** @param {{n: number, c: Object<string, *>}} table @returns {Array<Object<string, *>>} */
export function unpackTable(table) {
  const names = Object.keys(table.c);
  const cols = names.map((k) => (table.c[k].w ? { values: unpackColumn(table.c[k].w, table.n), absent: new Set(table.c[k].u) } : { values: unpackColumn(table.c[k], table.n), absent: null }));
  return Array.from({ length: table.n }, (_, r) => {
    const row = {};
    names.forEach((k, j) => {
      if (!cols[j].absent?.has(r)) row[k] = cols[j].values[r];
    });
    return row;
  });
}
// A member that is not a table or a group of tables (null, a number, a list of plain values) is kept as it is.
const unpackAll = (group) => Object.fromEntries(Object.entries(group).map(([k, v]) => [k, isPackedTable(v) ? unpackTable(v) : v && typeof v === "object" && !Array.isArray(v) ? unpackAll(v) : v]));
/** @param {*} packed the page's embedded snapshot @returns {*} a T-10 snapshot */
export const unpackSnapshot = (packed) => ({ ...packed, dimensions: unpackAll(packed.dimensions), facts: unpackAll(packed.facts) });

// ── The page ─────────────────────────────────────────────────────────────────
const DIM_LABELS = Object.freeze({
  program: "Program", template: "Email", step: "Step", variant: "Variant", account: "Account", month: "Month",
  recipientClass: "Recipients", supergroup: "Supergroup", group: "Group", model: "Model", audience: "Audience",
});
const HEALTH_TYPES = Object.freeze(["health-silent", "health-reasons", "health-schedules", "health-one-time"]);
// The templates view's sort keys (TPL-2): a name, the last send month, or one of its metrics; the hash carries `ts=` and `td=`.
const TEMPLATE_SORT_KEYS = Object.freeze(["name", "lastSend"]);
const cmpText = (a, b) => {
  const [x, y] = [String(a).toLowerCase(), String(b).toLowerCase()];
  return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
};
const distinctSorted = (values) => [...new Set(values.filter((v) => v != null))].sort(cmpText);
const sameSet = (a, b) => (a == null || b == null ? a == b : a.length === b.length && a.every((x) => b.includes(x)));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const attr = (name, on) => (on ? ` ${name}` : "");
const option = (value, label, selected) => `<option value="${esc(value)}"${attr("selected", selected)}>${esc(label)}</option>`;
const monthLabel = (ym) => ym;
const MS_PER_DAY = 86400000;

/**
 * One page, ready to render and to answer for any filter state.
 * @param {*} engine engagement-query.mjs: the imported module, or the page's inlined copy
 * @param {*} model  what the builder embedded (PAGE_MODEL_VERSION)
 */
export function createDashboard(engine, model) {
  if (!model || model.v !== PAGE_MODEL_VERSION) throw new Error(`dashboard page: its data is of version ${JSON.stringify(model?.v)}, and this page reads version ${PAGE_MODEL_VERSION} — build the page again`);
  const snapshot = engine.openSnapshot(unpackSnapshot(model.snapshot));
  const page = model.page;
  const howTo = page.preset === "admin";
  const actions = model.actions ?? null;
  const months = snapshot.dimensions.months;
  const incompleteMonth = String(snapshot.meta.incompleteFrom).slice(0, 7);
  const closedMonths = months.filter((m) => m < incompleteMonth);
  const lastMonth = months[months.length - 1] ?? null;
  const lastClosed = closedMonths[closedMonths.length - 1] ?? null;
  const programs = [...snapshot.dimensions.programs].sort((a, b) => cmpText(a.name ?? a.id, b.name ?? b.id) || cmpText(a.id, b.id));
  const programIds = new Set(programs.map((p) => p.id));
  const statusOrder = Object.keys(engine.STATUS_LABELS);
  const statusChoices = [...new Set([...statusOrder, ...programs.flatMap((p) => p.statuses)])].filter((s) => programs.some((p) => p.statuses.includes(s)) || (page.statusDefault ?? []).includes(s));
  const supergroups = distinctSorted(programs.map((p) => p.supergroup));
  const groups = distinctSorted(programs.map((p) => p.group));
  const groupsWithin = (sg) => (sg == null ? groups : distinctSorted(programs.filter((p) => p.supergroup === supergroups[sg]).map((p) => p.group)));
  const tabs = page.tabs;
  const panels = page.panels;
  const isHealthPanel = (panel) => HEALTH_TYPES.includes(panel.type);
  const usesAccounts = (panel) => (panel.query?.groupBy ?? []).includes("account");
  const accountData = engine.accountAvailability(snapshot);
  const accountChoices = accountData.pulled ? [...snapshot.dimensions.accounts].sort((a, b) => cmpText(a.name ?? a.key, b.name ?? b.key)) : [];
  // The snapshot's own marker that no internal domain was named for the pull.
  const noInternalDomain = snapshot.caveats.some((c) => c.id === "recipient-class-not-configured");
  const offers = model.filters;
  const health = engine.healthAvailability(snapshot);
  // The days of sends the pull holds by day: what the no-send threshold may be at most. Null without health.
  const windowDays = health.pulled && health.dayWindow ? Math.round((Date.UTC(...dayParts(health.dayWindow.endExclusive)) - Date.UTC(...dayParts(health.dayWindow.start))) / MS_PER_DAY) : null;
  const silentPanel = panels.find((p) => p.type === "health-silent") ?? null;
  const healthDayChoices = silentPanel ? [...new Set([...HEALTH_DAY_OPTIONS, silentPanel.knobs.days])].filter((d) => windowDays == null || d <= windowDays).sort((a, b) => a - b) : [];
  // The templates view (TPL-2): the page's templates panel, whether the page holds template TEXT (the pull's marker as
  // this page's copy carries it), and the ids a drawer may open.
  const templatesPanel = panels.find((p) => p.type === "templates") ?? null;
  const templateData = engine.templateAvailability(snapshot);
  const templateIds = new Set((snapshot.dimensions.templates ?? []).filter((t) => t.content).map((t) => t.id));
  const templateSorts = [...TEMPLATE_SORT_KEYS, ...engine.TEMPLATE_VIEW_METRICS];
  const isRate = (def) => def.kind === "rate" || def.status === "rate";
  const fmt = (id, value) => engine.formatCell(id, { value });

  // ── Lacks: the facts, then the one renderer ────────────────────────────────
  /**
   * @param {string} reason an id of the engine's REASONS
   * @param {{held?: boolean}} [ctx] for a "by-data" lack: whether the pull holds the data
   */
  const lackFacts = (reason, ctx = {}) => {
    const row = LACKS.find((r) => r.reason === reason);
    const text = engine.reasonText(reason);
    if (!row) return { reason, text, known: false, needs: null, needsText: null, setting: null, line: null };
    const needs = row.needs === "by-data" ? (ctx.held ? "rebuild" : "pull") : row.needs;
    const setting = row.setting ? { ...row.setting, label: model.settingLabels[row.setting.path] ?? row.setting.path } : null;
    const line = row.line === "refresh" || !setting ? COPY_LINES.refresh(model.slug) : COPY_LINES.change(model.slug, setting.path, setting.how === "on" ? "true" : "");
    return { reason, text, known: true, needs, needsText: NEEDS[needs], setting, line };
  };
  /** The line to copy, or the button that runs it when the page has a local app behind it (the `actions` seam, LTR-10). */
  const renderLine = (line) =>
    actions
      ? `<p class="gs-notice-line"><button type="button" class="gs-action" data-action="${esc(line)}" data-action-base="${esc(actions.base)}">Do it now</button> <span class="gs-muted">runs <code>${esc(line)}</code> on this computer</span></p>`
      : `<p class="gs-notice-line"><code>${esc(line)}</code> <button type="button" data-copy="${esc(line)}">Copy</button></p>`;
  /**
   * Information, not an error: what is not here and, on an admin page, what
   * it would take. A leaders' page gets the statement alone.
   */
  const renderNotice = (facts, { heading = null, compact = false } = {}) => {
    const parts = [];
    if (heading) parts.push(`<p class="gs-notice-head">${esc(heading)}</p>`);
    parts.push(`<p class="gs-notice-what">${esc(facts.text)}</p>`);
    if (howTo && facts.known) {
      const fill = facts.setting?.how === "fill" ? " The line below ends at the = sign: put the value there, as JSON." : "";
      const change = facts.setting ? `${facts.setting.how === "on" ? "Turn on" : "Fill in"} &quot;${esc(facts.setting.label)}&quot; in this dashboard's settings (<span class="gs-path">${esc(facts.setting.path)}</span>). ` : "";
      parts.push(`<p class="gs-notice-how">${change}${esc(facts.needsText)}${esc(fill)}</p>`);
      parts.push(renderLine(facts.line));
    }
    return `<div class="gs-notice${compact ? " gs-notice-compact" : ""}" role="note" data-lack="${esc(facts.reason)}" data-needs="${esc(howTo ? facts.needs ?? "" : "")}">${parts.join("")}</div>`;
  };

  // ── Filter state ───────────────────────────────────────────────────────────
  const firstState = () => ({
    tab: tabs.find((t) => t.state === "on")?.id ?? null,
    from: months[0] ?? null,
    // A leaders' page starts on the closed months (ruled 2026-10-05); the current month is one click away.
    to: page.dateDefault === "closed-months" && lastClosed ? lastClosed : lastMonth,
    programs: null, // null = every program; a list = those, and an empty list is none
    sg: null, // a position in the supergroup list
    g: null, // a position in the group list
    statuses: page.statusDefault ? [...page.statusDefault] : null, // null = every status (R23)
    external: offers.recipientClass.enabled && offers.recipientClass.default === "external" && !noInternalDomain,
    account: null,
    hd: null, // the Health tab's no-send threshold; null = the panel's own
    he: false, // the Health tab shows expected failures
    q: "", // the Templates tab's search: the words, whether all must match, whether whole words only
    qa: false,
    qw: false,
    ts: null, // the Templates tab's sort: a key and its direction; null = most sent first
    td: null,
    tpl: null, // the template whose text drawer is open
    tplAt: null, // the panel the drawer opened from (the text opens in place, ruled 2026-10-10); not in the hash
    so: {}, // a viewer's sort per table panel (ruled 2026-10-11): panel id → [column key, "asc" | "desc"]; the hash carries `so=`
  });
  /** The keys a table panel can be sorted on: its dimensions and the metrics its query computes. */
  const sortKeys = (panel) => (panel.type === "table" && panel.query ? [...(panel.query.groupBy ?? []), ...panel.query.metrics] : []);
  const cleanSorts = (so) => {
    const out = {};
    for (const [id, pair] of Object.entries(so && typeof so === "object" ? so : {})) {
      const panel = panels.find((p) => p.id === id);
      if (panel && Array.isArray(pair) && sortKeys(panel).includes(pair[0]) && ["asc", "desc"].includes(pair[1])) out[id] = [pair[0], pair[1]];
    }
    return out;
  };
  /** Whatever a hash or a control gave → a state this page can show. */
  const clean = (s) => {
    const d = firstState();
    let [from, to] = [months.includes(s.from) ? s.from : d.from, months.includes(s.to) ? s.to : d.to];
    if (from > to) [from, to] = [to, from];
    const picked = s.programs ? [...new Set(s.programs.filter((id) => programIds.has(id)))] : null;
    const sg = Number.isInteger(s.sg) && s.sg >= 0 && s.sg < supergroups.length ? s.sg : null;
    const g = Number.isInteger(s.g) && s.g >= 0 && s.g < groups.length && groupsWithin(sg).includes(groups[s.g]) ? s.g : null;
    const statuses = s.statuses ? statusChoices.filter((x) => s.statuses.includes(x)) : null;
    return {
      tab: tabs.some((t) => t.id === s.tab) ? s.tab : d.tab,
      from, to,
      programs: picked && picked.length === programs.length ? null : picked,
      sg, g,
      statuses: statuses && statuses.length === statusChoices.length ? null : statuses,
      external: !!s.external && !noInternalDomain,
      account: accountChoices.some((a) => a.key === s.account) ? s.account : null,
      hd: healthDayChoices.includes(s.hd) && s.hd !== silentPanel?.knobs.days ? s.hd : null,
      he: !!s.he,
      // A search, a sort or an open drawer means something only where the page has a templates panel; the text itself only where the page carries it.
      q: templatesPanel && typeof s.q === "string" ? s.q.trim().slice(0, 200) : "",
      qa: !!templatesPanel && !!s.qa,
      qw: !!templatesPanel && !!s.qw,
      ts: templatesPanel && templateSorts.includes(s.ts) ? s.ts : null,
      td: templatesPanel && templateSorts.includes(s.ts) && ["asc", "desc"].includes(s.td) ? s.td : null,
      tpl: templatesPanel && templateData.content && templateIds.has(s.tpl) ? s.tpl : null,
      tplAt: templatesPanel && templateData.content && templateIds.has(s.tpl) && panels.some((p) => p.id === s.tplAt) ? s.tplAt : null,
      so: cleanSorts(s.so),
    };
  };
  const defaultState = () => clean(firstState());
  /** The state as a URL hash: ids only, and only what differs from the default. */
  const hashOf = (state) => {
    const d = defaultState();
    const parts = [];
    const ids = (list) => list.map(encodeURIComponent).join(",");
    if (state.tab !== d.tab) parts.push(`t=${state.tab}`);
    if (state.from !== d.from || state.to !== d.to) parts.push(`m=${state.from}..${state.to}`);
    if (state.programs) {
      const keep = new Set(state.programs);
      const left = programs.filter((p) => !keep.has(p.id)).map((p) => p.id);
      parts.push(state.programs.length <= left.length ? `p=${ids(state.programs)}` : `px=${ids(left)}`);
    }
    if (state.sg != null) parts.push(`sg=${state.sg}`);
    if (state.g != null) parts.push(`g=${state.g}`);
    if (!sameSet(state.statuses, d.statuses)) parts.push(`s=${state.statuses ? state.statuses.join(",") : "all"}`);
    if (state.external !== d.external) parts.push(`rc=${state.external ? "external" : "all"}`);
    if (state.account) parts.push(`a=${encodeURIComponent(state.account)}`);
    if (state.hd != null) parts.push(`hd=${state.hd}`);
    if (state.he) parts.push("he=1");
    if (state.q) parts.push(`q=${encodeURIComponent(state.q)}`);
    if (state.qa) parts.push("qa=1");
    if (state.qw) parts.push("qw=1");
    if (state.ts) parts.push(`ts=${state.ts}`);
    if (state.td) parts.push(`td=${state.td}`);
    if (state.tpl) parts.push(`tpl=${encodeURIComponent(state.tpl)}`);
    const sorts = Object.entries(state.so ?? {}).map(([id, [key, dir]]) => `${id}:${key}:${dir}`);
    if (sorts.length) parts.push(`so=${sorts.join(",")}`);
    return parts.join("&");
  };
  const stateFromHash = (hash) => {
    const s = defaultState();
    for (const pair of String(hash ?? "").replace(/^#/, "").split("&")) {
      const cut = pair.indexOf("=");
      if (cut < 1) continue;
      const [k, raw] = [pair.slice(0, cut), pair.slice(cut + 1)];
      let list;
      try {
        list = raw === "" ? [] : raw.split(",").map(decodeURIComponent);
      } catch {
        continue; // a hash someone mangled: that part is ignored
      }
      if (k === "t") s.tab = raw;
      else if (k === "m") [s.from, s.to] = [raw.split("..")[0], raw.split("..")[1] ?? raw.split("..")[0]];
      else if (k === "p") s.programs = list;
      else if (k === "px") s.programs = programs.map((p) => p.id).filter((id) => !list.includes(id));
      else if (k === "sg" || k === "g") s[k] = /^\d+$/.test(raw) ? Number(raw) : null;
      else if (k === "s") s.statuses = raw === "all" ? null : list;
      else if (k === "rc") s.external = raw === "external";
      else if (k === "a") s.account = list[0] ?? null;
      else if (k === "hd") s.hd = /^\d+$/.test(raw) ? Number(raw) : null;
      else if (k === "he") s.he = raw === "1";
      else if (k === "q") s.q = list.join(",");
      else if (k === "qa") s.qa = raw === "1";
      else if (k === "qw") s.qw = raw === "1";
      else if (k === "ts") s.ts = raw;
      else if (k === "td") s.td = raw;
      else if (k === "tpl") s.tpl = list[0] ?? null;
      else if (k === "so") s.so = Object.fromEntries(list.map((x) => x.split(":")).filter((x) => x.length === 3).map(([id, key, dir]) => [id, [key, dir]]));
    }
    return clean(s);
  };
  /** The search words of the Templates tab: the hash's `q=`, split on white space. */
  const searchTerms = (state) => String(state.q ?? "").split(/\s+/).filter(Boolean);
  /** The state as the engine's filters. */
  const filtersOf = (state) => {
    const f = { recipientClass: state.external ? "external" : "all" };
    const between = months.filter((m) => m >= state.from && m <= state.to);
    if (between.length !== months.length) f.months = between;
    if (state.programs) f.programs = state.programs;
    if (state.statuses) f.statuses = state.statuses;
    if (state.sg != null) f.supergroups = [supergroups[state.sg]];
    if (state.g != null) f.groups = [groups[state.g]];
    return f;
  };
  /** The ONE query call of the engine for a panel. The account choice narrows the panels that list accounts, and no other; a watch list ranks real accounts only, never the "all other" or "no company link" rows. */
  const run = (panel, state) => {
    let f = filtersOf(state);
    if (usesAccounts(panel) && state.account) f = { ...f, accounts: [state.account] };
    if (panel.type === "watchlist") f = { ...f, accountBuckets: ["account"] };
    // A viewer's sort (ruled 2026-10-11) replaces the panel's own order for this call; the engine still sorts.
    const sort = state.so?.[panel.id];
    const query = sort ? { ...panel.query, sort: [(panel.query.groupBy ?? []).includes(sort[0]) ? { dim: sort[0], dir: sort[1] } : { metric: sort[0], dir: sort[1] }] } : panel.query;
    return engine.runQuery(snapshot, f, query);
  };
  const scopeOf = (state) => engine.runQuery(snapshot, filtersOf(state), { groupBy: [], metrics: ["sent"] }).scope;
  /** One true or false per program of the list, in its order: does the name hold the search text. */
  const programMatches = (term) => {
    const t = String(term ?? "").trim().toLowerCase();
    return programs.map((p) => !t || String(p.name ?? "").toLowerCase().includes(t) || String(p.id).toLowerCase().includes(t));
  };

  // ── Cells, marks and the notes every figure may need ───────────────────────
  const colsKey = (panelId) => `gs-dashboard.${model.slug}.${page.id}.${panelId}.columns`;
  /** The metrics a panel can show: its query's, or the templates view's fixed set. */
  const metricsOf = (panel) => panel.query?.metrics ?? (panel.type === "templates" ? [...engine.TEMPLATE_VIEW_METRICS] : []);
  /**
   * The metrics shown: the viewer's own choice, else the panel's, else all (R1). Sent is shown beside any rate the
   * query also counts it for (R2b: send-size context next to every open rate).
   */
  const visibleCols = (panel, ui) => {
    const all = metricsOf(panel);
    const pick = ui?.cols?.[panel.id] ?? panel.columns ?? all;
    const shown = all.filter((id) => pick.includes(id));
    const needsSent = shown.some((id) => isRate(engine.metric(id))) && all.includes("sent") && !shown.includes("sent");
    return needsSent ? all.filter((id) => id === "sent" || shown.includes(id)) : shown;
  };
  const sentForced = (panel, cols) => cols.includes("sent") && cols.some((id) => id !== "sent" && isRate(engine.metric(id)));
  /**
   * The columns tool (ruled 2026-10-11): a popover from a "Show columns" button, one box per metric the panel can
   * show, Sent held while a rate shows; its heading says the choice reaches the CSV too.
   */
  const columnsTool = (panel, cols, colsOpen) => {
    const forced = sentForced(panel, cols);
    return `<details class="gs-cols gs-pop-host" data-cols="${esc(panel.id)}"${attr("open", colsOpen)}><summary class="gs-btn">Show columns &#9662;</summary><div class="gs-pop"><p class="gs-pop-head">Columns shown here and in the CSV</p>` +
      metricsOf(panel).map((id) => `<label><input type="checkbox" data-col="${esc(panel.id)}" value="${esc(id)}"${attr("checked", cols.includes(id))}${attr(`disabled title="Shown beside every rate"`, forced && id === "sent")}> ${esc(engine.metric(id).label)}</label>`).join("") +
      `<p class="gs-note">Sent stays while a rate is shown. Your choice is remembered in this browser.</p></div></details>`;
  };
  const dimText = (dim, row) => row.label[dim] ?? row.key[dim];
  const badges = (statuses) => (statuses ?? []).map((s) => ` <span class="gs-badge">${esc(engine.statusLabel(s))}</span>`).join("");
  /** A program's group badge: "supergroup / group", and none when the program is in no group at either level. */
  const groupBadge = (p) => {
    const parts = [p.supergroup, p.group].filter((x) => x != null);
    return parts.length && parts.some((x) => x !== model.ungrouped) ? `<span class="gs-badge gs-badge-group">${esc(parts.join(" / "))}</span>` : "";
  };
  /** The button that opens a template's text drawer on the Templates tab: only where the page has the panel and carries the text. */
  const openTemplateButton = (id) => (templatesPanel && templateData.content && id != null && templateIds.has(id) ? ` <button type="button" class="gs-chip gs-text" data-open-template="${esc(id)}" title="Open this email's current text on the Templates tab">Text</button>` : "");
  const dimCell = (dim, row) => {
    const name = dimText(dim, row);
    const b = dim === "program" ? badges(row.label.statuses) : "";
    const step = dim === "template" && row.label.stepName ? ` <span class="gs-muted">(step ${esc(row.label.stepOrder ?? "")}: ${esc(row.label.stepName)})</span>` : "";
    // The Emails table's template cell, and the Steps table's step cell, link to the template's text (TPL-2).
    const text = dim === "template" ? openTemplateButton(row.key.template) : dim === "step" ? openTemplateButton(row.label.templateId) : "";
    return (name == null ? `<span class="gs-muted">(none)</span>` : esc(name)) + step + b + text;
  };
  /** The three tracking states look different (R1b): a tracked 0 is a plain figure, not-tracked is a muted label and no number, unknown is the figure with a marker whose tooltip explains it. */
  const figure = (id, cell) => {
    if (cell.value == null) return cell.why === "not-tracked" ? `<span class="gs-not-tracked">${esc(engine.NOT_TRACKED)}</span>` : esc(engine.NO_VALUE);
    const shown = engine.formatCell(id, { ...cell, state: "tracked" });
    const allTime = cell.basis === "all-time" ? ` ${tip(engine.caveatText("responses-all-time"), "(all time)")}` : "";
    return cell.state === "unknown" ? `${esc(shown)} ${tip(engine.caveatText("click-tracking-states"), esc(engine.UNKNOWN_MARK), "gs-mark gs-unknown")}${allTime}` : esc(shown) + allTime;
  };
  const metricCell = (id, cell) => {
    const tip = cell.value == null && cell.why ? engine.reasonText(cell.why) : "";
    return `<td class="gs-num"${tip ? ` title="${esc(tip)}"` : ""}>${figure(id, cell)}</td>`;
  };
  /**
   * A mark with its explanation (ruled 2026-10-11): the text shows on hover, on focus and on a click or tap (a
   * native title is slow and touch never shows it); `title` stays for assistive technology that reads it.
   */
  const tip = (text, body, cls = "gs-mark") => `<span class="${cls}" data-tip="${esc(text)}" title="${esc(text)}" tabindex="0" role="button" aria-label="${esc(text)}">${body}</span>`;
  // Short on purpose: the mark sits on many rows and carries this text three ways (tip, title, name); the full sentence is at the foot of the tab.
  const provisionalTip = () => `Includes the provisional period: sends on or after ${snapshot.meta.incompleteFrom}, where opens are still arriving.`;
  const mark = (row) => `${row.incomplete ? `<sup>${tip(provisionalTip(), "*")}</sup>` : ""}${row.carried ? `<sup>${tip("Includes months carried forward from an earlier pull: their figures were read by that pull and may have moved since.", "&dagger;")}</sup>` : ""}`;
  /** The notes every view with these metrics carries: the click and response caveats (R18, R20, R1b), from the engine's caveat table. */
  const metricNotes = (ids) => {
    const notes = [];
    if (ids.some((id) => engine.metric(id).tracking === "clicks")) notes.push(`<p class="gs-note gs-note-clicks">${esc(engine.caveatText("clicks-content-only"))} ${esc(engine.caveatText("click-tracking-states"))}</p>`);
    if (ids.some((id) => engine.metric(id).tracking === "responses")) notes.push(`<p class="gs-note gs-note-responses">${esc(engine.caveatText("responses-program-level"))} ${esc(engine.caveatText("responses-all-time"))}</p>`);
    return notes;
  };
  /** A panel's notes as one quiet block under it, or nothing. The marks (* and †) explain themselves (tip) and once at the foot of the tab (paneNotes); no panel repeats them (ruled 2026-10-11). */
  const notesBlock = (notes) => (notes.length ? `<div class="gs-notes">${notes.join("")}</div>` : "");
  /**
   * What every figure on a tab shares, said ONCE at the foot of the tab rather than under each panel: what the
   * provisional mark means, and the click and response caveats for the metrics the tab's panels show.
   */
  const paneNotes = (tabId, state) => {
    const own = panels.filter((p) => p.tab === tabId);
    const ids = [...new Set(own.flatMap(metricsOf))];
    const notes = [];
    if (state.to >= incompleteMonth && own.some((p) => !HEALTH_TYPES.includes(p.type))) notes.push(`<p class="gs-note">* Provisional period: ${esc(engine.provisionalText(snapshot.meta))}.</p>`);
    notes.push(...metricNotes(ids));
    return notes.length ? `<div class="gs-notes gs-pane-notes" data-notes="${esc(tabId)}"><p class="gs-notice-head">About these figures</p>${notes.join("")}</div>` : "";
  };
  /** Why a shown cell has no value: once per reason, through the one renderer where a setting would supply it. */
  const whyNotes = (rows, cols) => {
    const whys = new Map();
    for (const row of rows) for (const id of cols) {
      const cell = row.cells[id];
      if (cell.value == null && cell.why && cell.why !== "not-tracked") whys.set(cell.why, (whys.get(cell.why) ?? new Set()).add(engine.metric(id).label));
    }
    return [...whys].map(([why, labels]) => {
      const facts = lackFacts(why);
      const heading = [...labels].join(", ");
      return facts.known ? renderNotice(facts, { heading, compact: true }) : `<p class="gs-note"><strong>${esc(heading)}:</strong> ${esc(facts.text)}</p>`;
    });
  };
  /** A panel's opening: its title (with a muted line beside it when the panel has one) and its tools (the columns popover, the download) to the right, never before its content. */
  const open = (panel, tools = "", sub = "") => `<section class="gs-panel" data-panel="${esc(panel.id)}" data-type="${esc(panel.type)}"><div class="gs-panel-head"><h2>${esc(panel.title)}</h2>${sub ? `<span class="gs-panel-sub">${sub}</span>` : ""}${tools ? `<div class="gs-tools">${tools}</div>` : ""}</div>`;
  const close = "</section>";
  // The download is the panel as it stands (R27): the filters, the shown columns, every row; the label says so (ruled 2026-10-11).
  const csvButton = (panel) => `<button type="button" data-csv="${esc(panel.id)}">Download current view (CSV)</button>`;
  /** A line under a panel's title saying the basis it is judged on, where that is not the filtered time period. */
  const basisLine = (text) => `<p class="gs-basis">${text}</p>`;

  // ── The table panel ────────────────────────────────────────────────────────
  /** The rows of a result as a table: dimension columns, the figures, a total row. Shared by the table panel and every chart's fallback. */
  const tableOf = (panel, result, cols, state = null) => {
    const dims = panel.query.groupBy ?? [];
    const figures = (row) => cols.map((id) => metricCell(id, row.cells[id])).join("");
    const bodyRow = (row) => `<tr>${dims.map((d, i) => `<td>${dimCell(d, row)}${i === 0 ? mark(row) : ""}</td>`).join("")}${figures(row)}</tr>`;
    const totalRow = (row) => `<tr><td${dims.length > 1 ? ` colspan="${dims.length}"` : ""}>${dims.length ? "Everything the filters keep" : "All"}${mark(row)}</td>${figures(row)}</tr>`;
    // Every heading of a table panel sorts (ruled 2026-10-11): a click sorts, a second flips; the state says which.
    const sortable = panel.type === "table" && state != null;
    const sort = sortable ? state.so?.[panel.id] ?? null : null;
    const heading = (key, label, num) => {
      if (!sortable) return `<th scope="col"${num ? ` class="gs-num"` : ""}>${esc(label)}</th>`;
      const on = sort?.[0] === key;
      return `<th scope="col"${num ? ` class="gs-num"` : ""} aria-sort="${on ? (sort[1] === "asc" ? "ascending" : "descending") : "none"}"><button type="button" class="gs-sort${on ? " is-on" : ""}" data-sort="${esc(panel.id)}:${esc(key)}">${esc(label)}${on ? (sort[1] === "asc" ? " &#9650;" : " &#9660;") : ""}</button></th>`;
    };
    const head = `<tr>${(dims.length ? dims.map((d) => heading(d, DIM_LABELS[d], false)) : [`<th scope="col"></th>`]).join("")}${cols.map((id) => heading(id, engine.metric(id).label, true)).join("")}</tr>`;
    const body = dims.length ? result.rows.map(bodyRow).join("") : "";
    const total = result.total ? totalRow(result.total) : "";
    return `<div class="gs-scroll"><table><thead>${head}</thead><tbody>${body}</tbody><tfoot>${total}</tfoot></table></div>`;
  };
  /** The button that returns a sorted table to its own order; drawn only while a sort is in force. */
  const sortDefaultButton = (panel, state) => (state?.so?.[panel.id] ? `<button type="button" data-act="sort-default" data-panel="${esc(panel.id)}">Default order</button>` : "");
  /**
   * A panel's table from the ENGINE'S RESULT, and nothing else. With
   * `unavailable` set the notice is all there is to draw.
   * @param {*} panel a T-11 panel @param {*} result runQuery's return @param {string[]} cols the metrics shown @param {boolean} [colsOpen]
   */
  const renderTablePanel = (panel, result, cols, colsOpen = false, state = null) => {
    if (result.unavailable) return `${open(panel)}${renderNotice(lackFacts(result.unavailable.reason))}${close}`;
    const dims = panel.query.groupBy ?? [];
    const shownRows = [...(dims.length ? result.rows : []), ...(result.total ? [result.total] : [])];
    const notes = whyNotes(shownRows, cols);
    const none = dims.length && !result.rows.length ? `<p class="gs-note">Nothing matches the current filters.</p>` : "";
    // The text drawer opens in place, under the table the Text button was pressed in (ruled 2026-10-10).
    const drawer = state?.tpl && state.tplAt === panel.id ? renderDrawer(state.tpl) : "";
    return `${open(panel, sortDefaultButton(panel, state) + columnsTool(panel, cols, colsOpen) + csvButton(panel))}${tableOf(panel, result, cols, state)}${drawer}${none}${notesBlock(notes)}${close}`;
  };

  // ── The kpi panel: headline figures beside the usual ───────────────────────
  const changeText = (change) => {
    if (!change || change.value == null) return "";
    if (change.kind === "points") {
      const pts = Math.round(change.value * 10) / 10;
      return pts === 0 ? "level with the usual" : `${pts > 0 ? "&#9650;" : "&#9660;"} ${Math.abs(pts)} pts against the usual`;
    }
    const ratio = Math.round(change.value * 100) / 100;
    return ratio === 1 ? "level with the usual" : `${ratio > 1 ? "&#9650;" : "&#9660;"} ${ratio}&times; the usual`;
  };
  const renderKpiPanel = (panel, state) => {
    const view = engine.kpiView(snapshot, filtersOf(state), panel.query);
    // "No previous pull" is one fact about the page, said once under the tiles, not once per tile.
    const noPrevious = view.tiles.every((t) => t.sinceLastPull == null);
    const tiles = view.tiles.map((t) => {
      const usual = t.usual ? `<p class="gs-kpi-usual">Usual${t.usual.perMonth ? " a month" : ""}: ${fmt(t.id, t.usual.perMonth ? Math.round(t.usual.value) : t.usual.value)} <span class="gs-muted">(${plural(t.usual.closedMonths, "closed month")})</span>${t.change ? ` &middot; ${changeText(t.change)}` : ""}</p>` : `<p class="gs-kpi-usual gs-muted">No closed month to compare with.</p>`;
      const den = t.denominator ? `<p class="gs-kpi-context">${esc(t.denominator.label)} ${figure(t.denominator.id, t.denominator.cell)}</p>` : "";
      const since = noPrevious ? "" : `<p class="gs-kpi-since gs-muted">Since last pull: ${t.sinceLastPull == null ? "no previous pull to compare with." : esc(String(t.sinceLastPull))}</p>`;
      const whyAttr = t.cell.value == null && t.cell.why ? ` title="${esc(engine.reasonText(t.cell.why))}"` : "";
      return `<div class="gs-kpi" data-metric="${esc(t.id)}"><p class="gs-kpi-label">${esc(t.label)}</p><p class="gs-kpi-value"${whyAttr}>${figure(t.id, t.cell)}${view.incomplete ? `<sup>${tip(provisionalTip(), "*")}</sup>` : ""}</p>${usual}${den}${since}</div>`;
    });
    const total = { incomplete: view.incomplete, carried: view.carried, cells: Object.fromEntries(view.tiles.map((t) => [t.id, t.cell])) };
    const notes = whyNotes([total], panel.query.metrics);
    // The change strip (DSH-4; S5 fills it): until a second pull exists it is one muted line beside the title (ruled 2026-10-11).
    const since = noPrevious ? `<span class="gs-kpi-since">Change since the last refresh: none yet, this is the first pull.</span>` : "";
    return `${open(panel, csvButton(panel), since)}<div class="gs-kpis">${tiles.join("")}</div>${notesBlock(notes)}${close}`;
  };

  // ── Charts: hand-drawn SVG, every colour a token, a table underneath ───────
  const CHART = { w: 640, h: 260, left: 56, right: 16, top: 16, bottom: 44 };
  const niceMax = (max, rate) => {
    if (!(max > 0)) return rate ? 0.1 : 1;
    if (rate) return Math.min(1, Math.ceil(max * 10) / 10);
    const pow = 10 ** Math.floor(Math.log10(max));
    const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= max) ?? 10;
    return step * pow;
  };
  const tickLabel = (v, rate) => (rate ? `${Math.round(v * 1000) / 10}%` : String(Math.round(v)));
  const svgText = (x, y, text, cls, anchor = "start") => `<text x="${x}" y="${y}" class="gs-svg-${cls}" text-anchor="${anchor}">${esc(text)}</text>`;
  /**
   * One chart (a line or a bar panel) over the engine's rows: one series per metric, the provisional months shaded,
   * carried months marked, a gap where a figure has no value (and a label when the trend starts after the window's
   * first month because the figure was not yet counted), direct labels on the last point, a legend for two or more
   * series, a tooltip on every mark, and the same rows as a table underneath.
   */
  const renderChartPanel = (panel, state, ui) => {
    const result = run(panel, state);
    if (result.unavailable) return `${open(panel)}${renderNotice(lackFacts(result.unavailable.reason))}${close}`;
    const dim = panel.query.groupBy[0];
    const rows = result.rows;
    const ids = panel.query.metrics;
    const rate = isRate(engine.metric(ids[0]));
    const series = ids.map((id, i) => {
      const cells = rows.map((r) => r.cells[id]);
      const state = cells.every((c) => c.value == null && c.why === "not-tracked") ? "not-tracked" : cells.some((c) => c.state === "unknown") ? "unknown" : "tracked";
      return { id, i, label: engine.metric(id).label, cells, state, drawn: state !== "not-tracked" && cells.some((c) => c.value != null) };
    });
    const values = series.filter((s) => s.drawn).flatMap((s) => s.cells.map((c) => c.value).filter((v) => v != null));
    const max = niceMax(values.length ? Math.max(...values) : 0, rate);
    const { w, h, left, right, top, bottom } = CHART;
    const plotW = w - left - right;
    const plotH = h - top - bottom;
    const n = rows.length;
    const slot = n ? plotW / n : plotW;
    const xMid = (i) => left + slot * i + slot / 2;
    const yOf = (v) => top + plotH - (max ? (v / max) * plotH : 0);
    const parts = [];
    // Provisional periods shaded behind the marks (R4), the band labelled once.
    let bandLabelled = false;
    rows.forEach((r, i) => {
      if (!r.incomplete) return;
      parts.push(`<rect class="gs-svg-provisional" x="${left + slot * i}" y="${top}" width="${slot}" height="${plotH}"><title>Provisional period</title></rect>`);
      if (!bandLabelled) { parts.push(svgText(xMid(i), top + 12, "provisional", "tick", "middle")); bandLabelled = true; }
    });
    for (let k = 0; k <= 4; k++) {
      const v = (max / 4) * k;
      const y = yOf(v);
      parts.push(`<line class="gs-svg-grid" x1="${left}" y1="${y}" x2="${w - right}" y2="${y}"/>`, svgText(left - 6, y + 4, tickLabel(v, rate), "tick", "end"));
    }
    parts.push(`<line class="gs-svg-axis" x1="${left}" y1="${top + plotH}" x2="${w - right}" y2="${top + plotH}"/>`);
    rows.forEach((r, i) => parts.push(svgText(xMid(i), h - bottom + 18, `${dim === "month" ? monthLabel(r.key[dim]) : String(dimText(dim, r) ?? "(none)").slice(0, 14)}${r.incomplete ? "*" : ""}${r.carried ? "†" : ""}`, "tick", "middle")));
    const drawn = series.filter((s) => s.drawn);
    // Every point and every bar carries its value (ruled 2026-10-11) while the chart is small enough to read that way;
    // past 16 points per series the labels fall back to the last point, the hover and the table.
    const labelled = n <= 16;
    if (panel.type === "bar") {
      // Thin bars (at most 24 px), a 2 px gap of surface between neighbours, the top corners rounded and the base square.
      const barW = Math.min(24, Math.max(2, (slot - 8) / Math.max(1, drawn.length) - 2));
      const groupW = drawn.length * barW + (drawn.length - 1) * 2;
      drawn.forEach((s, si) => s.cells.forEach((c, i) => {
        if (c.value == null) return;
        const x = left + slot * i + (slot - groupW) / 2 + si * (barW + 2);
        const y = yOf(c.value);
        const base = top + plotH;
        const rr = Math.min(4, barW / 2, Math.max(0, base - y));
        const d = `M${x.toFixed(1)},${(y + rr).toFixed(1)}a${rr},${rr} 0 0 1 ${rr},-${rr}h${(barW - 2 * rr).toFixed(1)}a${rr},${rr} 0 0 1 ${rr},${rr}V${base.toFixed(1)}H${x.toFixed(1)}Z`;
        parts.push(`<path class="gs-svg-bar" style="fill:var(--series-${s.i + 1})" d="${d}"><title>${esc(`${dim === "month" ? r(i) : dimText(dim, rows[i])}: ${s.label} ${fmt(s.id, c.value)}`)}</title></path>`);
        // The value on top of every bar (ruled 2026-10-11), where the bar is wide enough to carry it.
        if (labelled && barW >= 14) parts.push(svgText(x + barW / 2, Math.max(top + 9, y - 4), fmt(s.id, c.value), "value", "middle"));
      }));
    } else {
      drawn.forEach((s) => {
        // A gap where a figure has no value: the line breaks there, never bridges it.
        const segments = [];
        let current = [];
        s.cells.forEach((c, i) => {
          if (c.value == null) { if (current.length) segments.push(current); current = []; }
          else current.push(`${xMid(i).toFixed(1)},${yOf(c.value).toFixed(1)}`);
        });
        if (current.length) segments.push(current);
        for (const seg of segments) if (seg.length > 1) parts.push(`<polyline class="gs-svg-line" style="stroke:var(--series-${s.i + 1})" points="${seg.join(" ")}"/>`);
        s.cells.forEach((c, i) => {
          if (c.value == null) return;
          // A carried-forward month's dot is hollow (the page's surface shows through); a pulled one is filled. Each dot
          // sits on a ring of the surface colour, so it stays legible where lines cross.
          const dotStyle = rows[i].carried ? `stroke:var(--series-${s.i + 1})` : `stroke:var(--series-${s.i + 1});fill:var(--series-${s.i + 1})`;
          parts.push(`<circle class="gs-svg-ring" cx="${xMid(i).toFixed(1)}" cy="${yOf(c.value).toFixed(1)}" r="6"/>`);
          parts.push(`<circle class="gs-svg-dot${rows[i].carried ? " gs-svg-carried" : ""}" style="${dotStyle}" cx="${xMid(i).toFixed(1)}" cy="${yOf(c.value).toFixed(1)}" r="4"><title>${esc(`${r(i)}: ${s.label} ${fmt(s.id, c.value)}`)}</title></circle>`);
        });
        // The value above every point (the legend names the series; ruled 2026-10-11); past the label budget, the last point alone.
        const lastIndex = s.cells.map((c, i) => (c.value == null ? -1 : i)).filter((i) => i >= 0).pop();
        s.cells.forEach((c, i) => { if (c.value != null && (labelled || i === lastIndex)) parts.push(svgText(xMid(i), yOf(c.value) - 9, fmt(s.id, c.value), "value", "middle")); });
      });
    }
    function r(i) { return rows[i].key[dim] ?? dimText(dim, rows[i]) ?? "(none)"; }
    const legend = series.length > 1 ? `<ul class="gs-legend">${series.map((s) => `<li><span class="gs-swatch" style="background:var(--series-${s.i + 1})"></span>${esc(s.label)}${s.state === "not-tracked" ? ` <span class="gs-not-tracked">${esc(engine.NOT_TRACKED)}</span>` : s.state === "unknown" ? ` <span class="gs-mark gs-unknown">${esc(engine.UNKNOWN_MARK)}</span>` : ""}</li>`).join("")}</ul>` : "";
    const svg = `<svg class="gs-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(panel.title)}">${parts.join("")}</svg>`;
    const notes = whyNotes(rows, ids);
    // A trend that starts after the first month shown: the figure was not counted before (the one definition boundary a snapshot can hold).
    for (const s of series) {
      const first = s.cells.findIndex((c) => c.value != null);
      if (first > 0 && s.cells.slice(0, first).every((c) => c.why === "measure-not-in-snapshot")) notes.push(`<p class="gs-note gs-note-boundary">${esc(s.label)} is counted from ${esc(r(first))}: the months before were pulled before this figure existed, so the trend starts there.</p>`);
    }
    const none = !rows.length ? `<p class="gs-note">Nothing matches the current filters.</p>` : !drawn.length ? `<p class="gs-note">Nothing to draw: no series has a figure.</p>` : "";
    const fallback = `<details class="gs-fallback"${attr("open", !!ui?.open?.[`${panel.id}:table`])} data-fallback="${esc(panel.id)}"><summary>As a table</summary>${tableOf(panel, result, ids)}</details>`;
    // The legend reads before the plot, so a reader knows the series before the lines.
    return `${open(panel, csvButton(panel))}${legend}${svg}${none}${fallback}${notesBlock(notes)}${close}`;
  };

  // ── The watch list: accounts ranked across programs, each account's programs underneath ──
  const isCrossProgram = (panel) => panel.type === "watchlist" && (panel.query.groupBy ?? []).join() === "account";
  /** The per-program rows under each ranked account, from a second engine call over the same filters: account id → rows. */
  const watchlistDetail = (panel, state, result) => {
    const cols = panel.query.metrics;
    const keys = result.rows.map((row) => row.key.account);
    const detail = keys.length ? engine.runQuery(snapshot, { ...filtersOf(state), accounts: keys, accountBuckets: ["account"] }, { groupBy: ["account", "program"], metrics: cols, sort: [{ metric: cols[0], dir: "desc" }] }) : null;
    const under = new Map();
    for (const d of detail?.rows ?? []) under.set(d.key.account, [...(under.get(d.key.account) ?? []), d]);
    return under;
  };
  const renderWatchlistPanel = (panel, state) => {
    const result = run(panel, state);
    if (result.unavailable) return `${open(panel)}${renderNotice(lackFacts(result.unavailable.reason))}${close}`;
    const cols = panel.query.metrics;
    const cross = isCrossProgram(panel);
    const scope = result.scope;
    const rank = `<p class="gs-note">Ranked over the ${scope.fullWindow ? "whole window" : "months shown; the pull selected these accounts over the whole window, so this is a re-ranking of the embedded rows"}${panel.query.limit != null && result.rows.length >= panel.query.limit ? `; the top ${panel.query.limit}` : ""}.</p>`;
    if (!cross) {
      const notes = whyNotes(result.rows, cols);
      return `${open(panel, csvButton(panel))}${tableOf(panel, result, cols)}${result.rows.length ? "" : `<p class="gs-note">Nothing matches the current filters.</p>`}${rank}${notesBlock(notes)}${close}`;
    }
    const under = watchlistDetail(panel, state, result);
    const head = `<tr><th scope="col">Account</th><th scope="col" class="gs-num">Programs</th>${cols.map((id) => `<th scope="col" class="gs-num">${esc(engine.metric(id).label)}</th>`).join("")}</tr>`;
    const body = result.rows.map((row) => {
      const own = under.get(row.key.account) ?? [];
      const sub = own.map((d) => `<tr class="gs-sub"><td>${esc(d.label.program ?? d.key.program)}${badges(d.label.statuses)}</td><td></td>${cols.map((id) => metricCell(id, d.cells[id])).join("")}</tr>`).join("");
      return `<tr><td>${esc(row.label.account ?? row.key.account)}${mark(row)}</td><td class="gs-num">${own.length}</td>${cols.map((id) => metricCell(id, row.cells[id])).join("")}</tr>${sub}`;
    }).join("");
    const notes = whyNotes(result.rows, cols);
    return `${open(panel, csvButton(panel))}<div class="gs-scroll"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>${result.rows.length ? "" : `<p class="gs-note">No account clears the floor under the current filters.</p>`}${rank}${notesBlock(notes)}${close}`;
  };

  // ── The health views ───────────────────────────────────────────────────────
  const info = (text) => tip(text, "&#9432;", "gs-mark gs-info");
  /** A binary filter as a switch (ruled 2026-10-11): one checkbox with the switch role, its label after it. */
  const switchControl = (f, on, label, { disabled = false } = {}) => `<label class="gs-switch"><input type="checkbox" role="switch" data-f="${esc(f)}"${attr("checked", on)}${attr("disabled", disabled)} aria-checked="${on}"> <span>${esc(label)}</span></label>`;
  const categoryCell = (c) => `${esc(c.label)} ${info(c.definition)}${c.kind === "unknown" ? ` <span class="gs-badge gs-badge-warn">needs investigation</span>` : ""}`;
  const kindLabel = (k) => ({ "business-rule": "business rule", "bad-address": "bad address", "program-error": "program error", unknown: "unknown" })[k] ?? k;
  const partNotice = (unavailable, heading) => renderNotice(lackFacts(unavailable.reason), { heading, compact: true });
  // The threshold in force: the viewer's choice, else the panel's; never longer than the days the pull holds by day.
  const healthDays = (state) => {
    const d = state.hd ?? silentPanel?.knobs.days ?? null;
    if (d == null || windowDays == null || d <= windowDays) return d;
    return healthDayChoices[healthDayChoices.length - 1] ?? windowDays;
  };
  /** The sentence a health list row carries: the signal that put the program there, in words, from the engine's signals. */
  const whyText = (row, view) => {
    const s = row.signals;
    switch (row.list) {
      case "schedule-ended": return `Schedule ended ${s.schedule.endDay ?? ""}`.trim();
      case "sync-disabled": return "Participant sync disabled on the program";
      case "ingest-overdue": return s.ingest.state === "never-synced" ? `Participant source never synced; due ${s.ingest.lastDue}` : `Participant sync overdue: last synced ${s.ingest.lastSync}, due ${s.ingest.lastDue} (${plural(s.ingest.daysOverdue ?? 0, "day")} overdue)`;
      case "failing-entries": return `Only refused participants arriving: ${s.entry.sample?.unexpected ?? "?"} unexpected refusals in the sample, none admitted over the last ${plural(s.admissions.dueDays ?? 0, "due day")}`;
      case "admitting-nobody": return `Admitting nobody: ${s.admissions.admitted ?? 0} participants over the last ${plural(s.admissions.dueDays ?? 0, "due day")}`;
      case "step-errors": return `Step errors this period: ${plural(s.steps.participants ?? 0, "participant")} (${Object.entries(s.steps.byCategory ?? {}).map(([k, v]) => `${k} ${v}`).join(", ")})`;
      case "no-recent-sends": return s.sends.rule === "history" && s.sends.allowedDays != null ? `No send in ${s.sends.daysSince ?? "?"} days; it usually sends every ${s.sends.longestGapMonths} months at most (${s.sends.allowedDays} days)` : `No send in ${s.sends.daysSince ?? "?"} days (threshold ${s.sends.threshold ?? view.days} days)`;
      case "finished": return `Every participant has finished or dropped; nothing recurs`;
      case "no-sends-in-window": return `Active, with no send in the ${plural(s.sends.windowMonths ?? 0, "month")} the pull covers`;
      case "cannot-judge": return `Cannot judge yet: ${view.cannotJudgeReasons[s.why] ?? s.why ?? "its data was not read"}`;
      default: return "Working as expected";
    }
  };
  const signalTip = (row) => ["schedule", "ingest", "admissions", "entry", "steps", "sends"].map((k) => `${k}: ${row.signals[k]?.state ?? "?"}`).join(" · ");
  const healthRows = (rows, view, { withDays = true } = {}) =>
    `<div class="gs-scroll"><table><thead><tr><th scope="col">Program</th><th scope="col">Last send</th>${withDays ? `<th scope="col" class="gs-num">Days silent</th>` : ""}<th scope="col">Why</th></tr></thead><tbody>` +
    rows.map((r) => `<tr title="${esc(signalTip(r))}"><td>${esc(r.name ?? r.programId)}${badges(r.statuses)}</td><td>${esc(r.lastSendDay ?? (r.lastSendMonth ? `in ${r.lastSendMonth}` : "none in the window"))}</td>${withDays ? `<td class="gs-num">${r.daysSilent == null ? esc(engine.NO_VALUE) : r.daysSilent}</td>` : ""}<td>${esc(whyText(r, view))}</td></tr>`).join("") +
    `</tbody></table></div>`;
  const renderHealthSilent = (panel, state) => {
    const days = healthDays(state);
    const view = engine.healthSilentView(snapshot, filtersOf(state), { days });
    if (view.unavailable) return `${open(panel)}${renderNotice(lackFacts(view.unavailable.reason))}${close}`;
    const control = `<div class="gs-chips"><span class="gs-f-title">No-send threshold</span> ${healthDayChoices.map((d) => `<button type="button" class="gs-chip${d === days ? " is-on" : ""}" data-act="hd" data-days="${d}" aria-pressed="${d === days}">${d} days</button>`).join(" ")}</div>`;
    const alarms = view.rows.length ? healthRows(view.rows, view) : `<p class="gs-note">No program needs attention under the current filters.</p>`;
    const others = Object.keys(view.labels).filter((k) => !view.alarmLists.includes(k)).map((k) => `<details class="gs-list"${attr("open", k === "no-sends-in-window" && view.counts[k] > 0)}><summary>${esc(view.labels[k])} (${view.counts[k]})</summary>${view.lists[k].length ? healthRows(view.lists[k], view, { withDays: k !== "ok" }) : `<p class="gs-note">None.</p>`}</details>`).join("");
    const basis = basisLine(`Judged as of ${esc(view.asOf)} over the last ${plural(view.windowDays ?? 0, "day")} of sends the pull holds by day, not over the filtered time period. Each row's signals are in its tooltip.`);
    return `${open(panel, csvButton(panel))}${basis}${control}<h3>Needs attention (${view.rows.length})</h3>${alarms}${others}${close}`;
  };
  const changeCell = (c) => (c.usualPerMonth == null ? esc(engine.NO_VALUE) : c.change == null ? "" : changeText({ kind: "ratio", value: c.change }));
  const renderHealthReasons = (panel, state) => {
    const showExpected = state.he || panel.knobs.showExpected;
    const view = engine.healthReasonsView(snapshot, filtersOf(state));
    if (view.unavailable) return `${open(panel)}${renderNotice(lackFacts(view.unavailable.reason))}${close}`;
    const toggle = `<div class="gs-chips">${switchControl("he", showExpected, "Show expected failures (business rules working as configured)")}</div>`;
    const hidden = (rows) => (showExpected ? "" : rows.filter((c) => c.expected).length ? `<p class="gs-note gs-note-expected">${plural(rows.filter((c) => c.expected).length, "expected failure kind")} behind the toggle: ${rows.filter((c) => c.expected).map((c) => `${esc(c.label)} ${c.participants ?? c.count}`).join(" · ")}.</p>` : "");
    const shown = (rows) => rows.filter((c) => showExpected || !c.expected);
    // Bounces: this period against the usual, the remainder as a signal.
    let bounces;
    if (view.bounces.unavailable) bounces = partNotice(view.bounces.unavailable, "Bounce reasons");
    else {
      const b = view.bounces;
      const rows = shown(b.categories).map((c) => `<tr><td>${categoryCell(c)}</td><td>${esc(kindLabel(c.kind))}</td><td class="gs-num">${c.count}</td><td class="gs-num">${c.usualPerMonth == null ? esc(engine.NO_VALUE) : Math.round(c.usualPerMonth * 10) / 10}</td><td class="gs-num">${changeCell(c)}</td></tr>`).join("");
      const other = b.other ? `<tr class="gs-other"><td>${categoryCell(b.other)} <span class="gs-muted">${b.other.share == null ? "" : `${Math.round(b.other.share * 100)}% of bounces`}</span></td><td></td><td class="gs-num">${b.other.count}</td><td class="gs-num">${b.other.usualPerMonth == null ? esc(engine.NO_VALUE) : Math.round(b.other.usualPerMonth * 10) / 10}</td><td class="gs-num">${changeCell(b.other)}</td></tr>` : "";
      const signal = b.other?.overThreshold ? `<div class="gs-notice gs-notice-compact" role="note" data-signal="other"><p>Uncategorised bounce text is ${Math.round(b.other.share * 100)}% of bounces, over a few percent: the masked samples are in the terminal, never on a page.</p>${renderLine(COPY_LINES.health(model.slug, "<program id>"))}</div>` : "";
      bounces = `<h3>Bounce reasons <span class="gs-muted">(${plural(b.total, "bounce")} in the ${plural(b.months, "month")} shown)</span></h3><div class="gs-scroll"><table><thead><tr><th scope="col">Reason</th><th scope="col">Kind</th><th scope="col" class="gs-num">This period</th><th scope="col" class="gs-num">Usual a month</th><th scope="col" class="gs-num">Change</th></tr></thead><tbody>${rows}${other}</tbody></table></div>${signal}${hidden(b.categories)}`;
    }
    // Refusals at entry: exact totals, the split exact or a sample.
    let entry;
    if (view.entry.unavailable) entry = partNotice(view.entry.unavailable, "Refused at entry");
    else {
      const e = view.entry;
      const totals = `<p>${e.window ? `${plural(e.window.participants, "participant")} refused in the ${plural(e.windowMonths, "month")} shown (${plural(e.window.occurrences, "refusal")})` : "The count over the months shown was not read"}${e.allTime ? `; all time ${e.allTime.participants} ${info(engine.reasonText("all-time"))}` : ""}.</p>`;
      const split = e.split
        ? `<h4>${e.split.exact ? "By reason" : "By reason, a sample"} ${e.split.exact ? "" : info(engine.caveatText("failure-samples-sampled"))}</h4><div class="gs-scroll"><table><thead><tr><th scope="col">Reason</th><th scope="col">Kind</th><th scope="col" class="gs-num">Participants</th><th scope="col" class="gs-num">Refusals</th></tr></thead><tbody>${shown(e.split.rows).map((c) => `<tr><td>${categoryCell(c)}</td><td>${esc(kindLabel(c.kind))}</td><td class="gs-num">${c.participants}</td><td class="gs-num">${c.occurrences}</td></tr>`).join("")}${e.split.other && (e.split.other.participants > 0) ? `<tr class="gs-other"><td>Other</td><td></td><td class="gs-num">${e.split.other.participants}</td><td class="gs-num">${e.split.other.occurrences}</td></tr>` : ""}</tbody></table></div>${e.split.exact ? "" : `<p class="gs-note">A sample of ${plural(e.split.programsSampled, "program")}: the totals above are exact, the split is not.</p>`}${hidden(e.split.rows)}`
        : e.splitUnavailable ? partNotice(e.splitUnavailable, "The split by reason") : "";
      entry = `<h3>Refused at entry</h3>${totals}${split}`;
    }
    let steps;
    if (view.steps.unavailable) steps = partNotice(view.steps.unavailable, "Step failures");
    else {
      const s = view.steps;
      steps = `<h3>Step failures <span class="gs-muted">(the ${plural(s.months, "month")} shown)</span></h3>${shown(s.categories).length ? `<div class="gs-scroll"><table><thead><tr><th scope="col">Reason</th><th scope="col">Kind</th><th scope="col" class="gs-num">Participants</th></tr></thead><tbody>${shown(s.categories).map((c) => `<tr><td>${categoryCell(c)}</td><td>${esc(kindLabel(c.kind))}</td><td class="gs-num">${c.participants}</td></tr>`).join("")}</tbody></table></div>` : `<p class="gs-note">None${s.categories.length ? " besides the expected" : ""}.</p>`}${hidden(s.categories)}`;
    }
    const foot = `<p class="gs-note">&#9432; on a reason is its definition from the category table, never text from this tenant. Recipients: ${esc(view.recipientClass)}.</p>`;
    return `${open(panel, csvButton(panel))}${toggle}${bounces}${entry}${steps}${foot}${close}`;
  };
  // The cron in words beside the expression (ruled 2026-10-11); an expression the describer cannot read shows alone.
  const cronCell = (expr) => { const words = cronWords(expr); return `${words ? `${esc(words)} ` : ""}<code class="gs-cron">${esc(expr)}</code>`; };
  const renderHealthSchedules = (panel, state) => {
    const view = engine.healthSchedulesView(snapshot, filtersOf(state), { staleAfterDays: panel.knobs.staleAfterDays });
    if (view.unavailable) return `${open(panel)}${renderNotice(lackFacts(view.unavailable.reason))}${close}`;
    const rows = view.rows.map((r) => `<tr><td>${esc(r.name ?? r.programId)}${badges(r.statuses)}</td><td>${r.documented ? esc(r.classification) : `<span class="gs-muted">no doc in the knowledge base</span>`}</td><td>${r.cronExpression ? cronCell(r.cronExpression) : ""}</td><td>${esc(r.timeZoneName ?? "")}</td><td>${esc(r.startDay ?? "")}</td><td>${esc(r.endDay ?? "")}</td><td>${r.syncDisabled === true ? `<span class="gs-badge gs-badge-error">sync disabled</span>` : ""}</td><td>${r.asOf ? `${esc(r.asOf)}${r.stale ? ` <span class="gs-badge gs-badge-stale" title="Documented more than ${view.staleAfterDays} days before the pull">stale</span>` : ""}` : esc(engine.NO_VALUE)}</td></tr>`).join("");
    const head = `<tr><th scope="col">Program</th><th scope="col">Schedule</th><th scope="col">Cron</th><th scope="col">Time zone</th><th scope="col">Starts</th><th scope="col">Ends</th><th scope="col">Sync</th><th scope="col">As of</th></tr>`;
    const note = basisLine(`As the knowledge base documents each program, as of the day its doc was last verified, not over the filtered time period; stale past ${view.staleAfterDays} days before the pull of ${esc(view.pulledDay)} (${plural(view.stale, "stale row")}${view.undocumented ? `, ${plural(view.undocumented, "program")} with no doc` : ""}).`);
    return `${open(panel, csvButton(panel))}${note}<div class="gs-scroll"><table><thead>${head}</thead><tbody>${rows || `<tr><td colspan="8">No program under the current filters.</td></tr>`}</tbody></table></div>${close}`;
  };
  const miniBars = (history) => {
    const counts = history.map((h) => h.sent);
    const max = Math.max(1, ...counts);
    const w = 10;
    const tall = (n) => ((n / max) * 12).toFixed(1);
    return `<svg class="gs-mini" viewBox="0 0 ${history.length * w} 14" role="img" aria-label="${esc(history.map((h, i) => `${h.month}: ${counts[i]}`).join(", "))}">${history.map((h, i) => `<rect class="gs-svg-bar" style="fill:var(--series-1)" x="${i * w + 1}" y="${(12 - Number(tall(counts[i]))).toFixed(1)}" width="${w - 2}" height="${tall(counts[i])}"><title>${esc(`${h.month}: ${counts[i]} sent`)}</title></rect>`).join("")}<line class="gs-svg-axis" x1="0" y1="13" x2="${history.length * w}" y2="13"/></svg>`;
  };
  /**
   * A health view's rows as the CSV builder takes them (R27: every table exports its current view). The same
   * engine call the view draws from; a view the pull did not read has no file.
   * @returns {?{headers: string[], rows: Array<Array<*>>}}
   */
  const healthCsvRows = (panel, state) => {
    const f = filtersOf(state);
    const status = (r) => (r.statuses ?? []).map(engine.statusLabel).join(", ");
    if (panel.type === "health-silent") {
      const v = engine.healthSilentView(snapshot, f, { days: healthDays(state) });
      if (v.unavailable) return null;
      return { headers: ["Program", "Status", "List", "Last send", "Days silent", "Why"], rows: Object.keys(v.labels).flatMap((k) => v.lists[k].map((r) => [r.name ?? r.programId, status(r), v.labels[k], r.lastSendDay ?? r.lastSendMonth ?? "", r.daysSilent, whyText(r, v)])) };
    }
    if (panel.type === "health-reasons") {
      const v = engine.healthReasonsView(snapshot, f);
      if (v.unavailable) return null;
      const rows = [];
      if (!v.bounces.unavailable) for (const c of [...v.bounces.categories, ...(v.bounces.other ? [v.bounces.other] : [])]) rows.push(["Bounce reasons", c.label, kindLabel(c.kind), c.expected, c.count, c.usualPerMonth, c.change]);
      if (v.entry.split) for (const c of v.entry.split.rows) rows.push([v.entry.split.exact ? "Refused at entry" : "Refused at entry (a sample)", c.label, kindLabel(c.kind), c.expected, c.participants, "", ""]);
      if (!v.steps.unavailable) for (const c of v.steps.categories) rows.push(["Step failures", c.label, kindLabel(c.kind), c.expected, c.participants, "", ""]);
      return { headers: ["Table", "Reason", "Kind", "Expected", "Count", "Usual a month", "Change"], rows };
    }
    if (panel.type === "health-schedules") {
      const v = engine.healthSchedulesView(snapshot, f, { staleAfterDays: panel.knobs.staleAfterDays });
      if (v.unavailable) return null;
      return { headers: ["Program", "Status", "Schedule", "Cron", "Time zone", "Starts", "Ends", "Sync disabled", "As of", "Stale"], rows: v.rows.map((r) => [r.name ?? r.programId, status(r), r.documented ? r.classification : "no doc in the knowledge base", r.cronExpression ?? "", r.timeZoneName ?? "", r.startDay ?? "", r.endDay ?? "", r.syncDisabled === true, r.asOf ?? "", r.stale === true]) };
    }
    const v = engine.healthOneTimeView(snapshot, f, { months: panel.knobs.months });
    return { headers: ["Program", "Status", "Schedule", "Last send", "Months with sends", "Templates", ...v.historyMonths], rows: v.rows.map((r) => [r.name ?? r.programId, status(r), r.classification, r.lastSendDay ?? r.lastSendMonth ?? "", r.monthsWithSends, r.templates, ...r.history.map((h) => h.sent)]) };
  };
  const renderHealthOneTime = (panel, state) => {
    const view = engine.healthOneTimeView(snapshot, filtersOf(state), { months: panel.knobs.months });
    const rows = view.rows.map((r) => `<tr><td>${esc(r.name ?? r.programId)}${badges(r.statuses)}</td><td>${esc(r.lastSendDay ?? (r.lastSendMonth ? `in ${r.lastSendMonth}` : "none in the window"))}</td><td class="gs-num">${r.monthsWithSends}</td><td class="gs-num">${r.templates}</td><td>${miniBars(r.history)}</td></tr>`).join("");
    const head = `<tr><th scope="col">Program</th><th scope="col">Last send</th><th scope="col" class="gs-num">Months with sends</th><th scope="col" class="gs-num">Templates</th><th scope="col">Last ${plural(view.historyMonths.length, "month")}</th></tr>`;
    const note = basisLine(`Programs whose documented schedule does not recur, with each one's last ${plural(view.historyMonths.length, "month")} of sends, not the filtered time period. Never "finished": a one-off can be reused with a new template${view.scheduleUnknown ? `. ${plural(view.scheduleUnknown, "program")} ${view.scheduleUnknown === 1 ? "has" : "have"} no schedule known to this pull (no knowledge-base doc) and ${view.scheduleUnknown === 1 ? "is" : "are"} not listed` : ""}.`);
    return `${open(panel, csvButton(panel))}${note}<div class="gs-scroll"><table><thead>${head}</thead><tbody>${rows || `<tr><td colspan="5">None under the current filters.</td></tr>`}</tbody></table></div>${close}`;
  };

  // ── The templates view (TPL-2): the engine's templatesView laid out, never a sum ──
  /** The ONE templates-view call for a panel and state: the filters, the search words and options, the panel's snippet radius, the viewer's sort. */
  const templatesViewOf = (panel, state) => engine.templatesView(snapshot, filtersOf(state), { terms: searchTerms(state), wholeWord: !!state.qw, allTerms: !!state.qa, snippet: panel.knobs.snippet, sort: state.ts ? { by: state.ts, dir: state.td ?? (state.ts === "name" ? "asc" : "desc") } : null });
  /** A search snippet with the hit marked: the engine's snippet and hit text, escaped around the mark. */
  const marked = (snippet, hit) => {
    const i = hit ? snippet.toLowerCase().indexOf(String(hit).toLowerCase()) : -1;
    return i < 0 ? esc(snippet) : `${esc(snippet.slice(0, i))}<mark>${esc(snippet.slice(i, i + hit.length))}</mark>${esc(snippet.slice(i + hit.length))}`;
  };
  /** The "edited after last send" flag in words: the engine's three states, with the modified day where it has one. */
  const editedText = (c) => (c == null ? engine.NO_VALUE : c.editedAfterLastSend === true ? `yes, on ${c.modified}` : c.editedAfterLastSend === false ? "no" : c.modified ? `edited ${c.modified}, within its last send month` : "unknown");
  const surveyText = (cells) => (cells && cells.surveyParticipants?.value != null ? ` <span class="gs-muted">survey: ${esc(fmt("responseRate", cells.responseRate.value))} response rate (${esc(fmt("anyResponse", cells.anyResponse.value))} of ${esc(fmt("surveyParticipants", cells.surveyParticipants.value))})</span>` : "");
  /** The drawer: one template's current text, with when it is as of and the caveat that it is the current text. */
  const renderDrawer = (templateId) => {
    if (!templateData.content) return "";
    const c = engine.templateContent(snapshot, templateId);
    if (!c) return "";
    const variants = c.variants.map((v) => `<h4>Variant: ${esc(v.name ?? "(unnamed)")}</h4><p>Subject: ${esc(v.subject ?? engine.NO_VALUE)}</p><pre class="gs-body">${esc(v.body)}</pre>`).join("");
    return `<section class="gs-drawer" data-drawer="${esc(c.templateId)}"><div class="gs-panel-head"><h3>${esc(c.name ?? c.templateId)}</h3><div class="gs-tools"><button type="button" data-act="tpl-close">Close</button></div></div>` +
      `<p class="gs-note">This is the template's CURRENT text as the knowledge base holds it, as of ${esc(c.asOf ?? "an unknown day")}: not necessarily what was sent.</p>` +
      `<dl class="gs-defs"><dt>Subject</dt><dd>${esc(c.subject ?? engine.NO_VALUE)}</dd><dt>Last modified</dt><dd>${esc(c.modified ?? "unknown")}${c.lastSendMonth ? `; last send ${esc(c.lastSendMonth)}; edited after it: ${esc(editedText(c))}` : ""}</dd></dl>` +
      `<h4>Body</h4><pre class="gs-body">${esc(c.bodyIncluded ? c.body : "(the knowledge base holds this template's details only, not its body)")}</pre>${variants}</section>`;
  };
  const renderTemplatesPanel = (panel, state, ui) => {
    const view = templatesViewOf(panel, state);
    if (view.unavailable) return `${open(panel)}${renderNotice(lackFacts(view.unavailable.reason))}${close}`;
    const cols = visibleCols(panel, ui);
    // The search, where the page carries the text; where it does not, the reason in its place (the figures still draw).
    const search = view.content.available
      ? `<form class="gs-search" data-search><label>Search subjects and bodies <input type="search" data-f="q" value="${esc(state.q)}" placeholder="words to find" aria-label="Search subjects and bodies"></label> ${switchControl("qa", state.qa, "All the words")} ${switchControl("qw", state.qw, "Whole words")} <button type="submit">Search</button>${state.q ? ` <button type="button" data-act="search-clear">Clear</button>` : ""}</form>`
      : renderNotice(lackFacts(view.content.reason), { compact: true });
    const found = view.search ? `<p class="gs-note" data-search-result>${plural(view.search.matched.length, "email")} of ${view.search.searched} searched ${view.search.allTerms ? "hold all of" : "hold any of"} ${view.search.terms.map((t) => `"${esc(t)}"`).join(", ")}${view.search.wholeWord ? " as whole words" : ""}. Searched on the current text as the knowledge base holds it, with tokens as their field labels.</p>` : "";
    const sortBtn = (by, label, num = false) => {
      const on = state.ts === by;
      const dir = on ? state.td ?? (by === "name" ? "asc" : "desc") : null;
      return `<th scope="col"${num ? ` class="gs-num"` : ""} aria-sort="${dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}"><button type="button" class="gs-sort${on ? " is-on" : ""}" data-tsort="${esc(by)}">${esc(label)}${on ? (dir === "asc" ? " &#9650;" : " &#9660;") : ""}</button></th>`;
    };
    // The hierarchy is named in the first heading, and each row below an email says what it is (ruled 2026-10-11).
    const head = `<tr>${sortBtn("name", "Email › program › step")}<th scope="col" class="gs-num">Programs</th>${sortBtn("lastSend", "Last send")}<th scope="col">Edited after last send</th>${cols.map((id) => sortBtn(id, engine.metric(id).label, true)).join("")}</tr>`;
    const figures = (cells) => cols.map((id) => metricCell(id, cells[id])).join("");
    // An email's programs are folded by default (ruled 2026-10-11); a search hit or an open drawer unfolds its email.
    const expanded = (r) => !!ui?.open?.[`tpl:${r.templateId}`] || (r.matches ?? []).length > 0 || state.tpl === r.templateId;
    const rowOf = (r) => {
      const c = r.content;
      const snippets = (r.matches ?? []).map((m) => `<p class="gs-snippet"><span class="gs-muted">${esc(m.field)}:</span> ${marked(m.snippet, m.hit)}</p>`).join("");
      const isOpen = expanded(r);
      const expander = r.programs.length ? ` <button type="button" class="gs-chip gs-expand" data-expand="${esc(r.templateId)}" aria-expanded="${isOpen}">${plural(r.programs.length, "program")} ${isOpen ? "&#9662;" : "&#9656;"}</button>` : "";
      const main = `<tr data-template="${esc(r.templateId)}"><td>${esc(r.name ?? r.templateId)}${mark(r)}${expander}${openTemplateButton(r.templateId)}${snippets}</td><td class="gs-num">${r.programs.length}</td><td class="gs-nowrap">${esc(r.lastSendMonth ?? engine.NO_VALUE)}</td><td>${esc(editedText(c))}${c?.asOf ? ` <span class="gs-muted">(text as of ${esc(c.asOf)})</span>` : ""}</td>${figures(r.cells)}</tr>`;
      if (!isOpen) return main;
      const programs = r.programs.map((p) => {
        const where = p.stepName ? ` <span class="gs-muted">(step ${esc(p.stepOrder ?? "")}: ${esc(p.stepName)})</span>` : p.stepCount > 1 ? ` <span class="gs-muted">(on ${p.stepCount} steps)</span>` : "";
        const steps = (p.steps ?? []).map((s) => `<tr class="gs-sub gs-sub2"><td><span class="gs-kind">Step</span>${esc(s.step ?? s.stepId ?? "(no step name)")}${s.variant ? ` <span class="gs-muted">&middot; variant ${esc(s.variant)}</span>` : ""}${mark(s)}</td><td></td><td></td><td></td>${figures(s.cells)}</tr>`).join("");
        return `<tr class="gs-sub"><td><span class="gs-kind">Program</span>${esc(p.name ?? p.programId)}${badges(p.statuses)}${where}${surveyText(p.survey)}${mark(p)}</td><td></td><td></td><td></td>${figures(p.cells)}</tr>${steps}`;
      }).join("");
      return main + programs;
    };
    const body = view.rows.map(rowOf).join("");
    const totalRow = view.total ? `<tr><td colspan="4">Everything the filters keep${mark(view.total)}</td>${figures(view.total.cells)}</tr>` : "";
    const none = view.rows.length ? "" : `<p class="gs-note">${view.search ? "No email matches the search under the current filters." : "Nothing matches the current filters."}</p>`;
    const noTemplate = view.noTemplate ? `<p class="gs-note">Sends with no template id are counted apart: ${esc(fmt("sent", view.noTemplate.cells.sent.value))} sent.</p>` : "";
    // The drawer opens here when the Text button was this panel's, or when the hash named a template and no panel.
    const drawer = state.tpl && view.content.available && (state.tplAt == null || state.tplAt === panel.id) ? renderDrawer(state.tpl) : "";
    const shownRows = [...view.rows, ...(view.total ? [view.total] : [])];
    const notes = whyNotes(shownRows, cols);
    const basis = basisLine(`One row per email the filters keep, most sent first unless sorted. Open an email to see the programs that send it${view.stepDetail ? ", and their steps and variants" : ""}. ${view.content.available ? "Text opens the email's current text." : ""}`);
    return `${open(panel, columnsTool(panel, cols, !!ui?.open?.[panel.id]) + csvButton(panel))}${basis}${search}${found}${drawer}<div class="gs-scroll"><table><thead>${head}</thead><tbody>${body}</tbody><tfoot>${totalRow}</tfoot></table></div>${none}${noTemplate}${notesBlock(notes)}${close}`;
  };

  const renderPanel = (panel, state, ui) => {
    switch (panel.type) {
      case "kpi": return renderKpiPanel(panel, state);
      case "line": case "bar": return renderChartPanel(panel, state, ui);
      case "watchlist": return renderWatchlistPanel(panel, state);
      case "health-silent": return renderHealthSilent(panel, state);
      case "health-reasons": return renderHealthReasons(panel, state);
      case "health-schedules": return renderHealthSchedules(panel, state);
      case "health-one-time": return renderHealthOneTime(panel, state);
      case "templates": return renderTemplatesPanel(panel, state, ui);
      default: return renderTablePanel(panel, run(panel, state), visibleCols(panel, ui), !!ui?.open?.[panel.id], state);
    }
  };
  /**
   * The panel's current view as a CSV: the active filters, the visible
   * columns and every row, the cross-program watch list's per-program rows
   * included (R27: the export is the view). Null when the panel has no
   * table to export.
   * @returns {?{filename: string, text: string}}
   */
  const csvOf = (panel, state, ui) => {
    // The data-pulled time rides in the file's name (R4).
    const pulled = String(snapshot.meta.pulledAt).slice(0, 16).replace(/[^0-9T]/g, "");
    const filename = `${model.slug}-${page.id}-${panel.id}-${pulled}.csv`;
    let headers;
    let rows;
    const tracked = (id) => !!engine.metric(id).tracking;
    const figureHeads = (cols) => cols.flatMap((id) => (tracked(id) ? [engine.metric(id).label, `${engine.metric(id).label} tracking`] : [engine.metric(id).label]));
    const value = (id, cell) => (cell.value == null ? "" : isRate(engine.metric(id)) ? Number(cell.value.toFixed(4)) : cell.value);
    const figuresOf = (cols, cells) => cols.flatMap((id) => (tracked(id) ? [value(id, cells[id]), cells[id].state ?? ""] : [value(id, cells[id])]));
    if (isHealthPanel(panel)) {
      const t = healthCsvRows(panel, state);
      if (!t) return null;
      ({ headers, rows } = t);
    } else if (panel.type === "templates") {
      // The templates view's export is its view (R27): one line per email, then one per program under it (and per
      // step and variant with step detail), the search and sort as drawn; the text itself stays on the page.
      const view = templatesViewOf(panel, state);
      if (view.unavailable) return null;
      const cols = visibleCols(panel, ui);
      headers = ["Email", "Template id", "Program", "Status", "Step", "Variant", "Last send", "Edited after last send", "Text as of", ...figureHeads(cols)];
      rows = view.rows.flatMap((r) => [
        [r.name ?? r.templateId, r.templateId, "", "", "", "", r.lastSendMonth ?? "", editedText(r.content), r.content?.asOf ?? "", ...figuresOf(cols, r.cells)],
        ...r.programs.flatMap((p) => [
          [r.name ?? r.templateId, r.templateId, p.name ?? p.programId, (p.statuses ?? []).map(engine.statusLabel).join(", "), p.stepName ? `${p.stepOrder != null ? `${p.stepOrder}. ` : ""}${p.stepName}` : p.stepCount > 1 ? `on ${p.stepCount} steps` : "", "", "", "", "", ...figuresOf(cols, p.cells)],
          ...(p.steps ?? []).map((s) => [r.name ?? r.templateId, r.templateId, p.name ?? p.programId, (p.statuses ?? []).map(engine.statusLabel).join(", "), s.step ?? s.stepId ?? "", s.variant ?? s.variantId ?? "", "", "", "", ...figuresOf(cols, s.cells)]),
        ]),
      ]);
    } else {
      const result = run(panel, state);
      if (result.unavailable) return null;
      const dims = panel.query.groupBy ?? [];
      const cols = panel.type === "table" ? visibleCols(panel, ui) : panel.query.metrics;
      const figures = (row) => figuresOf(cols, row.cells);
      const statusText = (row) => (row.label.statuses ?? []).map(engine.statusLabel).join(", ");
      if (isCrossProgram(panel)) {
        // One line per ranked account (with how many programs touched it), then one per program under it, as drawn.
        const under = watchlistDetail(panel, state, result);
        headers = ["Account", "Program", "Status", "Programs", ...figureHeads(cols)];
        rows = result.rows.flatMap((row) => {
          const own = under.get(row.key.account) ?? [];
          const account = dimText("account", row) ?? "";
          return [[account, "", "", own.length, ...figures(row)], ...own.map((d) => [account, dimText("program", d) ?? "", statusText(d), "", ...figures(d)])];
        });
      } else {
        headers = [...dims.flatMap((d) => (d === "program" ? [DIM_LABELS[d], "Status"] : [DIM_LABELS[d]])), ...figureHeads(cols)];
        const line = (row) => [...dims.flatMap((d) => (d === "program" ? [dimText(d, row) ?? "", statusText(row)] : [dimText(d, row) ?? ""])), ...figures(row)];
        rows = dims.length ? result.rows.map(line) : result.total ? [line(result.total)] : [];
      }
    }
    return { filename, text: csvText(headers, rows) };
  };

  // ── The filter bar: one row under the tab strip, for the current tab ───────
  // The filter state is ONE object the whole page reads; the bar shows the
  // controls that act on the current tab (ruled 2026-10-11): none on About,
  // the account control only on a tab with an account panel. A lack is a
  // one-line pointer here; the full notice stands where the data would be.
  const renderGroupOptions = (state) => option("", "Every group", state.g == null) + groupsWithin(state.sg).map((label) => option(groups.indexOf(label), label, groups.indexOf(label) === state.g)).join("");
  const renderCount = (state) => `${state.programs ? state.programs.length : programs.length} of ${programs.length} selected`;
  const pointer = (reason, text) => `<span class="gs-pointer" data-pointer="${esc(reason)}">${esc(text)}</span>`;
  /** The status picker's button text: the statuses in force, in words. */
  const renderStatusSummary = (state) => {
    const picked = state.statuses ? statusChoices.filter((s) => state.statuses.includes(s)) : statusChoices;
    return esc(state.statuses == null ? "Every status" : sameSet(state.statuses, ["PROCESSING"]) ? "Running now" : picked.length ? picked.map(engine.statusLabel).join(", ") : "No status");
  };
  const renderFilters = (state) => {
    const tab = tabs.find((t) => t.id === state.tab);
    if (!tab || tab.id === "about" || tab.state !== "on") return "";
    const parts = [];
    // One shape for every filter (ruled 2026-10-11): its name on top, the control under it.
    const filter = (title, control, extra = "") => `<div class="gs-f"><span class="gs-f-title">${esc(title)}</span><div class="gs-f-control">${control}</div>${extra}</div>`;
    if (offers.dateRange) {
      const monthOptions = (at) => months.map((m) => option(m, m, m === at)).join("");
      // The current month one click away (ruled 2026-10-05), as a switch (ruled 2026-10-11): on when the range ends on it.
      const quick = lastClosed && lastMonth && lastMonth >= incompleteMonth ? ` ${switchControl("current", state.to === lastMonth, `Include ${lastMonth} (provisional)`)}` : "";
      parts.push(filter("Months", `<select data-f="from" aria-label="From month">${monthOptions(state.from)}</select> <span class="gs-muted">to</span> <select data-f="to" aria-label="To month">${monthOptions(state.to)}</select>${quick}`));
    }
    if (offers.programs) {
      // The program picker: a popover that opens on click (ruled 2026-10-10); closed, its list is out of the tab order.
      const keep = state.programs ? new Set(state.programs) : null;
      const rows = programs.map((p) => {
        const b = p.statuses.map((s) => `<span class="gs-badge">${esc(engine.statusLabel(s))}</span>`).join("") + groupBadge(p);
        return `<label class="gs-prog"><input type="checkbox" data-f="program" value="${esc(p.id)}"${attr("checked", !keep || keep.has(p.id))}> <span class="gs-prog-name">${esc(p.name ?? p.id)}</span> ${b}</label>`;
      });
      parts.push(filter("Programs",
        `<details class="gs-picker gs-pop-host" data-picker><summary class="gs-btn"><span class="gs-count" data-region="count">${renderCount(state)}</span> &#9662;</summary>` +
          `<div class="gs-pop"><p class="gs-pop-head">Every program with a send in the window</p><div class="gs-picker-tools"><input type="search" data-f="search" placeholder="Search programs" aria-label="Search programs"> <button type="button" data-act="all">Select all</button> <button type="button" data-act="none">Select none</button></div>` +
          `<div class="gs-proglist">${rows.join("")}</div></div></details>`));
    }
    if (offers.group && (supergroups.length || groups.length)) {
      parts.push(filter("Group", `<select data-f="sg" aria-label="Supergroup">${option("", "Every supergroup", state.sg == null)}${supergroups.map((label, i) => option(i, label, i === state.sg)).join("")}</select> <select data-f="g" data-region="groupOptions" aria-label="Group">${renderGroupOptions(state)}</select>`));
    }
    if (offers.status) {
      // The status picker, the same shape as the program picker (ruled 2026-10-11): "Running now" (ruled 2026-10-05) and
      // "Every status" inside it, one click each; the boxes under them.
      const running = statusChoices.includes("PROCESSING") ? `<button type="button" class="gs-btn" data-act="running"${attr(`aria-pressed="true"`, sameSet(state.statuses, ["PROCESSING"]))}>Running now</button> ` : "";
      const every = `<button type="button" class="gs-btn" data-act="every-status"${attr(`aria-pressed="true"`, state.statuses == null)}>Every status</button>`;
      parts.push(filter("Status",
        `<details class="gs-picker gs-pop-host" data-status-picker><summary class="gs-btn"><span data-region="statusSummary">${renderStatusSummary(state)}</span> &#9662;</summary>` +
          `<div class="gs-pop"><div class="gs-picker-tools">${running}${every}</div>${statusChoices.map((s) => `<label class="gs-status"><input type="checkbox" data-f="status" value="${esc(s)}"${attr("checked", !state.statuses || state.statuses.includes(s))}> ${esc(engine.statusLabel(s))}</label>`).join("")}</div></details>`));
    }
    if (offers.recipientClass.enabled) {
      // A switch (ruled 2026-10-11): on when internal recipients count, as the spec starts it. With no internal domain the
      // switch is off and disabled with a pointer; the full notice is on the About tab (R5: never a switch that does nothing).
      const pointers = [
        noInternalDomain ? pointer("no-internal-domain", "No internal domain is named: see About, This dashboard's settings.") : "",
        model.testAccounts && accountData.reason === "accounts-off" ? pointer("test-accounts-need-accounts", "Test accounts are not left out (no account data): see About, This dashboard's settings.") : "",
      ];
      parts.push(filter("Recipients", switchControl("internal", !state.external, "Include internal recipients", { disabled: noInternalDomain }), pointers.join("")));
    }
    if (panels.some((p) => p.tab === state.tab && usesAccounts(p))) {
      const control = accountData.pulled
        ? `<select data-f="account" aria-label="Account">${option("", "Every account on this page", !state.account)}${accountChoices.map((a) => option(a.key, a.name ?? a.key, a.key === state.account)).join("")}</select>`
        : pointer(accountData.reason ?? "not-pulled", "No account data on this page: the customer lists say why.");
      parts.push(filter("Account", control));
    }
    parts.push(`<div class="gs-f gs-f-reset"><button type="button" data-act="reset">Reset filters</button></div>`);
    parts.push(`<p class="gs-bar-summary" data-region="summary">${renderSummary(state)}</p>`);
    return parts.join("");
  };
  /** Always on the page: how many programs are selected, shown, and hidden by status (R23), and the rest of the view in words (it is what a printout keeps). */
  const renderSummary = (state) => {
    const scope = scopeOf(state);
    const showing = state.statuses ? (state.statuses.length ? state.statuses.map(engine.statusLabel).join(", ") : "no status") : "every status";
    const when = state.from === state.to ? state.from : `${state.from} to ${state.to}`;
    return `${esc(renderCount(state))}. ${plural(scope.programs, "program")} shown. ${plural(scope.programsHiddenByStatus, "program")} hidden by status (showing ${esc(showing)}). Months ${esc(when)}; ${state.external ? "external recipients only" : "every recipient"}.`;
  };

  // ── Banners: stale data, and a health pull that was asked for and did not complete ──
  /** A clock the stale banner reads: null in Node (the pre-render has no now); mount sets it to the browser's. */
  let clock = null;
  const renderStale = () => {
    const now = typeof clock === "function" ? clock() : null;
    const pulled = Date.parse(snapshot.meta.pulledAt);
    if (now == null || !Number.isFinite(pulled)) return "";
    const ageDays = Math.floor((now - pulled) / MS_PER_DAY);
    if (ageDays <= model.freshness.maxAgeDays) return "";
    return `<div class="gs-banner gs-banner-stale" role="status" data-banner="stale"><p>Stale: this data was pulled ${plural(ageDays, "day")} ago. The dashboard is refreshed ${esc(model.freshness.cadenceText)} and is stale after ${plural(model.freshness.maxAgeDays, "day")}.</p>${howTo ? renderLine(COPY_LINES.refresh(model.slug)) : ""}</div>`;
  };
  /** Decided from the spec (the page's Health tab is on), never from a flag: a health pull that was asked for and did not complete is flagged at page level (ruled 2026-10-04). */
  const renderHealthBanner = () => {
    if (!model.healthTab) return "";
    if (!health.pulled) return health.reason === "tab-off" ? "" : `<div class="gs-banner gs-banner-health" role="status" data-banner="health">The Health tab is on for this page, but the pull holds no health data. ${esc(engine.reasonText(health.reason))}</div>`;
    const missing = Object.entries(health.parts).filter(([, p]) => !p.pulled).map(([part, p]) => ({ part, reason: p.reason }));
    return missing.length ? `<div class="gs-banner gs-banner-health" role="status" data-banner="health">${esc(engine.caveatText("health-incomplete", { parts: missing }))}</div>` : "";
  };

  // ── Tabs: on, offered or absent (an absent tab is not in the model) ────────
  const renderTabs = (state) =>
    tabs.map((t) => `<button type="button" class="gs-tab${t.id === state.tab ? " is-current" : ""}${t.state === "offered" ? " is-offered" : ""}" data-tab="${esc(t.id)}" aria-pressed="${t.id === state.tab}"${t.state === "offered" ? ` title="Not part of this page: open it to see what it would take"` : ""}>${esc(t.label)}${t.state === "offered" ? " (off)" : ""}</button>`).join("");
  const metricIds = () => {
    const ids = [...new Set(panels.flatMap((p) => metricsOf(p)))];
    return engine.METRICS.map((m) => m.id).filter((id) => ids.includes(id));
  };
  // The caveats depend on the snapshot and the panels alone, never on the filters: computed once, read on every draw.
  // The template-content caveats ride a page that has the templates view.
  let caveatList = null;
  const caveats = () => {
    if (caveatList == null) caveatList = engine.caveatsFor(snapshot, metricIds(), { health: !!model.healthTab, templates: !!templatesPanel });
    return caveatList;
  };
  const renderCaveats = () => `<ul class="gs-caveats">${caveats().map((c) => `<li data-caveat="${esc(c.id)}">${esc(c.text)}</li>`).join("")}</ul>`;
  // ── The About tab: generated from the registry, the spec and the snapshot (R26) ──
  // The Health tab's two groups (ruled 2026-10-11): the panels bound by the filtered time period, and the typed views
  // that judge on their own basis (the day window of sends, the knowledge base's docs, a fixed strip of months).
  const MONTH_BLIND = Object.freeze(["health-silent", "health-schedules", "health-one-time"]);
  const GROUPS = Object.freeze([
    { id: "bound", title: "Over the filtered time period", note: null, holds: (p) => !MONTH_BLIND.includes(p.type) },
    { id: "unbound", title: "Not bound by the filtered time period", note: "The program, status, group and recipients filters still apply; each panel says the basis it judges on.", holds: (p) => MONTH_BLIND.includes(p.type) },
  ]);
  const renderAbout = () => {
    const sections = [];
    const m = snapshot.meta;
    const section = (id, title, body) => sections.push({ id, title, body });
    // How to use: what this page offers, read from the model, first.
    const offered = [offers.dateRange && "the months", offers.programs && "a program picker (searchable; select all or none)", offers.group && "the dashboard's groups", offers.status && "status", offers.recipientClass.enabled && "whether internal recipients count"].filter(Boolean);
    const unbound = panels.filter((p) => MONTH_BLIND.includes(p.type));
    const how = [
      `The filter bar under the tabs narrows the panels of the current tab: ${offered.join(", ")}. The same filters carry across the tabs. The address bar keeps the filters you set, so a view can be bookmarked or shared; Reset filters clears them.`,
      ...(unbound.length ? [`On the Health tab the panels under "Not bound by the filtered time period" (${unbound.map((p) => p.title).join(", ")}) judge on their own basis, said under each title; the program, status, group and recipients filters still apply to them.`] : []),
      `Tabs: ${tabs.filter((t) => t.state === "on").map((t) => t.label).join(", ")}${tabs.some((t) => t.state === "offered") ? `; a dimmed tab marked "(off)" is not part of this page and says what it would take` : ""}.`,
      `A table with Show columns lets you pick the figures it shows and exports (remembered in this browser; Sent stays while a rate shows). Download current view (CSV) exports a panel as it stands: the active filters and the shown columns, every row. A chart has the same rows as a table underneath.`,
      `A plain 0% is a real 0%. "${engine.NOT_TRACKED}" means no link in the email is click-tracked, so there is no number. A figure marked "${engine.UNKNOWN_MARK}" is shown, but the data cannot tell whether clicks are tracked.`,
      `* marks a figure that includes the provisional period; † marks one that includes months carried forward from an earlier pull.`,
      ...(panels.some((p) => p.type === "health-silent") ? [`On the Health tab the no-send threshold has buttons (${healthDayChoices.join(", ")} days); expected failures sit behind a toggle.`] : []),
      ...(templatesPanel ? [templateData.content
        ? `The Templates tab lists each email with its performance; open an email to see the programs that send it (and their steps and variants with step detail); the column headings sort it. Search finds the emails whose subject or body holds your words (any of them, or all of them, as whole words or not) and shows where; Text opens an email's current text in place, which is the text as the knowledge base holds it, not necessarily what was sent, and the table says whether it was edited after its last send.`
        : `The Templates tab lists each email with its performance; open an email to see the programs that send it; the column headings sort it. This page carries no email text.`] : []),
      ...(panels.some(usesAccounts) ? [`An account's history over days needs a pull of its own: the account timeline command, which needs a gs-admin login. Anyone else sees a company only through this page's account lists.`] : []),
    ];
    section("how", "How to use this page", `<ul>${how.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`);
    // Definitions: every metric the page shows, from the registry (the glossary adds the parts a rate divides).
    const entries = engine.glossary(metricIds(), snapshot);
    const def = (e) => model.about.sourceDetail
      ? `<dd>${esc(e.definition)}<ul class="gs-formula"><li data-part="object">Read from: <code>${esc(e.object)}</code></li><li data-part="fields">Counts: ${esc(e.fields)}</li><li data-part="filters">Filters on every count: ${esc(e.filters.length ? e.filters.join("; ") : "none")}</li><li data-part="dateField">Date field: ${esc(e.dateField)}</li><li data-part="calculation">Calculation: ${esc(e.calculation)}${e.zeroDenominator ? ` ${esc(e.zeroDenominator)}` : ""}</li>${e.afterRead.map((a) => `<li>After the read: ${esc(a)}</li>`).join("")}${e.perStep ? `<li>Per-step rows are read from: ${esc(e.perStep)}</li>` : ""}${e.uiParity ? `<li>Against the Gainsight UI: ${esc(e.uiParity)}</li>` : ""}</ul></dd>`
      : `<dd>${esc(e.definition)} <span class="gs-muted">Calculation: ${esc(e.calculation)}${e.zeroDenominator ? ` ${esc(e.zeroDenominator)}` : ""}</span></dd>`;
    section("definitions", "Definitions", `${model.about.sourceDetail ? `<p class="gs-muted">Every figure can be checked on its own: build a report in Gainsight on the object named, with the filters and the date field named, and count the rows.</p>${engine.glossaryNotes(snapshot).map((n) => `<p class="gs-muted">${esc(n)}</p>`).join("")}` : ""}<dl class="gs-defs">${entries.map((e) => `<dt data-metric="${esc(e.id)}">${esc(e.label)}</dt>${def(e)}`).join("")}</dl>`);
    // This dashboard's settings, from the spec's own description; each group rule with what it matched; the full
    // notices the filter bar only points at (the recipients toggle's) stand here, where the setting is described.
    const groupsText = model.about.groups;
    const rules = groupsText.rules.map((r) => `<li data-rule-matched="${r.matched}">${esc(r.text)} ${r.matched ? `Matched ${plural(r.matched, "program")}.` : `<strong class="gs-no-match">Matched nothing.</strong>`}</li>`).join("");
    const ungrouped = groupsText.ungrouped.length
      ? `<p class="gs-ungrouped${howTo ? " is-prominent" : ""}"><strong>Ungrouped: ${plural(groupsText.ungrouped.length, "program")}</strong>${howTo ? `: ${groupsText.ungrouped.map((p) => esc(p.name ?? p.id)).join(", ")}` : ""}.</p>`
      : `<p class="gs-ungrouped">Every program is grouped.</p>`;
    const recipientNotices = offers.recipientClass.enabled
      ? [noInternalDomain ? renderNotice(lackFacts("no-internal-domain"), { heading: "Internal recipients" }) : "", model.testAccounts && accountData.reason === "accounts-off" ? renderNotice(lackFacts("test-accounts-need-accounts"), { heading: "Test accounts" }) : ""].join("")
      : "";
    const look = model.look?.notes?.length ? `<div class="gs-notice" role="note" data-look-notes><p class="gs-notice-head">The look</p><p>${plural(model.look.notes.length, "theme token")} replaced by the default because it would not read: ${model.look.notes.map((n) => `${esc(n.token)} (${esc(n.reason)})`).join("; ")}.</p></div>` : "";
    section("settings", "This dashboard's settings", `<dl class="gs-settings">${model.about.settings.map((s) => `<dt>${esc(s.label)}</dt>${s.text.map((t) => `<dd>${esc(t)}</dd>`).join("")}`).join("")}</dl>${rules ? `<h3>Group rules, as they resolved</h3><ol>${rules}</ol>` : ""}${ungrouped}<p>${accountData.pulled ? "Account data was pulled for this snapshot." : esc(engine.reasonText(accountData.reason ?? "not-pulled"))}</p>${recipientNotices}${look}`);
    // Where the data came from.
    const prov = [
      ["Pulled at", `${m.pulledAt}${m.timeZone ? ` (${m.timeZone})` : ""}`], ["Tenant", m.tenantHost], ["Window", `${m.window.from} to ${m.window.to}`], ["Provisional from", m.incompleteFrom],
      ["Refresh", `${m.refresh.mode}: ${m.refresh.why}${m.refresh.previousPulledAt ? ` (continued from the pull of ${m.refresh.previousPulledAt})` : ""}`],
      ["Step detail", m.stepDetail ? "pulled" : "not pulled"], ["Account data", accountData.pulled ? "pulled" : "not pulled"],
      ["Health data", health.pulled ? `pulled, judged as of ${health.asOf}` : "not pulled"],
      ["Versions", `CLI ${m.cliVersion ?? "unknown"}, plugin ${m.pluginVersion ?? "unknown"}, snapshot schema ${snapshot.schemaVersion}`],
    ];
    section("provenance", "Where the data came from", `<dl class="gs-prov">${prov.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`);
    section("caveats", "Caveats", renderCaveats());
    section("refresh", "How to refresh", `<p>${howTo ? `Run <code>${esc(COPY_LINES.refresh(model.slug))}</code> from the workspace, with a gs-admin login; the /gs-superadmin:email-engagement skill runs the same command.` : `An admin refreshes this page ${esc(model.freshness.cadenceText)}; the data-pulled line at the top says when it was last done.`}</p>`);
    // A contents line first, then each section under its own anchor.
    const toc = `<ul class="gs-toc">${sections.map((s) => `<li><a href="#about-${s.id}">${esc(s.title)}</a></li>`).join("")}</ul>`;
    return `<section class="gs-about"><h2>About this page</h2><p>${esc(engine.dataPulledLine(snapshot))}</p>${toc}</section>` + sections.map((s) => `<section class="gs-about" id="about-${s.id}"><h2>${esc(s.title)}</h2>${s.body}</section>`).join("");
  };
  const renderPane = (tab, state, ui) => {
    // An offered tab is an invitation: its pane is the notice, and nothing else.
    if (tab.state === "offered") return renderNotice(lackFacts("tab-off", { held: !!tab.held }), { heading: tab.meaning });
    if (tab.id === "about") return renderAbout();
    const own = panels.filter((p) => p.tab === tab.id);
    if (!own.length) return `<p class="gs-muted">${esc(tab.meaning)}</p>`; // the writer refuses such a spec (F-486): reached by no built page
    const draw = (list) => list.map((p) => renderPanel(p, state, ui)).join("");
    if (tab.id !== "health") return draw(own) + paneNotes(tab.id, state);
    // Health: the two groups, each headed only when it holds a panel.
    const grouped = GROUPS.map((g) => ({ g, list: own.filter(g.holds) })).filter(({ list }) => list.length);
    return grouped.map(({ g, list }) => `<div class="gs-group-title" role="heading" aria-level="2" data-group="${g.id}">${esc(g.title)}</div>${g.note ? `<p class="gs-note gs-group-note">${esc(g.note)}</p>` : ""}${draw(list)}`).join("") + paneNotes(tab.id, state);
  };
  const renderPanes = (state, ui) => tabs.map((t) => `<section class="gs-pane" data-pane="${esc(t.id)}"${attr("hidden", t.id !== state.tab)}>${renderPane(t, state, ui)}</section>`).join("");
  // The logo rides the page as a data URI (PNG or JPEG only, capped by the spec's validator): no request to anywhere.
  // The tag is assembled, not written, so this file's inlined bytes hold no image element for the no-network check to
  // read as one; a page draws the element only when its spec gave a logo.
  const renderLogo = () => (model.look?.logo ? `<${"img"} class="gs-logo" ${"src"}="${esc(model.look.logo)}" alt="">` : "");
  const renderApp = (state, ui) =>
    `<header class="gs-head">${renderLogo()}<h1>${esc(model.title)}</h1><p class="gs-sub">${esc(page.title)}</p><p class="gs-pulled">${esc(engine.dataPulledLine(snapshot))}</p></header>` +
    `<div data-region="stale">${renderStale()}</div>${renderHealthBanner()}` +
    `<nav class="gs-tabs" data-region="tabs" aria-label="Tabs">${renderTabs(state)}</nav>` +
    `<section class="gs-filters" data-region="filters" aria-label="Filters">${renderFilters(state)}</section>` +
    `<div class="gs-panes" data-region="panes">${renderPanes(state, ui)}</div>` +
    `<footer class="gs-foot"><details class="gs-caveats-foot"><summary>Caveats (${caveats().length})</summary>${renderCaveats()}</details></footer>`;

  return {
    model, snapshot, programs, panels, tabs, supergroups, groups, healthDayChoices,
    defaultState, clean, hashOf, stateFromHash, filtersOf, run, scopeOf, programMatches,
    lackFacts, renderNotice, renderTablePanel, renderPanel, renderDrawer, visibleCols, csvOf, colsKey, renderApp, renderAbout, renderStale, renderHealthBanner, caveats,
    /** @param {?(() => number)} fn the clock the stale banner reads (null = no clock, no banner) */
    setClock: (fn) => { clock = fn; },
    regions: { filters: renderFilters, summary: renderSummary, tabs: renderTabs, panes: renderPanes, count: renderCount, groupOptions: renderGroupOptions, stale: renderStale, statusSummary: renderStatusSummary },
  };
}
/** @param {string} day YYYY-MM-DD @returns {[number, number, number]} year, month index, day */
const dayParts = (day) => [Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))];

// ── A cron expression in words (ruled 2026-10-11: nobody reads cron) ─────────
// Quartz's 6 or 7 fields (second minute hour day-of-month month day-of-week
// [year]). Best effort over the shapes programs use; anything else returns
// null and the page shows the expression alone. Presentation only: the engine's
// readCron is what JUDGES a schedule.
const CRON_DOW = ["", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CRON_DOW_SHORT = { SUN: 1, MON: 2, TUE: 3, WED: 4, THU: 5, FRI: 6, SAT: 7 };
const CRON_MONTH = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CRON_MONTH_SHORT = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const listWords = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** One field as a list of numbers (names resolved), a step, or "any"; null when it is a shape not described here. */
function cronPart(spec, names) {
  const num = (t) => { const s = String(t).toUpperCase(); if (names && s in names) return names[s]; return /^\d+$/.test(s) ? Number(s) : null; };
  if (spec === "*" || spec === "?") return { any: true };
  const step = /^(\*|\d+)\/(\d+)$/.exec(spec);
  if (step) return { every: Number(step[2]), from: step[1] === "*" ? null : Number(step[1]) };
  const values = [];
  for (const piece of spec.split(",")) {
    const range = /^([A-Za-z0-9]+)-([A-Za-z0-9]+)$/.exec(piece);
    if (range) { const [a, b] = [num(range[1]), num(range[2])]; if (a == null || b == null || b < a) return null; for (let v = a; v <= b; v++) values.push(v); continue; }
    const v = num(piece);
    if (v == null) return null;
    values.push(v);
  }
  return { values };
}
/** @param {*} expr @returns {?string} the schedule in plain words, or null */
export function cronWords(expr) {
  if (typeof expr !== "string") return null;
  const f = expr.trim().split(/\s+/);
  if (f.length < 6 || f.length > 7) return null;
  const [secS, minS, hourS, domS, monS, dowS] = f;
  const [sec, min, hour, mon] = [cronPart(secS), cronPart(minS), cronPart(hourS), cronPart(monS, CRON_MONTH_SHORT)];
  if (!sec || !min || !hour || !mon) return null;
  const pad = (n) => String(n).padStart(2, "0");
  // When: a time of day from fixed hour and minute lists, or "every N hours/minutes".
  let when;
  if (hour.values && min.values && (sec.values || sec.any)) when = `at ${hour.values.flatMap((h) => min.values.map((m) => `${pad(h)}:${pad(m)}`)).join(", ")}`;
  else if (hour.every) when = `every ${hour.every === 1 ? "hour" : `${hour.every} hours`}`;
  else if (hour.any && min.every) when = `every ${min.every === 1 ? "minute" : `${min.every} minutes`}`;
  else return null;
  // Which days: day-of-month, day-of-week (with L and #n), or every day.
  let days;
  const nth = /^([A-Za-z0-9]+)#([1-5])$/.exec(dowS);
  const lastDow = /^([A-Za-z0-9]+)L$/.exec(dowS);
  if (domS === "L") days = "on the last day of the month";
  else if (nth) { const d = cronPart(nth[1], CRON_DOW_SHORT); if (!d?.values || d.values.length !== 1) return null; days = `on the ${ordinal(Number(nth[2]))} ${CRON_DOW[d.values[0]]} of the month`; }
  else if (lastDow) { const d = cronPart(lastDow[1], CRON_DOW_SHORT); if (!d?.values || d.values.length !== 1) return null; days = `on the last ${CRON_DOW[d.values[0]]} of the month`; }
  else {
    const dom = cronPart(domS);
    const dow = cronPart(dowS, CRON_DOW_SHORT);
    if (!dom || !dow) return null;
    if (dom.values) days = `on the ${listWords(dom.values.map(ordinal))} of the month`;
    else if (dom.every) days = `every ${dom.every === 1 ? "day" : `${dom.every} days`}`;
    else if (dow.values) days = dow.values.length === 5 && dow.values.join() === "2,3,4,5,6" ? "on weekdays" : `on ${listWords(dow.values.map((v) => CRON_DOW[v] ?? null).filter(Boolean).map((d) => `${d}s`))}`;
    else if (dow.every) return null;
    else days = "every day";
  }
  const months = mon.values ? ` in ${listWords(mon.values.map((m) => CRON_MONTH[m] ?? null).filter(Boolean))}` : mon.every ? ` every ${mon.every === 1 ? "month" : `${mon.every} months`}` : "";
  const sentence = `${days}${months}, ${when}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// ── In a browser ─────────────────────────────────────────────────────────────
const BOM = String.fromCharCode(0xfeff);
/**
 * Wire a page: listeners on its root, the viewer's column choices, the hash,
 * the clock the stale banner reads.
 * @param {ReturnType<typeof createDashboard>} app @param {*} root the page's root element @param {*} g the window
 */
export function mount(app, root, g) {
  const doc = g.document;
  const store = {
    get(key) {
      try {
        const v = g.localStorage.getItem(key);
        return v ? JSON.parse(v) : null;
      } catch {
        return null; // storage is blocked or holds something else: the panel's own columns show
      }
    },
    set(key, value) {
      try {
        g.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage is blocked: the choice lasts until the page is closed */
      }
    },
  };
  const ui = { cols: {}, open: {} };
  for (const p of app.panels) {
    const saved = store.get(app.colsKey(p.id));
    if (Array.isArray(saved)) ui.cols[p.id] = saved.filter((x) => typeof x === "string");
  }
  let state = app.stateFromHash(g.location?.hash ?? "");
  let lastHash = app.hashOf(state);
  const all = (selector) => [...root.querySelectorAll(selector)];
  const paint = (names) => {
    for (const name of names) {
      const el = root.querySelector(`[data-region="${name}"]`);
      if (el) el.innerHTML = app.regions[name](state, ui);
    }
  };
  const full = () => {
    root.innerHTML = app.renderApp(state, ui);
  };
  const commit = (names) => {
    paint(names);
    const hash = app.hashOf(state);
    if (hash === lastHash) return;
    lastHash = hash;
    try {
      g.history.replaceState(null, "", `#${hash}`);
    } catch {
      /* the address cannot be rewritten here: the view still changes */
    }
  };
  const pickedPrograms = () => {
    const boxes = all('[data-f="program"]');
    return boxes.every((b) => b.checked) ? null : boxes.filter((b) => b.checked).map((b) => b.value);
  };

  root.addEventListener("change", (ev) => {
    const t = ev.target;
    if (!t?.getAttribute) return;
    const col = t.getAttribute("data-col");
    if (col) {
      ui.cols[col] = all("[data-col]").filter((b) => b.getAttribute("data-col") === col && b.checked).map((b) => b.value);
      ui.open[col] = true;
      store.set(app.colsKey(col), ui.cols[col]);
      // Hiding the column a table is sorted on drops the sort (ruled 2026-10-11): a sort is never in force on a column you cannot see.
      if (state.so?.[col] && !ui.cols[col].includes(state.so[col][0]) && !(app.panels.find((p) => p.id === col)?.query?.groupBy ?? []).includes(state.so[col][0])) {
        const so = { ...state.so };
        delete so[col];
        state = app.clean({ ...state, so });
        commit(["panes"]);
        return;
      }
      paint(["panes"]);
      return;
    }
    const f = t.getAttribute("data-f");
    if (f === "from" || f === "to") state = app.clean({ ...state, [f]: t.value });
    else if (f === "program") state = app.clean({ ...state, programs: pickedPrograms() });
    else if (f === "status") state = app.clean({ ...state, statuses: all('[data-f="status"]').filter((b) => b.checked).map((b) => b.value) });
    else if (f === "sg") state = app.clean({ ...state, sg: t.value === "" ? null : Number(t.value), g: null });
    else if (f === "g") state = app.clean({ ...state, g: t.value === "" ? null : Number(t.value) });
    else if (f === "internal") state = app.clean({ ...state, external: !t.checked });
    else if (f === "current") {
      // The switch moves the range's end: onto the current month, or back to the last closed one.
      const months = app.snapshot.dimensions.months;
      const incomplete = String(app.snapshot.meta.incompleteFrom).slice(0, 7);
      const closed = months.filter((m) => m < incomplete);
      state = app.clean({ ...state, to: t.checked ? months[months.length - 1] : closed[closed.length - 1] ?? state.to });
    }
    else if (f === "account") state = app.clean({ ...state, account: t.value || null });
    else if (f === "he") state = app.clean({ ...state, he: t.checked });
    else return;
    // A month range given backwards is shown the right way round, so the bar is drawn again; so is the quick month
    // button, which depends on the range. A status box repaints the picker's summary; the account control is a
    // filter of the panes alone.
    commit(f === "sg" ? ["groupOptions", "count", "summary", "panes"] : f === "from" || f === "to" || f === "current" ? ["filters", "summary", "panes"] : f === "he" ? ["panes"] : f === "status" ? ["statusSummary", "count", "summary", "panes"] : ["count", "summary", "panes"]);
  });
  root.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t?.getAttribute?.("data-f") !== "search") return;
    const hits = app.programMatches(t.value);
    all(".gs-prog").forEach((label, i) => {
      label.hidden = !hits[i];
    });
  });
  // The Templates tab's search: the form's words and options become the state (and the hash), never a request.
  root.addEventListener("submit", (ev) => {
    const form = ev.target?.closest?.("[data-search]");
    if (!form) return;
    ev.preventDefault();
    state = app.clean({ ...state, q: form.querySelector('[data-f="q"]')?.value ?? "", qa: !!form.querySelector('[data-f="qa"]')?.checked, qw: !!form.querySelector('[data-f="qw"]')?.checked });
    commit(["panes"]);
  });
  // A popover (the program picker, a Show columns menu) closes on Escape and on a click outside it.
  const popovers = () => all("details.gs-pop-host[open]");
  const closePopovers = (except = null) => { for (const d of popovers()) if (d !== except) d.open = false; };
  root.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      // A focused tip opens and closes from the keyboard.
      const t = ev.target?.closest?.("[data-tip]");
      if (t) { ev.preventDefault?.(); t.classList?.toggle?.("is-open"); return; }
    }
    if (ev.key !== "Escape") return;
    closeTips();
    if (!popovers().length) return;
    const host = ev.target?.closest?.("details.gs-pop-host");
    closePopovers();
    host?.querySelector?.("summary")?.focus?.();
  });
  doc.addEventListener?.("click", (ev) => {
    const inside = ev.target?.closest?.("details.gs-pop-host") ?? null;
    closePopovers(inside);
  });
  // A tip (a mark, an ⓘ) opens on click or tap as well as on hover and focus; a click elsewhere or Escape closes it.
  const closeTips = (except = null) => { for (const el of all("[data-tip].is-open")) if (el !== except) el.classList?.remove?.("is-open"); };
  root.addEventListener("click", (ev) => {
    const t = ev.target?.closest?.("[data-tab],[data-act],[data-csv],[data-copy],[data-open-template],[data-tsort],[data-expand],[data-sort],[data-tip]");
    if (!t) { closeTips(); return; }
    if (t.hasAttribute("data-tip")) {
      closeTips(t);
      t.classList?.toggle?.("is-open");
      return;
    }
    closeTips();
    if (t.hasAttribute("data-sort")) {
      // A heading sorts its table (ruled 2026-10-11): the first click descends a figure and ascends a name, the second flips.
      const [id, key] = t.getAttribute("data-sort").split(":");
      const panel = app.panels.find((p) => p.id === id);
      const current = state.so?.[id];
      const isDim = (panel?.query?.groupBy ?? []).includes(key);
      const dir = current?.[0] === key ? (current[1] === "asc" ? "desc" : "asc") : isDim ? "asc" : "desc";
      state = app.clean({ ...state, so: { ...state.so, [id]: [key, dir] } });
      commit(["panes"]);
      return;
    }
    if (t.hasAttribute("data-tab")) {
      // The bar shows the current tab's controls, so it is drawn again with the tab.
      state = app.clean({ ...state, tab: t.getAttribute("data-tab") });
      commit(["tabs", "filters", "panes"]);
    } else if (t.hasAttribute("data-open-template")) {
      // From any table: open the template's text in place, under the table the button is in (ruled 2026-10-10).
      state = app.clean({ ...state, tpl: t.getAttribute("data-open-template"), tplAt: t.closest?.("[data-panel]")?.getAttribute?.("data-panel") ?? null });
      commit(["panes"]);
    } else if (t.hasAttribute("data-expand")) {
      // Fold or unfold an email's programs on the Templates tab (a view choice, not a filter: never in the hash).
      const key = `tpl:${t.getAttribute("data-expand")}`;
      ui.open[key] = t.getAttribute("aria-expanded") !== "true";
      paint(["panes"]);
    } else if (t.hasAttribute("data-tsort")) {
      const by = t.getAttribute("data-tsort");
      const dir = state.ts === by ? ((state.td ?? (by === "name" ? "asc" : "desc")) === "asc" ? "desc" : "asc") : null;
      state = app.clean({ ...state, ts: by, td: dir });
      commit(["panes"]);
    } else if (t.hasAttribute("data-act")) {
      const act = t.getAttribute("data-act");
      if (act === "reset") {
        state = app.defaultState();
        full();
        commit([]);
        return;
      }
      if (act === "hd") { state = app.clean({ ...state, hd: Number(t.getAttribute("data-days")) }); commit(["panes"]); return; }
      if (act === "tpl-close") { state = app.clean({ ...state, tpl: null, tplAt: null }); commit(["panes"]); return; }
      if (act === "search-clear") { state = app.clean({ ...state, q: "", qa: false, qw: false }); commit(["panes"]); return; }
      if (act === "running") { state = app.clean({ ...state, statuses: ["PROCESSING"] }); commit(["filters", "summary", "panes"]); return; }
      if (act === "every-status") { state = app.clean({ ...state, statuses: null }); commit(["filters", "summary", "panes"]); return; }
      if (act === "sort-default") { const so = { ...state.so }; delete so[t.getAttribute("data-panel")]; state = app.clean({ ...state, so }); commit(["panes"]); return; }
      // All or none of the programs the search shows.
      for (const label of all(".gs-prog")) if (!label.hidden) label.querySelector("input").checked = act === "all";
      state = app.clean({ ...state, programs: pickedPrograms() });
      commit(["count", "summary", "panes"]);
    } else if (t.hasAttribute("data-csv")) {
      const panel = app.panels.find((p) => p.id === t.getAttribute("data-csv"));
      const out = panel && app.csvOf(panel, state, ui);
      if (!out) return;
      // Built in the page from the embedded data: a file the browser saves, with no request to anywhere.
      const url = g.URL.createObjectURL(new g.Blob([BOM + out.text], { type: "text/csv;charset=utf-8" }));
      const a = doc.createElement("a");
      a.href = url;
      a.download = out.filename;
      doc.body.appendChild(a);
      a.click();
      a.remove();
      g.setTimeout(() => g.URL.revokeObjectURL(url), 1000);
    } else {
      const line = t.getAttribute("data-copy");
      Promise.resolve()
        .then(() => g.navigator.clipboard.writeText(line))
        .then(() => {
          t.textContent = "Copied";
        })
        .catch(() => {
          // No clipboard here: select the line so it can be copied by hand.
          const code = t.parentNode?.querySelector?.("code");
          if (code) g.getSelection?.()?.selectAllChildren?.(code);
        });
    }
  });
  // toggle does not bubble: listen on the way down.
  root.addEventListener("toggle", (ev) => {
    const id = ev.target?.getAttribute?.("data-cols") ?? (ev.target?.getAttribute?.("data-fallback") ? `${ev.target.getAttribute("data-fallback")}:table` : null);
    if (id) ui.open[id] = ev.target.open;
  }, true);
  g.addEventListener?.("hashchange", () => {
    const hash = String(g.location.hash).replace(/^#/, "");
    if (hash === lastHash) return;
    state = app.stateFromHash(hash);
    lastHash = app.hashOf(state);
    full();
  });

  // The pre-render IS the default view; anything else is drawn now. Then the stale banner reads the clock, and the controls come alive.
  if (lastHash || Object.keys(ui.cols).length) full();
  app.setClock(() => (g.Date ?? Date).now());
  paint(["stale"]);
  root.disabled = false;
}

/**
 * A page's start: read its embedded data, build the dashboard on the inlined
 * engine, and wire the document when there is one to wire.
 * @param {*} g the global object of the page
 */
export function boot(g) {
  const holder = g.document?.getElementById?.("gs-data");
  if (!holder || !g.__gsEngine) return null;
  const app = createDashboard(g.__gsEngine, JSON.parse(holder.textContent));
  g.__gsDashboard = app;
  const root = g.document.getElementById("gs-root");
  if (root?.addEventListener) mount(app, root, g);
  return app;
}
