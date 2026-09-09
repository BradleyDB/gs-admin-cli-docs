// ─────────────────────────────────────────────────────────────────────────────
// extract-catalog.mjs
//
// Reads the installed @gainsight/gs-admin-cli package and produces a single
// normalized catalog (data/catalog.json) describing EVERY capability:
//   - 8 artifact domains (JSON manifests → CLI commands + MCP tools)
//   - the 12-verb "Lane 2" runtime (curated from the package source)
//   - the 6 static auth/config commands
//
// Zero dependencies — Node built-ins only. Re-run after upgrading the CLI.
//
// Source of truth:
//   <pkg>/dist/artifacts/*.json              — domain manifests
//   <pkg>/dist/core/artifact/cli-generator.js — CLI id derivation (mirrored here)
//   <pkg>/dist/core/artifact/mcp-generator.js — MCP name derivation (mirrored here)
//   <pkg>/dist/core/runtime/cli-generator.js  — runtime verbs (curated below)
// ─────────────────────────────────────────────────────────────────────────────

// ── T-1 · Catalog shape (producer-owned contract) ────────────────────────────
/**
 * FROZEN (B5 P1, 2026-08-16; v2 B1, 2026-08-16; v3 B2, 2026-08-16 —
 * endpoints gain their observed `name` key; `char` recorded as
 * artifact-lane-only. Both found by the DS-18 conformance probes and
 * Bradley-approved in-session).
 * The catalog contract. Producer: this file (both lanes). Consumers: guard hook
 * (hand-synced copy — see its header), doc-lib findWorkspaceCatalog/
 * makeCommandResolver, describe-batch, domain-candidates, render-cheatsheet,
 * build-reference, build-wiki, build-plugin-gs-superadmin, check-stale-facts.
 *
 * @typedef {object} GsCatalog
 * @property {GsCatalogMeta}    meta
 * @property {GsGlobalFlag[]}   globalFlags
 * @property {GsCatalogDomain[]} domains
 * @property {GsCatalogCommand[]} commands
 *
 * @typedef {object} GsCatalogMeta
 * @property {string} _generated   GENERATED-banner sentence
 * @property {string} cliPackage
 * @property {string} cliVersion   the pin of record (meta.counts is the count of record)
 * @property {string} generatedAt  ISO timestamp
 * @property {string} pkgResolvedVia
 * @property {{domains:number, artifactCommands:number, runtimeCommands:number,
 *             staticCommands:number, totalCliCommands:number, mcpTools:number}} counts
 *
 * @typedef {object} GsGlobalFlag
 * @property {string} flag         e.g. "--format <fmt>" — a [<[] in the spelling
 *                                 marks a valued flag (makeCommandResolver keys on this)
 * @property {string} description
 *
 * @typedef {object} GsCatalogDomain
 * @property {string}   namespace
 * @property {string[]} aliases
 * @property {string}   title
 * @property {string}   description
 * @property {?string}  notes
 * @property {?string}  version
 * @property {object[]} groups
 * @property {number}   commandCount
 * @property {"artifact"|"runtime"|"static"} lane
 *
 * @typedef {object} GsCatalogCommand
 * @property {string}  id
 * @property {"artifact"|"runtime"|"static"} lane
 * @property {string}  domain
 * @property {string}  path        canonical spelling ("journey programs save")
 * @property {string}  shortPath   alias spelling ("jo p save") — may equal path.
 *                                 CONSUMERS: never key on path alone; the one
 *                                 shared key helper is the guard's cmdKey
 *                                 (F-277/F-284 — path ?? shortPath at EVERY site)
 * @property {?string} group
 * @property {?string} subGroup
 * @property {?string} subSubGroup
 * @property {string}  groupPath
 * @property {string[]} groupTitles
 * @property {string}  name
 * @property {string}  actionKey
 * @property {string}  summary
 * @property {string}  description
 * @property {boolean} mutating    the guard's ask signal. Upstream contract 1.0.8+:
 *                                 true iff the action can produce a server-side
 *                                 side effect regardless of HTTP verb. Schema
 *                                 defaults it FALSE — a new action can ship
 *                                 mislabeled (ask-overrides.json is the catcher)
 * @property {boolean} cliHidden
 * @property {?string} mcpTool     null on CLI-only commands (auth lane)
 * @property {boolean} mcpHidden
 * @property {?string} outputFormat
 * @property {GsCatalogFlagDef[]} flags
 * @property {string[]} examples
 * @property {?string}  afterHelpNotes
 * @property {Array<{name:string, method:string, path:string}>} endpoints
 *                                 name is "default" iff the entry came from
 *                                 the manifest's SINGULAR `endpoint` field;
 *                                 entries from the `endpoints` map take their
 *                                 map key. Entry COUNT is not the
 *                                 discriminator — a one-key map keeps its key
 *                                 (v3; wording corrected per F-287: 65 of 69
 *                                 single-entry actions at the pin are
 *                                 map-keyed)
 *
 * @typedef {object} GsCatalogFlagDef
 * @property {string}  name        without dashes
 * @property {string}  flag        with dashes
 * @property {?string} [char]      single-letter short alias — ARTIFACT-lane
 *                                 flags only (null-valued at the current pin);
 *                                 ABSENT on runtime/static-lane flags, whose
 *                                 emitter literals never write the key (v3)
 * @property {string}  type
 * @property {boolean} required    catalog DECLARATION — the CLI enforces at
 *                                 runtime; the two provably diverge (F-219)
 * @property {*}       default
 * @property {?string[]} enum
 * @property {boolean} csv
 * @property {string}  description
 * @property {boolean} cliExposed
 */

