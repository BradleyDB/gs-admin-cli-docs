// ─────────────────────────────────────────────────────────────────────────────
// dashboard-runtime.mjs — the dashboard page's runtime (DSH-2): everything a
// page does after it is built. The page builder (dashboard-page.mjs) calls it
// in Node for the pre-rendered default view and inlines THIS FILE'S EXACT
// BYTES into every page, so the view a browser draws after a filter changes is
// drawn by the code that drew the pre-render.
//
// PURE, and written in the JavaScript a browser also runs: no import of any
// kind, no process, no file. The import gate holds it to that
// (build/check-imports.mjs, RESTRICTED). It never aggregates: every figure on
// a page is a cell of engagement-query.mjs's runQuery, which arrives as the
// `engine` argument (in Node the imported module, in a page the inlined copy).
// This file chooses filters, calls the engine and lays out what comes back.
//
// What lives here, each exactly once:
//   LACKS         what a dashboard page can lack, as data: for each reason,
//                 whether getting it needs a new pull or only a rebuild, the
//                 setting to change, and which line to copy. A static page
//                 cannot change a setting or pull, so anything it cannot do
//                 says so where the data would be. NOT_LACKS and LACKS_LATER
//                 classify every other reason the engine can give; the suite
//                 reds a reason that is in none of the three.
//   lackFacts     reason → the facts (the engine's wording, what it takes,
//                 the setting, the line). renderNotice draws them. Every
//                 panel, tab and filter goes through this pair; a leaders'
//                 page gets the statement without the how-to.
//   the table panel   takes ONLY the engine's result. When the result says
//                 `unavailable`, the notice is the one thing it can draw:
//                 never an empty table, never a zero.
//   filter state  one object; its URL-hash form holds ids only (program ids,
//                 status codes, months, positions in the group lists).
//   csvText       the ONE CSV builder of a page. A cell that a spreadsheet
//                 would read as a formula is neutralised (R27).
//   unpackSnapshot    the embedded data (columnar, ids through dictionaries)
//                 back into the T-10 shape the engine reads.
//   mount         the only code that touches a document: listeners on the
//                 page's root, column choices in localStorage (wrapped in
//                 try/catch), the file download. No network request anywhere.
//
// Citations: DSH-n are work items and Rnn rulings of the maintainer's
// unpublished JO-dashboards plan; the decision each produced is stated beside
// the token.
// ─────────────────────────────────────────────────────────────────────────────

export const PAGE_MODEL_VERSION = 1;

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Every tenant string reaches a page through this. */
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

// ── What a page can lack (DSH-2, ruled 2026-10-04) ───────────────────────────
// `reason` is an id of the engine's REASONS, where the wording lives.
// `needs`: "pull" (a refresh that reads the tenant again), "rebuild" (the
// pages are built again from the data already pulled), or "by-data" (rebuild
// when the pull holds the data, else pull: the caller says which).
// `setting` is the spec field to change, by its normalized path (the spelling
// dashboard-spec.mjs's SPEC_DESCRIPTIONS covers; the builder refuses a path no
// description covers), and whether it is switched on or filled in.
export const LACKS = Object.freeze([
  { reason: "accounts-off", needs: "pull", setting: { path: "accounts.pull", how: "on" }, line: "edit" },
  { reason: "step-detail-off", needs: "pull", setting: { path: "sources[].params.stepDetail", how: "on" }, line: "edit" },
  { reason: "measure-not-in-snapshot", needs: "pull", setting: null, line: "refresh" },
  { reason: "accounts-not-on-page", needs: "rebuild", setting: { path: "pages[].accountNames", how: "on" }, line: "edit" },
  { reason: "tab-off", needs: "by-data", setting: { path: "pages[].tabs[].enabled", how: "on" }, line: "edit" },
  { reason: "no-internal-domain", needs: "pull", setting: { path: "sources[].params.internalDomains[]", how: "fill" }, line: "edit" },
  { reason: "test-accounts-need-accounts", needs: "pull", setting: { path: "accounts.pull", how: "on" }, line: "edit" },
]);
// Reasons that are a property of the figure or of the view, not something a
// setting would supply: the cell says why, and nothing is offered.
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
});
// Reasons of the health facts. Nothing a page draws reads them yet: they get
// their rows with the Health tab's views (DSH-4).
export const LACKS_LATER = Object.freeze(["predates-health", "health-off", "not-in-previous", "call-failed", "no-schema", "no-kb", "too-large", "all-time", "not-filterable"]);

