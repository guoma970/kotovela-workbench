# Kotovela Hub Office Read-only Gateway

This gateway is the public-facing safety layer for live internal data.

It must be used instead of exposing the full local `office-api` when a tunnel is reachable from the public internet.

## What It Exposes

Allowed read-only paths:

- `GET /api/office-instances`
- `GET /api/model-usage`
- `GET /api/tasks-board`

Guard behavior:

- Missing or wrong bearer token returns `401`.
- Write methods return `405`.
- Non-allowlisted API paths return `404`.

## Local Services

The full office API should stay local-only:

```bash
OFFICE_API_HOST=127.0.0.1 OFFICE_API_PORT=8787 ./scripts/install-office-api-launchd.sh
```

The public tunnel should point to the read-only gateway:

```bash
OFFICE_READONLY_GATEWAY_PORT=8791 ./scripts/install-office-readonly-gateway-launchd.sh
```

Both services are user-level launchd agents:

- `com.kotovela.office-api`
- `com.kotovela.office-readonly-gateway`

Runtime secrets are stored outside the repository under `~/.config/kotovela/` and must not be committed.

## Vercel Upstream

Vercel should point only to the tunnel URL for the read-only gateway:

- `OFFICE_INSTANCES_UPSTREAM_URL=https://<tunnel-host>/api/office-instances`
- `MODEL_USAGE_UPSTREAM_URL=https://<tunnel-host>/api/model-usage`
- `OFFICE_INSTANCES_UPSTREAM_TOKEN=<read-only gateway token>`
- `MODEL_USAGE_UPSTREAM_TOKEN=<read-only gateway token>`
- `OFFICE_INSTANCES_UPSTREAM_ALLOW_HOSTS=<tunnel-host>`
- `MODEL_USAGE_UPSTREAM_ALLOW_HOSTS=<tunnel-host>`
- `INTERNAL_API_UPSTREAM_ALLOW_HOSTS=<tunnel-host>`

After any upstream variable change, redeploy the Vercel production project.

## Current Recommendation

For a stable fixed HTTPS upstream, prefer a Cloudflare named tunnel pointing to `http://127.0.0.1:8791`.

Temporary quick tunnels can restore live data quickly, but their hostnames can change and they do not provide uptime guarantees.
