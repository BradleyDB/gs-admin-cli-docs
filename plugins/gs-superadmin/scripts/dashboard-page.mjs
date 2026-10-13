#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// dashboard-page.mjs — the dashboard page builder (DSH-2): one dashboard spec
// (T-11) and one engagement snapshot (T-10) → one self-contained HTML file per
// page of the spec. Read-only: it reads the two files and writes pages; it
// makes no gs-admin call, and it changes neither contract.
//
//   node dashboard-page.mjs --spec <file> --snapshot <file> --out-dir <dir> [--page <id>] [--kb <folder name>]
//
// A page is ONE file that works from file:// and asks the network for nothing:
//   - the data, embedded compactly: one table per grain, each column a list,
//     ids and other text through dictionaries (packTable);
//   - engagement-query.mjs, inlined BYTE FOR BYTE: the one aggregation path.
//     The browser recomputes a panel with the code that computed the report;
//   - dashboard-runtime.mjs, inlined byte for byte: filters, tabs, the table
//     panel, the notices, the CSV builder;
//   - the default view, PRE-RENDERED here by that same runtime, so the page
//     reads without JavaScript and in a preview. Its controls are switched
//     off until the script runs: a control never does nothing.
//
// What a page carries is decided per page. A page that may not name accounts
// (house rule: account names never reach a leaders' page unless the spec opts
// in) carries no account rows at all, and a page whose Health tab is off
// carries no health tables; the page's copy of the snapshot says so with a
// reason, so the engine answers "not on this page" and never an empty table.
//
// A tab is on, offered or absent: a tab the spec turns off is OFFERED on an
// admin page (dimmed; opening it says what it would take) and ABSENT on a
// leaders' page.
//
// The size report is printed for every page. Above 5 MB a page draws a
// warning; a leaders' page above 15 MB is refused and not written.
//
// Stdout is ONE JSON summary.
//
// Citations: DSH-n / TPL-n are work items and Rnn rulings of the maintainer's
// unpublished JO-dashboards plan; the decision each produced is stated beside
// the token.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { makeCliHelpers, readJsonFile, writeFileAtomicSync, isMainModule } from "./doc-lib.mjs";
import * as engine from "./engagement-query.mjs";
import { openSpec, SPEC_DESCRIPTIONS, TABS, KNOBBED_PANEL_TYPES, presetPanels, pageDateDefault, pageTemplateContent, panelKnobs, describeSpec, kbDirOfSpecFile } from "./dashboard-spec.mjs";
import { applyGroups, resolveGroups, programTraits, describeRule, modelNamesOf, UNGROUPED } from "./dashboard-groups.mjs";
import { createDashboard, LACKS, PAGE_MODEL_VERSION } from "./dashboard-runtime.mjs";
import { DEFAULT_THEME, validateTheme, tokensCss } from "./dashboard-theme.mjs";

/**
 * @typedef {import("./engagement.mjs").T10Snapshot} T10Snapshot
 * @typedef {import("./dashboard-spec.mjs").T11Spec} T11Spec
 * @typedef {import("./dashboard-spec.mjs").T11Page} T11Page
 */

const USAGE = "usage: dashboard-page.mjs --spec <file> --snapshot <file> --out-dir <dir> [--page <id>] [--kb <tenant KB folder name>]";
const MB = 1024 * 1024;
// Not frozen: the page-size budget. 15 MB sits under the 16 MB limit of a hosted artifact.
export const PAGE_BUDGET = Object.freeze({ warnBytes: 5 * MB, refuseExecBytes: 15 * MB });
export const pageFileName = (pageId) => `latest-${pageId}.html`;
// Whether a pull holds what a tab shows: it decides if turning the tab on is a
// rebuild or a new pull.
const TAB_DATA_HELD = {
  engagement: () => true,
  health: (snapshot) => engine.healthAvailability(snapshot).pulled,
  templates: (snapshot) => engine.templateAvailability(snapshot).pulled,
  about: () => true,
};

