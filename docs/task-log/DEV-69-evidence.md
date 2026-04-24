# DEV-69 Evidence

## target
- refreshed_at: 2026-04-24 15:55 GMT+8
- goal: expand internal evidence coverage while making opensource isolation checks count evidence-only chips instead of generic navigation chips
- rationale:
  - DEV-68 stabilized canonical focus targets across pages
  - DEV-69 keeps the same rendering path, but adds explicit evidence selectors so coverage screenshots and mode-isolation checks measure the right surface

## code_scope
- `src/components/EvidenceObjectLinks.tsx`
- `scripts/capture-dev69.mjs`

## verification
- npm_build: pass (`.evidence/dev69-npm-build.log`)
- npm_test: pass, 32/32 (`.evidence/dev69-npm-test.log`)
- internal build: pass (`.evidence/dev69-build-internal.log`)
- opensource build: pass (`.evidence/dev69-build-opensource.log`)

## screenshots
- `screenshots/dev69/DEV-69-internal-dashboard-evidence-coverage.png`
- `screenshots/dev69/DEV-69-internal-system-control-evidence-coverage.png`
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
- note: opensource evidence chip count is now `0`, because verification targets `[data-evidence-link="true"]` instead of unrelated inline navigation chips

## checkpoint
- evidence links now emit stable `data-evidence-links` / `data-evidence-link` markers for screenshot capture and isolation auditing
- DEV-69 internal coverage now explicitly captures dashboard and system-control evidence rows with the new selector
- opensource dashboard and tasks isolation checks now confirm no evidence chips leak across mode boundaries
- next_suggestion: DEV-70 should aggregate DEV-67 to DEV-69 coverage into one summary and close the linked-focus evidence mainline with a final pass over docs and artifacts
