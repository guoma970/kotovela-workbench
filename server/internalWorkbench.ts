import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sendFeishuNeedHumanMessage, type FeishuDispatchResult } from './xiugDispatch.js'
import { buildKotovelaTaskApiUrl } from './xiguoTaskAccess.js'

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
  xiguo_task_id?: string
  xiguo_status?: string
  xiguo_started_at?: string
  xiguo_finished_at?: string
  source_system?: string
  due_at?: string
  deadline_at?: string
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

type XiguoPublicStatus = 'doing' | 'done' | 'blocker'

type XiguoHomeworkTask = {
  taskId: string
  projectId?: string
  title: string
  description: string
  status: XiguoPublicStatus
  priority: number
  durationMinutes?: number
  needHuman: boolean
  assignedAgent: string
  updatedAt: string
  dueAt?: string
  detailUrl: string
  statusCallbackUrl: string
}

type XiguoHomeworkCreateTaskInput = {
  id: string
  projectId?: string
  title: string
  subject?: string
  durationMinutes?: number
  description?: string
  dueAt?: string
  priority?: number
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

const truncateText = (value: unknown, limit = 360) => {
  if (typeof value !== 'string') return value
  return value.length > limit ? `${value.slice(0, limit)}...` : value
}

const compactResult = (result: unknown) => {
  const source = asObject(result)
  if (!Object.keys(source).length) return undefined
  return {
    type: source.type,
    content: truncateText(source.content, 360),
    title: truncateText(source.title, 240),
    hook: truncateText(source.hook, 360),
    outline: Array.isArray(source.outline) ? source.outline.slice(0, 5).map((item) => truncateText(item, 180)) : source.outline,
    structure: Array.isArray(source.structure) ? source.structure.slice(0, 5).map((item) => truncateText(item, 180)) : source.structure,
    script: truncateText(source.script, 360),
    full_article: truncateText(source.full_article, 360),
    publish_text: truncateText(source.publish_text, 360),
    publish_ready: source.publish_ready,
    archive_ready: source.archive_ready,
    asset_type: source.asset_type,
    generated_at: source.generated_at,
    generator: source.generator,
    persona: source.persona,
    persona_id: source.persona_id,
    tone_style: source.tone_style,
    interaction_style: source.interaction_style,
    structure_type: source.structure_type,
    structure_id: source.structure_id,
    section_map: source.section_map,
    cta_policy: source.cta_policy,
    structure_summary: truncateText(source.structure_summary, 360),
    recommend_publish_time: source.recommend_publish_time,
    recommend_frequency: source.recommend_frequency,
    publish_today: source.publish_today,
    suggested_title: truncateText(source.suggested_title, 240),
    suggested_first_comment: truncateText(source.suggested_first_comment, 360),
    suggested_interaction_question: truncateText(source.suggested_interaction_question, 360),
    publish_risk_warning: Array.isArray(source.publish_risk_warning) ? source.publish_risk_warning.slice(0, 6) : source.publish_risk_warning,
    manual_published_at: source.manual_published_at,
    manual_published_by: source.manual_published_by,
  }
}

const compactDecisionLog = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value.slice(-3).map((entry) => {
    const item = asObject(entry)
    return {
      timestamp: item.timestamp,
      action: item.action,
      reason: truncateText(item.reason, 180),
      detail: truncateText(item.detail, 160),
      route_target: item.route_target,
      route_result: item.route_result,
      account_type: item.account_type,
      tier: item.tier,
      brand_display: item.brand_display,
      mcn_display: item.mcn_display,
      can_close_deal: item.can_close_deal,
      rule_hit_reason: truncateText(item.rule_hit_reason, 160),
      whitelist_hit: item.whitelist_hit,
      block_reason: item.block_reason,
      partner_mode: item.partner_mode,
      publish_rhythm_hit: item.publish_rhythm_hit,
      persona_hit: item.persona_hit,
      memory_hit: item.memory_hit,
      profile_rule: item.profile_rule,
    }
  })
}

