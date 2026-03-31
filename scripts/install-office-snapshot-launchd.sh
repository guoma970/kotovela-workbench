#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LABEL="com.kotovela.office-snapshot-sync"
AGENT_DIR="${HOME}/Library/LaunchAgents"
PLIST_PATH="${AGENT_DIR}/${LABEL}.plist"
LOG_DIR="${REPO_DIR}/logs"
USER_DOMAIN="gui/$(id -u)"

mkdir -p "$AGENT_DIR" "$LOG_DIR"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>${REPO_DIR}/scripts/run-office-snapshot-sync.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>600</integer>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/office-snapshot-sync.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/office-snapshot-sync.error.log</string>
</dict>
</plist>
EOF

launchctl bootout "$USER_DOMAIN" "$PLIST_PATH" 2>/dev/null || true
launchctl bootstrap "$USER_DOMAIN" "$PLIST_PATH"
launchctl enable "${USER_DOMAIN}/${LABEL}" || true
launchctl kickstart -k "${USER_DOMAIN}/${LABEL}"

echo "Installed launchd agent: ${PLIST_PATH}"
echo "Logs:"
echo "  ${LOG_DIR}/office-snapshot-sync.log"
echo "  ${LOG_DIR}/office-snapshot-sync.error.log"
