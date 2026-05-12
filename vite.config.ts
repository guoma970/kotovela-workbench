import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { devApiPlugin } from './server/devApi'
import { appendAuditLog } from './server/devApi/auditLogStore'
import { inferTaskBoardEvidenceContext, type StableEvidenceRoutingHints } from './src/lib/evidenceContext'

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

const PROJECT_ROOT = path.resolve(process.env.PROJECT_ROOT ?? process.env.OPENCLAW_PROJECT_ROOT ?? process.cwd())
const OPENCLAW_RUNNER_ROOT = path.resolve(
  process.env.OPENCLAW_RUNNER_ROOT ?? path.join(PROJECT_ROOT, 'data', 'openclaw-runner'),
)

const TASK_BOARD_FILE = path.resolve(process.env.TASK_BOARD_FILE ?? path.join(OPENCLAW_RUNNER_ROOT, 'tasks-board.json'))
const TASK_NOTIFY_LOG_FILE = path.resolve(process.env.TASK_NOTIFY_LOG_FILE ?? path.join(OPENCLAW_RUNNER_ROOT, 'task-notifications.json'))
const MEMORY_STORE_FILE = path.resolve(process.env.MEMORY_STORE_FILE ?? path.join(PROJECT_ROOT, 'data', 'scheduler-memory.json'))
const TEMPLATE_POOL_FILE = path.resolve(process.env.TEMPLATE_POOL_FILE ?? path.join(PROJECT_ROOT, 'data', 'scheduler-template-pool.json'))
const CONTENT_LEARNING_FILE = path.resolve(process.env.CONTENT_LEARNING_FILE ?? path.join(PROJECT_ROOT, 'data', 'content-learning.json'))

type TemplateAssetType = 'script' | 'reply' | 'plan' | 'generic' | 'content_structure'

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

type ContentLearningRecord = {
  key: string
  content_line: string
  account_line: string
  structure_id: string
  structure_type: string
  impressions: number
  feedback_count: number
  positive_count: number
  negative_count: number
  avg_score: number
  learning_score: number
  last_feedback_at: string
  last_updated_at: string
}

let templatePoolCache: TemplateRecord[] = []
let contentLearningCache: ContentLearningRecord[] = []
let taskBoardWriteQueue: Promise<unknown> = Promise.resolve()

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
  latin_boy_guoguo: { group: '拉丁男孩果果运营群', groupId: 'latin_boy_guoguo', channel: 'media' },
  latin_boy: { group: '拉丁男孩果果运营群', groupId: 'latin_boy_guoguo', channel: 'media' },
  chongming_storage: { group: '崇明小娘爱收纳运营群', groupId: 'chongming_storage', channel: 'media' },
  chongming: { group: '崇明小娘爱收纳运营群', groupId: 'chongming_storage', channel: 'media' },
  guoma970: { group: '果妈970运营群', groupId: 'guoma970', channel: 'media' },
  mom970: { group: '果妈970运营群', groupId: 'mom970', channel: 'media' },
  book: { group: '日式装修指南书稿群', groupId: 'book', channel: 'media' },
  kotovela_official: { group: '言町科技运营群', groupId: 'kotovela_official', channel: 'business' },
  tech: { group: '言町科技运营群', groupId: 'kotovela_official', channel: 'business' },
  yanfami_official: { group: '言家住宅运营群', groupId: 'yanfami_official', channel: 'business' },
  housing: { group: '言家住宅运营群', groupId: 'yanfami_official', channel: 'business' },
  kotoharo_official: { group: '言纳筑集运营群', groupId: 'kotoharo_official', channel: 'business' },
  biz_content: { group: '言纳筑集运营群', groupId: 'kotoharo_official', channel: 'business' },
  guoshituan_official: { group: '果实团运营群', groupId: 'guoshituan_official', channel: 'business' },
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
    | 'conflict_detected'
    | 'domain_locked_by_priority'
    | 'lead_auto_transfer'
  reason: string
  detail: string
  publish_rhythm_hit?: string
  persona_hit?: string
  publish_risk_warning?: string[]
  memory_hit?: string
  profile_rule?: string
  template_id?: string
  learning_key?: string
  learning_score?: number
  learning_rank?: number
  learning_top_n?: number
  learning_total_candidates?: number
  attribution_source?: string
  attribution_medium?: string
  attribution_campaign?: string
  attribution_content?: string
}

type PersonaProfile = {
  persona_id: 'openclaw_content' | 'guoma970_content' | 'latin_boy' | 'chongming_storage' | 'official_account'
  persona: string
  tone_style: string
  interaction_style: string
  structure_type: 'official' | 'personal' | 'hybrid'
}

type BrandLine = 'kotovela' | 'yanfami' | 'kotoharo' | 'guoshituan'
type ContentLine = 'layout_renovation' | 'kitchen_storage' | 'material_case' | 'floor_heating' | 'group_buy_material' | 'customer_followup' | 'growth_record' | 'ai_tools'
type AccountType = 'official' | 'personal' | 'hybrid' | 'external_partner'
type AccountLine = 'yanfami_official' | 'kotoharo_official' | 'kotovela_official' | 'guoshituan_official' | 'guoma970' | 'latin_boy_guoguo' | 'luyi_children' | 'chongming_storage' | 'openclaw' | 'mom970'
type DistributionChannel = 'short_content' | 'official_account'
type ContentVariant = 'short' | 'article'

type TaskBoardSource = {
  source_type: 'book_manuscript' | 'product_brochure' | 'case_booklet'
  source_project: 'japanese_renovation_guide' | 'product_material_system' | 'case_library'
  chapter_title?: string
  core_points: string
  title?: string
  source_line?: string
}

type RoleVersion = 'yanfami_official' | 'official_account' | 'guoma970' | 'mom970'

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
  source_line?: string
  brand_line?: BrandLine
  brand_display?: string
  content_line?: ContentLine
  account_line?: AccountLine
  account_display?: string
  account_type?: AccountType
  distribution_channel?: DistributionChannel
  content_variant?: ContentVariant
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
    structure?: string[]
    script: string
    full_article?: string
    publish_text: string
    publish_ready?: boolean
    archive_ready?: boolean
    asset_type?: 'media' | 'business' | 'family' | 'generic'
    generated_at?: string
    generator?: 'mock' | 'gpt'
    persona?: string
    persona_id?: PersonaProfile['persona_id']
    tone_style?: string
    interaction_style?: string
    structure_type?: 'official' | 'personal' | 'hybrid' | 'short_content' | 'article' | 'consult_content'
    structure_id?: string
    section_map?: Record<string, string>
    cta_policy?: 'default' | 'consult_only' | 'planting_only'
    structure_summary?: string
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
  learning_score?: number
  lead_id?: string
  consultant_id?: string
  consultant_owner?: string
  assignment_mode?: 'auto' | 'manual'
  assignment_status?: 'assigned' | 'reassigned' | 'pending' | 'converted' | 'lost'
  reassigned_to?: string
  reassigned_at?: string
  reassigned_reason?: string
  converted?: boolean
  lost?: boolean
  attribution?: {
    source?: string
    medium?: string
    campaign?: string
    content?: string
  }
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
  routingHints?: StableEvidenceRoutingHints
}

type ConsultantRecord = {
  consultant_id: string
  consultant_owner: string
  domain: string
  active_load: number
  conversion_count: number
  assignment_count: number
  status: 'available' | 'busy'
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
  learning_summary?: {
    total_records: number
    avg_learning_score: number
    high_score_records: number
  }
  business_summary?: {
    total_leads: number
    assigned_consultants: number
    converted: number
    lost: number
    attributed: number
  }
  board: TaskBoardItem[]
}

type ContentRouteDecision = {
  contentLine: ContentLine
  lockedBy: 'source_type' | 'keyword'
  brandLine: BrandLine
  accountLine: AccountLine
  sourceLine: string
  variants: Array<{
    accountLine: AccountLine
    accountType: AccountType
    distributionChannel: DistributionChannel
    contentVariant: ContentVariant
    roleVersion?: RoleVersion
    personaId: PersonaProfile['persona_id']
    taskSuffix: string
  }>
}

