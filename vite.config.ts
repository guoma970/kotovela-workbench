import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fetchOfficeInstancesPayload } from './server/officeInstances'

const execFileAsync = promisify(execFile)

type TaskHistoryEntry = {
  action:
    | 'create'
    | 'run'
    | 'fail'
    | 'retry'
    | 'pause'
    | 'resume'
    | 'cancel'
    | 'priority_change'
    | 'auto_priority_down'
    | 'abnormal_detected'
    | 'stuck_detected'
  timestamp: string
  status_before?: string
  status_after?: string
  priority_before?: number
  priority_after?: number
  retry_count?: number
  error?: string
  trigger_source?: 'manual' | 'system' | 'rule_engine'
  decision_type?: 'auto_retry' | 'auto_priority_down' | 'stuck_detected' | 'abnormal_detected'
  decision_reason?: string
  operator?: 'system' | 'builder'
  before?: { status?: string; priority?: number }
  after?: { status?: string; priority?: number }
}

type TaskBoardItem = {
  task_name: string
  agent: string
  priority?: number
  retry_count?: number
  type?: string
  status?: string
  code_snippet?: string
  timestamp?: string
  control_status?: string
  updated_at?: string
  history?: TaskHistoryEntry[]
  attention?: boolean
  stuck?: boolean
  abnormal?: boolean
  auto_decision_log?: string[]
  queued_at?: string
  slot_active?: boolean
  health?: 'healthy' | 'warning' | 'critical'
}

type TaskBoardPayload = {
  generated_at?: string
  tasks_file?: string
  total?: number
  success?: number
  failed?: number
  max_concurrency?: number
  current_concurrency?: number
  system_alerts?: { level: 'warning' | 'critical'; task_name?: string; agent?: string; reason: string }[]
  board: TaskBoardItem[]
}

function applyScheduler(payload: TaskBoardPayload) {
  const maxConcurrency = payload.max_concurrency ?? 2
  payload.max_concurrency = maxConcurrency
  const sorted = [...payload.board].sort((a, b) => {
    const ap = a.priority ?? 99
    const bp = b.priority ?? 99
    if (ap !== bp) return ap - bp
    return new Date(a.queued_at ?? a.timestamp ?? 0).getTime() - new Date(b.queued_at ?? b.timestamp ?? 0).getTime()
  })
  let runningCount = sorted.filter((item) => ['doing', 'running'].includes(item.status ?? '')).length
  for (const item of sorted) {
    item.slot_active = ['doing', 'running'].includes(item.status ?? '')
    if ((item.status === 'todo' || item.status === 'queued') && runningCount < maxConcurrency) {
      appendHistory(item, {
        action: 'run',
        operator: 'system',
        timestamp: new Date().toISOString(),
        before: { status: item.status, priority: item.priority },
        after: { status: 'running', priority: item.priority },
      })
      item.status = 'running'
      item.slot_active = true
      item.updated_at = new Date().toISOString()
      runningCount += 1
    } else if (item.status === 'todo' || item.status === 'queued') {
      item.status = 'todo'
      item.slot_active = false
    } else if (['failed', 'cancelled', 'success', 'done', 'paused'].includes(item.status ?? '')) {
      item.slot_active = false
    }
  }
  payload.current_concurrency = sorted.filter((item) => item.slot_active).length
  payload.board = sorted
  return payload
}

