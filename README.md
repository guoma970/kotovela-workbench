# 言町科技协作驾驶舱（项目代号：KOTOVELA）
![CI](https://github.com/ztl970/kotovela-workbench/actions/workflows/ci.yml/badge.svg)


言町科技协作驾驶舱是一个轻量的 React + TypeScript + Vite 前端原型，用于承载言町科技内部的多实例协同场景；当前主线项目代号为 **KOTOVELA**。

它被设计成一个偏指挥台风格的协作驾驶舱，用来协调多个实例：

- Dashboard overview (blockers, active instances, pending decisions)
- Agents / Rooms / Projects / Tasks pages
- Cross-page linkage by project/agent/task/room identity
- Local live office status + remote snapshot fallback

## 当前目标

- 完成可演示的产品雏形（可浏览、可联动、可远程预发布）
- 保持统一视觉层级，支持中枢感强的主界面信息展示
- 限定“轻量驾驶舱”边界：优先本地实时与远程快照同步，不做生产后台

## 运行

```bash
# install
npm install

# dev（固定端口：5173）
npm run dev

# verify
npm run lint
npm run build
```

## 真实状态同步

- 本地打开：优先读取实时 `openclaw sessions`
- 远程打开：优先读取服务端实时结果，失败时回退到 `data/office-instances.snapshot.json`
- 仓库已提供每 10 分钟同步 snapshot 的 GitHub Workflow：
  `.github/workflows/sync-office-snapshot.yml`
- 也提供了 macOS `launchd` 本机定时同步方案：
  `docs/ops/office-snapshot-sync.md`

注意：

- 这条定时同步链路需要跑在能访问 OpenClaw 的机器上
- 因此 GitHub Workflow 需要使用 `self-hosted runner`

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

## 本地端口约定

- 言町科技协作驾驶舱（本项目）开发端口：`5173`
- 言町科技协作驾驶舱预览端口：`4173`
- 如端口被占用，启动应直接失败，不自动漂移到其他端口
- 羲果陪伴项目固定使用开发端口 `5174`
