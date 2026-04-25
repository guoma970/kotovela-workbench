#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/marketing/feishu/knowledge-base"

[[ -d "$TARGET_DIR" ]] || { echo "Missing $TARGET_DIR" >&2; exit 1; }

if [[ -f "$TARGET_DIR/payload-GH-20260417-02-R2.yaml" ]]; then
  echo "Real payload must not exist in public repo" >&2
  exit 1
fi

find "$TARGET_DIR" -maxdepth 1 -type f \( -name 'payload*.yaml' -o -name 'payload*.yml' \) | while read -r file; do
  base="$(basename "$file")"
  if [[ "$base" != 'payload.example.yaml' ]]; then
    echo "Non-example payload blocked: $base" >&2
    exit 1
  fi
  if grep -Eq '^[[:space:]]*real_run:[[:space:]]*true([[:space:]]|$)' "$file"; then
    echo "real_run=true blocked in $base" >&2
    exit 1
  fi
  if grep -E 'Bearer[[:space:]]+[A-Za-z0-9._-]{10,}' "$file" | grep -vq '\${'; then
    echo "Bearer token blocked in $base" >&2
    exit 1
  fi
  if grep -E '(tenant|user|app)_access_token[[:space:]:=]+[A-Za-z0-9._-]{10,}' "$file" | grep -Evi 'example|placeholder|sample'; then
    echo "Access token blocked in $base" >&2
    exit 1
  fi
  if grep -E 'token:[[:space:]]*[A-Za-z0-9._-]{10,}' "$file" | grep -Evi 'example|placeholder|sample'; then
    echo "Literal token blocked in $base" >&2
    exit 1
  fi
done

script="$TARGET_DIR/run_payload_batch_sync.sh"
[[ -f "$script" ]] || { echo "Missing runner" >&2; exit 1; }

grep -Fq 'payload.example.yaml' "$script" || { echo 'Runner must pin payload.example.yaml' >&2; exit 1; }
grep -Eq 'forbid[s]? real_run=true|real_run=true' "$script" || { echo 'Runner must reject real_run=true' >&2; exit 1; }
grep -Eq 'only permits payload.example.yaml|only prints the example payload|forced dry-run' "$script" || { echo 'Runner must force dry-run behavior' >&2; exit 1; }

echo 'Public Kotovela Hub guardrails passed.'
