import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

type JsonObject = Record<string, unknown>

type InternalApiResult = {
  status: number
  body: unknown
  allow?: string
}

type TaskBoardItem = JsonObject & {
  task_name?: string
  status?: string
  priority?: number | string
  agent?: string
  assigned_agent?: string
  domain?: string
  type?: string
  timestamp?: string
  updated_at?: string
  queued_at?: string
  attention?: boolean
  abnormal?: boolean
  need_human?: boolean
  lead_id?: string
  consultant_id?: string
  converted?: boolean
  lost?: boolean
  decision_log?: JsonObject[]
  history?: JsonObject[]
  result?: JsonObject
}

type TaskBoardPayload = JsonObject & {
  generated_at?: string
  board?: TaskBoardItem[]
}

type AuditEntry = {
  id: string
  action: string
  user: string
  time: string
  target: string
  result: string
}

type SystemState = {
  app_mode: 'internal' | 'opensource'
  system_mode: 'dev' | 'test' | 'live'
  publish_mode: 'manual_only' | 'semi_auto' | 'auto_disabled'
  force_stop: boolean
  warning: boolean
  overload: boolean
  live_guardrails: {
    enabled: boolean
    message: string
  }
  decision_log: JsonObject[]
  updated_at: string
}

const PROJECT_ROOT = path.resolve(process.env.PROJECT_ROOT ?? process.env.OPENCLAW_PROJECT_ROOT ?? process.cwd())
const HOME_RUNNER_ROOT = path.join(os.homedir(), 'OpenClaw-Runner')
const REPO_RUNNER_ROOT = path.join(PROJECT_ROOT, 'data', 'openclaw-runner')
const OPENCLAW_RUNNER_ROOT = path.resolve(process.env.OPENCLAW_RUNNER_ROOT ?? HOME_RUNNER_ROOT)

const TASK_BOARD_FILE = path.resolve(process.env.TASK_BOARD_FILE ?? path.join(OPENCLAW_RUNNER_ROOT, 'tasks-board.json'))
const TASK_NOTIFY_LOG_FILE = path.resolve(process.env.TASK_NOTIFY_LOG_FILE ?? path.join(OPENCLAW_RUNNER_ROOT, 'task-notifications.json'))
const AUDIT_LOG_FILE = path.resolve(process.env.AUDIT_LOG_FILE ?? path.join(PROJECT_ROOT, 'server', 'data', 'audit-log.json'))
const CONTENT_LEARNING_FILE = path.resolve(process.env.CONTENT_LEARNING_FILE ?? path.join(PROJECT_ROOT, 'data', 'content-learning.json'))
const MODE_STATE_FILE = path.resolve(
  process.env.MODE_STATE_FILE ?? path.join(PROJECT_ROOT, 'server', 'data', `system-mode.${process.env.VERCEL_BUILD_MODE === 'opensource' ? 'opensource' : 'internal'}.json`),
)

const INSTANCE_POOL_ORDER = ['builder', 'media', 'family', 'business', 'personal'] as const

const INSTANCE_POOL_LABELS: Record<(typeof INSTANCE_POOL_ORDER)[number], string> = {
  builder: '研发池',
  media: '内容池',
  family: '家庭池',
  business: '业务池',
  personal: '个人池',
}

const toTaskId = (taskName: string) =>
  taskName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `task-${Date.now()}`

const asObject = (value: unknown): JsonObject => (value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {})

const readBodyObject = (body: unknown): JsonObject => {
  if (!body) return {}
  if (typeof body === 'string') {
    try {
      return asObject(JSON.parse(body))
    } catch {
      return {}
    }
  }
  return asObject(body)
}

const readJsonFile = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T
  } catch {
    return fallback
  }
}

const writeJsonFile = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const pickExistingFile = async (preferred: string, fallback: string) => {
  try {
    await fs.access(preferred)
    return preferred
  } catch {
    return fallback
  }
}

const resolveTaskBoardFile = () => pickExistingFile(TASK_BOARD_FILE, path.join(REPO_RUNNER_ROOT, 'tasks-board.json'))
const resolveTaskNotifyFile = () => pickExistingFile(TASK_NOTIFY_LOG_FILE, path.join(REPO_RUNNER_ROOT, 'task-notifications.json'))

