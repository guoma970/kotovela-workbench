import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kotovela-xiguo-'))
const taskBoardFile = path.join(tempDir, 'tasks-board.json')
const notificationFile = path.join(tempDir, 'task-notifications.json')
const auditFile = path.join(tempDir, 'audit-log.json')
const modeFile = path.join(tempDir, 'system-mode.internal.json')

const readBody = async (req) =>
  new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const requests = []
const server = http.createServer(async (req, res) => {
  const bodyText = await readBody(req)
  const body = bodyText ? JSON.parse(bodyText) : null
  requests.push({ url: req.url, method: req.method, headers: req.headers, body })

  if (req.url === '/xiguo-dispatch') {
    sendJson(res, 200, {
      ok: true,
      deepLink: `https://xiguo.kotovela.com/ai-session?role=child&date=${body?.date}`,
    })
    return
  }

  if (req.url === '/open-apis/auth/v3/tenant_access_token/internal') {
    sendJson(res, 200, { code: 0, tenant_access_token: 'tenant-token' })
    return
  }

  if (req.url?.startsWith('/open-apis/im/v1/messages')) {
    if (req.headers.authorization !== 'Bearer tenant-token') {
      sendJson(res, 401, { code: 999, msg: 'bad token' })
      return
    }
    sendJson(res, 200, { code: 0, data: { message_id: 'om_test' } })
    return
  }

  sendJson(res, 404, { ok: false, error: 'not_found' })
})

server.listen(0, '127.0.0.1')
await once(server, 'listening')
const { port } = server.address()
const baseUrl = `http://127.0.0.1:${port}`

process.env.PROJECT_ROOT = tempDir
process.env.TASK_BOARD_FILE = taskBoardFile
process.env.TASK_NOTIFY_LOG_FILE = notificationFile
process.env.AUDIT_LOG_FILE = auditFile
process.env.MODE_STATE_FILE = modeFile
process.env.KOTOVELA_ACCESS_SECRET = 'test-access-secret'
process.env.XIGUO_LINK_SECRET = 'test-link-secret'
process.env.XIGUO_API_URL = `${baseUrl}/xiguo-dispatch`
process.env.XIGUO_API_KEY = 'test-xiguo-key'
process.env.FEISHU_APP_ID = 'cli_test_app'
process.env.FEISHU_APP_SECRET = 'cli_test_secret'
process.env.FEISHU_STUDY_CHAT_ID = 'oc_family_study'
process.env.FEISHU_OPEN_API_BASE_URL = baseUrl
process.env.KOTOVELA_PUBLIC_ORIGIN = 'https://kotovelahub.vercel.app'

await fs.writeFile(
  taskBoardFile,
  JSON.stringify({
    generated_at: new Date().toISOString(),
    board: [
      {
        task_name: '数学练习',
        taskId: 'study-001',
        projectId: 'family-study',
        domain: 'family',
        assigned_agent: 'family',
        status: 'queued',
        priority: 1,
        durationMinutes: 25,
        description: '练习册第45-47页',
        decision_log: [],
        history: [],
      },
      {
        task_name: '阅读打卡',
        taskId: 'study-timeout',
        projectId: 'family-study',
        domain: 'family',
        assigned_agent: 'family',
        status: 'doing',
        priority: 2,
        xiguo_task_id: 'study-timeout',
        xiguo_started_at: '2026-05-01T00:00:00.000Z',
        decision_log: [],
        history: [],
      },
    ],
  }, null, 2),
)
await fs.writeFile(notificationFile, JSON.stringify({ notifications: [] }, null, 2))
await fs.writeFile(auditFile, JSON.stringify({ entries: [] }, null, 2))
await fs.writeFile(modeFile, JSON.stringify({ decision_log: [] }, null, 2))

