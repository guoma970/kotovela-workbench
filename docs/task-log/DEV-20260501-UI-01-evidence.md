# DEV-20260501-UI-01 Evidence

## 1. 任务目标

Kotovela Hub UI 去技术化与可浏览性优化第一批：仅调整用户可见 UI 文案、导航标签、页面标题/副标题、按钮文案、状态标签、空状态文案和数据源提示；保持 Demo / Internal 数据边界，不改 API contract、route path、数据结构、后端逻辑。

## 2. 修改范围

本轮聚焦 Internal 中文业务工作台语义：导航、协作者状态页、总览数据源提示、系统设置、执行验证、空状态与相关页签入口。公开 Demo 英文语义保留，不改变路由和接口。

## 3. 改动文件列表

- `src/layout/AppShell.tsx`
- `src/components/FocusSummaryBar.tsx`
- `src/lib/statusLabels.ts`
- `src/pages/AgentsPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/SystemControlPage.tsx`
- `src/pages/EvidenceAcceptancePage.tsx`
- `src/pages/TasksPage.tsx`
- `src/pages/ProjectsPage.tsx`
- `src/pages/RoomsPage.tsx`
- `src/pages/LeadsPage.tsx`
- `src/pages/ConsultantsPage.tsx`
- `docs/task-log/DEV-20260501-UI-01-evidence.md`

> 注：工作区在接手前已有大量未提交改动，本轮只在上述文件内做 UI 文案层修改。

## 4. 术语替换表

| 原术语 | 新 UI 文案 |
|---|---|
| 驾驶舱层 | 工作台 |
| 调度系统 | 管理配置 |
| 执行层 | 协作者 |
| Dashboard 总览 | 总览 |
| Projects 项目 | 项目 |
| Rooms 房间 | 频道 |
| Tasks 任务 | 任务 |
| Leads 线索 | 待跟进 |
| Scheduler 调度 | 调度队列 |
| Consultants 顾问 | 角色配置 |
| Model Usage 模型额度 | 用量统计 |
| System Control 系统控制 | 系统设置 |
| Evidence Acceptance 验收 | 执行验证 |
| Agents 实例 | 协作者状态 |
| 实例 | 协作者 |
| 房间 | 频道 |
| 阻塞 | 有卡点 |
| 进行中 | 推进中 |
| 待命 | 空闲 |
| 数据源：OpenClaw | 实时数据已连接 |
| Mock / fallback / 回退提示 | 当前使用演示数据 |
| loading / 更新中 | 数据加载中… |
| 上次同步 {time} · 每 {n} 秒刷新 | {time} 更新 · 自动刷新 |
| system_mode | 系统模式 |
| publish_mode | 发布状态 |
| force_stop | 紧急停止 |
| guardrails | 安全规则 |
| 命中率 | 匹配成功率 |
| 未命中原因 | 未匹配原因 |
| 回链成功率 | 关联成功率 |
| signal_map_* | 频道/内容/账号线索匹配等业务文案 |
| 暂无任务 | 当前没有进行中的任务 · 一切顺利 |
| 暂无审计记录 | 还没有操作记录 |
| 暂无实例数据 | 协作者数据加载中，请稍候 |

## 5. Build / Test 输出摘要

已完成：

- `/Users/ztl/.openclaw/bin/kotovela-hub-verify all`
  - `npm run lint`：通过
  - `npm run build`：通过，Vite build 成功，输出 `dist/index.html`、CSS/JS assets
- `/Users/ztl/.openclaw/bin/kotovela-hub-verify build-internal`
  - `npm run build:internal`：通过
- `/Users/ztl/.openclaw/bin/kotovela-hub-verify build-opensource`
  - `npm run build:opensource`：通过
- `/Users/ztl/.openclaw/bin/kotovela-hub-verify test`
  - stabilization suite：32 / 32 pass
  - `build_status: pass`

## 6. 截图路径

已生成：

- `/Users/ztl/.openclaw/bin/kotovela-hub-verify capture-web`
- `.evidence/dev20260501-ui01/summary.json`
- `.evidence/dev20260501-ui01/capture.log`

- `screenshots/DEV-20260501-UI-01-dashboard.png`
- `screenshots/DEV-20260501-UI-01-agents.png`
- `screenshots/DEV-20260501-UI-01-system-settings.png`
- `screenshots/DEV-20260501-UI-01-evidence-validation.png`
- `screenshots/DEV-20260501-UI-01-sidebar.png`

## 7. Demo / Internal 隔离说明

本轮未改 route path、API contract、请求路径、数据结构、后端逻辑或 Demo / Internal 数据源切换逻辑。`SystemControlPage` 仍按现有 API 字段读写，仅在 UI label/option display 上做业务化展示；Evidence 页面也只把普通 UI 的 `signal_map_*` 显示名映射为业务线索匹配文案。

## 8. 未完成事项

- 深层数据样本、历史 evidence、脚本和服务端字段中仍保留技术字段名；本轮按要求未改 API/data contract，仅清普通 UI。
- commit 尚未创建；当前仍处于“已验收、可提交”状态。

## 9. 后续建议

1. 为这批 UI 文案收口单独创建 commit，避免和其他并行改动混在一起。
2. 下一轮可继续处理 Model Usage 页面主体的 token/OAuth 等专业术语，但不建议混入本批首轮范围。
3. 如要进一步降低技术字段暴露，可增加统一 display-label map，但保持底层枚举和值不变。