// ── Packing: rows → columns, text → dictionaries ─────────────────────────────
// The runtime's unpackTable is the other half, and the suite holds the pair to
// a round trip over every table of the fixture snapshots.
const isScalar = (v) => v == null || typeof v !== "object";
function packColumn(values) {
  const present = values.filter((v) => v != null);
  if (present.length && present.every((v) => typeof v === "string")) {
    const at = new Map();
    const i = values.map((v) => (v == null ? -1 : at.get(v) ?? (at.set(v, at.size), at.size - 1)));
    return { d: [...at.keys()], i };
  }
  if (present.length && present.every((v) => typeof v === "object" && !Array.isArray(v))) {
    const keys = Object.keys(present[0]);
    if (present.every((v) => Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k) && isScalar(v[k])))) {
      return { o: Object.fromEntries(keys.map((k) => [k, packColumn(values.map((v) => (v == null ? null : v[k])))])), z: values.flatMap((v, r) => (v == null ? [r] : [])) };
    }
  }
  return values;
}
/** @param {Array<Object<string, *>>} rows @returns {{n: number, c: Object<string, *>}} */
export function packTable(rows) {
  const names = new Set();
  for (const r of rows) for (const k of Object.keys(r)) names.add(k);
  const c = {};
  for (const k of names) {
    const absent = rows.flatMap((r, i) => (Object.hasOwn(r, k) ? [] : [i]));
    const col = packColumn(rows.map((r) => (Object.hasOwn(r, k) ? r[k] : null)));
    c[k] = absent.length ? { w: col, u: absent } : col;
  }
  return { n: rows.length, c };
}
const isRowList = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => !!x && typeof x === "object" && !Array.isArray(x));
// A member that is not a row list or a group of them (null, a number, a list of plain values) is embedded as it is.
const packAll = (group) => Object.fromEntries(Object.entries(group).map(([k, v]) => [k, isRowList(v) ? packTable(v) : v && typeof v === "object" && !Array.isArray(v) ? packAll(v) : v]));

// ── What one page carries ────────────────────────────────────────────────────
/**
 * The snapshot as ONE page holds it: still a T-10 snapshot, less what the
 * page may not or does not show, each with its reason.
 * @param {T10Snapshot} snapshot @param {T11Page} page
 * @returns {*}
 */
export function pageSnapshot(snapshot, page) {
  const tabOn = (id) => page.tabs.some((t) => t.id === id && t.enabled);
  const meta = /** @type {any} */ ({ ...snapshot.meta });
  const facts = /** @type {any} */ ({ ...snapshot.facts });
  const dimensions = /** @type {any} */ ({ ...snapshot.dimensions });
  // A pull that read no accounts keeps its own reason: that is what it would take.
  if (engine.accountAvailability(snapshot).pulled && !page.accountNames) {
    meta.accounts = { pulled: false, reason: "accounts-not-on-page" };
    // The params echo names the pinned accounts by key: not on this page either.
    if (meta.params?.accounts) meta.params = { ...meta.params, accounts: { ...meta.params.accounts, pinned: [] } };
    facts.byAccount = [];
    dimensions.accounts = [];
  }
  // The test accounts are company ids too (S5): a page that may not name accounts carries none of them.
  if (!page.accountNames && meta.params?.testAccounts?.length) meta.params = { ...meta.params, testAccounts: [], redactedOnPage: [...(meta.params.redactedOnPage ?? []), "testAccounts"] };
  if (engine.healthAvailability(snapshot).pulled && !tabOn("health")) {
    meta.health = { pulled: false, reason: "tab-off", asOf: null, dayWindow: null, parts: {} };
    facts.health = Object.fromEntries(Object.keys(facts.health ?? {}).map((k) => [k, []]));
  }
  // Template TEXT (TPL-2): a page whose Templates tab is off carries none (its copy says tab-off, as for health); a
  // page whose tab is on but which withholds the text (pages[].templateContent off: a leaders' page unless opted in)
  // keeps the performance rows and says the text is not on the page. The content of every template row is stripped
  // either way, so no subject or body reaches the file.
  if (engine.templateAvailability(snapshot).pulled && (!tabOn("templates") || !pageTemplateContent(page))) {
    meta.templates = !tabOn("templates") ? { pulled: false, reason: "tab-off", content: false, source: null } : { ...meta.templates, reason: "templates-not-on-page", content: false };
    dimensions.templates = (dimensions.templates ?? []).map((t) => ({ ...t, content: null }));
  }
  // Aggregates only on a page (ruled 2026-10-05): the categorised rows and the counted remainders, never a distinct
  // message and never the failure samples (the masked text behind the "Other" rows is for the terminal).
  if (facts.health) facts.health = engine.healthForPage(facts.health);
  // A page whose definitions show no source detail names no internal domain and no unsubscribe link (ruled
  // 2026-10-05): the values leave the page's copy of the pull's parameters; the recipient class on every row stays.
  if (!page.sourceDetail && meta.params) meta.params = { ...meta.params, internalDomains: [], unsubscribeLinks: [], redactedOnPage: [...(meta.params.redactedOnPage ?? []), "internalDomains", "unsubscribeLinks"] };
  // The selection record names accounts by key (S5): it leaves a page that may not name accounts with the rows.
  const honesty = !page.accountNames && snapshot.honesty?.accountSelection ? { ...snapshot.honesty, accountSelection: null } : snapshot.honesty;
  return { ...snapshot, meta, dimensions, facts, honesty };
}
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/**
 * The spec in words for the About tab, as this page may say it: on a page with
 * no source detail the recipients sentences keep their meaning and drop the
 * domain and link VALUES (ruled 2026-10-05).
 * @param {T11Spec} spec @param {T11Page} page
 */