const INSTANCE_POOL_ORDER = ['builder', 'media', 'family', 'business', 'personal'] as const
type InstancePoolKey = (typeof INSTANCE_POOL_ORDER)[number]
const QUEUE_WARNING_MS = 60_000
const PERSONA_REGISTRY: Record<string, PersonaProfile> = {
  openclaw_content: { persona_id: 'openclaw_content', persona: '言家住宅官方人格', tone_style: '冷静拆解，偏产品方法论', interaction_style: '结尾抛执行问题，鼓励继续追问', structure_type: 'official' },
  guoma970: { persona_id: 'guoma970_content', persona: '970经验型人格', tone_style: '温暖经验流，像陪伴式分享', interaction_style: '多用生活感提问，鼓励评论区接龙', structure_type: 'hybrid' },
  mom970: { persona_id: 'guoma970_content', persona: '970经验型人格', tone_style: '温暖经验流，像陪伴式分享', interaction_style: '多用生活感提问，鼓励评论区接龙', structure_type: 'hybrid' },
  latin_boy: { persona_id: 'latin_boy', persona: '少年感互动人格', tone_style: '轻快少年感，节奏明亮', interaction_style: '适合互动小游戏和选择题', structure_type: 'personal' },
  chongming: { persona_id: 'chongming_storage', persona: '生活改造人格', tone_style: '收纳改造型，强调前后对比', interaction_style: '鼓励晒改造前后和提具体困扰', structure_type: 'personal' },
  official_account: { persona_id: 'official_account', persona: '品牌官方人格', tone_style: '正式可信，偏信息整合', interaction_style: '适合引导收藏、转发和留言咨询', structure_type: 'official' },
}
const BRAND_DISPLAY_MAP: Record<BrandLine, string> = {
  kotovela: '言町 Kotovela',
  yanfami: '言家 Yanfami',
  kotoharo: '言纳筑集 KOTOHARO',
  guoshituan: '果实团',
}
const ACCOUNT_DISPLAY_MAP: Record<AccountLine, string> = {
  yanfami_official: '言家 Yanfami 官方',
  kotoharo_official: '言纳筑集 KOTOHARO 官方',
  kotovela_official: '言町 Kotovela 官方',
  guoshituan_official: '果实团 官方',
  guoma970: '果妈970 Guoma970',
  mom970: '果妈970 Guoma970',
  latin_boy_guoguo: '拉丁男孩果果',
  luyi_children: '六一儿童',
  chongming_storage: '崇明小娘爱收纳',
  openclaw: 'OpenClaw',
}
const DOMAIN_PRIORITY_MAP: Record<InstancePoolKey, number> = {
  family: 0,
  business: 1,
  builder: 2,
  media: 2,
  personal: 3,
}

const CONTENT_LINE_SOURCE_MAP: Record<TaskBoardSource['source_type'], ContentLine> = {
  book_manuscript: 'layout_renovation',
  product_brochure: 'material_case',
  case_booklet: 'material_case',
}

const CONTENT_LINE_KEYWORDS: Array<{ line: ContentLine; keywords: string[] }> = [
  { line: 'kitchen_storage', keywords: ['收纳', '橱柜', '厨房'] },
  { line: 'material_case', keywords: ['材料', '建材', '品牌', '岩板', '热系统', '地暖'] },
  { line: 'floor_heating', keywords: ['地暖', '采暖', '采暖系统', '热源'] },
  { line: 'group_buy_material', keywords: ['团购', '拼团', '限时', '名额'] },
  { line: 'customer_followup', keywords: ['客户', '报价', '跟进'] },
  { line: 'layout_renovation', keywords: ['户型', '动线', '改造'] },
]

const CONTENT_LINE_ALLOWED_ACCOUNT_LINES: Record<ContentLine, AccountLine[]> = {
  layout_renovation: ['yanfami_official', 'guoma970'],
  kitchen_storage: ['kotoharo_official', 'chongming_storage'],
  material_case: ['yanfami_official', 'guoshituan_official', 'guoma970'],
  floor_heating: ['yanfami_official', 'guoma970'],
  group_buy_material: ['guoshituan_official'],
  customer_followup: ['guoshituan_official'],
  growth_record: ['latin_boy_guoguo'],
  ai_tools: ['luyi_children'],
}

const CONTENT_ROUTE_MAP: Record<Exclude<ContentLine, 'growth_record' | 'ai_tools'>, Omit<ContentRouteDecision, 'contentLine' | 'lockedBy'>> = {
  layout_renovation: {
    brandLine: 'yanfami',
    accountLine: 'yanfami_official',
    sourceLine: 'yanfami_official',
    variants: [
      { accountLine: 'guoma970', accountType: 'hybrid', distributionChannel: 'short_content', contentVariant: 'short', roleVersion: 'guoma970', personaId: 'guoma970_content', taskSuffix: '果妈970版' },
      { accountLine: 'yanfami_official', accountType: 'official', distributionChannel: 'official_account', contentVariant: 'article', roleVersion: 'official_account', personaId: 'official_account', taskSuffix: '官方长文版' },
    ],
  },
  kitchen_storage: {
    brandLine: 'kotoharo',
    accountLine: 'kotoharo_official',
    sourceLine: 'kotoharo_official',
    variants: [
      { accountLine: 'chongming_storage', accountType: 'personal', distributionChannel: 'short_content', contentVariant: 'short', personaId: 'chongming_storage', taskSuffix: '收纳人格版' },
      { accountLine: 'kotoharo_official', accountType: 'official', distributionChannel: 'official_account', contentVariant: 'article', roleVersion: 'official_account', personaId: 'official_account', taskSuffix: '官方长文版' },
    ],
  },
  material_case: {
    brandLine: 'yanfami',
    accountLine: 'yanfami_official',
    sourceLine: 'yanfami_official',
    variants: [
      { accountLine: 'guoma970', accountType: 'hybrid', distributionChannel: 'short_content', contentVariant: 'short', roleVersion: 'guoma970', personaId: 'guoma970_content', taskSuffix: '果妈970解释版' },
      { accountLine: 'yanfami_official', accountType: 'official', distributionChannel: 'official_account', contentVariant: 'article', roleVersion: 'official_account', personaId: 'official_account', taskSuffix: '言家官方案例长文版' },
      { accountLine: 'guoshituan_official', accountType: 'official', distributionChannel: 'official_account', roleVersion: 'official_account', contentVariant: 'article', personaId: 'official_account', taskSuffix: '果实团品牌案例版' },
      { accountLine: 'latin_boy_guoguo', accountType: 'personal', distributionChannel: 'short_content', contentVariant: 'short', personaId: 'latin_boy', taskSuffix: '拉丁男孩版' },
      { accountLine: 'luyi_children', accountType: 'personal', distributionChannel: 'short_content', contentVariant: 'short', personaId: 'official_account', taskSuffix: '六一儿童版' },
    ],
  },
  floor_heating: {
    brandLine: 'yanfami',
    accountLine: 'yanfami_official',
    sourceLine: 'yanfami_official',
    variants: [
      { accountLine: 'guoma970', accountType: 'hybrid', distributionChannel: 'short_content', contentVariant: 'short', roleVersion: 'guoma970', personaId: 'guoma970_content', taskSuffix: '果妈970地暖体验版' },
      { accountLine: 'yanfami_official', accountType: 'official', distributionChannel: 'official_account', contentVariant: 'article', roleVersion: 'official_account', personaId: 'official_account', taskSuffix: '官方地暖长文版' },
    ],
  },
  group_buy_material: {
    brandLine: 'guoshituan',
    accountLine: 'guoshituan_official',
    sourceLine: 'guoshituan_official',
    variants: [
      { accountLine: 'guoshituan_official', accountType: 'external_partner', distributionChannel: 'short_content', contentVariant: 'short', roleVersion: 'official_account', personaId: 'official_account', taskSuffix: '合作团购种草版' },
    ],
  },
  customer_followup: {
    brandLine: 'guoshituan',
    accountLine: 'guoshituan_official',
    sourceLine: 'guoshituan_official',
    variants: [],
  },
}

function appendDecisionLog(
  item: TaskBoardItem,
  action: DecisionLogEntry['action'],
  reason: string,
  detail: string,
  timestamp: string,
  extras?: Pick<DecisionLogEntry, 'memory_hit' | 'profile_rule' | 'template_id' | 'learning_key' | 'learning_score' | 'learning_rank' | 'learning_top_n' | 'learning_total_candidates' | 'attribution_source' | 'attribution_medium' | 'attribution_campaign' | 'attribution_content'>,
) {
  const exists = (item.decision_log ?? []).some((entry) => entry.action === action && entry.reason === reason && entry.detail === detail)
  if (exists) return
  item.decision_log = [...(item.decision_log ?? []), { timestamp, action, reason, detail, ...extras }]
  item.auto_decision_log = [...(item.auto_decision_log ?? []), detail]
  if (['retry', 'warning', 'need_human', 'notify_result'].includes(action)) {
    item.auto_action = action as NonNullable<TaskBoardItem['auto_action']>
  }
}

