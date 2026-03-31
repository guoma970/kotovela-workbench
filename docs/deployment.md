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
4. `api/office-instances.js` 作为服务端接口保留 `/api/office-instances`
5. 前端通过同域 `/api/office-instances` 获取实例状态

这样可以得到一个：
- 手机可打开
- 飞书内可直接访问
- 不依赖本地 `localhost`
- 仍保留实例状态接口的预发布版本

## 实例状态同步（远程查看）

本地开发环境可以直接通过 `openclaw sessions` 读到实时状态。  
远程预发布环境（例如 Vercel）读不到你本机的 OpenClaw 运行态，所以需要一份最近同步的快照作为 fallback。

### 手动同步一次状态快照

```bash
npm run sync:office-snapshot
```

这会更新：

```text
data/office-instances.snapshot.json
```

建议节奏：
- 每次准备发布/推送前，先跑一次 `npm run sync:office-snapshot`
- 然后再 `git add` / `commit` / `push`
- Vercel 发布后，远程页会优先读本机实时数据；拿不到时自动退回到这份最近同步的快照

### 每 10 分钟自动同步一次（推荐）

仓库已提供：

```text
.github/workflows/sync-office-snapshot.yml
```

这个 workflow 会：

- 每 10 分钟执行一次
- 在 runner 上运行 `npm run sync:office-snapshot`
- 仅当 `data/office-instances.snapshot.json` 发生变化时自动提交并推送
- 借助现有 GitHub + Vercel 链路把远程页更新出去

前提：

- 必须使用 `self-hosted runner`
- runner 所在机器要能直接执行 `openclaw sessions`
- runner 需要挂在这个仓库上，并且常驻在线

如果没有 self-hosted runner，当前仍以“手动同步 snapshot”作为远程更新方式。

### 本机定时同步（macOS launchd）

如果你更希望直接在本机自动跑，而不是先接 GitHub runner，仓库还提供了 `launchd` 方案，见：

```text
docs/ops/office-snapshot-sync.md
```

这套方案适合：

- 你本机就是 OpenClaw 运行机
- 你希望每 10 分钟自动生成并推送 snapshot
- 你愿意用一个“专门用于同步的干净 clone”来执行自动任务

### 当前策略

- 本机打开：优先实时
- 远程预发布打开：优先实时接口，失败时退回快照
- 下一步如果要做到真正“持续实时”，再补本机到云端的自动状态同步

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
- 定时 snapshot 同步：`.github/workflows/sync-office-snapshot.yml`

## 分支约定

- `main`：基线分支
- `feat/*`：功能开发分支

## 发布建议（V1 Demo）

1. 在 `feat/*` 完成阶段性收口（含页面截图）
2. 发起 PR 到 `main`
3. PR 通过后并入 `main` 作为里程碑提交
