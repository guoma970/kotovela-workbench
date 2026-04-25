# DEV-78 evidence

## target
- refreshed_at: 2026-04-25 22:49 GMT+8
- goal: 给 `signal_map_room / signal_map_content` 导出补上按 bucket 回采的 unresolved top examples，减少只看总量后还要手翻 `.tmp/stab-*` 的成本
- boundary:
  - repo: `kotovela-workbench`
  - branch: `feature/snapshot-sync-ready`
  - evidence paths: `.evidence/dev78/`, `public/evidence/dev78/`, `docs/task-log/DEV-78-evidence.md`

## code_scope
- `src/lib/evidenceAcceptance.ts`
- `scripts/evidence-parser-fixture-tests.ts`
- `scripts/export-dev78-drift-trend.ts`
- `.evidence/dev78/dev78-drift-trend.json`
- `public/evidence/dev78/drift-trend.json`

## implementation
- 新增 `listTopUnresolvedExamplesByBucket(rows, { topN })`，统一按 unresolved row 回采各 bucket 的示例
  - `signal_map_room / signal_map_content / signal_map_account` 走 `structuredSplitSource`
  - `signal_map_only` 继续走 `matchSource`
- 新增 `EvidenceBucketExample` 导出类型，落出 `rowId / source / title / detail / timestamp / signalParts`
- 新增 `scripts/export-dev78-drift-trend.ts`，在 DEV-77 时间序列导出基础上补：
  - `latest_sample`
  - `top_examples_limit`
  - `bucket_top_examples`
- parser fixture regression 补断言，锁住按 bucket 取 top example 的行为

## actual_result
- 最新重跑样本仍是 `stab-1777049000835`，但当前真实导出结果为 `unresolved_rows=0`
- `bucket_top_examples.signal_map_room = []`
- `bucket_top_examples.signal_map_content = []`
- `bucket_top_examples.signal_map_account = []`，`bucket_top_examples.signal_map_only = []`
- `signal_map_room=66`、`signal_map_content=22` 仍存在 bucket 漂移计数，但这些行已不再落入 unresolved，因此 top unresolved examples 为空
- 根因判断：这次 blocker 不是导出脚本样本筛选错了，也不是 `.tmp/stab-*` 换样本，而是 DEV-78 文档和旧导出日志停留在早先 `unresolved_rows=115` 的口径，当前解析/匹配结果已把同一批样本收敛到 `unresolved_rows=0`

## verification
- `npx tsx scripts/export-dev78-drift-trend.ts | tee .evidence/dev78/dev78-export.log`
  - result: `Exported DEV-78 drift trend to .evidence/dev78/dev78-drift-trend.json`
  - latest: `unresolved_rows=0`，`signal_map_room_examples=0`，`signal_map_content_examples=0`
- `npx tsx scripts/evidence-parser-fixture-tests.ts | tee .evidence/dev78/dev78-parser-fixture-tests.log`
  - result: `total=10`，bucket top example regression 断言通过
- `npm run build > .evidence/dev78/release-closure/npm-build.log 2>&1`
  - result: exit `0`
- `npm run build:internal > .evidence/dev78/release-closure/npm-build-internal.log 2>&1`
  - result: exit `0`

## decision
- DEV-78 导出脚本当前行为正常，`.evidence/dev78/dev78-drift-trend.json`、`public/evidence/dev78/drift-trend.json` 与真实重跑结果已重新一致
- 本次 blocker 已从“口径冲突”收敛为“room/content bucket 仍持续漂移，但 unresolved 已归零”，不再阻塞合并或内部部署窗口
- 如需继续降低 `signal_map_room/content` 漂移计数，应另开后续任务处理 bucket 命中质量，而不是继续阻塞 DEV-78 发布
