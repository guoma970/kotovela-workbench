import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fetchOfficeInstancesPayload } from './server/officeInstances'

type TaskNotifyEvent = 'task_queued' | 'task_done' | 'task_failed' | 'task_warning' | 'task_need_human'

type NotifyMode = 'default' | 'need_human' | 'confirm' | 'assigned' | 'reminder'

type TaskNotificationRecord = {
  id: string
  event_type: TaskNotifyEvent
  task_id: string
  task_name: string
  domain: string
  subdomain: string
  project_line: string
  notify_mode: NotifyMode
  assigned_agent: string
  status: string
  summary: string
  target_group: string
  target_group_id: string
  target_channel: string
  scheduler_hint: string
  created_at: string
  delivery: 'mock' | 'webhook'
  message: string
}

const TASK_BOARD_FILE = path.resolve('/Users/ztl/OpenClaw-Runner/tasks-board.json')
const TASK_NOTIFY_LOG_FILE = path.resolve('/Users/ztl/OpenClaw-Runner/task-notifications.json')

const PROJECT_LINE_NOTIFY_TARGET: Record<string, { group: string; groupId: string; channel: string }> = {
  openclaw_content: { group: 'OpenClaw内容运营群', groupId: 'openclaw_content', channel: 'media' },
  account_ops: { group: '账号运营群', groupId: 'account_ops', channel: 'media' },
  latin_boy: { group: '拉丁男孩果果运营群', groupId: 'latin_boy', channel: 'media' },
  chongming: { group: '崇明小娘爱收纳运营群', groupId: 'chongming', channel: 'media' },
  mom970: { group: '果妈970运营群', groupId: 'mom970', channel: 'media' },
  book: { group: '日式装修指南书稿群', groupId: 'book', channel: 'media' },
  tech: { group: '言町科技运营群', groupId: 'tech', channel: 'business' },
  housing: { group: '言家住宅运营群', groupId: 'housing', channel: 'business' },
  biz_content: { group: '言纳筑集运营群', groupId: 'biz_content', channel: 'business' },
  official_account: { group: '公众号运营群', groupId: 'official_account', channel: 'business' },
  family_study: { group: '果果学习协同群', groupId: 'family_study', channel: 'family' },
  family_homework: { group: '果果作业协同群', groupId: 'family_homework', channel: 'family' },
  family_reminder: { group: '家庭提醒群', groupId: 'family_reminder', channel: 'family' },
  family_affairs: { group: '家庭事务群', groupId: 'family_affairs', channel: 'family' },
  confirm: { group: '果果学习协同群', groupId: 'confirm', channel: 'family' },
  assign: { group: '果果学习布置群', groupId: 'assign', channel: 'family' },
  builder_page: { group: '研发页面群', groupId: 'builder_page', channel: 'builder' },
  builder_api: { group: '研发接口群', groupId: 'builder_api', channel: 'builder' },
  builder_bugfix: { group: '研发修复群', groupId: 'builder_bugfix', channel: 'builder' },
  builder_default: { group: '系统运维群', groupId: 'builder_default', channel: 'builder' },
  personal_reminder: { group: '个人提醒群', groupId: 'personal_reminder', channel: 'personal' },
  personal_affairs: { group: '个人事务群', groupId: 'personal_affairs', channel: 'personal' },
  system_default: { group: '系统运维群', groupId: 'system_default', channel: 'system' },
}

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
    | 'preempt'
    | 'auto_priority_down'
    | 'abnormal_detected'
    | 'stuck_detected'
    | 'auto_notify'
    | 'need_human'
    | 'blocked'
    | 'unblocked'
    | 'dependency_resolved'
  timestamp: string
  status_before?: string
  status_after?: string
  priority_before?: number
  priority_after?: number
  retry_count?: number
  error?: string
  trigger_source?: 'manual' | 'system' | 'rule_engine'
  decision_type?: 'auto_retry' | 'auto_priority_down' | 'stuck_detected' | 'abnormal_detected' | 'need_human' | 'auto_notify'
  decision_reason?: string
  operator?: 'system' | 'builder'
  before?: { status?: string; priority?: number }
  after?: { status?: string; priority?: number }
}

type DecisionLogEntry = {
  timestamp: string
  action: 'retry' | 'warning' | 'need_human' | 'notify_result' | 'manual_takeover' | 'manual_assign' | 'manual_ignore' | 'manual_done' | 'manual_continue' | 'preempt' | 'priority_up' | 'priority_down' | 'blocked' | 'unblocked' | 'dependency_resolved'
  reason: string
  detail: string
}

type TaskBoardItem = {
  task_name: string
  agent: string
  domain?: string
  subdomain?: string
  project_line?: string
  target_group_id?: string
  notify_mode?: NotifyMode
  preferred_agent?: string
  assigned_agent?: string
  target_system?: string
  slot_id?: string | null
  instance_pool?: 'builder' | 'media' | 'family' | 'business' | 'personal'
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
  decision_log?: DecisionLogEntry[]
  need_human?: boolean
  human_owner?: string
  taken_over_at?: string
  manual_decision?: 'taken_over' | 'assigned' | 'ignored' | 'done' | 'continue'
  auto_action?: 'retry' | 'warning' | 'need_human' | 'notify_result'
  queued_at?: string
  slot_active?: boolean
  health?: 'healthy' | 'warning' | 'critical'
  result?: {
    type: 'text'
    content: string
    meta?: Record<string, unknown>
    title: string
    hook: string
    outline: string[]
    script: string
    publish_text: string
    generated_at?: string
    generator?: 'mock' | 'gpt'
  }
  depends_on?: string[]
  blocked_by?: string[]
  dependency_status?: 'ready' | 'blocked' | 'resolved'
}

type TaskBoardPayload = {
  generated_at?: string
  tasks_file?: string
  total?: number
  success?: number
  failed?: number
  max_concurrency?: number
  current_concurrency?: number
  running_count?: number
  queue_count?: number
  failed_count?: number
  abnormal_count?: number
  pools?: Array<{
    key: 'builder' | 'media' | 'family' | 'business' | 'personal'
    label: string
    max_concurrency: number
    running_count: number
    queue_count: number
    health: 'healthy' | 'warning' | 'critical'
  }>
  system_alerts?: { level: 'warning' | 'critical'; task_name?: string; agent?: string; reason: string }[]
  recent_results?: Array<{
    task_name: string
    domain?: string
    updated_at?: string
    result: NonNullable<TaskBoardItem['result']>
  }>
  board: TaskBoardItem[]
}

const INSTANCE_POOL_ORDER = ['builder', 'media', 'family', 'business', 'personal'] as const
type InstancePoolKey = (typeof INSTANCE_POOL_ORDER)[number]
const QUEUE_WARNING_MS = 60_000
const DOMAIN_PRIORITY_MAP: Record<InstancePoolKey, number> = {
  family: 0,
  business: 1,
  builder: 2,
  media: 2,
  personal: 3,
}

function appendDecisionLog(
  item: TaskBoardItem,
  action: DecisionLogEntry['action'],
  reason: string,
  detail: string,
  timestamp: string,
) {
  const exists = (item.decision_log ?? []).some((entry) => entry.action === action && entry.reason === reason && entry.detail === detail)
  if (exists) return
  item.decision_log = [...(item.decision_log ?? []), { timestamp, action, reason, detail }]
  item.auto_decision_log = [...(item.auto_decision_log ?? []), detail]
  if (['retry', 'warning', 'need_human', 'notify_result'].includes(action)) {
    item.auto_action = action as NonNullable<TaskBoardItem['auto_action']>
  }
}

