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
const MEMORY_STORE_FILE = path.resolve('/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/data/scheduler-memory.json')
const TEMPLATE_POOL_FILE = path.resolve('/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/data/scheduler-template-pool.json')

type TemplateAssetType = 'script' | 'reply' | 'plan' | 'generic'

type TemplateRecord = {
  template_id: string
  domain: string
  asset_type: TemplateAssetType
  content: string
  source_task_id: string
  source_task_name?: string
  use_count: number
  created_at: string
  updated_at: string
}

let templatePoolCache: TemplateRecord[] = []

type MemoryType = 'preference' | 'habit' | 'history' | 'constraint'

type MemoryRecord = {
  user_id: string
  memory_type: MemoryType
  key: string
  value: unknown
  updated_at: string
}

type UserProfile = {
  user_id: string
  tags: string[]
  preferences: Record<string, unknown>
  behavior_patterns: Record<string, unknown>
}

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
  action:
    | 'retry'
    | 'warning'
    | 'need_human'
    | 'notify_result'
    | 'manual_takeover'
    | 'manual_assign'
    | 'manual_ignore'
    | 'manual_done'
    | 'manual_continue'
    | 'preempt'
    | 'priority_up'
    | 'priority_down'
    | 'blocked'
    | 'unblocked'
    | 'dependency_resolved'
    | 'strategy_generate_task'
    | 'risk_detected'
    | 'precheck_block'
  reason: string
  detail: string
  publish_rhythm_hit?: string
  persona_hit?: string
  publish_risk_warning?: string[]
  memory_hit?: string
  profile_rule?: string
  template_id?: string
}

type PersonaProfile = {
  persona_id: 'openclaw_content' | 'mom970_content' | 'latin_boy' | 'chongming_storage' | 'official_account'
  tone_style: string
  interaction_style: string
}

type TaskBoardSource = {
  source_type: 'book_manuscript'
  source_project: 'japanese_renovation_guide'
  chapter_title: string
  core_points: string
}

type RoleVersion = 'yanjia_housing' | 'official_account' | 'mom970'

type TaskBoardItem = {
  task_name: string
  agent: string
  parent_task_id?: string
  scenario_id?: string
  task_group_id?: string
  task_group_label?: string
  template_key?: string
  template_source?: string
  template_task_index?: number
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
  auto_generated?: boolean
  trigger_source?: 'habit' | 'inactivity' | 'schedule' | 'manual' | 'system' | 'rule_engine'
  predicted_risk?: 'low' | 'medium' | 'high'
  predicted_block?: boolean
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
  source?: TaskBoardSource
  role_version?: RoleVersion
  result?: {
    type: 'text'
    content: string
    meta?: Record<string, unknown>
    title: string
    hook: string
    outline: string[]
    script: string
    publish_text: string
    publish_ready?: boolean
    archive_ready?: boolean
    asset_type?: 'media' | 'business' | 'family' | 'generic'
    generated_at?: string
    generator?: 'mock' | 'gpt'
    persona_id?: PersonaProfile['persona_id']
    tone_style?: string
    interaction_style?: string
    recommend_publish_time?: string
    recommend_frequency?: string
    publish_today?: boolean
    suggested_title?: string
    suggested_first_comment?: string
    suggested_interaction_question?: string
    publish_risk_warning?: string[]
    manual_published_at?: string
    manual_published_by?: string
  }
  depends_on?: string[]
  blocked_by?: string[]
  dependency_status?: 'ready' | 'blocked' | 'resolved'
  user_id?: string
  memory_hits?: string[]
  profile_tags?: string[]
  recommended_execute_at?: string
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
  current_user_id?: string
  current_profile?: UserProfile
  template_pool?: TemplateRecord[]
  board: TaskBoardItem[]
}