// ── T-6 · Dual-lane emitters ─────────────────────────────────────────────────
/**
 * FROZEN (B5 P1, 2026-08-16).
 * Lane contract (byte-identity is the seam): this file ≡
 * plugins/gs-superadmin/scripts/extract-catalog.mjs (generated verbatim copy —
 * build-plugin-gs-superadmin.mjs; pinned by CI rebuild-diff).
 * CLI: node extract-catalog.mjs [--out <path>]
 *   --out absent → <repo>/data/catalog.json (repo lane)
 *   --out <ws>/.gs-superadmin/catalog.json (setup lane, no repo checkout needed)
 * Resolution: npm root -g (execSync — npm is a .cmd shim on win32; F-121 guards
 * the failure), overridable via GS_ADMIN_PKG / gs-admin-explorer.config.json.
 * Output: GsCatalog (T-1), pretty-printed, UTF-8 no BOM.
 * render-cheatsheet.mjs (same pairing): catalog path in → markdown cheatsheet
 * out; body byte-identical across lanes (test-render-cheatsheet.mjs).
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// ── Resolve the installed package (portable; no hard-coded paths) ────────────
// Priority: 1) GS_ADMIN_PKG env  2) local git-ignored gs-admin-explorer.config.json
//           3) `npm root -g`/@gainsight/gs-admin-cli (default — works when globally installed).
function resolvePkgRoot() {
  if (process.env.GS_ADMIN_PKG) return { root: process.env.GS_ADMIN_PKG, via: "GS_ADMIN_PKG env" };
  const cfgPath = join(PROJECT_ROOT, "gs-admin-explorer.config.json");
  if (existsSync(cfgPath)) {
    let cfg;
    try {
      // Tolerate a leading UTF-8 BOM — the config is user-authored, and
      // PowerShell 5.1 editors/redirects routinely prepend one (F-118).
      cfg = JSON.parse(readFileSync(cfgPath, "utf8").replace(/^\uFEFF/, ""));
    } catch (e) {
      throw new Error(`Could not parse gs-admin-explorer.config.json: ${e.message}`);
    }
    if (cfg.pkgRoot) return { root: cfg.pkgRoot, via: "gs-admin-explorer.config.json" };
  }
  // npm absent or not on PATH must land in the friendly resolution-options
  // block below, not die here with a raw child_process stack (F-121): a path
  // that cannot exist makes the existsSync gate fail and print the guidance.
  let globalRoot;
  try {
    globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
  } catch (e) {
    console.error(`\n✗ Could not run \`npm root -g\` (${e.message ? String(e.message).split("\n")[0] : "unknown error"}) — is npm on PATH?`);
    globalRoot = join(PROJECT_ROOT, ".npm-root-unresolved");
  }
  return { root: join(globalRoot, "@gainsight", "gs-admin-cli"), via: "npm root -g" };
}
const { root: PKG_ROOT, via: PKG_VIA } = resolvePkgRoot();
const ARTIFACT_DIR = join(PKG_ROOT, "dist", "artifacts");
if (!existsSync(join(PKG_ROOT, "package.json"))) {
  console.error(
    `\n✗ Could not find @gainsight/gs-admin-cli at:\n    ${PKG_ROOT}\n\n` +
      `Install it globally:  npm i -g @gainsight/gs-admin-cli\n` +
      `…or point the extractor at it via one of:\n` +
      `  • the GS_ADMIN_PKG environment variable, or\n` +
      `  • a local gs-admin-explorer.config.json  { "pkgRoot": "/path/to/@gainsight/gs-admin-cli" }\n` +
      `    (copy gs-admin-explorer.config.example.json).\n`
  );
  process.exit(1);
}
const pkgJson = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8"));
const CLI_VERSION = pkgJson.version;

// ── Friendly domain titles ───────────────────────────────────────────────────
const DOMAIN_TITLES = {
  journey: "Journey Orchestrator",
  "rules-engine": "Rules Engine",
  "data-management": "Data Management",
  "data-designer": "Data Designer",
  connectors: "Connectors",
  scorecard: "Scorecard",
  report: "Report",
  query: "Query",
  runtime: "Lane 2 Runtime",
  auth: "Auth & Config",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalizeType(prop) {
  let t = prop.type;
  if (Array.isArray(t)) t = t.filter(Boolean).join(" | ");
  if (!t) t = prop.enum ? "string" : "any";
  return t;
}

// Mirror of core/artifact/oclif-flags.js → kebab() + flagNameFor().
// camelCase property name → kebab flag (e.g. maxWait → max-wait, wait → wait).
function kebab(name) {
  return name.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()).replace(/^-/, "");
}

// Mirror of core/artifact/cli-generator.js → buildCommandId (space form).
function buildPath(namespace, cli) {
  return [namespace, cli.group, cli.subGroup, cli.subSubGroup, cli.name]
    .filter(Boolean)
    .join(" ");
}

// Fully-aliased short form (e.g. "jo p src upload-csv"). Uses the first
// namespace alias and each group/action alias when present.
function buildShortPath(namespace, aliases, cli) {
  const ns = (aliases && aliases[0]) || namespace;
  return [
    ns,
    cli.groupAlias || cli.group,
    cli.subGroupAlias || cli.subGroup,
    cli.subSubGroupAlias || cli.subSubGroup,
    cli.name, // keep the readable action name (group aliases already shorten it)
  ]
    .filter(Boolean)
    .join(" ");
}

// Mirror of core/artifact/mcp-generator.js → tool naming.
function mcpName(namespace, actionKey, action) {
  return action.mcp?.name || `${namespace}_${actionKey}`.replace(/-/g, "_");
}

// Humanize a kebab segment ("close-cta" → "Close Cta") as a title fallback.
function humanize(seg) {
  return seg
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Extract `gs-admin ...` example lines from an afterHelp blob.
function parseExamples(afterHelp) {
  if (!afterHelp) return [];
  return afterHelp
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("gs-admin "));
}

// Synthesize a single usage line from required flags when no examples exist.
function synthesizeExample(shortPath, flags) {
  const req = flags.filter((f) => f.required && f.flag);
  const parts = req.map((f) => {
    if (f.type === "boolean") return f.flag;
    const ph = f.name.replace(/([A-Z])/g, "-$1").toLowerCase();
    return `${f.flag} <${ph}>`;
  });
  return `gs-admin ${shortPath}${parts.length ? " " + parts.join(" ") : ""}`;
}

function collectEndpoints(action) {
  const out = [];
  if (action.endpoint) {
    out.push({ name: "default", method: action.endpoint.method, path: action.endpoint.path });
  }
  if (action.endpoints) {
    for (const [name, ep] of Object.entries(action.endpoints)) {
      out.push({ name, method: ep.method, path: ep.path });
    }
  }
  return out;
}

// ── Build commands + domains from the 8 artifact manifests ───────────────────
const commands = [];
const domains = [];

const manifestFiles = readdirSync(ARTIFACT_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

// Fail loudly on an artifacts dir with no manifests (a wrong-but-existing
// package root, or a future CLI relocating them): exiting 0 here would emit a
// near-empty catalog that setup's workspace lane accepts and the mutation
// guard then prefers, turning every gs-admin command into an unrecognized ask.
if (manifestFiles.length === 0) {
  console.error(
    `\n✗ No artifact manifests (*.json) found in:\n    ${ARTIFACT_DIR}\n\n` +
      `The package at the resolved root (via ${PKG_VIA}) does not look like a usable\n` +
      `@gainsight/gs-admin-cli install. Reinstall it, or point the extractor at the\n` +
      `right root via GS_ADMIN_PKG / gs-admin-explorer.config.json.\n`
  );
  process.exit(1);
}

// groupDesc: "<namespace>\0<group-path>" -> friendly description (when declared
// by any action in the domain). Used for sidebar labels + command breadcrumbs.
const groupDesc = new Map();

for (const file of manifestFiles) {
  const m = JSON.parse(readFileSync(join(ARTIFACT_DIR, file), "utf8"));
  const namespace = m.namespace;
  const aliases = m.aliases || [];
  const groupPaths = new Set(); // every distinct group path (incl. prefixes)
  const domainCommands = [];

  for (const [actionKey, action] of Object.entries(m.actions || {})) {
    const cli = action.cli || {};
    const segs = [cli.group, cli.subGroup, cli.subSubGroup].filter(Boolean);
    const groupPath = segs.join("/");

    // Record any group descriptions this action declares, at each level.
    const lvlDesc = [cli.groupDescription, cli.subGroupDescription, cli.subSubGroupDescription];
    segs.forEach((_, i) => {
      const sub = segs.slice(0, i + 1).join("/");
      if (lvlDesc[i]) groupDesc.set(`${namespace}\u0000${sub}`, lvlDesc[i]);
      groupPaths.add(sub); // ensure the tree contains this path + all prefixes
    });

    // Flags from input.properties. The CLI exposes a flag for EVERY property
    // (deriving --kebab-name when x-cli.flag is absent); only x-cli.hidden
    // properties are CLI-excluded (still valid MCP/handler inputs).
    const required = new Set(action.input?.required || []);
    const flags = Object.entries(action.input?.properties || {}).map(([propName, prop]) => {
      const x = prop["x-cli"] || {};
      const hiddenFromCli = !!x.hidden;
      const flagName = x.flag ? x.flag.replace(/^--?/, "") : kebab(propName);
      return {
        name: propName,
        flag: hiddenFromCli ? null : "--" + flagName, // null => MCP/handler-only input
        char: x.alias ? x.alias.replace(/^-/, "") : null,
        type: normalizeType(prop),
        required: required.has(propName),
        default: prop.default ?? null,
        enum: prop.enum || null,
        csv: !!x.csv,
        description: prop.description || "",
        cliExposed: !hiddenFromCli,
      };
    });

    const shortPath = buildShortPath(namespace, aliases, cli);
    const examples = parseExamples(cli.afterHelp);
    if (examples.length === 0) examples.push(synthesizeExample(shortPath, flags));
    // afterHelp that is NOT a list of examples (e.g. CSV format docs) is kept as notes.
    const afterHelpNotes =
      cli.afterHelp && parseExamples(cli.afterHelp).length === 0 ? cli.afterHelp : null;

    domainCommands.push({
      id: [namespace, ...segs, cli.name].join(":"),
      lane: "artifact",
      domain: namespace,
      path: buildPath(namespace, cli),
      shortPath,
      group: cli.group || null,
      subGroup: cli.subGroup || null,
      subSubGroup: cli.subSubGroup || null,
      groupPath,
      _segs: segs,
      groupTitles: [], // filled below
      name: cli.name,
      actionKey,
      summary: action.summary || "",
      description: action.description || action.summary || "",
      mutating: !!action.mutating,
      cliHidden: !!cli.hidden,
      mcpTool: action.mcp?.hidden ? null : mcpName(namespace, actionKey, action),
      mcpHidden: !!action.mcp?.hidden,
      outputFormat: action.format?.default || null,
      flags,
      examples,
      afterHelpNotes,
      endpoints: collectEndpoints(action),
    });
  }

  // Resolve breadcrumb titles now that all of this domain's descriptions exist.
  const titleFor = (path) =>
    groupDesc.get(`${namespace}\u0000${path}`) || humanize(path.split("/").pop());
  for (const cmd of domainCommands) {
    cmd.groupTitles = cmd._segs.map((_, i) =>
      titleFor(cmd._segs.slice(0, i + 1).join("/"))
    );
    delete cmd._segs;
    commands.push(cmd);
  }

  domains.push({
    namespace,
    aliases,
    title: DOMAIN_TITLES[namespace] || namespace,
    description: m.description || "",
    notes: m.notes || null,
    version: m.version,
    groups: [...groupPaths].sort().map((p) => ({ path: p, title: titleFor(p) })),
    commandCount: domainCommands.length,
    lane: "artifact",
  });
}

// ── Lane 2 runtime (12 verbs) — curated from dist/core/runtime/*.js ───────────
// One curated command row (the RUNTIME and STATIC tables below):
//   [verb-or-path, mcpTool-or-id, description, [[flag, required, description], …]]
/** @typedef {[string, string, string, Array<[string, boolean, string]>]} CuratedCommandRow */
/** @type {CuratedCommandRow[]} */
const RUNTIME = [
  ["describe-asset-type", "runtime_describe_asset_type",
    "Describe a Gainsight asset type's capabilities and supported Lane 2 verbs.",
    [["--asset-type", true, "Asset type: JO, CONNECTORS, DATA_MANAGEMENT, RULES_ENGINE, SCORECARD"]]],
  ["describe-asset-schema", "runtime_describe_asset_schema",
    "Describe the input schema for creating/managing an asset. For read-only providers, pass --action-key to proxy to an artifact action.",
    [["--asset-type", true, "Asset type"], ["--category", false, "Category (e.g. DynamicProgram)"], ["--template", false, "Template (e.g. csv-email)"], ["--action-key", false, "Artifact action key (read-only providers)"]]],
  ["select-template", "runtime_select_template",
    "Select the best template for creating a new asset of the given type.",
    [["--asset-type", true, "Asset type"], ["--category", false, "Category"], ["--hints", false, "Free-text hints about what you're building"]]],
  ["create-draft", "runtime_create_draft",
    "Create a draft run for a new asset. Returns a runId that subsequent verbs reference. Does not call the Gainsight API — just initializes local run state.",
    [["--asset-type", true, "Asset type (e.g. JO)"], ["--category", false, "Category (e.g. DynamicProgram)"], ["--template", false, "Template (e.g. csv-email)"], ["--inputs", false, "JSON string or @file path with draft inputs"]]],
  ["validate-draft", "runtime_validate_draft",
    "Validate a draft run's inputs. Returns validation errors or draft_valid status.",
    [["--run-id", true, "Run ID from create-draft"]]],
  ["plan-run", "runtime_plan_run",
    "Show the execution plan for a run — what steps will be executed and in what order.",
    [["--run-id", true, "Run ID"]]],
  ["apply-run", "runtime_apply_run",
    "Execute the run — create the asset in Gainsight by running all pipeline steps. Persists progress after each step for resume capability.",
    [["--run-id", true, "Run ID"], ["--idempotency-key", false, "Idempotency key for safe retries"]]],
  ["resume-run", "runtime_resume_run",
    "Resume a blocked/failed run from where it left off.",
    [["--run-id", true, "Run ID of a resumable run"]]],
  ["get-run-status", "runtime_get_run_status",
    "Get the current status of a run — completed steps, pending steps, blockers.",
    [["--run-id", true, "Run ID"]]],
  ["list-runs", "runtime_list_runs",
    "List all stored runs, optionally filtered by asset type or status.",
    [["--asset-type", false, "Filter by asset type"], ["--status", false, "Filter by status"]]],
  ["clone-asset", "runtime_clone_asset",
    "Clone an asset from one environment to another. (Currently not implemented for any provider.)",
    [["--asset-type", true, "Asset type"], ["--source-id", true, "Source asset ID"], ["--target-base-url", false, "Target environment base URL"]]],
  ["export-support-bundle", "runtime_export_support_bundle",
    "Export a support bundle for a run — includes run state, trace, and created IDs (no secrets).",
    [["--run-id", true, "Run ID"], ["--out", false, "Output path (default: stdout as JSON)"]]],
];

