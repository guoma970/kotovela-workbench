import { exec as execCommand } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const OFFICE_TARGET_KEYS = ['main', 'builder', 'media', 'family', 'business', 'personal'] as const

export const OFFICE_ROLE_MAP: Record<string, string> = {
  main: '中枢调度',
  builder: '研发执行',
  media: '内容助手',
  family: '家庭助手',
  business: '业务助手',
  personal: '个人助手',
  ztl970: '个人助手',
}

const FEISHU_CHAT_ID_TO_NAME: Record<string, string> = {
  oc_47a05c2f7d840e8cc1b6c1115afe95ad: '言町驾驶舱研发群',
  oc_036fcab930f40b798877206801375dbd: '羲果陪伴研发群',
  oc_cc9a5a8f9cb3dd8477bf0a0b86261549: 'YANFAMI平台研发群',
}

type SessionItem = {
  key?: string
  /** Original session key before agent-id normalization (e.g. agent:main:feishu:group:oc_…) */
  sessionKeyRaw?: string
  name?: string
  role?: string
  status?: string
  task?: string
  currentTask?: string
  updatedAt?: string
  ageMs?: number | string
  ageText?: string
  kind?: string
  agentId?: string
  model?: string
  /** When no matching session row exists for this slot (final payload only) */
  slotKey?: string
}

type SessionResponse = {
  data?: {
    instances?: SessionItem[]
    sessions?: SessionItem[]
  }
  instances?: SessionItem[]
  sessions?: SessionItem[]
}

type OfficeSnapshotPayload = {
  generatedAt?: string
  source?: string
  instances?: ReturnType<typeof buildFallbackSession>[]
}

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const snapshotPath = path.resolve(serverDir, '../data/office-instances.snapshot.json')

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

const normalizeSessionKey = (value: unknown): string => {
  const trimmed = typeof value === 'string' ? value.trim() : value != null ? String(value).trim() : ''
  if (!trimmed) {
    return ''
  }

  const parts = trimmed.split(':')
  if (parts[0] === 'agent' && parts.length >= 2) {
    const key = parts[1]
    return key === 'ztl970' ? 'personal' : key
  }
  return trimmed === 'ztl970' ? 'personal' : trimmed
}

const extractFeishuChatId = (raw: string): string | undefined => {
  const m = /(?:^|:)oc_[a-z0-9]{8,}(?:$|:)?/i.exec(raw)
  if (!m) return undefined
  return m[0].replace(/:/g, '').toLowerCase()
}

/** When OpenClaw JSON has no task/currentTask, derive a one-line summary for the cockpit. */
const inferTaskSummary = (session: SessionItem): string => {
  const t = typeof session.task === 'string' ? session.task.trim() : ''
  const ct = typeof session.currentTask === 'string' ? session.currentTask.trim() : ''
  if (t && t !== '暂无任务') return t
  if (ct) return ct

  const raw = typeof session.sessionKeyRaw === 'string' ? session.sessionKeyRaw : ''
  const kind = typeof session.kind === 'string' ? session.kind.toLowerCase() : ''
  const model = typeof session.model === 'string' && session.model.length > 0 ? session.model : ''

  if (kind === 'group' || raw.includes('feishu:group') || raw.includes(':group:')) {
    const chatId = extractFeishuChatId(raw)
    const groupName = chatId ? FEISHU_CHAT_ID_TO_NAME[chatId] : undefined
    if (groupName) return `飞书群会话 · ${groupName}`
    const tail = chatId || raw.split(':').filter(Boolean).pop() || ''
    const shortId = tail.length > 14 ? `${tail.slice(0, 10)}…` : tail
    return shortId ? `飞书群会话 · ${shortId}` : '飞书群会话'
  }

  if (kind === 'direct') {
    return model ? `直连会话 · ${model}` : '直连会话'
  }

  if (raw.includes('feishu')) {
    return model ? `飞书会话 · ${model}` : '飞书会话'
  }

  const slot = typeof session.slotKey === 'string' ? session.slotKey.trim() : ''
  if (slot) {
    return `实例 ${slot} · 暂无任务上报`
  }

  return model ? `会话活跃 · ${model}` : '等待新任务（飞书群）'
}

