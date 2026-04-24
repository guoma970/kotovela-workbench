# DEV-67 Evidence

## target
- refreshed_at: 2026-04-24 16:08 GMT+8
- goal: pass structured evidence hints from page payloads into `EvidenceObjectLinks`, so routing chips rely less on raw prose extraction
- rationale:
  - DEV-66 improved parser stability
  - page-level payloads already carry cleaner `source/account/consultant/attribution` fields
  - DEV-67 keeps the same mainline and only improves page-to-parser wiring

## code_scope
- `src/components/EvidenceObjectLinks.tsx`
- `src/pages/TasksPage.tsx`
- `src/pages/LeadsPage.tsx`
- `src/pages/SystemControlPage.tsx`

## verification
- npm_build: pass (`.evidence/dev67-npm-build.log`)
- npm_test: pass, 32/32 (`.evidence/dev67-npm-test.log`)
- internal build: pass (`.evidence/dev67-build-internal.log`)
- opensource build: pass (`.evidence/dev67-build-opensource.log`)

## screenshots
- `screenshots/dev67/DEV-67-internal-tasks-parser-links.png`
- `screenshots/dev67/DEV-67-internal-leads-parser-links.png`
- `screenshots/dev67/DEV-67-internal-system-control-parser-links.png`

## api_and_logs
- `.evidence/dev67/dev67-tasks-board-api.json`
- `.evidence/dev67/dev67-leads-api.json`
- `.evidence/dev67/dev67-audit-log-api.json`
- `.evidence/dev67/dev67-api-summary.json`
- `.evidence/dev67/dev67-summary.json`
- `.evidence/dev67/capture-internal.log`

## mode_isolation
- `.evidence/dev67/mode-isolation-opensource.json`
- note: `signalParts` only feeds the internal evidence-link resolver and does not widen opensource data exposure

## checkpoint
- `EvidenceObjectLinks` now accepts explicit `signalParts`
- Tasks / Leads / SystemControl pass `source_line`, `account_line`, `content_line`, `consultant_id`, and attribution fragments directly where available
- audit rows now also preserve actor-oriented tokens when building link chips
- next_suggestion: DEV-68 should extend the same linked-focus evidence chips into Dashboard-level summary cards so cross-page navigation starts earlier in the funnel