for (const [verb, tool, description, flagDefs] of RUNTIME) {
  const flags = flagDefs.map(([flag, req, desc]) => ({
    name: flag.replace(/^--/, ""),
    flag,
    type: "string",
    required: req,
    default: null,
    enum: null,
    csv: false,
    description: desc,
    cliExposed: true,
  }));
  commands.push({
    id: `runtime:${verb}`,
    lane: "runtime",
    domain: "runtime",
    path: `runtime ${verb}`,
    shortPath: `runtime ${verb}`,
    group: null, subGroup: null, subSubGroup: null, groupPath: "", groupTitles: [],
    name: verb,
    actionKey: verb,
    summary: description,
    description,
    mutating: ["create-draft", "apply-run", "resume-run", "clone-asset"].includes(verb),
    cliHidden: true, // runtime:* commands are hidden in CLI help (MCP-facing)
    mcpTool: tool,
    mcpHidden: false,
    outputFormat: "json",
    flags,
    examples: [synthesizeExample(`runtime ${verb}`, flags)],
    afterHelpNotes: null,
    endpoints: [],
  });
}

domains.push({
  namespace: "runtime",
  aliases: [],
  title: DOMAIN_TITLES.runtime,
  description:
    "Lane 2 — a stateful asset-lifecycle engine (create-draft → validate → plan → apply → resume) with run persistence, idempotency, support bundles, and cross-environment cloning. CLI commands are hidden (runtime:*); primarily consumed as MCP tools.",
  notes: null,
  version: null,
  groups: [],
  commandCount: RUNTIME.length,
  lane: "runtime",
});

