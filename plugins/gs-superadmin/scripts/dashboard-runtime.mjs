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
  // Templates (F-486): the tab is on and nothing holds template content yet (TPL-1).
  { reason: "templates-not-pulled", needs: "pull", setting: null, line: "refresh" },
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
  });
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
    }
    return clean(s);
  };
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
    return engine.runQuery(snapshot, f, panel.query);
  };
  const scopeOf = (state) => engine.runQuery(snapshot, filtersOf(state), { groupBy: [], metrics: ["sent"] }).scope;
  /** One true or false per program of the list, in its order: does the name hold the search text. */
  const programMatches = (term) => {
    const t = String(term ?? "").trim().toLowerCase();
    return programs.map((p) => !t || String(p.name ?? "").toLowerCase().includes(t) || String(p.id).toLowerCase().includes(t));
  };

  // ── Cells, marks and the notes every figure may need ───────────────────────
  const colsKey = (panelId) => `gs-dashboard.${model.slug}.${page.id}.${panelId}.columns`;
  /**
   * The metrics shown: the viewer's own choice, else the panel's, else all (R1). Sent is shown beside any rate the
   * query also counts it for (R2b: send-size context next to every open rate).
   */
  const visibleCols = (panel, ui) => {
    const pick = ui?.cols?.[panel.id] ?? panel.columns ?? panel.query.metrics;
    const shown = panel.query.metrics.filter((id) => pick.includes(id));
    const needsSent = shown.some((id) => isRate(engine.metric(id))) && panel.query.metrics.includes("sent") && !shown.includes("sent");
    return needsSent ? panel.query.metrics.filter((id) => id === "sent" || shown.includes(id)) : shown;
  };
  const sentForced = (panel, cols) => cols.includes("sent") && cols.some((id) => id !== "sent" && isRate(engine.metric(id)));
  const dimText = (dim, row) => row.label[dim] ?? row.key[dim];
  const badges = (statuses) => (statuses ?? []).map((s) => ` <span class="gs-badge">${esc(engine.statusLabel(s))}</span>`).join("");
  const dimCell = (dim, row) => {
    const name = dimText(dim, row);
    const b = dim === "program" ? badges(row.label.statuses) : "";
    const step = dim === "template" && row.label.stepName ? ` <span class="gs-muted">(step ${esc(row.label.stepOrder ?? "")}: ${esc(row.label.stepName)})</span>` : "";
    return (name == null ? `<span class="gs-muted">(none)</span>` : esc(name)) + step + b;
  };
  /** The three tracking states look different (R1b): a tracked 0 is a plain figure, not-tracked is a muted label and no number, unknown is the figure with a marker whose tooltip explains it. */
  const figure = (id, cell) => {
    if (cell.value == null) return cell.why === "not-tracked" ? `<span class="gs-not-tracked">${esc(engine.NOT_TRACKED)}</span>` : esc(engine.NO_VALUE);
    const shown = engine.formatCell(id, { ...cell, state: "tracked" });
    const allTime = cell.basis === "all-time" ? ` <span class="gs-mark" title="${esc(engine.caveatText("responses-all-time"))}">(all time)</span>` : "";
    return cell.state === "unknown" ? `${esc(shown)} <span class="gs-mark gs-unknown" title="${esc(engine.caveatText("click-tracking-states"))}">${esc(engine.UNKNOWN_MARK)}</span>${allTime}` : esc(shown) + allTime;
  };
  const metricCell = (id, cell) => {
    const tip = cell.value == null && cell.why ? engine.reasonText(cell.why) : "";
    return `<td class="gs-num"${tip ? ` title="${esc(tip)}"` : ""}>${figure(id, cell)}</td>`;
  };
  const mark = (row) => `${row.incomplete ? `<sup title="Includes the provisional period">*</sup>` : ""}${row.carried ? `<sup title="Includes months carried forward from an earlier pull">&dagger;</sup>` : ""}`;
  /** The notes every view with these metrics carries: the click and response caveats (R18, R20, R1b), from the engine's caveat table. */
  const metricNotes = (ids) => {
    const notes = [];
    if (ids.some((id) => engine.metric(id).tracking === "clicks")) notes.push(`<p class="gs-note gs-note-clicks">${esc(engine.caveatText("clicks-content-only"))} ${esc(engine.caveatText("click-tracking-states"))}</p>`);
    if (ids.some((id) => engine.metric(id).tracking === "responses")) notes.push(`<p class="gs-note gs-note-responses">${esc(engine.caveatText("responses-program-level"))} ${esc(engine.caveatText("responses-all-time"))}</p>`);
    return notes;
  };
  const periodNotes = (rows) => {
    const notes = [];
    if (rows.some((r) => r.incomplete)) notes.push(`<p class="gs-note">* Includes the provisional period: ${esc(engine.provisionalText(snapshot.meta))}.</p>`);
    if (rows.some((r) => r.carried)) notes.push(`<p class="gs-note">&dagger; Includes months carried forward from an earlier pull.</p>`);
    return notes;
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
  const open = (panel) => `<section class="gs-panel" data-panel="${esc(panel.id)}" data-type="${esc(panel.type)}"><h2>${esc(panel.title)}</h2>`;
  const close = "</section>";
  const csvButton = (panel) => `<button type="button" data-csv="${esc(panel.id)}">Download CSV</button>`;

  // ── The table panel ────────────────────────────────────────────────────────
  /** The rows of a result as a table: dimension columns, the figures, a total row. Shared by the table panel and every chart's fallback. */
  const tableOf = (panel, result, cols) => {
    const dims = panel.query.groupBy ?? [];
    const figures = (row) => cols.map((id) => metricCell(id, row.cells[id])).join("");
    const bodyRow = (row) => `<tr>${dims.map((d, i) => `<td>${dimCell(d, row)}${i === 0 ? mark(row) : ""}</td>`).join("")}${figures(row)}</tr>`;
    const totalRow = (row) => `<tr><td${dims.length > 1 ? ` colspan="${dims.length}"` : ""}>${dims.length ? "Everything the filters keep" : "All"}${mark(row)}</td>${figures(row)}</tr>`;
    const head = `<tr>${(dims.length ? dims.map((d) => DIM_LABELS[d]) : [""]).map((h) => `<th scope="col">${esc(h)}</th>`).join("")}${cols.map((id) => `<th scope="col" class="gs-num">${esc(engine.metric(id).label)}</th>`).join("")}</tr>`;
    const body = dims.length ? result.rows.map(bodyRow).join("") : "";
    const total = result.total ? totalRow(result.total) : "";
    return `<div class="gs-scroll"><table><thead>${head}</thead><tbody>${body}</tbody><tfoot>${total}</tfoot></table></div>`;
  };
  /**
   * A panel's table from the ENGINE'S RESULT, and nothing else. With
   * `unavailable` set the notice is all there is to draw.
   * @param {*} panel a T-11 panel @param {*} result runQuery's return @param {string[]} cols the metrics shown @param {boolean} [colsOpen]
   */
  const renderTablePanel = (panel, result, cols, colsOpen = false) => {
    if (result.unavailable) return `${open(panel)}${renderNotice(lackFacts(result.unavailable.reason))}${close}`;
    const dims = panel.query.groupBy ?? [];
    const forced = sentForced(panel, cols);
    const tools =
      `<div class="gs-tools"><details class="gs-cols" data-cols="${esc(panel.id)}"${attr("open", colsOpen)}><summary>Columns</summary>` +
      panel.query.metrics.map((id) => `<label><input type="checkbox" data-col="${esc(panel.id)}" value="${esc(id)}"${attr("checked", cols.includes(id))}${attr(`disabled title="Shown beside every rate"`, forced && id === "sent")}> ${esc(engine.metric(id).label)}</label>`).join("") +
      `</details>${csvButton(panel)}</div>`;
    const shownRows = [...(dims.length ? result.rows : []), ...(result.total ? [result.total] : [])];
    const notes = [...whyNotes(shownRows, cols), ...periodNotes(shownRows), ...metricNotes(cols)];
    const none = dims.length && !result.rows.length ? `<p class="gs-note">Nothing matches the current filters.</p>` : "";
    return `${open(panel)}${tools}${tableOf(panel, result, cols)}${none}${notes.join("")}${close}`;
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
    const tiles = view.tiles.map((t) => {
      const usual = t.usual ? `<p class="gs-kpi-usual">Usual${t.usual.perMonth ? " a month" : ""}: ${fmt(t.id, t.usual.perMonth ? Math.round(t.usual.value) : t.usual.value)} <span class="gs-muted">(${plural(t.usual.closedMonths, "closed month")})</span>${t.change ? ` &middot; ${changeText(t.change)}` : ""}</p>` : `<p class="gs-kpi-usual gs-muted">No closed month to compare with.</p>`;
      const den = t.denominator ? `<p class="gs-kpi-context">${esc(t.denominator.label)} ${figure(t.denominator.id, t.denominator.cell)}</p>` : "";
      const since = `<p class="gs-kpi-since gs-muted">Since last pull: ${t.sinceLastPull == null ? "no previous pull to compare with." : esc(String(t.sinceLastPull))}</p>`;
      const tip = t.cell.value == null && t.cell.why ? ` title="${esc(engine.reasonText(t.cell.why))}"` : "";
      return `<div class="gs-kpi" data-metric="${esc(t.id)}"><p class="gs-kpi-label">${esc(t.label)}</p><p class="gs-kpi-value"${tip}>${figure(t.id, t.cell)}${view.incomplete ? `<sup title="Includes the provisional period">*</sup>` : ""}</p>${usual}${den}${since}</div>`;
    });
    const total = { incomplete: view.incomplete, carried: view.carried, cells: Object.fromEntries(view.tiles.map((t) => [t.id, t.cell])) };
    const notes = [...whyNotes([total], panel.query.metrics), ...periodNotes([total]), ...metricNotes(panel.query.metrics)];
    return `${open(panel)}<div class="gs-tools">${csvButton(panel)}</div><div class="gs-kpis">${tiles.join("")}</div>${notes.join("")}${close}`;
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
    // Provisional periods shaded behind the marks (R4).
    rows.forEach((r, i) => { if (r.incomplete) parts.push(`<rect class="gs-svg-provisional" x="${left + slot * i}" y="${top}" width="${slot}" height="${plotH}"><title>Provisional period</title></rect>`); });
    for (let k = 0; k <= 4; k++) {
      const v = (max / 4) * k;
      const y = yOf(v);
      parts.push(`<line class="gs-svg-grid" x1="${left}" y1="${y}" x2="${w - right}" y2="${y}"/>`, svgText(left - 6, y + 4, tickLabel(v, rate), "tick", "end"));
    }
    parts.push(`<line class="gs-svg-axis" x1="${left}" y1="${top + plotH}" x2="${w - right}" y2="${top + plotH}"/>`);
    rows.forEach((r, i) => parts.push(svgText(xMid(i), h - bottom + 18, `${dim === "month" ? monthLabel(r.key[dim]) : String(dimText(dim, r) ?? "(none)").slice(0, 14)}${r.incomplete ? "*" : ""}${r.carried ? "†" : ""}`, "tick", "middle")));
    const drawn = series.filter((s) => s.drawn);
    if (panel.type === "bar") {
      const barW = Math.max(2, (slot - 6) / Math.max(1, drawn.length) - 2);
      drawn.forEach((s, si) => s.cells.forEach((c, i) => {
        if (c.value == null) return;
        const x = left + slot * i + 3 + si * (barW + 2);
        const y = yOf(c.value);
        parts.push(`<rect class="gs-svg-bar" style="fill:var(--series-${s.i + 1})" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${(top + plotH - y).toFixed(1)}" rx="2"><title>${esc(`${dim === "month" ? r(i) : dimText(dim, rows[i])}: ${s.label} ${fmt(s.id, c.value)}`)}</title></rect>`);
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
          // A carried-forward month's dot is hollow (the page's surface shows through); a pulled one is filled.
          const dotStyle = rows[i].carried ? `stroke:var(--series-${s.i + 1})` : `stroke:var(--series-${s.i + 1});fill:var(--series-${s.i + 1})`;
          parts.push(`<circle class="gs-svg-dot${rows[i].carried ? " gs-svg-carried" : ""}" style="${dotStyle}" cx="${xMid(i).toFixed(1)}" cy="${yOf(c.value).toFixed(1)}" r="4"><title>${esc(`${r(i)}: ${s.label} ${fmt(s.id, c.value)}`)}</title></circle>`);
        });
      });
    }
    // Direct labels on the last drawn point of each line (up to four series); bars carry the legend, the tooltips and the table.
    if (panel.type === "line" && drawn.length <= 4) drawn.forEach((s) => {
      const last = s.cells.map((c, i) => [c, i]).filter(([c]) => c.value != null).pop();
      if (last) parts.push(svgText(Math.min(xMid(last[1]) + 8, w - 2), yOf(last[0].value) - 8, `${s.label} ${fmt(s.id, last[0].value)}`, "label", xMid(last[1]) > w - 120 ? "end" : "start"));
    });
    function r(i) { return rows[i].key[dim] ?? dimText(dim, rows[i]) ?? "(none)"; }
    const legend = series.length > 1 ? `<ul class="gs-legend">${series.map((s) => `<li><span class="gs-swatch" style="background:var(--series-${s.i + 1})"></span>${esc(s.label)}${s.state === "not-tracked" ? ` <span class="gs-not-tracked">${esc(engine.NOT_TRACKED)}</span>` : s.state === "unknown" ? ` <span class="gs-mark gs-unknown">${esc(engine.UNKNOWN_MARK)}</span>` : ""}</li>`).join("")}</ul>` : "";
    const svg = `<svg class="gs-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(panel.title)}">${parts.join("")}</svg>`;
    const notes = [...whyNotes(rows, ids), ...periodNotes(rows), ...metricNotes(ids)];
    // A trend that starts after the first month shown: the figure was not counted before (the one definition boundary a snapshot can hold).
    for (const s of series) {
      const first = s.cells.findIndex((c) => c.value != null);
      if (first > 0 && s.cells.slice(0, first).every((c) => c.why === "measure-not-in-snapshot")) notes.push(`<p class="gs-note gs-note-boundary">${esc(s.label)} is counted from ${esc(r(first))}: the months before were pulled before this figure existed, so the trend starts there.</p>`);
    }
    const none = !rows.length ? `<p class="gs-note">Nothing matches the current filters.</p>` : !drawn.length ? `<p class="gs-note">Nothing to draw: no series has a figure.</p>` : "";
    const fallback = `<details class="gs-fallback"${attr("open", !!ui?.open?.[`${panel.id}:table`])} data-fallback="${esc(panel.id)}"><summary>As a table</summary>${tableOf(panel, result, ids)}</details>`;
    return `${open(panel)}<div class="gs-tools">${csvButton(panel)}</div>${svg}${legend}${none}${fallback}${notes.join("")}${close}`;
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
      const notes = [...whyNotes(result.rows, cols), ...periodNotes(result.rows), ...metricNotes(cols)];
      return `${open(panel)}<div class="gs-tools">${csvButton(panel)}</div>${tableOf(panel, result, cols)}${result.rows.length ? "" : `<p class="gs-note">Nothing matches the current filters.</p>`}${rank}${notes.join("")}${close}`;
    }
    const under = watchlistDetail(panel, state, result);
    const head = `<tr><th scope="col">Account</th><th scope="col" class="gs-num">Programs</th>${cols.map((id) => `<th scope="col" class="gs-num">${esc(engine.metric(id).label)}</th>`).join("")}</tr>`;
    const body = result.rows.map((row) => {
      const own = under.get(row.key.account) ?? [];
      const sub = own.map((d) => `<tr class="gs-sub"><td>${esc(d.label.program ?? d.key.program)}${badges(d.label.statuses)}</td><td></td>${cols.map((id) => metricCell(id, d.cells[id])).join("")}</tr>`).join("");
      return `<tr><td>${esc(row.label.account ?? row.key.account)}${mark(row)}</td><td class="gs-num">${own.length}</td>${cols.map((id) => metricCell(id, row.cells[id])).join("")}</tr>${sub}`;
    }).join("");
    const notes = [...whyNotes(result.rows, cols), ...periodNotes(result.rows), ...metricNotes(cols)];
    return `${open(panel)}<div class="gs-tools">${csvButton(panel)}</div><div class="gs-scroll"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>${result.rows.length ? "" : `<p class="gs-note">No account clears the floor under the current filters.</p>`}${rank}${notes.join("")}${close}`;
  };

  // ── The health views ───────────────────────────────────────────────────────
  const info = (text) => `<span class="gs-mark gs-info" title="${esc(text)}">&#9432;</span>`;
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
    const control = `<div class="gs-tools"><span class="gs-f-title">No-send threshold</span> ${healthDayChoices.map((d) => `<button type="button" class="gs-chip${d === days ? " is-on" : ""}" data-act="hd" data-days="${d}" aria-pressed="${d === days}">${d} days</button>`).join(" ")} ${csvButton(panel)}</div>`;
    const alarms = view.rows.length ? healthRows(view.rows, view) : `<p class="gs-note">No program needs attention under the current filters.</p>`;
    const others = Object.keys(view.labels).filter((k) => !view.alarmLists.includes(k)).map((k) => `<details class="gs-list"${attr("open", k === "no-sends-in-window" && view.counts[k] > 0)}><summary>${esc(view.labels[k])} (${view.counts[k]})</summary>${view.lists[k].length ? healthRows(view.lists[k], view, { withDays: k !== "ok" }) : `<p class="gs-note">None.</p>`}</details>`).join("");
    const basis = `<p class="gs-note">Judged as of ${esc(view.asOf)} over the last ${plural(view.windowDays ?? 0, "day")} of sends the pull holds by day${view.monthsIgnored ? "; the date filter does not apply here" : ""}. Each row's signals are in its tooltip.</p>`;
    return `${open(panel)}${control}<h3>Needs attention (${view.rows.length})</h3>${alarms}${others}${basis}${close}`;
  };
  const changeCell = (c) => (c.usualPerMonth == null ? esc(engine.NO_VALUE) : c.change == null ? "" : changeText({ kind: "ratio", value: c.change }));
  const renderHealthReasons = (panel, state) => {
    const showExpected = state.he || panel.knobs.showExpected;
    const view = engine.healthReasonsView(snapshot, filtersOf(state));
    if (view.unavailable) return `${open(panel)}${renderNotice(lackFacts(view.unavailable.reason))}${close}`;
    const toggle = `<div class="gs-tools"><label><input type="checkbox" data-f="he"${attr("checked", showExpected)}> Show expected failures (business rules working as configured)</label> ${csvButton(panel)}</div>`;
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
    return `${open(panel)}${toggle}${bounces}${entry}${steps}${foot}${close}`;
  };
  const renderHealthSchedules = (panel, state) => {
    const view = engine.healthSchedulesView(snapshot, filtersOf(state), { staleAfterDays: panel.knobs.staleAfterDays });
    if (view.unavailable) return `${open(panel)}${renderNotice(lackFacts(view.unavailable.reason))}${close}`;
    const rows = view.rows.map((r) => `<tr><td>${esc(r.name ?? r.programId)}${badges(r.statuses)}</td><td>${r.documented ? esc(r.classification) : `<span class="gs-muted">no doc in the knowledge base</span>`}</td><td class="gs-nowrap"><code>${esc(r.cronExpression ?? "")}</code></td><td>${esc(r.timeZoneName ?? "")}</td><td>${esc(r.startDay ?? "")}</td><td>${esc(r.endDay ?? "")}</td><td>${r.syncDisabled === true ? `<span class="gs-badge gs-badge-error">sync disabled</span>` : ""}</td><td>${r.asOf ? `${esc(r.asOf)}${r.stale ? ` <span class="gs-badge gs-badge-stale" title="Documented more than ${view.staleAfterDays} days before the pull">stale</span>` : ""}` : esc(engine.NO_VALUE)}</td></tr>`).join("");
    const head = `<tr><th scope="col">Program</th><th scope="col">Schedule</th><th scope="col">Cron</th><th scope="col">Time zone</th><th scope="col">Starts</th><th scope="col">Ends</th><th scope="col">Sync</th><th scope="col">As of</th></tr>`;
    const note = `<p class="gs-note">As the knowledge base documents each program, as of the day its doc was last verified; stale past ${view.staleAfterDays} days before the pull of ${esc(view.pulledDay)} (${plural(view.stale, "stale row")}${view.undocumented ? `, ${plural(view.undocumented, "program")} with no doc` : ""}).</p>`;
    return `${open(panel)}<div class="gs-tools">${csvButton(panel)}</div><div class="gs-scroll"><table><thead>${head}</thead><tbody>${rows || `<tr><td colspan="8">No program under the current filters.</td></tr>`}</tbody></table></div>${note}${close}`;
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
    const note = `<p class="gs-note">Programs whose documented schedule does not recur. Never "finished": a one-off can be reused with a new template${view.scheduleUnknown ? `. ${plural(view.scheduleUnknown, "program")} ${view.scheduleUnknown === 1 ? "has" : "have"} no schedule known to this pull (no knowledge-base doc) and ${view.scheduleUnknown === 1 ? "is" : "are"} not listed` : ""}.</p>`;
    return `${open(panel)}<div class="gs-tools">${csvButton(panel)}</div><div class="gs-scroll"><table><thead>${head}</thead><tbody>${rows || `<tr><td colspan="5">None under the current filters.</td></tr>`}</tbody></table></div>${note}${close}`;
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
      default: return renderTablePanel(panel, run(panel, state), visibleCols(panel, ui), !!ui?.open?.[panel.id]);
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
    if (isHealthPanel(panel)) {
      const t = healthCsvRows(panel, state);
      if (!t) return null;
      ({ headers, rows } = t);
    } else {
      const result = run(panel, state);
      if (result.unavailable) return null;
      const dims = panel.query.groupBy ?? [];
      const cols = panel.type === "table" ? visibleCols(panel, ui) : panel.query.metrics;
      const tracked = (id) => !!engine.metric(id).tracking;
      const figureHeads = cols.flatMap((id) => (tracked(id) ? [engine.metric(id).label, `${engine.metric(id).label} tracking`] : [engine.metric(id).label]));
      const value = (id, cell) => (cell.value == null ? "" : isRate(engine.metric(id)) ? Number(cell.value.toFixed(4)) : cell.value);
      const figures = (row) => cols.flatMap((id) => (tracked(id) ? [value(id, row.cells[id]), row.cells[id].state ?? ""] : [value(id, row.cells[id])]));
      const statusText = (row) => (row.label.statuses ?? []).map(engine.statusLabel).join(", ");
      if (isCrossProgram(panel)) {
        // One line per ranked account (with how many programs touched it), then one per program under it, as drawn.
        const under = watchlistDetail(panel, state, result);
        headers = ["Account", "Program", "Status", "Programs", ...figureHeads];
        rows = result.rows.flatMap((row) => {
          const own = under.get(row.key.account) ?? [];
          const account = dimText("account", row) ?? "";
          return [[account, "", "", own.length, ...figures(row)], ...own.map((d) => [account, dimText("program", d) ?? "", statusText(d), "", ...figures(d)])];
        });
      } else {
        headers = [...dims.flatMap((d) => (d === "program" ? [DIM_LABELS[d], "Status"] : [DIM_LABELS[d]])), ...figureHeads];
        const line = (row) => [...dims.flatMap((d) => (d === "program" ? [dimText(d, row) ?? "", statusText(row)] : [dimText(d, row) ?? ""])), ...figures(row)];
        rows = dims.length ? result.rows.map(line) : result.total ? [line(result.total)] : [];
      }
    }
    return { filename, text: csvText(headers, rows) };
  };

  // ── The filter bar ─────────────────────────────────────────────────────────
  const renderGroupOptions = (state) => option("", "Every group", state.g == null) + groupsWithin(state.sg).map((label) => option(groups.indexOf(label), label, groups.indexOf(label) === state.g)).join("");
  const renderCount = (state) => `${state.programs ? state.programs.length : programs.length} of ${programs.length} selected`;
  const renderFilters = (state) => {
    const parts = [];
    if (offers.dateRange) {
      const monthOptions = (at) => months.map((m) => option(m, m, m === at)).join("");
      // The current month one click away (ruled 2026-10-05): include it, or go back to the closed months.
      const quick = lastClosed && lastMonth && lastMonth >= incompleteMonth
        ? state.to < lastMonth ? ` <button type="button" data-act="months-current">Include ${esc(lastMonth)} (provisional)</button>` : ` <button type="button" data-act="months-closed">Closed months only</button>`
        : "";
      parts.push(`<div class="gs-f"><span class="gs-f-title">Months</span><label>From <select data-f="from">${monthOptions(state.from)}</select></label> <label>to <select data-f="to">${monthOptions(state.to)}</select></label>${quick}</div>`);
    }
    if (offers.programs) {
      const keep = state.programs ? new Set(state.programs) : null;
      const rows = programs.map((p) => {
        const b = p.statuses.map((s) => `<span class="gs-badge">${esc(engine.statusLabel(s))}</span>`).join("") + (p.supergroup != null || p.group != null ? `<span class="gs-badge gs-badge-group">${esc([p.supergroup, p.group].filter((x) => x != null).join(" / "))}</span>` : "");
        return `<label class="gs-prog"><input type="checkbox" data-f="program" value="${esc(p.id)}"${attr("checked", !keep || keep.has(p.id))}> <span class="gs-prog-name">${esc(p.name ?? p.id)}</span> ${b}</label>`;
      });
      parts.push(
        `<div class="gs-f gs-programs"><span class="gs-f-title">Programs <span class="gs-count" data-region="count">${renderCount(state)}</span></span>` +
          `<input type="search" data-f="search" placeholder="Search programs" aria-label="Search programs"> <button type="button" data-act="all">Select all</button> <button type="button" data-act="none">Select none</button>` +
          `<div class="gs-proglist">${rows.join("")}</div></div>`,
      );
    }
    if (offers.group && (supergroups.length || groups.length)) {
      parts.push(
        `<div class="gs-f"><span class="gs-f-title">Group</span><label>Supergroup <select data-f="sg">${option("", "Every supergroup", state.sg == null)}${supergroups.map((label, i) => option(i, label, i === state.sg)).join("")}</select></label> ` +
          `<label>Group <select data-f="g" data-region="groupOptions">${renderGroupOptions(state)}</select></label></div>`,
      );
    }
    if (offers.status) {
      // "Running now" (ruled 2026-10-05): Active programs alone, one click.
      const running = statusChoices.includes("PROCESSING") ? ` <button type="button" data-act="running"${attr(`aria-pressed="true"`, sameSet(state.statuses, ["PROCESSING"]))}>Running now</button>` : "";
      parts.push(`<div class="gs-f"><span class="gs-f-title">Status</span>${statusChoices.map((s) => `<label><input type="checkbox" data-f="status" value="${esc(s)}"${attr("checked", !state.statuses || state.statuses.includes(s))}> ${esc(engine.statusLabel(s))}</label>`).join(" ")}${running}</div>`);
    }
    if (offers.recipientClass.enabled) {
      // No internal domain: the control is off and says why. It is never a switch that does nothing (R5).
      // Only when the PULL holds no accounts: a page that merely leaves them off is not short of a pull.
      const notices = [noInternalDomain ? renderNotice(lackFacts("no-internal-domain"), { compact: true }) : "", model.testAccounts && accountData.reason === "accounts-off" ? renderNotice(lackFacts("test-accounts-need-accounts"), { compact: true }) : ""];
      parts.push(`<div class="gs-f"><span class="gs-f-title">Recipients</span><label><input type="checkbox" data-f="external"${attr("checked", state.external)}${attr("disabled", noInternalDomain)}> Leave out internal recipients (by email domain)</label>${notices.join("")}</div>`);
    }
    if (panels.some(usesAccounts)) {
      const control = accountData.pulled
        ? `<label>Show <select data-f="account">${option("", "Every account on this page", !state.account)}${accountChoices.map((a) => option(a.key, a.name ?? a.key, a.key === state.account)).join("")}</select></label>`
        : renderNotice(lackFacts(accountData.reason ?? "not-pulled"), { compact: true });
      parts.push(`<div class="gs-f"><span class="gs-f-title">Account</span>${control}</div>`);
    }
    parts.push(`<div class="gs-f"><button type="button" data-act="reset">Reset filters</button></div>`);
    return parts.join("");
  };
  /** Always on the page: how many programs are selected, shown, and hidden by status (R23). */
  const renderSummary = (state) => {
    const scope = scopeOf(state);
    const showing = state.statuses ? (state.statuses.length ? state.statuses.map(engine.statusLabel).join(", ") : "no status") : "every status";
    return `${esc(renderCount(state))}. ${plural(scope.programs, "program")} shown. ${plural(scope.programsHiddenByStatus, "program")} hidden by status (showing ${esc(showing)}).`;
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
    return `<div class="gs-banner gs-banner-stale" role="status" data-banner="stale">Stale: this data was pulled ${plural(ageDays, "day")} ago. The dashboard is refreshed ${esc(model.freshness.cadenceText)} and is stale after ${plural(model.freshness.maxAgeDays, "day")}.${howTo ? ` <code>${esc(COPY_LINES.refresh(model.slug))}</code>` : ""}</div>`;
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
    const ids = [...new Set(panels.flatMap((p) => p.query?.metrics ?? []))];
    return engine.METRICS.map((m) => m.id).filter((id) => ids.includes(id));
  };
  // The caveats depend on the snapshot and the panels alone, never on the filters: computed once, read on every draw.
  let caveatList = null;
  const caveats = () => {
    if (caveatList == null) caveatList = engine.caveatsFor(snapshot, metricIds(), { health: !!model.healthTab });
    return caveatList;
  };
  const renderCaveats = () => `<ul class="gs-caveats">${caveats().map((c) => `<li data-caveat="${esc(c.id)}">${esc(c.text)}</li>`).join("")}</ul>`;
  // ── The About tab: generated from the registry, the spec and the snapshot (R26) ──
  const renderAbout = () => {
    const parts = [];
    const m = snapshot.meta;
    parts.push(`<section class="gs-about"><h2>About this page</h2><p>${esc(engine.dataPulledLine(snapshot))}</p></section>`);
    // Definitions: every metric the page shows, from the registry (the glossary adds the parts a rate divides).
    const entries = engine.glossary(metricIds(), snapshot);
    const def = (e) => model.about.sourceDetail
      ? `<dd>${esc(e.definition)}<ul class="gs-formula"><li data-part="object">Read from: <code>${esc(e.object)}</code></li><li data-part="fields">Counts: ${esc(e.fields)}</li><li data-part="filters">Filters on every count: ${esc(e.filters.length ? e.filters.join("; ") : "none")}</li><li data-part="dateField">Date field: ${esc(e.dateField)}</li><li data-part="calculation">Calculation: ${esc(e.calculation)}${e.zeroDenominator ? ` ${esc(e.zeroDenominator)}` : ""}</li>${e.afterRead.map((a) => `<li>After the read: ${esc(a)}</li>`).join("")}${e.perStep ? `<li>Per-step rows are read from: ${esc(e.perStep)}</li>` : ""}${e.uiParity ? `<li>Against the Gainsight UI: ${esc(e.uiParity)}</li>` : ""}</ul></dd>`
      : `<dd>${esc(e.definition)} <span class="gs-muted">Calculation: ${esc(e.calculation)}${e.zeroDenominator ? ` ${esc(e.zeroDenominator)}` : ""}</span></dd>`;
    parts.push(`<section class="gs-about"><h2>Definitions</h2>${model.about.sourceDetail ? `<p class="gs-muted">Every figure can be checked on its own: build a report in Gainsight on the object named, with the filters and the date field named, and count the rows.</p>${engine.glossaryNotes(snapshot).map((n) => `<p class="gs-muted">${esc(n)}</p>`).join("")}` : ""}<dl class="gs-defs">${entries.map((e) => `<dt data-metric="${esc(e.id)}">${esc(e.label)}</dt>${def(e)}`).join("")}</dl></section>`);
    // How to use: what this page offers, read from the model.
    const offered = [offers.dateRange && "the months", offers.programs && "a searchable program list (select all or none)", offers.group && "the dashboard's groups", offers.status && "status", offers.recipientClass.enabled && "whether internal recipients count"].filter(Boolean);
    const how = [
      `Filters at the top narrow every panel at once: ${offered.join(", ")}. The address bar keeps the filters you set, so a view can be bookmarked or shared; Reset filters clears them.`,
      `Tabs: ${tabs.filter((t) => t.state === "on").map((t) => t.label).join(", ")}${tabs.some((t) => t.state === "offered") ? `; a dimmed tab marked "(off)" is not part of this page and says what it would take` : ""}.`,
      `Every table has Columns to show or hide any figure (remembered in this browser) and Download CSV, which exports the table's current view. A chart has the same rows as a table underneath.`,
      `A plain 0% is a real 0%. "${engine.NOT_TRACKED}" means no link in the email is click-tracked, so there is no number. A figure marked "${engine.UNKNOWN_MARK}" is shown, but the data cannot tell whether clicks are tracked.`,
      `* marks a figure that includes the provisional period; † marks one that includes months carried forward from an earlier pull.`,
      ...(panels.some((p) => p.type === "health-silent") ? [`On the Health tab the no-send threshold has buttons (${healthDayChoices.join(", ")} days); expected failures sit behind a toggle.`] : []),
      ...(panels.some(usesAccounts) ? [`An account's history over days needs a pull of its own: the account timeline command, which needs a gs-admin login. Anyone else sees a company only through this page's account lists.`] : []),
    ];
    parts.push(`<section class="gs-about"><h2>How to use this page</h2><ul>${how.map((h) => `<li>${esc(h)}</li>`).join("")}</ul></section>`);
    // This dashboard's settings, from the spec's own description; each group rule with what it matched.
    const groupsText = model.about.groups;
    const rules = groupsText.rules.map((r) => `<li data-rule-matched="${r.matched}">${esc(r.text)} ${r.matched ? `Matched ${plural(r.matched, "program")}.` : `<strong class="gs-no-match">Matched nothing.</strong>`}</li>`).join("");
    const ungrouped = groupsText.ungrouped.length
      ? `<p class="gs-ungrouped${howTo ? " is-prominent" : ""}"><strong>Ungrouped: ${plural(groupsText.ungrouped.length, "program")}</strong>${howTo ? `: ${groupsText.ungrouped.map((p) => esc(p.name ?? p.id)).join(", ")}` : ""}.</p>`
      : `<p class="gs-ungrouped">Every program is grouped.</p>`;
    parts.push(`<section class="gs-about"><h2>This dashboard's settings</h2><dl class="gs-settings">${model.about.settings.map((s) => `<dt>${esc(s.label)}</dt>${s.text.map((t) => `<dd>${esc(t)}</dd>`).join("")}`).join("")}</dl>${rules ? `<h3>Group rules, as they resolved</h3><ol>${rules}</ol>` : ""}${ungrouped}<p>${accountData.pulled ? "Account data was pulled for this snapshot." : esc(engine.reasonText(accountData.reason ?? "not-pulled"))}</p></section>`);
    // Where the data came from.
    const prov = [
      ["Pulled at", `${m.pulledAt}${m.timeZone ? ` (${m.timeZone})` : ""}`], ["Tenant", m.tenantHost], ["Window", `${m.window.from} to ${m.window.to}`], ["Provisional from", m.incompleteFrom],
      ["Refresh", `${m.refresh.mode}: ${m.refresh.why}${m.refresh.previousPulledAt ? ` (continued from the pull of ${m.refresh.previousPulledAt})` : ""}`],
      ["Step detail", m.stepDetail ? "pulled" : "not pulled"], ["Account data", accountData.pulled ? "pulled" : "not pulled"],
      ["Health data", health.pulled ? `pulled, judged as of ${health.asOf}` : "not pulled"],
      ["Versions", `CLI ${m.cliVersion ?? "unknown"}, plugin ${m.pluginVersion ?? "unknown"}, snapshot schema ${snapshot.schemaVersion}`],
    ];
    parts.push(`<section class="gs-about"><h2>Where the data came from</h2><dl class="gs-prov">${prov.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></section>`);
    parts.push(`<section class="gs-about"><h2>Caveats</h2>${renderCaveats()}</section>`);
    parts.push(`<section class="gs-about"><h2>How to refresh</h2><p>${howTo ? `Run <code>${esc(COPY_LINES.refresh(model.slug))}</code> from the workspace, with a gs-admin login; the /gs-superadmin:email-engagement skill runs the same command.` : `An admin refreshes this page ${esc(model.freshness.cadenceText)}; the data-pulled line at the top says when it was last done.`}</p></section>`);
    return parts.join("");
  };
  const renderPane = (tab, state, ui) => {
    // An offered tab is an invitation: its pane is the notice, and nothing else.
    if (tab.state === "offered") return renderNotice(lackFacts("tab-off", { held: !!tab.held }), { heading: tab.meaning });
    if (tab.id === "about") return renderAbout();
    const own = panels.filter((p) => p.tab === tab.id).map((p) => renderPanel(p, state, ui)).join("");
    if (own) return own;
    // An on tab with nothing to draw says so through the same plumbing (F-486): Templates before template content exists.
    if (tab.id === "templates") return renderNotice(lackFacts("templates-not-pulled"), { heading: tab.meaning });
    return `<p class="gs-muted">${esc(tab.meaning)}</p>`;
  };
  const renderPanes = (state, ui) => tabs.map((t) => `<section class="gs-pane" data-pane="${esc(t.id)}"${attr("hidden", t.id !== state.tab)}>${renderPane(t, state, ui)}</section>`).join("");
  const renderApp = (state, ui) =>
    `<header class="gs-head"><h1>${esc(model.title)}</h1><p class="gs-sub">${esc(page.title)}</p><p class="gs-pulled">${esc(engine.dataPulledLine(snapshot))}</p></header>` +
    `<div data-region="stale">${renderStale()}</div>${renderHealthBanner()}` +
    `<section class="gs-filters" data-region="filters" aria-label="Filters">${renderFilters(state)}</section>` +
    `<p class="gs-summary" data-region="summary">${renderSummary(state)}</p>` +
    `<nav class="gs-tabs" data-region="tabs" aria-label="Tabs">${renderTabs(state)}</nav>` +
    `<div class="gs-panes" data-region="panes">${renderPanes(state, ui)}</div>` +
    `<footer class="gs-foot"><details class="gs-caveats-foot"><summary>Caveats (${caveats().length})</summary>${renderCaveats()}</details></footer>`;

  return {
    model, snapshot, programs, panels, tabs, supergroups, groups, healthDayChoices,
    defaultState, clean, hashOf, stateFromHash, filtersOf, run, scopeOf, programMatches,
    lackFacts, renderNotice, renderTablePanel, renderPanel, visibleCols, csvOf, colsKey, renderApp, renderAbout, renderStale, renderHealthBanner, caveats,
    /** @param {?(() => number)} fn the clock the stale banner reads (null = no clock, no banner) */
    setClock: (fn) => { clock = fn; },
    regions: { filters: renderFilters, summary: renderSummary, tabs: renderTabs, panes: renderPanes, count: renderCount, groupOptions: renderGroupOptions, stale: renderStale },
  };
}
/** @param {string} day YYYY-MM-DD @returns {[number, number, number]} year, month index, day */
const dayParts = (day) => [Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))];

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
      paint(["panes"]);
      return;
    }
    const f = t.getAttribute("data-f");
    if (f === "from" || f === "to") state = app.clean({ ...state, [f]: t.value });
    else if (f === "program") state = app.clean({ ...state, programs: pickedPrograms() });
    else if (f === "status") state = app.clean({ ...state, statuses: all('[data-f="status"]').filter((b) => b.checked).map((b) => b.value) });
    else if (f === "sg") state = app.clean({ ...state, sg: t.value === "" ? null : Number(t.value), g: null });
    else if (f === "g") state = app.clean({ ...state, g: t.value === "" ? null : Number(t.value) });
    else if (f === "external") state = app.clean({ ...state, external: t.checked });
    else if (f === "account") state = app.clean({ ...state, account: t.value || null });
    else if (f === "he") state = app.clean({ ...state, he: t.checked });
    else return;
    // A month range given backwards is shown the right way round, so the bar is drawn again.
    commit(f === "sg" ? ["groupOptions", "count", "summary", "panes"] : (f === "from" || f === "to") && state[f] !== t.value ? ["filters", "summary", "panes"] : f === "he" ? ["panes"] : ["count", "summary", "panes"]);
  });
  root.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t?.getAttribute?.("data-f") !== "search") return;
    const hits = app.programMatches(t.value);
    all(".gs-prog").forEach((label, i) => {
      label.hidden = !hits[i];
    });
  });
  root.addEventListener("click", (ev) => {
    const t = ev.target?.closest?.("[data-tab],[data-act],[data-csv],[data-copy]");
    if (!t) return;
    if (t.hasAttribute("data-tab")) {
      state = app.clean({ ...state, tab: t.getAttribute("data-tab") });
      commit(["tabs", "panes"]);
    } else if (t.hasAttribute("data-act")) {
      const act = t.getAttribute("data-act");
      if (act === "reset") {
        state = app.defaultState();
        full();
        commit([]);
        return;
      }
      if (act === "hd") { state = app.clean({ ...state, hd: Number(t.getAttribute("data-days")) }); commit(["panes"]); return; }
      if (act === "running") { state = app.clean({ ...state, statuses: ["PROCESSING"] }); commit(["filters", "summary", "panes"]); return; }
      if (act === "months-current" || act === "months-closed") {
        const months = app.snapshot.dimensions.months;
        const incomplete = String(app.snapshot.meta.incompleteFrom).slice(0, 7);
        const closed = months.filter((m) => m < incomplete);
        state = app.clean({ ...state, to: act === "months-current" ? months[months.length - 1] : closed[closed.length - 1] ?? state.to });
        commit(["filters", "summary", "panes"]);
        return;
      }
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