const compactHistory = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value.slice(-2).map((entry) => {
    const item = asObject(entry)
    return {
      action: item.action,
      timestamp: item.timestamp,
      status_before: item.status_before,
      status_after: item.status_after,
      priority_before: item.priority_before,
      priority_after: item.priority_after,
      retry_count: item.retry_count,
      trigger_source: item.trigger_source,
      decision_type: item.decision_type,
      decision_reason: truncateText(item.decision_reason, 180),
      operator: item.operator,
      error: truncateText(item.error, 180),
    }
  })
}

const compactTaskForResponse = (item: TaskBoardItem): TaskBoardItem => ({
  ...item,
  history: compactHistory(item.history),
  decision_log: compactDecisionLog(item.decision_log),
  auto_decision_log: Array.isArray(item.auto_decision_log) ? item.auto_decision_log.slice(-3) : item.auto_decision_log,
  result: process.env.INTERNAL_API_INCLUDE_RESULTS === '1' ? compactResult(item.result) : undefined,
})

const compactTemplatePool = (value: unknown) => {
  if (!Array.isArray(value)) return value
  return value.slice(0, 12).map((item) => {
    const entry = asObject(item)
    return {
      ...entry,
      content: truncateText(entry.content),
    }
  })
}

const summarizeTaskBoard = (payload: TaskBoardPayload): TaskBoardPayload => {
  const now = new Date().toISOString()
  const board = (payload.board ?? []).map((item) => compactTaskForResponse(enrichTask(item, now)))
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
    template_pool: compactTemplatePool(payload.template_pool),
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

const normalizeXiguoStatus = (value: unknown): XiguoPublicStatus | undefined => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['doing', 'running', 'started', 'in_progress'].includes(normalized)) return 'doing'
  if (['done', 'success', 'completed', 'complete'].includes(normalized)) return 'done'
  if (['blocker', 'blocked', 'need_human', 'need-human', 'failed', 'paused'].includes(normalized)) return 'blocker'
  return undefined
}

const xiguoStatusFromTask = (item: TaskBoardItem): XiguoPublicStatus => {
  const explicit = normalizeXiguoStatus(item.xiguo_status)
  if (explicit) return explicit
  if (item.need_human || item.attention || item.abnormal) return 'blocker'
  if (isDoneStatus(item.status)) return 'done'
  return 'doing'
}

const getTaskProjectId = (item: TaskBoardItem) =>
  String(item.projectId ?? item.project_id ?? item.project_line ?? item.target_group_id ?? '').trim()

const getTaskDueAt = (item: TaskBoardItem) =>
  String(item.due_at ?? item.deadline_at ?? item.dueAt ?? item.deadlineAt ?? '').trim()

const getTaskDurationMinutes = (item: TaskBoardItem) => {
  const value = Number(item.durationMinutes ?? item.duration_minutes ?? item.estimate_minutes ?? item.focus_minutes)
  return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined
}

const taskIdCandidates = (item: TaskBoardItem) => {
  const taskName = String(item.task_name ?? item.title ?? '').trim()
  return [
    item.xiguo_task_id,
    item.taskId,
    item.task_id,
    item.id,
    taskName,
    taskName ? toTaskId(taskName) : '',
  ].map((value) => String(value ?? '').trim()).filter(Boolean)
}

const matchesTaskId = (item: TaskBoardItem, taskId: string, projectId?: string) => {
  const normalizedTaskId = taskId.trim()
  const normalizedProjectId = String(projectId ?? '').trim()
  if (!taskIdCandidates(item).includes(normalizedTaskId)) return false
  if (!normalizedProjectId) return true
  return getTaskProjectId(item) === normalizedProjectId
}

const findTaskBoardItem = (board: TaskBoardItem[], taskId: string, projectId?: string) =>
  board.find((item) => matchesTaskId(item, taskId, projectId))

const formatXiguoHomeworkTask = (item: TaskBoardItem, taskId: string): XiguoHomeworkTask => {
  const projectId = getTaskProjectId(item) || undefined
  const dueAt = getTaskDueAt(item) || undefined
  const description = String(
    item.description
    ?? item.summary
    ?? item.input
    ?? item.task_detail
    ?? item.task_name
    ?? '',
  ).trim()

  return {
    taskId,
    projectId,
    title: String(item.title ?? item.task_name ?? `学习任务 ${taskId}`).trim(),
    description,
    status: xiguoStatusFromTask(item),
    priority: normalizePriority(item.priority),
    durationMinutes: getTaskDurationMinutes(item),
    needHuman: Boolean(item.need_human || item.attention || item.abnormal),
    assignedAgent: String(item.assigned_agent ?? item.agent ?? 'family'),
    updatedAt: String(item.updated_at ?? item.timestamp ?? new Date().toISOString()),
    dueAt,
    detailUrl: buildKotovelaTaskApiUrl('/api/xiguo-task', { taskId, projectId }),
    statusCallbackUrl: buildKotovelaTaskApiUrl('/api/xiguo-task-status', { taskId, projectId }),
  }
}