// ── Static auth/config commands (6) ──────────────────────────────────────────
/** @type {CuratedCommandRow[]} */
const STATIC = [
  ["login", "login", "Authenticate via browser (OAuth 2.1 PKCE). Credentials auto-enroll on first login.",
    [["--base-url", false, "Gainsight tenant URL (saved to config after success)"]]],
  ["logout", "logout", "Remove stored tokens for the current environment (all backends).",
    [["--base-url", false, "Tenant URL whose tokens to remove"]]],
  // v1.0.4's config command takes the base flags only: dist/commands/config.js
  // sets `static flags = {...BaseCommand.baseFlags}`. It accepts no OAuth flags
  // (credentials auto-enroll on login), so advertising --client-id /
  // --client-secret / --auth-url / --token-url here invented four flags the CLI
  // rejects — and made a model-constructible command line that would carry a
  // secret. Re-check this row when the documented CLI version changes.
  ["config", "config", "Save base URL to ~/.gs-admin/config.json (credentials auto-enroll on login).",
    [["--base-url", false, "Tenant URL"]]],
  ["whoami", "whoami", "Show current auth status, storage backends, and token validity.", []],
  ["tokens migrate", "tokens:migrate", "Move tokens from legacy ~/.gs-admin/tokens.json to the highest-available backend.", []],
  ["tokens backends", "tokens:backends", "List token-storage backends in priority order; mark which is active.", []],
];