const normalizePoolKey = (value: unknown): (typeof INSTANCE_POOL_ORDER)[number] => {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized.includes('media')) return 'media'
  if (normalized.includes('family')) return 'family'
  if (normalized.includes('business')) return 'business'
  if (normalized.includes('personal')) return 'personal'
  return 'builder'
}

const normalizePriority = (value: unknown) => {
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return Math.min(3, Math.max(0, numeric))
  return 3
}

const isDoneStatus = (status: unknown) => ['done', 'success', 'completed', 'cancelled'].includes(String(status ?? '').toLowerCase())
const isRunningStatus = (status: unknown) => ['doing', 'running', 'active', 'in_progress'].includes(String(status ?? '').toLowerCase())
const isQueuedStatus = (status: unknown) => ['todo', 'queued', 'queue', 'pending', 'preparing'].includes(String(status ?? '').toLowerCase())
const isFailedStatus = (status: unknown) => String(status ?? '').toLowerCase() === 'failed'

const enrichTask = (item: TaskBoardItem, now: string): TaskBoardItem => {
  const taskName = String(item.task_name ?? item.title ?? `任务-${Date.now()}`)
  const pool = normalizePoolKey(item.instance_pool ?? item.domain ?? item.assigned_agent ?? item.agent)
  const updatedAt = String(item.updated_at ?? item.timestamp ?? now)
  return {
    ...item,
    task_name: taskName,
    agent: String(item.agent ?? item.assigned_agent ?? pool),
    assigned_agent: String(item.assigned_agent ?? item.agent ?? pool),
    domain: String(item.domain ?? pool),
    instance_pool: item.instance_pool ?? pool,
    type: String(item.type ?? `${pool}_task`),
    priority: normalizePriority(item.priority),
    status: String(item.status ?? 'queued'),
    timestamp: String(item.timestamp ?? updatedAt),
    updated_at: updatedAt,
    queued_at: String(item.queued_at ?? item.timestamp ?? updatedAt),
    attention: Boolean(item.attention ?? item.need_human ?? isFailedStatus(item.status)),
    abnormal: Boolean(item.abnormal),
    need_human: Boolean(item.need_human),
    decision_log: Array.isArray(item.decision_log) ? item.decision_log : [],
    history: Array.isArray(item.history) ? item.history : [],
  }
}

const summarizeBusinessBoard = (board: TaskBoardItem[]) => {
  const businessItems = board.filter((item) => item.domain === 'business' || item.type === 'business_task' || item.content_line === 'customer_followup')
  const leads = businessItems.filter((item) => item.lead_id)
  return {
    total_leads: leads.length,
    assigned_consultants: leads.filter((item) => item.consultant_id).length,
    converted: leads.filter((item) => item.converted).length,
    lost: leads.filter((item) => item.lost).length,
    attributed: leads.filter((item) => {
      const attribution = asObject(item.attribution)
      return attribution.source && attribution.medium && attribution.campaign
    }).length,
  }
}

