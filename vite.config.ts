import { exec as execCommand } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const OFFICE_TARGET_KEYS = ['main', 'builder', 'media', 'family', 'business', 'ztl970'] as const
const OFFICE_ROLE_MAP: Record<string, string> = {
  main: '中枢调度',
  builder: '研发执行',
  media: '内容助手',
  family: '家庭助手',
  business: '业务助手',
  ztl970: '个人助手',
}

type RawSessionItem = {
  key?: string
  name?: string
  role?: string
  status?: string
  task?: string
  currentTask?: string
  updatedAt?: string
  ageMs?: number | string
  ageText?: string
}

type RawSessionResponse = {
  data?: {
    instances?: RawSessionItem[]
  }
  instances?: RawSessionItem[]
}

const toMs = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  return undefined
}

const parseSessionOutput = (raw: unknown): RawSessionItem[] => {
  if (!raw || typeof raw !== 'object') {
    return []
  }

  const obj = raw as RawSessionResponse
  const list = obj.data?.instances ?? obj.instances
  if (Array.isArray(list)) {
    return list.filter((item): item is RawSessionItem => typeof item === 'object' && item !== null)
  }

  return []
}

const buildFallbackSession = (session: RawSessionItem) => {
  const key = String(session.key || '').trim()
  const ageMs = toMs(session.ageMs)
  const updatedAt = session.ageText || (typeof session.updatedAt === 'string' ? session.updatedAt : '刚刚')

  return {
    key,
    name: session.name || key || '未知实例',
    role: session.role || OFFICE_ROLE_MAP[key] || '未设置角色',
    status: typeof session.status === 'string' && session.status.length > 0 ? session.status : 'active',
    task: typeof session.task === 'string' && session.task.length > 0 ? session.task : session.currentTask || '暂无任务',
    updatedAt,
    ageMs: ageMs,
    ageText: updatedAt,
  }
}

const commandToOfficeResponse = async () => {
  return new Promise<RawSessionItem[]>((resolve) => {
    execCommand(
      'openclaw --log-level silent sessions --json --all-agents --active 240',
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error || !stdout) {
          resolve([])
          return
        }

        try {
          const parsed = JSON.parse(stdout) as unknown
          const sessions = parseSessionOutput(parsed)

          if (sessions.length > 0) {
            resolve(sessions.map(buildFallbackSession))
            return
          }
        } catch {
          // no-op, fall through to empty
        }

        resolve([])
      },
    )
  })
}

const statusByAge = (ageMs: number) => {
  const normalized = Math.max(0, ageMs)
  const fiveMin = 5 * 60 * 1000
  const thirtyMin = 30 * 60 * 1000

  if (normalized <= fiveMin) {
    return 'doing'
  }

  if (normalized <= thirtyMin) {
    return 'done'
  }

  return 'blocker'
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'office-instances-api',
      configureServer(server) {
        server.middlewares.use('/api/office-instances', async (req, res, next) => {
          if (req.method !== 'GET') {
            next()
            return
          }

          try {
            const sessions = await commandToOfficeResponse()
            const now = Date.now()
            const normalized = sessions.filter((item) => OFFICE_TARGET_KEYS.includes(item.key as (typeof OFFICE_TARGET_KEYS)[number]))

            const instances = OFFICE_TARGET_KEYS
              .map((key) => {
                const found = normalized.find((item) => item.key === key)
                const safeAge = Math.max(0, typeof found?.ageMs === 'number' ? found.ageMs : 0)
                const status = statusByAge(safeAge)

                return {
                  key,
                  name: found?.name || `实例 ${key}`,
                  role: found?.role || OFFICE_ROLE_MAP[key],
                  status,
                  task: found?.task || found?.currentTask || '暂无任务',
                  updatedAt: found?.ageText || found?.updatedAt || '刚刚',
                  ageMs: safeAge,
                  ageText: found?.ageText || found?.updatedAt || '刚刚',
                  note:
                    safeAge <= 5 * 60 * 1000
                      ? `最近 ${Math.max(1, Math.round(safeAge / 1000))} 秒有状态上报`
                      : `上次上报于 ${Math.max(1, Math.round(safeAge / 60000))} 分钟前`,
                  projectRelated: 'KOTOVELA 中枢群',
                }
              })

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                generatedAt: new Date(now).toISOString(),
                instances,
              }),
            )
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
      },
    },
  ],
})
