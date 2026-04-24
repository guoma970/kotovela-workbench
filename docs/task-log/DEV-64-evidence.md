# DEV-64 Evidence

## target
- refreshed_at: 2026-04-24 14:19 GMT+8
- goal: extend the linked-focus mainline from DEV-63 into Tasks / Leads so decision_log context and task cards can jump back to Projects / Rooms / Agents
- rationale:
  - DEV-63 closed Rooms / Agents cross-page linking
  - Tasks / Leads still trapped users inside local cards without a full focus loop back to related entities
  - DEV-64 keeps the same chain and avoids unrelated refactor

## code_scope
- `src/pages/TasksPage.tsx`
- `src/pages/LeadsPage.tsx`
- `scripts/capture-dev64.mjs`

## verification
- npm_build: pass (`.evidence/dev64-npm-build.log`)
- npm_test: pass, 32/32 (`.evidence/dev64-npm-test.log`)
- run_id: `stab-1777011446330`
- internal build: pass (`.evidence/dev64-build-internal.log`)
- opensource build: pass (`.evidence/dev64-build-opensource.log`)

## screenshots
- `screenshots/DEV-64-internal-tasks-focus-loop.png`
- `screenshots/DEV-64-internal-leads-focus-loop.png`
- `screenshots/DEV-64-opensource-tasks-focus-loop.png`
- `screenshots/DEV-64-opensource-leads-focus-loop.png`

## api_and_logs
- `.evidence/dev64-tasks-board-api.json`
- `.evidence/dev64-leads-api.json`
- `.evidence/dev64-audit-log-api.json`
- `.evidence/dev64-api-summary.json`
- `.evidence/dev64-summary.json`
- `server/data/audit-log.json`
- `public/system-test-results.json`
- `docs/task-log/DEV-20260416-43-stabilization.md`

## mode_isolation
- `.evidence/dev64-build-internal.log`
- `.evidence/dev64-build-opensource.log`
- note: both modes passed independent builds while DEV-64 linking additions remained mode-safe

## checkpoint
- Tasks cards now expose linked project / room / agent badges with focus-preserving cross-page navigation
- Leads cards now expose linked project / room / agent badges inferred from related task and owner context
- next_suggestion: DEV-65 should close the final focus loop from decision_log / audit rows themselves, so evidence rows can jump directly into Projects / Rooms / Agents / Tasks without manual hunting