const appendTaskNotification = async (notice: JsonObject) => {
  const notificationsPayload = await readTaskNotifications()
  const notifications = Array.isArray(notificationsPayload.notifications) ? notificationsPayload.notifications : []
  await writeTaskNotifications([notice, ...notifications].slice(0, 100))
  return notice
}

const createXiguoNeedHumanNotification = (item: TaskBoardItem, taskId: string, reason: string, now: string) => ({
  id: `${now}-${taskId}-xiguo-need-human`,
  event_type: 'task_need_human',
  task_id: taskId,
  task_name: item.task_name ?? item.title ?? taskId,
  domain: item.domain ?? 'family',
  assigned_agent: item.assigned_agent ?? item.agent ?? 'family',
  status: item.status ?? 'need_human',
  summary: reason,
  target_group: '小羲 / family 协作群',
  target_group_id: item.target_group_id ?? 'family',
  target_channel: 'feishu',
  scheduler_hint: '打开 Kotovela Hub /tasks 查看详情',
  created_at: now,
  delivery: 'feishu',
  message: `【羲果学习任务需要人工确认】\n任务：${String(item.task_name ?? item.title ?? taskId)}\n原因：${reason}\n状态：Need Human`,
})

const normalizeXiguoCreateTask = (value: unknown): XiguoHomeworkCreateTaskInput | undefined => {
  const item = asObject(value)
  const id = String(item.id ?? item.taskId ?? item.task_id ?? '').trim()
  const title = String(item.title ?? item.task_name ?? id).trim()
  if (!id || !title) return undefined

  const durationMinutes = Number(item.durationMinutes ?? item.duration_minutes ?? item.focus_minutes)
  const priority = Number(item.priority)
  return {
    id,
    projectId: String(item.projectId ?? item.project_id ?? 'family_study').trim() || 'family_study',
    title,
    subject: String(item.subject ?? 'study').trim() || 'study',
    durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.round(durationMinutes) : undefined,
    description: String(item.description ?? item.summary ?? '').trim(),
    dueAt: String(item.dueAt ?? item.due_at ?? item.deadlineAt ?? item.deadline_at ?? '').trim() || undefined,
    priority: Number.isFinite(priority) ? normalizePriority(priority) : 1,
  }
}

