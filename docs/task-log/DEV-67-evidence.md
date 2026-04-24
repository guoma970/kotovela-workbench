# DEV-67 Evidence

## target
- refreshed_at: 2026-04-24 15:46 GMT+8
- goal: pass structured routing hints from page-level evidence rows into `EvidenceObjectLinks`, so linked-focus uses explicit ids/codes/names before falling back to text parsing
- rationale:
  - DEV-66 already hardened parser fallback for routing-heavy audit text
  - DEV-67 keeps the same mainline, but reduces parser dependence by feeding page-resolved relations directly into the evidence component

## code_scope
- `src/components/EvidenceObjectLinks.tsx`
- `src/pages/TasksPage.tsx`
- `src/pages/LeadsPage.tsx`
- `src/pages/SystemControlPage.tsx`
- `scripts/capture-dev67.mjs`

## verification
- npm_build: pass (`.evidence/dev67-npm-build.log`)
- npm_test: pass, 32/32 (`.evidence/dev67-npm-test.log`)
- internal build: pass (`.evidence/dev67-build-internal.log`)
- opensource build: pass (`.evidence/dev67-build-opensource.log`)

## screenshots
- `screenshots/dev67/DEV-67-internal-tasks-routing-hints.png`
- `screenshots/dev67/DEV-67-internal-leads-routing-hints.png`
- `screenshots/dev67/DEV-67-internal-system-control-routing-hints.png`

## api_and_logs
- `.evidence/dev67/dev67-tasks-board-api.json`
- `.evidence/dev67/dev67-leads-api.json`
- `.evidence/dev67/dev67-audit-log-api.json`
- `.evidence/dev67/dev67-api-summary.json`
- `.evidence/dev67/dev67-summary.json`
- `.evidence/dev67/capture-internal.log`

## mode_isolation
- `.evidence/dev67/mode-isolation-opensource.json`
- note: opensource `/tasks` still renders zero evidence cards and zero decision panels, so explicit routing hints remain internal-only read-path wiring

## checkpoint
- evidence links now accept structured `routingHints` with ids and hint signals per object kind
- tasks / leads / system-control pages now pass explicit project, agent, room, and task relations into evidence rows instead of relying only on extracted text
- audit rows still keep parser fallback, but page-resolved hints now win first for cross-page linking stability
- next_suggestion: DEV-68 should stabilize the generated focus search so evidence jumps preserve only one canonical target across repeated cross-page hops
