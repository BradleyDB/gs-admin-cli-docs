# Connecting AI to Gainsight: gs-admin CLI + Plugin vs M2M OAuth

A practical guide for choosing between two approaches to giving an AI assistant (or
automation) access to your Gainsight tenant. If you are setting up a new integration,
this document will help you pick the right tool — and explain how to combine both when
you need to.

The "assisted" side of this comparison is a **stack**, not a single tool: the `gs-admin`
CLI is the foundation, and the **gs-superadmin Claude Code plugin** is an optional
layer on top that adds a per-tenant knowledge base, approval guardrails on writes, and
ready-made admin skills. You can adopt the foundation alone; the plugin assumes the
foundation.

---

## Quick answer

| What you're trying to do | Use this | Why |
|---|---|---|
| Interactive work with an AI assistant — explore schema, validate builds, inspect configs | **gs-admin CLI** | Typed tools, no credentials exposed to the model, purpose-built for AI |
| Ongoing tenant administration — impact analysis, reviewable change plans, audits, email/schedule reports | **CLI + gs-superadmin plugin** | Adds a local KB of your tenant, human approval on catalog-mutating commands, and a change journal |
| Automated pipelines, bulk data extraction, feeding a BI tool on a schedule | **M2M OAuth** | Service identity, runs headless, handles large data volumes |
| AI-assisted admin work AND automated data pipelines | **Plugin + M2M, side by side** | They serve different layers; neither replaces the other |

---

## What each approach is

### The gs-admin CLI (the foundation)

`gs-admin` is a Gainsight admin tool that runs in two modes from the same binary: a
command-line tool for humans, and — when an AI host like Claude launches it — an **MCP
server**, a process that accepts tool calls over a pipe and returns structured JSON
results. Either way it is the same CLI underneath, and this guide just calls it "the
CLI." The AI never sees a password or token; the CLI holds your credentials internally
and handles every API call on the model's behalf.

The action surface covers all eight Gainsight domains (Data Management, Journey
Orchestrator, Rules Engine, Scorecards, and more), exposed two ways from the same
handlers: **182 named operations** as MCP tools, and **188 CLI commands**. The AI knows
exactly what each action does, what parameters it takes, and what it returns. In MCP
mode it cannot call anything outside that defined set; when it drives the CLI through a
shell instead, what constrains it is the AI host's permission model rather than a tool
schema — the prompt-injection section below is precise about the difference.

Authentication uses the PKCE flow: a human logs in once via `gs-admin login`, and tokens
are stored in the OS keychain. No persistent secret to store or rotate.

### The gs-superadmin plugin (the workspace layer)

The [gs-superadmin plugin](../plugins/gs-superadmin/README.md) is a Claude Code plugin
that turns the raw CLI into a persistent, per-tenant admin workspace. It drives the same
`gs-admin` binary and inherits its auth story — it adds no credentials of its own. On
top of the foundation it provides:

- **A local knowledge base of your tenant.** Setup indexes every rule, journey,
  scorecard, report, connector, and data designer, and documents them as markdown the
  AI can cite. Questions like "which rules write to the Company object?" are answered
  from documented facts, not guesses.
- **A safety net on writes.** Every command the CLI catalog marks as mutating triggers
  a **human approval prompt** before it runs; reads run freely. Approved changes are
  recorded in a **change journal**, and change-request work is traceable back to the
  originating ticket. Read the plugin README's "How the plugin protects your tenant"
  section before you lean on this: the gate follows the catalog's `mutating` flag, and
  that flag is not the same thing as "writes to the tenant" — the commands it mislabels
  are neither prompted nor journaled, and the skills that use them carry their own
  approval step instead.
- **Everyday admin skills.** Reviewable change plans built from KB citations,
  tenant-wide dependency/impact analysis ("what breaks if I change this field?"),
  Journey Orchestrator email & schedule reports, naming audits, drift detection, and
  vendor-ready CLI bug reports.

> **One honest scoping note:** the CLI's MCP mode works with any MCP-capable host, but
> the plugin layer (guard, KB, skills) is specific to **Claude Code**.

### M2M OAuth (direct API)

Machine-to-machine (M2M) OAuth uses a **client ID and client secret** that you generate
in Gainsight's Connectors 2.0 settings. Your program trades those credentials for a
short-lived Bearer token, then calls the Gainsight REST API directly on every request.

The program — whether a Python script, a dbt model, or an AI assistant — handles the
token and constructs each API call itself. There is no defined tool surface: the program
can call any Gainsight endpoint that the authorizing admin's permissions allow.

