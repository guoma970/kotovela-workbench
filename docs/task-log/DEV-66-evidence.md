# DEV-66 Evidence

## target
- refreshed_at: 2026-04-24 15:55 GMT+8
- goal: harden the evidence parser so `source_line` / `attribution` / `account_line` / `consultant_id` text can resolve back into stable project / room / task links
- rationale:
  - DEV-65 already exposed evidence-row jump chips
  - rows carrying structured audit text still depended too much on raw fuzzy text matching
  - DEV-66 keeps the same linked-focus mainline and only strengthens parsing and fallback signal matching

## code_scope
- `src/components/EvidenceObjectLinks.tsx`
- `scripts/capture-dev66.mjs`

## verification
- npm_build: pass (`.evidence/dev66-npm-build.log`)
- npm_test: pass, 32/32 (`.evidence/dev66-npm-test.log`)
- internal build: pass (`.evidence/dev66-build-internal.log`)
- opensource build: pass (`.evidence/dev66-build-opensource.log`)

## screenshots
- `screenshots/dev66/DEV-66-internal-tasks-parser-links.png`
- `screenshots/dev66/DEV-66-internal-leads-parser-links.png`
- `screenshots/dev66/DEV-66-internal-system-control-parser-links.png`

## api_and_logs
- `.evidence/dev66/dev66-tasks-board-api.json`
- `.evidence/dev66/dev66-leads-api.json`
- `.evidence/dev66/dev66-audit-log-api.json`
- `.evidence/dev66/dev66-api-summary.json`
- `.evidence/dev66/dev66-summary.json`
- `.evidence/dev66/capture-internal.log`

## mode_isolation
- `.evidence/dev66/mode-isolation-opensource.json`
- note: parser hardening is render-only and stays compatible with existing opensource isolation behavior

## checkpoint
- evidence parser now extracts structured `key=value` signals from log text before matching object links
- attribution payloads like `attribution=source/medium/campaign` are split into stable routing tokens instead of depending on one raw blob
- fallback signal maps now keep project / room / task links stable for routing-heavy audit text even when the row lacks explicit object ids
- next_suggestion: DEV-67 should pass structured routing hints directly from page data into the evidence component, so fewer rows rely on text extraction alone
