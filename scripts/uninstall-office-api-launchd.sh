#!/bin/zsh

set -euo pipefail

LABEL="com.kotovela.office-api"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
USER_DOMAIN="gui/$(id -u)"
LAUNCHCTL_BIN="${LAUNCHCTL_BIN:-launchctl}"

"$LAUNCHCTL_BIN" bootout "$USER_DOMAIN" "$PLIST_PATH" 2>/dev/null || true
"$LAUNCHCTL_BIN" bootout "${USER_DOMAIN}/${LABEL}" 2>/dev/null || true
rm -f "$PLIST_PATH"

if "$LAUNCHCTL_BIN" print "${USER_DOMAIN}/${LABEL}" >/dev/null 2>&1; then
  echo "Warning: launchd service still exists after uninstall: ${USER_DOMAIN}/${LABEL}" >&2
  echo "Removed plist path: ${PLIST_PATH}" >&2
  exit 1
fi

echo "Removed launchd agent: ${PLIST_PATH}"
echo "Verified service absent: ${USER_DOMAIN}/${LABEL}"
