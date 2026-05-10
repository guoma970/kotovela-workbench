# 开发任务 Thread C：言町驾驶舱 · 对接羲果陪伴派发 + 飞书消息推送

> 项目路径：`/Users/ztl/.openclaw/workspace-builder/kotovela-workbench`
> 负责范围：新增 `api/xiguo-dispatch.ts` + `server/xiugDispatch.ts`
> 对接方：羲果陪伴（`https://xiguo.kotovela.com`）
> 预估工时：1天

---

## 背景

言町驾驶舱已有任务布置功能（Tasks 看板），家长确认今日学习计划后需要同时完成两件事：

1. 调用羲果陪伴 API，将任务写入果果的学习 App
2. 向飞书"果果学习布置群"发送消息，消息包含直接进入羲果陪伴的深链接

羲果陪伴接口由 Thread A 实现，本任务负责驾驶舱侧的调用逻辑。

---

## 接口约定（来自羲果陪伴 Thread A）

### 羲果陪伴接收端

```
POST https://xiguo-api.kotovela.com/api/tasks/dispatch
Header: X-Api-Key: <XIGUO_API_KEY>
Content-Type: application/json
```

请求体：

```json
{
  "date": "2026-05-07",
  "confirmedBy": "parent",
  "dispatchedAt": "2026-05-07T08:00:00+08:00",
  "tasks": [
    {
      "id": "task-20260507-001",
      "title": "数学练习",
      "subject": "math",
      "durationMinutes": 25,
      "description": "练习册第45-47页"
    },
    {
      "id": "task-20260507-002",
      "title": "语文阅读",
      "subject": "reading",
      "durationMinutes": 15,
      "description": "阅读理解一篇"
    }
  ]
}
```

成功响应：

```json
{
  "ok": true,
  "deepLink": "https://xiguo.kotovela.com/ai-session?role=child&date=2026-05-07"
}
```

`subject` 字段取值范围：`math` | `writing` | `reading`

---

## 环境变量（需在 Vercel 项目设置中配置）

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `XIGUO_API_KEY` | 与羲果陪伴约定的 API 密钥 | `<XIGUO_API_KEY>` |
| `XIGUO_API_URL` | 羲果陪伴的 dispatch 端点 | `https://xiguo-api.kotovela.com/api/tasks/dispatch` |
| `FEISHU_STUDY_WEBHOOK` | 飞书"果果学习布置群" webhook URL | `https://open.feishu.cn/open-apis/bot/v2/hook/xxx` |

> 本地开发时在 `.env.local` 中配置，不提交 Git。
> Vercel 部署时在 Project Settings → Environment Variables 中添加。

---

## 任务一：新建 `server/xiugDispatch.ts`

新建文件：`server/xiugDispatch.ts`

