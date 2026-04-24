# DEV-65 Evidence

## target
- refreshed_at: 2026-04-24 14:31 GMT+8
- goal: let decision_log / audit_log rows jump directly back into Projects / Rooms / Agents / Tasks, closing the evidence-to-object focus loop
- rationale:
  - DEV-64 closed card-level linking for Tasks / Leads
  - evidence rows still trapped users inside log text
  - DEV-65 keeps the same mainline and only adds row-level backlinks plus verification assets

## code_scope
- `src/components/EvidenceObjectLinks.tsx`
- `src/pages/TasksPage.tsx`
- `src/pages/LeadsPage.tsx`
- `src/pages/SystemControlPage.tsx`
- `scripts/capture-dev65.mjs`

## verification
- npm_build: pass
- npm_test: pass, 32/32
- run_id: `stab-1777012123199`
- internal build: pass (`.evidence/dev65/build-internal.log`)
- opensource build: pass (`.evidence/dev65/build-opensource.log`)

## screenshots
- `screenshots/dev65/DEV-65-internal-tasks-evidence-links.png`
- `screenshots/dev65/DEV-65-internal-system-control-evidence-links.png`
- `screenshots/dev65/DEV-65-opensource-tasks-isolation.png`

## api_and_logs
- `.evidence/dev65/dev65-tasks-board-api.json`
- `.evidence/dev65/dev65-leads-api.json`
- `.evidence/dev65/dev65-audit-log-api.json`
- `.evidence/dev65/dev65-api-summary.json`
- `.evidence/dev65/dev65-summary.json`
- `.evidence/dev65/mode-isolation-opensource.json`

## checkpoint
- evidence rows now render inline backlink chips when row text or resolved context can map back to object pages
- tasks page now surfaces task decision_log rows, not only audit rows, so evidence rows can carry explicit task/project/room/agent context
- system control evidence rows now expose object-level jump chips without changing existing guardrail behavior
- next_suggestion: DEV-66 can harden the evidence parser so attribution/source_line/account_line style payloads map to project/room/task objects more aggressively across more audit sources
