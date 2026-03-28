# Architecture (v1)

## 1. 总体

OpenClaw Workbench is a single-page app with internal route-based pages and shared mock data for the KOTOVELA scenario.

- Router: `src/App.tsx`
- Layout: `src/layout/AppShell.tsx`
- State: in-memory `src/data/mockData.ts`
- Cross-page focus linkage: `src/lib/workbenchLinking.ts`

## 2. 数据流

- 每次页面渲染读取同一套 mock 数据（agents / projects / tasks / rooms / updates）
- 点击对象（项目/实例/任务/群）更新 URL search params（focusType + focusId）
- 各页面根据 focus/关联关系高亮相关项，并做 dim/related 视觉提示

## 3. 目标边界（当前）

- 仅前端原型（展示与协作调度视图）
- 不接入数据库/Feishu 实时数据
- 不进行权限系统与账号体系改造

## 4. 已有功能

- Dashboard 总览 + blocker 列表 + 待拍板事项 + 最近更新流
- Projects / Tasks / Agents / Rooms 页面信息增强
- 跨页联动入口（导航快速路径 + 清晰对象标识）
