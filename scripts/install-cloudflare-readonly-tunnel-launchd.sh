#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LABEL="com.kotovela.cloudflare-readonly-tunnel"
AGENT_DIR="${HOME}/Library/LaunchAgents"
PLIST_PATH="${AGENT_DIR}/${LABEL}.plist"
LOG_DIR="${REPO_DIR}/logs"
CONFIG_DIR="${HOME}/.config/kotovela"
ENV_FILE="${KOTOVELA_CLOUDFLARE_TUNNEL_ENV_FILE:-${CONFIG_DIR}/cloudflare-readonly-tunnel.env}"
USER_DOMAIN="gui/$(id -u)"
LAUNCHCTL_BIN="${LAUNCHCTL_BIN:-launchctl}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-cloudflared}"

xml_escape() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  printf '%s' "$value"
}

shell_quote() {
  local value="$1"
  printf "'%s'" "${value//\'/\'\\\'\'}"
}

restore_previous_plist() {
  local backup_path="$1"
  local had_previous="$2"

  "$LAUNCHCTL_BIN" bootout "$USER_DOMAIN" "$PLIST_PATH" 2>/dev/null || true
  "$LAUNCHCTL_BIN" bootout "${USER_DOMAIN}/${LABEL}" 2>/dev/null || true

  if [[ "$had_previous" == "1" && -f "$backup_path" ]]; then
    cp "$backup_path" "$PLIST_PATH"
    "$LAUNCHCTL_BIN" bootstrap "$USER_DOMAIN" "$PLIST_PATH" 2>/dev/null || \
      echo "Warning: restored previous plist but could not bootstrap previous service; inspect ${PLIST_PATH}" >&2
  else
    rm -f "$PLIST_PATH"
  fi
}

if ! command -v "$CLOUDFLARED_BIN" >/dev/null 2>&1; then
  echo "Error: cloudflared is not installed or not on PATH." >&2
  exit 69
fi

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

TUNNEL_NAME="${KOTOVELA_CLOUDFLARE_TUNNEL_NAME:-kotovela-office-readonly}"
HOSTNAME="${KOTOVELA_CLOUDFLARE_HOSTNAME:-}"
SERVICE_URL="${KOTOVELA_CLOUDFLARE_SERVICE_URL:-http://127.0.0.1:8791}"

if ! "$CLOUDFLARED_BIN" tunnel info "$TUNNEL_NAME" >/dev/null 2>&1; then
  cat >&2 <<EOF
Error: Cloudflare tunnel is not ready: ${TUNNEL_NAME}

First run:

  KOTOVELA_CLOUDFLARE_HOSTNAME=<fixed-hostname> ./scripts/bootstrap-cloudflare-readonly-tunnel.sh
EOF
  exit 77
fi

mkdir -p "$AGENT_DIR" "$LOG_DIR" "$CONFIG_DIR"
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

TMP_PLIST="$(mktemp "${AGENT_DIR}/${LABEL}.plist.tmp.XXXXXX")"
BACKUP_PLIST="$(mktemp "${AGENT_DIR}/${LABEL}.plist.backup.XXXXXX")"
HAD_PREVIOUS=0
cleanup() {
  rm -f "$TMP_PLIST" "$BACKUP_PLIST"
}
trap cleanup EXIT

if [[ -f "$PLIST_PATH" ]]; then
  cp "$PLIST_PATH" "$BACKUP_PLIST"
  HAD_PREVIOUS=1
fi

cat > "$TMP_PLIST" <<EOF_PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$(xml_escape "$LABEL")</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$(xml_escape "${REPO_DIR}/scripts/run-cloudflare-readonly-tunnel.sh")</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(xml_escape "$REPO_DIR")</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$(xml_escape "${LOG_DIR}/cloudflare-readonly-tunnel.log")</string>
  <key>StandardErrorPath</key>
  <string>$(xml_escape "${LOG_DIR}/cloudflare-readonly-tunnel.error.log")</string>
</dict>
</plist>
EOF_PLIST

plutil -lint "$TMP_PLIST" >/dev/null

"$LAUNCHCTL_BIN" bootout "$USER_DOMAIN" "$PLIST_PATH" 2>/dev/null || true
"$LAUNCHCTL_BIN" bootout "${USER_DOMAIN}/${LABEL}" 2>/dev/null || true
cp "$TMP_PLIST" "$PLIST_PATH"
chmod 600 "$PLIST_PATH"

if ! "$LAUNCHCTL_BIN" bootstrap "$USER_DOMAIN" "$PLIST_PATH"; then
  echo "Error: launchctl bootstrap failed; restoring previous launchd plist/service state." >&2
  restore_previous_plist "$BACKUP_PLIST" "$HAD_PREVIOUS"
  exit 1
fi

"$LAUNCHCTL_BIN" enable "${USER_DOMAIN}/${LABEL}" || true
if ! "$LAUNCHCTL_BIN" kickstart -k "${USER_DOMAIN}/${LABEL}"; then
  echo "Error: launchctl kickstart failed; restoring previous launchd plist/service state." >&2
  restore_previous_plist "$BACKUP_PLIST" "$HAD_PREVIOUS"
  exit 1
fi

echo "Installed launchd agent: ${PLIST_PATH}"
echo "Service: ${LABEL}"
echo "Tunnel: ${TUNNEL_NAME}"
echo "Hostname: ${HOSTNAME:-'(not set)'}"
echo "Service URL: ${SERVICE_URL}"
echo "Env file: ${ENV_FILE}"
echo "Logs:"
echo "  ${LOG_DIR}/cloudflare-readonly-tunnel.log"
echo "  ${LOG_DIR}/cloudflare-readonly-tunnel.error.log"