try {
  const {
    createXiguoTaskLinkToken,
    verifyXiguoTaskLinkToken,
  } = await import('../server/xiguoTaskAccess.ts')
  const {
    dispatchToXiguo,
    getXiguoDispatchReadiness,
    sendFeishuStudyMessage,
  } = await import('../server/xiugDispatch.ts')
  const {
    createXiguoHomeworkTasks,
    readXiguoHomeworkTask,
    scanXiguoHomeworkAlerts,
    updateXiguoHomeworkTaskStatus,
  } = await import('../server/internalWorkbench.ts')

  const token = createXiguoTaskLinkToken({ taskId: 'study-001', projectId: 'family-study', nowMs: Date.parse('2026-05-09T00:00:00.000Z') })
  const tokenCheck = verifyXiguoTaskLinkToken({ taskId: 'study-001', projectId: 'family-study', token, nowMs: Date.parse('2026-05-09T00:01:00.000Z') })
  if (!tokenCheck.ok) throw new Error(`token check failed: ${JSON.stringify(tokenCheck)}`)

  const createdTask = await createXiguoHomeworkTasks({
    date: '2026-05-09',
    confirmedBy: 'parent',
    tasks: [
      {
        id: 'study-created',
        projectId: 'family-study',
        title: '新建作业联调',
        subject: 'reading',
        durationMinutes: 15,
        description: '从 Hub 受控创建作业任务。',
      },
    ],
  })
  if (createdTask.status !== 200 || createdTask.body?.created?.[0] !== 'study-created') {
    throw new Error(`task create failed: ${JSON.stringify(createdTask)}`)
  }

  const createdDetail = await readXiguoHomeworkTask({ taskId: 'study-created', projectId: 'family-study' })
  if (createdDetail.status !== 200 || createdDetail.body?.task?.title !== '新建作业联调') {
    throw new Error(`created task detail failed: ${JSON.stringify(createdDetail)}`)
  }

  const detail = await readXiguoHomeworkTask({ taskId: 'study-001', projectId: 'family-study' })
  if (detail.status !== 200 || detail.body?.task?.title !== '数学练习') {
    throw new Error(`task detail failed: ${JSON.stringify(detail)}`)
  }

  const doing = await updateXiguoHomeworkTaskStatus({
    taskId: 'study-001',
    projectId: 'family-study',
    status: 'doing',
    actor: 'guoguo',
    reason: '开始做题',
  })
  if (doing.status !== 200 || doing.body?.task?.status !== 'doing') {
    throw new Error(`status doing failed: ${JSON.stringify(doing)}`)
  }

  const done = await updateXiguoHomeworkTaskStatus({
    taskId: 'study-001',
    projectId: 'family-study',
    status: 'done',
    actor: 'guoguo',
    reason: '已完成',
  })
  if (done.status !== 200 || done.body?.task?.status !== 'done') {
    throw new Error(`status done failed: ${JSON.stringify(done)}`)
  }

  const blocker = await updateXiguoHomeworkTaskStatus({
    taskId: 'study-001',
    projectId: 'family-study',
    status: 'blocker',
    actor: 'guoguo',
    reason: '题目看不懂',
  })
  if (blocker.status !== 200 || blocker.body?.task?.status !== 'blocker' || blocker.body?.feishu?.ok !== true) {
    throw new Error(`status blocker failed: ${JSON.stringify(blocker)}`)
  }

  const alertScan = await scanXiguoHomeworkAlerts({ timeoutMinutes: 10 })
  if (alertScan.status !== 200 || alertScan.body?.alerts?.length !== 1) {
    throw new Error(`alert scan failed: ${JSON.stringify(alertScan)}`)
  }

  const readiness = getXiguoDispatchReadiness()
  if (!readiness.allConfigured || readiness.feishuTransport !== 'sendMessage') {
    throw new Error(`readiness failed: ${JSON.stringify(readiness)}`)
  }

  const tasks = [
    { id: 'study-001', title: '数学练习', subject: 'math', durationMinutes: 25, description: '练习册第45-47页' },
  ]
  const xiguo = await dispatchToXiguo({ date: '2026-05-09', confirmedBy: 'parent', tasks })
  if (!xiguo.ok) throw new Error(`dispatch failed: ${JSON.stringify(xiguo)}`)
  const feishu = await sendFeishuStudyMessage(tasks, xiguo.deepLink, '2026-05-09')
  if (!feishu.ok) throw new Error(`sendMessage failed: ${JSON.stringify(feishu)}`)

  const dispatchRequest = requests.find((request) => request.url === '/xiguo-dispatch')
  if (!dispatchRequest?.body?.tasks?.[0]?.hubTaskUrl?.includes('/api/xiguo-task?taskId=study-001')) {
    throw new Error(`dispatch payload missing hubTaskUrl: ${JSON.stringify(dispatchRequest?.body)}`)
  }

  const feishuRequests = requests.filter((request) => request.url?.startsWith('/open-apis/im/v1/messages'))
  const feishuText = feishuRequests.map((request) => JSON.parse(request.body.content).text).join('\n')
  if (!feishuText.includes('taskId=study-001') || !feishuText.includes('数学练习')) {
    throw new Error(`feishu message missing task link: ${feishuText}`)
  }

  const auditPayload = JSON.parse(await fs.readFile(auditFile, 'utf8'))
  if (!auditPayload.entries.some((entry) => entry.action === 'xiguo_task_status_updated')) {
    throw new Error(`audit log missing status update: ${JSON.stringify(auditPayload)}`)
  }

  const boardPayload = JSON.parse(await fs.readFile(taskBoardFile, 'utf8'))
  const updatedTask = boardPayload.board.find((task) => task.taskId === 'study-001')
  if (!updatedTask?.decision_log?.some((entry) => entry.action === 'xiguo_status_update')) {
    throw new Error(`decision log missing xiguo update: ${JSON.stringify(updatedTask)}`)
  }

  console.log('[check:xiguo-integration] signed task link: ok')
  console.log('[check:xiguo-integration] controlled task create: ok')
  console.log('[check:xiguo-integration] task detail api contract: ok')
  console.log('[check:xiguo-integration] status Doing/Done/Blocker sync: ok')
  console.log('[check:xiguo-integration] audit_log and decision_log writes: ok')
  console.log('[check:xiguo-integration] Feishu sendMessage transport: ok')
  console.log('[check:xiguo-integration] timeout Need Human alert: ok')
} finally {
  server.close()
  await fs.rm(tempDir, { recursive: true, force: true })
}
