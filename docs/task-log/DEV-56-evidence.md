# DEV-56 Evidence

## doing
- refreshed_at: 2026-04-19 23:18 GMT+8
- current_status: restarted DEV-56 validation chain, current repo has no active doing task, only 3 queued items in external runner board
- missing_evidence:
  - npm test runnable entry missing in package.json
  - fresh build/test logs
  - fresh Dashboard / Scheduler / publish-center / consultant screenshots
  - decision_log / audit_log / API validation summary
  - final sign-off note for no-regression checks
- next_files:
  - package.json
  - vite.config.ts
  - src/pages/DashboardPage.tsx
  - src/layout/AppShell.tsx
  - src/config/brand.ts
  - src/config/brandAssets.ts
  - server/data/audit-log.json
- ETA: 2026-04-19 23:50 GMT+8

## state_check
- task_board_active_like_count: 3
- task_board_active_like_items:
  - 多依赖长链任务 | queued | blocked_by=上游资源审批
  - 地暖采暖系统热源怎么选 · 果妈970地暖体验版 | queued
  - 地暖采暖系统热源怎么选 · 官方地暖长文版 | queued
- blocker_conclusion: can_continue
- note: no DEV-56-specific active chain found, so this run rebuilds evidence from current stable code without rollback.

## verification
- build_internal: pass (`.evidence/build-internal.log`)
- build_opensource: pass (`.evidence/build-opensource.log`)
- npm_test: pass, 32/32 passed (`public/system-test-results.json`)
- npm_test_run_id: `stab-1776611777774`
- fresh_screenshots:
  - `screenshots/DEV-56-dashboard-home.png`
  - `screenshots/DEV-56-scheduler-page.png`
  - `screenshots/DEV-56-scheduler-execution.png`
  - `screenshots/DEV-56-publish-center.png`
  - `screenshots/DEV-56-consultant-load-dashboard.png`
- api_evidence:
  - `/.evidence/dev56-system-mode.json`
  - `/.evidence/dev56-audit-log.json`
  - `/.evidence/dev56-tasks-board.json`
  - `/.evidence/dev56-lead-stats.json`
  - `/.evidence/dev56-leads.json`
  - `/.evidence/dev56-content-feedback.json`
- system_mode_guardrail:
  - `system_mode=test`
  - `publish_mode=semi_auto`
  - `force_stop=false`
- external_partner_note:
  - current routed sample keeps `account_type=external_partner`, `cta_policy=consult_only`, `consultant_id=null`
  - source-backed sample preserves `source_type=product_brochure` in `.evidence/dev56-external-partner-source-sample.json`
- target_file_name_scan:
  - no obsolete naming residue in target branding fields, only stable repo-path/workbench helper references remain