function clampPriority(priority?: number) {
  const normalized = Number.isFinite(priority) ? Number(priority) : 3
  return Math.min(3, Math.max(0, normalized))
}

function priorityLabel(priority?: number) {
  return `P${clampPriority(priority)}`
}

function computeBasePriority(item: TaskBoardItem) {
  return DOMAIN_PRIORITY_MAP[inferPool(item)] ?? 3
}

function resolvePriority(item: TaskBoardItem) {
  const basePriority = computeBasePriority(item)
  if (item.need_human) return 0
  return clampPriority(item.priority ?? basePriority)
}

type RoutedTaskSpec = {
  domain: InstancePoolKey
  subdomain: string
  project_line: string
  target_group_id: string
  notify_mode: NotifyMode
  type: string
  preferred_agent: InstancePoolKey
  assigned_agent: InstancePoolKey
  target_system: string
}

const INSTANCE_POOL_CONFIG: Record<InstancePoolKey, { label: string; maxConcurrency: number }> = {
  builder: { label: 'Builder', maxConcurrency: 2 },
  media: { label: 'Media', maxConcurrency: 2 },
  family: { label: 'Family', maxConcurrency: 1 },
  business: { label: 'Business', maxConcurrency: 1 },
  personal: { label: 'Personal', maxConcurrency: 1 },
}

const STRONG_DOMAIN_KEYWORDS: Record<InstancePoolKey, string[]> = {
  builder: ['页面', '接口', '报错'],
  media: ['内容', '选题', '发布'],
  family: ['果果', '学习', '作业', '家庭'],
  business: ['客户', '报价', '合同'],
  personal: ['提醒', '个人'],
}

const ACTION_KEYWORDS = ['做', '安排', '修复', '跟进'] as const

const PROJECT_LINE_RULES: Array<Omit<RoutedTaskSpec, 'preferred_agent' | 'assigned_agent' | 'target_system'> & { keywords: string[] }> = [
  { domain: 'personal', subdomain: 'reminder', project_line: 'personal_reminder', target_group_id: 'personal_reminder', notify_mode: 'default', type: 'personal_task', keywords: ['我', '自己', '个人', '个人提醒', '提醒我', '记得', '待办', '办一下'] },
  { domain: 'personal', subdomain: 'personal_affair', project_line: 'personal_affairs', target_group_id: 'personal_affairs', notify_mode: 'default', type: 'personal_task', keywords: ['个人事务', '证件', '报销', '快递', '缴费', '预约'] },
  { domain: 'family', subdomain: 'study', project_line: 'family_study', target_group_id: 'family_study', notify_mode: 'default', type: 'family_task', keywords: ['果果', '学习', '复习', '预习', '读书', '背单词', '练字'] },
  { domain: 'family', subdomain: 'homework', project_line: 'family_homework', target_group_id: 'family_homework', notify_mode: 'assigned', type: 'family_task', keywords: ['作业', '题目', '练习册', '口算', '试卷', '练习'] },
  { domain: 'family', subdomain: 'reminder', project_line: 'family_reminder', target_group_id: 'family_reminder', notify_mode: 'reminder', type: 'family_task', keywords: ['接送', '提醒孩子', '提醒果果', '家庭提醒', '睡觉', '刷牙', '整理书包'] },
  { domain: 'family', subdomain: 'household', project_line: 'family_affairs', target_group_id: 'family_affairs', notify_mode: 'default', type: 'family_task', keywords: ['家庭', '家里', '家务', '采购', '买菜', '收纳', '家长会'] },
  { domain: 'family', subdomain: 'study', project_line: 'confirm', target_group_id: 'confirm', notify_mode: 'need_human', type: 'family_task', keywords: ['need_human', '人工介入', '家长确认'] },
  { domain: 'family', subdomain: 'study', project_line: 'confirm', target_group_id: 'confirm', notify_mode: 'confirm', type: 'family_task', keywords: ['confirm', '确认', '待确认'] },
  { domain: 'media', subdomain: 'openclaw_content', project_line: 'openclaw_content', target_group_id: 'openclaw_content', notify_mode: 'default', type: 'content_task', keywords: ['openclaw', 'open claw', '内容中台'] },
  { domain: 'media', subdomain: 'account_ops', project_line: 'account_ops', target_group_id: 'account_ops', notify_mode: 'default', type: 'content_task', keywords: ['账号运营', '涨粉', '账号', '小红书', '抖音', '视频号'] },
  { domain: 'media', subdomain: 'manuscript', project_line: 'book', target_group_id: 'book', notify_mode: 'default', type: 'content_task', keywords: ['书稿', '书', '章节', '装修指南', 'manuscript'] },
  { domain: 'media', subdomain: 'content', project_line: 'latin_boy', target_group_id: 'latin_boy', notify_mode: 'default', type: 'content_task', keywords: ['拉丁', '男孩果果', 'latin boy', 'guoguo'] },
  { domain: 'media', subdomain: 'content', project_line: 'chongming', target_group_id: 'chongming', notify_mode: 'default', type: 'content_task', keywords: ['崇明', '收纳号', 'storage'] },
  { domain: 'media', subdomain: 'content', project_line: 'mom970', target_group_id: 'mom970', notify_mode: 'default', type: 'content_task', keywords: ['果妈970', '970内容', 'mom970'] },
  { domain: 'media', subdomain: 'content', project_line: 'openclaw_content', target_group_id: 'openclaw_content', notify_mode: 'default', type: 'content_task', keywords: ['内容', '文案', '选题', '发布'] },
  { domain: 'business', subdomain: 'tech', project_line: 'tech', target_group_id: 'tech', notify_mode: 'default', type: 'business_task', keywords: ['客户', '报价', '合同', '技术方案', '系统方案', '技术支持', 'tech', '言町科技', '科技运营'] },
  { domain: 'business', subdomain: 'housing', project_line: 'housing', target_group_id: 'housing', notify_mode: 'default', type: 'business_task', keywords: ['住宅', '楼盘', '户型', '装修客户', 'housing', '言家住宅'] },
  { domain: 'business', subdomain: 'biz_content', project_line: 'biz_content', target_group_id: 'biz_content', notify_mode: 'default', type: 'business_task', keywords: ['商单内容', '品牌内容', '案例稿', 'biz_content', '言纳筑集', '筑集'] },
  { domain: 'business', subdomain: 'official_account', project_line: 'official_account', target_group_id: 'official_account', notify_mode: 'default', type: 'business_task', keywords: ['公众号', '公号', '推文', '头条封面', 'official account', 'official_account'] },
  { domain: 'builder', subdomain: 'page', project_line: 'builder_page', target_group_id: 'builder_page', notify_mode: 'default', type: 'builder_task', keywords: ['页面', '前端', 'ui', '交互', '样式'] },
  { domain: 'builder', subdomain: 'api', project_line: 'builder_api', target_group_id: 'builder_api', notify_mode: 'default', type: 'builder_task', keywords: ['接口', 'api', '后端', '联调', '数据库'] },
  { domain: 'builder', subdomain: 'bugfix', project_line: 'builder_bugfix', target_group_id: 'builder_bugfix', notify_mode: 'default', type: 'builder_task', keywords: ['修复', 'bug', '报错', '异常', '回归'] },
  { domain: 'builder', subdomain: 'engineering', project_line: 'builder_default', target_group_id: 'builder_default', notify_mode: 'default', type: 'builder_task', keywords: ['开发', '实现', '功能'] },
]