function buildLeadId(item: Pick<TaskBoardItem, 'task_name' | 'brand_line' | 'content_line' | 'timestamp'>) {
  return [item.brand_line ?? 'lead', item.content_line ?? 'task', toTaskId(item.task_name), new Date(item.timestamp ?? Date.now()).getTime()].join('_')
}

const CONSULTANT_DIRECTORY: Array<Pick<ConsultantRecord, 'consultant_id' | 'consultant_owner' | 'domain'>> = [
  { consultant_id: 'consultant_kotovela_floor_heating', consultant_owner: '顾问A', domain: 'floor_heating' },
  { consultant_id: 'consultant_yanfami_residential', consultant_owner: '顾问B', domain: 'layout_renovation' },
  { consultant_id: 'consultant_kotoharo_material', consultant_owner: '顾问C', domain: 'material_case' },
  { consultant_id: 'consultant_guoshituan_main', consultant_owner: '顾问D', domain: 'group_buy_material' },
  { consultant_id: 'consultant_official_account', consultant_owner: '顾问E', domain: 'customer_followup' },
  { consultant_id: 'consultant_business_default', consultant_owner: '顾问值班', domain: 'general' },
]

function inferConsultantPoolDomain(item: Pick<TaskBoardItem, 'content_line' | 'brand_line' | 'project_line'>) {
  if (item.content_line === 'floor_heating' || item.brand_line === 'kotovela') return 'floor_heating'
  if (item.content_line === 'material_case' || item.brand_line === 'kotoharo') return 'material_case'
  if (item.content_line === 'group_buy_material' || item.brand_line === 'guoshituan') return 'group_buy_material'
  if (item.content_line === 'layout_renovation' || item.brand_line === 'yanfami') return 'layout_renovation'
  if (item.content_line === 'customer_followup' || (item.project_line ?? '').includes('official_account')) return 'customer_followup'
  return 'general'
}

function buildConsultantRecords(board: TaskBoardItem[]): ConsultantRecord[] {
  return CONSULTANT_DIRECTORY.map((item) => {
    const related = board.filter((entry) => entry.consultant_id === item.consultant_id)
    const activeLoad = related.filter((entry) => !entry.converted && !entry.lost && !['done', 'success', 'cancelled', 'failed'].includes(entry.status ?? '')).length
    const converted = related.filter((entry) => entry.converted).length
    return {
      ...item,
      active_load: activeLoad,
      conversion_count: converted,
      assignment_count: related.length,
      status: activeLoad >= 3 ? 'busy' : 'available',
    }
  })
}

function inferConsultantId(item: Pick<TaskBoardItem, 'brand_line' | 'project_line' | 'account_line' | 'account_type' | 'content_line'>, board: TaskBoardItem[] = []) {
  if (item.account_type === 'external_partner') return undefined
  const poolDomain = inferConsultantPoolDomain(item)
  const consultants = buildConsultantRecords(board)
  const preferred = consultants.filter((entry) => entry.domain === poolDomain)
  const ranked = (preferred.length ? preferred : consultants).sort((a, b) => a.active_load - b.active_load || a.assignment_count - b.assignment_count)
  return ranked[0]?.consultant_id
}

function buildAttribution(item: Pick<TaskBoardItem, 'brand_line' | 'content_line' | 'project_line' | 'account_line' | 'task_name'>) {
  return {
    source: item.account_line ?? item.project_line ?? item.brand_line ?? 'unknown',
    medium: item.content_line === 'customer_followup' ? 'crm_followup' : item.content_line ?? 'task_board',
    campaign: item.brand_line ? `${item.brand_line}_${item.content_line ?? 'business'}` : item.project_line ?? 'general',
    content: toTaskId(item.task_name),
  }
}

function syncLeadAssignmentStatus(item: TaskBoardItem) {
  if (item.converted) {
    item.assignment_status = 'converted'
    return
  }
  if (item.lost) {
    item.assignment_status = 'lost'
    return
  }
  if (item.reassigned_to) {
    item.assignment_status = 'reassigned'
    return
  }
  item.assignment_status = item.consultant_id ? 'assigned' : 'pending'
}

async function ensureBusinessFields(item: TaskBoardItem, timestamp: string, board: TaskBoardItem[] = []) {
  if (item.type !== 'business_task' && item.domain !== 'business' && item.content_line !== 'customer_followup') return
  const previousLeadId = item.lead_id
  const previousConsultantId = item.consultant_id
  item.lead_id = item.lead_id ?? buildLeadId(item)
  item.attribution = { ...buildAttribution(item), ...(item.attribution ?? {}) }

  if (!previousLeadId && item.lead_id) {
    await appendAuditLog({
      action: 'lead_created',
      user: 'system',
      time: timestamp,
      target: item.lead_id,
      result: `lead created for ${item.task_name}`,
    })
  }

  appendDecisionLog(item, 'strategy_generate_task', 'lead_bound', `lead_id=${item.lead_id}`, timestamp, {
    attribution_source: item.attribution.source,
    attribution_medium: item.attribution.medium,
    attribution_campaign: item.attribution.campaign,
    attribution_content: item.attribution.content,
  })
  appendDecisionLog(item, 'strategy_generate_task', 'attribution_bound', `attribution=${item.attribution.source}/${item.attribution.medium}/${item.attribution.campaign}`, timestamp, {
    attribution_source: item.attribution.source,
    attribution_medium: item.attribution.medium,
    attribution_campaign: item.attribution.campaign,
    attribution_content: item.attribution.content,
  })

  if (!item.consultant_id) {
    const consultantId = inferConsultantId(item, board)
    if (consultantId) {
      item.consultant_id = consultantId
      item.assignment_mode = item.assignment_mode ?? 'auto'
      item.consultant_owner = CONSULTANT_DIRECTORY.find((entry) => entry.consultant_id === consultantId)?.consultant_owner
      appendDecisionLog(item, 'lead_auto_transfer', 'consultant_assigned', `consultant_id=${consultantId}`, timestamp, {
        attribution_source: item.attribution.source,
        attribution_medium: item.attribution.medium,
        attribution_campaign: item.attribution.campaign,
        attribution_content: item.attribution.content,
      })
    }
  }

  if (!previousConsultantId && item.consultant_id) {
    await appendAuditLog({
      action: 'consultant_assigned',
      user: 'system',
      time: timestamp,
      target: item.lead_id ?? item.task_name,
      result: `assigned to ${item.consultant_id}`,
    })
  }

  item.converted = item.converted ?? (item.status === 'done' || item.status === 'success')
  item.lost = item.lost ?? (item.status === 'cancelled' || item.status === 'failed')
  syncLeadAssignmentStatus(item)
}

function summarizeBusinessBoard(board: TaskBoardItem[]) {
  const businessItems = board.filter((item) => item.domain === 'business' || item.type === 'business_task' || item.content_line === 'customer_followup')
  const leads = businessItems.filter((item) => item.lead_id)
  const attributed = leads.filter((item) => item.attribution?.source && item.attribution?.medium && item.attribution?.campaign)
  return {
    total_leads: leads.length,
    assigned_consultants: leads.filter((item) => item.consultant_id).length,
    converted: leads.filter((item) => item.converted).length,
    lost: leads.filter((item) => item.lost).length,
    attributed: attributed.length,
  }
}