const buildXiguoHomeworkBoardItem = (
  task: XiguoHomeworkCreateTaskInput,
  input: JsonObject,
  now: string,
  existing?: TaskBoardItem,
): TaskBoardItem => {
  const previousDecisionLog = Array.isArray(existing?.decision_log) ? existing.decision_log : []
  const previousHistory = Array.isArray(existing?.history) ? existing.history : []
  const projectId = task.projectId || 'family_study'
  const status = String(existing?.status ?? input.status ?? 'doing')
  const decisionAction = existing ? 'xiguo_task_upserted' : 'xiguo_task_created'

  return enrichTask({
    ...asObject(existing),
    task_name: task.title,
    title: task.title,
    description: task.description,
    taskId: task.id,
    task_id: task.id,
    xiguo_task_id: task.id,
    xiguo_status: normalizeXiguoStatus(existing?.xiguo_status ?? input.xiguo_status ?? status) ?? 'doing',
    source_system: 'kotovela-hub',
    target_system: 'xiguo-companion',
    agent: 'family',
    assigned_agent: 'family',
    preferred_agent: 'family',
    domain: 'family',
    subdomain: 'study',
    projectId,
    project_id: projectId,
    project_line: projectId,
    target_group_id: projectId,
    notify_mode: 'feishu',
    type: 'family_task',
    status,
    priority: task.priority ?? normalizePriority(existing?.priority ?? 1),
    durationMinutes: task.durationMinutes,
    duration_minutes: task.durationMinutes,
    subject: task.subject,
    due_at: task.dueAt,
    updated_at: now,
    timestamp: String(existing?.timestamp ?? now),
    queued_at: String(existing?.queued_at ?? now),
    attention: Boolean(existing?.attention ?? false),
    abnormal: Boolean(existing?.abnormal ?? false),
    need_human: Boolean(existing?.need_human ?? false),
    user_id: String(input.userId ?? input.user_id ?? existing?.user_id ?? 'guoguo'),
    profile_tags: Array.isArray(existing?.profile_tags) ? existing.profile_tags : ['晚间学习', '需要陪伴', '飞书作业'],
    decision_log: [
      ...previousDecisionLog,
      {
        timestamp: now,
        action: decisionAction,
        reason: 'xiguo_homework_dispatch',
        detail: existing ? '羲果作业任务已更新，准备重新发送提醒。' : '羲果作业任务已创建，准备发送飞书提醒。',
      },
    ].slice(-50),
    history: [
      ...previousHistory,
      {
        action: decisionAction,
        operator: String(input.confirmedBy ?? input.confirmed_by ?? 'kotovela-hub'),
        trigger_source: 'xiguo-dispatch',
        timestamp: now,
        status_after: status,
        priority_after: task.priority ?? normalizePriority(existing?.priority ?? 1),
      },
    ].slice(-80),
  }, now)
}

export async function createXiguoHomeworkTasks(input: JsonObject): Promise<InternalApiResult> {
  if (process.env.VERCEL_BUILD_MODE === 'opensource') {
    return { status: 404, body: { ok: false, error: 'not_found' } }
  }

  const tasks = Array.isArray(input.tasks)
    ? input.tasks.map(normalizeXiguoCreateTask).filter((task): task is XiguoHomeworkCreateTaskInput => Boolean(task))
    : []
  if (!tasks.length) return { status: 400, body: { ok: false, error: 'missing_tasks' } }

  const now = new Date().toISOString()
  const payload = await readInternalTaskBoard()
  const board = payload.board ?? []
  const created: string[] = []
  const updated: string[] = []

  for (const task of tasks) {
    const existingIndex = board.findIndex((item) => matchesTaskId(item, task.id, task.projectId))
    const existing = existingIndex >= 0 ? board[existingIndex] : undefined
    const next = buildXiguoHomeworkBoardItem(task, input, now, existing)
    if (existingIndex >= 0) {
      board[existingIndex] = next
      updated.push(task.id)
    } else {
      board.unshift(next)
      created.push(task.id)
    }
  }

  payload.board = board
  await writeInternalTaskBoard(payload)

  const audit = await appendAuditLog({
    action: 'xiguo_homework_tasks_upserted',
    user: String(input.confirmedBy ?? input.confirmed_by ?? 'kotovela-hub'),
    time: now,
    target: tasks.map((task) => task.id).join(', '),
    result: `created=${created.length} updated=${updated.length}`,
  })

  return {
    status: 200,
    body: {
      ok: true,
      created,
      updated,
      audit,
      tasks: tasks.map((task) => formatXiguoHomeworkTask(
        board.find((item) => matchesTaskId(item, task.id, task.projectId)) ?? buildXiguoHomeworkBoardItem(task, input, now),
        task.id,
      )),
    },
  }
}