function inferTaskRoute(input: string): RoutedTaskSpec {
  const normalized = input.trim().toLowerCase()
  const lockedDomain = (Object.entries(STRONG_DOMAIN_KEYWORDS) as Array<[InstancePoolKey, string[]]>).find(([, keywords]) =>
    keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  )?.[0]
  const hasActionKeyword = ACTION_KEYWORDS.some((keyword) => normalized.includes(keyword))
  const matched = PROJECT_LINE_RULES.find((rule) => {
    if (lockedDomain && rule.domain !== lockedDomain) return false
    return rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  })
  const domain = lockedDomain ?? matched?.domain ?? (hasActionKeyword ? 'builder' : 'builder')
  const projectLine = matched?.project_line ?? 'builder_default'
  const targetGroupId = matched?.target_group_id ?? projectLine
  const fallbackSubdomain =
    domain === 'business'
      ? 'tech'
      : domain === 'media'
        ? 'content'
        : domain === 'family'
          ? 'household'
          : domain === 'personal'
            ? 'personal_affair'
            : 'engineering'
  return {
    domain,
    subdomain: matched?.subdomain ?? fallbackSubdomain,
    project_line: projectLine,
    target_group_id: targetGroupId,
    notify_mode: matched?.notify_mode ?? 'default',
    type: matched?.type ?? `${domain}_task`,
    preferred_agent: domain,
    assigned_agent: domain,
    target_system: `openclaw-${domain}`,
  }
}

function buildMediaResult(taskName: string, timestamp: string): NonNullable<TaskBoardItem['result']> {
  const topic = taskName.replace(/^queue:/i, '').trim() || '本周内容选题'
  const title = `3 分钟讲清：${topic}`
  const hook = `你以为 ${topic} 只是常规动作，但真正拉开差距的是前 10 秒怎么说。`
  const outline = [
    `为什么现在要做「${topic}」`,
    '用户最容易忽略的 1 个误区',
    '可直接照着执行的 3 步方法',
    '结尾行动指令与互动提问',
  ]
  const script = `开头：\n你以为 ${topic} 只是例行安排，但真正决定效果的，是能不能在最短时间里让人愿意继续看。\n\n中段：\n第一步，先把用户最关心的问题直接点出来。\n第二步，用一个常见错误案例说明为什么很多人做了也没效果。\n第三步，给出今天就能执行的清晰动作，让内容从“知道”变成“会做”。\n\n结尾：\n如果你也在推进 ${topic}，先把你卡住的一步留言出来，我再继续帮你拆。`
  const publishText = `今日内容｜${topic}\n\n别再把内容只当成“发一条”。真正有效的内容，要先抓住注意力，再给到能马上执行的动作。\n\n这次我整理了开头 hook、结构提纲和完整脚本，拿去就能发。\n\n如果你也在做 ${topic}，欢迎留言交流。`
  const content = [title, hook, ...outline.map((line, idx) => `${idx + 1}. ${line}`), script, publishText].join('\n\n')
  return {
    type: 'text',
    content,
    meta: { domain: 'media', executor: 'content_executor' },
    title,
    hook,
    outline,
    script,
    publish_text: publishText,
    generated_at: timestamp,
    generator: 'mock',
  }
}

function buildTextResult(content: string, meta?: Record<string, unknown>): NonNullable<TaskBoardItem['result']> {
  return {
    type: 'text',
    content,
    meta: meta ?? {},
    title: '执行结果',
    hook: content.split(/\n+/).find(Boolean) ?? content,
    outline: [],
    script: content,
    publish_text: content,
    generated_at: new Date().toISOString(),
    generator: 'mock',
  }
}

function executeTask(item: TaskBoardItem, now: string): NonNullable<TaskBoardItem['result']> {
  const domain = item.domain ?? inferPool(item)
  if (domain === 'media') return buildMediaResult(item.task_name, now)
  if (domain === 'business') {
    return buildTextResult(
      `跟进建议：先确认客户当前报价顾虑，再补一版对比清单与下一步时间点。\n\n建议回复：\n已收到您对报价的关注，我这边建议先对齐 3 个点，分别是范围、交付节点、可替代方案。我今天可先补一版精简报价说明，方便您内部确认，明天下午前再跟您同步最终建议。`,
      { domain, executor: 'followup_executor' },
    )
  }
  if (domain === 'personal') {
    return buildTextResult(
      `提醒文案：明天记得整理待办，先把必须完成、可延后、可委托三类分开，10 分钟内先清一遍高优先级事项。`,
      { domain, executor: 'reminder_executor' },
    )
  }
  if (domain === 'family') {
    return buildTextResult(
      `家庭执行建议：先确认时间和参与人，再拆成 3 个最小动作，避免提醒过长导致落空。`,
      { domain, executor: 'plan_executor' },
    )
  }
  return buildTextResult(
    `执行建议：已生成开发执行草案，下一步先确认范围、风险点与最小可验证改动，再进入实现。`,
    { domain: domain ?? 'builder', executor: 'code_executor' },
  )
}

function normalizeTaskResult(item: TaskBoardItem) {
  if (!item.result) return
  if (!item.result.type) item.result.type = 'text'
  if (!item.result.content) {
    item.result.content = item.domain === 'media'
      ? [item.result.title, item.result.hook, ...(item.result.outline ?? []), item.result.script, item.result.publish_text].filter(Boolean).join('\n\n')
      : item.result.script ?? item.result.publish_text ?? item.result.hook ?? item.result.title ?? ''
  }
  item.result.meta = item.result.meta ?? {}
}

function runQueuedTask(item: TaskBoardItem, now: string) {
  appendHistory(item, {
    action: 'run',
    operator: 'system',
    trigger_source: 'system',
    timestamp: now,
    before: { status: item.status, priority: item.priority },
    after: { status: 'running', priority: item.priority },
  })
  item.status = 'running'
  item.updated_at = now
  item.result = executeTask(item, now)
  normalizeTaskResult(item)
  appendHistory(item, {
    action: 'run',
    operator: 'system',
    trigger_source: 'system',
    timestamp: now,
    before: { status: 'running', priority: item.priority },
    after: { status: 'done', priority: item.priority },
  })
  item.status = 'done'
  item.updated_at = now
  item.slot_active = false
  item.slot_id = null
}

function getTaskKey(item: Pick<TaskBoardItem, 'task_name'>) {
  return item.task_name.trim()
}

function getDependencies(item: TaskBoardItem) {
  return (item.depends_on ?? []).map((value) => value.trim()).filter(Boolean)
}

function isTaskDone(status?: string) {
  return ['done', 'success'].includes(status ?? '')
}

function normalizePoolKey(value?: string): InstancePoolKey | undefined {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return undefined
  if (INSTANCE_POOL_ORDER.includes(normalized as InstancePoolKey)) return normalized as InstancePoolKey
  if (normalized === 'main') return 'business'
  return undefined
}

function inferPool(item: TaskBoardItem): InstancePoolKey {
  return (
    normalizePoolKey(item.assigned_agent) ??
    normalizePoolKey(item.preferred_agent) ??
    normalizePoolKey(item.agent) ??
    normalizePoolKey(item.domain) ??
    (item.target_system?.toLowerCase().includes('family') ? 'family' : undefined) ??
    'builder'
  )
}

