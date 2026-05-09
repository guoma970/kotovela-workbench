#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LABEL="com.kotovela.office-api"
AGENT_DIR="${HOME}/Library/LaunchAgents"
PLIST_PATH="${AGENT_DIR}/${LABEL}.plist"
LOG_DIR="${REPO_DIR}/logs"
USER_DOMAIN="gui/$(id -u)"
LAUNCHCTL_BIN="${LAUNCHCTL_BIN:-launchctl}"

xml_escape() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  printf '%s' "$value"
}

append_env_var() {
  local key="$1"
  local value="${(P)key:-}"
  if [[ -n "$value" ]]; then
    ENV_XML+=$'\n    <key>'"$(xml_escape "$key")"$'</key>\n    <string>'"$(xml_escape "$value")"$'</string>'
  fi
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

if [[ -z "${OFFICE_API_TOKEN:-}" && "${ALLOW_NO_OFFICE_API_TOKEN:-}" != "1" ]]; then
  echo "Error: OFFICE_API_TOKEN is required. Set ALLOW_NO_OFFICE_API_TOKEN=1 only for VPN/local trusted environments." >&2
  exit 64
fi

mkdir -p "$AGENT_DIR" "$LOG_DIR"

OFFICE_API_PORT_VALUE="${OFFICE_API_PORT:-8787}"
PATH_VALUE="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ENV_XML=$'  <key>EnvironmentVariables</key>\n  <dict>\n    <key>OFFICE_API_PORT</key>\n    <string>'"$(xml_escape "$OFFICE_API_PORT_VALUE")"$'</string>\n    <key>PATH</key>\n    <string>'"$(xml_escape "$PATH_VALUE")"$'</string>'

if [[ -n "${OFFICE_API_HOST:-}" ]]; then
  ENV_XML+=$'\n    <key>OFFICE_API_HOST</key>\n    <string>'"$(xml_escape "$OFFICE_API_HOST")"$'</string>'
fi

if [[ -n "${OFFICE_API_TOKEN:-}" ]]; then
  ENV_XML+=$'\n    <key>OFFICE_API_TOKEN</key>\n    <string>'"$(xml_escape "$OFFICE_API_TOKEN")"$'</string>'
fi

if [[ -n "${OFFICE_API_CORS_ORIGIN:-}" ]]; then
  ENV_XML+=$'\n    <key>OFFICE_API_CORS_ORIGIN</key>\n    <string>'"$(xml_escape "$OFFICE_API_CORS_ORIGIN")"$'</string>'
fi

append_env_var KOTOVELA_PUBLIC_ORIGIN
append_env_var KOTOVELA_ACCESS_SECRET
append_env_var XIGUO_LINK_SECRET
append_env_var XIGUO_API_KEY

ENV_XML+=$'\n  </dict>'

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
    <string>$(xml_escape "${REPO_DIR}/scripts/run-office-api.sh")</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(xml_escape "$REPO_DIR")</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
${ENV_XML}
  <key>StandardOutPath</key>
  <string>$(xml_escape "${LOG_DIR}/office-api.log")</string>
  <key>StandardErrorPath</key>
  <string>$(xml_escape "${LOG_DIR}/office-api.error.log")</string>
</dict>
</plist>
EOF_PLIST

plutil -lint "$TMP_PLIST" >/dev/null

"$LAUNCHCTL_BIN" bootout "$USER_DOMAIN" "$PLIST_PATH" 2>/dev/null || true
"$LAUNCHCTL_BIN" bootout "${USER_DOMAIN}/${LABEL}" 2>/dev/null || true
cp "$TMP_PLIST" "$PLIST_PATH"

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

if [[ -z "${OFFICE_API_TOKEN:-}" ]]; then
  echo "Warning: OFFICE_API_TOKEN was not set because ALLOW_NO_OFFICE_API_TOKEN=1. Only use behind VPN / local trusted access control." >&2
fi

echo "Installed launchd agent: ${PLIST_PATH}"
echo "Service: ${LABEL}"
echo "Port: ${OFFICE_API_PORT_VALUE}"
echo "Logs:"
echo "  ${LOG_DIR}/office-api.log"
echo "  ${LOG_DIR}/office-api.error.log"
