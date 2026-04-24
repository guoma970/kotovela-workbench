# DEV-71 Evidence

## target
- refreshed_at: 2026-04-24 19:01 GMT+8
- goal: add an evidence acceptance page that visualizes parser hit results, miss reasons, and link-back success so unresolved logs are visible at a glance
- boundary:
  - repo locked to `kotovela-workbench`
  - branch locked to `feature/snapshot-sync-ready`
  - evidence paths stay inside current repo conventions: `.evidence/dev71/`, `screenshots/dev71/`, `docs/task-log/`

## code_scope
- `src/pages/EvidenceAcceptancePage.tsx`
- `src/App.tsx`
- `src/layout/AppShell.tsx`
- `src/index.css`
- `scripts/prepare-dev71-evidence.mjs`
- `scripts/capture-dev71.mjs`
- `docs/task-log/DEV-71-evidence.md`

## verification
- npm_build: pass (`.evidence/dev71/dev71-npm-build.log`)
- npm_test: pass, 32/32 (`.evidence/dev71/dev71-npm-test.log`)
- internal build: pass (`.evidence/dev71/dev71-build-internal.log`)
- opensource build: pass (`.evidence/dev71/dev71-build-opensource.log`)

## screenshots
- `screenshots/dev71/DEV-71-internal-evidence-acceptance-overview.png`
- `screenshots/dev71/DEV-71-internal-evidence-acceptance-unresolved.png`
- `screenshots/dev71/DEV-71-opensource-evidence-isolation.png`

## api_and_logs
- `.evidence/dev71/dev71-tasks-board-api.json`
- `.evidence/dev71/dev71-leads-api.json`
- `.evidence/dev71/dev71-audit-log-api.json`
- `.evidence/dev71/dev71-decision-log.json`
- `.evidence/dev71/dev71-api-summary.json`
- `.evidence/dev71/dev71-prepare.log`
- `.evidence/dev71/dev71-capture-internal.log`
- `.evidence/dev71/dev71-capture-opensource.log`
- `.evidence/dev71/dev71-preview-internal.log`
- `.evidence/dev71/dev71-preview-opensource.log`

## mode_isolation
- `.evidence/dev71/mode-isolation-internal.json`
- `.evidence/dev71/mode-isolation-opensource.json`
- note:
  - internal evidence chip count = `24`
  - opensource evidence chip count = `0`

## checkpoint
- the new page aggregates evidence rows from `tasks-board`, `leads`, and `audit-log`
- the top panel exposes evidence row count, parser hits, unresolved rows, and link-back success rate in one screen
- unresolved rows now show normalized miss reasons such as `missing_signals`, `text_too_thin`, or `no_object_match`
- capture is fixture-driven from repo-local evidence snapshots, avoiding any cross-repo path leakage
