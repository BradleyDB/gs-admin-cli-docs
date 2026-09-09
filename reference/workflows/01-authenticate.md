# Workflow: Authenticate & verify

Goal: get a working session against your tenant so every other command/tool just works.

## 1. Log in (browser OAuth, one time per machine)

```bash
gs-admin --base-url https://your-company.gainsightcloud.com login
```

A browser tab opens, you authenticate, and a PKCE exchange stores your token. The
`base_url` is saved to `~/.gs-admin/config.json`, so you can drop `--base-url` afterwards.

## 2. Confirm

```bash
gs-admin whoami
```

Expect to see your base URL, `Auth mode: OAuth PKCE`, the active **secret/token store**
(OS keychain if available), and a valid token with an expiry.

## 3. Know your storage (optional)

```bash
gs-admin tokens backends     # which backends exist, and which is active
gs-admin tokens migrate      # move legacy ~/.gs-admin/tokens.json into the best backend
```

## 4. Smoke test a read

```bash
gs-admin dm objects list --limit 5
```

If this returns rows, you're ready for any workflow.

## Troubleshooting

- **"No authentication configured"** → re-run `login`.
- **CORS / callback errors** → the tenant OAuth app needs origin `http://localhost:19876`
  and callback `http://localhost:19876/callback` (see [../auth.md](../auth.md)).
- **Version-mismatch block** → `npm i -g @gainsight/gs-admin-cli@latest`, or bypass once
  with `--skip-version-check`.

Next: [Build a JO program](02-build-jo-program.md).
