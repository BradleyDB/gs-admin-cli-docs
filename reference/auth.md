# Authentication & configuration

`gs-admin` authenticates with **OAuth 2.1 PKCE** and **auto-enrollment** — no client
ID/secret to copy. The same credentials serve both the CLI and the MCP server.

## One-time login

```bash
gs-admin --base-url https://your-company.gainsightcloud.com login
```

1. A browser tab opens your tenant's OAuth enrollment page.
2. After you log in, the CLI fetches OAuth client credentials automatically and completes
   a PKCE token exchange (loopback callback `http://localhost:19876/callback`).
3. The access token is stored securely (see backends below).
4. `base_url` is saved to `~/.gs-admin/config.json`, so later commands don't need `--base-url`.

The OAuth app in the tenant needs **scopes `read`, `write`**, **PKCE enabled**, and callback
`http://localhost:19876/callback`.

## Verify

```bash
gs-admin whoami
```

Shows base URL, auth mode, config path, the active **secret store** and **token store**,
and token validity/expiry.

## Token storage backends (priority order)

Resolved by `dist/core/auth/**`; the first available wins:

| Priority | Backend | File |
|---|---|---|
| 1 | **OS keychain** (macOS Keychain / Windows Credential Manager / libsecret) via `@napi-rs/keyring` | `keychain-store.js` |
| 2 | **AES-256-GCM encrypted file** | `encrypted-file-store.js` |
| 3 | **Plaintext file** (last resort) | `plaintext-file-store.js` |

Inspect and migrate:

```bash
gs-admin tokens backends    # list backends in priority order; mark the active one
gs-admin tokens migrate     # move tokens from legacy ~/.gs-admin/tokens.json to the best backend
```

## Config & environment

- Config file: `~/.gs-admin/config.json` (holds `base_url`, optional OAuth settings).
- `gs-admin config --base-url … [--client-id … --client-secret … --auth-url … --token-url …]`
  writes config explicitly (rarely needed thanks to auto-enrollment).
- Environment variables: `GS_BASE_URL` (tenant URL), `GS_SKIP_VERSION_CHECK=1`.
  Set them per shell: `export GS_BASE_URL=https://…` (bash/zsh) or
  `$env:GS_BASE_URL = 'https://…'` (PowerShell) — both last for the current session only.

## Token refresh & expiry

As of v1.0.10 the CLI **never refreshes a token, on any path** — a token is used for its
whole lifetime as issued (about an hour) less one minute, then:

- **Enrollment path** (the default — no `client_id`/`client_secret` stored): commands fail
  with "Access token has expired. Run `gs-admin login` to re-authenticate." Re-run
  `gs-admin login`. `whoami` can still report the token valid for that last minute.
- **Credentialed path** (`client_id` and `client_secret` stored via `gs-admin config`): an
  expired token opens the interactive browser login from inside whatever command needed
  it, which waits up to five minutes for the callback — there is no silent refresh here
  either.
- **A running MCP server** keeps the token it loaded and never re-reads the token store,
  so after a re-login, restart the server (reconnect it in your MCP client).
- `"No authentication configured"` → run `gs-admin login`.

History: CLI 1.0.7 through 1.0.9 attempted a silent refresh at half the token's lifetime.
On the enrollment path it needed the OAuth app's client secret from a lookup most users
cannot read, so it usually failed ("Token expired and silent refresh failed") and half of
every token was unusable. The gs-superadmin plugin's token pre-flight still carries that
rule for workspaces on those versions.

## Logout / uninstall

```bash
gs-admin --base-url https://your-company.gainsightcloud.com logout   # remove tokens (all backends) for that tenant
rm -rf ~/.gs-admin                                                   # remove all local config + state
```

The `rm` line is bash. In PowerShell (where `~` does not reliably expand — use `$HOME`):

```powershell
Remove-Item -Recurse -Force "$HOME\.gs-admin"   # remove all local config + state
```

See also: [mcp.md](mcp.md) (the MCP server reuses this exact auth) and the
[Authenticate workflow](workflows/01-authenticate.md).