export function aboutSettings(spec, page) {
  // The settings the pages do not read are not listed (ruled 2026-10-12, F-511 ruling 11): the cadence and the freshness
  // stay in the spec, and the purpose line is the About tab's own paragraph. Keyed on the covered path, never the label.
  // The group rules are not listed here either: the About tab draws them once, as they resolved, with what each
  // matched (the S5-V second sitting read the Groups part twice, 2026-10-12).
  const unlisted = ["refresh.cadence", "freshness.maxAgeDays", "purpose", "groups.rules[]"];
  const said = describeSpec(spec).filter((d) => !d.covers.some((c) => unlisted.includes(c)));
  if (page.sourceDetail) return said.map((d) => ({ label: d.label, text: d.text }));
  const domains = spec.sources.reduce((n, s) => n + s.params.internalDomains.length, 0);
  const links = spec.sources.reduce((n, s) => n + s.params.unsubscribeLinks.length, 0);
  // Keyed on the path a description covers, never its label: a relabel cannot un-redact.
  const withheld = (d) =>
    d.covers.includes("sources[].params.internalDomains[]") ? [domains ? `Addresses at the company's own ${plural(domains, "email domain")} are internal.` : "No internal domain is named, so every recipient counts as external."]
      : d.covers.includes("sources[].params.unsubscribeLinks[]") ? [links ? `Clicks on the tenant's own ${plural(links, "unsubscribe link")} are unsubscribe clicks, not content clicks.` : "No unsubscribe link of the tenant's own is named; only the usual unsubscribe wordings are left out of click figures."]
        : d.text;
  return said.map((d) => ({ label: d.label, text: withheld(d) }));
}

/**
 * Everything a page embeds (the runtime's model).
 * @param {T11Spec} spec @param {T10Snapshot} snapshot @param {T11Page} page
 */
export function pageModel(spec, snapshot, page, { delta = null, kb = null } = {}) {
  const admin = page.preset === "admin";
  const tabs = page.tabs.flatMap((t, index) => {
    // `index` is the tab's place in the SPEC's list (the copy line names it: `pages.N.tabs.M.enabled`, F-503).
    const about = { id: t.id, index, label: TABS[t.id].split(":")[0], meaning: TABS[t.id] };
    if (t.enabled) return [{ ...about, state: "on" }];
    // Off: an invitation on an admin page, absent on a leaders' page.
    return admin ? [{ ...about, state: "offered", held: TAB_DATA_HELD[t.id](snapshot) }] : [];
  });
  const on = new Set(tabs.filter((t) => t.state === "on").map((t) => String(t.id)));
  const settingLabels = {};
  for (const row of LACKS) {
    if (!row.setting) continue;
    const described = SPEC_DESCRIPTIONS.find((d) => d.covers.includes(row.setting.path));
    if (!described) throw new Error(`dashboard page: the notice for "${row.reason}" names the setting ${row.setting.path}, which no description of the dashboard spec covers`);
    settingLabels[row.setting.path] = described.label;
  }
  const offered = (id) => spec.globalFilters.some((f) => f.id === id && f.enabled);
  const recipients = spec.globalFilters.find((f) => f.id === "recipientClass");
  const kept = pageSnapshot(snapshot, page);
  // The group rules as they resolved over this snapshot: what each matched, and who is Ungrouped (R26, ruled 2026-10-04).
  const resolution = resolveGroups({ programs: programTraits(snapshot), groups: spec.groups });
  const matched = spec.groups.rules.map((_, i) => resolution.assignments.filter((a) => a.by.supergroup === `rule ${i + 1}` || a.by.group === `rule ${i + 1}`).length);
  const names = new Map(snapshot.dimensions.programs.map((p) => [p.id, p.name]));
  // A model rule is described by the display name the snapshot knows for its code (F-515 d).
  const ruleNames = modelNamesOf(snapshot.dimensions.programs);
  // The look (UX-1): the spec's theme through the validator, or the default; the page carries what it needs to SAY
  // about it (the logo, and the notes on replaced tokens), never the colours themselves, which are the style sheet's.
  const look = validateTheme(spec.theme ?? null);
  return {
    v: PAGE_MODEL_VERSION,
    slug: spec.slug,
    // The knowledge-base folder's NAME (never its path), so every copy line can carry `--kb` (F-503); null when the
    // builder was run by hand with no folder known.
    kb: kb ?? null,
    title: spec.title,
    look: { custom: !!spec.theme, logo: look.theme.logo, notes: look.notes, derivedDark: !!spec.theme && look.derivedDark },
    ungrouped: UNGROUPED,
    page: {
      // `index`: the page's place in the spec's list, so a copy line can name it (`pages.N…`, F-503).
      id: page.id, index: spec.pages.findIndex((p) => p.id === page.id), preset: page.preset, title: page.title, statusDefault: page.statusDefault, dateDefault: pageDateDefault(page), tabs,
      // The panels, each typed view (the health four, the templates view) with its knobs resolved against the spec (the page cannot read the spec).
      panels: presetPanels(page).filter((p) => on.has(p.tab)).map((p) => (p.type in KNOBBED_PANEL_TYPES ? { ...p, knobs: panelKnobs(spec, p) } : p)),
    },
    filters: { dateRange: offered("dateRange"), programs: offered("programs"), group: offered("group"), status: offered("status"), recipientClass: { enabled: !!recipients?.enabled, default: recipients?.default ?? "all" } },
    testAccounts: spec.sources.reduce((n, s) => n + s.params.testAccounts.length, 0),
    settingLabels,
    // No freshness and no cadence on the page (ruled 2026-10-12): the header says when the data was pulled and that the
    // pages are not live; refresh.cadence and freshness.maxAgeDays stay in the spec unread.
    health: { silentDays: spec.health.silentDays },
    // Health caveats and the page-level health banner are decided from the spec: is this page's Health tab on (ruled 2026-10-04).
    healthTab: on.has("health"),
    // The actions seam (ruled 2026-10-05, LTR-10): null on every page built here; a local app would set {base, token}.
    actions: null,
    // The change since the last pull (PUB-1, S5): the refresh computes it and passes it in; null on a first pull and
    // on a page built by hand. {previousPulledAt, closedMonths, metrics: {id: {previous, current, change}}}.
    delta,
    about: {
      sourceDetail: page.sourceDetail,
      // The admin's own sentence, when one was set through `change` (the purpose question is dropped; ruled 2026-10-12).
      purpose: spec.purpose ?? null,
      settings: aboutSettings(spec, page),
      groups: { rules: spec.groups.rules.map((r, i) => ({ text: describeRule(r, { names: ruleNames }), matched: matched[i] })), ungrouped: resolution.ungrouped.map((id) => ({ id, name: names.get(id) ?? null })), overrides: Object.keys(spec.groups.overrides).length },
    },
    snapshot: { ...kept, dimensions: packAll(kept.dimensions), facts: packAll(kept.facts) },
  };
}