function applyScheduler(payload: TaskBoardPayload) {
  const poolStats = new Map<InstancePoolKey, { running: number; queue: number; health: 'healthy' | 'warning' | 'critical' }>()
  const boardByPool = new Map<InstancePoolKey, TaskBoardItem[]>()
  for (const poolKey of INSTANCE_POOL_ORDER) {
    poolStats.set(poolKey, { running: 0, queue: 0, health: 'healthy' })
    boardByPool.set(poolKey, [])
  }

  for (const rawItem of payload.board) {
    const item = rawItem
    const poolKey = inferPool(item)
    item.instance_pool = poolKey
    item.assigned_agent = normalizePoolKey(item.assigned_agent) ?? poolKey
    item.preferred_agent = normalizePoolKey(item.preferred_agent) ?? normalizePoolKey(item.agent) ?? poolKey
    item.domain = item.domain ?? poolKey
    item.target_system = item.target_system ?? `openclaw-${poolKey}`
    item.priority = resolvePriority(item)
    item.slot_id = item.slot_id ?? null
    item.depends_on = getDependencies(item)
    item.blocked_by = item.blocked_by ?? []
    item.dependency_status = item.dependency_status ?? (item.depends_on.length ? 'blocked' : 'ready')
    boardByPool.get(poolKey)?.push(item)
  }

  const taskMap = new Map(payload.board.map((item) => [getTaskKey(item), item]))

  const now = new Date().toISOString()
  const sorted = INSTANCE_POOL_ORDER.flatMap((poolKey) => {
    const maxConcurrency = INSTANCE_POOL_CONFIG[poolKey].maxConcurrency
    const items = [...(boardByPool.get(poolKey) ?? [])].sort((a, b) => {
      const ap = a.priority ?? 99
      const bp = b.priority ?? 99
      if (ap !== bp) return ap - bp
      return new Date(a.queued_at ?? a.timestamp ?? 0).getTime() - new Date(b.queued_at ?? b.timestamp ?? 0).getTime()
    })

    const activeRunning = items
      .filter((item) => ['doing', 'running'].includes(item.status ?? ''))
      .sort((a, b) => {
        const ap = clampPriority(a.priority)
        const bp = clampPriority(b.priority)
        if (ap !== bp) return ap - bp
        return new Date(a.queued_at ?? a.timestamp ?? 0).getTime() - new Date(b.queued_at ?? b.timestamp ?? 0).getTime()
      })
    for (const item of items) {
      const dependencies = getDependencies(item)
      const unresolved = dependencies.filter((dependency) => !isTaskDone(taskMap.get(dependency)?.status))
      const previousBlockedBy = new Set(item.blocked_by ?? [])
      const wasBlocked = previousBlockedBy.size > 0 || item.dependency_status === 'blocked'

      item.blocked_by = unresolved
      if (dependencies.length === 0) {
        item.dependency_status = 'ready'
      } else if (unresolved.length > 0) {
        item.dependency_status = 'blocked'
        if (!wasBlocked || unresolved.some((dependency) => !previousBlockedBy.has(dependency))) {
          appendHistory(item, {
            action: 'blocked',
            operator: 'system',
            trigger_source: 'rule_engine',
            timestamp: now,
            status_before: item.status,
            status_after: item.status,
            priority_before: item.priority,
            priority_after: item.priority,
            decision_reason: `依赖未完成: ${unresolved.join(' -> ')}`,
          })
          appendDecisionLog(item, 'blocked', 'dependency_waiting', `依赖未完成: ${unresolved.join(', ')}`, now)
        }
      } else {
        item.dependency_status = 'resolved'
        if (wasBlocked) {
          appendHistory(item, {
            action: 'dependency_resolved',
            operator: 'system',
            trigger_source: 'rule_engine',
            timestamp: now,
            status_before: item.status,
            status_after: item.status,
            priority_before: item.priority,
            priority_after: item.priority,
            decision_reason: `依赖已完成: ${dependencies.join(' -> ')}`,
          })
          appendHistory(item, {
            action: 'unblocked',
            operator: 'system',
            trigger_source: 'rule_engine',
            timestamp: now,
            status_before: item.status,
            status_after: item.status,
            priority_before: item.priority,
            priority_after: item.priority,
            decision_reason: `已解除阻塞，等待调度: ${dependencies.join(' -> ')}`,
          })
          appendDecisionLog(item, 'dependency_resolved', 'task_done', `上游已完成: ${dependencies.join(', ')}`, now)
          appendDecisionLog(item, 'unblocked', 'dependency_ready', `解除阻塞，进入可调度队列`, now)
        }
      }
    }

    const queuedCandidates = items.filter((item) => ['todo', 'queued', 'queue', 'pending'].includes(item.status ?? '') && !item.stuck && (item.blocked_by?.length ?? 0) === 0)
    const queueStats = items.filter((item) => ['todo', 'queued', 'queue', 'pending'].includes(item.status ?? '')).length
    const preemptableRunning = activeRunning.filter((item) => clampPriority(item.priority) >= 2)
    const urgentQueue = queuedCandidates.find((item) => clampPriority(item.priority) <= 1)

    if (urgentQueue && activeRunning.length >= maxConcurrency && preemptableRunning.length > 0) {
      const preemptTarget = [...preemptableRunning].sort((a, b) => {
        const ap = clampPriority(a.priority)
        const bp = clampPriority(b.priority)
        if (ap !== bp) return bp - ap
        return new Date(a.queued_at ?? a.timestamp ?? 0).getTime() - new Date(b.queued_at ?? b.timestamp ?? 0).getTime()
      })[0]
      if (preemptTarget) {
        appendHistory(preemptTarget, {
          action: 'preempt',
          operator: 'system',
          trigger_source: 'rule_engine',
          timestamp: now,
          before: { status: preemptTarget.status, priority: preemptTarget.priority },
          after: { status: 'paused', priority: preemptTarget.priority },
          decision_reason: `高优先级任务 ${urgentQueue.task_name} 抢占`,
        })
        appendDecisionLog(preemptTarget, 'preempt', 'preempted_by_higher_priority', `${priorityLabel(urgentQueue.priority)} ${urgentQueue.task_name} 抢占运行槽位`, now)
        preemptTarget.status = 'paused'
        preemptTarget.control_status = 'paused'
        preemptTarget.slot_active = false
        preemptTarget.slot_id = null
        preemptTarget.updated_at = now
      }
    }

    let runningCount = 0
    items.forEach((item, index) => {
      item.slot_active = ['doing', 'running'].includes(item.status ?? '')
      if (item.status === 'todo' || item.status === 'queued' || item.status === 'queue' || item.status === 'pending') {
        if ((item.blocked_by?.length ?? 0) > 0) {
          item.slot_active = false
          item.slot_id = null
        } else if (item.stuck) {
          item.slot_active = false
          item.slot_id = null
        } else if (runningCount < maxConcurrency) {
          item.slot_active = true
          item.slot_id = `${poolKey}-slot-${runningCount + 1}`
          runningCount += 1
          runQueuedTask(item, now)
        } else {
          item.slot_active = false
          item.slot_id = null
        }
      } else if (['failed', 'cancelled', 'success', 'done', 'paused'].includes(item.status ?? '')) {
        item.slot_active = false
        item.slot_id = null
      } else if (['doing', 'running'].includes(item.status ?? '')) {
        if (runningCount < maxConcurrency) {
          item.slot_active = true
          item.slot_id = item.slot_id ?? `${poolKey}-slot-${runningCount + 1}`
          runningCount += 1
        } else {
          item.slot_active = false
          item.slot_id = null
        }
      } else if (item.slot_active && !item.slot_id) {
        item.slot_id = `${poolKey}-slot-${Math.min(index + 1, maxConcurrency)}`
      }
    })

    const stats = poolStats.get(poolKey)
    if (stats) {
      stats.running = items.filter((item) => item.slot_active).length
      stats.queue = queueStats
      stats.health = items.some((item) => item.health === 'critical')
        ? 'critical'
        : items.some((item) => item.health === 'warning')
          ? 'warning'
          : 'healthy'
    }

    return items
  })

  payload.max_concurrency = INSTANCE_POOL_ORDER.reduce((sum, key) => sum + INSTANCE_POOL_CONFIG[key].maxConcurrency, 0)
  payload.current_concurrency = sorted.filter((item) => item.slot_active).length
  payload.running_count = payload.current_concurrency
  payload.queue_count = sorted.filter((item) => ['todo', 'queued', 'queue', 'pending'].includes(item.status ?? '')).length
  payload.failed_count = sorted.filter((item) => item.status === 'failed').length
  payload.abnormal_count = sorted.filter((item) => item.abnormal || item.attention).length
  payload.pools = INSTANCE_POOL_ORDER.map((key) => ({
    key,
    label: INSTANCE_POOL_CONFIG[key].label,
    max_concurrency: INSTANCE_POOL_CONFIG[key].maxConcurrency,
    running_count: poolStats.get(key)?.running ?? 0,
    queue_count: poolStats.get(key)?.queue ?? 0,
    health: poolStats.get(key)?.health ?? 'healthy',
  }))
  payload.board = sorted
  return payload
}