const parseSessionOutput = (raw: unknown): SessionItem[] => {
  if (!raw || typeof raw !== 'object') {
    return []
  }

  const obj = raw as SessionResponse
  const rawList = obj.data?.instances ?? obj.instances
  const sessionList = obj.data?.sessions ?? obj.sessions
  const list = Array.isArray(rawList) ? rawList : Array.isArray(sessionList) ? sessionList : []

  if (!Array.isArray(list)) {
    return []
  }

  const mapped = list
    .filter((item): item is SessionItem => typeof item === 'object' && item !== null)
    .map((item) => {
      const originalKey =
        typeof item.key === 'string' ? item.key : item.key != null ? String(item.key) : ''
      const agentId = typeof item.agentId === 'string' ? item.agentId.trim() : ''
      const sessionKeyRaw = originalKey || (agentId ? `agent:${agentId}` : '')
      return {
        ...item,
        sessionKeyRaw,
        key: normalizeSessionKey(item.key ?? item.agentId),
        updatedAt: typeof item.ageMs === 'number' ? `最近 ${Math.max(1, Math.round(item.ageMs / 1000))} 秒` : item.updatedAt,
      }
    })

  const deduped: Record<string, SessionItem> = {}
  for (const item of mapped) {
    if (!item.key) {
      continue
    }

    const existing = deduped[item.key]
    const currentAge = toMs(item.ageMs)
    const existingAge = toMs(existing?.ageMs)

    if (!existing || (currentAge !== undefined && (existingAge === undefined || currentAge < existingAge))) {
      deduped[item.key] = item
    }
  }

  return Object.values(deduped)
}

const buildFallbackSession = (session: SessionItem) => {
  const key = String(session.key || '').trim()
  const ageMs = toMs(session.ageMs)
  const updatedAt = session.ageText || (typeof session.updatedAt === 'string' ? session.updatedAt : '刚刚')

  return {
    key,
    name: session.name || key || '未知实例',
    role: session.role || OFFICE_ROLE_MAP[key] || '未设置角色',
    status: typeof session.status === 'string' && session.status.length > 0 ? session.status : 'active',
    task: inferTaskSummary(session),
    sessionKeyRaw: session.sessionKeyRaw,
    kind: typeof session.kind === 'string' ? session.kind : undefined,
    model: typeof session.model === 'string' ? session.model : undefined,
    currentTask: typeof session.currentTask === 'string' ? session.currentTask : undefined,
    updatedAt,
    ageMs,
    ageText: updatedAt,
  }
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

const commandToOfficeResponse = async (): Promise<ReturnType<typeof buildFallbackSession>[]> =>
  new Promise((resolve) => {
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
          // ignore
        }

        resolve([])
      },
    )
  })

const readSnapshotPayload = async (): Promise<OfficeSnapshotPayload | null> => {
  try {
    const raw = await readFile(snapshotPath, 'utf8')
    const parsed = JSON.parse(raw) as OfficeSnapshotPayload
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export const fetchOfficeInstancesPayload = async () => {
  const sessions = await commandToOfficeResponse()
  const snapshot = sessions.length === 0 ? await readSnapshotPayload() : null
  const now = Date.now()
  const sourceItems = sessions.length > 0 ? sessions : Array.isArray(snapshot?.instances) ? snapshot.instances : []
  const normalized = sourceItems.filter((item) => OFFICE_TARGET_KEYS.includes(item.key as (typeof OFFICE_TARGET_KEYS)[number]))

  const instances = OFFICE_TARGET_KEYS.map((key) => {
    const found = normalized.find((item) => item.key === key)
    const safeAge = Math.max(0, typeof found?.ageMs === 'number' ? found.ageMs : 0)

    return {
      key,
      name: found?.name || `实例 ${key}`,
      role: found?.role || OFFICE_ROLE_MAP[key],
      status: statusByAge(safeAge),
      task: inferTaskSummary({
        task: found?.task,
        currentTask: found?.currentTask,
        sessionKeyRaw: found?.sessionKeyRaw,
        kind: found?.kind,
        model: found?.model,
        ...(found ? {} : { slotKey: key }),
      } as SessionItem),
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

  return {
    source: sessions.length > 0 ? 'live' : snapshot?.source || 'snapshot',
    generatedAt: new Date(now).toISOString(),
    snapshotGeneratedAt: snapshot?.generatedAt,
    instances,
  }
}
