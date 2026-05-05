#!/bin/zsh

set -euo pipefail

LABEL="com.kotovela.cloudflare-readonly-tunnel"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
USER_DOMAIN="gui/$(id -u)"
LAUNCHCTL_BIN="${LAUNCHCTL_BIN:-launchctl}"

"$LAUNCHCTL_BIN" bootout "$USER_DOMAIN" "$PLIST_PATH" 2>/dev/null || true
"$LAUNCHCTL_BIN" bootout "${USER_DOMAIN}/${LABEL}" 2>/dev/null || true
rm -f "$PLIST_PATH"

echo "Uninstalled launchd agent: ${LABEL}"
