# DEV-77 evidence

## target
- refreshed_at: 2026-04-25 00:43 GMT+8
- goal: 补齐“同 account，不同 source_line / content_line”的真实样本归因，让 `signal_map_room / signal_map_content` 不再被 `signal_map_account` 先吞掉
- boundary:
  - repo: `kotovela-workbench`
  - branch: `feature/snapshot-sync-ready`
  - evidence paths: `.evidence/dev77/`, `public/evidence/dev77/`, `screenshots/dev77/`, `docs/task-log/DEV-77-evidence.md`

## code_scope
- `src/lib/evidenceDriftBucket.ts`
- `src/components/EvidenceObjectLinks.tsx`
- `src/lib/evidenceAcceptance.ts`
- `src/fixtures/evidenceParserFailureFixtures.ts`
- `scripts/evidence-parser-fixture-tests.ts`
- `scripts/export-dev77-drift-trend.ts`
- `scripts/prepare-dev77-evidence.mjs`
- `scripts/capture-dev77.mjs`
- `public/evidence/dev77/drift-trend.json`

## implementation
- 新增 `inferStructuredSignalBucket`，按真实 split 关系归因：
  - `account_line` 与 `source_line` 不同，优先记为 `signal_map_room`
  - `account/source` 对齐但 `content_line` 承担分流时，记为 `signal_map_content`
  - 仅剩 account 证据时才记 `signal_map_account`
- `resolveEvidenceMatch` 与 `inferStructuredSplitSource` 共用同一 bucket 规则，避免 UI 显示和 drift summary 口径打架
- fixture 从 `8` 扩到 `10`，补两类回归样本：
  - same account different source
  - same source different content
- 新增 DEV-77 导出/准备/截图脚本，直接从 `.tmp/stab-*` 真实样本提取：
  - same account different source
  - same account + source different content

## actual_result
- drift export: `public/evidence/dev77/drift-trend.json`
- `first_drift_source` 已从 `signal_map_account` 改为 `signal_map_room`
- milestone samples:
  - `stab-1776541441327` -> `signal_map_room=70`, `signal_map_content=22`
  - `stab-1776675485724` -> `signal_map_room=66`, `signal_map_content=22`
  - `stab-1777043341147` -> `signal_map_room=66`, `signal_map_content=22`
- real sample evidence:
  - same account different source: `guoma970 -> guoshituan_official / kotovela_official / yanfami_official`
  - same account + source different content: `yanfami_official + yanfami_official -> floor_heating / layout_renovation / material_case`
- drift bucket result:
  - `signal_map_room`: critical, `latestCount=66`, `driftStartedAt=round-1`
  - `signal_map_content`: critical, `latestCount=22`, `driftStartedAt=round-1`
  - `signal_map_account`: `0`
  - `signal_map_only`: warning, `latestCount=2`

## verification
- `npm run build`: pass
  - `.evidence/dev77/dev77-npm-build.log`
- `npm test`: pass
  - `.evidence/dev77/dev77-npm-test.log`
  - stabilization suite: `32/32`
  - parser fixtures: `10 rows`, `0 mismatches`
- mode builds: pass
  - `.evidence/dev77/dev77-build-internal.log`
  - `.evidence/dev77/dev77-build-opensource.log`
- capture builds: pass
  - `.evidence/dev77/dev77-build-internal-capture.log`
  - `.evidence/dev77/dev77-build-opensource-capture.log`
- preview logs:
  - `.evidence/dev77/dev77-preview-internal.log`
  - `.evidence/dev77/dev77-preview-opensource.log`
- note:
  - 固定端口 `4173` 初次被旧 preview 进程占用，已定位 `node` 监听并清理后恢复截图链路

## screenshots
- `screenshots/dev77/DEV-77-internal-evidence-acceptance-overview.png`
- `screenshots/dev77/DEV-77-internal-tasks-split-evidence.png`
- `screenshots/dev77/DEV-77-internal-leads-split-evidence.png`
- `screenshots/dev77/DEV-77-opensource-evidence-isolation.png`

## audit_decision_api_evidence
- api:
  - `.evidence/dev77/dev77-tasks-board-api.json`
  - `.evidence/dev77/dev77-leads-api.json`
  - `.evidence/dev77/dev77-audit-log-api.json`
  - `.evidence/dev77/dev77-api-summary.json`
- decision log:
  - `.evidence/dev77/dev77-decision-log.json`
- drift trend:
  - `.evidence/dev77/dev77-drift-trend.json`
  - `public/evidence/dev77/drift-trend.json`
- capture:
  - `.evidence/dev77/dev77-capture-internal.log`
  - `.evidence/dev77/dev77-capture-opensource.log`

## mode_isolation
- internal: `.evidence/dev77/mode-isolation-internal.json`
  - evidence chip count = `24`
  - drift card count = `4`
  - structured signal mentions = `45`
- opensource: `.evidence/dev77/mode-isolation-opensource.json`
  - evidence chip count = `0`
  - drift card count = `0`
  - structured signal mentions = `0`
- result:
  - internal 能看到 room/content split drift 与真实 linkback evidence
  - opensource 仍不暴露 internal evidence payload

## decision
- 本轮闭环后，真实样本里“同 account，不同 source_line / content_line”已经能把 bucket 拉到 `room/content`，不再继续默认回 `account`
- 当前 `signal_map_account=0`，说明 DEV-76 口径里被 account bucket 吸走的样本，已经按更具体的 split 重新归位

## DEV-78 checkpoint
- 已由 `docs/task-log/DEV-78-evidence.md` 闭环“按 bucket 回采具体 unresolved row 列表”的导出
- 最新产物：`public/evidence/dev78/drift-trend.json` / `.evidence/dev78/dev78-drift-trend.json`
- `signal_map_room / signal_map_content` 现在除了总量，还能直接看到各自 top unresolved examples
