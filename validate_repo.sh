#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

status=0
fail() { printf 'FAIL %s\n' "$*" >&2; status=1; }
pass() { printf 'OK  %s\n' "$*"; }

printf '== Required files ==\n'
required=(
  "README.md"
  "CONTRIBUTING.md"
  "SECURITY.md"
  "LICENSE"
  "PUBLIC_SAFE_CHECKLIST.md"
  "package.json"
  ".env.example"
  ".github/workflows/public-safe-validate.yml"
)
for path in "${required[@]}"; do
  [[ -e "$path" ]] && pass "$path" || fail "missing required file: $path"
done

printf '\n== Public mock-only structure ==\n'
for path in .env.internal .env.internal.fallback api server; do
  [[ -e "$path" ]] && fail "forbidden public artifact present: $path" || pass "absent $path"
done

printf '\n== Package scripts ==\n'
if node -e "const p=require('./package.json'); const s=p.scripts||{}; const bad=Object.keys(s).filter(k=>/^(dev|build):internal$/.test(k)||/internal/.test(String(s[k]))); if (bad.length) { console.error(bad.join('\\n')); process.exit(1) }"; then
  pass "no private dev/build scripts"
else
  fail "package.json contains forbidden private runtime scripts"
fi

printf '\n== Documentation boundary ==\n'
position_status=0
grep -qi 'public-safe' README.md || position_status=1
grep -qi 'mock-only' README.md || position_status=1
grep -qi 'https://openclaw-kotovela.vercel.app' README.md || position_status=1
grep -qi 'public-safe' CONTRIBUTING.md || position_status=1
grep -qi 'mock-only' CONTRIBUTING.md || position_status=1
grep -qi 'public-safe' SECURITY.md || position_status=1
grep -qi 'mock-only' SECURITY.md || position_status=1
[[ $position_status -eq 0 ]] && pass "README/CONTRIBUTING/SECURITY declare public-safe mock-only boundary" || fail "README/CONTRIBUTING/SECURITY public-safe mock-only boundary missing"

printf '\n== Shell syntax ==\n'
bash -n validate_repo.sh && pass "validate_repo.sh syntax" || fail "validate_repo.sh syntax"
bash -n scripts/guard-public-baseline.sh && pass "scripts/guard-public-baseline.sh syntax" || fail "scripts/guard-public-baseline.sh syntax"

printf '\n== Public-safe sensitive scan ==\n'
scan_targets=()
while IFS= read -r -d '' path; do scan_targets+=("$path"); done < <(find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  -path './dist' -prune -o \
  -path './validate_repo.sh' -prune -o \
  -path './PUBLIC_SAFE_CHECKLIST.md' -prune -o \
  -type f -print0)
sensitive_pattern='/Users/ztl|oc_[0-9a-f]{8,}|ou_[0-9a-f]{8,}|chat:oc_|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|kotovela-hub|Kotovela Hub|real-run|real_run|\.env\.internal|dev:internal|build:internal|/api/office-instances|server/officeInstances|api/office-instances'
if ((${#scan_targets[@]})) && grep -I -R -n -E "$sensitive_pattern" "${scan_targets[@]}" 2>/dev/null; then
  fail "public-safe sensitive scan found forbidden private/live patterns"
else
  pass "no forbidden private/live patterns found"
fi

printf '\n== Result ==\n'
if [[ $status -eq 0 ]]; then
  printf 'Repository validation passed.\n'
else
  printf 'Repository validation failed.\n' >&2
fi
exit "$status"
