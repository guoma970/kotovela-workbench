# Deployment Notes

## 本地运行（开发）

```bash
cd /path/to/repo
npm install
npm run dev
```

## 生产构建校验

```bash
npm run lint
npm run build
```

## GitHub CI

- CI 配置文件：`.github/workflows/ci.yml`
- 触发：`push` / `pull_request`

## 分支约定

- `main`：基线分支
- `feat/*`：功能开发分支

## 发布建议（V1 Demo）

1. 在 `feat/*` 完成阶段性收口（含页面截图）
2. 发起 PR 到 `main`
3. PR 通过后并入 `main` 作为里程碑提交