async function readTaskBoard(filePath: string) {
  const payload = JSON.parse(await fs.readFile(filePath, 'utf8')) as TaskBoardPayload
  payload.board = (payload.board ?? []).map((rawItem) => {
    const routed = enrichTaskRouting({
      ...rawItem,
      domain: rawItem.domain ?? normalizePoolKey(rawItem.agent) ?? 'builder',
      preferred_agent: rawItem.preferred_agent ?? normalizePoolKey(rawItem.agent) ?? 'builder',
      assigned_agent: rawItem.assigned_agent ?? normalizePoolKey(rawItem.agent) ?? normalizePoolKey(rawItem.preferred_agent) ?? 'builder',
      target_system: rawItem.target_system ?? `openclaw-${normalizePoolKey(rawItem.agent) ?? 'builder'}`,
      slot_id: rawItem.slot_id ?? null,
      retry_count: rawItem.retry_count ?? 0,
      control_status: rawItem.control_status ?? 'active',
      updated_at: rawItem.updated_at ?? rawItem.timestamp ?? payload.generated_at ?? new Date().toISOString(),
      attention: rawItem.attention ?? rawItem.status === 'failed',
      stuck: rawItem.stuck ?? false,
      abnormal: rawItem.abnormal ?? false,
      auto_decision_log: rawItem.auto_decision_log ?? [],
      decision_log: rawItem.decision_log ?? [],
      need_human: rawItem.need_human ?? false,
      human_owner: rawItem.human_owner,
      taken_over_at: rawItem.taken_over_at,
      manual_decision: rawItem.manual_decision,
      auto_action: rawItem.auto_action,
      queued_at: rawItem.queued_at ?? rawItem.timestamp ?? payload.generated_at ?? new Date().toISOString(),
      slot_active: rawItem.slot_active ?? false,
      depends_on: (rawItem.depends_on ?? []).map((value) => String(value).trim()).filter(Boolean),
      blocked_by: (rawItem.blocked_by ?? []).map((value) => String(value).trim()).filter(Boolean),
      dependency_status: rawItem.dependency_status,
      result: rawItem.result,
      history:
        rawItem.history && rawItem.history.length > 0
          ? rawItem.history
          : [
            {
              action: 'create',
              operator: 'system',
              trigger_source: 'system',
              timestamp: rawItem.timestamp ?? payload.generated_at ?? new Date().toISOString(),
              status_after: rawItem.status,
              priority_after: rawItem.priority,
            },
          ],
    })
    return routed
  })
  const now = Date.now()
  payload.board = payload.board.map((item) => {
    const next = { ...item }
    normalizeTaskResult(next)
    if (next.status === 'failed') next.attention = true

    const decisionTimestamp = new Date().toISOString()
    const queuedAgeMs = now - new Date(next.queued_at ?? next.timestamp ?? now).getTime()
    const queueTimedOut = ['todo', 'queued', 'queue', 'pending'].includes(next.status ?? '') && queuedAgeMs > QUEUE_WARNING_MS
    next.stuck = queueTimedOut
    if (queueTimedOut) {
      const hasStuck = (next.history ?? []).some((entry) => entry.decision_type === 'stuck_detected')
      if (!hasStuck) {
        next.history = [
          ...(next.history ?? []),
          {
            action: 'stuck_detected',
            timestamp: decisionTimestamp,
            trigger_source: 'rule_engine',
            decision_type: 'stuck_detected',
            decision_reason: '队列等待超过60s',
            status_after: next.status,
            priority_after: next.priority,
          },
        ]
      }
      appendDecisionLog(next, 'warning', 'queue_timeout', '队列超时，已自动发送 warning 通知', decisionTimestamp)
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
            timestamp: decisionTimestamp,
            status_after: next.status,
            priority_after: next.priority,
          },
        ]
        appendDecisionLog(next, 'warning', 'abnormal_detected', '检测到频繁 pause/resume，已标记 abnormal', decisionTimestamp)
      }
    }

    const failedHistory = [...(next.history ?? [])].filter((entry) => entry.action === 'fail')
    const latestFail = [...failedHistory].slice(-1)[0]
    const retryCount = next.retry_count ?? 0
    const hasRetryAfterLatestFail = latestFail
      ? (next.history ?? []).some((entry) => entry.action === 'retry' && new Date(entry.timestamp).getTime() >= new Date(latestFail.timestamp).getTime())
      : false

    if (next.status === 'failed' && retryCount < 2 && latestFail && !hasRetryAfterLatestFail) {
      next.retry_count = retryCount + 1
      next.status = 'queued'
      next.control_status = 'active'
      next.updated_at = decisionTimestamp
      next.queued_at = decisionTimestamp
      next.attention = false
      next.history = [
        ...(next.history ?? []),
        {
          action: 'retry',
          operator: 'system',
          trigger_source: 'rule_engine',
          timestamp: decisionTimestamp,
          status_before: 'failed',
          status_after: 'queued',
          priority_before: next.priority,
          priority_after: next.priority,
          retry_count: next.retry_count,
          decision_type: 'auto_retry',
          decision_reason: `失败后自动重试，第 ${next.retry_count} 次`,
        },
      ]
      appendDecisionLog(next, 'retry', 'task_failed', `任务失败后自动重试，第 ${next.retry_count} / 2 次`, decisionTimestamp)
    }

    if (failedHistory.length >= 2) {
      const hasNeedHuman = (next.history ?? []).some((entry) => entry.decision_type === 'need_human')
      if (!hasNeedHuman) {
        const newPriority = 0
        next.need_human = true
        next.priority = newPriority
        next.attention = true
        next.history = [
          ...(next.history ?? []),
          {
            action: 'need_human',
            operator: 'system',
            trigger_source: 'rule_engine',
            decision_type: 'need_human',
            decision_reason: '连续失败>=2次，升级人工介入',
            timestamp: decisionTimestamp,
            status_before: next.status,
            status_after: next.status,
            priority_before: item.priority,
            priority_after: newPriority,
          },
        ]
        appendDecisionLog(next, 'need_human', 'continuous_failure', `连续失败 >= 2，已升级人工介入并提升到 ${priorityLabel(newPriority)}`, decisionTimestamp)
      }
    }

    if (['done', 'success'].includes(next.status ?? '') && next.result) {
      const hasNotify = (next.history ?? []).some((entry) => entry.decision_type === 'auto_notify')
      if (!hasNotify) {
        next.history = [
          ...(next.history ?? []),
          {
            action: 'auto_notify',
            operator: 'system',
            trigger_source: 'rule_engine',
            decision_type: 'auto_notify',
            decision_reason: `任务完成后按 ${next.domain ?? 'builder'} 域自动通知结果`,
            timestamp: decisionTimestamp,
            status_after: next.status,
            priority_after: next.priority,
          },
        ]
        appendDecisionLog(next, 'notify_result', 'task_done', `任务完成，已按 ${next.domain ?? 'builder'} 域自动发送结果通知`, decisionTimestamp)
      }
    }

    const failCount = failedHistory.length
    if (failCount >= 3) next.health = 'critical'
    else if (failCount >= 2 || next.stuck || next.abnormal || next.need_human) next.health = 'warning'
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
  payload.running_count = payload.board.filter((item) => ['doing', 'running'].includes(item.status ?? '')).length
  payload.queue_count = payload.board.filter((item) => ['todo', 'queued', 'queue', 'pending'].includes(item.status ?? '')).length
  payload.failed_count = payload.failed
  payload.abnormal_count = payload.board.filter((item) => item.abnormal || item.attention).length
  payload.recent_results = payload.board
    .filter((item) => item.result)
    .sort((a, b) => new Date(b.updated_at ?? b.timestamp ?? 0).getTime() - new Date(a.updated_at ?? a.timestamp ?? 0).getTime())
    .slice(0, 6)
    .map((item) => ({
      task_name: item.task_name,
      domain: item.domain,
      updated_at: item.updated_at ?? item.timestamp,
      result: item.result!,
    }))
  return payload
}

