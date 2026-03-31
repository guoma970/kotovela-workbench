#!/bin/zsh

set -euo pipefail

LABEL="com.kotovela.office-snapshot-sync"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
USER_DOMAIN="gui/$(id -u)"

launchctl bootout "$USER_DOMAIN" "$PLIST_PATH" 2>/dev/null || true
rm -f "$PLIST_PATH"

echo "Removed launchd agent: ${PLIST_PATH}"
