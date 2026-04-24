# DEV-68 Evidence

## target
- refreshed_at: 2026-04-24 15:53 GMT+8
- goal: normalize linked-focus query targets to canonical ids, so cross-page evidence hops stay stable even when incoming focus uses code, title, or instance-key aliases
- rationale:
  - DEV-67 already passes explicit routing hints from pages into evidence rows
  - DEV-68 keeps the same evidence flow, but canonicalizes focus state inside `useWorkbenchLinking` and expands dashboard evidence rows to use the same explicit hint model

## code_scope
- `src/lib/workbenchLinking.ts`
- `src/pages/DashboardPage.tsx`
- `scripts/capture-dev68.mjs`

## verification
- npm_build: pass (`.evidence/dev68-npm-build.log`)
- npm_test: pass, 32/32 (`.evidence/dev68-npm-test.log`)
- internal build: pass (`.evidence/dev68-build-internal.log`)
- opensource build: pass (`.evidence/dev68-build-opensource.log`)

## screenshots
- `screenshots/dev68/DEV-68-internal-dashboard-focus-canonical.png`
- `screenshots/dev68/DEV-68-internal-tasks-focus-canonical.png`
- `screenshots/dev68/DEV-68-internal-system-control-focus-canonical.png`

## api_and_logs
- `.evidence/dev68/dev68-tasks-board-api.json`
- `.evidence/dev68/dev68-leads-api.json`
- `.evidence/dev68/dev68-audit-log-api.json`
- `.evidence/dev68/dev68-api-summary.json`
- `.evidence/dev68/dev68-summary.json`
- `.evidence/dev68/capture-internal.log`

## mode_isolation
- `.evidence/dev68/mode-isolation-opensource.json`
- note: opensource dashboard clears unsupported alias focus to an empty canonical search and still renders zero evidence chips, preserving isolation from internal evidence panels

## checkpoint
- `useWorkbenchLinking` now resolves incoming focus aliases against project / agent / room / task ids, codes, names, and instance keys before building relation scope
- canonical focus search is now re-emitted from normalized focus state, so repeated evidence jumps stop carrying stale non-id tokens
- dashboard audit rows and consultant summary rows now pass explicit routing hints, keeping dashboard evidence behavior aligned with tasks / leads / system-control
- next_suggestion: DEV-69 should widen screenshot and evidence coverage to opensource-safe dashboard/tasks cases while keeping internal-only evidence panels hidden there