function normalizeNotifyDomain(value?: string) {
  return normalizePoolKey(value) ?? (value?.trim().toLowerCase() === 'system' ? 'system' : undefined) ?? 'builder'
}

function enrichTaskRouting(item: TaskBoardItem) {
  const inferred = inferTaskRoute(item.task_name)
  item.domain = normalizeNotifyDomain(item.domain) as InstancePoolKey
  item.subdomain = item.subdomain ?? inferred.subdomain
  item.project_line = item.project_line ?? inferred.project_line
  item.notify_mode = item.notify_mode ?? inferred.notify_mode
  item.target_group_id = item.target_group_id ?? inferred.target_group_id
  return item
}

function resolveNotifyTarget(item: Pick<TaskBoardItem, 'task_name' | 'domain' | 'subdomain' | 'project_line' | 'target_group_id' | 'notify_mode' | 'status'>, eventType?: TaskNotifyEvent) {
  const inferred = inferTaskRoute(item.task_name)
  const domain = normalizeNotifyDomain(item.domain)
  const notifyMode = item.notify_mode ?? inferred.notify_mode

  let targetGroupId = item.target_group_id ?? item.project_line ?? inferred.target_group_id

  if (domain === 'family') {
    if (eventType === 'task_need_human' || notifyMode === 'need_human' || notifyMode === 'confirm') {
      targetGroupId = 'confirm'
    } else {
      targetGroupId = targetGroupId ?? 'family_affairs'
    }
  }

  targetGroupId = targetGroupId ?? (domain === 'system' ? 'system_default' : 'builder_default')
  return PROJECT_LINE_NOTIFY_TARGET[targetGroupId] ?? PROJECT_LINE_NOTIFY_TARGET.builder_default
}

function buildNotificationSummary(item: TaskBoardItem, eventType: TaskNotifyEvent) {
  if (eventType === 'task_done') {
    if (item.result?.content) {
      return item.result.content.split('\n').filter(Boolean).slice(0, 3).join(' / ')
    }
    return item.task_name
  }
  if (eventType === 'task_failed') return [...(item.history ?? [])].reverse().find((entry) => entry.error)?.error || '任务执行失败'
  if (eventType === 'task_warning') {
    if (item.stuck) return '任务队列等待超过 60s'
    if (item.abnormal) return '检测到异常切换或风险状态'
    if (item.health === 'warning') return '任务处于 warning 状态'
    return '任务出现预警，请检查 Scheduler'
  }
  if (eventType === 'task_need_human') return '任务需要人工介入处理，请选择已处理 / 继续执行 / 转人工'
  return '任务已进入调度队列'
}

function inferTaskNotifyEvent(item: TaskBoardItem, prev?: TaskBoardItem): TaskNotifyEvent | null {
  const status = item.status ?? ''
  const prevStatus = prev?.status ?? ''
  const warningNow = Boolean(item.stuck || item.abnormal || item.health === 'warning')
  const warningPrev = Boolean(prev?.stuck || prev?.abnormal || prev?.health === 'warning')
  const needHumanNow = Boolean(item.need_human || status === 'paused' || status === 'cancelled')
  const needHumanPrev = Boolean(prev?.need_human || prevStatus === 'paused' || prevStatus === 'cancelled')

  if (!prev && ['queued', 'queue', 'todo', 'pending'].includes(status)) return 'task_queued'
  if (needHumanNow && !needHumanPrev) return 'task_need_human'
  if (status === 'failed' && prevStatus !== 'failed') return 'task_failed'
  if ((status === 'done' || status === 'success') && prevStatus !== status) return 'task_done'
  if (warningNow && !warningPrev) return 'task_warning'
  return null
}

async function readTaskNotifications() {
  try {
    const raw = await fs.readFile(TASK_NOTIFY_LOG_FILE, 'utf8')
    const payload = JSON.parse(raw) as { notifications?: TaskNotificationRecord[] }
    return payload.notifications ?? []
  } catch {
    return []
  }
}

async function writeTaskNotifications(notifications: TaskNotificationRecord[]) {
  await fs.writeFile(TASK_NOTIFY_LOG_FILE, `${JSON.stringify({ notifications }, null, 2)}\n`, 'utf8')
}

async function deliverTaskNotification(record: TaskNotificationRecord) {
  const envKey = `${record.target_channel.toUpperCase()}_FEISHU_WEBHOOK_URL`
  const webhook = process.env[envKey] || process.env.OPENCLAW_FEISHU_WEBHOOK_URL
  if (!webhook) return record

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msg_type: 'text',
      content: {
        text: record.message,
      },
    }),
  })

  return { ...record, delivery: 'webhook' as const }
}

function toTaskId(taskName: string) {
  return taskName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `task-${Date.now()}`
}