for (const [path, id, description, flagDefs] of STATIC) {
  const flags = flagDefs.map(([flag, req, desc]) => ({
    name: flag.replace(/^--/, ""),
    flag,
    type: "string",
    required: req,
    default: null,
    enum: null,
    csv: false,
    description: desc,
    cliExposed: true,
  }));
  commands.push({
    id,
    lane: "static",
    domain: "auth",
    path,
    shortPath: path,
    group: null, subGroup: null, subSubGroup: null, groupPath: "", groupTitles: [],
    name: path,
    actionKey: id,
    summary: description,
    description,
    mutating: ["login", "logout", "config", "tokens migrate"].includes(path),
    cliHidden: false,
    mcpTool: null, // auth/config are CLI-only
    mcpHidden: true,
    outputFormat: null,
    flags,
    examples: [`gs-admin ${path}`],
    afterHelpNotes: null,
    endpoints: [],
  });
}

domains.push({
  namespace: "auth",
  aliases: [],
  title: DOMAIN_TITLES.auth,
  description:
    "Authentication and configuration. OAuth 2.1 PKCE with browser auto-enrollment; tokens are stored in the OS keychain, falling back to an AES-256-GCM encrypted file, then plaintext. Config lives at ~/.gs-admin/config.json.",
  notes: null,
  version: null,
  groups: [],
  commandCount: STATIC.length,
  lane: "static",
});

