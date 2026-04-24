# DEV-73 Evidence

## target
- refreshed_at: 2026-04-24 20:08 GMT+8
- goal: make parser hit provenance explicit with `match_source` and `match_confidence`, split `direct_id` / `direct_name` / `signal_map_only`, and stop treating plain `hitCount` as proof of a true match
- boundary:
  - repo locked to `kotovela-workbench`
  - branch locked to `feature/snapshot-sync-ready`
  - evidence paths stay inside current repo conventions: `.evidence/dev73/`, `screenshots/dev73/`, `docs/task-log/`

## code_scope
- `src/components/EvidenceObjectLinks.tsx`
- `src/fixtures/evidenceParserFailureFixtures.ts`
- `src/lib/evidenceAcceptance.ts`
- `src/pages/EvidenceAcceptancePage.tsx`
- `scripts/evidence-parser-fixture-tests.ts`
- `scripts/export-dev73-parser-dataset.ts`
- `scripts/prepare-dev73-evidence.mjs`
- `scripts/capture-dev73.mjs`
- `docs/task-log/DEV-73-evidence.md`

## parser_match_observability
- row output now carries:
  - `matchSource`: `none | direct_id | direct_name | signal_map_only`
  - `matchConfidence`: `none | low | medium | high`
- acceptance rule change:
  - `resolved` now requires `hitCount > 0` plus `matchSource in {direct_id, direct_name}`
  - `signal_map_only` keeps link chips for observability, but is classified as `no_object_match` instead of a true parser hit
- fixture coverage:
  - added `fixture-signal-map-only-hit` as the regression guard for heuristic-only linkbacks

## regression_dataset
- source: `.evidence/dev73/parser-fixture-dataset.json`
- rows: `7`
- mismatches: `0`
- summary:
  - category: `missing_signals=1`, `text_too_thin=2`, `no_object_match=3`, `resolved=1`
  - match_source: `none=2`, `signal_map_only=4`, `direct_name=1`
  - match_confidence: `none=2`, `low=4`, `medium=1`

## verification
- npm_build: pass
  - `.evidence/dev73/dev73-npm-build.log`
- npm_test: pass, parser fixture gate + stabilization suite `32/32`
  - `.evidence/dev73/dev73-npm-test.log`
- mode builds: pass
  - `.evidence/dev73/dev73-build-internal.log`
  - `.evidence/dev73/dev73-build-opensource.log`
- capture builds: pass
  - `.evidence/dev73/dev73-build-internal-capture.log`
  - `.evidence/dev73/dev73-build-opensource-capture.log`

## screenshots
- `screenshots/dev73/DEV-73-internal-evidence-acceptance-overview.png`
- `screenshots/dev73/DEV-73-internal-parser-fixture-dataset.png`
- `screenshots/dev73/DEV-73-internal-evidence-unresolved.png`
- `screenshots/dev73/DEV-73-opensource-evidence-isolation.png`

## audit_decision_api_evidence
- api:
  - `.evidence/dev73/dev73-tasks-board-api.json`
  - `.evidence/dev73/dev73-leads-api.json`
  - `.evidence/dev73/dev73-audit-log-api.json`
  - `.evidence/dev73/dev73-api-summary.json`
- decision log:
  - `.evidence/dev73/dev73-decision-log.json`
- parser dataset:
  - `.evidence/dev73/parser-fixture-dataset.json`
- logs:
  - `.evidence/dev73/dev73-parser-export.log`
  - `.evidence/dev73/dev73-prepare.log`
  - `.evidence/dev73/dev73-capture-internal.log`
  - `.evidence/dev73/dev73-capture-opensource.log`
  - `.evidence/dev73/dev73-npm-build.log`
  - `.evidence/dev73/dev73-npm-test.log`

## mode_isolation
- internal: `.evidence/dev73/mode-isolation-internal.json`
  - evidence chip count = `24`
- opensource: `.evidence/dev73/mode-isolation-opensource.json`
  - evidence chip count = `0`
- result:
  - internal still renders parser rows, match source/confidence chips, and object links
  - opensource still hides internal payload and object link chips

## checkpoint
- `resolveEvidenceMatch` now exposes match provenance before UI rendering, so the same source-of-truth powers page output and regression fixtures
- DEV-72's ambiguous heuristic hits are now explicit: they still surface as observable links, but no longer count as accepted parser success when the row only matched through the signal map
- the evidence acceptance page now prints `match_source` and `match_confidence` on fixture rows, unresolved rows, and live parser rows

## dev74_checkpoint
- next useful checkpoint: split `signal_map_only` further by object kind or token origin, for example `signal_map_account`, `signal_map_room`, `signal_map_content`, so DEV-74 can tell which heuristic map is drifting instead of only knowing that fallback fired
