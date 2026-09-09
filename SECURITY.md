# Security Policy

This repo ships documentation plus the **gs-superadmin** Claude Code plugin, whose guard
hook sits in front of mutating `gs-admin` commands against real Gainsight tenants. That
hook is a safety boundary: weaknesses in it can translate directly into unreviewed
changes to someone's production CS instance, so security reports get priority over
everything else.

## Reporting a vulnerability

**Do not open a public issue.** Report privately via GitHub: **Security tab → "Report a
vulnerability"** on this repository (private security advisory). If private reporting is
unavailable to you, open an issue that says only "security report — please provide a
private channel", with no details of the vulnerability itself.

Include the affected file(s), a reproduction (the fixture harness in
`plugins/gs-superadmin/test/` is the right vehicle — see "Testing safely" below), and
what an attacker gains. You'll get an acknowledgment within a few days; this is a
solo-maintained project, so fixes land on a best-effort basis with severity deciding
order.

## What counts as a vulnerability here

In rough priority order:

1. **Guard bypass** — a mutating `gs-admin` command that reaches execution *without an
   approval prompt* inside a `.gs-superadmin/` workspace (encoding tricks, shell
   constructs the parser misreads, catalog states that silently drop asks).
2. **Privilege escalation via the hook** — any path where the hook grants an `allow`.
   By design it may only ever *add* an "ask"; the workspace-catalog trust model
   depends on that invariant.
3. **Injection via untrusted inputs** — `_manifest.json` values and workspace catalog
   copies arrive with cloned repos and are untrusted. Content that escapes the
   sanitization clamp into a permission prompt, or a hostile catalog that influences
   behavior beyond adding asks, is a vulnerability.
4. **Supply chain** — this repo has **zero runtime dependencies** by design (Node
   built-ins only; the one carve-out is two checker-only devDependencies,
   `typescript` + `@types/node`, that CI installs for the `tsc --noEmit` gate and
   nothing else loads — AGENTS.md tenet 5). Anything that causes code outside this
   repo, Node's standard library, and that type-checker to execute during build,
   test, or hook evaluation.
5. **Credential/config exposure** — anything that reads, writes, or leaks the real
   `~/.gs-admin/` config or keychain tokens outside the documented auth flow.

**Not vulnerabilities** (deliberate design — see the design tenets in
[AGENTS.md](AGENTS.md) before reporting):

- The hook **failing open when the hook itself errors**. Plain `gs-admin` use must
  never be broken by the plugin.
- An approval prompt appearing for a command you consider safe. Over-asking is an
  annoyance; under-asking is the vulnerability.
- Anything requiring the user to have already approved a malicious command at the
  prompt — the prompt *is* the security boundary.

## Testing safely

**Never test a suspected vulnerability against a real tenant or the real
`~/.gs-admin/`.** The fixture harness (`plugins/gs-superadmin/test/guard-fixtures.mjs`)
builds throwaway workspaces in the OS temp dir and pipes hook input over stdin — a
failing fixture is the ideal proof-of-concept to attach to a report.

## Supported versions

Only `main` and the latest published plugin version receive fixes. The plugin
marketplace doesn't pin versions, so users get fixes on their next update.