// ── The file ─────────────────────────────────────────────────────────────────
// JSON inside a <script> element: nothing in it may read as markup, whatever a
// tenant named a program. Each such character is written as its escape, which
// JSON.parse reads back.
const UNSAFE_IN_SCRIPT = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, "g");
const jsonForScript = (value) => JSON.stringify(value).replace(UNSAFE_IN_SCRIPT, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
const bytesOf = (text) => Buffer.byteLength(text, "utf8");
// Tokens only (R28): every colour, font and radius a page uses is declared ONCE
// in the token block, with a dark set beside it, and every rule and every SVG
// mark references a token. The block is EMITTED from a theme (dashboard-
// theme.mjs, UX-1): the default theme for a spec that names none, the spec's
// brand theme through the validator otherwise. The BRAND-FACING tokens sit in
// the first block of each pair; the STATUS tokens (stale, error, warning, ok,
// the two tracking states) sit in their own block and are not part of a
// theme. The suite greps the rest of this sheet and the runtime's SVG emitters
// for a literal colour or font.
export const TOKENS = tokensCss(DEFAULT_THEME);
// The rules: every colour, font and radius through a token; sizes and spacing
// on a small scale (4, 8, 12, 16, 24); one focus ring for every control.
export const STYLE_RULES = `
*{box-sizing:border-box}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.45 var(--font)}
.gs-root{border:0;margin:0 auto;padding:0;min-width:0;max-width:1200px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
h1{font-size:20px;margin:0}
h2{font-size:16px;margin:0}
h3{font-size:14px;margin:12px 0 6px}
h4{font-size:13px;margin:8px 0 4px}
.gs-head{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin-bottom:4px}
.gs-head h1{flex:0 1 auto}
.gs-logo{height:28px;width:auto;max-width:160px;display:block}
.gs-sub{flex:1 0 100%;margin:0}
.gs-pulled{flex:1 0 100%;margin:0 0 8px;font-size:13px}
.gs-sub,.gs-pulled,.gs-muted,.gs-note,.gs-count,.gs-basis,.gs-pointer{color:var(--muted)}
.gs-note,.gs-basis,.gs-pointer{font-size:13px;margin:4px 0}
.gs-tabs{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--line);margin:8px 0 0}
.gs-tab{border:1px solid transparent;border-bottom:0;border-radius:var(--radius) var(--radius) 0 0;padding:8px 14px;background:none;color:var(--muted);font-weight:600}
.gs-tab.is-current{border-color:var(--line);border-bottom:1px solid var(--bg);margin-bottom:-1px;color:var(--accent);background:var(--bg)}
.gs-tab.is-offered{opacity:.7;border-style:dashed;font-weight:400}
.gs-filters{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:0 0 16px;padding:8px 12px;background:var(--soft);border:1px solid var(--line);border-top:0;border-radius:0 0 var(--radius) var(--radius)}
.gs-filters:empty{display:none}
.gs-f{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0;max-width:100%}
.gs-f-title{font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--muted)}
.gs-f-control{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;min-height:28px}
.gs-f-reset{margin-left:auto;justify-content:flex-end;padding-top:18px}
.gs-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer}
.gs-switch input[role=switch]{appearance:none;-webkit-appearance:none;width:34px;height:18px;margin:0;padding:0;min-height:0;border:1px solid var(--control);border-radius:9px;background:var(--soft);position:relative;cursor:pointer;flex:none}
.gs-switch input[role=switch]::before{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--control);transition:left .12s}
.gs-switch input[role=switch]:checked{background:var(--accent);border-color:var(--accent)}
.gs-switch input[role=switch]:checked::before{left:18px;background:var(--bg)}
.gs-switch input[role=switch]:disabled{opacity:.5;cursor:default}
.gs-bar-summary{flex:1 0 100%;margin:0;font-size:13px;color:var(--muted)}
.gs-count{font-weight:400}
select,input,button{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--control);border-radius:4px;padding:4px 8px;max-width:100%;min-height:28px}
input[type=checkbox]{min-height:0;accent-color:var(--accent)}
button{cursor:pointer}
button:hover{border-color:var(--accent)}
:disabled{opacity:.6;cursor:default}
.gs-btn[aria-pressed=true],.gs-chip.is-on{border-color:var(--accent);color:var(--accent);font-weight:600}
.gs-pop-host{position:relative;display:inline-block}
.gs-pop-host>summary{list-style:none;cursor:pointer;display:inline-block;padding:4px 8px;min-height:28px;border:1px solid var(--control);border-radius:4px;background:var(--bg)}
.gs-pop-host>summary::-webkit-details-marker{display:none}
.gs-pop-host[open]>summary{border-color:var(--accent)}
.gs-pop{position:absolute;z-index:5;top:calc(100% + 4px);left:0;min-width:260px;max-width:min(420px,calc(100vw - 32px));padding:8px;background:var(--bg);border:1px solid var(--control);border-radius:var(--radius);box-shadow:0 4px 16px var(--shade)}
.gs-pop-head{margin:0 0 6px;font-weight:600}
.gs-pop label{display:block;padding:2px 0}
.gs-picker-tools{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.gs-picker-tools input[type=search]{flex:1 1 140px}
.gs-proglist{max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:4px;background:var(--bg);padding:4px}
.gs-prog,.gs-status{display:block;padding:2px 4px;overflow-wrap:anywhere}
.gs-prog[data-dim]{opacity:.6}
.gs-dim-why{font-size:12px;color:var(--muted)}
.gs-badge{display:inline-block;margin-left:4px;padding:0 6px;border:1px solid var(--line);border-radius:9px;font-size:12px;color:var(--muted)}
.gs-badge-stale{color:var(--status-stale);border-color:var(--status-stale)}
.gs-badge-error{color:var(--status-error);border-color:var(--status-error)}
.gs-badge-warn{color:var(--status-warn);border-color:var(--status-warn)}
.gs-panel{margin:0 0 28px}
.gs-panel-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:0 0 8px}
.gs-panel-head h2{flex:1 1 auto}
.gs-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-left:auto}
.gs-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}
.gs-group-title{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:24px 0 4px;padding-bottom:4px;border-bottom:1px solid var(--line)}
.gs-group-title:first-child{margin-top:0}
.gs-group-note{margin:0 0 12px}
.gs-scroll{overflow:auto;max-height:400px;border-bottom:1px solid var(--line)}
table{border-collapse:separate;border-spacing:0;width:100%}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--soft);white-space:nowrap;font-size:13px;position:sticky;top:0;z-index:1}
tfoot td{position:sticky;bottom:0;background:var(--soft);border-top:1px solid var(--line)}
.gs-panel-sub{font-size:12px;color:var(--muted)}
[data-tip]{position:relative;cursor:help}
[data-tip]:hover::after,[data-tip]:focus-visible::after,[data-tip].is-open::after{content:attr(data-tip);position:absolute;left:0;top:calc(100% + 4px);z-index:6;width:max-content;max-width:300px;padding:6px 8px;background:var(--fg);color:var(--bg);border-radius:4px;font:12px/1.4 var(--font);font-style:normal;font-weight:400;white-space:normal;text-align:left;box-shadow:0 2px 8px var(--shade)}
sup [data-tip]{font-size:12px}
.gs-svg-value{fill:var(--muted);font-size:10px;font-family:var(--font)}
.gs-cron{font-size:11px;color:var(--muted)}
.gs-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.gs-nowrap{white-space:nowrap}
tfoot td{font-weight:600}
.gs-sort{border:0;background:none;padding:0;min-height:0;font:inherit;font-weight:600;color:inherit;cursor:pointer;white-space:nowrap;font-size:13px}
.gs-notice{margin:8px 0;padding:10px 12px;background:var(--note);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:4px;max-width:720px}
.gs-notice p{margin:0 0 6px}
.gs-notice p:last-child{margin-bottom:0}
.gs-notice-head{font-weight:600}
.gs-notice-compact{padding:6px 8px;font-size:13px}
.gs-notice code{overflow-wrap:anywhere}
.gs-path,code{font-family:var(--mono);font-size:12px}
.gs-path{color:var(--muted)}
.gs-notes{margin:16px 0 0;padding:8px 12px;border-left:3px solid var(--line);font-size:13px;color:var(--muted)}
.gs-notes p{margin:0 0 4px}
.gs-notes p:last-child{margin:0}
.gs-defs dt,.gs-settings dt,.gs-prov dt{font-weight:600;margin-top:8px}
.gs-defs dd,.gs-settings dd,.gs-prov dd{margin:0}
.gs-formula{margin:4px 0 0;padding-left:18px;color:var(--muted);font-size:13px}
.gs-about{margin:0 0 24px}
.gs-about h2{margin:0 0 8px;padding-top:8px}
.gs-toc{margin:8px 0 16px;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
.gs-toc a{color:var(--accent)}
.gs-ungrouped.is-prominent{padding:8px 10px;border:1px solid var(--line);border-left:4px solid var(--status-warn);border-radius:4px}
.gs-no-match{color:var(--status-warn)}
.gs-banner{margin:8px 0;padding:8px 12px;background:var(--note);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:4px}
.gs-banner-health{border-left-color:var(--status-error)}
.gs-banner p{margin:0}
.gs-banner .gs-notice-line{margin-top:4px}
.gs-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.gs-kpi{padding:10px 12px;background:var(--soft);border:1px solid var(--line);border-radius:var(--radius)}
.gs-kpi p{margin:0}
.gs-kpi-label{color:var(--muted);font-size:12px}
.gs-kpi-value{font-size:26px;font-weight:600;line-height:1.2;margin:2px 0 4px}
.gs-kpi-usual,.gs-kpi-context,.gs-kpi-since{font-size:12px;color:var(--muted)}
.gs-chart{width:100%;height:auto;display:block;max-width:900px}
.gs-mini{height:14px;width:auto;display:inline-block;vertical-align:middle}
.gs-svg-grid{stroke:var(--line);stroke-width:1}
.gs-svg-axis{stroke:var(--line);stroke-width:1}
.gs-svg-provisional{fill:var(--shade)}
.gs-svg-tick{fill:var(--muted);font-size:11px;font-family:var(--font)}
.gs-svg-label{fill:var(--fg);font-size:11px;font-family:var(--font)}
.gs-svg-line{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.gs-svg-ring{fill:var(--bg)}
.gs-svg-dot{stroke-width:2}
.gs-svg-carried{fill:var(--bg);stroke-dasharray:2 2}
.gs-legend{list-style:none;display:flex;flex-wrap:wrap;gap:4px 16px;margin:0 0 6px;padding:0;font-size:13px;color:var(--muted)}
.gs-swatch{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:middle}
.gs-fallback{margin:6px 0}
.gs-fallback summary{cursor:pointer;color:var(--muted)}
.gs-chip{border-radius:12px;padding:2px 10px;min-height:24px}
.gs-list{margin:8px 0}
.gs-list summary{cursor:pointer;font-weight:600}
.gs-sub td{color:var(--muted);font-size:13px;background:var(--soft)}
.gs-sub td:first-child{padding-left:24px;border-left:3px solid var(--line)}
.gs-sub2 td:first-child{padding-left:44px}
.gs-kind{display:inline-block;margin-right:6px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.gs-expand{font-size:12px;padding:0 6px;min-height:22px;margin-left:4px}
.gs-other td{font-style:italic}
.gs-not-tracked{color:var(--status-not-tracked);font-style:italic}
.gs-unknown{color:var(--status-unknown);font-size:12px}
.gs-mark{font-size:12px;cursor:help}
.gs-info{color:var(--accent)}
.gs-caveats{margin:4px 0;padding-left:18px;font-size:13px;color:var(--muted)}
.gs-search{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 8px}
.gs-search input[type=search]{min-width:200px}
.gs-snippet{margin:2px 0 0;font-size:12px;color:var(--muted)}
mark{background:var(--shade);color:inherit;padding:0 2px}
.gs-sort{border:0;background:none;padding:0;min-height:0;font:inherit;font-weight:600;color:inherit;cursor:pointer;white-space:nowrap}
.gs-sort.is-on{color:var(--accent)}
.gs-text{font-size:12px;padding:0 6px;margin-left:4px;min-height:22px}
.gs-drawer{margin:8px 0 16px;padding:12px;border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:var(--radius);background:var(--soft)}
.gs-drawer h3{margin:0}
.gs-body{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.45 var(--font);margin:0 0 8px;padding:8px;background:var(--bg);border:1px solid var(--line);border-radius:4px}
.gs-foot{margin-top:24px;border-top:1px solid var(--line);padding-top:8px}
.gs-foot summary{cursor:pointer;color:var(--muted)}
[hidden]{display:none!important}
@media (max-width:600px){body{padding:12px}.gs-kpi-value{font-size:22px}.gs-pop{position:fixed;left:12px;right:12px;top:auto;max-width:none;max-height:70vh;overflow:auto}.gs-f-reset{margin-left:0;padding-top:0}}
@media print{.gs-tabs,.gs-f,.gs-tools,.gs-chips,.gs-fallback summary,.gs-notice-line{display:none}.gs-filters{border:0;background:none;padding:0}.gs-panel{break-inside:avoid}.gs-pane[hidden]{display:none!important}}
`;
const STYLE = TOKENS + STYLE_RULES;

/**
 * Build one page. Pure: the two inlined sources are passed in, and nothing is
 * read or written.
 * @param {object} args
 * @param {T11Spec} args.spec a valid spec
 * @param {T10Snapshot} args.snapshot the snapshot, with its groups applied
 * @param {string} args.pageId
 * @param {string} args.engineSource  engagement-query.mjs, as on disk
 * @param {string} args.runtimeSource dashboard-runtime.mjs, as on disk
 * @param {{warnBytes: number, refuseExecBytes: number}} [args.budget]
 * @param {?{previousPulledAt: string, closedMonths: string[], metrics: Object<string, {previous: ?number, current: ?number, change: ?{kind: "points"|"ratio", value: ?number}}>}} [args.delta]
 *   the change since the last pull (PUB-1): computed by the refresh over the closed months both snapshots hold; null on a first pull
 * @param {?string} [args.kb] the tenant knowledge-base folder's NAME, so every copy line carries `--kb` (F-503); null when unknown
 * @returns {{html: ?string, report: {page: string, preset: string, file: string, written: boolean, bytes: Object<string, number>, megabytes: number, rows: Object<string, number>, tables: Object<string, {rows: number, bytes: number}>, programs: number, warning: ?string, refused: ?string}}}
 */
export function buildPage({ spec, snapshot, pageId, engineSource, runtimeSource, budget = PAGE_BUDGET, delta = null, kb = null }) {
  const page = spec.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`dashboard page: the spec has no page "${pageId}" (it has ${spec.pages.map((p) => p.id).join(", ")})`);
  if (spec.tenantHost !== snapshot.meta.tenantHost) throw new Error(`dashboard page: the spec belongs to ${spec.tenantHost} and the snapshot was pulled from ${snapshot.meta.tenantHost} — a dashboard is never built from another tenant's data`);
  for (const [name, source] of [["engagement-query.mjs", engineSource], ["dashboard-runtime.mjs", runtimeSource]]) {
    // Inlined as they are, so neither may hold what would end a script element early.
    if (/<\/script|<!--/i.test(source)) throw new Error(`dashboard page: ${name} holds text that would end the page's script element; it cannot be inlined as it is`);
  }
  const model = pageModel(spec, snapshot, page, { delta, kb });
  let prerender;
  try {
    const app = createDashboard(engine, model);
    prerender = app.renderApp(app.defaultState(), null);
  } catch (e) {
    throw new Error(`dashboard page "${pageId}": ${e instanceof Error ? e.message : e}`);
  }
  const data = jsonForScript(model);
  // The style sheet: the spec's theme (validated; a failing token already replaced) or the default, then the rules.
  const style = spec.theme ? tokensCss(validateTheme(spec.theme).theme) + STYLE_RULES : STYLE;
  const head = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escTitle(spec.title)} · ${escTitle(page.title)}</title>\n<style>${style}</style>\n</head>\n<body>\n`;
  const html =
    head +
    `<noscript><p>This is the default view. Filters, tabs and downloads need JavaScript.</p></noscript>\n` +
    `<fieldset id="gs-root" class="gs-root" disabled>${prerender}</fieldset>\n` +
    `<script type="application/json" id="gs-data">${data}</script>\n` +
    `<script type="module">\n${engineSource}\n;globalThis.__gsEngine = { ${Object.keys(engine).sort().join(", ")} };\n</script>\n` +
    `<script type="module">\n${runtimeSource}\n;boot(globalThis);\n</script>\n</body>\n</html>\n`;
  const bytes = { total: bytesOf(html), data: bytesOf(data), engine: bytesOf(engineSource), runtime: bytesOf(runtimeSource), prerender: bytesOf(prerender), style: bytesOf(style) };
  const megabytes = Number((bytes.total / MB).toFixed(2));
  // Every packed table the page embeds, at any depth (the health five sit under facts.health), with its rows and
  // its bytes, so the warning can name what is actually large (F-485).
  const tables = {};
  const walk = (group, prefix) => {
    for (const [k, v] of Object.entries(group)) {
      if (v && typeof v === "object" && typeof v.n === "number" && v.c) tables[prefix + k] = { rows: v.n, bytes: bytesOf(JSON.stringify(v)) };
      else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, `${prefix}${k}.`);
    }
  };
  walk(model.snapshot.facts, "");
  // The template dimension carries the template TEXT (TPL-2): its share of the page is reported like a fact table's.
  walk({ templates: model.snapshot.dimensions.templates }, "dimensions.");
  const rows = Object.fromEntries(Object.entries(tables).map(([k, t]) => [k, t.rows]));
  const largest = Object.entries(tables).sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 2).filter(([, t]) => t.bytes > 0);
  const named = largest.map(([k, t]) => `${k} (${Number((t.bytes / MB).toFixed(2))} MB)`).join(" and ");
  // What would make the page smaller follows from where the bytes are.
  const remedy = largest[0]?.[0].startsWith("health.") ? "The Health tab's data makes the size: turn the tab off for this page, or narrow the programs or the window."
    : largest[0]?.[0] === "byAccount" ? "Customer lists make the size: turn them off, or narrow the programs or the window."
    : largest[0]?.[0] === "dimensions.templates" ? "Template text makes the size: turn template text off for this page (pages[].templateContent), or narrow the programs."
    : "Narrow the programs or the window.";
  const mostly = named ? ` Most of it is ${named}.` : "";
  const refused = page.preset === "exec" && bytes.total > budget.refuseExecBytes ? `the page is ${megabytes} MB, over the ${budget.refuseExecBytes / MB} MB a leaders' page may be; it was not written.${mostly} ${remedy}` : null;
  const warning = !refused && bytes.total > budget.warnBytes ? `the page is ${megabytes} MB, over the ${budget.warnBytes / MB} MB budget: it will be slow to open and to filter.${mostly} ${remedy}` : null;
  return { html: refused ? null : html, report: { page: page.id, preset: page.preset, file: pageFileName(page.id), written: false, bytes, megabytes, rows, tables, programs: snapshot.dimensions.programs.length, warning, refused } };
}
const escTitle = (v) => String(v).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

