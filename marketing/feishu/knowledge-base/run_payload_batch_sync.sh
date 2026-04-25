#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PAYLOAD_PATH="${1:-$SCRIPT_DIR/payload.example.yaml}"

if [[ ! -f "$PAYLOAD_PATH" ]]; then
  echo "Payload not found: $PAYLOAD_PATH" >&2
  exit 1
fi

if [[ "$(basename "$PAYLOAD_PATH")" != "payload.example.yaml" ]]; then
  echo "Public repo only permits payload.example.yaml" >&2
  exit 1
fi

if grep -Eq '^[[:space:]]*real_run:[[:space:]]*true([[:space:]]|$)' "$PAYLOAD_PATH"; then
  echo "Public repo forbids real_run=true" >&2
  exit 1
fi

if grep -E 'Bearer[[:space:]]+[A-Za-z0-9._-]{10,}' "$PAYLOAD_PATH" | grep -vq '\${'; then
  echo "Public repo payload must not contain real Bearer tokens" >&2
  exit 1
fi

if grep -E 'token:[[:space:]]*[A-Za-z0-9._-]{10,}' "$PAYLOAD_PATH" | grep -Evi 'example|placeholder|sample'; then
  echo "Public repo payload must not contain literal tokens" >&2
  exit 1
fi

echo "Public example runner only. Dry-run preview follows."
sed -n '1,200p' "$PAYLOAD_PATH"
echo "-- forced dry-run --"