async function emitTaskNotifications(previousPayload: TaskBoardPayload | null, nextPayload: TaskBoardPayload) {
  const previousByName = new Map((previousPayload?.board ?? []).map((item) => [item.task_name, item]))
  const existing = await readTaskNotifications()
  const nextRecords: TaskNotificationRecord[] = []

  for (const item of nextPayload.board ?? []) {
    const eventType = inferTaskNotifyEvent(item, previousByName.get(item.task_name))
    if (!eventType) continue
    enrichTaskRouting(item)
    const target = resolveNotifyTarget(item, eventType)
    const summary = buildNotificationSummary(item, eventType)
    const taskId = toTaskId(item.task_name)
    const messageLines = [
      eventType === 'task_warning'
        ? '【任务告警】'
        : eventType === 'task_need_human'
          ? '【任务需人工介入】'
          : eventType === 'task_queued'
            ? '【任务已进入队列】'
            : eventType === 'task_failed'
              ? '【任务失败】'
              : '【任务完成】',
      `task_id：${taskId}`,
      `task_name：${item.task_name}`,
      `domain：${normalizeNotifyDomain(item.domain)}`,
      `assigned_agent：${item.assigned_agent ?? item.agent ?? 'builder'}`,
      `状态：${eventType === 'task_warning' ? '告警' : item.status ?? '-'}`,
      `摘要：${summary}`,
      eventType === 'task_need_human' ? '动作：已处理 / 继续执行 / 转人工' : '',
      '👉 查看：/scheduler',
    ].filter(Boolean)
    if (eventType === 'task_done' && item.result?.content) {
      messageLines.splice(5, 0, `结果：${item.result.content}`)
    }
    const draft: TaskNotificationRecord = {
      id: `${new Date().toISOString()}-${item.task_name}-${eventType}`,
      event_type: eventType,
      task_id: taskId,
      task_name: item.task_name,
      domain: normalizeNotifyDomain(item.domain),
      subdomain: item.subdomain ?? 'engineering',
      project_line: item.project_line ?? target.groupId,
      notify_mode: item.notify_mode ?? 'default',
      assigned_agent: item.assigned_agent ?? item.agent ?? 'builder',
      status: item.status ?? '-',
      summary,
      target_group: target.group,
      target_group_id: target.groupId,
      target_channel: target.channel,
      scheduler_hint: '打开 KOTOVELA /scheduler 查看详情',
      created_at: new Date().toISOString(),
      delivery: 'mock',
      message: messageLines.join('\n'),
    }
    nextRecords.push(await deliverTaskNotification(draft))
  }

  if (nextRecords.length > 0) {
    await writeTaskNotifications([...nextRecords, ...existing].slice(0, 60))
  }
}

