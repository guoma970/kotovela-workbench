# DEV-20260501-P0-SEC-STAB-01 Evidence

## 任务目标

Kotovela Hub P0 安全与稳定性阻断项修复；按补充要求，本轮仅覆盖 T-01 / T-02 / T-03 / T-04，不继续扩大 UI-01 / P1 / P2。

## 修改范围

- T-01：`vite.config.ts` 本地绝对路径改为环境变量 + 项目相对默认值；system-mode 相关文件路径继续走 `MODE_STATE_FILE` / 项目相对默认值。
- T-02：本地 `.env.local` 清理 `VERCEL_OIDC_TOKEN`；`.env.local.example` 说明该 token 仅由 Vercel CI/CD 注入，本地不要配置。
- T-03：`api/office-instances.ts` / `src/data/officeInstancesContext.tsx` / `src/data/officeInstancesAdapter.ts` 加固。
  - API GET-only，非 GET 返回 `405` + `Allow: GET`。
  - 保留 `Cache-Control: no-store, max-age=0`。
  - CORS `Access-Control-Allow-Origin` 走 `ALLOWED_ORIGIN`。
  - `OFFICE_INSTANCES_UPSTREAM_URL` 做 URL 校验：仅 `https:`，拒绝 localhost / private / internal 网段，支持 `OFFICE_INSTANCES_UPSTREAM_ALLOW_HOSTS` 白名单。
  - 保留 upstream timeout 与 `response.ok` 检查。
  - 前端请求使用 `AbortController` 取消慢请求；轮询增加 jitter；用 request id 防止乱序响应覆盖新数据。
  - 外部 payload 入口使用轻量 schema/type guard；未新增 zod 依赖。
- T-04：`src/App.tsx` 路由层统一 ErrorBoundary。
  - 未新增 `react-error-boundary` 依赖；当前 wrapper/策略不允许裸 npm 安装，且用 React class ErrorBoundary 可满足 P0 最小修复。
  - fallback 页面包含友好错误提示、错误摘要、刷新按钮。

## 改动文件

P0 相关文件：

- `vite.config.ts`
- `.env.local`
- `.env.local.example`
- `api/office-instances.ts`
- `src/data/officeInstancesContext.tsx`
- `src/data/officeInstancesAdapter.ts`
- `src/App.tsx`
- `docs/task-log/DEV-20260501-P0-SEC-STAB-01-evidence.md`

pre-existing frozen UI changes（本轮不继续扩大、不混入 P0 范围）：

- `src/components/FocusSummaryBar.tsx`
- `src/config/brand.ts`
- `src/config/instanceDisplayNames.ts`
- `src/config/instanceGlyphs.ts`
- `src/index.css`
- `src/layout/AppShell.tsx`
- `src/lib/statusLabels.ts`
- `src/pages/AgentsPage.tsx`
- `src/pages/AutoTasksPage.tsx`
- `src/pages/ConsultantsPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/EvidenceAcceptancePage.tsx`
- `src/pages/LeadsPage.tsx`
- `src/pages/ProjectsPage.tsx`
- `src/pages/RoomsPage.tsx`
- `src/pages/SystemControlPage.tsx`
- `src/pages/TasksPage.tsx`
- `public/manifest.demo.webmanifest`
- `docs/task-log/DEV-20260501-UI-01-evidence.md`

Other pre-existing / generated changes observed before this P0 pass and left untouched unless produced by verification:

- `data/scheduler-memory.json`
- `data/scheduler-template-pool.json`
- `docs/deployment.md`
- `docs/task-log/DEV-20260416-43-stabilization.md`
- `package.json`
- `public/system-test-results.json`
- `server/data/audit-log.json`
- `server/officeInstances.ts`
- `.evidence/**`
- `api/model-usage.ts`
- `docs/ops/feishu-dev-handoff.md`
- `docs/task-log/DEV-20260430-p0-core-loop-ledger.md`
- `scripts/check-office-api.mjs`
- `scripts/install-office-api-launchd.sh`
- `scripts/run-office-api.sh`
- `scripts/uninstall-office-api-launchd.sh`
- `server/modelUsage.ts`
- `src/pages/ModelUsagePage.tsx`

## P0 checklist

- [x] T-01 vite local absolute `/Users/ztl` runtime path removed from active config constants; env override + project-relative defaults used.
- [x] T-02 `.env.local` contains no `VERCEL_OIDC_TOKEN`; token value was not printed or copied into evidence.
- [x] T-02 `.env.local.example` documents Vercel-only token injection and warns local developers not to configure it.
- [x] T-03 office instances API constrained to GET-only and hardened upstream URL validation.
- [x] T-03 client request cancellation / jitter / out-of-order protection present.
- [x] T-03 payload schema/type guard present without adding zod.
- [x] T-04 route-level ErrorBoundary present with friendly fallback and refresh button.