async function withTaskBoardLock<T>(work: () => Promise<T>) {
  const previous = taskBoardWriteQueue.catch(() => undefined)
  let release!: (value?: unknown) => void
  taskBoardWriteQueue = new Promise((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await work()
  } finally {
    release()
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

async function readContentLearningStore() {
  try {
    const raw = await fs.readFile(CONTENT_LEARNING_FILE, 'utf8')
    const payload = JSON.parse(raw) as { records?: ContentLearningRecord[] }
    contentLearningCache = payload.records ?? []
    return contentLearningCache
  } catch {
    await writeContentLearningStore([])
    contentLearningCache = []
    return []
  }
}

async function writeContentLearningStore(records: ContentLearningRecord[]) {
  contentLearningCache = records
  await fs.mkdir(path.dirname(CONTENT_LEARNING_FILE), { recursive: true })
  await fs.writeFile(CONTENT_LEARNING_FILE, `${JSON.stringify({ records }, null, 2)}\n`, 'utf8')
}

function toLearningKey(contentLine?: string, accountLine?: string, structureId?: string) {
  return [contentLine ?? '-', accountLine ?? '-', structureId ?? '-'].join('|')
}

function recomputeLearningScore(record: Pick<ContentLearningRecord, 'positive_count' | 'negative_count' | 'feedback_count' | 'avg_score'>) {
  if (record.feedback_count <= 0) return 0
  const positivity = (record.positive_count - record.negative_count) / Math.max(1, record.feedback_count)
  return Number((((record.avg_score / 5) * 0.7) + ((positivity + 1) / 2) * 0.3).toFixed(4))
}

function buildLearningIndex(records: ContentLearningRecord[]) {
  return new Map(records.map((record) => [record.key, record]))
}

function upsertLearningFeedback(
  records: ContentLearningRecord[],
  input: { content_line: string; account_line: string; structure_id: string; structure_type: string; score: number; sentiment?: 'positive' | 'negative' | 'neutral'; timestamp: string },
) {
  const key = toLearningKey(input.content_line, input.account_line, input.structure_id)
  const existing = records.find((record) => record.key === key)
  const nextScore = Math.max(1, Math.min(5, input.score))
  const feedbackCount = (existing?.feedback_count ?? 0) + 1
  const positiveCount = (existing?.positive_count ?? 0) + (input.sentiment === 'positive' || nextScore >= 4 ? 1 : 0)
  const negativeCount = (existing?.negative_count ?? 0) + (input.sentiment === 'negative' || nextScore <= 2 ? 1 : 0)
  const avgScore = Number((((existing?.avg_score ?? 0) * (existing?.feedback_count ?? 0) + nextScore) / feedbackCount).toFixed(4))
  const next: ContentLearningRecord = {
    key,
    content_line: input.content_line,
    account_line: input.account_line,
    structure_id: input.structure_id,
    structure_type: input.structure_type,
    impressions: Math.max(existing?.impressions ?? 0, feedbackCount),
    feedback_count: feedbackCount,
    positive_count: positiveCount,
    negative_count: negativeCount,
    avg_score: avgScore,
    learning_score: recomputeLearningScore({ positive_count: positiveCount, negative_count: negativeCount, feedback_count: feedbackCount, avg_score: avgScore }),
    last_feedback_at: input.timestamp,
    last_updated_at: input.timestamp,
  }
  if (existing) Object.assign(existing, next)
  else records.push(next)
  return next
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
  const learningBoost = typeof item.learning_score === 'number' && item.learning_score >= 0.75 ? -1 : 0
  return clampPriority((item.priority ?? basePriority) + learningBoost)
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

function detectContentLine(input: string, source?: Partial<TaskBoardSource>): Pick<ContentRouteDecision, 'contentLine' | 'lockedBy'> | null {
  const normalized = `${input} ${source?.title ?? ''} ${source?.chapter_title ?? ''} ${source?.core_points ?? ''}`.toLowerCase()
  if (['地暖', '采暖', '热系统'].some((keyword) => normalized.includes(keyword.toLowerCase()))) {
    return { contentLine: 'floor_heating', lockedBy: 'keyword' }
  }
  for (const rule of CONTENT_LINE_KEYWORDS) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return { contentLine: rule.line, lockedBy: 'keyword' }
    }
  }
  if (source?.source_type && CONTENT_LINE_SOURCE_MAP[source.source_type]) {
    return { contentLine: CONTENT_LINE_SOURCE_MAP[source.source_type], lockedBy: 'source_type' }
  }
  return null
}

function resolveMaterialCaseBrandLine(input: string, source?: Partial<TaskBoardSource>) {
  const text = `${input} ${source?.title ?? ''} ${source?.chapter_title ?? ''} ${source?.core_points ?? ''}`.toLowerCase()
  if (['地暖', '热系统'].some((keyword) => text.includes(keyword))) {
    return { brandLine: 'kotovela' as const, sourceLine: 'kotovela_official' }
  }
  if (['岩板', '建材', '品牌'].some((keyword) => text.includes(keyword))) {
    if (text.includes('果实团') || text.includes('guoshituan')) {
      return { brandLine: 'guoshituan' as const, sourceLine: 'guoshituan_official' }
    }
    return { brandLine: 'yanfami' as const, sourceLine: 'yanfami_official' }
  }
  return { brandLine: 'yanfami' as const, sourceLine: 'yanfami_official' }
}

function resolveContentRouteDecision(input: string, source?: Partial<TaskBoardSource>): ContentRouteDecision | null {
  const detected = detectContentLine(input, source)
  if (!detected) return null
  const route = CONTENT_ROUTE_MAP[detected.contentLine as Exclude<ContentLine, 'growth_record' | 'ai_tools'>]
  if (!route) return null

  const materialDecision = detected.contentLine === 'material_case'
    ? resolveMaterialCaseBrandLine(input, source)
    : null
  const allowedAccountLines = new Set(CONTENT_LINE_ALLOWED_ACCOUNT_LINES[detected.contentLine] ?? [])
  const variants = route.variants.filter((variant) => allowedAccountLines.has(variant.accountLine))

  return {
    contentLine: detected.contentLine,
    lockedBy: detected.lockedBy,
    brandLine: materialDecision?.brandLine ?? route.brandLine,
    accountLine: variants[0]?.accountLine ?? route.accountLine,
    sourceLine: source?.source_line ?? materialDecision?.sourceLine ?? route.sourceLine,
    variants,
  }
}

function buildContentTaskName(baseTitle: string, variant: ContentRouteDecision['variants'][number]) {
  return `${baseTitle} · ${variant.taskSuffix}`
}

function buildContentSourceText(source?: Partial<TaskBoardSource>, fallbackInput?: string) {
  return source?.core_points?.trim() || source?.title?.trim() || source?.chapter_title?.trim() || fallbackInput?.trim() || '待补充内容'
}

function buildBookRoleResult(item: TaskBoardItem, timestamp: string): NonNullable<TaskBoardItem['result']> | null {
  if (item.source?.source_type !== 'book_manuscript' || item.source?.source_project !== 'japanese_renovation_guide' || !item.role_version) return null

  const chapter = (item.source.chapter_title ?? item.source.title ?? item.task_name).trim()
  const core = item.source.core_points.trim()
  const lead = core.split(/\n+/).find(Boolean) ?? core
  const profileMap: Record<RoleVersion, { titlePrefix: string; hookPrefix: string; outlinePrefix: string[]; publishPrefix: string; personaId: PersonaProfile['persona_id']; tone: string; interaction: string }> = {
    yanfami_official: {
      titlePrefix: '言家 Yanfami｜日式装修落地指南',
      hookPrefix: '把书稿观点改成住宅客户听得懂、愿意咨询的表达。',
      outlinePrefix: ['本土化改造重点', '住宅落地误区', '适配户型建议'],
      publishPrefix: '【言家 Yanfami 内容运营版】',
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
    guoma970: {
      titlePrefix: '果妈970 Guoma970｜家的松弛感装修笔记',
      hookPrefix: '把书稿观点改成带生活感、能引发评论的内容。',
      outlinePrefix: ['生活场景共鸣', '踩坑提醒', '马上能做的小动作'],
      publishPrefix: '【果妈970运营版】',
      personaId: 'guoma970_content',
      tone: '陪伴分享型，强调真实生活体验',
      interaction: '引导评论区说出自己家里的困扰。',
    },
    mom970: {
      titlePrefix: '果妈970 Guoma970｜家的松弛感装修笔记',
      hookPrefix: '把书稿观点改成带生活感、能引发评论的内容。',
      outlinePrefix: ['生活场景共鸣', '踩坑提醒', '马上能做的小动作'],
      publishPrefix: '【果妈970运营版】',
      personaId: 'guoma970_content',
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
    persona: PERSONA_REGISTRY[profile.personaId === 'official_account' ? 'official_account' : profile.personaId === 'guoma970_content' ? 'guoma970' : 'openclaw_content'].persona,
    persona_id: profile.personaId,
    tone_style: profile.tone,
    interaction_style: profile.interaction,
    structure_type: profile.personaId === 'guoma970_content' ? 'hybrid' : 'official',
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
  const line = `${item.account_line ?? ''} ${item.project_line ?? ''} ${item.target_group_id ?? ''} ${item.subdomain ?? ''}`.toLowerCase()
  if (line.includes('mom970')) return PERSONA_REGISTRY.mom970
  if (line.includes('latin_boy')) return PERSONA_REGISTRY.latin_boy
  if (line.includes('chongming')) return PERSONA_REGISTRY.chongming
  if (item.account_type === 'official' || line.includes('official_account') || line.includes('kotoharo_official') || line.includes('yanfami_official') || line.includes('kotovela_official') || line.includes('guoshituan_official')) return PERSONA_REGISTRY.official_account
  return PERSONA_REGISTRY.openclaw_content
}

function buildContentStructureResult(item: TaskBoardItem, sourceTitle: string, sourceText: string): {
  structureId: string
  structureType: 'short_content' | 'article' | 'consult_content'
  sectionMap: Record<string, string>
  ctaPolicy: 'default' | 'consult_only' | 'planting_only'
  variantType: 'official' | 'personal' | 'hybrid'
  summary?: string
} {
  const line = item.content_line ?? 'layout_renovation'
  const variant = item.content_variant ?? 'short'
  const accountType = item.account_type ?? 'official'
  const isExternalPartner = accountType === 'external_partner'
  const snippet = sourceText.slice(0, 48)
  const ctaPolicy: 'default' | 'consult_only' | 'planting_only' = isExternalPartner || line === 'customer_followup' ? 'consult_only' : accountType === 'personal' ? 'planting_only' : 'default'
  const variantType: 'official' | 'personal' | 'hybrid' = accountType === 'external_partner' ? 'official' : accountType

  if (line === 'customer_followup') {
    return {
      structureId: 'consult_followup_v1',
      structureType: 'consult_content',
      sectionMap: {
        pain_point: `当前客户卡点：${snippet}`,
        solution_hint: '先缩小决策范围，再给一版低压力建议。',
        transfer_prompt: '如果你愿意，我可以按你的预算和时间节点继续细化下一步。',
      },
      ctaPolicy: 'consult_only' as const,
      variantType,
    }
  }

  const shortMap: Record<string, { id: string; summary: string; sections: [string, string][] }> = {
    layout_renovation: { id: 'layout_short_v1', summary: '问题 → 改造点 → 动线价值 → 引导', sections: [['hook', `户型问题别急着硬装，先看 ${sourceTitle} 里的真实动线冲突。`], ['common_mistake', '误区是只盯局部尺寸，不先看人怎么走。'], ['method', '改造点先聚焦通行、转身、收纳三个关键动作。'], ['action_prompt', '先圈出每天最堵的一步，再决定是否改墙、改柜、改门洞。'], ['interaction_question', '你家最想优先解决的是玄关、厨房还是客厅动线？']] },
    kitchen_storage: { id: 'kitchen_short_v1', summary: '场景 → 收纳误区 → 小方法 → 行动', sections: [['hook', `做饭高峰最乱的，往往不是东西太多，而是 ${sourceTitle} 没按使用顺序放。`], ['common_mistake', '误区是先买收纳盒，再想每天到底怎么拿。'], ['method', '把高频、低频、备货三层重新分区。'], ['action_prompt', '今天先只整理一个最常开的抽屉。'], ['interaction_question', '你厨房最常乱的是台面、吊柜还是转角？']] },
    material_case: { id: 'material_short_v1', summary: '产品点 → 为什么值得看 → 场景适配 → 提示', sections: [['hook', `${sourceTitle} 值不值得看，不只看参数，还要看它适不适合真实生活场景。`], ['common_mistake', '误区是只被单一卖点打动，忽略长期使用体验。'], ['method', '先看产品点，再看适配空间和维护成本。'], ['action_prompt', '把你家最核心的使用场景先写出来再选。'], ['interaction_question', '你更在意颜值、耐用还是后期打理？']] },
    floor_heating: { id: 'floor_heating_short_v1', summary: '痛点 → 舒适体验 → 技术点 → 适合谁', sections: [['hook', `地暖好不好，不是看热不热，而是 ${sourceTitle} 能不能稳定舒服。`], ['common_mistake', '误区是只问温度，不问热源、层高和维护逻辑。'], ['method', '先确认痛点，再看舒适体验背后的系统配置。'], ['action_prompt', '先列出你最担心的能耗、升温速度和适配户型。'], ['interaction_question', '你更担心费电、层高损失，还是后期维护？']] },
    group_buy_material: { id: 'group_buy_short_v1', summary: '为什么现在买 → 优势 → 名额/时机 → 引导', sections: [['hook', `现在看 ${sourceTitle}，关键不是便宜多少，而是这次时机值不值得你锁定。`], ['common_mistake', '误区是只看低价，不看交付边界和适配前提。'], ['method', '先看当前优势，再看名额节奏和咨询窗口。'], ['action_prompt', '先来问清适配范围，再决定要不要占位。'], ['interaction_question', '你更想先看价格机制，还是适配你家场景的建议？']] },
    ai_tools: { id: 'ai_tools_short_v1', summary: '痛点 → 工具演示 → 省事点 → 行动', sections: [['hook', `${sourceTitle} 真正省事的地方，不是炫技，而是把重复动作直接省掉。`], ['common_mistake', '误区是先研究功能表，反而没解决眼前问题。'], ['method', '先演示一个最小可用场景，再决定是否扩展。'], ['action_prompt', '先拿一个今天反复做的动作来试。'], ['interaction_question', '你最想让它帮你省掉哪一步？']] },
    growth_record: { id: 'growth_record_short_v1', summary: '生活瞬间 → 感受 → 互动提问', sections: [['hook', `今天这个小瞬间，让我重新想到 ${sourceTitle} 其实很值得记录。`], ['common_mistake', '很多人只记录结果，不记录当下感受。'], ['method', '先留住瞬间，再说一点真实体感。'], ['action_prompt', '把今天最想记住的一幕写下来。'], ['interaction_question', '你最近最想留住的一个生活瞬间是什么？']] },
  }

  const articleMap: Record<string, { id: string; summary: string; sections: [string, string][] }> = {
    layout_renovation: { id: 'layout_article_v1', summary: '户型问题 → 改造逻辑 → 案例 → 建议', sections: [['opening', `很多户型问题，不是面积小，而是 ${sourceTitle} 的动线没有被梳理清楚。`], ['problem', '先定位最影响日常效率的户型问题。'], ['analysis', '分析改造前后的使用逻辑差异。'], ['method', '按动线、收纳、采光三个层次给出方法。'], ['case_or_example', '用一个常见家庭案例说明怎么落地。'], ['conclusion', '先改最影响体验的一步，效果会比大拆大改更稳。'], ['CTA', ctaPolicy === 'consult_only' ? '如果你愿意，可以把户型发来，我帮你先做一轮判断。' : '想看你家户型适合怎么改，可以留言或咨询。']] },
    kitchen_storage: { id: 'kitchen_article_v1', summary: '生活场景 → 常见问题 → 收纳逻辑 → 方法', sections: [['opening', `${sourceTitle} 最终不是比谁柜子多，而是比谁做饭更顺手。`], ['problem', '先列出做饭、备餐、囤货最常见的混乱点。'], ['analysis', '把问题对应到动线和收纳层级。'], ['method', '按台面、抽屉、吊柜重排使用逻辑。'], ['case_or_example', '举一个三口之家厨房的调整案例。'], ['conclusion', '顺手感出来后，厨房会明显轻松。'], ['CTA', ctaPolicy === 'consult_only' ? '如果想看适不适合你家厨房，可以先来聊场景。' : '想让我继续拆你家厨房，也可以留言交流。']] },
    material_case: { id: 'material_article_v1', summary: '材料背景 → 使用场景 → 选择逻辑 → 案例', sections: [['opening', `${sourceTitle} 的价值，不在宣传词，而在真实使用场景里能不能成立。`], ['problem', '很多人选材料时只抓单点卖点。'], ['analysis', '把材料背景和实际使用条件对齐。'], ['method', '按预算、耐用、维护成本建立选择逻辑。'], ['case_or_example', '结合一个落地案例看取舍。'], ['conclusion', '选材先看匹配，再看参数。'], ['CTA', ctaPolicy === 'consult_only' ? '如果你想先判断适不适合你家，可以先咨询。' : '需要我继续拆材料适配逻辑，欢迎留言。']] },
    floor_heating: { id: 'floor_heating_article_v1', summary: '采暖问题 → 地暖方案 → 技术说明 → 适配人群', sections: [['opening', `${sourceTitle} 适不适合做地暖，先看采暖问题，不只看流行不流行。`], ['problem', '先明确舒适、能耗、层高之间的优先级。'], ['analysis', '拆清地暖方案背后的热源和系统逻辑。'], ['method', '按房型、使用频率、预算给出选择方法。'], ['case_or_example', '用一个典型家庭采暖案例说明差异。'], ['conclusion', '适合自己的系统，才是舒服且长期可控的方案。'], ['CTA', ctaPolicy === 'consult_only' ? '如果你想先判断适不适合装，可以先咨询。' : '想继续看不同户型的地暖适配，也可以留言。']] },
    group_buy_material: { id: 'group_buy_article_v1', summary: '选购背景 → 产品对比 → 团购理由 → 行动', sections: [['opening', `${sourceTitle} 这类团购内容，最怕只看价格，不看前提。`], ['problem', '很多人只盯折扣，却忽略适配和交付边界。'], ['analysis', '先做产品对比，再看这次团购的真正理由。'], ['method', '用适配条件、时机、名额节奏来判断是否值得参与。'], ['case_or_example', '举一个用户如何判断要不要占位的例子。'], ['conclusion', '先问清边界，再决定是否入场。'], ['CTA', '如果你想先判断这轮是否适合你，可以先来咨询。']] },
    ai_tools: { id: 'ai_tools_article_v1', summary: '问题背景 → 工具方案 → 用法 → 适用人群', sections: [['opening', `${sourceTitle} 最有价值的地方，是把高频重复动作替你接住。`], ['problem', '先明确今天最浪费时间的问题是什么。'], ['analysis', '把问题和工具方案一一对应。'], ['method', '用一个最小流程讲清怎么上手。'], ['case_or_example', '举一个真实省时场景做示例。'], ['conclusion', '先小范围验证，再决定扩展。'], ['CTA', ctaPolicy === 'consult_only' ? '如果想先看适不适合你的场景，可以先咨询。' : '想看我继续拆具体用法，可以留言。']] },
  }

  const selected = variant === 'article' ? articleMap[line] : shortMap[line]
  return {
    structureId: selected.id,
    structureType: (variant === 'article' ? 'article' : 'short_content') as 'article' | 'short_content',
    sectionMap: Object.fromEntries(selected.sections),
    ctaPolicy,
    variantType,
    summary: selected.summary,
  }
}

function selectStructureCandidate(
  item: TaskBoardItem,
  sourceTitle: string,
  sourceText: string,
  learningIndex: Map<string, ContentLearningRecord>,
) {
  const base = buildContentStructureResult(item, sourceTitle, sourceText)
  const candidates = [base]
  if (item.content_variant === 'short' && base.structureId !== 'growth_record_short_v1') {
    candidates.push({ ...base, structureId: 'growth_record_short_v1', summary: `${base.summary ?? ''} / 生活感补充结构` })
  }
  const scored = candidates
    .map((candidate, index) => {
      const learningKey = toLearningKey(item.content_line, item.account_line, candidate.structureId)
      const learned = learningIndex.get(learningKey)
      const learningScore = learned?.learning_score ?? 0
      const score = Number((0.55 + learningScore * 0.45 - index * 0.01).toFixed(4))
      return { ...candidate, learningKey, learningScore, score }
    })
    .sort((a, b) => b.score - a.score)
  return {
    selected: scored[0],
    topN: scored.slice(0, Math.min(3, scored.length)),
    totalCandidates: scored.length,
  }
}

function getPublishRhythm(item: TaskBoardItem) {
  const persona = resolvePersonaProfile(item)
  switch (persona.persona_id) {
    case 'guoma970_content':
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

function buildContentVariantResult(item: TaskBoardItem, now: string): NonNullable<TaskBoardItem['result']> | null {
  if (!item.content_line || !item.content_variant) return null
  const sourceText = buildContentSourceText(item.source, item.task_name)
  const sourceTitle = item.source?.title || item.source?.chapter_title || item.task_name
  const persona = item.content_variant === 'article' && item.account_type !== 'hybrid' && item.account_type !== 'personal'
    ? PERSONA_REGISTRY.official_account
    : resolvePersonaProfile(item)
  const selection = selectStructureCandidate(item, sourceTitle, sourceText, buildLearningIndex(contentLearningCache))
  const structure = selection.selected
  item.learning_score = structure.learningScore
  appendDecisionLog(item, 'strategy_generate_task', 'structure_selected', `structure_selected=${structure.structureId}`, now, {
    learning_key: structure.learningKey,
    learning_score: structure.learningScore,
    learning_rank: 1,
    learning_top_n: selection.topN.length,
    learning_total_candidates: selection.totalCandidates,
  })
  appendDecisionLog(item, 'strategy_generate_task', 'structure_variant_applied', `structure_variant_applied=${structure.variantType}`, now)
  appendDecisionLog(item, 'strategy_generate_task', 'cta_policy_applied', `cta_policy_applied=${structure.ctaPolicy}`, now)
  if (item.content_variant === 'short') {
    const outline = Object.entries(structure.sectionMap).map(([key, value]) => `${key}：${value}`)
    const title = `${sourceTitle}｜${item.content_line === 'kitchen_storage' ? '收纳短内容' : item.content_line === 'material_case' ? '案例短内容' : '短内容拆解'}`
    const hook = structure.sectionMap['hook'] ?? Object.values(structure.sectionMap)[0] ?? sourceTitle
    const script = outline.join('\n')
    return {
      type: 'text',
      content: [title, hook, ...outline, script].join('\n\n'),
      meta: { source_line: item.source_line, content_line: item.content_line, distribution_channel: item.distribution_channel, content_variant: item.content_variant, structure_id: structure.structureId, cta_policy: structure.ctaPolicy },
      title,
      hook,
      outline,
      structure: Object.keys(structure.sectionMap),
      script,
      publish_text: `${title}\n\n${outline.map((line, index) => `${index + 1}. ${line}`).join('\n')}\n\n${script}`,
      generated_at: now,
      generator: 'mock',
      persona: persona.persona,
      persona_id: persona.persona_id,
      tone_style: persona.tone_style,
      interaction_style: persona.interaction_style,
      structure_type: structure.structureType,
      structure_id: structure.structureId,
      section_map: structure.sectionMap,
      cta_policy: structure.ctaPolicy,
      structure_summary: structure.summary,
      publish_ready: true,
      archive_ready: true,
    }
  }

  const articleTitle = `${sourceTitle}｜${item.content_line === 'material_case' ? '案例深度拆解' : item.content_line === 'kitchen_storage' ? '收纳系统长文' : '公众号深度长文'}`
  const articleHook = structure.sectionMap['opening'] ?? '这不是单点技巧，而是一套完整梳理。'
  const outline = Object.entries(structure.sectionMap).map(([key, value]) => `${key}：${value}`)
  const fullArticle = outline.map((line, index) => `${index + 1}. ${line}`).join('\n\n')
  return {
    type: 'text',
    content: [articleTitle, articleHook, ...outline, fullArticle].join('\n\n'),
    meta: { source_line: item.source_line, content_line: item.content_line, distribution_channel: item.distribution_channel, content_variant: item.content_variant, structure_id: structure.structureId, cta_policy: structure.ctaPolicy },
    title: articleTitle,
    hook: articleHook,
    outline,
    structure: Object.keys(structure.sectionMap),
    script: fullArticle,
    full_article: fullArticle,
    publish_text: articleTitle,
    generated_at: now,
    generator: 'mock',
    persona: persona.persona,
    persona_id: persona.persona_id,
    tone_style: persona.tone_style,
    interaction_style: persona.interaction_style,
    structure_type: structure.structureType,
    structure_id: structure.structureId,
    section_map: structure.sectionMap,
    cta_policy: structure.ctaPolicy,
    structure_summary: structure.summary,
    publish_ready: true,
    archive_ready: true,
  }
}

function executeTask(item: TaskBoardItem, now: string): NonNullable<TaskBoardItem['result']> {
  const domain = item.domain ?? inferPool(item)
  const matchedTemplate = chooseTemplateForTask(item, templatePoolCache)
  const contentVariantResult = buildContentVariantResult(item, now)
  if (contentVariantResult) return contentVariantResult
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
    { role_version: 'yanfami_official', routeHint: '言家 Yanfami 官方 住宅 户型', title: `言家 Yanfami 官方版 · ${source.chapter_title}` },
    { role_version: 'official_account', routeHint: '公众号 推文 official_account', title: `公众号运营版 · ${source.chapter_title}` },
    { role_version: 'guoma970', routeHint: '果妈970 guoma970 mom970 内容 发布', title: `果妈970运营版 · ${source.chapter_title}` },
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
      brand_line: 'yanfami',
      brand_display: BRAND_DISPLAY_MAP.yanfami,
      account_line: spec.role_version === 'guoma970' ? 'guoma970' : 'yanfami_official',
      account_display: spec.role_version === 'guoma970' ? ACCOUNT_DISPLAY_MAP.guoma970 : ACCOUNT_DISPLAY_MAP.yanfami_official,
      account_type: spec.role_version === 'mom970' ? 'hybrid' : 'official',
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

function createContentRoutingTasks(input: string, now: string, source?: Partial<TaskBoardSource>) {
  const detected = detectContentLine(input, source)
  const decision = resolveContentRouteDecision(input, source)
  if (!detected || !decision) return null

  const routingText = `${input} ${source?.title ?? ''} ${source?.chapter_title ?? ''} ${source?.core_points ?? ''}`.toLowerCase()
  const hasFloorHeatingKeyword = ['地暖', '采暖', '热系统'].some((keyword) => routingText.includes(keyword.toLowerCase()))
  const hasMaterialKeyword = ['岩板', '建材', '品牌', '材料', '案例'].some((keyword) => routingText.includes(keyword.toLowerCase()))
  const conflictDecisionEntries: DecisionLogEntry[] = hasFloorHeatingKeyword && hasMaterialKeyword
    ? [
      { timestamp: now, action: 'conflict_detected', reason: 'content_line_conflict', detail: 'floor_heating vs material_case' },
      { timestamp: now, action: 'domain_locked_by_priority', reason: 'priority_rule_applied', detail: 'floor_heating > material_case' },
    ]
    : []

  const route = CONTENT_ROUTE_MAP[detected.contentLine as Exclude<ContentLine, 'growth_record' | 'ai_tools'>]
  const allowedAccountLines = new Set(CONTENT_LINE_ALLOWED_ACCOUNT_LINES[detected.contentLine] ?? [])
  const filteredAccountLines = (route?.variants ?? [])
    .map((variant) => variant.accountLine)
    .filter((accountLine) => !allowedAccountLines.has(accountLine))
  const invalidAccountFilteredEntries: DecisionLogEntry[] = filteredAccountLines.length > 0
    ? [{ timestamp: now, action: 'strategy_generate_task', reason: 'invalid_account_filtered', detail: `filtered_account_lines=${filteredAccountLines.join(',')}` }]
    : []

  const scenarioId = `content-line-${Date.now()}`
  const parentTaskId = `${scenarioId}:parent`
  const baseTitle = source?.title || source?.chapter_title || input.trim() || `内容路由任务-${Date.now()}`
  const normalizedSource: TaskBoardSource | undefined = source?.source_type
    ? {
      source_type: source.source_type,
      source_project: source.source_project ?? (source.source_type === 'book_manuscript' ? 'japanese_renovation_guide' : source.source_type === 'product_brochure' ? 'product_material_system' : 'case_library'),
      chapter_title: source.chapter_title,
      core_points: buildContentSourceText(source, input),
      title: source.title ?? baseTitle,
      source_line: decision.sourceLine,
    }
    : undefined

  if (decision.contentLine === 'customer_followup') {
    return [{
      task_name: `${baseTitle} · 客户跟进业务链`,
      agent: 'business',
      parent_task_id: parentTaskId,
      scenario_id: scenarioId,
      task_group_id: `${scenarioId}:business`,
      task_group_label: `${baseTitle} · customer_followup`,
      domain: 'business',
      subdomain: 'tech',
      project_line: decision.sourceLine,
      source_line: decision.sourceLine,
      brand_line: decision.brandLine,
      brand_display: BRAND_DISPLAY_MAP[decision.brandLine],
      content_line: decision.contentLine,
      account_line: 'guoshituan_official',
      account_display: ACCOUNT_DISPLAY_MAP.guoshituan_official,
      account_type: 'official',
      target_group_id: decision.sourceLine,
      notify_mode: 'default',
      preferred_agent: 'business',
      assigned_agent: 'business',
      target_system: 'openclaw-business',
      priority: 1,
      retry_count: 0,
      type: 'business_task',
      status: 'queued',
      timestamp: now,
      queued_at: now,
      updated_at: now,
      auto_generated: true,
      trigger_source: 'manual',
      auto_decision_log: [],
      decision_log: [
        { timestamp: now, action: 'strategy_generate_task', reason: 'content_line_detected', detail: `content_line=${decision.contentLine} / locked_by=${decision.lockedBy}` },
        ...conflictDecisionEntries,
        { timestamp: now, action: 'strategy_generate_task', reason: 'brand_selected', detail: `brand_line=${decision.brandLine} / brand_display=${BRAND_DISPLAY_MAP[decision.brandLine]}` },
        { timestamp: now, action: 'strategy_generate_task', reason: 'route_decision', detail: 'account_line=guoshituan_official / business_only=true' },
        { timestamp: now, action: 'strategy_generate_task', reason: 'account_selected', detail: 'account_line=business / account_type=official' },
        { timestamp: now, action: 'strategy_generate_task', reason: 'persona_applied', detail: `persona=${PERSONA_REGISTRY.official_account.persona_id}` },
        { timestamp: now, action: 'strategy_generate_task', reason: 'structure_applied', detail: 'structure_type=official' },
      ],
      source: normalizedSource,
      history: [{ action: 'create', operator: 'system', trigger_source: 'system', timestamp: now, status_after: 'queued', priority_after: 1 }],
    } satisfies TaskBoardItem]
  }

  if (decision.variants.length === 0) {
    return [{
      task_name: `${baseTitle} · 路由拦截`,
      agent: 'builder',
      parent_task_id: parentTaskId,
      scenario_id: scenarioId,
      task_group_id: `${scenarioId}:${decision.contentLine}:blocked`,
      task_group_label: `${baseTitle} · ${decision.contentLine} · blocked`,
      domain: 'builder',
      subdomain: 'content_route_blocked',
      project_line: decision.sourceLine,
      source_line: decision.sourceLine,
      brand_line: decision.brandLine,
      brand_display: BRAND_DISPLAY_MAP[decision.brandLine],
      content_line: decision.contentLine,
      priority: 0,
      retry_count: 0,
      type: 'content_task',
      status: 'blocked',
      timestamp: now,
      queued_at: now,
      updated_at: now,
      auto_generated: true,
      trigger_source: 'manual',
      auto_decision_log: [],
      decision_log: [
        { timestamp: now, action: 'strategy_generate_task', reason: 'content_line_detected', detail: `content_line=${decision.contentLine} / locked_by=${decision.lockedBy}` },
        ...conflictDecisionEntries,
        { timestamp: now, action: 'strategy_generate_task', reason: 'brand_selected', detail: `brand_line=${decision.brandLine} / brand_display=${BRAND_DISPLAY_MAP[decision.brandLine]}` },
        { timestamp: now, action: 'precheck_block', reason: 'route_blocked', detail: `content_line=${decision.contentLine} / allowed_account_lines=${[...allowedAccountLines].join(',') || 'none'}` },
        ...invalidAccountFilteredEntries,
      ],
      source: normalizedSource,
      history: [{ action: 'create', operator: 'system', trigger_source: 'system', timestamp: now, status_after: 'blocked', priority_after: 0 }],
    } satisfies TaskBoardItem]
  }

  return decision.variants.map((variant) => ({
    task_name: buildContentTaskName(baseTitle, variant),
    agent: variant.distributionChannel === 'official_account' ? 'business' : 'media',
    parent_task_id: parentTaskId,
    scenario_id: scenarioId,
    task_group_id: `${scenarioId}:${decision.contentLine}`,
    task_group_label: `${baseTitle} · ${decision.contentLine}`,
    domain: variant.distributionChannel === 'official_account' ? 'business' : 'media',
    subdomain: variant.distributionChannel === 'official_account' ? 'official_account' : variant.accountLine === 'chongming_storage' ? 'chongming_storage' : variant.accountLine === 'mom970' ? 'mom970' : variant.accountLine === 'latin_boy_guoguo' ? 'latin_boy_guoguo' : 'content',
    project_line: decision.sourceLine,
    source_line: decision.sourceLine,
    brand_line: decision.brandLine,
    brand_display: BRAND_DISPLAY_MAP[decision.brandLine],
    content_line: decision.contentLine,
    account_line: variant.accountLine,
    account_display: ACCOUNT_DISPLAY_MAP[variant.accountLine],
    account_type: variant.accountType,
    distribution_channel: variant.distributionChannel,
    content_variant: variant.contentVariant,
    target_group_id: variant.distributionChannel === 'official_account' ? 'official_account' : decision.sourceLine,
    notify_mode: 'default',
    preferred_agent: variant.distributionChannel === 'official_account' ? 'business' : 'media',
    assigned_agent: variant.distributionChannel === 'official_account' ? 'business' : 'media',
    target_system: variant.distributionChannel === 'official_account' ? 'openclaw-business' : 'openclaw-media',
    slot_id: null,
    priority: 1,
    retry_count: 0,
    type: 'content_task',
    status: 'queued',
    timestamp: now,
    queued_at: now,
    updated_at: now,
    auto_generated: true,
    trigger_source: 'manual',
    auto_decision_log: [],
    decision_log: [
      { timestamp: now, action: 'strategy_generate_task', reason: 'content_line_detected', detail: `content_line=${decision.contentLine} / locked_by=${decision.lockedBy}` },
      ...conflictDecisionEntries,
      { timestamp: now, action: 'strategy_generate_task', reason: 'brand_selected', detail: `brand_line=${decision.brandLine} / brand_display=${BRAND_DISPLAY_MAP[decision.brandLine]}` },
      { timestamp: now, action: 'strategy_generate_task', reason: 'route_decision', detail: `account_line=${variant.accountLine} / persona=${variant.personaId}` },
      { timestamp: now, action: 'strategy_generate_task', reason: 'account_selected', detail: `account_line=${variant.accountLine} / account_type=${variant.accountType}` },
      ...invalidAccountFilteredEntries,
      { timestamp: now, action: 'strategy_generate_task', reason: 'persona_applied', detail: `persona=${variant.personaId}` },
      { timestamp: now, action: 'strategy_generate_task', reason: 'structure_applied', detail: `structure_type=${variant.accountType}` },
      { timestamp: now, action: 'strategy_generate_task', reason: 'variant_generated', detail: `variant=${variant.contentVariant}` },
      { timestamp: now, action: 'strategy_generate_task', reason: 'channel_selected', detail: `channel=${variant.distributionChannel}` },
    ],
    source: normalizedSource,
    role_version: variant.roleVersion,
    history: [{ action: 'create', operator: 'system', trigger_source: 'system', timestamp: now, status_after: 'queued', priority_after: 1 }],
  } satisfies TaskBoardItem))
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
  const learningRecords = await readContentLearningStore()
  templatePoolCache = templateRecords
  contentLearningCache = learningRecords
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
    if (routed.content_line && routed.account_line && routed.result?.structure_id) {
      routed.learning_score = learningRecords.find((record) => record.key === toLearningKey(routed.content_line, routed.account_line, routed.result?.structure_id))?.learning_score
    }
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
  for (const item of payload.board) {
    const structureId = item.result?.structure_id
    if (!item.content_line || !item.account_line || !structureId || !isTaskDone(item.status)) continue
    const learned = learningRecords.find((record) => record.key === toLearningKey(item.content_line, item.account_line, structureId))
    if (learned) item.learning_score = learned.learning_score
  }
  await writeContentLearningStore(learningRecords)
  const scheduledPayload = applyScheduler(payload)
  scheduledPayload.template_pool = await syncTemplatePool(scheduledPayload.board)
  return scheduledPayload
}

function summarizeTaskBoard(payload: TaskBoardPayload) {
  payload.board = payload.board.map((item) => {
    const evidenceContext = inferTaskBoardEvidenceContext(item)
    item.projectId = item.projectId ?? evidenceContext.projectId
    item.agentId = item.agentId ?? evidenceContext.agentId
    item.roomId = item.roomId ?? evidenceContext.roomId
    item.taskId = item.taskId ?? evidenceContext.taskId
    item.routingHints = {
      ...evidenceContext.routingHints,
      ...(item.routingHints ?? {}),
    }
    if (!item.result) return item
    const assetType = item.result.asset_type
      ?? (item.domain === 'media' ? 'media' : item.domain === 'business' ? 'business' : item.domain === 'family' ? 'family' : 'generic')
    const hasPublishContent = Boolean(item.result.title || item.result.hook || item.result.script || item.result.publish_text)
    item.result = {
      ...item.result,
      asset_type: assetType,
      publish_ready: item.result.publish_ready ?? (item.content_line === 'customer_followup' ? false : hasPublishContent),
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
  const learningItems = payload.board.filter((item) => typeof item.learning_score === 'number')
  payload.learning_summary = {
    total_records: learningItems.length,
    avg_learning_score: Number((learningItems.reduce((sum, item) => sum + (item.learning_score ?? 0), 0) / Math.max(1, learningItems.length)).toFixed(4)),
    high_score_records: learningItems.filter((item) => (item.learning_score ?? 0) >= 0.75).length,
  }
  payload.business_summary = summarizeBusinessBoard(payload.board)
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

async function mutateTaskBoard<T>(filePath: string, work: (payload: TaskBoardPayload) => Promise<T>) {
  return withTaskBoardLock(async () => {
    const payload = await readTaskBoard(filePath)
    const result = await work(payload)
    payload.generated_at = new Date().toISOString()
    await writeTaskBoard(filePath, payload)
    const executed = await readTaskBoard(filePath)
    await writeTaskBoard(filePath, executed)
    return { result, payload: executed }
  })
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

async function applyManualTaskAction(target: TaskBoardItem, action: string, humanOwner: string, now: string) {
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
    if (target.domain === 'business' || target.type === 'business_task') {
      target.consultant_id = owner
      target.consultant_owner = owner
      target.assignment_mode = 'manual'
      syncLeadAssignmentStatus(target)
    }
    target.taken_over_at = now
    target.need_human = true
    target.priority = 0
    target.manual_decision = 'taken_over'
    appendManualDecision(target, 'manual_takeover', 'human_takeover', `已由 ${owner} 接管`, now)
    return
  }

  if (action === 'assign') {
    const owner = humanOwner || target.human_owner || 'builder'
    const previousConsultantId = target.consultant_id
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
    if (target.domain === 'business' || target.type === 'business_task') {
      target.consultant_id = owner
      target.consultant_owner = owner
      target.assignment_mode = 'manual'
      if (previousConsultantId && previousConsultantId !== owner) {
        target.reassigned_to = owner
        target.reassigned_at = now
        target.reassigned_reason = 'manual_assign'
      }
      syncLeadAssignmentStatus(target)
    }
    target.taken_over_at = now
    target.manual_decision = 'assigned'
    target.need_human = true
    target.priority = 0
    appendManualDecision(target, 'manual_assign', 'human_assign', `已指派给 ${owner}`, now)
    if (target.domain === 'business' || target.type === 'business_task') {
      await appendAuditLog({
        action: previousConsultantId === owner ? 'consultant_assigned' : 'consultant_reassigned',
        user: 'builder',
        time: now,
        target: target.lead_id ?? target.task_name,
        result: `assigned to ${owner}`,
      })
    }
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
    if (action === 'mark_manual_published') {
      await appendAuditLog({
        action: 'manual_publish',
        user: owner,
        time: now,
        target: target.task_name,
        result: 'manual publish recorded',
      })
    } else if (target.domain === 'business' || target.type === 'business_task') {
      await appendAuditLog({
        action: 'lead_update',
        user: owner,
        time: now,
        target: target.lead_id ?? target.task_name,
        result: 'lead marked done manually',
      })
    }
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
      devApiPlugin({
        consultants: {
          taskBoardFile: TASK_BOARD_FILE,
          readTaskBoard,
          summarizeTaskBoard,
          buildConsultantRecords,
        },
        isInternal,
        leadStats: {
          taskBoardFile: TASK_BOARD_FILE,
          readTaskBoard,
          summarizeTaskBoard,
          summarizeBusinessBoard,
        },
        leadUpdate: {
          taskBoardFile: TASK_BOARD_FILE,
          consultantDirectory: CONSULTANT_DIRECTORY,
          mutateTaskBoard,
          appendAuditLog,
          syncLeadAssignmentStatus,
        },
        leads: {
          taskBoardFile: TASK_BOARD_FILE,
          readTaskBoard,
          summarizeTaskBoard,
          buildTextResult,
          mutateTaskBoard,
          ensureBusinessFields,
        },
        memory: {
          readMemoryStore,
          writeMemoryStore,
          upsertMemoryRecord,
        },
        contentFeedback: {
          readContentLearningStore,
          writeContentLearningStore,
          upsertLearningFeedback,
        },
        profile: {
          readMemoryStore,
          deriveProfile,
        },
        tasksBoard: {
          taskBoardFile: TASK_BOARD_FILE,
          scenarioTemplates: SCENARIO_TEMPLATES,
          readTaskBoard,
          summarizeTaskBoard,
          readMemoryStore,
          createScenarioTemplateTasks,
          applyUserContextOnCreate,
          mutateTaskBoard,
          ensureBusinessFields,
          createContentRoutingTasks,
          createBookManuscriptTasks,
          inferTaskRoute,
          appendHistory,
          buildTextResult,
          applyManualTaskAction,
          clampPriority,
          priorityLabel,
          appendDecisionLog,
        },
      }),
      {
        name: 'pwa-html-by-mode',
        transformIndexHtml(html) {
          if (!isInternal) return html
          return html.replace('/manifest.demo.webmanifest', '/manifest.internal.webmanifest')
        },
      },
      {
        name: 'workbench-dev-api-inline',
        configureServer(server) {
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
