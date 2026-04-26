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

## 预发布建议（推荐）

当前最适合先走 **Vercel 预发布**：

1. 将仓库导入 Vercel
2. Build Command 使用默认 `npm run build`
3. Output Directory 使用默认 `dist`
4. 前端使用公开 mock/showcase 数据，不接入本机 OpenClaw 运行态

这样可以得到一个：
- 手机可打开
- 飞书内可直接访问
- 不依赖本地 `localhost`
- 保持公开展示版的轻量边界

## 飞书内访问建议

- 预发布阶段：直接把 Vercel 预发布链接放进飞书群 / 文档 / 知识库
- 稳定后：再考虑挂到飞书 H5 或工作台页签

## 当前边界

- 这版更适合 **预发布 / 演示 / 验收**
- 不建议直接定义为正式生产上线
- 上线前仍建议补一次移动端验收与远程真实使用验收

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