// ── Global flags (curated from README) ───────────────────────────────────────
const globalFlags = [
  { flag: "--base-url <url>", description: "Override the GS_BASE_URL / saved tenant URL." },
  { flag: "--format <fmt>", description: "Output format: table | json | detail | compact | ids | status." },
  { flag: "--json", description: "Shortcut for --format json (wins over --format)." },
  { flag: "--fields <a,b,c>", description: "Select output columns (matched against each action's fieldsCatalog)." },
  { flag: "--debug", description: "Enable framework debug output." },
  { flag: "--skip-version-check", description: "Skip the CLI/server version compatibility check." },
];

// ── Write catalog ────────────────────────────────────────────────────────────
const mcpToolCount = commands.filter((c) => c.mcpTool).length;
const catalog = {
  meta: {
    _generated: "GENERATED FILE — do not edit by hand. Regenerate with: npm run build:catalog (build/extract-catalog.mjs).",
    cliPackage: pkgJson.name,
    cliVersion: CLI_VERSION,
    generatedAt: new Date().toISOString(),
    pkgResolvedVia: PKG_VIA,
    counts: {
      domains: domains.length,
      artifactCommands: commands.filter((c) => c.lane === "artifact").length,
      runtimeCommands: commands.filter((c) => c.lane === "runtime").length,
      staticCommands: commands.filter((c) => c.lane === "static").length,
      totalCliCommands: commands.length,
      mcpTools: mcpToolCount,
    },
  },
  globalFlags,
  domains,
  commands,
};

// Output path: default data/catalog.json; overridable with --out <path> so the
// copy bundled inside the gs-superadmin plugin can generate the workspace catalog
// from the installed CLI without a checkout of this repo — setup's primary
// catalog source (the plugin's bundled snapshot is the fallback).
const outArg = process.argv.indexOf("--out");
const OUT_PATH =
  outArg !== -1 && process.argv[outArg + 1]
    ? process.argv[outArg + 1]
    : join(PROJECT_ROOT, "data", "catalog.json");
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(catalog, null, 2), "utf8");

console.log(`gs-admin catalog extracted (CLI v${CLI_VERSION})`);
console.table(catalog.meta.counts);
console.log(`→ ${OUT_PATH} (${commands.length} commands across ${domains.length} domains)`);
