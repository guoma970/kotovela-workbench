# Vercel 部署清单（公开 Demo + 内部驾驶舱）

## 产品定位（与对外话术一致）

- **公开版（Demo）**  
  - **开源展示**：给同样使用 **OpenClaw** 的人下载、本地跑、参考实现。  
  - **KOTOVELA 营销**：可对外讲的品牌与产品叙事、截图与链接。  
  - **材料用途**：后续用于 **GPT Pro / 类似计划的试用或权益申请** 时，可作为「公开可访问的 OSS 演示」佐证（以各平台当时规则为准）。  
  - **线上站点不需要 API**：访客只看到仓库内置 **Mock** 叙事，**不依赖**你配置任何 office 接口；也**不必**在 Vercel 为公开项目配 `VITE_OFFICE_INSTANCES_*`。

- **内部驾驶舱（Internal）**  
  - **你真实在用**：看 **自己** 各实例工作状态、中控总览、项目进度与轮询/上次同步。  
  - **数据**：自建 **Mac mini API（隧道 HTTPS）**、或 Vercel 同域 `/api/office-instances`（多为快照）、失败时 Mock 回退。

---

仓库已配置：

- `vercel.json`：SPA 回写、`/api/*` 不走 `index.html`、PWA manifest 响应头
- `scripts/vercel-build.mjs`：用 **`VERCEL_BUILD_MODE`** 选择 `build:demo` 或 `build:internal`
- 根目录 `api/office-instances.ts`：在 **Vercel 无 OpenClaw CLI** 时用 **`data/office-instances.snapshot.json`** 兜底（主要服务 **Internal** 部署；公开 Demo 前端在 Mock 模式下**不会请求**该接口）

## 1. 建议：两个 Vercel 项目（同一 Git 仓库）

| 项目 | 用途 | `VERCEL_BUILD_MODE` | 访问人群 |
|------|------|---------------------|----------|
| A | 公开开源演示 / 营销 | `demo` 或留空 | 社区、同样用 OpenClaw 的开发者、对外链接、申请材料 |
| B | 内部驾驶舱（实机状态） | `internal` | 你本人 / 小团队；建议 **Vercel Password Protection / SSO** 或仅可信链接 |

两个项目都 **Import 同一 GitHub 仓库**，在各自 **Settings → Environment Variables** 里区分变量即可。

## 2. 必做配置（每个项目）

1. **Framework Preset**：Vite（一般自动识别）
2. **Root Directory**：仓库根（默认）
3. **Build Command**：已由 `vercel.json` 固定为 `node scripts/vercel-build.mjs`（勿改成 `vite build` 单命令，否则选不了模式）
4. **Output Directory**：`dist`（Vite 默认，一般自动）
5. **Install Command**：`npm install`（默认）

## 3. 环境变量

### 公开项目（Demo）

- **`VERCEL_BUILD_MODE`**：不设或设为 `demo`
- 一般 **无需** 再配任何 `VITE_*`：构建会读取仓库里的 `.env.demo`（`VITE_DATA_SOURCE=mock`）
- **刻意不依赖线上 API**：公开站点只做展示与拉新，无需也不应把内部实例接口暴露给访客

### 内部项目（Internal）

- **`VERCEL_BUILD_MODE`** = `internal`（**必填**，否则会变成 Demo 包）
- 默认可依赖仓库内 **`.env.internal`**（已随 Git 提交时）包含轮询、模式等
- **外出要看 Mac mini 实时数据**时，在 Vercel 增加（会覆盖 `.env.internal` 里同名字段）：

| 变量 | 说明 |
|------|------|
| `VITE_OFFICE_INSTANCES_API_PATH` | 填 **完整 HTTPS** 地址，例如隧道到 Mac mini 的 `https://xxxx.trycloudflare.com/api/office-instances?token=你的密钥` |
| （可选）`VITE_POLLING_INTERVAL_MS` | 默认内部构建为 5s，可按需改 |

**注意**：带 token 的 URL 会打进前端静态包，务必配合 **隧道访问控制 + 定期轮换 token**，并限制 Internal 站点访问范围。

## 4. 部署后自测