## Build/Test 输出

### `/Users/ztl/.openclaw/bin/kotovela-hub-verify all`

```text
> openclaw-workbench@0.0.0 lint
> eslint .

> openclaw-workbench@0.0.0 build
> tsc -b && vite build

vite v8.0.3 building client environment for production...
transforming...✓ 60 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.08 kB │ gzip:   0.47 kB
dist/assets/index-CrSbJd6E.css   64.99 kB │ gzip:  12.73 kB
dist/assets/index-Du_Jaj28.js   473.44 kB │ gzip: 129.72 kB

✓ built in 152ms
```

### `/Users/ztl/.openclaw/bin/kotovela-hub-verify test`

```text
> openclaw-workbench@0.0.0 test
> node scripts/run-stabilization-suite.mjs

{
  "total": 10,
  "categories": [
    { "id": "fixture-missing-structured-signals", "category": "missing_signals", "reason": "signal_parts_empty", "match_source": "none", "match_confidence": "none" },
    { "id": "fixture-thin-title-only", "category": "text_too_thin", "reason": "text_under_min_length", "match_source": "none", "match_confidence": "none" },
    { "id": "fixture-thin-signal-only", "category": "text_too_thin", "reason": "text_under_min_length", "match_source": "signal_map_only", "match_confidence": "low" },
    { "id": "fixture-orphan-consultant", "category": "no_object_match", "reason": "signals_present_but_unmapped", "match_source": "signal_map_room", "match_confidence": "low" },
    { "id": "fixture-unknown-account-line", "category": "no_object_match", "reason": "signals_present_but_unmapped", "match_source": "signal_map_room", "match_confidence": "low" },
    { "id": "fixture-same-account-different-source", "category": "no_object_match", "reason": "signals_present_but_unmapped", "match_source": "signal_map_room", "match_confidence": "low" },
    { "id": "fixture-same-source-different-content", "category": "no_object_match", "reason": "signals_present_but_unmapped", "match_source": "signal_map_content", "match_confidence": "low" },
    { "id": "fixture-signal-map-only-hit", "category": "no_object_match", "reason": "signals_present_but_unmapped", "match_source": "signal_map_content", "match_confidence": "low" },
    { "id": "fixture-content-signal-hit", "category": "no_object_match", "reason": "signals_present_but_unmapped", "match_source": "signal_map_content", "match_confidence": "low" },
    { "id": "fixture-route-hit-success", "category": "resolved", "reason": "resolved", "match_source": "direct_name", "match_confidence": "medium" }
  ]
}
{
  "task_id": "DEV-20260416-44",
  "run_id": "stab-1777568412627",
  "generated_at": "2026-04-30T17:00:14.485Z",
  "total_cases": 32,
  "pass": 32,
  "fail": 0,
  "failed_modules": [],
  "build_status": "pass",
  "commit_message": "fix: close stabilization blockers for launch candidate"
}
```

## 额外验证 / blocker

- API 异常请求测试结果：blocker: wrapper missing api negative test capability（当前安全 wrapper 无非 GET / upstream 私网 URL 负向请求测试入口；未用裸 curl/node 绕过）。
- ErrorBoundary fallback 截图：blocker: wrapper missing screenshot capability for forced ErrorBoundary fallback（wrapper 有项目 capture 入口，但无“注入路由渲染异常并截图 fallback”的安全入口；未用 canvas/localhost 绕过）。
- `build:internal`：现已可通过 `/Users/ztl/.openclaw/bin/kotovela-hub-verify build-internal` 执行并通过。
- `build:opensource`：现已可通过 `/Users/ztl/.openclaw/bin/kotovela-hub-verify build-opensource` 执行并通过。

## Token 清理说明

- `.env.local` 已确认不含 `VERCEL_OIDC_TOKEN`。
- evidence 未回显任何 token 值。
- `.env.local.example` 明确：`VERCEL_OIDC_TOKEN` 由 Vercel CI/CD 注入，本地开发不要配置。

## Commit

- commit hash：未提交
- commit message：未提交（main 未要求 commit）

## 未完成项

- 需要 wrapper 增加 API negative test 能力后，补测：POST/PUT 返回 405 + `Allow: GET`；http URL、localhost、private/internal upstream 被拒绝；allowlist host 生效。
- 需要 wrapper 增加 forced ErrorBoundary screenshot 能力后，补交 fallback 截图。

## Claude 复审待办

- Claude 复审：待复审
- 建议重点复审：`api/office-instances.ts` SSRF 边界、CORS 默认 `*` 是否符合生产策略、ErrorBoundary fallback 是否需要接入统一设计系统样式。
