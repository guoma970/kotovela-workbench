#!/bin/zsh

set -euo pipefail

TUNNEL_NAME="${KOTOVELA_CLOUDFLARE_TUNNEL_NAME:-kotovela-office-readonly}"
HOSTNAME="${KOTOVELA_CLOUDFLARE_HOSTNAME:-}"
SERVICE_URL="${KOTOVELA_CLOUDFLARE_SERVICE_URL:-http://127.0.0.1:8791}"
OVERWRITE_DNS="${KOTOVELA_CLOUDFLARE_OVERWRITE_DNS:-0}"
CONFIG_DIR="${HOME}/.config/kotovela"
ENV_FILE="${KOTOVELA_CLOUDFLARE_TUNNEL_ENV_FILE:-${CONFIG_DIR}/cloudflare-readonly-tunnel.env}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-cloudflared}"

shell_quote() {
  local value="$1"
  printf "'%s'" "${value//\'/\'\\\'\'}"
}

if [[ -z "$HOSTNAME" ]]; then
  echo "Error: KOTOVELA_CLOUDFLARE_HOSTNAME is required, for example office-api.example.com." >&2
  exit 64
fi

if ! command -v "$CLOUDFLARED_BIN" >/dev/null 2>&1; then
  echo "Error: cloudflared is not installed or not on PATH." >&2
  exit 69
fi

if ! "$CLOUDFLARED_BIN" tunnel list >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Error: cloudflared is not logged in for named tunnels.

Run this once and finish the browser authorization:

  cloudflared tunnel login

Then rerun this bootstrap command.
EOF
  exit 77
fi

if "$CLOUDFLARED_BIN" tunnel info "$TUNNEL_NAME" >/dev/null 2>&1; then
  echo "Cloudflare tunnel already exists: ${TUNNEL_NAME}"
else
  echo "Creating Cloudflare tunnel: ${TUNNEL_NAME}"
  "$CLOUDFLARED_BIN" tunnel create "$TUNNEL_NAME"
fi

ROUTE_ARGS=(tunnel route dns "$TUNNEL_NAME" "$HOSTNAME")
if [[ "$OVERWRITE_DNS" == "1" ]]; then
  ROUTE_ARGS=(tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$HOSTNAME")
fi

echo "Creating DNS route: ${HOSTNAME} -> ${TUNNEL_NAME}"
"$CLOUDFLARED_BIN" "${ROUTE_ARGS[@]}"

mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

TMP_ENV="$(mktemp "${CONFIG_DIR}/cloudflare-readonly-tunnel.env.tmp.XXXXXX")"
cat > "$TMP_ENV" <<EOF_ENV
export KOTOVELA_CLOUDFLARE_TUNNEL_NAME=$(shell_quote "$TUNNEL_NAME")
export KOTOVELA_CLOUDFLARE_HOSTNAME=$(shell_quote "$HOSTNAME")
export KOTOVELA_CLOUDFLARE_SERVICE_URL=$(shell_quote "$SERVICE_URL")
EOF_ENV
chmod 600 "$TMP_ENV"
mv "$TMP_ENV" "$ENV_FILE"
chmod 600 "$ENV_FILE"

cat <<EOF
Cloudflare read-only tunnel is ready.

Tunnel: ${TUNNEL_NAME}
Hostname: https://${HOSTNAME}
Service: ${SERVICE_URL}
Env file: ${ENV_FILE}

Next:
  ./scripts/install-cloudflare-readonly-tunnel-launchd.sh
  curl -fsS https://${HOSTNAME}/healthz
EOF