```ts
export type XiguoTask = {
  id: string
  title: string
  subject: 'math' | 'writing' | 'reading' | string
  durationMinutes: number
  description: string
}

export type XiguoDispatchPayload = {
  date: string
  confirmedBy: string
  tasks: XiguoTask[]
}

export type XiguoDispatchResult =
  | { ok: true; deepLink: string }
  | { ok: false; error: string }

export type FeishuDispatchResult =
  | { ok: true }
  | { ok: false; error: string }

const SUBJECT_LABELS: Record<string, string> = {
  math: '数学',
  writing: '写作',
  reading: '语文阅读',
}

function formatSubject(subject: string): string {
  return SUBJECT_LABELS[subject] || subject
}

function buildFeishuMessage(
  tasks: XiguoTask[],
  deepLink: string,
  date: string,
): string {
  const taskLines = tasks
    .map((t) => `• ${t.title}（${t.durationMinutes}分钟）${t.description ? ' · ' + t.description : ''}`)
    .join('\n')

  return [
    `📚 今日学习计划`,
    ``,
    `果果，今天有 ${tasks.length} 个任务：`,
    taskLines,
    ``,
    `果妈已确认 ✓`,
    ``,
    `👉 开始执行 →`,
    deepLink,
  ].join('\n')
}

export async function dispatchToXiguo(
  payload: XiguoDispatchPayload,
): Promise<XiguoDispatchResult> {
  const apiUrl = process.env.XIGUO_API_URL?.trim()
  const apiKey = process.env.XIGUO_API_KEY?.trim()

  if (!apiUrl) {
    return { ok: false, error: 'XIGUO_API_URL not configured' }
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      body: JSON.stringify({
        date: payload.date,
        confirmedBy: payload.confirmedBy,
        dispatchedAt: new Date().toISOString(),
        tasks: payload.tasks,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `Xiguo API error ${res.status}: ${text}` }
    }

    const data = (await res.json()) as { ok: boolean; deepLink?: string }
    if (!data.ok || !data.deepLink) {
      return { ok: false, error: 'Xiguo API returned unexpected response' }
    }

    return { ok: true, deepLink: data.deepLink }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function sendFeishuStudyMessage(
  tasks: XiguoTask[],
  deepLink: string,
  date: string,
): Promise<FeishuDispatchResult> {
  const webhookUrl = process.env.FEISHU_STUDY_WEBHOOK?.trim()

  if (!webhookUrl) {
    return { ok: false, error: 'FEISHU_STUDY_WEBHOOK not configured' }
  }

  const text = buildFeishuMessage(tasks, deepLink, date)

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text } }),
    })

    if (!res.ok) {
      const raw = await res.text().catch(() => '')
      return { ok: false, error: `Feishu webhook error ${res.status}: ${raw}` }
    }

    const data = (await res.json()) as { code?: number; msg?: string }
    if (data.code !== 0) {
      return { ok: false, error: `Feishu error code ${data.code}: ${data.msg}` }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
```

---

## 任务二：新建 Vercel serverless 端点 `api/xiguo-dispatch.ts`

新建文件：`api/xiguo-dispatch.ts`

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { dispatchToXiguo, sendFeishuStudyMessage, type XiguoTask } from '../server/xiugDispatch.js'