export const NEEDS = Object.freeze({
  pull: "It needs a new pull: the next refresh reads every table again.",
  rebuild: "It needs only a rebuild of the pages from the data already pulled, with no new pull.",
});
// The line an admin copies. One place, so a change of how a dashboard is
// edited or refreshed is a change here and nowhere else.
export const COPY_LINES = Object.freeze({
  edit: (slug) => `/gs-superadmin:email-engagement dashboard edit ${slug}`,
  refresh: (slug) => `/gs-superadmin:email-engagement refresh ${slug}`,
});

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
const cmpText = (a, b) => {
  const [x, y] = [String(a).toLowerCase(), String(b).toLowerCase()];
  return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
};
const distinctSorted = (values) => [...new Set(values.filter((v) => v != null))].sort(cmpText);
const sameSet = (a, b) => (a == null || b == null ? a == b : a.length === b.length && a.every((x) => b.includes(x)));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const attr = (name, on) => (on ? ` ${name}` : "");
const option = (value, label, selected) => `<option value="${esc(value)}"${attr("selected", selected)}>${esc(label)}</option>`;

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
  const months = snapshot.dimensions.months;
  const programs = [...snapshot.dimensions.programs].sort((a, b) => cmpText(a.name ?? a.id, b.name ?? b.id) || cmpText(a.id, b.id));
  const programIds = new Set(programs.map((p) => p.id));
  const statusOrder = Object.keys(engine.STATUS_LABELS);
  const statusChoices = [...new Set([...statusOrder, ...programs.flatMap((p) => p.statuses)])].filter((s) => programs.some((p) => p.statuses.includes(s)) || (page.statusDefault ?? []).includes(s));
  const supergroups = distinctSorted(programs.map((p) => p.supergroup));
  const groups = distinctSorted(programs.map((p) => p.group));
  const groupsWithin = (sg) => (sg == null ? groups : distinctSorted(programs.filter((p) => p.supergroup === supergroups[sg]).map((p) => p.group)));
  const tabs = page.tabs;
  const panels = page.panels;
  const usesAccounts = (panel) => (panel.query.groupBy ?? []).includes("account");
  const accountData = engine.accountAvailability(snapshot);
  const accountChoices = accountData.pulled ? [...snapshot.dimensions.accounts].sort((a, b) => cmpText(a.name ?? a.key, b.name ?? b.key)) : [];
  // The snapshot's own marker that no internal domain was named for the pull.
  const noInternalDomain = snapshot.caveats.some((c) => c.id === "recipient-class-not-configured");
  const offers = model.filters;

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
    return { reason, text, known: true, needs, needsText: NEEDS[needs], setting, line: COPY_LINES[row.line](model.slug) };
  };
  /**
   * Information, not an error: what is not here and, on an admin page, what
   * it would take. A leaders' page gets the statement alone.
   */
  const renderNotice = (facts, { heading = null, compact = false } = {}) => {
    const parts = [];
    if (heading) parts.push(`<p class="gs-notice-head">${esc(heading)}</p>`);
    parts.push(`<p class="gs-notice-what">${esc(facts.text)}</p>`);
    if (howTo && facts.known) {
      const change = facts.setting ? `${facts.setting.how === "on" ? "Turn on" : "Fill in"} &quot;${esc(facts.setting.label)}&quot; in this dashboard's settings (<span class="gs-path">${esc(facts.setting.path)}</span>). ` : "";
      parts.push(`<p class="gs-notice-how">${change}${esc(facts.needsText)}</p>`);
      parts.push(`<p class="gs-notice-line"><code>${esc(facts.line)}</code> <button type="button" data-copy="${esc(facts.line)}">Copy</button></p>`);
    }
    return `<div class="gs-notice${compact ? " gs-notice-compact" : ""}" role="note" data-lack="${esc(facts.reason)}" data-needs="${esc(howTo ? facts.needs ?? "" : "")}">${parts.join("")}</div>`;
  };

  // ── Filter state ───────────────────────────────────────────────────────────
  const firstState = () => ({
    tab: tabs.find((t) => t.state === "on")?.id ?? null,
    from: months[0] ?? null,
    to: months[months.length - 1] ?? null,
    programs: null, // null = every program; a list = those, and an empty list is none
    sg: null, // a position in the supergroup list
    g: null, // a position in the group list
    statuses: page.statusDefault ? [...page.statusDefault] : null, // null = every status (R23)
    external: offers.recipientClass.enabled && offers.recipientClass.default === "external" && !noInternalDomain,
    account: null,
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
  /** The ONE call of the engine for a panel. The account choice narrows the panels that list accounts, and no other. */
  const run = (panel, state) => engine.runQuery(snapshot, usesAccounts(panel) && state.account ? { ...filtersOf(state), accounts: [state.account] } : filtersOf(state), panel.query);
  const scopeOf = (state) => engine.runQuery(snapshot, filtersOf(state), { groupBy: [], metrics: ["sent"] }).scope;
  /** One true or false per program of the list, in its order: does the name hold the search text. */
  const programMatches = (term) => {
    const t = String(term ?? "").trim().toLowerCase();
    return programs.map((p) => !t || String(p.name ?? "").toLowerCase().includes(t) || String(p.id).toLowerCase().includes(t));
  };

  // ── The table panel ────────────────────────────────────────────────────────
  const colsKey = (panelId) => `gs-dashboard.${model.slug}.${page.id}.${panelId}.columns`;
  /** The metrics shown: the viewer's own choice, else the panel's, else all (R1). */
  const visibleCols = (panel, ui) => {
    const pick = ui?.cols?.[panel.id] ?? panel.columns ?? panel.query.metrics;
    return panel.query.metrics.filter((id) => pick.includes(id));
  };
  const isRate = (def) => def.kind === "rate" || def.status === "rate";
  const dimText = (dim, row) => row.label[dim] ?? row.key[dim];
  const dimCell = (dim, row) => {
    const name = dimText(dim, row);
    const badges = dim === "program" ? (row.label.statuses ?? []).map((s) => ` <span class="gs-badge">${esc(engine.statusLabel(s))}</span>`).join("") : "";
    return (name == null ? `<span class="gs-muted">(none)</span>` : esc(name)) + badges;
  };
  const metricCell = (id, cell) => {
    const tip = cell.value == null && cell.why ? engine.reasonText(cell.why) : "";
    return `<td class="gs-num"${tip ? ` title="${esc(tip)}"` : ""}>${esc(engine.formatCell(id, cell))}</td>`;
  };
  /**
   * A panel's table from the ENGINE'S RESULT, and nothing else. With
   * `unavailable` set the notice is all there is to draw.
   * @param {*} panel a T-11 panel @param {*} result runQuery's return @param {string[]} cols the metrics shown @param {boolean} [colsOpen]
   */
  const renderTablePanel = (panel, result, cols, colsOpen = false) => {
    const open = `<section class="gs-panel" data-panel="${esc(panel.id)}"><h2>${esc(panel.title)}</h2>`;
    if (result.unavailable) return `${open}${renderNotice(lackFacts(result.unavailable.reason))}</section>`;
    const dims = panel.query.groupBy ?? [];
    const mark = (row) => `${row.incomplete ? `<sup title="Includes the incomplete period">*</sup>` : ""}${row.carried ? `<sup title="Includes months carried forward from an earlier pull">&dagger;</sup>` : ""}`;
    const figures = (row) => cols.map((id) => metricCell(id, row.cells[id])).join("");
    const bodyRow = (row) => `<tr>${dims.map((d, i) => `<td>${dimCell(d, row)}${i === 0 ? mark(row) : ""}</td>`).join("")}${figures(row)}</tr>`;
    const totalRow = (row) => `<tr><td${dims.length > 1 ? ` colspan="${dims.length}"` : ""}>${dims.length ? "Everything the filters keep" : "All"}${mark(row)}</td>${figures(row)}</tr>`;
    const head = `<tr>${(dims.length ? dims.map((d) => DIM_LABELS[d]) : [""]).map((h) => `<th scope="col">${esc(h)}</th>`).join("")}${cols.map((id) => `<th scope="col" class="gs-num">${esc(engine.metric(id).label)}</th>`).join("")}</tr>`;
    const body = dims.length ? result.rows.map(bodyRow).join("") : "";
    const total = result.total ? totalRow(result.total) : "";
    const tools =
      `<div class="gs-tools"><details class="gs-cols" data-cols="${esc(panel.id)}"${attr("open", colsOpen)}><summary>Columns</summary>` +
      panel.query.metrics.map((id) => `<label><input type="checkbox" data-col="${esc(panel.id)}" value="${esc(id)}"${attr("checked", cols.includes(id))}> ${esc(engine.metric(id).label)}</label>`).join("") +
      `</details><button type="button" data-csv="${esc(panel.id)}">Download CSV</button></div>`;
    // Why a shown cell has no value: once per reason, through the one renderer where a setting would supply it.
    const whys = new Map();
    const shownRows = [...(dims.length ? result.rows : []), ...(result.total ? [result.total] : [])];
    for (const row of shownRows) for (const id of cols) {
      const cell = row.cells[id];
      if (cell.value == null && cell.why && cell.why !== "not-tracked") whys.set(cell.why, (whys.get(cell.why) ?? new Set()).add(engine.metric(id).label));
    }
    const notes = [...whys].map(([why, labels]) => {
      const facts = lackFacts(why);
      const heading = [...labels].join(", ");
      return facts.known ? renderNotice(facts, { heading, compact: true }) : `<p class="gs-note"><strong>${esc(heading)}:</strong> ${esc(facts.text)}</p>`;
    });
    if (shownRows.some((r) => r.incomplete)) notes.push(`<p class="gs-note">* Includes ${esc(engine.provisionalText(snapshot.meta))}.</p>`);
    if (shownRows.some((r) => r.carried)) notes.push(`<p class="gs-note">&dagger; Includes months carried forward from an earlier pull.</p>`);
    const none = dims.length && !result.rows.length ? `<p class="gs-note">Nothing matches the current filters.</p>` : "";
    return `${open}${tools}<div class="gs-scroll"><table><thead>${head}</thead><tbody>${body}</tbody><tfoot>${total}</tfoot></table></div>${none}${notes.join("")}</section>`;
  };
  const renderPanel = (panel, state, ui) => renderTablePanel(panel, run(panel, state), visibleCols(panel, ui), !!ui?.open?.[panel.id]);
  /**
   * The panel's current view as a CSV: the active filters, the visible
   * columns and every row. Null when the panel has no table to export.
   * @returns {?{filename: string, text: string}}
   */
  const csvOf = (panel, state, ui) => {
    const result = run(panel, state);
    if (result.unavailable) return null;
    const dims = panel.query.groupBy ?? [];
    const cols = visibleCols(panel, ui);
    const tracked = (id) => !!engine.metric(id).tracking;
    const headers = [...dims.flatMap((d) => (d === "program" ? [DIM_LABELS[d], "Status"] : [DIM_LABELS[d]])), ...cols.flatMap((id) => (tracked(id) ? [engine.metric(id).label, `${engine.metric(id).label} tracking`] : [engine.metric(id).label]))];
    const value = (id, cell) => (cell.value == null ? "" : isRate(engine.metric(id)) ? Number(cell.value.toFixed(4)) : cell.value);
    const line = (row) => [
      ...dims.flatMap((d) => (d === "program" ? [dimText(d, row) ?? "", (row.label.statuses ?? []).map(engine.statusLabel).join(", ")] : [dimText(d, row) ?? ""])),
      ...cols.flatMap((id) => (tracked(id) ? [value(id, row.cells[id]), row.cells[id].state ?? ""] : [value(id, row.cells[id])])),
    ];
    const rows = dims.length ? result.rows.map(line) : result.total ? [line(result.total)] : [];
    // The data-pulled time rides in the file's name (R4).
    const pulled = String(snapshot.meta.pulledAt).slice(0, 16).replace(/[^0-9T]/g, "");
    return { filename: `${model.slug}-${page.id}-${panel.id}-${pulled}.csv`, text: csvText(headers, rows) };
  };

  // ── The filter bar ─────────────────────────────────────────────────────────
  const renderGroupOptions = (state) => option("", "Every group", state.g == null) + groupsWithin(state.sg).map((label) => option(groups.indexOf(label), label, groups.indexOf(label) === state.g)).join("");
  const renderCount = (state) => `${state.programs ? state.programs.length : programs.length} of ${programs.length} selected`;
  const renderFilters = (state) => {
    const parts = [];
    if (offers.dateRange) {
      const monthOptions = (at) => months.map((m) => option(m, m, m === at)).join("");
      parts.push(`<div class="gs-f"><span class="gs-f-title">Months</span><label>From <select data-f="from">${monthOptions(state.from)}</select></label> <label>to <select data-f="to">${monthOptions(state.to)}</select></label></div>`);
    }
    if (offers.programs) {
      const keep = state.programs ? new Set(state.programs) : null;
      const rows = programs.map((p) => {
        const badges = p.statuses.map((s) => `<span class="gs-badge">${esc(engine.statusLabel(s))}</span>`).join("") + (p.supergroup != null || p.group != null ? `<span class="gs-badge gs-badge-group">${esc([p.supergroup, p.group].filter((x) => x != null).join(" / "))}</span>` : "");
        return `<label class="gs-prog"><input type="checkbox" data-f="program" value="${esc(p.id)}"${attr("checked", !keep || keep.has(p.id))}> <span class="gs-prog-name">${esc(p.name ?? p.id)}</span> ${badges}</label>`;
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
      parts.push(`<div class="gs-f"><span class="gs-f-title">Status</span>${statusChoices.map((s) => `<label><input type="checkbox" data-f="status" value="${esc(s)}"${attr("checked", !state.statuses || state.statuses.includes(s))}> ${esc(engine.statusLabel(s))}</label>`).join(" ")}</div>`);
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

  // ── Tabs: on, offered or absent (an absent tab is not in the model) ────────
  const renderTabs = (state) =>
    tabs.map((t) => `<button type="button" class="gs-tab${t.id === state.tab ? " is-current" : ""}${t.state === "offered" ? " is-offered" : ""}" data-tab="${esc(t.id)}" aria-pressed="${t.id === state.tab}"${t.state === "offered" ? ` title="Not part of this page: open it to see what it would take"` : ""}>${esc(t.label)}${t.state === "offered" ? " (off)" : ""}</button>`).join("");
  const renderAbout = () => {
    const ids = [...new Set(panels.flatMap((p) => p.query.metrics))];
    return `<p>${esc(engine.dataPulledLine(snapshot))}</p><dl class="gs-defs">${ids.map((id) => `<dt>${esc(engine.metric(id).label)}</dt><dd>${esc(engine.metric(id).definition)}</dd>`).join("")}</dl>`;
  };
  const renderPane = (tab, state, ui) => {
    // An offered tab is an invitation: its pane is the notice, and nothing else.
    if (tab.state === "offered") return renderNotice(lackFacts("tab-off", { held: !!tab.held }), { heading: tab.meaning });
    const own = panels.filter((p) => p.tab === tab.id).map((p) => renderPanel(p, state, ui)).join("");
    return (tab.id === "about" ? renderAbout() : "") + (own || (tab.id === "about" ? "" : `<p class="gs-muted">${esc(tab.meaning)}</p>`));
  };
  const renderPanes = (state, ui) => tabs.map((t) => `<section class="gs-pane" data-pane="${esc(t.id)}"${attr("hidden", t.id !== state.tab)}>${renderPane(t, state, ui)}</section>`).join("");
  const renderApp = (state, ui) =>
    `<header class="gs-head"><h1>${esc(model.title)}</h1><p class="gs-sub">${esc(page.title)}</p><p class="gs-pulled">${esc(engine.dataPulledLine(snapshot))}</p></header>` +
    `<section class="gs-filters" data-region="filters" aria-label="Filters">${renderFilters(state)}</section>` +
    `<p class="gs-summary" data-region="summary">${renderSummary(state)}</p>` +
    `<nav class="gs-tabs" data-region="tabs" aria-label="Tabs">${renderTabs(state)}</nav>` +
    `<div class="gs-panes" data-region="panes">${renderPanes(state, ui)}</div>`;

  return {
    model, snapshot, programs, panels, tabs, supergroups, groups,
    defaultState, clean, hashOf, stateFromHash, filtersOf, run, scopeOf, programMatches,
    lackFacts, renderNotice, renderTablePanel, renderPanel, visibleCols, csvOf, colsKey, renderApp,
    regions: { filters: renderFilters, summary: renderSummary, tabs: renderTabs, panes: renderPanes, count: renderCount, groupOptions: renderGroupOptions },
  };
}

// ── In a browser ─────────────────────────────────────────────────────────────
const BOM = String.fromCharCode(0xfeff);
/**
 * Wire a page: listeners on its root, the viewer's column choices, the hash.
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
    else return;
    // A month range given backwards is shown the right way round, so the bar is drawn again.
    commit(f === "sg" ? ["groupOptions", "count", "summary", "panes"] : (f === "from" || f === "to") && state[f] !== t.value ? ["filters", "summary", "panes"] : ["count", "summary", "panes"]);
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
    const id = ev.target?.getAttribute?.("data-cols");
    if (id) ui.open[id] = ev.target.open;
  }, true);
  g.addEventListener?.("hashchange", () => {
    const hash = String(g.location.hash).replace(/^#/, "");
    if (hash === lastHash) return;
    state = app.stateFromHash(hash);
    lastHash = app.hashOf(state);
    full();
  });

  // The pre-render IS the default view; anything else is drawn now. Then the controls come alive.
  if (lastHash || Object.keys(ui.cols).length) full();
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