async function readTaskBoard(filePath: string) {
  const payload = JSON.parse(await fs.readFile(filePath, 'utf8')) as TaskBoardPayload
  payload.board = (payload.board ?? []).map((item) => ({
    ...item,
    retry_count: item.retry_count ?? 0,
    control_status: item.control_status ?? 'active',
    updated_at: item.updated_at ?? item.timestamp ?? payload.generated_at ?? new Date().toISOString(),
    attention: item.attention ?? item.status === 'failed',
    stuck: item.stuck ?? false,
    abnormal: item.abnormal ?? false,
    auto_decision_log: item.auto_decision_log ?? [],
    queued_at: item.queued_at ?? item.timestamp ?? payload.generated_at ?? new Date().toISOString(),
    slot_active: item.slot_active ?? false,
    history:
      item.history && item.history.length > 0
        ? item.history
        : [
            {
              action: 'create',
              operator: 'system',
              trigger_source: 'system',
              timestamp: item.timestamp ?? payload.generated_at ?? new Date().toISOString(),
              status_after: item.status,
              priority_after: item.priority,
            },
          ],
  }))
  const now = Date.now()
  payload.board = payload.board.map((item) => {
    const next = { ...item }
    if (next.status === 'failed') next.attention = true
    const ageMs = now - new Date(next.updated_at ?? next.timestamp ?? now).getTime()
    const stuckNow = (next.status === 'todo' || next.status === 'failed') && ageMs > 60_000
    next.stuck = stuckNow
    if (stuckNow) {
      const hasStuck = (next.history ?? []).some((entry) => entry.decision_type === 'stuck_detected')
      if (!hasStuck) {
        next.history = [
          ...(next.history ?? []),
          {
            action: 'stuck_detected',
            timestamp: new Date().toISOString(),
            trigger_source: 'rule_engine',
            decision_type: 'stuck_detected',
            decision_reason: '待处理超过60s',
            status_after: next.status,
            priority_after: next.priority,
          },
        ]
      }
    }
    const recentPauseResume = (next.history ?? []).filter(
      (entry) => ['pause', 'resume'].includes(entry.action) && now - new Date(entry.timestamp).getTime() <= 60_000,
    )
    if (recentPauseResume.length >= 3) {
      next.abnormal = true
      const hasMarker = (next.history ?? []).some((entry) => entry.action === 'abnormal_detected')
      if (!hasMarker) {
        next.history = [
          ...(next.history ?? []),
          {
            action: 'abnormal_detected',
            operator: 'system',
            trigger_source: 'rule_engine',
            decision_type: 'abnormal_detected',
            decision_reason: '60s 内 pause/resume 频繁切换',
            timestamp: new Date().toISOString(),
            status_after: next.status,
            priority_after: next.priority,
          },
        ]
        next.auto_decision_log = [...(next.auto_decision_log ?? []), '检测到频繁 pause/resume，已标记 abnormal']
      }
    }
    const failedHistory = [...(next.history ?? [])].slice().reverse().filter((entry) => entry.action === 'fail')
    if (failedHistory.length >= 2) {
      const hasAutoDown = (next.history ?? []).some((entry) => entry.action === 'auto_priority_down')
      if (!hasAutoDown) {
        const newPriority = Math.min(9, (next.priority ?? 3) + 1)
        next.history = [
          ...(next.history ?? []),
          {
            action: 'auto_priority_down',
            operator: 'system',
            trigger_source: 'rule_engine',
            decision_type: 'auto_priority_down',
            decision_reason: '连续失败>=2次自动降级优先级',
            timestamp: new Date().toISOString(),
            status_before: next.status,
            status_after: next.status,
            priority_before: next.priority,
            priority_after: newPriority,
          },
        ]
        next.priority = newPriority
        next.auto_decision_log = [...(next.auto_decision_log ?? []), `连续失败已自动降级到 P${newPriority}`]
      }
    }

    const failCount = failedHistory.length
    if (failCount >= 3) next.health = 'critical'
    else if (failCount >= 2 || next.stuck || next.abnormal) next.health = 'warning'
    else next.health = 'healthy'

    return next
  })

  const failByAgent = new Map<string, number>()
  for (const item of payload.board) {
    if (item.status === 'failed') failByAgent.set(item.agent ?? 'unknown', (failByAgent.get(item.agent ?? 'unknown') ?? 0) + 1)
  }
  const alerts: { level: 'warning' | 'critical'; task_name?: string; agent?: string; reason: string }[] = []
  for (const item of payload.board) {
    if (item.health === 'critical') alerts.push({ level: 'critical', task_name: item.task_name, agent: item.agent, reason: '连续失败 >= 3 次' })
    else if (item.health === 'warning') {
      const reason = item.stuck ? '待处理超过 60s' : item.abnormal ? 'pause/resume 频繁切换' : '连续失败 >= 2 次'
      alerts.push({ level: 'warning', task_name: item.task_name, agent: item.agent, reason })
    }
  }
  for (const [agent, cnt] of failByAgent.entries()) {
    if (cnt >= 2) alerts.push({ level: 'warning', agent, reason: `实例最近失败任务过多（${cnt}）` })
  }
  payload.system_alerts = alerts

  return applyScheduler(payload)
}

function summarizeTaskBoard(payload: TaskBoardPayload) {
  payload.total = payload.board.length
  payload.success = payload.board.filter((item) => item.status === 'success' || item.status === 'done').length
  payload.failed = payload.board.filter((item) => item.status === 'failed').length
  return payload
}

async function writeTaskBoard(filePath: string, payload: TaskBoardPayload) {
  await fs.writeFile(filePath, `${JSON.stringify(summarizeTaskBoard(payload), null, 2)}\n`, 'utf8')
}

