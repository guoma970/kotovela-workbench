# DEV-63 Evidence

## target
- refreshed_at: 2026-04-24 12:16 GMT+8
- goal: close the linked-context gap by making Rooms / Agents related badges jump to their target pages with focus state preserved
- rationale:
  - DEV-62 already closed system-control and validation
  - current mainline still had Rooms / Agents relation badges only changing local highlight state, which broke the Dashboard → Projects → Rooms → Tasks → Agents walkthrough promise
  - DEV-63 keeps the smallest forward path, no unrelated refactor

## code_scope
- `src/components/ObjectBadge.tsx`
- `src/pages/RoomsPage.tsx`
- `src/pages/AgentsPage.tsx`
- `scripts/capture-dev63.mjs`

## verification
- npm_build: pass (`npm run build`)
- npm_test: pass, 32/32 passed (`.evidence/dev63-npm-test.log`)
- build_internal: pass (`.evidence/dev63-build-internal.log`)
- build_opensource: pass (`.evidence/dev63-build-opensource.log`)

## screenshots
- `screenshots/DEV-63-rooms-linked-navigation.png`
- `screenshots/DEV-63-agents-linked-navigation.png`

## decision_log_and_audit
- decision_log evidence: `.evidence/dev63-tasks-board.json`
- audit_log evidence: `.evidence/dev63-audit-log.json`
- system_mode evidence: `.evidence/dev63-system-mode.json`

## mode_isolation
- summary: `.evidence/dev63-mode-isolation.json`
- internal build log: `.evidence/dev63-build-internal.log`
- opensource build log: `.evidence/dev63-build-opensource.log`
- note: internal and opensource builds emitted different JS bundles while both passed, which confirms DEV-63 navigation closure stayed compatible with both modes

## checkpoint
- Rooms page: project / agent badges now jump to `/projects` and `/agents` with `focusType/focusId`
- Agents page: project / room badges now jump to `/projects` and `/rooms` with preserved focus
- ObjectBadge clickable buttons now stop parent card bubbling, avoiding accidental local re-select overriding cross-page navigation
- next_suggestion: DEV-64 can continue the same chain on Tasks / Leads, adding cross-page focus chips from decision_log rows back into Projects / Rooms / Agents
