# Contributing to OpenClaw × Kotovela

> This public repository only keeps the public-safe, mock-only showcase baseline. Private execution features and later product enhancements must not flow back into this public repo.

## Development flow

1. 从 `main` 拉最新：

   ```bash
   git checkout main
   git pull
   git checkout -b feat/your-task-name
   ```

2. 提交前执行：

   ```bash
   bash validate_repo.sh
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

## Public-safe boundaries

Do not add private runtime files, live API/server integrations, real tokens, local private paths, internal group IDs, or live workspace payloads. Keep examples synthetic and suitable for https://openclaw-kotovela.vercel.app.

## Directory boundaries

The public `src/` tree should stay within demo/showcase boundaries:

- `components/`：通用组件
- `layout/`：主布局骨架
- `pages/`：页面视图
- `data/`: mock/demo data
- `lib/`：联动与工具逻辑
- `types/`：类型定义