function appendHistory(target: TaskBoardItem, entry: TaskHistoryEntry) {
  const normalized: TaskHistoryEntry = {
    ...entry,
    status_before: entry.status_before ?? entry.before?.status,
    status_after: entry.status_after ?? entry.after?.status,
    priority_before: entry.priority_before ?? entry.before?.priority,
    priority_after: entry.priority_after ?? entry.after?.priority,
    trigger_source: entry.trigger_source ?? (entry.operator === 'builder' ? 'manual' : 'system'),
  }
  target.history = [...(target.history ?? []), normalized]
}

export default defineConfig(({ mode }) => {
  const isInternal = mode === 'internal'

  return {
    server: {
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
    plugins: [
      react(),
      {
        name: 'pwa-html-by-mode',
        transformIndexHtml(html) {
          if (!isInternal) return html
          return html
            .replace('/manifest.demo.webmanifest', '/manifest.internal.webmanifest')
            .replace(
              '<meta name="description" content="OpenClaw × KOTOVELA · 开源多实例协作演示（Mock）" />',
              '<meta name="description" content="KOTOVELA HUB · 内部驾驶舱：实例状态与项目跟进" />',
            )
            .replace(
              '<meta name="apple-mobile-web-app-title" content="O×KOTOVELA" />',
              '<meta name="apple-mobile-web-app-title" content="HUB" />',
            )
            .replace('<title>OpenClaw × KOTOVELA</title>', '<title>KOTOVELA HUB</title>')
        },
      },
      {
        name: 'office-instances-api',
        configureServer(server) {
          server.middlewares.use('/api/office-instances', async (req, res, next) => {
            if (req.method !== 'GET') {
              next()
              return
            }

            try {
              const payload = await fetchOfficeInstancesPayload()
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(payload))
            } catch (error) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: 'office-instances fetch failed',
                  message: error instanceof Error ? error.message : String(error),
                }),
              )
            }
          })

          server.middlewares.use('/api/tasks-board', async (req, res, next) => {
            const filePath = path.resolve('/Users/ztl/OpenClaw-Runner/tasks-board.json')

            if (req.method === 'GET') {
              try {
                const payload = await readTaskBoard(filePath)
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Cache-Control', 'no-store')
                res.end(JSON.stringify(summarizeTaskBoard(payload)))
              } catch (error) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: 'tasks-board fetch failed',
                    message: error instanceof Error ? error.message : String(error),
                  }),
                )
              }
              return
            }

            if (req.method === 'POST' || req.method === 'PATCH') {
              try {
                const chunks: Buffer[] = []
                for await (const chunk of req) chunks.push(Buffer.from(chunk))
                const bodyText = Buffer.concat(chunks).toString('utf8')
                const body = bodyText ? JSON.parse(bodyText) : {}

                if (req.method === 'POST') {
                  const taskInput = String(body?.input || '').trim()
                  if (!taskInput) {
                    res.statusCode = 400
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: 'missing input' }))
                    return
                  }

                  if (taskInput.startsWith('queue:')) {
                    const payload = await readTaskBoard(filePath)
                    const now = new Date().toISOString()
                    const taskName = taskInput.slice(6).trim() || `queued-${Date.now()}`
                    payload.board.unshift({
                      task_name: taskName,
                      agent: 'builder',
                      priority: 3,
                      retry_count: 0,
                      type: 'dev',
                      status: 'todo',
                      timestamp: now,
                      queued_at: now,
                      updated_at: now,
                      attention: false,
                      stuck: false,
                      abnormal: false,
                      auto_decision_log: [],
                      history: [{ action: 'create', operator: 'system', trigger_source: 'system', timestamp: now, status_after: 'todo', priority_after: 3 }],
                    })
                    payload.generated_at = now
                    await writeTaskBoard(filePath, payload)
                    res.statusCode = 200
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify(summarizeTaskBoard(await readTaskBoard(filePath))))
                    return
                  }

                  if (taskInput.startsWith('fail:')) {
                    const payload = await readTaskBoard(filePath)
                    const now = new Date().toISOString()
                    const existing = payload.board.find((item) => item.task_name === taskInput)
                    if (existing) {
                      appendHistory(existing, {
                        action: 'fail',
                        operator: 'system',
                        trigger_source: 'system',
                        timestamp: now,
                        status_before: existing.status,
                        status_after: 'failed',
                        priority_before: existing.priority,
                        priority_after: existing.priority,
                        error: taskInput.slice(5).trim() || '模拟失败',
                      })
                      existing.status = 'failed'
                      existing.attention = true
                      existing.updated_at = now
                    } else {
                      payload.board.unshift({
                        task_name: taskInput,
                        agent: 'builder',
                        priority: 3,
                        retry_count: 0,
                        type: 'dev',
                        status: 'failed',
                        timestamp: now,
                        updated_at: now,
                        queued_at: now,
                        attention: true,
                        stuck: false,
                        abnormal: false,
                        auto_decision_log: [],
                        history: [
                          { action: 'create', operator: 'system', trigger_source: 'system', timestamp: now, status_after: 'failed', priority_after: 3 },
                          { action: 'fail', operator: 'system', trigger_source: 'system', timestamp: now, status_after: 'failed', priority_after: 3, error: taskInput.slice(5).trim() || '模拟失败' },
                        ],
                      })
                    }
                    payload.generated_at = now
                    await writeTaskBoard(filePath, payload)
                    throw new Error(taskInput.slice(5).trim() || '模拟失败')
                  }

                  await execFileAsync(process.execPath, ['simulate-fs-tasks.js', taskInput], {
                    cwd: '/Users/ztl/OpenClaw-Runner',
                    maxBuffer: 50 * 1024 * 1024,
                  })

                  const payload = await readTaskBoard(filePath)
                  const now = new Date().toISOString()
                  const target = payload.board.find((item) => item.task_name === taskInput)
                  if (target) {
                    appendHistory(target, {
                      action: 'run',
                      operator: 'system',
                      trigger_source: 'system',
                      timestamp: now,
                      status_before: target.status,
                      status_after: 'success',
                      priority_before: target.priority,
                      priority_after: target.priority,
                    })
                    target.status = 'success'
                    target.attention = false
                    target.stuck = false
                    target.updated_at = now
                  }
                  await writeTaskBoard(filePath, payload)
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify(summarizeTaskBoard(await readTaskBoard(filePath))))
                  return
                }

                const taskName = String(body?.task_name || '').trim()
                const action = String(body?.action || '').trim()
                if (!taskName || !action) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'missing task_name/action' }))
                  return
                }

                const payload = await readTaskBoard(filePath)
                const target = payload.board.find((item) => item.task_name === taskName)
                if (!target) {
                  res.statusCode = 404
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'task not found' }))
                  return
                }

                const now = new Date().toISOString()
                if (action === 'pause') {
                  appendHistory(target, {
                    action: 'pause',
                    operator: 'builder',
                    trigger_source: 'manual',
                    timestamp: now,
                    before: { status: target.status, priority: target.priority },
                    after: { status: 'paused', priority: target.priority },
                  })
                  target.control_status = 'paused'
                  target.status = 'paused'
                } else if (action === 'resume') {
                  appendHistory(target, {
                    action: 'resume',
                    operator: 'builder',
                    trigger_source: 'manual',
                    timestamp: now,
                    before: { status: target.status, priority: target.priority },
                    after: { status: 'todo', priority: target.priority },
                  })
                  target.control_status = 'active'
                  target.status = 'todo'
                } else if (action === 'cancel') {
                  appendHistory(target, {
                    action: 'cancel',
                    operator: 'builder',
                    trigger_source: 'manual',
                    timestamp: now,
                    before: { status: target.status, priority: target.priority },
                    after: { status: 'cancelled', priority: target.priority },
                  })
                  target.control_status = 'cancelled'
                  target.status = 'cancelled'
                } else if (action === 'priority_up') {
                  appendHistory(target, {
                    action: 'priority_change',
                    operator: 'builder',
                    trigger_source: 'manual',
                    timestamp: now,
                    before: { status: target.status, priority: target.priority },
                    after: { status: target.status, priority: Math.max(1, (target.priority ?? 3) - 1) },
                  })
                  target.priority = Math.max(1, (target.priority ?? 3) - 1)
                } else if (action === 'priority_down') {
                  appendHistory(target, {
                    action: 'priority_change',
                    operator: 'builder',
                    trigger_source: 'manual',
                    timestamp: now,
                    before: { status: target.status, priority: target.priority },
                    after: { status: target.status, priority: Math.min(9, (target.priority ?? 3) + 1) },
                  })
                  target.priority = Math.min(9, (target.priority ?? 3) + 1)
                } else {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'unsupported action' }))
                  return
                }
                target.updated_at = now
                payload.generated_at = now
                await writeTaskBoard(filePath, payload)
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(await readTaskBoard(filePath)))
              } catch (error) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: 'tasks-board execute failed',
                    message: error instanceof Error ? error.message : String(error),
                  }),
                )
              }
              return
            }

            next()
          })
        },
      },
    ],
  }
})