- **Demo**：任意页数据源为 **Mock**；打开开发者工具 Network，**不应**出现对 office 实例接口的请求（除非有人误改构建变量）
- **Internal**：**中控**是否显示「上次同步」、数据源是否为 OpenClaw / 回退 Mock
- **Internal 可选**：`GET /api/office-instances` 在同域应返回 JSON（Vercel 上一般为 **snapshot**；连 Mac mini 时以前端 `VITE_OFFICE_INSTANCES_API_PATH` 为准）
- 两站均可试 **添加到主屏幕**（见 `docs/deployment.md`「轻应用」）

## 5. 自定义域名（推荐：www 公开 · hub 内部）

**「实际域名」**指你在浏览器里访问用的 **HTTPS 主机名**（可以是 Vercel 默认 `*.vercel.app`，也可以是你自己的域名）。

若你持有 **kotovela.com**，建议分工：

| 主机名 | 绑定的 Vercel 项目 | `VERCEL_BUILD_MODE` | 用途 |
|--------|--------------------|---------------------|------|
| `www.kotovela.com`（或根域做跳转） | **公开 Demo** | `demo` 或留空 | 开源展示、营销、申请材料；PWA 主屏幕显示 **Workbench** |
| `hub.kotovela.com` | **内部驾驶舱** | `internal` | 你日常用的轻应用；PWA 显示 **HUB**；建议访问控制 |

**不是必须**叫 `hub`——也可用 `ops.`、`dash.` 等；关键是 **公开与内部两个源站分离**，避免把内部实例接口和公开展示混在同一认知里。

**DNS（示例）**

- `www` → CNAME 到 Vercel 提供的目标（公开项目）
- `hub` → CNAME 到内部项目的目标（与上不同子域可在同一 Vercel 账号下两个项目分别添加域名）

在各自 Vercel 项目 **Settings → Domains** 里添加对应主机名并按提示验证；**必须 HTTPS**（Vercel 自动证书），PWA 与混合内容策略才完整。

## 6. 常见问题

**Q：Internal 页面一直是 Mock？**  
检查 `VERCEL_BUILD_MODE=internal` 是否在该环境的 **Production**（及 Preview 如需）都已设置；重新 Deploy。

**Q：想连家里 Mac mini API？**  
Mac mini 上跑 `npm run serve:office-api`，用 Cloudflare Tunnel 等得到 HTTPS，把完整 API URL 写入 `VITE_OFFICE_INSTANCES_API_PATH` 后 **重新部署**（Vite 在构建期写入该变量）。

**Q：快照太旧？**  
在本机或 CI 执行 `npm run sync:office-snapshot`，提交 `data/office-instances.snapshot.json` 后再推送到触发 Vercel 构建。

---

## 公开版定稿（可选：长期不随主分支迭代）

**可以**把公开版当作「营销 / 开源展示」的**稳定面**，后续**少更新或不更新**；内部驾驶舱继续在 `main` 上迭代即可。

| 做法 | 说明 |
|------|------|
| **Git 打标签** | 例如 `git tag demo/v1.0` 标记当前对外叙事满意的提交。 |
| **Vercel 公开项目绑分支** | Production Branch 设为 `main` 或单独维护的 `release/demo`；若希望**完全冻结**，可把公开项目的 Production 指向**只含修复的维护分支**或**固定 tag**（按 Vercel 支持的 Git 引用方式配置）。 |
| **内部项目** | 仍跟踪 `main`（或你的工作分支），`VERCEL_BUILD_MODE=internal`。 |

**数据安全（已实现）**

- 公开构建为 **`build:demo`**，仓库内 **`.env.demo` 固定 `VITE_DATA_SOURCE=mock`**，运行时**不会**请求你的实例接口。  
- **`scripts/verify-demo-build-safe.mjs`** + **`vercel-build.mjs`**：若在公开构建环境中误设 **`VITE_DATA_SOURCE=openclaw`** 或 **`VITE_MODE=internal`**，**构建会直接失败**，避免把真实数据模式打进对外站点。

**营销与开源**

- 当前公开版 = **通用 Mock 叙事** + 可克隆本地运行，**不含你的实机状态**，适合对外链接、README、申请材料。  
- 「定稿」更多是**流程选择**：公开站点少动；**安全底线**由上述校验与 Mock 模式保证，而不是必须永远不改代码。
