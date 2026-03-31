# Office Snapshot 定时同步

这份文档用于把“远程页每 10 分钟看到最新 snapshot”真正跑起来。

## 方案 A：GitHub Self-hosted Runner

适合你希望：

- GitHub 每 10 分钟自动跑一次
- snapshot 自动提交到仓库
- 继续复用现有 GitHub + Vercel 部署链路

仓库已提供 workflow：

```text
.github/workflows/sync-office-snapshot.yml
```

前提：

- runner 所在机器必须能直接执行 `openclaw --version`
- runner 所在机器必须能读到本机 OpenClaw 运行态
- runner 需要绑定到这个仓库，并保持在线

workflow 会：

- 每 10 分钟执行一次
- 跑 `npm run sync:office-snapshot`
- 只有 `data/office-instances.snapshot.json` 真的变化时才提交并推送

## 方案 B：macOS launchd

适合你希望：

- 不依赖 GitHub runner 常驻
- 直接在本机每 10 分钟生成并推送 snapshot

仓库已提供：

```text
scripts/run-office-snapshot-sync.sh
scripts/install-office-snapshot-launchd.sh
scripts/uninstall-office-snapshot-launchd.sh
```

### 使用前提

这套方案强烈建议放在“专门用于同步的干净 clone”里运行，不要直接挂在你正在开发的工作目录上。

原因：

- 自动脚本会先检查工作区是否干净
- 如果仓库里有未提交改动，它会直接失败退出
- 这样可以避免把开发中的本地改动误卷进自动提交

### 安装

```bash
cd /path/to/clean/kotovela-workbench
chmod +x scripts/run-office-snapshot-sync.sh
chmod +x scripts/install-office-snapshot-launchd.sh
chmod +x scripts/uninstall-office-snapshot-launchd.sh
./scripts/install-office-snapshot-launchd.sh
```

安装后会：

- 每 600 秒跑一次
- 先 `git pull --rebase origin main`
- 再执行 `npm ci`
- 然后跑 `npm run sync:office-snapshot`
- 只有 snapshot 真变化时才 `commit + push`

日志默认写到：

```text
logs/office-snapshot-sync.log
logs/office-snapshot-sync.error.log
```

### 卸载

```bash
./scripts/uninstall-office-snapshot-launchd.sh
```

## 怎么选

- 已经有 self-hosted runner：优先用方案 A
- 只想先在自己这台 Mac 上稳定跑起来：优先用方案 B