async function writeTaskBoard(filePath: string, payload: TaskBoardPayload) {
  let previousPayload: TaskBoardPayload | null = null
  try {
    previousPayload = JSON.parse(await fs.readFile(filePath, 'utf8')) as TaskBoardPayload
  } catch {
    previousPayload = null
  }
  const summarized = summarizeTaskBoard(payload)
  await emitTaskNotifications(previousPayload, summarized)
  await fs.writeFile(filePath, `${JSON.stringify(summarized, null, 2)}\n`, 'utf8')
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

function appendManualDecision(
  target: TaskBoardItem,
  action: 'manual_takeover' | 'manual_assign' | 'manual_ignore' | 'manual_done' | 'manual_continue',
  reason: string,
  detail: string,
  timestamp: string,
) {
  target.decision_log = [...(target.decision_log ?? []), { timestamp, action, reason, detail }]
}

function applyManualTaskAction(target: TaskBoardItem, action: string, humanOwner: string, now: string) {
  if (action === 'takeover') {
    const owner = humanOwner || target.human_owner || 'builder'
    appendHistory(target, {
      action: 'need_human',
      operator: 'builder',
      trigger_source: 'manual',
      timestamp: now,
      before: { status: target.status, priority: target.priority },
      after: { status: target.status, priority: target.priority },
      decision_type: 'need_human',
      decision_reason: `人工接管：${owner}`,
    })
    target.human_owner = owner
    target.taken_over_at = now
    target.need_human = true
    target.priority = 0
    target.manual_decision = 'taken_over'
    appendManualDecision(target, 'manual_takeover', 'human_takeover', `已由 ${owner} 接管`, now)
    return
  }

  if (action === 'assign') {
    const owner = humanOwner || target.human_owner || 'builder'
    appendHistory(target, {
      action: 'need_human',
      operator: 'builder',
      trigger_source: 'manual',
      timestamp: now,
      before: { status: target.status, priority: target.priority },
      after: { status: target.status, priority: target.priority },
      decision_type: 'need_human',
      decision_reason: `人工指派：${owner}`,
    })
    target.human_owner = owner
    target.taken_over_at = now
    target.manual_decision = 'assigned'
    target.need_human = true
    target.priority = 0
    appendManualDecision(target, 'manual_assign', 'human_assign', `已指派给 ${owner}`, now)
    return
  }

  if (action === 'ignore') {
    const owner = humanOwner || target.human_owner || 'builder'
    appendHistory(target, {
      action: 'need_human',
      operator: 'builder',
      trigger_source: 'manual',
      timestamp: now,
      before: { status: target.status, priority: target.priority },
      after: { status: target.status, priority: target.priority },
      decision_type: 'need_human',
      decision_reason: `人工忽略：${owner}`,
    })
    target.human_owner = owner
    target.taken_over_at = target.taken_over_at ?? now
    target.manual_decision = 'ignored'
    target.need_human = false
    target.attention = false
    appendManualDecision(target, 'manual_ignore', 'human_ignore', `${owner} 已忽略人工介入`, now)
    return
  }

  if (action === 'manual_done') {
    const owner = humanOwner || target.human_owner || 'builder'
    appendHistory(target, {
      action: 'resume',
      operator: 'builder',
      trigger_source: 'manual',
      timestamp: now,
      before: { status: target.status, priority: target.priority },
      after: { status: 'done', priority: target.priority },
    })
    target.human_owner = owner
    target.taken_over_at = target.taken_over_at ?? now
    target.manual_decision = 'done'
    target.need_human = false
    target.status = 'done'
    target.control_status = 'done'
    target.attention = false
    appendManualDecision(target, 'manual_done', 'human_done', `${owner} 已确认处理完成`, now)
    return
  }

  if (action === 'manual_continue') {
    const owner = humanOwner || target.human_owner || 'builder'
    appendHistory(target, {
      action: 'resume',
      operator: 'builder',
      trigger_source: 'manual',
      timestamp: now,
      before: { status: target.status, priority: target.priority },
      after: { status: 'queued', priority: target.priority },
    })
    target.human_owner = owner
    target.taken_over_at = target.taken_over_at ?? now
    target.manual_decision = 'continue'
    target.need_human = false
    target.status = 'queued'
    target.control_status = 'active'
    target.queued_at = now
    target.attention = false
    appendManualDecision(target, 'manual_continue', 'human_continue', `${owner} 已确认继续执行`, now)
    return
  }

  throw new Error('unsupported action')
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
            const filePath = TASK_BOARD_FILE

            if (req.method === 'GET') {
              try {
                const payload = await readTaskBoard(filePath)
                await writeTaskBoard(filePath, payload)
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
                    const route = inferTaskRoute(taskName)
                    payload.board.unshift({
                      task_name: taskName,
                      agent: route.assigned_agent,
                      domain: route.domain,
                      subdomain: route.subdomain,
                      project_line: route.project_line,
                      target_group_id: route.target_group_id,
                      notify_mode: route.notify_mode,
                      preferred_agent: route.preferred_agent,
                      assigned_agent: route.assigned_agent,
                      target_system: route.target_system,
                      slot_id: null,
                      priority: 3,
                      retry_count: 0,
                      type: route.type,
                      status: 'queued',
                      timestamp: now,
                      queued_at: now,
                      updated_at: now,
                      attention: false,
                      stuck: false,
                      abnormal: false,
                      auto_decision_log: [],
                      decision_log: [],
                      human_owner: undefined,
                      taken_over_at: undefined,
                      manual_decision: undefined,
                      history: [{ action: 'create', operator: 'system', trigger_source: 'system', timestamp: now, status_after: 'queued', priority_after: 3 }],
                    })
                    payload.generated_at = now
                    await writeTaskBoard(filePath, payload)
                    const executed = await readTaskBoard(filePath)
                    await writeTaskBoard(filePath, executed)
                    res.statusCode = 200
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify(summarizeTaskBoard(executed)))
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
                        domain: 'builder',
                        subdomain: 'engineering',
                        project_line: 'builder_default',
                        target_group_id: 'builder_default',
                        notify_mode: 'default',
                        preferred_agent: 'builder',
                        assigned_agent: 'builder',
                        target_system: 'openclaw-builder',
                        slot_id: null,
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
                        decision_log: [],
                        human_owner: undefined,
                        taken_over_at: undefined,
                        manual_decision: undefined,
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

                  const payload = await readTaskBoard(filePath)
                  const now = new Date().toISOString()
                  const route = inferTaskRoute(taskInput)
                  const nextItem: TaskBoardItem = {
                    task_name: taskInput,
                    agent: route.assigned_agent,
                    domain: route.domain,
                    subdomain: route.subdomain,
                    project_line: route.project_line,
                    target_group_id: route.target_group_id,
                    notify_mode: route.notify_mode,
                    preferred_agent: route.preferred_agent,
                    assigned_agent: route.assigned_agent,
                    target_system: route.target_system,
                    slot_id: null,
                    priority: 3,
                    retry_count: 0,
                    type: route.type,
                    status: 'queued',
                    timestamp: now,
                    queued_at: now,
                    updated_at: now,
                    attention: false,
                    stuck: false,
                    abnormal: false,
                    auto_decision_log: [],
                    decision_log: [],
                    human_owner: undefined,
                    taken_over_at: undefined,
                    manual_decision: undefined,
                    history: [
                      {
                        action: 'create',
                        operator: 'system',
                        trigger_source: 'system',
                        timestamp: now,
                        status_after: 'queued',
                        priority_after: 3,
                      },
                    ],
                  }
                  payload.board.unshift(nextItem)
                  payload.generated_at = now
                  await writeTaskBoard(filePath, payload)
                  const executed = await readTaskBoard(filePath)
                  await writeTaskBoard(filePath, executed)
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify(summarizeTaskBoard(executed)))
                  return
                }

                const taskName = String(body?.task_name || '').trim()
                const action = String(body?.action || '').trim()
                const humanOwner = String(body?.human_owner || body?.assignee || '').trim()
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
                  const nextPriority = Math.max(0, clampPriority(target.priority) - 1)
                  appendHistory(target, {
                    action: 'priority_change',
                    operator: 'builder',
                    trigger_source: 'manual',
                    timestamp: now,
                    before: { status: target.status, priority: target.priority },
                    after: { status: target.status, priority: nextPriority },
                  })
                  appendDecisionLog(target, 'priority_up', 'manual_priority_change', `${priorityLabel(clampPriority(target.priority))} -> ${priorityLabel(nextPriority)}`, now)
                  target.priority = nextPriority
                } else if (action === 'priority_down') {
                  const nextPriority = Math.min(3, clampPriority(target.priority) + 1)
                  appendHistory(target, {
                    action: 'priority_change',
                    operator: 'builder',
                    trigger_source: 'manual',
                    timestamp: now,
                    before: { status: target.status, priority: target.priority },
                    after: { status: target.status, priority: nextPriority },
                  })
                  appendDecisionLog(target, 'priority_down', 'manual_priority_change', `${priorityLabel(clampPriority(target.priority))} -> ${priorityLabel(nextPriority)}`, now)
                  target.priority = nextPriority
                } else if (['takeover', 'assign', 'ignore', 'manual_done', 'manual_continue'].includes(action)) {
                  applyManualTaskAction(target, action, humanOwner, now)
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

          server.middlewares.use('/api/task-notification-actions', async (req, res, next) => {
            if (req.method !== 'POST') {
              next()
              return
            }

            try {
              const chunks: Buffer[] = []
              for await (const chunk of req) chunks.push(Buffer.from(chunk))
              const bodyText = Buffer.concat(chunks).toString('utf8')
              const body = bodyText ? JSON.parse(bodyText) : {}
              const groupAction = String(body?.group_action || body?.action || '').trim()
              const taskId = String(body?.task_id || '').trim()
              const taskName = String(body?.task_name || '').trim()
              const domain = String(body?.domain || '').trim()
              const assignedAgent = String(body?.assigned_agent || '').trim()
              const humanOwner = String(body?.human_owner || body?.operator || assignedAgent || 'builder').trim()

              const actionMap: Record<string, string> = {
                done: 'manual_done',
                processed: 'manual_done',
                continue: 'manual_continue',
                transfer: 'assign',
                assign: 'assign',
              }
              const mappedAction = actionMap[groupAction]
              if (!mappedAction) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'unsupported group_action' }))
                return
              }

              const filePath = TASK_BOARD_FILE
              const payload = await readTaskBoard(filePath)
              const target = payload.board.find((item) => toTaskId(item.task_name) === taskId)
                ?? payload.board.find((item) => item.task_name === taskName)
                ?? payload.board.find((item) => (item.domain ?? '') === domain && (item.assigned_agent ?? item.agent ?? '') === assignedAgent)

              if (!target) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'task not found' }))
                return
              }

              const now = new Date().toISOString()
              applyManualTaskAction(target, mappedAction, humanOwner, now)
              target.updated_at = now
              payload.generated_at = now
              await writeTaskBoard(filePath, payload)

              const notifications = await readTaskNotifications()
              notifications.unshift({
                id: `${now}-${toTaskId(target.task_name)}-${groupAction}`,
                event_type: 'task_need_human',
                task_id: toTaskId(target.task_name),
                task_name: target.task_name,
                domain: normalizeNotifyDomain(target.domain),
                subdomain: target.subdomain ?? 'engineering',
                project_line: target.project_line ?? 'builder_default',
                notify_mode: target.notify_mode ?? 'need_human',
                assigned_agent: target.assigned_agent ?? target.agent ?? 'builder',
                status: target.status ?? '-',
                summary: `群内动作已回写：${groupAction}`,
                target_group: 'Mock Feishu 群动作',
                target_group_id: target.target_group_id ?? 'mock_group_action',
                target_channel: target.domain ?? 'builder',
                scheduler_hint: '群动作已同步到 Scheduler',
                created_at: now,
                delivery: 'mock',
                message: [
                  '【群内动作已回写】',
                  `task_id：${toTaskId(target.task_name)}`,
                  `task_name：${target.task_name}`,
                  `domain：${normalizeNotifyDomain(target.domain)}`,
                  `assigned_agent：${target.assigned_agent ?? target.agent ?? 'builder'}`,
                  `group_action：${groupAction}`,
                  `human_owner：${humanOwner}`,
                  `manual_decision：${target.manual_decision ?? '-'}`,
                ].join('\n'),
              })
              await writeTaskNotifications(notifications.slice(0, 60))

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, task_name: target.task_name, manual_decision: target.manual_decision }))
            } catch (error) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: 'task-notification-action failed',
                  message: error instanceof Error ? error.message : String(error),
                }),
              )
            }
          })

          server.middlewares.use('/api/task-notifications', async (req, res, next) => {
            if (req.method !== 'GET') {
              next()
              return
            }

            try {
              const notifications = await readTaskNotifications()
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Cache-Control', 'no-store')
              res.end(JSON.stringify({ notifications }))
            } catch (error) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: 'task-notifications fetch failed',
                  message: error instanceof Error ? error.message : String(error),
                }),
              )
            }
          })
        },
      },
    ],
  }
})
