#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="${REPO_DIR}/logs"
ENV_FILE="${OFFICE_READONLY_GATEWAY_ENV_FILE:-${HOME}/.config/kotovela/office-readonly-gateway.env}"

mkdir -p "$LOG_DIR"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

cd "$REPO_DIR"

export OFFICE_READONLY_GATEWAY_PORT="${OFFICE_READONLY_GATEWAY_PORT:-8791}"
export OFFICE_READONLY_GATEWAY_HOST="${OFFICE_READONLY_GATEWAY_HOST:-127.0.0.1}"
export OFFICE_READONLY_GATEWAY_UPSTREAM_ORIGIN="${OFFICE_READONLY_GATEWAY_UPSTREAM_ORIGIN:-http://127.0.0.1:8787}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

exec npm run serve:office-readonly-gateway