/** The two files every page inlines, exactly as they are on disk. */
export const inlinedSources = () => ({
  engineSource: readFileSync(new URL("./engagement-query.mjs", import.meta.url), "utf8"),
  runtimeSource: readFileSync(new URL("./dashboard-runtime.mjs", import.meta.url), "utf8"),
});

async function main() {
  const argv = process.argv.slice(2);
  const helpers = makeCliHelpers("dashboard-page.mjs", argv);
  const { opt, finish } = helpers;
  /** @type {import("./doc-lib.mjs").FailFn} */
  const fail = helpers.fail;
  if (!opt("--spec") || !opt("--snapshot") || !opt("--out-dir")) fail(USAGE);
  const read = (path, what) => {
    try {
      return readJsonFile(resolve(path));
    } catch (e) {
      return fail(`${what} at ${path} cannot be read: ${e instanceof Error ? e.message : e}`);
    }
  };
  let spec;
  let pulled;
  try {
    spec = openSpec(read(opt("--spec"), "the spec"));
    pulled = engine.openSnapshot(read(opt("--snapshot"), "the snapshot"));
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  const only = opt("--page");
  if (only && !spec.pages.some((p) => p.id === only)) fail(`--page ${only}: the spec has no such page (it has ${spec.pages.map((p) => p.id).join(", ")})`);
  // The spec's groups as they are now: a change of grouping needs no new pull.
  const { snapshot, resolution } = applyGroups(pulled, spec.groups);
  const sources = inlinedSources();
  const outDir = resolve(opt("--out-dir"));
  // The knowledge-base folder's NAME, for the copy lines (F-503): `--kb <name>` when given, else read from where the
  // spec writer keeps a spec (a spec read from anywhere else gives none, and the lines omit the flag; stderr says so).
  const kbDir = kbDirOfSpecFile(opt("--spec"));
  const kb = opt("--kb") ?? (kbDir ? basename(kbDir) : null);
  if (!kb) console.error("dashboard-page.mjs: no knowledge-base folder known for this spec (pass --kb <folder name>): the pages' copy lines omit --kb");
  const pages = [];
  for (const page of spec.pages.filter((p) => !only || p.id === only)) {
    let built;
    try {
      built = buildPage({ spec, snapshot, pageId: page.id, ...sources, kb });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
    if (built.html != null) {
      mkdirSync(outDir, { recursive: true });
      writeFileAtomicSync(join(outDir, built.report.file), built.html);
      built.report.written = true;
    }
    for (const said of [built.report.warning, built.report.refused]) if (said) console.error(`dashboard-page.mjs: page "${page.id}": ${said}`);
    pages.push(built.report);
  }
  const refused = pages.filter((p) => p.refused).map((p) => p.page);
  await finish({ ok: !refused.length, mode: "build", slug: spec.slug, outDir, pulledAt: snapshot.meta.pulledAt, ungrouped: resolution.line, budget: { warnMegabytes: PAGE_BUDGET.warnBytes / MB, refuseExecMegabytes: PAGE_BUDGET.refuseExecBytes / MB }, pages, refused }, refused.length ? 1 : 0);
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(`dashboard-page.mjs: ${e?.stack ?? e}`);
    process.exit(1);
  });
}