This is the right model for **automated, headless integrations** — scheduled jobs, ETL
pipelines, BI connectors — where no human is present at runtime.

---

## Side-by-side comparison

| | gs-admin CLI + plugin | M2M OAuth (direct API) |
|---|---|---|
| **How it's invoked** | AI host launches the process; model calls named tools (or runs CLI commands) | HTTP client calls the Gainsight REST API with a Bearer token |
| **Auth flow** | PKCE — human logs in once, tokens in OS keychain | Client credentials — program holds client ID + secret, exchanges for token |
| **Who drives it** | An AI assistant interactively, with a human approving writes | A script, pipeline, or AI assistant with the token in context |
| **Credentials to manage** | None persistent — PKCE has no client secret | Client secret (long-lived; must be stored securely and rotated) |
| **Credential visible to the AI** | No — the CLI holds it internally | Potentially yes — the token may be in the model's context |
| **Tool/endpoint surface** | 182 MCP tools with typed input schemas (188 CLI commands for the same actions) | Any Gainsight REST endpoint within the authorizing admin's permissions |
| **Guardrails on writes** | With the plugin: every catalog-mutating command asks a human first and is journaled — but the catalog mislabels part of the write surface, and those commands do neither | None built in — whatever your program enforces |
| **Tenant context available to the AI** | With the plugin: a documented local KB of every asset, citable and grep-able | None — each call starts from zero |
| **Bulk data extraction** | Limited — spot queries, 50-row default, manual pagination | Full control — stream, paginate, and land data wherever you need |
| **Runs headless (no human)** | No — PKCE requires an initial human login; the plugin's write guard assumes a human | Yes — designed for service-to-service with no user present |
| **Audit log identity** | Logged as the admin who authenticated; the plugin adds a local change journal, tied to tickets, covering the commands it prompts on | Logged as the connector/app name |

---

## Use-case guide

### Exploring your data architecture — objects, fields, schema

**Use the gs-admin CLI.**

There is a single tool, `data_management_list_and_describe_objects`, that lists every
object in your tenant and returns full field metadata for each in one call. The AI can
reason over that output immediately — naming fields, describing types, surfacing
dropdowns. This is exactly what the tool was built for. Doing the same with M2M would
require you to discover and chain multiple API endpoints yourself.

Why the bare CLI and not the plugin? Schema questions want **live tenant state**, and
the CLI answers from the live API in one call — the plugin's KB is a documented
snapshot, which is the wrong source of truth for "what does this field look like right
now." The plugin still adds value *around* the lookup — if the KB is built, the AI can
also cite what each object is used by — but the lookup itself needs nothing beyond the
CLI.

### Build validation

**Use the gs-admin CLI.**

Validating a build means asking questions: does this object have the right fields? What
depends on it? Is this rule configured correctly? The AI calls tools like
`data_management_describe_object` or `data_management_object_dependencies` and reasons
over the results. This is interactive, AI-assisted work — the CLI's defined tool
surface is the right fit.

Same reasoning as schema exploration: validation checks **live config**, so the CLI is
the source of truth and needs no layer on top. Add the plugin when validation grows
into an ongoing practice — its KB gives you a documented baseline to diff against, and
the `refresh` skill turns one-off validation into drift detection.

### Impact analysis before a change

**Use the gs-superadmin plugin.**

"What breaks if I rename this field?" is a cross-domain question — rules, reports,
journeys, connector jobs, and data designers can all depend on one object or field. The
plugin's `deps-report` skill answers it from the indexed KB in one pass, naming every
documented dependent with its dependency kind and status, and can reconcile against the
CLI's live dependency check. Raw CLI calls can fetch the pieces, but the plugin has
already assembled and documented them.

### Executing a config change with review

**Use the gs-superadmin plugin.**

The `change-request` skill turns a ticket or a prose request into a reviewable
implementation plan with KB citations — impacted assets, exact command sequence,
test-mode verification, rollback — and executes it only step by step, with the journal
recording what actually ran. The plan itself is the gate: it names which of its commands
will hit the mutation-guard prompt and which will not, so approving it is an informed
decision rather than a rubber stamp. This is the workflow gap that raw tool access
leaves open: capable hands, no process.

### Recurring admin reporting — emails, schedules, naming drift

**Use the gs-superadmin plugin.**

Read-only questions admins answer weekly — "which emails mention this phrase?", "what's
scheduled to send right now?", "which assets violate our naming convention?" — are
packaged as skills (`email-report`, `audit`, `refresh`) that produce markdown/CSV
reports from the KB. No pipeline to build, nothing mutated.