const INSTANCE_POOL_ORDER = ['builder', 'media', 'family', 'business', 'personal'] as const
type InstancePoolKey = (typeof INSTANCE_POOL_ORDER)[number]
const QUEUE_WARNING_MS = 60_000
const PERSONA_REGISTRY: Record<string, PersonaProfile> = {
  openclaw_content: { persona_id: 'openclaw_content', tone_style: '冷静拆解，偏产品方法论', interaction_style: '结尾抛执行问题，鼓励继续追问' },
  mom970: { persona_id: 'mom970_content', tone_style: '温暖经验流，像陪伴式分享', interaction_style: '多用生活感提问，鼓励评论区接龙' },
  latin_boy: { persona_id: 'latin_boy', tone_style: '轻快少年感，节奏明亮', interaction_style: '适合互动小游戏和选择题' },
  chongming: { persona_id: 'chongming_storage', tone_style: '收纳改造型，强调前后对比', interaction_style: '鼓励晒改造前后和提具体困扰' },
  official_account: { persona_id: 'official_account', tone_style: '正式可信，偏信息整合', interaction_style: '适合引导收藏、转发和留言咨询' },
}
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
  extras?: Pick<DecisionLogEntry, 'memory_hit' | 'profile_rule' | 'template_id'>,
) {
  const exists = (item.decision_log ?? []).some((entry) => entry.action === action && entry.reason === reason && entry.detail === detail)
  if (exists) return
  item.decision_log = [...(item.decision_log ?? []), { timestamp, action, reason, detail, ...extras }]
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

const DEFAULT_MEMORY_SEED: MemoryRecord[] = [
  { user_id: 'guoguo', memory_type: 'habit', key: 'study_time_preference', value: '20:00', updated_at: '2026-04-16T20:00:00.000+08:00' },
  { user_id: 'guoguo', memory_type: 'preference', key: 'focus_duration', value: 25, updated_at: '2026-04-16T20:00:00.000+08:00' },
  { user_id: 'guoguo', memory_type: 'history', key: 'task_success_family_study', value: 3, updated_at: '2026-04-16T20:00:00.000+08:00' },
  { user_id: 'content_ops', memory_type: 'habit', key: 'publish_time_preference', value: '09:00', updated_at: '2026-04-16T09:00:00.000+08:00' },
  { user_id: 'client_followup', memory_type: 'habit', key: 'followup_cadence', value: 'T+1 / T+3', updated_at: '2026-04-16T10:00:00.000+08:00' },
]

async function readMemoryStore() {
  try {
    const raw = await fs.readFile(MEMORY_STORE_FILE, 'utf8')
    const payload = JSON.parse(raw) as { records?: MemoryRecord[] }
    return payload.records ?? DEFAULT_MEMORY_SEED
  } catch {
    await writeMemoryStore(DEFAULT_MEMORY_SEED)
    return DEFAULT_MEMORY_SEED
  }
}

async function writeMemoryStore(records: MemoryRecord[]) {
  await fs.mkdir(path.dirname(MEMORY_STORE_FILE), { recursive: true })
  await fs.writeFile(MEMORY_STORE_FILE, `${JSON.stringify({ records }, null, 2)}\n`, 'utf8')
}

async function readTemplateStore() {
  try {
    const raw = await fs.readFile(TEMPLATE_POOL_FILE, 'utf8')
    const payload = JSON.parse(raw) as { templates?: TemplateRecord[] }
    templatePoolCache = payload.templates ?? []
    return templatePoolCache
  } catch {
    await writeTemplateStore([])
    templatePoolCache = []
    return templatePoolCache
  }
}

async function writeTemplateStore(templates: TemplateRecord[]) {
  templatePoolCache = templates
  await fs.mkdir(path.dirname(TEMPLATE_POOL_FILE), { recursive: true })
  await fs.writeFile(TEMPLATE_POOL_FILE, `${JSON.stringify({ templates }, null, 2)}\n`, 'utf8')
}

function toTemplateAssetType(item: TaskBoardItem): TemplateAssetType {
  if (item.domain === 'media') return 'script'
  if (item.domain === 'business') return 'reply'
  if (item.domain === 'family') return 'plan'
  return 'generic'
}

function extractTemplateContent(item: TaskBoardItem) {
  if (!item.result) return ''
  if (item.domain === 'media') return item.result.script || item.result.publish_text || item.result.content || ''
  if (item.domain === 'business') return item.result.publish_text || item.result.script || item.result.content || ''
  if (item.domain === 'family') return item.result.outline?.join('\n') || item.result.publish_text || item.result.content || ''
  return item.result.content || item.result.script || item.result.publish_text || ''
}

function shouldAutoStoreTemplate(item: TaskBoardItem) {
  if (!item.result || !isTaskDone(item.status)) return false
  const manual = item.result.meta?.template_source === true
  const copiedCount = Number(item.result.meta?.copied_count ?? 0)
  return item.result.publish_ready === true || manual || copiedCount > 1
}

function chooseTemplateForTask(item: Pick<TaskBoardItem, 'domain' | 'task_name'>, templates: TemplateRecord[]) {
  const assetType = item.domain === 'media' ? 'script' : item.domain === 'business' ? 'reply' : item.domain === 'family' ? 'plan' : 'generic'
  return templates
    .filter((template) => template.domain === (item.domain ?? 'builder') && template.asset_type === assetType)
    .sort((a, b) => {
      if (b.use_count !== a.use_count) return b.use_count - a.use_count
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })[0]
}

async function syncTemplatePool(board: TaskBoardItem[]) {
  const current = await readTemplateStore()
  const existing = new Map(current.map((template) => [template.source_task_id, template]))
  const hitCounter = new Map<string, number>()

  for (const item of board) {
    for (const entry of item.decision_log ?? []) {
      if (entry.action === 'strategy_generate_task' && entry.reason === 'template_hit' && entry.template_id) {
        hitCounter.set(entry.template_id, (hitCounter.get(entry.template_id) ?? 0) + 1)
      }
    }
    if (!shouldAutoStoreTemplate(item)) continue
    const sourceTaskId = toTaskId(item.task_name)
    const content = extractTemplateContent(item)
    if (!content) continue
    const now = item.updated_at ?? item.timestamp ?? new Date().toISOString()
    const nextRecord: TemplateRecord = {
      template_id: existing.get(sourceTaskId)?.template_id ?? `tpl_${sourceTaskId}`,
      domain: item.domain ?? 'builder',
      asset_type: toTemplateAssetType(item),
      content,
      source_task_id: sourceTaskId,
      source_task_name: item.task_name,
      use_count: existing.get(sourceTaskId)?.use_count ?? 0,
      created_at: existing.get(sourceTaskId)?.created_at ?? now,
      updated_at: now,
    }
    existing.set(sourceTaskId, nextRecord)
  }

  const templates = [...existing.values()]
    .map((template) => ({ ...template, use_count: hitCounter.get(template.template_id) ?? template.use_count ?? 0 }))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  await writeTemplateStore(templates)
  return templates
}

function inferUserId(task: Pick<TaskBoardItem, 'task_name' | 'domain' | 'project_line'>) {
  const normalized = `${task.task_name} ${task.domain ?? ''} ${task.project_line ?? ''}`.toLowerCase()
  if (normalized.includes('果果') || normalized.includes('学习') || normalized.includes('作业')) return 'guoguo'
  if (normalized.includes('发布') || normalized.includes('内容') || normalized.includes('账号')) return 'content_ops'
  if (normalized.includes('客户') || normalized.includes('报价') || normalized.includes('跟进')) return 'client_followup'
  return 'default_user'
}

function deriveProfile(userId: string, records: MemoryRecord[]): UserProfile {
  const mine = records.filter((record) => record.user_id === userId)
  const preferences: Record<string, unknown> = {}
  const behaviorPatterns: Record<string, unknown> = {}
  const tags = new Set<string>()

  for (const record of mine) {
    if (record.memory_type === 'preference') preferences[record.key] = record.value
    if (record.memory_type === 'habit') behaviorPatterns[record.key] = record.value
    if (record.key.includes('study') || String(record.value).includes('20:00')) tags.add('晚间学习')
    if (record.key.includes('focus_duration') || record.value === 25) tags.add('番茄节奏')
    if (record.key.includes('followup')) tags.add('规律跟进')
    if (userId === 'guoguo') {
      tags.add('低年级')
      tags.add('需要陪伴')
    }
  }

  return {
    user_id: userId,
    tags: [...tags],
    preferences,
    behavior_patterns: behaviorPatterns,
  }
}

function upsertMemoryRecord(records: MemoryRecord[], nextRecord: MemoryRecord) {
  const index = records.findIndex((record) => record.user_id === nextRecord.user_id && record.memory_type === nextRecord.memory_type && record.key === nextRecord.key)
  if (index >= 0) records[index] = nextRecord
  else records.push(nextRecord)
}

function applyUserContextOnCreate(item: TaskBoardItem, records: MemoryRecord[]) {
  const userId = inferUserId(item)
  const profile = deriveProfile(userId, records)
  const timestamp = new Date().toISOString()
  item.user_id = userId
  item.profile_tags = profile.tags
  item.memory_hits = []
  if (typeof profile.behavior_patterns.study_time_preference === 'string') {
    item.recommended_execute_at = profile.behavior_patterns.study_time_preference
    item.memory_hits.push(String(profile.behavior_patterns.study_time_preference))
  } else if (typeof profile.behavior_patterns.publish_time_preference === 'string') {
    item.recommended_execute_at = profile.behavior_patterns.publish_time_preference
    item.memory_hits.push(String(profile.behavior_patterns.publish_time_preference))
  }

  if (profile.tags.includes('晚间学习') || profile.tags.includes('规律跟进')) {
    const nextPriority = Math.max(0, clampPriority(item.priority) - 1)
    if (nextPriority !== item.priority) {
      item.priority = nextPriority
      appendDecisionLog(item, 'priority_up', 'profile_bootstrap', `创建任务时命中画像规则，建议执行时间 ${item.recommended_execute_at ?? '按习惯时间'}，优先级提升`, timestamp, {
        memory_hit: item.memory_hits[0],
        profile_rule: profile.tags.join(' / '),
      })
    }
  }
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

type ScenarioTemplateKey =
  | 'family_study_evening'
  | 'media_publish_flow'
  | 'business_followup_flow'
  | 'builder_delivery_flow'
  | 'media_publish_with_distribution'
  | 'business_quote_with_materials'

type ScenarioTemplateTaskSeed = {
  title: string
  routeHint?: string
  priority?: number
  dependsOnIndexes?: number[]
  taskGroupSuffix?: string
}

type ScenarioTemplateDefinition = {
  key: ScenarioTemplateKey
  label: string
  description: string
  tasks: ScenarioTemplateTaskSeed[]
}

const SCENARIO_TEMPLATES: Record<ScenarioTemplateKey, ScenarioTemplateDefinition> = {
  family_study_evening: {
    key: 'family_study_evening',
    label: 'family_study_evening',
    description: '晚间学习编排，自动串联提醒、作业、复盘。',
    tasks: [
      { title: '家庭提醒：确认今晚学习时间与书包物料', routeHint: '家庭提醒 果果 学习', priority: 0 },
      { title: '果果作业：完成晚间作业检查与口算练习', routeHint: '果果 作业 口算 练习', priority: 0, dependsOnIndexes: [0] },
      { title: '果果学习：安排英语复习与课文朗读', routeHint: '果果 学习 复习 读书', priority: 1, dependsOnIndexes: [1] },
      { title: '家庭复盘：记录晚间学习完成情况并提醒明早事项', routeHint: '家庭 学习 提醒果果', priority: 1, dependsOnIndexes: [2] },
    ],
  },
  media_publish_flow: {
    key: 'media_publish_flow',
    label: 'media_publish_flow',
    description: '内容从选题到发布复盘的全链路。',
    tasks: [
      { title: '内容选题：整理今日发布主题与核心 hook', routeHint: '内容 选题 文案 发布', priority: 1 },
      { title: '内容脚本：输出短视频脚本与封面文案', routeHint: '内容 文案 发布', priority: 1, dependsOnIndexes: [0] },
      { title: '账号发布：执行账号运营发布并检查评论引导', routeHint: '账号运营 发布 小红书', priority: 1, dependsOnIndexes: [1] },
      { title: '内容复盘：记录发布结果与下一轮优化建议', routeHint: '内容 复盘 发布', priority: 2, dependsOnIndexes: [2] },
    ],
  },
  business_followup_flow: {
    key: 'business_followup_flow',
    label: 'business_followup_flow',
    description: '客户跟进、报价、确认与同步。',
    tasks: [
      { title: '客户跟进：梳理客户当前需求与关键顾虑', routeHint: '客户 跟进 报价', priority: 0 },
      { title: '报价准备：补充报价说明与方案对比清单', routeHint: '客户 报价 技术方案', priority: 0, dependsOnIndexes: [0] },
      { title: '客户确认：发送跟进回复并确认下一次沟通时间', routeHint: '客户 合同 报价 跟进', priority: 1, dependsOnIndexes: [1] },
      { title: '业务同步：沉淀本轮跟进结论与内部协同事项', routeHint: '客户 技术支持 言町科技', priority: 1, dependsOnIndexes: [2] },
    ],
  },
  builder_delivery_flow: {
    key: 'builder_delivery_flow',
    label: 'builder_delivery_flow',
    description: '研发交付，从实现到验证和回传。',
    tasks: [
      { title: '研发实现：完成需求改动与最小验证方案', routeHint: '开发 实现 功能 页面', priority: 0 },
      { title: '接口联调：确认接口数据与页面联动行为', routeHint: '接口 api 联调 后端', priority: 1, dependsOnIndexes: [0] },
      { title: '回归验证：执行关键路径回归与异常检查', routeHint: '修复 回归 异常', priority: 1, dependsOnIndexes: [1] },
      { title: '交付回执：整理 commit、截图与交付说明', routeHint: '开发 实现 功能', priority: 2, dependsOnIndexes: [2] },
    ],
  },
  media_publish_with_distribution: {
    key: 'media_publish_with_distribution',
    label: 'media_publish_with_distribution',
    description: '主任务下同时编排内容发布、投放分发与落地页支撑。',
    tasks: [
      { title: '主任务：确认本轮发布主题、素材包与目标渠道', routeHint: '内容 选题 发布', priority: 0, taskGroupSuffix: 'media' },
      { title: '内容脚本：输出短视频脚本与封面文案', routeHint: '内容 文案 发布', priority: 0, dependsOnIndexes: [0], taskGroupSuffix: 'media' },
      { title: '分发计划：整理平台投放节奏与商务分发清单', routeHint: '客户 渠道 分发 报价', priority: 1, dependsOnIndexes: [0], taskGroupSuffix: 'business' },
      { title: '落地页支持：同步页面素材位与追踪埋点', routeHint: '开发 页面 接口 埋点', priority: 1, dependsOnIndexes: [1], taskGroupSuffix: 'builder' },
      { title: '发布执行：完成内容上线并回收首轮反馈', routeHint: '账号运营 发布 小红书', priority: 1, dependsOnIndexes: [1, 2, 3], taskGroupSuffix: 'media' },
    ],
  },
  business_quote_with_materials: {
    key: 'business_quote_with_materials',
    label: 'business_quote_with_materials',
    description: '主任务下同时编排报价、物料、样板与家庭确认。',
    tasks: [
      { title: '需求梳理：确认客户预算、交付范围与材料偏好', routeHint: '客户 跟进 报价', priority: 0, taskGroupSuffix: 'business' },
      { title: '材料清单：整理样品、规格与替代方案', routeHint: '开发 物料 清单 页面', priority: 0, dependsOnIndexes: [0], taskGroupSuffix: 'builder' },
      { title: '报价草案：输出报价说明与组合方案', routeHint: '客户 报价 技术方案', priority: 1, dependsOnIndexes: [0, 1], taskGroupSuffix: 'business' },
      { title: '家庭确认：确认样板寄送与现场配合时间', routeHint: '家庭 提醒 物料 安排', priority: 1, dependsOnIndexes: [1], taskGroupSuffix: 'family' },
      { title: '正式回发：发送报价并附带材料说明', routeHint: '客户 合同 报价 跟进', priority: 1, dependsOnIndexes: [2, 3], taskGroupSuffix: 'business' },
    ],
  },
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

function buildBookRoleResult(item: TaskBoardItem, timestamp: string): NonNullable<TaskBoardItem['result']> | null {
  if (item.source?.source_type !== 'book_manuscript' || item.source?.source_project !== 'japanese_renovation_guide' || !item.role_version) return null

  const chapter = item.source.chapter_title.trim()
  const core = item.source.core_points.trim()
  const lead = core.split(/\n+/).find(Boolean) ?? core
  const profileMap: Record<RoleVersion, { titlePrefix: string; hookPrefix: string; outlinePrefix: string[]; publishPrefix: string; personaId: PersonaProfile['persona_id']; tone: string; interaction: string }> = {
    yanjia_housing: {
      titlePrefix: '言家住宅｜日式装修落地指南',
      hookPrefix: '把书稿观点改成住宅客户听得懂、愿意咨询的表达。',
      outlinePrefix: ['本土化改造重点', '住宅落地误区', '适配户型建议'],
      publishPrefix: '【言家住宅内容运营版】',
      personaId: 'openclaw_content',
      tone: '专业顾问式，强调住宅落地与客户决策',
      interaction: '引导私信咨询户型与预算。',
    },
    official_account: {
      titlePrefix: '公众号选题｜日式装修本土化装修指南',
      hookPrefix: '把章节观点整理成适合收藏转发的图文结构。',
      outlinePrefix: ['章节核心观点', '常见误区拆解', '实用清单总结'],
      publishPrefix: '【公众号运营版】',
      personaId: 'official_account',
      tone: '信息整合型，适合公众号深度阅读',
      interaction: '引导收藏、转发、留言咨询。',
    },
    mom970: {
      titlePrefix: '果妈970｜家的松弛感装修笔记',
      hookPrefix: '把书稿观点改成带生活感、能引发评论的内容。',
      outlinePrefix: ['生活场景共鸣', '踩坑提醒', '马上能做的小动作'],
      publishPrefix: '【果妈970运营版】',
      personaId: 'mom970_content',
      tone: '陪伴分享型，强调真实生活体验',
      interaction: '引导评论区说出自己家里的困扰。',
    },
  }
  const profile = profileMap[item.role_version]
  const title = `${profile.titlePrefix}｜${chapter}`
  const hook = `${profile.hookPrefix}${lead}`
  const outline = [
    `${profile.outlinePrefix[0]}：${chapter}`,
    `${profile.outlinePrefix[1]}：${lead}`,
    `${profile.outlinePrefix[2]}：从书稿观点转成今日可执行内容`,
  ]
  const script = `${profile.publishPrefix}\n章节：${chapter}\n\n核心观点：\n${core}\n\n内容展开：\n1. 先讲为什么这个章节对当下装修决策重要。\n2. 再拆出一个最容易踩坑的本土化误区。\n3. 最后给到读者今天就能执行的判断动作。\n\n结尾互动：${profile.interaction}`
  const publishText = `${profile.publishPrefix}\n${title}\n\n${hook}\n\n要点：\n${outline.map((line, index) => `${index + 1}. ${line}`).join('\n')}\n\n${profile.interaction}`
  return {
    type: 'text',
    content: [title, hook, ...outline.map((line, index) => `${index + 1}. ${line}`), script, publishText].join('\n\n'),
    meta: {
      domain: item.domain ?? 'media',
      executor: 'book_manuscript_rewriter',
      source_type: item.source.source_type,
      source_project: item.source.source_project,
      chapter_title: item.source.chapter_title,
      role_version: item.role_version,
    },
    title,
    hook,
    outline,
    script,
    publish_text: publishText,
    generated_at: timestamp,
    generator: 'mock',
    persona_id: profile.personaId,
    tone_style: profile.tone,
    interaction_style: profile.interaction,
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

function resolvePersonaProfile(item: TaskBoardItem): PersonaProfile {
  const line = `${item.project_line ?? ''} ${item.target_group_id ?? ''} ${item.subdomain ?? ''}`.toLowerCase()
  if (line.includes('mom970')) return PERSONA_REGISTRY.mom970
  if (line.includes('latin_boy')) return PERSONA_REGISTRY.latin_boy
  if (line.includes('chongming')) return PERSONA_REGISTRY.chongming
  if (line.includes('official_account')) return PERSONA_REGISTRY.official_account
  return PERSONA_REGISTRY.openclaw_content
}

function getPublishRhythm(item: TaskBoardItem) {
  const persona = resolvePersonaProfile(item)
  switch (persona.persona_id) {
    case 'mom970_content':
      return { recommend_publish_time: '08:30', recommend_frequency: '1/day', publish_today: true }
    case 'latin_boy':
      return { recommend_publish_time: '17:30', recommend_frequency: '1-2/day', publish_today: true }
    case 'chongming_storage':
      return { recommend_publish_time: '19:30', recommend_frequency: '4/week', publish_today: true }
    case 'official_account':
      return { recommend_publish_time: '21:00', recommend_frequency: '3/week', publish_today: false }
    default:
      return { recommend_publish_time: '11:30', recommend_frequency: '1/day', publish_today: true }
  }
}

function buildPublishEnhancement(board: TaskBoardItem[], item: TaskBoardItem) {
  const persona = resolvePersonaProfile(item)
  const rhythm = getPublishRhythm(item)
  const sameLineDoneItems = board.filter((entry) =>
    entry.task_name !== item.task_name
    && entry.project_line === item.project_line
    && ['done', 'success', 'cancelled'].includes(entry.status ?? '')
    && entry.result,
  )
  const sameTimeWindowCount = sameLineDoneItems.filter((entry) => (entry.result?.recommend_publish_time ?? getPublishRhythm(entry).recommend_publish_time) === rhythm.recommend_publish_time).length
  const sameTitleCount = sameLineDoneItems.filter((entry) => entry.result?.title && entry.result.title === item.result?.title).length
  const highFreqCount = sameLineDoneItems.filter((entry) => {
    const updatedAt = new Date(entry.updated_at ?? entry.timestamp ?? 0).getTime()
    const currentAt = new Date(item.updated_at ?? item.timestamp ?? 0).getTime()
    return Number.isFinite(updatedAt) && Number.isFinite(currentAt) && Math.abs(currentAt - updatedAt) <= 6 * 60 * 60 * 1000
  }).length
  const warnings: string[] = []
  if (sameTimeWindowCount >= 1) warnings.push('同时段连续发布过密')
  if (sameTitleCount >= 1) warnings.push('模板重复率高')
  if (highFreqCount >= 2) warnings.push('高频输出未间隔')
  const topic = item.result?.title || item.task_name
  return {
    persona,
    rhythm,
    warnings,
    suggested_title: item.result?.title || `建议标题｜${topic}`,
    suggested_first_comment: `首评建议：补一句真实场景，强调 ${persona.tone_style}`,
    suggested_interaction_question: persona.persona_id === 'official_account'
      ? '你更想先看案例拆解，还是避坑清单？'
      : persona.persona_id === 'latin_boy'
        ? '如果是你，你会先试哪一步？'
        : '你现在最卡的是哪一步？我继续拆给你。',
  }
}

function syncPublishDecisionLog(item: TaskBoardItem, enhancement: ReturnType<typeof buildPublishEnhancement>, now: string) {
  item.decision_log = item.decision_log ?? []
  item.auto_decision_log = item.auto_decision_log ?? []
  const logExists = item.decision_log.some((entry) => entry.reason === 'publish_engine.enriched')
  if (logExists) {
    item.decision_log = item.decision_log.map((entry) => entry.reason === 'publish_engine.enriched'
      ? {
        ...entry,
        timestamp: now,
        detail: `persona=${enhancement.persona.persona_id} / recommend=${enhancement.rhythm.recommend_publish_time}`,
        publish_rhythm_hit: `${enhancement.rhythm.recommend_publish_time} · ${enhancement.rhythm.recommend_frequency} · today=${enhancement.rhythm.publish_today}`,
        persona_hit: `${enhancement.persona.persona_id} · ${enhancement.persona.tone_style} · ${enhancement.persona.interaction_style}`,
        publish_risk_warning: enhancement.warnings,
      }
      : entry)
    return
  }
  item.decision_log.push({
    timestamp: now,
    action: 'warning',
    reason: 'publish_engine.enriched',
    detail: `persona=${enhancement.persona.persona_id} / recommend=${enhancement.rhythm.recommend_publish_time}`,
    publish_rhythm_hit: `${enhancement.rhythm.recommend_publish_time} · ${enhancement.rhythm.recommend_frequency} · today=${enhancement.rhythm.publish_today}`,
    persona_hit: `${enhancement.persona.persona_id} · ${enhancement.persona.tone_style} · ${enhancement.persona.interaction_style}`,
    publish_risk_warning: enhancement.warnings,
  })
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
  const matchedTemplate = chooseTemplateForTask(item, templatePoolCache)
  const bookRoleResult = buildBookRoleResult(item, now)
  if (bookRoleResult) return bookRoleResult
  if (domain === 'media') {
    const result = buildMediaResult(item.task_name, now)
    if (matchedTemplate) {
      result.script = matchedTemplate.content
      result.content = [result.title, result.hook, ...result.outline.map((line, idx) => `${idx + 1}. ${line}`), result.script, result.publish_text].join('\n\n')
      result.meta = { ...(result.meta ?? {}), template_id: matchedTemplate.template_id }
    }
    return result
  }
  if (domain === 'business') {
    const result = buildTextResult(
      `跟进建议：先确认客户当前报价顾虑，再补一版对比清单与下一步时间点。\n\n建议回复：\n已收到您对报价的关注，我这边建议先对齐 3 个点，分别是范围、交付节点、可替代方案。我今天可先补一版精简报价说明，方便您内部确认，明天下午前再跟您同步最终建议。`,
      { domain, executor: 'followup_executor' },
    )
    if (matchedTemplate) result.meta = { ...(result.meta ?? {}), template_id: matchedTemplate.template_id }
    if (matchedTemplate) result.publish_text = matchedTemplate.content
    if (matchedTemplate) result.content = `跟进建议：优先复用历史高命中回复模板。\n\n建议回复：\n${matchedTemplate.content}`
    return result
  }
  if (domain === 'personal') {
    return buildTextResult(
      `提醒文案：明天记得整理待办，先把必须完成、可延后、可委托三类分开，10 分钟内先清一遍高优先级事项。`,
      { domain, executor: 'reminder_executor' },
    )
  }
  if (domain === 'family') {
    const result = buildTextResult(
      `家庭执行建议：先确认时间和参与人，再拆成 3 个最小动作，避免提醒过长导致落空。`,
      { domain, executor: 'plan_executor' },
    )
    if (matchedTemplate) result.meta = { ...(result.meta ?? {}), template_id: matchedTemplate.template_id }
    if (matchedTemplate) result.content = `家庭执行建议：\n${matchedTemplate.content}`
    if (matchedTemplate) result.outline = matchedTemplate.content.split(/\n+/).filter(Boolean)
    return result
  }
  return buildTextResult(
    `执行建议：已生成开发执行草案，下一步先确认范围、风险点与最小可验证改动，再进入实现。`,
    { domain: domain ?? 'builder', executor: 'code_executor' },
  )
}

function createBookManuscriptTasks(source: TaskBoardSource, now: string) {
  const scenarioId = `book-manuscript-${Date.now()}`
  const parentTaskId = `${scenarioId}:parent`
  const roleSpecs: Array<{ role_version: RoleVersion; routeHint: string; title: string }> = [
    { role_version: 'yanjia_housing', routeHint: '言家住宅 住宅 户型 housing', title: `言家住宅内容运营版 · ${source.chapter_title}` },
    { role_version: 'official_account', routeHint: '公众号 推文 official_account', title: `公众号运营版 · ${source.chapter_title}` },
    { role_version: 'mom970', routeHint: '果妈970 mom970 内容 发布', title: `果妈970运营版 · ${source.chapter_title}` },
  ]

  return roleSpecs.map((spec, index) => {
    const route = inferTaskRoute(spec.routeHint)
    return {
      task_name: spec.title,
      agent: route.assigned_agent,
      parent_task_id: parentTaskId,
      scenario_id: scenarioId,
      task_group_id: `${scenarioId}:book-role-distribution`,
      task_group_label: `book_manuscript · ${source.chapter_title}`,
      template_source: 'book_manuscript_role_distribution',
      template_task_index: index + 1,
      domain: route.domain,
      subdomain: route.subdomain,
      project_line: route.project_line,
      target_group_id: route.target_group_id,
      notify_mode: route.notify_mode,
      preferred_agent: route.preferred_agent,
      assigned_agent: route.assigned_agent,
      target_system: route.target_system,
      slot_id: null,
      priority: 1,
      retry_count: 0,
      type: 'content_task',
      status: 'queued',
      timestamp: now,
      queued_at: now,
      updated_at: now,
      attention: false,
      stuck: false,
      abnormal: false,
      auto_generated: true,
      trigger_source: 'manual',
      auto_decision_log: [],
      decision_log: [],
      source,
      role_version: spec.role_version,
      depends_on: [],
      blocked_by: [],
      dependency_status: 'ready',
      history: [
        {
          action: 'create',
          operator: 'system',
          trigger_source: 'system',
          timestamp: now,
          status_after: 'queued',
          priority_after: 1,
        },
      ],
    } satisfies TaskBoardItem
  })
}

function createScenarioTemplateTasks(templateKey: ScenarioTemplateKey, now: string) {
  const template = SCENARIO_TEMPLATES[templateKey]
  const scenarioId = `${templateKey}-${Date.now()}`
  const taskGroupLabel = `${template.label}-${new Date(now).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })}`
  const parentTaskId = `${scenarioId}:parent`

  return template.tasks.map((seed, index) => {
    const route = inferTaskRoute(seed.routeHint ?? seed.title)
    const taskName = `${taskGroupLabel} · ${seed.title}`
    const dependsOn = (seed.dependsOnIndexes ?? [])
      .map((dependencyIndex) => `${taskGroupLabel} · ${template.tasks[dependencyIndex]?.title ?? ''}`)
      .filter(Boolean)

    return {
      task_name: taskName,
      agent: route.assigned_agent,
      parent_task_id: parentTaskId,
      scenario_id: scenarioId,
      task_group_id: `${scenarioId}:${seed.taskGroupSuffix ?? route.domain}`,
      task_group_label: `${taskGroupLabel} · ${(seed.taskGroupSuffix ?? route.domain).toUpperCase()}`,
      template_key: template.key,
      template_source: template.label,
      template_task_index: index + 1,
      domain: route.domain,
      subdomain: route.subdomain,
      project_line: route.project_line,
      target_group_id: route.target_group_id,
      notify_mode: route.notify_mode,
      preferred_agent: route.preferred_agent,
      assigned_agent: route.assigned_agent,
      target_system: route.target_system,
      slot_id: null,
      priority: seed.priority ?? 3,
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
      depends_on: dependsOn,
      blocked_by: dependsOn.length ? [...dependsOn] : [],
      dependency_status: dependsOn.length ? 'blocked' : 'ready',
      history: [
        {
          action: 'create',
          operator: 'system',
          trigger_source: 'system',
          timestamp: now,
          status_after: 'queued',
          priority_after: seed.priority ?? 3,
        },
      ],
    } satisfies TaskBoardItem
  })
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

function createTaskFromStrategy(seed: {
  task_name: string
  routeHint: string
  trigger_source: 'habit' | 'inactivity' | 'schedule'
  memory_hit?: string
  profile_rule?: string
}, now: string, records: MemoryRecord[]) {
  const route = inferTaskRoute(seed.routeHint)
  const nextItem: TaskBoardItem = {
    task_name: seed.task_name,
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
    priority: 2,
    retry_count: 0,
    type: route.type,
    status: 'queued',
    auto_generated: true,
    trigger_source: seed.trigger_source,
    predicted_risk: 'low',
    predicted_block: false,
    timestamp: now,
    queued_at: now,
    updated_at: now,
    attention: false,
    stuck: false,
    abnormal: false,
    auto_decision_log: [],
    decision_log: [],
    history: [
      { action: 'create', operator: 'system', trigger_source: 'rule_engine', timestamp: now, status_after: 'queued', priority_after: 2 },
    ],
  }
  applyUserContextOnCreate(nextItem, records)
  appendDecisionLog(nextItem, 'strategy_generate_task', 'strategy_engine.run', `自动生成任务: ${seed.task_name}`, now, {
    memory_hit: seed.memory_hit,
    profile_rule: seed.profile_rule,
  })
  return nextItem
}

function applyPredictiveSignals(payload: TaskBoardPayload, now: string) {
  const overlapCounter = new Map<string, number>()
  for (const item of payload.board) {
    const slot = item.recommended_execute_at ?? item.queued_at?.slice(11, 16)
    if (!slot) continue
    overlapCounter.set(slot, (overlapCounter.get(slot) ?? 0) + 1)
  }

  for (const item of payload.board) {
    const failCount = (item.history ?? []).filter((entry) => entry.action === 'fail').length
    const dependencyDepth = (item.depends_on ?? []).length
    const overlapKey = item.recommended_execute_at ?? item.queued_at?.slice(11, 16)
    const overlapCount = overlapKey ? overlapCounter.get(overlapKey) ?? 0 : 0
    let nextRisk: 'low' | 'medium' | 'high' = 'low'
    if (failCount >= 2 || overlapCount >= 3) nextRisk = 'high'
    else if (failCount >= 1 || dependencyDepth >= 1 || overlapCount >= 2) nextRisk = 'medium'
    const nextPredictedBlock = dependencyDepth >= 2 || (item.blocked_by?.length ?? 0) > 0
    const riskChanged = item.predicted_risk !== nextRisk || item.predicted_block !== nextPredictedBlock
    item.predicted_risk = nextRisk
    item.predicted_block = nextPredictedBlock
    if ((nextRisk === 'high' || nextPredictedBlock) && riskChanged) {
      appendDecisionLog(
        item,
        nextPredictedBlock ? 'precheck_block' : 'risk_detected',
        nextPredictedBlock ? 'dependency_precheck' : 'predictive_risk',
        nextPredictedBlock ? '预计依赖未完成，将阻塞' : `预测风险 ${nextRisk}，失败率/依赖/时间冲突触发`,
        now,
      )
    }
    if (nextRisk === 'high' && clampPriority(item.priority) > 0) {
      const boosted = Math.max(0, clampPriority(item.priority) - 1)
      if (boosted !== item.priority) {
        item.priority = boosted
        appendDecisionLog(item, 'priority_up', 'predicted_risk_high', `预测高风险，优先级提升到 ${priorityLabel(boosted)}`, now)
      }
      if (failCount >= 2) item.need_human = true
    }
  }
}

function strategyEngineRun(payload: TaskBoardPayload, records: MemoryRecord[], now: string) {
  const existingNames = new Set(payload.board.map((item) => item.task_name))
  const seeds = [
    { task_name: '果果学习任务 · 今晚 20:00 英语复习', routeHint: '果果 学习 英语复习 今晚 20:00', trigger_source: 'habit' as const, memory_hit: '20:00', profile_rule: '晚间学习' },
    { task_name: '内容发布任务 · 3 天未发内容，补发今日主题', routeHint: '内容 发布 账号运营 今日主题', trigger_source: 'inactivity' as const, memory_hit: 'publish_time_preference', profile_rule: '3d_inactivity' },
    { task_name: '客户跟进任务 · T+3 未跟进客户', routeHint: '客户 跟进 报价 T+3', trigger_source: 'schedule' as const, memory_hit: 'followup_cadence', profile_rule: 'T+3_followup' },
  ]

  for (const seed of seeds) {
    if (existingNames.has(seed.task_name)) continue
    payload.board.unshift(createTaskFromStrategy(seed, now, records))
    existingNames.add(seed.task_name)
  }

  applyPredictiveSignals(payload, now)
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
  if (item.result?.meta?.template_id) {
    appendDecisionLog(item, 'strategy_generate_task', 'template_hit', `命中模板 ${String(item.result.meta.template_id)}`, now, {
      template_id: String(item.result.meta.template_id),
    })
  }
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

    const queuedCandidates = items.filter((item) => ['todo', 'queued', 'queue', 'pending', 'preparing'].includes(item.status ?? '') && !item.stuck && (item.blocked_by?.length ?? 0) === 0)
    const queueStats = items.filter((item) => ['todo', 'queued', 'queue', 'pending', 'preparing'].includes(item.status ?? '')).length
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
      if (item.status === 'todo' || item.status === 'queued' || item.status === 'queue' || item.status === 'pending' || item.status === 'preparing') {
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
          if (item.predicted_block) {
            item.status = 'preparing'
            item.updated_at = now
            appendDecisionLog(item, 'precheck_block', 'dependency_precheck', '预计依赖未完成，将阻塞', now)
          } else {
            item.status = 'preparing'
            runQueuedTask(item, now)
          }
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
  const memoryRecords = await readMemoryStore()
  const templateRecords = await readTemplateStore()
  templatePoolCache = templateRecords
  payload.board = (payload.board ?? []).map((rawItem) => {
    const routed = enrichTaskRouting({
      ...rawItem,
      parent_task_id: rawItem.parent_task_id,
      scenario_id: rawItem.scenario_id,
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
    routed.user_id = rawItem.user_id ?? inferUserId(routed)
    const profile = deriveProfile(routed.user_id, memoryRecords)
    routed.profile_tags = profile.tags
    routed.memory_hits = []
    routed.recommended_execute_at = undefined
    return routed
  })
  const now = Date.now()
  payload.board = payload.board.map((item) => {
    const next = { ...item }
    const profile = deriveProfile(next.user_id ?? inferUserId(next), memoryRecords)
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

    const studyTime = profile.behavior_patterns.study_time_preference
    const publishTime = profile.behavior_patterns.publish_time_preference
    const matchedTime = typeof studyTime === 'string' ? studyTime : typeof publishTime === 'string' ? publishTime : undefined
    if (matchedTime) {
      next.recommended_execute_at = matchedTime
      next.memory_hits = [...new Set([...(next.memory_hits ?? []), matchedTime])]
      const isStudyTask = (next.task_name ?? '').includes('学习') || (next.task_name ?? '').includes('果果')
      const isPublishTask = (next.task_name ?? '').includes('发布') || (next.task_name ?? '').includes('内容')
      if ((isStudyTask || isPublishTask) && clampPriority(next.priority) > 0) {
        const boosted = Math.max(0, clampPriority(next.priority) - 1)
        if (boosted !== next.priority) {
          appendDecisionLog(next, 'priority_up', 'profile_preference_match', `命中用户习惯时间 ${matchedTime}，优先级提升到 ${priorityLabel(boosted)}`, decisionTimestamp, {
            memory_hit: matchedTime,
            profile_rule: profile.tags.join(' / ') || 'habit_match',
          })
          next.priority = boosted
        }
      }
    }

    const failedCountForType = failedHistory.length
    if (failedCountForType >= 2 && ((next.domain ?? '') === 'family' || (next.task_name ?? '').includes('学习'))) {
      next.need_human = true
      appendDecisionLog(next, 'need_human', 'profile_failure_guard', '同类任务历史连续失败，提前触发人工介入', decisionTimestamp, {
        memory_hit: `history_failures=${failedCountForType}`,
        profile_rule: 'repeat_failure_guard',
      })
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

  strategyEngineRun(payload, memoryRecords, new Date().toISOString())

  payload.current_user_id = payload.board[0]?.user_id
  payload.current_profile = payload.current_user_id ? deriveProfile(payload.current_user_id, memoryRecords) : undefined

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

  for (const item of payload.board) {
    const userId = item.user_id ?? inferUserId(item)
    if (['done', 'success'].includes(item.status ?? '')) {
      const learnedTime = item.domain === 'family' ? '20:00' : item.domain === 'media' ? '09:00' : undefined
      if (learnedTime) {
        upsertMemoryRecord(memoryRecords, {
          user_id: userId,
          memory_type: 'habit',
          key: item.domain === 'family' ? 'study_time_preference' : 'publish_time_preference',
          value: learnedTime,
          updated_at: new Date().toISOString(),
        })
      }
      upsertMemoryRecord(memoryRecords, {
        user_id: userId,
        memory_type: 'history',
        key: `task_success_${item.domain ?? 'builder'}`,
        value: ((memoryRecords.find((record) => record.user_id === userId && record.memory_type === 'history' && record.key === `task_success_${item.domain ?? 'builder'}`)?.value as number | undefined) ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
    }
    if (item.need_human || item.status === 'failed') {
      upsertMemoryRecord(memoryRecords, {
        user_id: userId,
        memory_type: 'constraint',
        key: `need_human_${item.domain ?? 'builder'}`,
        value: true,
        updated_at: new Date().toISOString(),
      })
    }
  }
  await writeMemoryStore(memoryRecords)
  const scheduledPayload = applyScheduler(payload)
  scheduledPayload.template_pool = await syncTemplatePool(scheduledPayload.board)
  return scheduledPayload
}

function summarizeTaskBoard(payload: TaskBoardPayload) {
  payload.board = payload.board.map((item) => {
    if (!item.result) return item
    const assetType = item.result.asset_type
      ?? (item.domain === 'media' ? 'media' : item.domain === 'business' ? 'business' : item.domain === 'family' ? 'family' : 'generic')
    const hasPublishContent = Boolean(item.result.title || item.result.hook || item.result.script || item.result.publish_text)
    item.result = {
      ...item.result,
      asset_type: assetType,
      publish_ready: item.result.publish_ready ?? hasPublishContent,
      archive_ready: item.result.archive_ready ?? ['done', 'success', 'cancelled'].includes(item.status ?? ''),
    }
    return item
  })
  const now = new Date().toISOString()
  payload.board = payload.board.map((item) => {
    if (!item.result || item.domain !== 'media') return item
    const enhancement = buildPublishEnhancement(payload.board, item)
    item.result = {
      ...item.result,
      persona_id: enhancement.persona.persona_id,
      tone_style: enhancement.persona.tone_style,
      interaction_style: enhancement.persona.interaction_style,
      recommend_publish_time: enhancement.rhythm.recommend_publish_time,
      recommend_frequency: enhancement.rhythm.recommend_frequency,
      publish_today: enhancement.rhythm.publish_today,
      suggested_title: enhancement.suggested_title,
      suggested_first_comment: enhancement.suggested_first_comment,
      suggested_interaction_question: enhancement.suggested_interaction_question,
      publish_risk_warning: enhancement.warnings,
    }
    syncPublishDecisionLog(item, enhancement, now)
    return item
  })
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

  if (action === 'manual_done' || action === 'mark_manual_published') {
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
    target.result = target.result ?? buildTextResult(target.task_name)
    target.result.manual_published_at = now
    target.result.manual_published_by = owner
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
                  const templateKey = String(body?.template_key || '').trim() as ScenarioTemplateKey
                  const sourcePayload = body?.source as Partial<TaskBoardSource> | undefined

                  if (templateKey && templateKey in SCENARIO_TEMPLATES) {
                    const payload = await readTaskBoard(filePath)
                    const memoryRecords = await readMemoryStore()
                    const now = new Date().toISOString()
                    const scenarioTasks = createScenarioTemplateTasks(templateKey, now).map((item) => {
                      applyUserContextOnCreate(item, memoryRecords)
                      return item
                    })
                    payload.board.unshift(...scenarioTasks.reverse())
                    payload.generated_at = now
                    await writeTaskBoard(filePath, payload)
                    const executed = await readTaskBoard(filePath)
                    await writeTaskBoard(filePath, executed)
                    res.statusCode = 200
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify(summarizeTaskBoard(executed)))
                    return
                  }

                  const hasBookSource = sourcePayload?.source_type === 'book_manuscript'
                    && sourcePayload?.source_project === 'japanese_renovation_guide'
                    && String(sourcePayload?.chapter_title || '').trim()
                    && String(sourcePayload?.core_points || '').trim()

                  if (hasBookSource) {
                    const payload = await readTaskBoard(filePath)
                    const memoryRecords = await readMemoryStore()
                    const now = new Date().toISOString()
                    const source: TaskBoardSource = {
                      source_type: 'book_manuscript',
                      source_project: 'japanese_renovation_guide',
                      chapter_title: String(sourcePayload?.chapter_title || '').trim(),
                      core_points: String(sourcePayload?.core_points || '').trim(),
                    }
                    const roleTasks = createBookManuscriptTasks(source, now).map((item) => {
                      applyUserContextOnCreate(item, memoryRecords)
                      return item
                    })
                    payload.board.unshift(...roleTasks.reverse())
                    payload.generated_at = now
                    await writeTaskBoard(filePath, payload)
                    const executed = await readTaskBoard(filePath)
                    await writeTaskBoard(filePath, executed)
                    res.statusCode = 200
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify(summarizeTaskBoard(executed)))
                    return
                  }

                  if (!taskInput) {
                    res.statusCode = 400
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: 'missing input' }))
                    return
                  }

                  if (taskInput.startsWith('queue:')) {
                    const payload = await readTaskBoard(filePath)
                    const memoryRecords = await readMemoryStore()
                    const now = new Date().toISOString()
                    const taskName = taskInput.slice(6).trim() || `queued-${Date.now()}`
                    const route = inferTaskRoute(taskName)
                    const nextItem: TaskBoardItem = {
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
                    }
                    applyUserContextOnCreate(nextItem, memoryRecords)
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
                  const memoryRecords = await readMemoryStore()
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
                  applyUserContextOnCreate(nextItem, memoryRecords)
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
                } else if (action === 'mark_template_source') {
                  target.result = target.result ?? buildTextResult(target.task_name)
                  target.result.meta = { ...(target.result.meta ?? {}), template_source: true }
                  appendDecisionLog(target, 'manual_done', 'template_source_marked', '已标记为模板来源', now)
                } else if (['takeover', 'assign', 'ignore', 'manual_done', 'manual_continue', 'mark_manual_published'].includes(action)) {
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

          server.middlewares.use('/api/memory', async (req, res, next) => {
            if (req.method === 'GET') {
              try {
                const userId = String(new URL(req.url ?? '', 'http://localhost').searchParams.get('user_id') ?? '').trim()
                const records = await readMemoryStore()
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ user_id: userId, records: userId ? records.filter((record) => record.user_id === userId) : records }))
              } catch (error) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'memory fetch failed', message: error instanceof Error ? error.message : String(error) }))
              }
              return
            }

            if (req.method === 'POST') {
              try {
                const chunks: Buffer[] = []
                for await (const chunk of req) chunks.push(Buffer.from(chunk))
                const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Partial<MemoryRecord>
                if (!body.user_id || !body.memory_type || !body.key) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'missing memory fields' }))
                  return
                }
                const records = await readMemoryStore()
                const nextRecord: MemoryRecord = { user_id: body.user_id, memory_type: body.memory_type, key: body.key, value: body.value, updated_at: new Date().toISOString() }
                upsertMemoryRecord(records, nextRecord)
                await writeMemoryStore(records)
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true, record: nextRecord }))
              } catch (error) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'memory write failed', message: error instanceof Error ? error.message : String(error) }))
              }
              return
            }

            next()
          })

          server.middlewares.use('/api/profile', async (req, res, next) => {
            if (req.method !== 'GET') {
              next()
              return
            }
            try {
              const userId = String(new URL(req.url ?? '', 'http://localhost').searchParams.get('user_id') ?? '').trim()
              if (!userId) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'missing user_id' }))
                return
              }
              const records = await readMemoryStore()
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(deriveProfile(userId, records)))
            } catch (error) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'profile fetch failed', message: error instanceof Error ? error.message : String(error) }))
            }
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
