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
    | 'start'
    | 'success'
    | 'fail'
    | 'pause'
    | 'resume'
    | 'cancel'
    | 'retry'
    | 'priority_change'
  operator: 'system' | 'builder'
  timestamp: string
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
}

type TaskBoardPayload = {
  generated_at?: string
  tasks_file?: string
  total?: number
  success?: number
  failed?: number
  board: TaskBoardItem[]
}

async function readTaskBoard(filePath: string) {
  const payload = JSON.parse(await fs.readFile(filePath, 'utf8')) as TaskBoardPayload
  payload.board = (payload.board ?? []).map((item) => ({
    ...item,
    retry_count: item.retry_count ?? 0,
    control_status: item.control_status ?? 'active',
    updated_at: item.updated_at ?? item.timestamp ?? payload.generated_at ?? new Date().toISOString(),
    history:
      item.history && item.history.length > 0
        ? item.history
        : [
            {
              action: 'create',
              operator: 'system',
              timestamp: item.timestamp ?? payload.generated_at ?? new Date().toISOString(),
              after: { status: item.status, priority: item.priority },
            },
          ],
  }))
  return payload
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
  target.history = [...(target.history ?? []), entry]
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

                  if (taskInput.startsWith('fail:')) {
                    throw new Error(taskInput.slice(5).trim() || '模拟失败')
                  }

                  await execFileAsync(process.execPath, ['simulate-fs-tasks.js', taskInput], {
                    cwd: '/Users/ztl/OpenClaw-Runner',
                    maxBuffer: 50 * 1024 * 1024,
                  })

                  const payload = await readTaskBoard(filePath)
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify(summarizeTaskBoard(payload)))
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
                    timestamp: now,
                    before: { status: target.status, priority: target.priority },
                    after: { status: target.status, priority: Math.max(1, (target.priority ?? 3) - 1) },
                  })
                  target.priority = Math.max(1, (target.priority ?? 3) - 1)
                } else if (action === 'priority_down') {
                  appendHistory(target, {
                    action: 'priority_change',
                    operator: 'builder',
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