### Surfacing Gainsight data for external dashboards and decks

**Use M2M OAuth.**

This is a data extraction job, not an AI reasoning job. You need to pull records from
Gainsight, often in volume, on a schedule or on demand. The M2M approach gives you full
control over pagination, field selection, and where the data lands. The CLI's query
tool works for spot checks but is not designed for bulk extraction pipelines.

### Combining Gainsight data with data from other platforms

**Use M2M OAuth.**

Joining Gainsight data with your CRM, data warehouse, or another platform is a pipeline
problem. The right tool is a script or transformation layer (Python, dbt, etc.) that
pulls data from each source and combines them. M2M credentials drop cleanly into any
HTTP client. The gs-admin CLI is not designed for this layer.

### Building a data dictionary

**Split: plugin + M2M.**

To *build* the dictionary — exploring objects, understanding field types, reading
descriptions, identifying relationships — use the gs-admin CLI (or let the plugin's KB
do it as a by-product of setup: the indexed, documented asset base *is* a data
dictionary the AI maintains).

To *sync* that dictionary to a BI platform or share it as a live artifact, write a
small M2M script that pulls the same metadata on a schedule and pushes it to your
catalog tool. That part runs headless, with no AI needed.

---

## Security comparison

### The most important difference: what credential exists

The CLI's PKCE flow **has no client secret**. There is nothing persistent to steal,
rotate, or accidentally commit to a repository. Tokens live in the OS keychain (the most
secure option) or an encrypted local file. The plugin adds no credentials of its own.

M2M OAuth has a client secret that must live somewhere — a `.env` file, a secrets vault,
or environment variables. If it leaks, anyone can mint tokens until you rotate it.
Rotation requires updating every integration that uses that secret.

### What the AI can see

With the gs-admin CLI, the AI model **never sees a token**. The CLI holds credentials
internally and only surfaces tool results. Nothing in the model's context can be echoed
back, logged, or extracted by an adversarial prompt.

With M2M OAuth, if the Bearer token is in the model's context (so the AI can attach it
to requests), it is also in any logs, in any output the model produces, and reachable by
a prompt injection attack.

### Prompt injection risk

This is a practical concern when AI assistants call APIs on your behalf.

In **MCP mode**, the AI can only call the 182 MCP tools with their defined parameters. A
malicious prompt that tries to get the AI to "call this other endpoint" simply cannot
succeed — that endpoint is not in the tool surface. That guarantee is real, and it is a
property of the MCP transport.

Be precise about the other path, because it is the one the plugin uses: when the AI
drives `gs-admin` as a **shell command**, it is composing command lines, and a shell is
not a constrained surface. What limits it there is the AI host's own permission model
plus the plugin's guard — not a typed tool schema. If the typed-surface guarantee is the
property you are buying, run the CLI in MCP mode.

The plugin adds a second, independent layer: a command the catalog marks **mutating**
cannot run without a **human approving that specific command** at a prompt showing
exactly what will execute. A prompt-injected `sc update` has to get past a person, not
just a schema. Commands the catalog doesn't recognize are treated as potentially
mutating and ask too (fail-closed), so a newer CLI's mutations don't slip through
silently.

The limit worth knowing before you rely on it: the guard reads the catalog's `mutating`
flag. Since CLI 1.0.8 that flag is a written contract in the CLI's own artifact schema
(true iff the action can produce a server-side side effect, regardless of HTTP verb),
and upstream closed the class this paragraph used to warn about: commands flagged
non-mutating while declaring a PUT/DELETE/PATCH endpoint went 29 → 0 at 1.0.8, the
`re r` rule-authoring and scheduling surface and `dd t` template edits all prompt from
the catalog now, and at v1.0.9 the 20 non-mutating commands still carrying a POST
endpoint are read-shaped fetches (list/describe/fetch-data/validate) reviewed
command-by-command upstream. The residual risk is a future mislabel, not a standing population: the guard
fail-closes on unknown commands, and a hand-maintained ask-override list (empty since
1.0.8; the mechanism is kept) forces the prompt on any newly verified mislabel.
The guard is a layer of risk reduction at the command-parsing level, not a boundary.

With M2M OAuth (direct), the AI can call any endpoint within scope. A crafted input
could, in principle, redirect it to a destructive operation it was never intended to
reach.

### Audit trail