const summarizeTaskBoard = (payload: TaskBoardPayload): TaskBoardPayload => {
  const now = new Date().toISOString()
  const board = (payload.board ?? []).map((item) => enrichTask(item, now))
  const poolStats = new Map(INSTANCE_POOL_ORDER.map((key) => [key, { running: 0, queue: 0, warning: 0 }]))

  for (const item of board) {
    const pool = normalizePoolKey(item.instance_pool ?? item.domain ?? item.assigned_agent)
    const stats = poolStats.get(pool)
    if (!stats) continue
    if (isRunningStatus(item.status)) stats.running += 1
    if (isQueuedStatus(item.status)) stats.queue += 1
    if (item.attention || item.abnormal || item.need_human || isFailedStatus(item.status)) stats.warning += 1
  }

  return {
    ...payload,
    generated_at: payload.generated_at ?? now,
    board,
    total: board.length,
    success: board.filter((item) => isDoneStatus(item.status)).length,
    failed: board.filter((item) => isFailedStatus(item.status)).length,
    running_count: board.filter((item) => isRunningStatus(item.status)).length,
    queue_count: board.filter((item) => isQueuedStatus(item.status)).length,
    failed_count: board.filter((item) => isFailedStatus(item.status)).length,
    abnormal_count: board.filter((item) => item.abnormal || item.attention).length,
    max_concurrency: INSTANCE_POOL_ORDER.length * 2,
    current_concurrency: board.filter((item) => isRunningStatus(item.status)).length,
    pools: INSTANCE_POOL_ORDER.map((key) => {
      const stats = poolStats.get(key) ?? { running: 0, queue: 0, warning: 0 }
      return {
        key,
        label: INSTANCE_POOL_LABELS[key],
        max_concurrency: 2,
        running_count: stats.running,
        queue_count: stats.queue,
        health: stats.warning > 0 ? 'warning' : 'healthy',
      }
    }),
    system_alerts: board
      .filter((item) => item.attention || item.abnormal || item.need_human || isFailedStatus(item.status))
      .slice(0, 12)
      .map((item) => ({
        level: isFailedStatus(item.status) ? 'critical' : 'warning',
        task_name: item.task_name,
        agent: item.assigned_agent ?? item.agent,
        reason: item.need_human ? '需要人工确认' : item.abnormal ? '状态异常' : isFailedStatus(item.status) ? '执行失败' : '需要关注',
      })),
    business_summary: summarizeBusinessBoard(board),
    recent_results: board
      .filter((item) => item.result)
      .sort((a, b) => Date.parse(String(b.updated_at ?? 0)) - Date.parse(String(a.updated_at ?? 0)))
      .slice(0, 6)
      .map((item) => ({
        task_name: item.task_name,
        domain: item.domain,
        updated_at: item.updated_at,
        result: item.result,
      })),
  }
}

export const readInternalTaskBoard = async () => {
  const filePath = await resolveTaskBoardFile()
  const payload = await readJsonFile<TaskBoardPayload>(filePath, { generated_at: new Date().toISOString(), board: [] })
  return summarizeTaskBoard(payload)
}

const writeInternalTaskBoard = async (payload: TaskBoardPayload) => {
  const filePath = await resolveTaskBoardFile()
  await writeJsonFile(filePath, summarizeTaskBoard({ ...payload, generated_at: new Date().toISOString() }))
}

const readAuditLog = async () => readJsonFile<{ entries?: AuditEntry[] }>(AUDIT_LOG_FILE, { entries: [] })

const appendAuditLog = async (entry: Omit<AuditEntry, 'id'>) => {
  const payload = await readAuditLog()
  const entries = Array.isArray(payload.entries) ? payload.entries : []
  const nextEntry = {
    id: `audit-${Date.now()}-${entries.length + 1}`,
    ...entry,
  }
  await writeJsonFile(AUDIT_LOG_FILE, { entries: [nextEntry, ...entries].slice(0, 100) })
  return nextEntry
}

const normalizeSystemState = (input: JsonObject): SystemState => {
  const rawSystem = String(input.system_mode ?? input.systemMode ?? process.env.SYSTEM_MODE ?? 'test').toLowerCase()
  const rawPublish = String(input.publish_mode ?? input.publishMode ?? process.env.PUBLISH_MODE ?? 'semi_auto').toLowerCase()
  const forceStop = Boolean(input.force_stop ?? input.forceStop ?? String(process.env.FORCE_STOP || 'false').toLowerCase() === 'true')
  return {
    app_mode: process.env.VERCEL_BUILD_MODE === 'opensource' ? 'opensource' : 'internal',
    system_mode: rawSystem === 'live' ? 'live' : rawSystem === 'dev' ? 'dev' : 'test',
    publish_mode: rawPublish === 'manual_only' ? 'manual_only' : rawPublish === 'auto_disabled' ? 'auto_disabled' : 'semi_auto',
    force_stop: forceStop,
    warning: Boolean(input.warning ?? false),
    overload: Boolean(input.overload ?? false),
    live_guardrails: {
      enabled: Boolean(asObject(input.live_guardrails).enabled ?? rawSystem === 'live'),
      message: String(asObject(input.live_guardrails).message ?? (rawSystem === 'live' ? '真实业务模式已开启' : '当前为验证模式，可安全调试。')),
    },
    decision_log: Array.isArray(input.decision_log) ? input.decision_log : [],
    updated_at: String(input.updated_at ?? new Date().toISOString()),
  }
}