const applyXiguoStatus = (item: TaskBoardItem, input: {
  status: XiguoPublicStatus
  taskId: string
  actor?: string
  reason?: string
  now: string
}) => {
  const previousStatus = String(item.status ?? '')
  const previousPriority = normalizePriority(item.priority)
  const actor = String(input.actor ?? 'xiguo-companion')
  const reason = String(input.reason ?? (input.status === 'blocker' ? '孩子端反馈需要协助' : '孩子端状态同步')).trim()
  const nextStatus = input.status === 'done' ? 'done' : input.status === 'blocker' ? 'need_human' : 'doing'

  item.status = nextStatus
  item.updated_at = input.now
  item.timestamp = String(item.timestamp ?? input.now)
  item.xiguo_task_id = input.taskId
  item.xiguo_status = input.status
  item.source_system = 'xiguo-companion'
  item.need_human = input.status === 'blocker'
  item.attention = input.status === 'blocker'
  item.abnormal = input.status === 'blocker'
  if (input.status === 'doing') item.xiguo_started_at = item.xiguo_started_at ?? input.now
  if (input.status === 'done') {
    item.xiguo_finished_at = input.now
    item.need_human = false
    item.attention = false
    item.abnormal = false
  }

  const decision = {
    timestamp: input.now,
    action: 'xiguo_status_update',
    reason: input.status === 'blocker' ? 'xiguo_need_human' : 'xiguo_child_action',
    detail: `羲果陪伴回写状态：${input.status}；${reason}`,
    actor,
  }
  item.decision_log = [...(Array.isArray(item.decision_log) ? item.decision_log : []), decision].slice(-50)
  item.history = [
    ...(Array.isArray(item.history) ? item.history : []),
    {
      action: `xiguo_${input.status}`,
      operator: actor,
      trigger_source: 'xiguo-companion',
      timestamp: input.now,
      status_before: previousStatus,
      status_after: nextStatus,
      priority_before: previousPriority,
      priority_after: item.priority,
      decision_reason: reason,
    },
  ].slice(-80)
}

const isXiguoCandidateTask = (item: TaskBoardItem) => {
  const values = [
    item.source_system,
    item.target_system,
    item.xiguo_task_id,
    item.domain,
    item.assigned_agent,
    item.agent,
    item.project_line,
    item.target_group_id,
  ].map((value) => String(value ?? '').toLowerCase())

  return values.some((value) => value.includes('xiguo') || value.includes('family') || value.includes('study'))
}

const getTimeoutReason = (item: TaskBoardItem, nowMs: number, timeoutMinutes: number) => {
  const dueAt = getTaskDueAt(item)
  if (dueAt && Date.parse(dueAt) <= nowMs) return '超过约定完成时间，已提示人工确认。'

  const startedAt = String(item.xiguo_started_at ?? item.started_at ?? item.updated_at ?? '').trim()
  const startedMs = Date.parse(startedAt)
  if (isRunningStatus(item.status) && Number.isFinite(startedMs) && nowMs - startedMs > timeoutMinutes * 60_000) {
    return `进行超过 ${timeoutMinutes} 分钟未完成，已提示人工确认。`
  }

  return ''
}

export async function readXiguoHomeworkTask(input: { taskId: string; projectId?: string }): Promise<InternalApiResult> {
  if (process.env.VERCEL_BUILD_MODE === 'opensource') {
    return { status: 404, body: { ok: false, error: 'not_found' } }
  }

  const taskId = input.taskId.trim()
  if (!taskId) return { status: 400, body: { ok: false, error: 'missing_task_id' } }

  const payload = await readInternalTaskBoard()
  const target = findTaskBoardItem(payload.board ?? [], taskId, input.projectId)
  if (!target) return { status: 404, body: { ok: false, error: 'task_not_found' } }

  return { status: 200, body: { ok: true, task: formatXiguoHomeworkTask(target, taskId) } }
}

export async function updateXiguoHomeworkTaskStatus(input: JsonObject): Promise<InternalApiResult> {
  if (process.env.VERCEL_BUILD_MODE === 'opensource') {
    return { status: 404, body: { ok: false, error: 'not_found' } }
  }

  const taskId = String(input.taskId ?? input.task_id ?? '').trim()
  const projectId = String(input.projectId ?? input.project_id ?? '').trim() || undefined
  const status = normalizeXiguoStatus(input.status)
  if (!taskId) return { status: 400, body: { ok: false, error: 'missing_task_id' } }
  if (!status) return { status: 400, body: { ok: false, error: 'invalid_status' } }

  const now = new Date().toISOString()
  const payload = await readInternalTaskBoard()
  const target = findTaskBoardItem(payload.board ?? [], taskId, projectId)
  if (!target) return { status: 404, body: { ok: false, error: 'task_not_found' } }

  const reason = String(input.reason ?? '').trim()
  applyXiguoStatus(target, {
    status,
    taskId,
    actor: String(input.actor ?? 'xiguo-companion'),
    reason,
    now,
  })
  await writeInternalTaskBoard(payload)

  const audit = await appendAuditLog({
    action: 'xiguo_task_status_updated',
    user: String(input.actor ?? 'xiguo-companion'),
    time: now,
    target: taskId,
    result: `status=${status}${reason ? ` reason=${reason}` : ''}`,
  })

  let notification: JsonObject | undefined
  let feishu: FeishuDispatchResult | undefined
  if (status === 'blocker') {
    const alertReason = reason || '孩子端反馈任务遇到卡点，需要人工协助。'
    notification = await appendTaskNotification(createXiguoNeedHumanNotification(target, taskId, alertReason, now))
    feishu = await sendFeishuNeedHumanMessage({
      taskId,
      taskName: String(target.task_name ?? target.title ?? taskId),
      reason: alertReason,
      deepLink: buildKotovelaTaskApiUrl('/tasks', { taskId, projectId }),
    })
  }

  return {
    status: 200,
    body: {
      ok: true,
      task: formatXiguoHomeworkTask(target, taskId),
      audit,
      notification,
      feishu,
    },
  }
}

