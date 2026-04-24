# DEV-68 Evidence

## target
- refreshed_at: 2026-04-24 16:17 GMT+8
- goal: extend linked-focus evidence chips into Dashboard summary cards, so cross-page navigation starts from the home overview instead of only downstream pages
- rationale:
  - DEV-67 finished page-to-parser signal wiring for Tasks / Leads / SystemControl
  - Dashboard still showed audit and consultant summaries without object jump chips
  - DEV-68 fills that homepage gap with the same evidence-link component

## code_scope
- `src/pages/DashboardPage.tsx`
- `scripts/capture-dev68.mjs`

## verification
- npm_build: pass (`.evidence/dev68-npm-build.log`)
- npm_test: pass, 32/32 (`.evidence/dev68-npm-test.log`)
- internal build: pass (`.evidence/dev68-build-internal.log`)
- opensource build: pass (`.evidence/dev68-build-opensource.log`)

## screenshots
- `screenshots/dev68/DEV-68-internal-dashboard-evidence-links.png`
- `screenshots/dev68/DEV-68-internal-tasks-parser-links.png`
- `screenshots/dev68/DEV-68-internal-system-control-parser-links.png`

## api_and_logs
- `.evidence/dev68/dev68-tasks-board-api.json`
- `.evidence/dev68/dev68-leads-api.json`
- `.evidence/dev68/dev68-audit-log-api.json`
- `.evidence/dev68/dev68-api-summary.json`
- `.evidence/dev68/dev68-summary.json`
- `.evidence/dev68/capture-internal.log`

## mode_isolation
- `.evidence/dev68/mode-isolation-opensource.json`
- note: homepage evidence chips use the same shared component and keep opensource mode on the existing hidden-data boundary

## checkpoint
- Dashboard audit log cards now render object chips that can jump toward project / room / task / agent context
- consultant summary cards also expose structured consultant/account hints through the shared resolver
- homepage overview now joins the same linked-focus mainline as Tasks / Leads / SystemControl
- next_suggestion: DEV-69 should strengthen opensource-side isolation checks and screenshot evidence so the new Dashboard links stay internal-only where expected