const readSystemState = async () => normalizeSystemState(await readJsonFile<JsonObject>(MODE_STATE_FILE, {}))

const writeSystemState = async (patch: JsonObject) => {
  const current = await readSystemState()
  const next = normalizeSystemState({
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
    decision_log: Array.isArray(patch.decision_log) ? patch.decision_log : current.decision_log,
  })
  await writeJsonFile(MODE_STATE_FILE, next)
  return next
}

const readTaskNotifications = async () => {
  const filePath = await resolveTaskNotifyFile()
  return readJsonFile<{ notifications?: JsonObject[] }>(filePath, { notifications: [] })
}

const writeTaskNotifications = async (notifications: JsonObject[]) => {
  const filePath = await resolveTaskNotifyFile()
  await writeJsonFile(filePath, { notifications })
}

const readContentFeedback = async () => readJsonFile<{ records?: JsonObject[] }>(CONTENT_LEARNING_FILE, { records: [] })

const writeContentFeedback = async (records: JsonObject[]) => writeJsonFile(CONTENT_LEARNING_FILE, { records })

const createTaskBoardItem = (body: JsonObject): TaskBoardItem => {
  const now = new Date().toISOString()
  const rawInput = String(body.input ?? body.task_name ?? body.template_key ?? '').trim()
  const taskName = rawInput || `手动任务-${now}`
  const pool = normalizePoolKey(body.assigned_agent ?? body.agent ?? body.domain)
  return enrichTask({
    task_name: body.template_key ? `模板任务：${taskName}` : taskName,
    agent: pool,
    assigned_agent: pool,
    domain: pool,
    instance_pool: pool,
    priority: 3,
    type: `${pool}_task`,
    status: 'queued',
    timestamp: now,
    updated_at: now,
    queued_at: now,
    attention: false,
    abnormal: false,
    need_human: false,
    decision_log: [
      {
        timestamp: now,
        action: 'manual_continue',
        reason: 'manual_create',
        detail: '已从线上驾驶舱创建任务',
      },
    ],
    history: [
      {
        action: 'create',
        operator: 'system',
        trigger_source: 'manual',
        timestamp: now,
        status_after: 'queued',
        priority_after: 3,
      },
    ],
  }, now)
}

const updateTaskBoardItem = (item: TaskBoardItem, body: JsonObject) => {
  const now = new Date().toISOString()
  const action = String(body.action ?? '').trim()
  const currentPriority = normalizePriority(item.priority)
  const nextDecision = {
    timestamp: now,
    action,
    reason: 'manual_update',
    detail: `线上驾驶舱执行动作：${action}`,
  }

  if (action === 'pause') item.status = 'paused'
  else if (action === 'resume') item.status = 'queued'
  else if (action === 'cancel') item.status = 'cancelled'
  else if (action === 'priority_up') item.priority = Math.max(0, currentPriority - 1)
  else if (action === 'priority_down') item.priority = Math.min(3, currentPriority + 1)
  else if (action === 'takeover') {
    item.need_human = false
    item.human_owner = String(body.human_owner ?? 'builder')
    item.manual_decision = 'taken_over'
  } else if (action === 'assign') {
    item.human_owner = String(body.human_owner ?? body.assignee ?? 'builder')
    item.assigned_agent = String(body.human_owner ?? body.assignee ?? item.assigned_agent ?? 'builder')
    item.manual_decision = 'assigned'
  } else if (action === 'ignore') {
    item.manual_decision = 'ignored'
  } else if (action === 'manual_done' || action === 'mark_manual_published') {
    item.status = 'done'
    item.manual_decision = 'done'
  } else if (action === 'manual_continue' || action === 'mark_template_source') {
    item.manual_decision = 'continue'
  } else if (action) {
    throw new Error(`unsupported action: ${action}`)
  }

  item.updated_at = now
  item.decision_log = [...(Array.isArray(item.decision_log) ? item.decision_log : []), nextDecision].slice(-50)
  item.history = [
    ...(Array.isArray(item.history) ? item.history : []),
    {
      action: action || 'update',
      operator: 'builder',
      trigger_source: 'manual',
      timestamp: now,
      status_after: item.status,
      priority_after: item.priority,
    },
  ].slice(-80)
}

