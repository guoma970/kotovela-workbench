# 言町科技协作驾驶舱（项目代号：KOTOVELA）
![CI](https://github.com/ztl970/kotovela-workbench/actions/workflows/ci.yml/badge.svg)


言町科技协作驾驶舱是一个轻量的 React + TypeScript + Vite 前端原型，用于承载言町科技内部的多实例协同场景；当前主线项目代号为 **KOTOVELA**。

它被设计成一个偏指挥台风格的协作驾驶舱，用来协调多个实例：

- Dashboard overview (blockers, active instances, pending decisions)
- Agents / Rooms / Projects / Tasks pages
- Cross-page linkage by project/agent/task/room identity
- Demo data only (mock only, no real API integration yet)

## 当前目标

- 完成可演示的产品雏形（可浏览、可联动、可远程预发布）
- 保持统一视觉层级，支持中枢感强的主界面信息展示
- 限定“原型演示”边界：不接真实 API，不做生产后台

## 运行

```bash
# install
npm install

# dev
npm run dev

# verify
npm run lint
npm run build
```

## 技术栈

- React 19
- TypeScript
- Vite
- React Router

## 目录结构

- `src/`：前端源码
  - `components/`：通用展示组件
  - `layout/`：页面布局
  - `pages/`：五大主页面（Dashboard / Agents / Projects / Rooms / Tasks）
  - `data/`：mock 数据定义
  - `lib/`：联动与聚焦逻辑
  - `types/`：数据类型
- `docs/`：文档与任务记录
- `.github/`：CI 与 PR 模板
