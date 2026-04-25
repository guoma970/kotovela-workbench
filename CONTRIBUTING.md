# Contributing to KOTOVELA Workbench

> 公开仓库只保留初始开源展示版。内部驾驶舱 / 后续增强功能请仅在 private `kotovela-hub` 演进，不回流到本仓库。

## 开发流程（建议）

1. 从 `main` 拉最新：

   ```bash
   git checkout main
   git pull
   git checkout -b feat/your-task-name
   ```

2. 提交前执行：

   ```bash
   npm run lint
   npm run build
   ```

3. 推送分支，提交 PR：

   ```bash
   git push -u origin feat/your-task-name
   ```

## Commit 约定

- `feat:` 新功能
- `chore:` 维护性调整
- `fix:` 交互/样式修复
- `refactor:` 重构

## 目录约束

本项目约定 `src/` 按以下分层：

- `components/`：通用组件
- `layout/`：主布局骨架
- `pages/`：页面视图
- `data/`：mock 数据
- `lib/`：联动与工具逻辑
- `types/`：类型定义
