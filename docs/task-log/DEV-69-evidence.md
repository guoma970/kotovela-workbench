# DEV-69 Evidence

## target
- refreshed_at: 2026-04-24 16:24 GMT+8
- goal: make the new Dashboard evidence chips explicitly internal-only, and add opensource-side isolation screenshots / summaries
- rationale:
  - DEV-68 added homepage evidence links
  - mode-isolation evidence needed to grow with that new surface
  - DEV-69 keeps the same mainline but tightens the internal vs opensource boundary

## code_scope
- `src/pages/DashboardPage.tsx`
- `scripts/capture-dev69.mjs`

## verification
- npm_build: pass (`.evidence/dev69-npm-build.log`)
- npm_test: pass, 32/32 (`.evidence/dev69-npm-test.log`)
- internal build: pass (`.evidence/dev69-build-internal.log`)
- opensource build: pass (`.evidence/dev69-build-opensource.log`)

## screenshots
- `screenshots/dev69/DEV-69-internal-dashboard-evidence-links.png`
- `screenshots/dev69/DEV-69-internal-system-control-evidence-links.png`
- `screenshots/dev69/DEV-69-opensource-dashboard-isolation.png`
- `screenshots/dev69/DEV-69-opensource-tasks-isolation.png`

## api_and_logs
- `.evidence/dev69/dev69-tasks-board-api.json`
- `.evidence/dev69/dev69-leads-api.json`
- `.evidence/dev69/dev69-audit-log-api.json`
- `.evidence/dev69/dev69-api-summary.json`
- `.evidence/dev69/dev69-summary.json`
- `.evidence/dev69/capture-internal.log`
- `.evidence/dev69/capture-opensource.log`

## mode_isolation
- `.evidence/dev69/mode-isolation-opensource.json`
- `.evidence/dev69/build-opensource-capture.log`
- note: Dashboard evidence chips now render only when `mode === internal`, and opensource capture records the resulting chip count

## checkpoint
- Dashboard audit / consultant summary cards now gate evidence chips behind internal mode
- opensource screenshots and JSON summary make the no-leak boundary visible instead of assumed
- linked-focus still works in internal mode while the opensource surface stays clean
- next_suggestion: DEV-70 should finish by consolidating evidence-coverage metadata, so task logs can show which pages and modes were covered in one final summary
