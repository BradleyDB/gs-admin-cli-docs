<!-- GENERATED FILE — do not edit by hand. Regenerate with: npm run build:reference (build/build-reference.mjs). -->

# Auth & Config (`auth`)

Authentication and configuration. OAuth 2.1 PKCE with browser auto-enrollment; tokens are stored in the OS keychain, falling back to an AES-256-GCM encrypted file, then plaintext. Config lives at ~/.gs-admin/config.json.

**6 commands.** _Auth & config — CLI-only._

| Command | Summary | MCP tool |
|---------|---------|----------|
| [`gs-admin config`](#gs-admin-config) | Save base URL to ~/.gs-admin/config.json (credentials auto-enroll on login). | — |
| [`gs-admin login`](#gs-admin-login) | Authenticate via browser (OAuth 2.1 PKCE). Credentials auto-enroll on first login. | — |
| [`gs-admin logout`](#gs-admin-logout) | Remove stored tokens for the current environment (all backends). | — |
| [`gs-admin tokens backends`](#gs-admin-tokens-backends) | List token-storage backends in priority order; mark which is active. | — |
| [`gs-admin tokens migrate`](#gs-admin-tokens-migrate) | Move tokens from legacy ~/.gs-admin/tokens.json to the highest-available backend. | — |
| [`gs-admin whoami`](#gs-admin-whoami) | Show current auth status, storage backends, and token validity. | — |

---

### `gs-admin config`

Save base URL to ~/.gs-admin/config.json (credentials auto-enroll on login).

**MCP tool:** _none (CLI-only)_ · **Mutating:** yes ⚠️

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--base-url` | `string` |  | — | Tenant URL |

**Examples**

```bash
gs-admin config
```

### `gs-admin login`

Authenticate via browser (OAuth 2.1 PKCE). Credentials auto-enroll on first login.

**MCP tool:** _none (CLI-only)_ · **Mutating:** yes ⚠️

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--base-url` | `string` |  | — | Gainsight tenant URL (saved to config after success) |

**Examples**

```bash
gs-admin login
```

### `gs-admin logout`

Remove stored tokens for the current environment (all backends).

**MCP tool:** _none (CLI-only)_ · **Mutating:** yes ⚠️

**Flags**

| Flag | Type | Req | Default | Description |
|------|------|:---:|---------|-------------|
| `--base-url` | `string` |  | — | Tenant URL whose tokens to remove |

**Examples**

```bash
gs-admin logout
```

### `gs-admin tokens backends`

List token-storage backends in priority order; mark which is active.

**MCP tool:** _none (CLI-only)_ · **Mutating:** no

**Flags**

_No flags._

**Examples**

```bash
gs-admin tokens backends
```

### `gs-admin tokens migrate`

Move tokens from legacy ~/.gs-admin/tokens.json to the highest-available backend.

**MCP tool:** _none (CLI-only)_ · **Mutating:** yes ⚠️

**Flags**

_No flags._

**Examples**

```bash
gs-admin tokens migrate
```

### `gs-admin whoami`

Show current auth status, storage backends, and token validity.

**MCP tool:** _none (CLI-only)_ · **Mutating:** no

**Flags**

_No flags._

**Examples**

```bash
gs-admin whoami
```