function sendJson(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 仅允许 POST
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' })
    return
  }

  // 内部访问验证（复用现有 KOTOVELA_ACCESS_SECRET 或单独密钥）
  const secret = process.env.KOTOVELA_ACCESS_SECRET?.trim()
  if (secret) {
    const provided = req.headers['x-kotovela-secret'] || req.headers['authorization']
    if (provided !== secret && provided !== `Bearer ${secret}`) {
      sendJson(res, 401, { ok: false, error: 'Unauthorized' })
      return
    }
  }

  const body = req.body as {
    date?: string
    confirmedBy?: string
    tasks?: XiguoTask[]
  }

  if (!body?.date || !Array.isArray(body?.tasks) || body.tasks.length === 0) {
    sendJson(res, 400, { ok: false, error: 'Missing required fields: date, tasks' })
    return
  }

  const results: {
    xiguo: { ok: boolean; deepLink?: string; error?: string }
    feishu: { ok: boolean; error?: string }
  } = {
    xiguo: { ok: false },
    feishu: { ok: false },
  }

  // 步骤一：推送到羲果陪伴
  const xiguoResult = await dispatchToXiguo({
    date: body.date,
    confirmedBy: body.confirmedBy || 'parent',
    tasks: body.tasks,
  })

  results.xiguo = xiguoResult

  // 步骤二：发飞书消息（无论步骤一是否成功，独立执行）
  const deepLink = xiguoResult.ok
    ? xiguoResult.deepLink
    : `https://xiguo.kotovela.com/ai-session?role=child&date=${body.date}`

  const feishuResult = await sendFeishuStudyMessage(body.tasks, deepLink, body.date)
  results.feishu = feishuResult

  // 两步均成功才返回 200，否则返回 207 Multi-Status
  const allOk = results.xiguo.ok && results.feishu.ok
  sendJson(res, allOk ? 200 : 207, {
    ok: allOk,
    date: body.date,
    deepLink,
    results,
  })
}
```

---

## 任务三：在任务确认流程中调用新端点

### 调用时机

在现有的任务布置确认流程中（`src/pages/TasksPage.tsx` 或相关操作处理函数），找到家长点击"确认派发"的处理逻辑，在其中加入对 `/api/xiguo-dispatch` 的调用。

### 前端调用示例

```ts
async function handleConfirmDispatch(tasks: SelectedTask[], date: string) {
  // 现有逻辑：更新任务状态...

  // 新增：触发派发
  try {
    const res = await fetch('/api/xiguo-dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kotovela-Secret': import.meta.env.VITE_KOTOVELA_SECRET || '',
      },
      body: JSON.stringify({
        date,
        confirmedBy: 'parent',
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          subject: t.subject,        // 'math' | 'writing' | 'reading'
          durationMinutes: t.duration,
          description: t.description || '',
        })),
      }),
    })

    const data = await res.json()
    if (data.ok) {
      // 成功：可在 UI 上显示"已发送到果果的学习 App 和飞书群"
      console.log('派发成功，深链接：', data.deepLink)
    } else {
      // 部分失败：data.results 中有详情
      console.warn('派发部分失败：', data.results)
    }
  } catch (err) {
    console.error('派发请求失败：', err)
  }
}
```

> 具体接入点由开发者根据当前 Tasks 页面的实际代码结构判断。
> 建议在确认按钮的 onClick handler 末尾加入，不影响现有状态更新逻辑。

---

## 验收步骤

### 1. 本地开发环境配置

在 `.env.local` 中配置（不提交 Git）：

```
XIGUO_API_URL=https://xiguo-api.kotovela.com/api/tasks/dispatch
XIGUO_API_KEY=<XIGUO_API_KEY>
FEISHU_STUDY_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/<你的token>
```

### 2. 验证 xiguo-dispatch 端点

```bash
curl -X POST http://localhost:3000/api/xiguo-dispatch \
  -H "Content-Type: application/json" \
  -H "X-Kotovela-Secret: <KOTOVELA_ACCESS_SECRET>" \
  -d '{
    "date": "2026-05-07",
    "confirmedBy": "parent",
    "tasks": [
      {"id":"t1","title":"数学练习","subject":"math","durationMinutes":25,"description":"练习册第45-47页"},
      {"id":"t2","title":"语文阅读","subject":"reading","durationMinutes":15,"description":"阅读理解一篇"}
    ]
  }'
```

期望响应（两步均成功）：

```json
{
  "ok": true,
  "date": "2026-05-07",
  "deepLink": "https://xiguo.kotovela.com/ai-session?role=child&date=2026-05-07",
  "results": {
    "xiguo": { "ok": true, "deepLink": "https://xiguo.kotovela.com/ai-session?role=child&date=2026-05-07" },
    "feishu": { "ok": true }
  }
}
```

### 3. 验证飞书群收到消息

到"果果学习布置群"确认：
- 收到消息，格式正确
- 消息末尾有 `xiguo.kotovela.com` 链接
- 点击链接能正常跳转

### 4. 验证羲果陪伴前端展示

点击飞书消息中的链接，进入 `https://xiguo.kotovela.com/ai-session?role=child&date=2026-05-07`

期望：
- 页面顶部出现"今日计划"蓝色面板（Thread B 的工作）
- 显示数学练习和语文阅读两个任务
- 下方计时器等功能正常

### 5. 验证 207 部分失败场景

临时将 `XIGUO_API_URL` 设为无效地址，重新调用接口：

期望：
- HTTP 状态码 207
- `results.xiguo.ok` 为 false，有 error 信息
- 飞书消息仍然发送（使用 fallback deepLink）

---

## 联调配合

| 事项 | 负责方 | 说明 |
|------|--------|------|
| 约定 `XIGUO_API_KEY` 具体值 | 两边运维 | 写入各自环境变量，不进 Git |
| 羲果陪伴 dispatch 端点上线 | Thread A | 上线后告知本组 URL 和 key |
| 飞书 webhook URL | OpenClaw研发群 | 从飞书群机器人配置获取 |
| 全链路联调 | 两组一起 | Thread A + B + C 都完成后进行 |
