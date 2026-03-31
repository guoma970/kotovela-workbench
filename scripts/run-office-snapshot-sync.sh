#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BRANCH_NAME="$(git -C "$REPO_DIR" branch --show-current)"
DIRTY_STATUS="$(git -C "$REPO_DIR" status --porcelain)"

if [[ "$BRANCH_NAME" != "main" ]]; then
  echo "Expected branch 'main', got '${BRANCH_NAME}'. Use a dedicated clean main clone for snapshot sync." >&2
  exit 1
fi

if [[ -n "$DIRTY_STATUS" ]]; then
  echo "Working tree is not clean. Snapshot sync should run in a dedicated clean clone." >&2
  exit 1
fi

cd "$REPO_DIR"

git pull --rebase origin main
npm ci
npm run sync:office-snapshot

if git diff --quiet -- data/office-instances.snapshot.json; then
  echo "No snapshot changes"
  exit 0
fi

git add data/office-instances.snapshot.json
git commit -m "chore: sync office snapshot"
git push origin HEAD:main
