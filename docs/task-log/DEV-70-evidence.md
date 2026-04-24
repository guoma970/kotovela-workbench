# DEV-70 Evidence

## target
- refreshed_at: 2026-04-24 15:57 GMT+8
- goal: close the linked-focus / evidence mainline with one final coverage pass across DEV-67 to DEV-70 artifacts, screenshots, and mode-isolation summaries
- rationale:
  - DEV-67 to DEV-69 already delivered routing hints, canonical focus normalization, and evidence-only isolation selectors
  - DEV-70 does not widen product scope, it only consolidates coverage and verifies the final evidence path stays isolated in opensource mode

## code_scope
- `scripts/capture-dev70.mjs`
- `scripts/collect-evidence-coverage.mjs`
- `docs/task-log/DEV-70-evidence.md`

## verification
- npm_build: pass (`.evidence/dev70-npm-build.log`)
- npm_test: pass, 32/32 (`.evidence/dev70-npm-test.log`)
- internal build: pass (`.evidence/dev70-build-internal.log`)
- opensource build: pass (`.evidence/dev70-build-opensource.log`)

## screenshots
- `screenshots/dev70/DEV-70-internal-dashboard-coverage.png`
- `screenshots/dev70/DEV-70-internal-leads-coverage.png`
- `screenshots/dev70/DEV-70-internal-system-control-coverage.png`
- `screenshots/dev70/DEV-70-opensource-dashboard-isolation.png`
- `screenshots/dev70/DEV-70-opensource-tasks-isolation.png`

## api_and_logs
- `.evidence/dev70/dev70-tasks-board-api.json`
- `.evidence/dev70/dev70-leads-api.json`
- `.evidence/dev70/dev70-audit-log-api.json`
- `.evidence/dev70/dev70-api-summary.json`
- `.evidence/dev70/dev70-summary.json`
- `.evidence/dev70/capture-internal.log`
- `.evidence/dev70/capture-opensource.log`
- `.evidence/dev70/dev70-coverage-summary.json`
- `.evidence/dev70/dev70-coverage-summary.md`

## mode_isolation
- `.evidence/dev70/mode-isolation-opensource.json`
- note: final opensource evidence chip count remains `0`, and the coverage summary now references DEV-66 through DEV-70 artifacts with the updated routing-hints / canonical-focus / evidence-only filenames

## checkpoint
- final capture now waits for `[data-evidence-link="true"]`, so internal screenshots and opensource isolation checks use the same evidence-only contract
- coverage summary now indexes DEV-66 through DEV-70 screenshots and all mode-isolation json files in one place
- linked-focus / evidence mainline is closed with internal coverage on dashboard / leads / system-control and opensource isolation on dashboard / tasks
