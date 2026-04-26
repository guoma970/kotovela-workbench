# Contributing to OpenClaw × Kotovela

> This public repository only keeps the open-source showcase baseline. Internal execution features and later product enhancements must evolve only in the private `kotovela-hub` repository and must not flow back into this public repo.

## Development flow

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

## Commit convention

- `feat:` 新功能
- `chore:` 维护性调整
- `fix:` 交互/样式修复
- `refactor:` 重构

## Directory boundaries

The public `src/` tree should stay within demo/showcase boundaries:

- `components/`：通用组件
- `layout/`：主布局骨架
- `pages/`：页面视图
- `data/`: mock/demo data
- `lib/`：联动与工具逻辑
- `types/`：类型定义
