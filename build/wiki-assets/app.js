/* gs-admin Explorer — runtime app. Consumes window.CATALOG / DOCS / WORKFLOWS.
   Inlined into wiki/index.html at build time. Vanilla JS, no dependencies. */
(function () {
  "use strict";
  const CAT = window.CATALOG;
  const DOCS = window.DOCS || [];          // [{slug,title,html}]
  const WF = window.WORKFLOWS || { index: null, items: [] };
  const byId = Object.fromEntries(CAT.commands.map((c) => [c.id, c]));
  const docBySlug = Object.fromEntries(DOCS.map((d) => [d.slug, d]));
  const wfBySlug = Object.fromEntries(WF.items.map((d) => [d.slug, d]));
  const $ = (s, el = document) => el.querySelector(s);
  let query = "";

  // The comparison guide is a standalone sibling page next to index.html —
  // deliberately not a DOC_ORDER doc (routing it through the app would
  // re-render it and lose its standalone layout). Plain href, no hash route;
  // the ↗ marks that following it leaves the app.
  const COMPARISON_GUIDE = {
    href: "comparison-guide.html",
    title: "Comparison Guide ↗",
    blurb: "CLI + plugin vs M2M OAuth — standalone page",
  };

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  // ── Sidebar ────────────────────────────────────────────────────────────────
  function navItem(label, href, count) {
    const c = count != null ? `<span class="count">${count}</span>` : "";
    return `<a class="navlink" href="${href}" data-href="${href}"><span>${esc(label)}</span>${c}</a>`;
  }
  function navGroup(title, items) {
    return `<div class="navgroup"><h4>${esc(title)}</h4>${items.join("")}</div>`;
  }
  function buildSidebar() {
    const guide = [navItem("Home", "#/home")].concat(
      DOCS.map((d) => navItem(d.title, "#/doc/" + d.slug))
    );
    guide.push(navItem(COMPARISON_GUIDE.title, COMPARISON_GUIDE.href));
    const wf = [navItem("All workflows", "#/workflows")].concat(
      WF.items.map((w) => navItem(w.title.replace(/^Workflow:\s*/, ""), "#/workflow/" + w.slug))
    );
    const doms = CAT.domains.map((d) =>
      navItem(d.title, "#/domain/" + d.namespace, d.commandCount)
    );
    $("#sidebar").innerHTML =
      navGroup("Guide", guide) + navGroup("Workflows", wf) + navGroup("Domains", doms);
  }

  // ── Shared bits ────────────────────────────────────────────────────────────
  function cmdRow(c, showDomain) {
    return `<a class="cmdrow" href="#/cmd/${encodeURIComponent(c.id)}">
      <span class="path">gs-admin ${esc(c.shortPath)}</span>
      <span class="sum">${esc(c.summary)}</span>
      <span class="meta">
        ${showDomain ? `<span class="badge lane">${esc(c.domain)}</span>` : ""}
        ${c.mutating ? '<span class="badge mutate">mutating</span>' : ""}
      </span></a>`;
  }
  function codeBlock(lines) {
    return `<pre><code>${esc(lines.join("\n"))}</code></pre>`;
  }
  function flagsTable(flags) {
    if (!flags.length) return '<p class="empty">No flags.</p>';
    const rows = flags
      .map((f) => {
        let flag = f.flag
          ? `<code>${esc(f.flag)}</code>`
          : `<code>${esc(f.name)}</code> <span class="empty">(input)</span>`;
        if (f.char) flag += `, <code>-${esc(f.char)}</code>`;
        let d = esc(f.description || "");
        if (f.enum) d += ` <span class="empty">One of: ${f.enum.map((e) => `<code>${esc(e)}</code>`).join(", ")}.</span>`;
        if (f.csv) d += ' <span class="empty">(comma-separated)</span>';
        const def =
          f.default === null || f.default === undefined
            ? "—"
            : `<code>${esc(JSON.stringify(f.default))}</code>`;
        return `<tr><td>${flag}</td><td><code>${esc(f.type)}</code></td><td>${
          f.required ? '<span class="req">✓</span>' : ""
        }</td><td>${def}</td><td>${d}</td></tr>`;
      })
      .join("");
    return `<table><thead><tr><th>Flag</th><th>Type</th><th>Req</th><th>Default</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function notesBlock(notes) {
    const items = notes
      .map((n) =>
        typeof n === "string"
          ? `<li>${esc(n)}</li>`
          : `<li><b>${esc(n.topic)}</b> — ${esc(n.rule)}${
              n.spec ? ` <span class="empty">(spec: ${esc(n.spec)})</span>` : ""
            }</li>`
      )
      .join("");
    return `<blockquote><b>Domain notes (guidance for AI / agent consumers)</b><ul>${items}</ul></blockquote>`;
  }
  const notFound = () => '<h1>Not found</h1><p class="empty">No such page. <a href="#/home">Go home</a>.</p>';

  // ── Pages ──────────────────────────────────────────────────────────────────
  function renderHome() {
    const m = CAT.meta;
    let h = `<div class="hero"><h1>gs-admin Explorer</h1>
      <p class="lead">Interactive reference for the Gainsight Admin CLI &amp; MCP server — every command, flag, and tool in one place.</p></div>`;
    h += `<div class="statgrid">
      <div class="stat"><b>${m.counts.totalCliCommands}</b><span>CLI commands</span></div>
      <div class="stat"><b>${m.counts.mcpTools}</b><span>MCP tools</span></div>
      <div class="stat"><b>${m.counts.domains}</b><span>domains</span></div>
      <div class="stat"><b>${esc(m.cliVersion)}</b><span>CLI version</span></div></div>`;
    h += `<h2>Explore the domains</h2><div class="cardgrid">`;
    h += CAT.domains
      .map(
        (d) => `<a class="card" href="#/domain/${d.namespace}">
        <h3>${esc(d.title)}</h3>
        <div class="ali">${esc(d.namespace)}${d.aliases.length ? " · " + d.aliases.map(esc).join(", ") : ""} · ${d.commandCount} cmds</div>
        <p>${esc(clip(d.description, 120))}</p></a>`
      )
      .join("");
    h += `</div><h2>Guides &amp; workflows</h2><div class="cardgrid">`;
    h += DOCS.map((d) => `<a class="card" href="#/doc/${d.slug}"><h3>${esc(d.title)}</h3></a>`).join("");
    h += `<a class="card" href="${COMPARISON_GUIDE.href}"><h3>${esc(COMPARISON_GUIDE.title)}</h3><p>${esc(COMPARISON_GUIDE.blurb)}</p></a>`;
    h += `<a class="card" href="#/workflows"><h3>Workflows</h3><p>End-to-end walkthroughs</p></a></div>`;
    h += `<p class="empty" style="margin-top:28px">Generated from <code>${esc(m.cliPackage)}@${esc(m.cliVersion)}</code> on ${esc(m.generatedAt.slice(0, 10))}. Regenerate with <code>npm run build</code>.</p>`;
    return h;
  }

  function renderDomain(ns) {
    const dom = CAT.domains.find((d) => d.namespace === ns);
    if (!dom) return notFound();
    const cmds = CAT.commands
      .filter((c) => c.domain === ns)
      .sort((a, b) => a.path.localeCompare(b.path, "en"));
    let h = `<h1>${esc(dom.title)} ${
      dom.aliases.length ? `<span class="ver">${dom.aliases.map(esc).join(" · ")}</span>` : ""
    }</h1>`;
    h += `<p class="lead">${esc(dom.description)}</p>`;
    if (dom.notes && dom.notes.length) h += notesBlock(dom.notes);
    h += `<p class="empty">${cmds.length} command${cmds.length === 1 ? "" : "s"} · namespace <code>${esc(ns)}</code>${
      dom.lane === "runtime" ? " · Lane 2 (CLI-hidden, MCP-facing)" : dom.lane === "static" ? " · CLI-only" : ""
    }</p>`;
    const groups = new Map();
    for (const c of cmds) {
      const g = c.group || "general";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(c);
    }
    for (const [g, list] of groups) {
      if (groups.size > 1) h += `<div class="grouphdr">${esc(g)}</div>`;
      h += list.map((c) => cmdRow(c, false)).join("");
    }
    return h;
  }

  function renderCmd(id) {
    const c = byId[id];
    if (!c) return notFound();
    const dom = CAT.domains.find((d) => d.namespace === c.domain);
    const crumb = [`<a href="#/domain/${c.domain}">${esc(dom ? dom.title : c.domain)}</a>`]
      .concat((c.groupTitles || []).map(esc))
      .join(" › ");
    const meta = [];
    meta.push(
      c.mcpTool
        ? `<b>MCP tool</b> <code>${esc(c.mcpTool)}</code>`
        : `<b>MCP tool</b> <span class="empty">none (CLI-only)</span>`
    );
    meta.push(`<b>Mutating</b> ${c.mutating ? "yes ⚠️" : "no"}`);
    if (c.outputFormat) meta.push(`<b>Output</b> <code>${esc(c.outputFormat)}</code>`);
    if (c.lane) meta.push(`<b>Lane</b> ${esc(c.lane)}`);
    if (c.cliHidden) meta.push(`<b>CLI</b> hidden`);
    if (c.endpoints && c.endpoints.length)
      meta.push(`<b>Endpoint(s)</b> ${c.endpoints.map((e) => `<code>${esc(e.method + " " + e.path)}</code>`).join(" ")}`);

    let h = `<p class="crumb">${crumb}</p>`;
    h += `<div class="cmdtitle">gs-admin ${esc(c.path)}</div>`;
    h += `<div style="margin:2px 0 10px">${c.mutating ? '<span class="badge mutate">mutating</span> ' : ""}<span class="badge lane">${esc(c.lane)}</span>${
      c.mcpTool ? ` <span class="badge mcp">${esc(c.mcpTool)}</span>` : ""
    }</div>`;
    if (c.shortPath !== c.path) h += `<p class="empty mono">short form: gs-admin ${esc(c.shortPath)}</p>`;
    h += `<p>${esc(c.summary)}</p>`;
    if (c.description && c.description !== c.summary) h += `<p>${esc(c.description)}</p>`;
    h += `<div class="metarow">${meta.map((m) => `<span>${m}</span>`).join("")}</div>`;
    h += `<h3>Flags</h3>${flagsTable(c.flags)}`;
    if (c.examples && c.examples.length) h += `<h3>Examples</h3>${codeBlock(c.examples)}`;
    if (c.afterHelpNotes) h += `<h3>Notes</h3>${codeBlock([c.afterHelpNotes])}`;
    h += `<p class="backlink">← <a href="#/domain/${c.domain}">Back to ${esc(dom ? dom.title : c.domain)}</a></p>`;
    return h;
  }

  function renderSearch() {
    const q = query.toLowerCase().trim();
    if (!q) return renderHome();
    const res = CAT.commands.filter((c) =>
      (
        c.path +
        " " +
        c.shortPath +
        " " +
        c.summary +
        " " +
        (c.mcpTool || "") +
        " " +
        c.flags.map((f) => (f.flag || "") + " " + f.name + " " + (f.description || "")).join(" ")
      )
        .toLowerCase()
        .includes(q)
    );
    let h = `<h1>Search</h1><p class="empty">${res.length} result${res.length === 1 ? "" : "s"} for “${esc(query.trim())}”</p>`;
    h += res.slice(0, 250).map((c) => cmdRow(c, true)).join("") || '<p class="empty">No matching commands.</p>';
    if (res.length > 250) h += `<p class="empty">Showing first 250 of ${res.length}.</p>`;
    return h;
  }

  // ── Router ─────────────────────────────────────────────────────────────────
  function render() {
    const hash = location.hash || "#/home";
    const parts = hash.replace(/^#\//, "").split("/");
    const route = parts[0];
    const arg = decodeURIComponent(parts.slice(1).join("/"));
    let html;
    switch (route) {
      case "":
      case "home": html = renderHome(); break;
      case "doc": html = docBySlug[arg] ? docBySlug[arg].html : notFound(); break;
      case "workflows": html = WF.index ? WF.index.html : notFound(); break;
      case "workflow": html = wfBySlug[arg] ? wfBySlug[arg].html : notFound(); break;
      case "domain": html = renderDomain(arg); break;
      case "cmd": html = renderCmd(arg); break;
      case "search": html = renderSearch(); break;
      default: html = notFound();
    }
    const content = $("#content");
    content.innerHTML = html;
    setActive(hash, route, arg);
    addCopyButtons();
    content.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function setActive(hash, route, arg) {
    let target = hash;
    if (route === "cmd") {
      const c = byId[arg];
      if (c) target = "#/domain/" + c.domain;
    }
    document.querySelectorAll(".navlink").forEach((a) => {
      a.classList.toggle("active", a.getAttribute("data-href") === target);
    });
  }

  function addCopyButtons() {
    document.querySelectorAll("#content pre").forEach((pre) => {
      if (pre.querySelector(".copybtn")) return;
      const b = document.createElement("button");
      b.className = "copybtn";
      b.type = "button";
      b.textContent = "Copy";
      b.addEventListener("click", () => {
        const code = pre.querySelector("code") || pre;
        const text = code.textContent;
        const done = () => { b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1200); };
        // Fallback for file:// / non-secure contexts where navigator.clipboard is blocked.
        const fallback = () => {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); done(); } catch { b.textContent = "Ctrl+C"; }
          document.body.removeChild(ta);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, fallback);
        } else {
          fallback();
        }
      });
      pre.appendChild(b);
    });
  }

  // ── Search box + theme ─────────────────────────────────────────────────────
  function bindSearch() {
    const input = $("#searchbox");
    input.addEventListener("input", () => {
      query = input.value;
      if (query.trim()) {
        if (location.hash !== "#/search") location.hash = "#/search";
        else render();
      } else if (location.hash === "#/search") {
        location.hash = "#/home";
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { input.value = ""; query = ""; location.hash = "#/home"; }
    });
  }
  function initTheme() {
    const saved = localStorage.getItem("gsadmin-theme");
    const initial =
      saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", initial);
    $("#themebtn").addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("gsadmin-theme", next);
    });
  }

  function init() {
    initTheme();
    buildSidebar();
    bindSearch();
    window.addEventListener("hashchange", render);
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
