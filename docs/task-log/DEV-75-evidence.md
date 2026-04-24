# DEV-75 Evidence

## target
- refreshed_at: 2026-04-24 22:53 GMT+8
- goal: 在 `signal_map_account / signal_map_room / signal_map_content` 之上补时间序列和阈值告警，对最近几轮 evidence 样本做横向比较，优先指出哪类 heuristic 先漂移
- boundary:
  - repo locked to `kotovela-workbench`
  - branch locked to `feature/snapshot-sync-ready`
  - evidence paths stay inside current repo conventions: `.evidence/dev75/`, `screenshots/dev75/`, `docs/task-log/`

## code_scope
- `src/lib/evidenceAcceptance.ts`
- `src/pages/EvidenceAcceptancePage.tsx`
- `scripts/evidence-parser-fixture-tests.ts`
- `scripts/export-dev75-drift-trend.ts`
- `scripts/prepare-dev75-evidence.mjs`
- `scripts/capture-dev75.mjs`
- `public/evidence/dev75/drift-trend.json`
- `docs/task-log/DEV-75-evidence.md`

## drift_alert_design
- 新增 `buildEvidenceDriftSummary`，对最近样本按 bucket 聚合：
  - `signal_map_account`
  - `signal_map_room`
  - `signal_map_content`
  - `signal_map_only`
- 每个 bucket 都输出：
  - `counts[] / ratios[]`
  - `latestCount / previousCount / delta`
  - `thresholdHit / alertLevel`
  - `driftStartedAt`
- 阈值口径：
  - warning: `count >= 2` 或 `ratio >= 0.2`
  - critical: `count >= 3` 或 `ratio >= 0.34`
- 页面新增 `heuristic drift alert` 面板，直接显示 recent rounds、告警级别、首轮漂移时间和每轮 bucket 对比

## recent_sample_compare
- source snapshots:
  - `.tmp/stab-1777030817229/tasks-board.json`
  - `.tmp/stab-1777030972754/tasks-board.json`
  - `.tmp/stab-1777032424115/tasks-board.json`
  - `.tmp/stab-1777039759438/tasks-board.json`
- trend evidence: `.evidence/dev75/dev75-drift-trend.json`
- actual result:
  - `round-1` ~ `round-4` unresolved 均为 `58`
  - heuristic hits 均为 `32`
  - 当前真实 recent samples 里，`signal_map_account / room / content` 尚未出现持续漂移抬头
  - 现网 recent samples 的主风险仍是 `signal_map_only = 32 / 55.17%`，被标成 `critical`
  - `first_drift_source = null`，说明 split buckets 已具备监控能力，但这 4 轮真实样本还没有出现新的 account/room/content 先行漂移证据

## verification
- `npm run build`: pass
  - `.evidence/dev75/dev75-npm-build.log`
- `npm test`: pass, stabilization suite `32/32` + parser fixture regression `8 rows / 0 mismatches`
  - `.evidence/dev75/dev75-npm-test.log`
- mode builds: pass
  - `.evidence/dev75/dev75-build-internal.log`
  - `.evidence/dev75/dev75-build-opensource.log`
- capture builds: pass
  - `.evidence/dev75/dev75-build-internal-capture.log`
  - `.evidence/dev75/dev75-build-opensource-capture.log`
- note:
  - 4173 在截图前被旧 preview 进程占用，已清理同机同用户旧 node 监听后重启固定端口链路

## screenshots
- `screenshots/dev75/DEV-75-internal-evidence-acceptance-overview.png`
- `screenshots/dev75/DEV-75-internal-heuristic-drift-alert.png`
- `screenshots/dev75/DEV-75-internal-evidence-unresolved.png`
- `screenshots/dev75/DEV-75-opensource-evidence-isolation.png`

## audit_decision_api_evidence
- api:
  - `.evidence/dev75/dev75-tasks-board-api.json`
  - `.evidence/dev75/dev75-leads-api.json`
  - `.evidence/dev75/dev75-audit-log-api.json`
  - `.evidence/dev75/dev75-api-summary.json`
- decision log:
  - `.evidence/dev75/dev75-decision-log.json`
- drift trend:
  - `.evidence/dev75/dev75-drift-trend.json`
  - `public/evidence/dev75/drift-trend.json`
- logs:
  - `.evidence/dev75/dev75-export.log`
  - `.evidence/dev75/dev75-prepare.log`
  - `.evidence/dev75/dev75-capture-internal.log`
  - `.evidence/dev75/dev75-capture-opensource.log`
  - `.evidence/dev75/dev75-npm-build.log`
  - `.evidence/dev75/dev75-npm-test.log`

## mode_isolation
- internal: `.evidence/dev75/mode-isolation-internal.json`
  - evidence chip count = `24`
  - drift card count = `4`
- opensource: `.evidence/dev75/mode-isolation-opensource.json`
  - evidence chip count = `0`
  - drift card count = `0`
- result:
  - internal 渲染 trend rounds、bucket alert cards、parser rows 和 object links
  - opensource 仍不读取 internal evidence payload，也不显示 drift cards / object links

## checkpoint
- DEV-75 已把 heuristic drift 从静态分桶推进到“最近几轮样本可比较、可阈值预警”
- 真实 recent sample 结果表明，当前先暴露的问题仍是 legacy `signal_map_only`，不是新的 account/room/content split bucket
- 这意味着下一步应优先继续往 tasks-board / leads 样本里补结构化 signal，逼出真实 split-bucket 轨迹，否则时间序列面板只会稳定提示 legacy fallback 过高

## dev76_checkpoint
- next useful checkpoint: 让 tasks-board 或 leads evidence 样本稳定带出 `account_line / source_line / content_line` 的真实 split 命中，再把 `first_drift_source` 从 `null` 推进到可定位的 account / room / content 先行漂移证据
