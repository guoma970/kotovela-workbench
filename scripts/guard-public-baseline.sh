#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

forbidden_paths=(
  ".env.demo"
  ".env.internal"
  ".env.internal.fallback"
  "docs/vercel-setup.md"
  "marketing/feishu/knowledge-base"
  "public/manifest.demo.webmanifest"
  "public/manifest.internal.webmanifest"
  "scripts/check-office-local.mjs"
  "scripts/guard_public_kotovela_hub.sh"
  "scripts/office-api-server.ts"
  "scripts/vercel-build.mjs"
  "scripts/verify-demo-build-safe.mjs"
  "src/config/runtime.ts"
  "src/config/instanceDisplayNames.ts"
  "src/config/instanceGlyphs.ts"
)

for path in "${forbidden_paths[@]}"; do
  if [ -e "$path" ]; then
    echo "Public baseline guard failed: forbidden path present -> $path" >&2
    exit 1
  fi
done

forbidden_patterns=(
  "build:internal"
  "dev:internal"
  "build:demo"
  "dev:demo"
  "VITE_MODE"
  "VITE_DATA_SOURCE"
  "kotovelahub"
  "KOTOVELA HUB"
)

files_to_scan=(
  "README.md"
  "CONTRIBUTING.md"
  "package.json"
  ".env.example"
  "index.html"
)

for pattern in "${forbidden_patterns[@]}"; do
  for file in "${files_to_scan[@]}"; do
    if [ -f "$file" ] && grep -Fq "$pattern" "$file"; then
      echo "Public baseline guard failed: pattern '$pattern' found in $file" >&2
      exit 1
    fi
  done
done

echo "Public baseline guard passed."