| | gs-admin CLI + plugin | M2M OAuth |
|---|---|---|
| **Appears in Gainsight logs as** | The admin who ran `gs-admin login` | The connector app name |
| **Human accountability** | Yes — tied to a named user; the plugin journal ties each prompted change to the approving session and, for planned work, the originating ticket | No — service identity only |
| **Best for** | Interactive admin work with a person in the loop | Automated pipelines where service identity is correct |

### Summary

| Risk | gs-admin CLI + plugin | M2M OAuth |
|---|---|---|
| Persistent credential to protect | None | Client secret |
| Token visible to the AI model | No | Potentially yes |
| Blast radius of a leaked credential | None (no persistent secret) | Anyone can mint tokens until rotated |
| Rogue AI behavior | In MCP mode, constrained to the 182 MCP tools; over a shell, constrained by the AI host's permission model. With the plugin, catalog-mutating commands additionally require per-command human approval and are journaled | Can reach any endpoint in scope |

---

## Using the plugin and M2M together

The two approaches are not competitors — they serve different layers. The right
architecture uses both, each where it fits.

### For AI-assisted work: two tool sets, one AI

Register **gs-admin** and a small custom M2M-powered server as MCP servers in your AI
host config. The AI sees a combined tool surface and routes automatically based on what
each tool does — no explicit decision logic needed.

- **gs-admin tools** handle schema inspection, config validation, admin operations,
  and anything in the eight Gainsight domains.
- **A small custom M2M-powered server** exposes bulk query and export tools backed by
  your M2M credentials.

The AI calls the right tool for the job. You don't have to tell it which one to use.

The gs-superadmin plugin is not part of that config. It is a **Claude Code plugin**, not
an MCP server — you install it from the plugin marketplace, not under `mcpServers` — and
you layer it on in Claude Code when you want the KB, the approval guard, and the admin
skills. One caveat if you run both lanes: mutating MCP tool calls do trigger the guard's
approval prompt, but the change journal covers the **CLI lane only**, so an approved
mutation made through an MCP tool is prompted and not journaled.

### For automated pipelines: M2M stays outside Claude

Scheduled BI feeds, nightly exports, and ETL jobs run as scripts with M2M credentials.
Claude is not involved. These pipelines are stable, auditable, and don't need AI
judgment to run correctly.

### The combined config (example)

```json
{
  "mcpServers": {
    "gs-admin": {
      "command": "gs-admin",
      "env": { "GS_BASE_URL": "https://your-tenant.gainsightcloud.com" }
    },
    "gs-data": {
      "command": "node",
      "args": ["gs-data-server.js"],
      "env": {
        "GS_BASE_URL": "https://your-tenant.gainsightcloud.com",
        "GS_CLIENT_ID": "your-client-id",
        "GS_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

`gs-data-server.js` is a small custom MCP server — roughly 200 lines — that holds your
M2M credentials, manages token refresh, and exposes tools like `gainsight_bulk_query`
and `gainsight_export_object`. The AI never sees the credentials directly.

---

## Recommendation

Start with **the gs-admin CLI, read-only**. It covers schema exploration, build
validation, config inspection, and interactive data dictionary work without requiring
you to manage any credentials beyond an initial login.

If you administer the tenant day to day from Claude Code, add the **gs-superadmin
plugin** next: one setup run builds the tenant KB, and from then on impact analysis,
change plans, audits, and email reports run against documented facts — with
catalog-mutating commands gated behind an approval prompt and journaled.

It is still the better path to *adding write access safely* — a documented KB, an
approval step inside every write-capable skill, and a change journal beat an unguarded
read-write surface. Its guard also got stronger at CLI 1.0.8: upstream fixed the
mislabeled-writer class (29 strict cases → 0), so every verified writer now prompts
from the catalog itself, and at v1.0.9 the 20 non-mutating commands still carrying
POST endpoints are read-shaped fetches reviewed upstream. Adopt it knowing the guard is
command-parsing risk reduction plus a fail-closed prompt on unknown commands, not a
boundary — the skills that drive writes still make their own approval step the gate.
The plugin README's "How the plugin protects your tenant" section has the details.

Once you have validated your use cases, add **M2M OAuth** specifically for bulk data
extraction and any automated pipeline that needs to run without a human present. Create
one M2M application per integration — not one shared key — so you can rotate or revoke
any single one without disrupting the others.

Treat the M2M client secret like a password: store it in a secrets vault or local
`.env` file, never in a shared document, a support ticket, or a chat message.

---

*Keep your M2M client secret private. Anyone who has it can authenticate as that connector.*
