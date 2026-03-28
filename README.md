# KOTOVELA Workbench

KOTOVELA Workbench is a lightweight React + TypeScript + Vite front-end for the **言町科技工作台** scenario.

It is designed as a command-and-control style dashboard prototype for coordinating multiple instances:

- Dashboard overview (blockers, active instances, pending decisions)
- Agents / Rooms / Projects / Tasks pages
- Cross-page linkage by project/agent/task/room identity
- Demo data only (mock only, no real API integration yet)

## Goals (当前版本)

- 完成可演示的产品雏形（可浏览页面）
- 保持统一视觉层级，支持中枢感强的主界面信息展示
- 限定“原型演示”边界：不接真实 API，不做生产后台

## Run

```bash
# install
npm install

# dev
npm run dev

# verify
npm run lint
npm run build
```

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router

## Directory Layout

- `src/`：前端源码
  - `components/`：通用展示组件
  - `layout/`：页面布局
  - `pages/`：五大主页面（Dashboard / Agents / Projects / Rooms / Tasks）
  - `data/`：mock 数据定义
  - `lib/`：联动与聚焦逻辑
  - `types/`：数据类型
- `docs/`：文档与任务记录
- `.github/`：CI 与 PR 模板
