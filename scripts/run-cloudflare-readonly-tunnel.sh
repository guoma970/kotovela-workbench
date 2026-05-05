#!/bin/zsh

set -euo pipefail

ENV_FILE="${KOTOVELA_CLOUDFLARE_TUNNEL_ENV_FILE:-${HOME}/.config/kotovela/cloudflare-readonly-tunnel.env}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-cloudflared}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

TUNNEL_NAME="${KOTOVELA_CLOUDFLARE_TUNNEL_NAME:-kotovela-office-readonly}"
SERVICE_URL="${KOTOVELA_CLOUDFLARE_SERVICE_URL:-http://127.0.0.1:8791}"
TUNNEL_TOKEN="${KOTOVELA_CLOUDFLARE_TUNNEL_TOKEN:-}"

if ! command -v "$CLOUDFLARED_BIN" >/dev/null 2>&1; then
  echo "Error: cloudflared is not installed or not on PATH." >&2
  exit 69
fi

if [[ -n "$TUNNEL_TOKEN" ]]; then
  exec "$CLOUDFLARED_BIN" tunnel \
    --edge-ip-version 4 \
    --no-autoupdate \
    run --token "$TUNNEL_TOKEN"
fi

exec "$CLOUDFLARED_BIN" tunnel \
  --edge-ip-version 4 \
  --no-autoupdate \
  --url "$SERVICE_URL" \
  run "$TUNNEL_NAME"
