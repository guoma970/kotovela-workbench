# DEV-76 evidence

## target
- refreshed_at: 2026-04-24 23:15 GMT+8
- goal: 让 `tasks-board / leads` 真实样本稳定带出 `account_line / source_line / content_line` split 命中，并把 `first_drift_source` 从 `null` 推进到可定位来源
- boundary:
  - repo: `kotovela-workbench`
  - branch: `feature/snapshot-sync-ready`
  - evidence paths: `.evidence/dev76/`, `public/evidence/dev76/`, `screenshots/dev76/`, `docs/task-log/DEV-76-evidence.md`

## code_scope
- `src/lib/evidenceAcceptance.ts`
- `src/pages/EvidenceAcceptancePage.tsx`
- `src/pages/LeadsPage.tsx`
- `src/pages/TasksPage.tsx`
- `scripts/evidence-parser-fixture-tests.ts`
- `scripts/export-dev76-drift-trend.ts`
- `scripts/prepare-dev76-evidence.mjs`
- `scripts/capture-dev76.mjs`
- `public/evidence/dev76/drift-trend.json`

## implementation
- 给 evidence row 增加 `structuredSplitSource`，不再只依赖 unresolved fallback 才记录 split bucket
- `tasks-board / leads / evidence-acceptance` 改为把真实结构化字段写成：
  - `project_line=...`
  - `source_line=...`
  - `account_line=...`
  - `content_line=...`
  - `consultant_id=...`
- `LeadsPage` 现在正式接住 `/api/leads` 的 `source_line / account_line / content_line`，并把这些字段带入 evidence linkback
- drift summary 允许“首轮已越阈值”的 split bucket 直接记为 `driftStartedAt=round-1`，避免真实样本已稳定存在时仍错误回 `null`
- 新增 DEV-76 导出/准备/截图脚本，单独沉淀本轮 evidence

## actual_result
- drift export: `public/evidence/dev76/drift-trend.json`
- `first_drift_source` 已从 `null` 推进为 `signal_map_account`
- milestone samples:
  - `stab-1776541441327` -> structured split rows `62`
  - `stab-1776675485724` -> structured split rows `56`
  - `stab-1777042208513` -> structured split rows `56`
- split coverage:
  - tasks-board: `account_line=51/87`，`source_line=51/87`，`content_line=51/87`
  - leads: `account_line=18/24`，`source_line=24/24`，`content_line=18/24`
- drift bucket result:
  - `signal_map_account`: critical, `latestCount=56`, `driftStartedAt=round-1`
  - `signal_map_only`: warning, `latestCount=2`, `driftStartedAt=round-1`
  - `signal_map_room / signal_map_content`: 当前真实样本仍未单独抬头

## verification
- `npm run build`: pass
  - `.evidence/dev76/dev76-npm-build.log`
- `npm test`: pass
  - `.evidence/dev76/dev76-npm-test.log`
  - stabilization suite: `32/32`
  - parser fixtures: `8 rows`, `0 mismatches`
- mode builds: pass
  - `.evidence/dev76/dev76-build-internal.log`
  - `.evidence/dev76/dev76-build-opensource.log`
- capture builds: pass
  - `.evidence/dev76/dev76-build-internal-capture.log`
  - `.evidence/dev76/dev76-build-opensource-capture.log`
- preview logs:
  - `.evidence/dev76/dev76-preview-internal.log`
  - `.evidence/dev76/dev76-preview-opensource.log`
- note:
  - 4173 曾被旧 preview 进程占用，本轮已定位并清理旧 node 监听，再恢复固定端口截图链路

## screenshots
- `screenshots/dev76/DEV-76-internal-evidence-acceptance-overview.png`
- `screenshots/dev76/DEV-76-internal-tasks-split-evidence.png`
- `screenshots/dev76/DEV-76-internal-leads-split-evidence.png`
- `screenshots/dev76/DEV-76-opensource-evidence-isolation.png`

## audit_decision_api_evidence
- api:
  - `.evidence/dev76/dev76-tasks-board-api.json`
  - `.evidence/dev76/dev76-leads-api.json`
  - `.evidence/dev76/dev76-audit-log-api.json`
  - `.evidence/dev76/dev76-api-summary.json`
- decision log:
  - `.evidence/dev76/dev76-decision-log.json`
- drift trend:
  - `.evidence/dev76/dev76-drift-trend.json`
  - `public/evidence/dev76/drift-trend.json`
- capture:
  - `.evidence/dev76/dev76-capture-internal.log`
  - `.evidence/dev76/dev76-capture-opensource.log`

## mode_isolation
- internal: `.evidence/dev76/mode-isolation-internal.json`
  - evidence chip count = `24`
  - drift card count = `4`
  - structured signal mentions = `37`
- opensource: `.evidence/dev76/mode-isolation-opensource.json`
  - evidence chip count = `0`
  - drift card count = `0`
  - structured signal mentions = `0`
- result:
  - internal 能看到真实 split evidence 与 drift cards
  - opensource 仍不暴露 internal evidence payload

## decision
- 本轮已把 split source 从“静态标签能力存在但真实样本未落地”推进到“真实 tasks-board / leads 样本会稳定带出结构化 split 信号，drift 面板可直接指出 `signal_map_account`”
- 仍未把 `signal_map_room / signal_map_content` 单独抬到真实主告警，说明后续要继续补 room/content 维度更有辨识度的样本，而不是只靠 account_line 先命中

## DEV-77 checkpoint
- 优先让 `source_line` 与 `content_line` 在 leads evidence 中形成可区分 bucket，不要继续全部被 `account_line` 抢先归类
- 建议补一组真实样本导出，专门覆盖：同 account 不同 source_line、同 source_line 不同 content_line，这样 DEV-77 才能把 `signal_map_room / signal_map_content` 从 0 拉起来
