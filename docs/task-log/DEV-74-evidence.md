# DEV-74 Evidence

## target
- refreshed_at: 2026-04-24 22:11 GMT+8
- goal: split `signal_map_only` into source-aware heuristic buckets such as `signal_map_account` / `signal_map_room` / `signal_map_content`, so Evidence Acceptance can show which heuristic family is drifting
- boundary:
  - repo locked to `kotovela-workbench`
  - branch locked to `feature/snapshot-sync-ready`
  - evidence paths stay inside current repo conventions: `.evidence/dev74/`, `screenshots/dev74/`, `docs/task-log/`

## code_scope
- `src/components/EvidenceObjectLinks.tsx`
- `src/lib/evidenceAcceptance.ts`
- `src/fixtures/evidenceParserFailureFixtures.ts`
- `src/pages/EvidenceAcceptancePage.tsx`
- `scripts/evidence-parser-fixture-tests.ts`
- `scripts/export-dev74-parser-dataset.ts`
- `scripts/prepare-dev74-evidence.mjs`
- `scripts/capture-dev74.mjs`
- `docs/task-log/DEV-74-evidence.md`

## heuristic_drift_observability
- `matchSource` now exposes:
  - `none | direct_id | direct_name | signal_map_account | signal_map_room | signal_map_content | signal_map_only`
- source split rule:
  - `signal_map_account`: heuristic linkback mainly driven by `account_line` or `attribution`
  - `signal_map_room`: heuristic linkback mainly driven by `source_line` or room-like source tokens
  - `signal_map_content`: heuristic linkback mainly driven by `content_line` or `project_line`
  - `signal_map_only`: fallback bucket kept only for non-structured or uncategorized heuristic hits
- page observability:
  - Evidence Acceptance now prints heuristic drift counts separately instead of collapsing all fallback hits into one bucket
  - fixture cards, unresolved rows, and live parser rows all continue to show `match_source` and `match_confidence`

## regression_dataset
- source: `.evidence/dev74/parser-fixture-dataset.json`
- rows: `8`
- mismatches: `0`
- summary:
  - category: `missing_signals=1`, `text_too_thin=2`, `no_object_match=4`, `resolved=1`
  - match_source: `none=2`, `signal_map_only=1`, `signal_map_room=1`, `signal_map_account=2`, `signal_map_content=1`, `direct_name=1`
  - match_confidence: `none=2`, `low=5`, `medium=1`
- new regression guard:
  - `fixture-content-signal-hit` locks `content_line`-driven fallback into `signal_map_content`

## verification
- `npm run build`: pass
  - `.evidence/dev74/dev74-npm-build.log`
- `npm test`: pass, stabilization suite `32/32` + parser fixture regression `8 rows / 0 mismatches`
  - `.evidence/dev74/dev74-npm-test.log`
- mode builds: pass
  - `.evidence/dev74/dev74-build-internal.log`
  - `.evidence/dev74/dev74-build-opensource.log`
- capture builds: pass
  - `.evidence/dev74/dev74-build-internal-capture.log`
  - `.evidence/dev74/dev74-build-opensource-capture.log`

## screenshots
- `screenshots/dev74/DEV-74-internal-evidence-acceptance-overview.png`
- `screenshots/dev74/DEV-74-internal-parser-fixture-dataset.png`
- `screenshots/dev74/DEV-74-internal-evidence-unresolved.png`
- `screenshots/dev74/DEV-74-opensource-evidence-isolation.png`

## audit_decision_api_evidence
- api:
  - `.evidence/dev74/dev74-tasks-board-api.json`
  - `.evidence/dev74/dev74-leads-api.json`
  - `.evidence/dev74/dev74-audit-log-api.json`
  - `.evidence/dev74/dev74-api-summary.json`
- decision log:
  - `.evidence/dev74/dev74-decision-log.json`
- parser dataset:
  - `.evidence/dev74/parser-fixture-dataset.json`
- logs:
  - `.evidence/dev74/dev74-parser-export.log`
  - `.evidence/dev74/dev74-prepare.log`
  - `.evidence/dev74/dev74-capture-internal.log`
  - `.evidence/dev74/dev74-capture-opensource.log`
  - `.evidence/dev74/dev74-npm-build.log`
  - `.evidence/dev74/dev74-npm-test.log`

## mode_isolation
- internal: `.evidence/dev74/mode-isolation-internal.json`
  - evidence chip count = `24`
- opensource: `.evidence/dev74/mode-isolation-opensource.json`
  - evidence chip count = `0`
- result:
  - internal still renders parser rows, heuristic split chips, and object links
  - opensource still hides internal evidence payload and object link chips

## checkpoint
- `resolveEvidenceMatch` now distinguishes which heuristic family created a fallback match, instead of only saying `signal_map_only`
- Evidence Acceptance can now tell whether drift is accumulating on account mapping, room/source mapping, or content mapping
- acceptance semantics stay stable: only `direct_id` and `direct_name` count as resolved success, while heuristic buckets remain observable but unresolved

## dev75_checkpoint
- next useful checkpoint: add per-bucket hit thresholds and trend snapshots, for example compare `signal_map_account` / `signal_map_room` / `signal_map_content` across recent API samples so DEV-75 can flag which heuristic family regressed first instead of only listing raw counts
