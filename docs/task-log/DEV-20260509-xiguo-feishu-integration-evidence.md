# DEV-20260509｜Kotovela Hub ↔ 羲果陪伴 + 飞书作业提醒

## 状态

- 分支：`feature/integration-feishu`
- 范围：驾驶舱侧契约、Serverless API、飞书发送、状态回写、日志闭环
- 不改事项：未改现有 UI 样式；未修改羲果陪伴仓库前端

## DEV-INTEG 模块对应

| 模块 | 完成口径 |
| --- | --- |
| DEV-INTEG-01 | 新增 `GET /api/xiguo-task?taskId=...&token=...`，羲果后台可用 taskId 拉取驾驶舱任务详情。 |
| DEV-INTEG-02 | `server/xiugDispatch.ts` 支持飞书 Open API `sendMessage`，并区分 `collab`（果果学习协同群）与 `assign`（果果学习布置群）。测试任务默认先发协同群。 |
| DEV-INTEG-03 | 派发给羲果的任务 payload 新增 `hubTaskUrl` / `statusCallbackUrl`；飞书链接带 `taskId` 与签名 `token`。 |
| DEV-INTEG-04 | 新增 `POST/PATCH /api/xiguo-task-status`，支持 `doing` / `done` / `blocker` 状态回写。 |
| DEV-INTEG-05 | 状态回写会同步写入任务 `decision_log`、`history` 与 `server/data/audit-log.json`。 |
| DEV-INTEG-06 | 新增 `POST /api/xiguo-task-alerts`，可由 OpenClaw/Vercel Cron 定时触发超时扫描，自动标记 Need Human 并发飞书提醒。 |
| DEV-INTEG-07 | 新增 HMAC 签名 token，opensource 模式返回 404；内部接口仍走 `KOTOVELA_ACCESS_SECRET` / 上游 token。 |

## API 快照

### 读取作业详情

```http
GET /api/xiguo-task?taskId=study-001&projectId=family-study&token=<signed-token>
```

成功返回：

```json
{
  "ok": true,
  "task": {
    "taskId": "study-001",
    "projectId": "family-study",
    "title": "数学练习",
    "description": "练习册第45-47页",
    "status": "doing",
    "priority": 1,
    "durationMinutes": 25,
    "needHuman": false,
    "assignedAgent": "family",
    "detailUrl": "https://kotovelahub.vercel.app/api/xiguo-task?...",
    "statusCallbackUrl": "https://kotovelahub.vercel.app/api/xiguo-task-status?..."
  }
}
```

### 回写状态

```http
POST /api/xiguo-task-status?taskId=study-001&token=<signed-token>
Content-Type: application/json

{
  "status": "done",
  "actor": "guoguo",
  "reason": "已完成"
}
```

状态取值：

- `doing`：孩子端已开始，驾驶舱显示进行中。
- `done`：孩子端已完成，驾驶舱显示完成。
- `blocker`：孩子端遇到卡点，驾驶舱标记 Need Human，并提醒小羲 / family 协作群。

### 超时 / 阻塞扫描

```http
POST /api/xiguo-task-alerts
Authorization: Bearer <KOTOVELA_ACCESS_SECRET>
Content-Type: application/json

{
  "timeoutMinutes": 30
}
```

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `XIGUO_API_URL` | 羲果陪伴接收作业派发的接口。 |
| `XIGUO_API_KEY` | 羲果陪伴接口密钥。 |
| `XIGUO_LINK_SECRET` | 作业链接签名密钥，建议生产单独配置。 |
| `XIGUO_TASK_LINK_TTL_SECONDS` | 作业链接有效期，默认 3 天。 |
| `XIGUO_ALLOWED_ORIGIN` | 允许羲果网页跨域读取任务，默认 `https://xiguo.kotovela.com`。 |
| `KOTOVELA_PUBLIC_ORIGIN` | 驾驶舱公网入口，默认 `https://kotovelahub.vercel.app`。 |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书机器人 `sendMessage` 所需凭据。 |
| `FEISHU_STUDY_COLLAB_CHAT_ID` | 果果学习协同群 chat_id；测试派发默认目标。 |
| `FEISHU_STUDY_ASSIGN_CHAT_ID` | 果果学习布置群 chat_id；确认后正式派发目标。 |
| `FEISHU_STUDY_CHAT_ID` | 旧配置兼容项；仅作为布置群 fallback。 |

## 2026-05-11 补充：测试先到协同群

- `POST /api/xiguo-dispatch` 新增可选字段 `audience`：`collab` / `assign`。
- 未传 `audience` 时默认 `collab`，即先发到果果学习协同群。
- 页面“任务 → 羲果陪伴 → 今日学习计划派发”新增“飞书目标”选择，默认“果果学习协同群”；确认后可切到“果果学习布置群”。
- Need Human / 卡住提醒默认走协同群，便于家长先确认下一步。

## 验证命令

```bash
npm run check:xiguo-integration
npm run check:xiguo-dispatch
npm run lint
npm run build
npm test
npm run build:internal
npm run build:opensource
```

当前本地验证结果：

| 命令 | 结果 |
| --- | --- |
| `npm run check:xiguo-integration` | 通过，覆盖 signed link、详情 API、Doing/Done/Blocker、audit/decision log、sendMessage、Need Human。 |
| `npm run check:xiguo-dispatch` | 通过，覆盖羲果派发成功/失败与飞书发送。 |
| `npm run lint` | 通过。 |
| `npm run build` | 通过；保留 Vite chunk size 提醒。 |
| `npm test` | 通过，stabilization suite `32/32 pass`。 |
| `npm run build:internal` | 通过；保留 Vite chunk size 提醒。 |
| `npm run build:opensource` | 通过；保留 Vite chunk size 提醒。 |

## 截图 Evidence

截图保存在本地 `screenshots/`，该目录按仓库规则不提交：

| 场景 | 文件 |
| --- | --- |
| internal 深色 | `screenshots/DEV-20260509-xiguo-internal-dark.png` |
| internal 浅色 | `screenshots/DEV-20260509-xiguo-internal-light.png` |
| opensource 深色 | `screenshots/DEV-20260509-xiguo-opensource-dark.png` |
| opensource 浅色 | `screenshots/DEV-20260509-xiguo-opensource-light.png` |

## 风险边界

- 本次只完成 Kotovela Hub 侧能力。羲果陪伴网页需要读取 `taskId` / `token` 并调用上述 API，才会在孩子端出现详情和“开始/完成/卡住”按钮。
- 飞书 `sendMessage` 需要飞书应用具备向目标群发消息权限；测试默认使用 `FEISHU_STUDY_COLLAB_CHAT_ID`，正式派发使用 `FEISHU_STUDY_ASSIGN_CHAT_ID`。
- Vercel Serverless 不会自己定时执行 `xiguo-task-alerts`，需要 Vercel Cron 或 OpenClaw 每 10 分钟调用一次。
