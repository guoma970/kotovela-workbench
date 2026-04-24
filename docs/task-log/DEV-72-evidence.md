# DEV-72 Evidence

## target
- refreshed_at: 2026-04-24 19:44 GMT+8
- goal: split DEV-71 surfaced parser misses into finer failure classes, persist them as fixtures, and convert them into a regression dataset that can be rerun in test/build acceptance
- boundary:
  - repo locked to `kotovela-workbench`
  - branch locked to `feature/snapshot-sync-ready`
  - evidence paths stay inside current repo conventions: `.evidence/dev72/`, `screenshots/dev72/`, `docs/task-log/`

## code_scope
- `src/fixtures/evidenceParserFailureFixtures.ts`
- `src/lib/evidenceAcceptance.ts`
- `src/pages/EvidenceAcceptancePage.tsx`
- `scripts/evidence-parser-fixture-tests.ts`
- `scripts/export-dev72-parser-dataset.ts`
- `scripts/prepare-dev72-evidence.mjs`
- `scripts/capture-dev72.mjs`
- `scripts/run-stabilization-suite.mjs`
- `docs/task-log/DEV-72-evidence.md`

## parser_failure_split
- `missing_signals`
  - reason: `signal_parts_empty`
  - fixture count: `1`
- `text_too_thin`
  - reason: `text_under_min_length`
  - fixture count: `2`
- `no_object_match`
  - reason: `signals_present_but_unmapped`
  - fixture count: `2`
- `resolved`
  - reason: `resolved`
  - control fixture count: `1`

## regression_dataset
- source: `.evidence/dev72/parser-fixture-dataset.json`
- rows: `6`
- mismatches: `0`
- purpose:
  - lock parser failure taxonomy to deterministic fixtures
  - keep one positive control row so test output distinguishes parser breakage from empty dataset drift

## verification
- npm_build: pass
  - `.evidence/dev72/dev72-npm-build.log`
- npm_test: pass, 32/32 stabilization cases + parser fixture dataset gate
  - `.evidence/dev72/dev72-npm-test.log`
  - console run includes fixture dataset categories before stabilization summary
- mode builds: pass
  - `.evidence/dev72/dev72-build-internal.log`
  - `.evidence/dev72/dev72-build-opensource.log`
- parser_fixture_test: pass
  - invoked via `npm test`
  - script: `scripts/evidence-parser-fixture-tests.ts`

## screenshots
- `screenshots/dev72/DEV-72-internal-evidence-acceptance-overview.png`
- `screenshots/dev72/DEV-72-internal-parser-fixture-dataset.png`
- `screenshots/dev72/DEV-72-internal-evidence-unresolved.png`
- `screenshots/dev72/DEV-72-opensource-evidence-isolation.png`

## audit_decision_api_evidence
- api:
  - `.evidence/dev72/dev72-tasks-board-api.json`
  - `.evidence/dev72/dev72-leads-api.json`
  - `.evidence/dev72/dev72-audit-log-api.json`
  - `.evidence/dev72/dev72-api-summary.json`
- decision log:
  - `.evidence/dev72/dev72-decision-log.json`
- parser dataset:
  - `.evidence/dev72/parser-fixture-dataset.json`
- capture/build logs:
  - `.evidence/dev72/dev72-prepare.log`
  - `.evidence/dev72/dev72-capture-internal.log`
  - `.evidence/dev72/dev72-capture-opensource.log`
  - `.evidence/dev72/dev72-npm-build.log`
  - `.evidence/dev72/dev72-npm-test.log`
  - `.evidence/dev72/dev72-build-internal.log`
  - `.evidence/dev72/dev72-build-opensource.log`

## mode_isolation
- internal: `.evidence/dev72/mode-isolation-internal.json`
  - evidence chip count = `24`
- opensource: `.evidence/dev72/mode-isolation-opensource.json`
  - evidence chip count = `0`
- result:
  - internal still renders evidence rows and object links
  - opensource still hides internal payload and parser rows

## checkpoint
- parser classification was extracted from page-local branching into `src/lib/evidenceAcceptance.ts`, so page rendering and regression tests now share one taxonomy
- false-positive heuristic hits no longer auto-count as `resolved`; rows now need a direct object match to be treated as successful link-back
- DEV-71 exposed miss buckets are now persisted as fixture rows and shown back on the evidence acceptance page as a dedicated dataset card
- `npm test` now gates on the parser fixture dataset before the existing stabilization suite, so future parser drift shows up as a hard regression instead of a screenshot-only change

## dev73_checkpoint
- next useful checkpoint: add per-row `match_source` observability, for example `direct_id`, `direct_name`, `signal_map_only`, so DEV-73 can separate true parser hits from heuristic fallback hits without inferring from `hitCount` alone