export async function scanXiguoHomeworkAlerts(input: JsonObject): Promise<InternalApiResult> {
  if (process.env.VERCEL_BUILD_MODE === 'opensource') {
    return { status: 404, body: { ok: false, error: 'not_found' } }
  }

  const timeoutMinutes = Math.max(5, Number(input.timeoutMinutes ?? input.timeout_minutes ?? 30))
  const now = new Date().toISOString()
  const nowMs = Date.parse(now)
  const payload = await readInternalTaskBoard()
  const alerts: Array<{ taskId: string; taskName: string; reason: string; feishu: FeishuDispatchResult }> = []

  for (const item of payload.board ?? []) {
    if (!isXiguoCandidateTask(item)) continue
    if (isDoneStatus(item.status) || xiguoStatusFromTask(item) === 'blocker') continue

    const reason = getTimeoutReason(item, nowMs, timeoutMinutes)
    if (!reason) continue

    const taskId = String(item.xiguo_task_id ?? item.taskId ?? item.task_id ?? toTaskId(String(item.task_name ?? 'task'))).trim()
    applyXiguoStatus(item, {
      status: 'blocker',
      taskId,
      actor: 'kotovela-alerts',
      reason,
      now,
    })
    await appendTaskNotification(createXiguoNeedHumanNotification(item, taskId, reason, now))
    const feishu = await sendFeishuNeedHumanMessage({
      taskId,
      taskName: String(item.task_name ?? item.title ?? taskId),
      reason,
      deepLink: buildKotovelaTaskApiUrl('/tasks', { taskId, projectId: getTaskProjectId(item) || undefined }),
    })
    alerts.push({ taskId, taskName: String(item.task_name ?? item.title ?? taskId), reason, feishu })
    await appendAuditLog({
      action: 'xiguo_task_need_human',
      user: 'kotovela-alerts',
      time: now,
      target: taskId,
      result: reason,
    })
  }

  if (alerts.length > 0) await writeInternalTaskBoard(payload)

  return {
    status: 200,
    body: {
      ok: true,
      timeoutMinutes,
      alerts,
    },
  }
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

  if (pathname === '/api/xiguo-task') {
    if (normalizedMethod !== 'GET') return { status: 405, allow: 'GET', body: { error: 'method_not_allowed' } }
    return readXiguoHomeworkTask({
      taskId: String(input.taskId ?? input.task_id ?? '').trim(),
      projectId: String(input.projectId ?? input.project_id ?? '').trim() || undefined,
    })
  }

  if (pathname === '/api/xiguo-task-status') {
    if (!['POST', 'PATCH'].includes(normalizedMethod)) {
      return { status: 405, allow: 'POST, PATCH', body: { error: 'method_not_allowed' } }
    }
    return updateXiguoHomeworkTaskStatus(input)
  }

  if (pathname === '/api/xiguo-task-create') {
    if (normalizedMethod !== 'POST') return { status: 405, allow: 'POST', body: { error: 'method_not_allowed' } }
    return createXiguoHomeworkTasks(input)
  }

  if (pathname === '/api/xiguo-task-alerts') {
    if (normalizedMethod !== 'POST') return { status: 405, allow: 'POST', body: { error: 'method_not_allowed' } }
    return scanXiguoHomeworkAlerts(input)
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
