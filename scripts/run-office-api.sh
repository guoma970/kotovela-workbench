#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="${REPO_DIR}/logs"

mkdir -p "$LOG_DIR"
cd "$REPO_DIR"

export OFFICE_API_PORT="${OFFICE_API_PORT:-8787}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

exec npm run serve:office-api