export async function handleInternalWorkbenchRequest(pathname: string, method: string, body?: unknown): Promise<InternalApiResult> {
  const normalizedMethod = method.toUpperCase()
  const input = readBodyObject(body)

  if (pathname === '/api/tasks-board') {
    if (normalizedMethod === 'GET') {
      return { status: 200, body: await readInternalTaskBoard() }
    }

    if (normalizedMethod === 'POST') {
      const payload = await readInternalTaskBoard()
      payload.board = [createTaskBoardItem(input), ...(payload.board ?? [])]
      await writeInternalTaskBoard(payload)
      await appendAuditLog({
        action: 'task_created',
        user: 'online-cockpit',
        time: new Date().toISOString(),
        target: String(input.input ?? input.task_name ?? input.template_key ?? 'manual-task'),
        result: 'created from Kotovela Hub',
      })
      return { status: 200, body: await readInternalTaskBoard() }
    }

    if (normalizedMethod === 'PATCH') {
      const taskName = String(input.task_name ?? '').trim()
      const payload = await readInternalTaskBoard()
      const target = (payload.board ?? []).find((item) => item.task_name === taskName)
      if (!target) return { status: 404, body: { error: 'task not found' } }
      updateTaskBoardItem(target, input)
      await writeInternalTaskBoard(payload)
      await appendAuditLog({
        action: 'task_updated',
        user: 'online-cockpit',
        time: new Date().toISOString(),
        target: taskName,
        result: `action=${String(input.action ?? 'update')}`,
      })
      return { status: 200, body: await readInternalTaskBoard() }
    }

    return { status: 405, allow: 'GET, POST, PATCH', body: { error: 'method_not_allowed' } }
  }

  if (pathname === '/api/leads') {
    if (normalizedMethod !== 'GET') return { status: 405, allow: 'GET', body: { error: 'method_not_allowed' } }
    const payload = await readInternalTaskBoard()
    const leads = (payload.board ?? [])
      .filter((item) => item.lead_id)
      .map((item) => ({
        lead_id: item.lead_id,
        task_name: item.task_name,
        source_line: item.source_line,
        account_line: item.account_line,
        content_line: item.content_line,
        consultant_id: item.consultant_id,
        consultant_owner: item.consultant_owner,
        assignment_mode: item.assignment_mode,
        assignment_status: item.assignment_status,
        converted: item.converted ?? false,
        lost: item.lost ?? false,
        attribution: item.attribution ?? null,
        status: item.status,
        domain: item.domain,
        updated_at: item.updated_at,
        decision_log: item.decision_log ?? [],
        projectId: item.projectId,
        agentId: item.agentId,
        roomId: item.roomId,
        taskId: item.taskId,
        routingHints: item.routingHints,
      }))
    return { status: 200, body: { leads } }
  }

  if (pathname === '/api/lead-stats') {
    if (normalizedMethod !== 'GET') return { status: 405, allow: 'GET', body: { error: 'method_not_allowed' } }
    const payload = await readInternalTaskBoard()
    return { status: 200, body: payload.business_summary ?? summarizeBusinessBoard(payload.board ?? []) }
  }

  if (pathname === '/api/audit-log') {
    if (normalizedMethod !== 'GET') return { status: 405, allow: 'GET', body: { error: 'method_not_allowed' } }
    return { status: 200, body: await readAuditLog() }
  }

  if (pathname === '/api/system-mode') {
    if (normalizedMethod === 'GET') return { status: 200, body: await readSystemState() }
    if (normalizedMethod === 'PATCH') {
      const actor = String(input.actor ?? 'online-cockpit')
      const actionTime = new Date().toISOString()
      const current = await readSystemState()
      const decision = {
        timestamp: actionTime,
        action: 'system_mode_updated',
        reason: 'manual_change',
        detail: `system_mode=${String(input.system_mode ?? current.system_mode)} publish_mode=${String(input.publish_mode ?? current.publish_mode)} force_stop=${String(input.force_stop ?? current.force_stop)} warning=${String(input.warning ?? current.warning)} overload=${String(input.overload ?? current.overload)}`,
        actor,
      }
      const next = await writeSystemState({
        ...input,
        decision_log: [decision, ...current.decision_log].slice(0, 50),
      })
      await appendAuditLog({
        action: 'system_mode_updated',
        user: actor,
        time: actionTime,
        target: '/api/system-mode',
        result: decision.detail,
      })
      return { status: 200, body: next }
    }
    return { status: 405, allow: 'GET, PATCH', body: { error: 'method_not_allowed' } }
  }

  if (pathname === '/api/content-feedback') {
    if (normalizedMethod === 'GET') {
      const payload = await readContentFeedback()
      return { status: 200, body: { records: Array.isArray(payload.records) ? payload.records : [] } }
    }
    if (normalizedMethod === 'POST') {
      const payload = await readContentFeedback()
      const records = Array.isArray(payload.records) ? payload.records : []
      const now = new Date().toISOString()
      const key = [input.content_line, input.account_line, input.structure_id].map((value) => String(value ?? '-')).join('|')
      const existing = records.find((record) => String(record.key) === key)
      const next = {
        ...asObject(existing),
        key,
        content_line: String(input.content_line ?? ''),
        account_line: String(input.account_line ?? ''),
        structure_id: String(input.structure_id ?? ''),
        structure_type: String(input.structure_type ?? 'short_content'),
        feedback_count: Number(asObject(existing).feedback_count ?? 0) + 1,
        avg_score: Number(input.score ?? asObject(existing).avg_score ?? 0),
        learning_score: Number(input.score ?? asObject(existing).learning_score ?? 0) / 5,
        last_feedback_at: now,
        last_updated_at: now,
      }
      if (existing) Object.assign(existing, next)
      else records.push(next)
      await writeContentFeedback(records)
      return { status: 200, body: { ok: true, record: next } }
    }
    return { status: 405, allow: 'GET, POST', body: { error: 'method_not_allowed' } }
  }

  if (pathname === '/api/task-notifications') {
    if (normalizedMethod !== 'GET') return { status: 405, allow: 'GET', body: { error: 'method_not_allowed' } }
    return { status: 200, body: await readTaskNotifications() }
  }

  if (pathname === '/api/task-notification-actions') {
    if (normalizedMethod !== 'POST') return { status: 405, allow: 'POST', body: { error: 'method_not_allowed' } }
    const payload = await readInternalTaskBoard()
    const taskName = String(input.task_name ?? '').trim()
    const taskId = String(input.task_id ?? '').trim()
    const target = (payload.board ?? []).find((item) => item.task_name === taskName || toTaskId(String(item.task_name ?? '')) === taskId)
    if (!target) return { status: 404, body: { error: 'task not found' } }
    const actionMap: Record<string, string> = {
      done: 'manual_done',
      processed: 'manual_done',
      continue: 'manual_continue',
      transfer: 'assign',
      assign: 'assign',
    }
    updateTaskBoardItem(target, { ...input, action: actionMap[String(input.group_action ?? input.action ?? '')] ?? input.action })
    await writeInternalTaskBoard(payload)
    const notificationsPayload = await readTaskNotifications()
    const notifications = Array.isArray(notificationsPayload.notifications) ? notificationsPayload.notifications : []
    const now = new Date().toISOString()
    const nextNotice = {
      id: `${now}-${toTaskId(String(target.task_name ?? 'task'))}-${String(input.group_action ?? input.action ?? 'update')}`,
      event_type: 'task_need_human',
      task_id: toTaskId(String(target.task_name ?? 'task')),
      task_name: target.task_name,
      domain: target.domain ?? 'builder',
      assigned_agent: target.assigned_agent ?? target.agent ?? 'builder',
      status: target.status ?? '-',
      summary: '群内动作已回写到驾驶舱',
      created_at: now,
      delivery: 'mock',
      message: '群内动作已回写到驾驶舱',
    }
    await writeTaskNotifications([nextNotice, ...notifications].slice(0, 80))
    return { status: 200, body: { ok: true, task_name: target.task_name, manual_decision: target.manual_decision } }
  }

  return { status: 404, body: { error: 'not_found' } }
}
