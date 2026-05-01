import { useEffect, useState } from 'react'
import { SystemTestResultPanel } from './DashboardAutoTaskCards'
import {
  AutoTaskExecutionView,
  AutoTaskOperationsView,
} from './DashboardAutoTaskOpsViews'
import { DashboardAutoTaskTaskCard } from './DashboardAutoTaskTaskCard'
import {
  AutoTaskDebugMainView,
  AutoTaskDebugProfileCard,
  AutoTaskDebugSidebar,
  AutoTaskRoutingView,
} from './DashboardAutoTaskViews'

type AutoTaskHistoryEntry = {
  action: string
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
  operator?: string
  before?: { status?: string; priority?: number }
  after?: { status?: string; priority?: number }
}

type AutoDecisionLogEntry = {
  timestamp: string
  action: 'retry' | 'warning' | 'need_human' | 'notify_result' | 'manual_takeover' | 'manual_assign' | 'manual_ignore' | 'manual_done' | 'manual_continue' | 'preempt' | 'priority_up' | 'priority_down' | 'strategy_generate_task' | 'risk_detected' | 'precheck_block' | 'lead_auto_transfer'
  reason: string
  detail: string
  publish_rhythm_hit?: string
  persona_hit?: string
  publish_risk_warning?: string[]
  memory_hit?: string
  profile_rule?: string
  template_id?: string
  route_target?: string
  route_result?: 'direct' | 'blocked' | 'transfer'
  account_type?: 'owned' | 'brand' | 'ip' | 'external_partner'
  tier?: 'L1' | 'L2' | 'L3'
  brand_display?: string
  mcn_display?: string
  can_close_deal?: boolean
  rule_hit_reason?: string
  whitelist_hit?: string
  block_reason?: string
  partner_mode?: 'content_only' | 'consult_only' | 'no_delivery'
}

export type TemplatePoolEntry = {
  template_id: string
  domain: string
  asset_type: 'script' | 'reply' | 'plan' | 'generic'
  content: string
  source_task_id: string
  source_task_name?: string
  use_count: number
  created_at: string
  updated_at: string
}

export type UserProfile = {
  user_id: string
  tags: string[]
  preferences: Record<string, unknown>
  behavior_patterns: Record<string, unknown>
}

type AutoTaskSource = {
  source_type: 'book_manuscript' | 'product_brochure' | 'case_booklet'
  source_project: 'japanese_renovation_guide' | 'product_material_system' | 'case_library'
  chapter_title?: string
  core_points: string
  title?: string
}

type AccountType = 'owned' | 'brand' | 'ip' | 'external_partner'
type ChannelTier = 'L1' | 'L2' | 'L3'
type RouteResult = 'direct' | 'blocked' | 'transfer'

type ExternalPartnerMode = 'content_only' | 'consult_only' | 'no_delivery'

export type AutoTaskBoardItem = {
  task_name: string
  agent: string
  parent_task_id?: string
  scenario_id?: string
  task_group_id?: string
  task_group_label?: string
  template_key?:
    | 'family_study_evening'
    | 'media_publish_flow'
    | 'business_followup_flow'
    | 'builder_delivery_flow'
    | 'media_publish_with_distribution'
    | 'business_quote_with_materials'
  template_source?: string
  template_task_index?: number
  domain?: string
  subdomain?: string
  project_line?: string
  source_line?: string
  brand_line?: 'kotovela' | 'yanfami' | 'kotoharo' | 'guoshituan'
  brand_display?: string
  mcn_line?: 'self_operated' | 'kotovela_mcn' | 'yanfami_mcn' | 'partner_network'
  mcn_display?: string
  content_line?: 'layout_renovation' | 'kitchen_storage' | 'material_case' | 'floor_heating' | 'group_buy_material' | 'customer_followup' | 'growth_record' | 'ai_tools'
  account_line?: 'yanfami_official' | 'kotoharo_official' | 'kotovela_official' | 'guoshituan_official' | 'guoma970' | 'latin_boy_guoguo' | 'luyi_children' | 'chongming_storage' | 'openclaw' | 'mom970'
  account_display?: string
  account_type?: AccountType | 'official' | 'personal' | 'hybrid'
  tier?: ChannelTier
  distribution_channel?: 'short_content' | 'official_account'
  content_variant?: 'short' | 'article'
  target_group_id?: string
  notify_mode?: 'default' | 'need_human' | 'confirm' | 'assigned' | 'reminder'
  preferred_agent?: string
  assigned_agent?: string
  target_system?: string
  slot_id?: string | null
  instance_pool?: 'builder' | 'media' | 'family' | 'business' | 'personal'
  priority: number
  status: string
  auto_generated?: boolean
  trigger_source?: 'habit' | 'inactivity' | 'schedule' | 'manual' | 'system' | 'rule_engine'
  predicted_risk?: 'low' | 'medium' | 'high'
  predicted_block?: boolean
  type: string
  code_snippet?: string
  retry_count?: number
  timestamp?: string
  control_status?: string
  updated_at?: string
  history?: AutoTaskHistoryEntry[]
  attention?: boolean
  stuck?: boolean
  abnormal?: boolean
  auto_decision_log?: string[]
  decision_log?: AutoDecisionLogEntry[]
  need_human?: boolean
  human_owner?: string
  taken_over_at?: string
  manual_decision?: 'taken_over' | 'assigned' | 'ignored' | 'done' | 'continue'
  auto_action?: 'retry' | 'warning' | 'need_human' | 'notify_result'
  queued_at?: string
  slot_active?: boolean
  health?: 'healthy' | 'warning' | 'critical'
  source?: AutoTaskSource
  role_version?: 'yanfami_official' | 'official_account' | 'guoma970' | 'mom970'
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
    persona_id?: string
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
  route_result?: RouteResult
  route_target?: string
  can_close_deal?: boolean
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
}

type ContentLearningRecord = {
  key: string
  content_line: string
  account_line: string
  structure_id: string
  structure_type: string
  feedback_count: number
  avg_score: number
  learning_score: number
}

type AutoTaskBoardPayload = {
  total: number
  success: number
  failed: number
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
    result: NonNullable<AutoTaskBoardItem['result']>
  }>
  current_user_id?: string
  current_profile?: UserProfile
  template_pool?: TemplatePoolEntry[]
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
  board: AutoTaskBoardItem[]
}

const BRAND_LABELS: Record<NonNullable<AutoTaskBoardItem['brand_line']>, string> = {
  kotovela: 'KOTOVELA',
  yanfami: 'YANFAMI',
  kotoharo: 'KOTOHARO',
  guoshituan: '果实团',
}

const MCN_LABELS: Record<NonNullable<AutoTaskBoardItem['mcn_line']>, string> = {
  self_operated: '自营矩阵',
  kotovela_mcn: 'KOTOVELA MCN',
  yanfami_mcn: 'YANFAMI MCN',
  partner_network: '合作分发网络',
}

function normalizeAccountType(item: AutoTaskBoardItem): AccountType {
  if (item.account_type === 'owned' || item.account_type === 'brand' || item.account_type === 'ip' || item.account_type === 'external_partner') {
    return item.account_type
  }
  if (item.account_type === 'official') return 'owned'
  if (item.account_type === 'hybrid') return 'brand'
  if (item.account_type === 'personal') return 'ip'
  if ((item.account_line ?? '').includes('official')) return 'owned'
  return 'ip'
}

function normalizeTier(item: AutoTaskBoardItem): ChannelTier {
  if (item.tier === 'L1' || item.tier === 'L2' || item.tier === 'L3') return item.tier
  if (item.distribution_channel === 'official_account') return 'L1'
  if ((item.account_line ?? '').includes('official')) return 'L1'
  if (item.distribution_channel === 'short_content') return 'L2'
  return 'L3'
}

function isLeadTask(item: AutoTaskBoardItem) {
  const target = [item.task_name, item.domain, item.subdomain, item.project_line, item.source_line, item.type].filter(Boolean).join(' ').toLowerCase()
  return ['lead', 'clue', 'business', 'followup', 'quote', 'crm', '成交', '转单', '商机', '报价', '跟进'].some((keyword) => target.includes(keyword.toLowerCase()))
}

function appendDecisionLog(item: AutoTaskBoardItem, entry: AutoDecisionLogEntry): AutoDecisionLogEntry[] {
  const signature = `${entry.action}|${entry.reason}|${entry.detail}|${entry.route_target ?? ''}`
  const existed = (item.decision_log ?? []).some((current) => `${current.action}|${current.reason}|${current.detail}|${current.route_target ?? ''}` === signature)
  return existed ? (item.decision_log ?? []) : [...(item.decision_log ?? []), entry]
}

function enrichBoardItem(item: AutoTaskBoardItem): AutoTaskBoardItem {
  const accountType = normalizeAccountType(item)
  const tier = normalizeTier(item)
  const brandDisplay = item.brand_display ?? (item.brand_line ? BRAND_LABELS[item.brand_line] : undefined)
  const mcnLine = item.mcn_line ?? (accountType === 'external_partner' ? 'partner_network' : 'self_operated')
  const mcnDisplay = item.mcn_display ?? MCN_LABELS[mcnLine]
  const leadTask = isLeadTask(item)
  const canCloseDeal = accountType !== 'external_partner'
  const partnerMode: ExternalPartnerMode | undefined = accountType === 'external_partner'
    ? (leadTask ? 'consult_only' : item.domain === 'media' ? 'content_only' : 'no_delivery')
    : undefined
  let routeResult: RouteResult = item.route_result ?? 'direct'
  let routeTarget = item.route_target ?? (leadTask ? 'business.lead_router' : item.assigned_agent ?? item.target_system ?? item.instance_pool ?? 'direct')
  let nextItem: AutoTaskBoardItem = {
    ...item,
    account_type: accountType,
    tier,
    brand_display: brandDisplay,
    mcn_line: mcnLine,
    mcn_display: mcnDisplay,
    can_close_deal: canCloseDeal,
  }

  if (!canCloseDeal) {
    routeResult = leadTask ? 'transfer' : 'blocked'
    routeTarget = leadTask ? 'business.lead_router' : 'manual_review.required'
    nextItem = {
      ...nextItem,
      route_result: routeResult,
      route_target: routeTarget,
      predicted_block: leadTask ? nextItem.predicted_block : true,
      need_human: leadTask ? true : (nextItem.need_human ?? true),
      auto_action: 'need_human',
      assigned_agent: leadTask ? 'business' : nextItem.assigned_agent,
      instance_pool: leadTask ? 'business' : nextItem.instance_pool,
      target_system: routeTarget,
      blocked_by: leadTask ? nextItem.blocked_by : Array.from(new Set([...(nextItem.blocked_by ?? []), 'external_partner_deal_restricted'])),
    }

    nextItem.decision_log = appendDecisionLog(nextItem, {
      timestamp: nextItem.updated_at ?? nextItem.timestamp ?? new Date().toISOString(),
      action: leadTask ? 'lead_auto_transfer' : 'precheck_block',
      reason: leadTask ? 'external_partner lead 自动转单' : 'external_partner 禁止成交',
      detail: leadTask ? `Lead 已自动转交至 ${routeTarget}` : '该账号类型不允许直接成交，已拦截',
      route_target: routeTarget,
      route_result: routeResult,
      account_type: accountType,
      tier,
      brand_display: brandDisplay,
      mcn_display: mcnDisplay,
      can_close_deal: canCloseDeal,
      rule_hit_reason: 'external_partner account_type 命中专属路由规则',
      whitelist_hit: leadTask ? 'lead_transfer_whitelist' : undefined,
      block_reason: leadTask ? undefined : 'external_partner_deal_restricted',
      partner_mode: partnerMode,
    })
  } else {
    nextItem.decision_log = appendDecisionLog(nextItem, {
      timestamp: nextItem.updated_at ?? nextItem.timestamp ?? new Date().toISOString(),
      action: 'notify_result',
      reason: 'standard routing direct pass',
      detail: `按标准路由直达 ${routeTarget}`,
      route_target: routeTarget,
      route_result: routeResult,
      account_type: accountType,
      tier,
      brand_display: brandDisplay,
      mcn_display: mcnDisplay,
      can_close_deal: canCloseDeal,
      rule_hit_reason: 'standard route matrix',
      whitelist_hit: item.route_result === 'direct' ? 'default_delivery' : undefined,
    })
    nextItem.route_result = routeResult
    nextItem.route_target = routeTarget
  }

  return nextItem
}

function enrichBoardPayload(payload: AutoTaskBoardPayload): AutoTaskBoardPayload {
  const board = (payload.board ?? []).map(enrichBoardItem)
  return {
    ...payload,
    board,
    total: payload.total ?? board.length,
  }
}

export type PublishCenterEntry = {
  taskName: string
  domain: string
  assetType: 'media' | 'business' | 'family' | 'generic'
  updatedAt?: string
  source?: AutoTaskSource
  roleVersion?: AutoTaskBoardItem['role_version']
  brandLine?: AutoTaskBoardItem['brand_line']
  brandDisplay?: AutoTaskBoardItem['brand_display']
  mcnDisplay?: AutoTaskBoardItem['mcn_display']
  contentLine?: AutoTaskBoardItem['content_line']
  accountLine?: AutoTaskBoardItem['account_line']
  accountDisplay?: AutoTaskBoardItem['account_display']
  accountType?: AutoTaskBoardItem['account_type']
  tier?: AutoTaskBoardItem['tier']
  routeResult?: AutoTaskBoardItem['route_result']
  routeTarget?: AutoTaskBoardItem['route_target']
  canCloseDeal?: AutoTaskBoardItem['can_close_deal']
  distributionChannel?: AutoTaskBoardItem['distribution_channel']
  contentVariant?: AutoTaskBoardItem['content_variant']
  sourceLine?: AutoTaskBoardItem['source_line']
  result: NonNullable<AutoTaskBoardItem['result']>
}

export type ArchiveCenterEntry = {
  taskName: string
  domain: string
  assetType: 'media' | 'business' | 'family' | 'generic'
  updatedAt?: string
  source?: AutoTaskSource
  roleVersion?: AutoTaskBoardItem['role_version']
  brandLine?: AutoTaskBoardItem['brand_line']
  brandDisplay?: AutoTaskBoardItem['brand_display']
  mcnDisplay?: AutoTaskBoardItem['mcn_display']
  contentLine?: AutoTaskBoardItem['content_line']
  accountLine?: AutoTaskBoardItem['account_line']
  accountDisplay?: AutoTaskBoardItem['account_display']
  accountType?: AutoTaskBoardItem['account_type']
  tier?: AutoTaskBoardItem['tier']
  routeResult?: AutoTaskBoardItem['route_result']
  routeTarget?: AutoTaskBoardItem['route_target']
  canCloseDeal?: AutoTaskBoardItem['can_close_deal']
  distributionChannel?: AutoTaskBoardItem['distribution_channel']
  contentVariant?: AutoTaskBoardItem['content_variant']
  sourceLine?: AutoTaskBoardItem['source_line']
  result: NonNullable<AutoTaskBoardItem['result']>
}

const DONE_TASK_STATUSES = ['done', 'success', 'cancelled']

function normalizeAssetType(item: AutoTaskBoardItem): PublishCenterEntry['assetType'] {
  if (item.result?.asset_type) return item.result.asset_type
  if (item.domain === 'media') return 'media'
  if (item.domain === 'business') return 'business'
  if (item.domain === 'family') return 'family'
  return 'generic'
}

function buildPublishCenterEntries(board: AutoTaskBoardItem[]): PublishCenterEntry[] {
  return board
    .filter((item) => item.result && DONE_TASK_STATUSES.includes(item.status) && item.result.publish_ready !== false)
    .map((item) => ({
      taskName: item.task_name,
      domain: item.domain ?? 'unknown',
      assetType: normalizeAssetType(item),
      updatedAt: item.updated_at ?? item.timestamp,
      source: item.source,
      roleVersion: item.role_version,
      brandLine: item.brand_line,
      brandDisplay: item.brand_display,
      mcnDisplay: item.mcn_display,
      contentLine: item.content_line,
      accountLine: item.account_line,
      accountDisplay: item.account_display,
      accountType: item.account_type,
      tier: item.tier,
      routeResult: item.route_result,
      routeTarget: item.route_target,
      canCloseDeal: item.can_close_deal,
      distributionChannel: item.distribution_channel,
      contentVariant: item.content_variant,
      sourceLine: item.source_line,
      result: {
        ...item.result!,
        asset_type: normalizeAssetType(item),
      },
    }))
}

function buildArchiveCenterEntries(board: AutoTaskBoardItem[]): ArchiveCenterEntry[] {
  return board
    .filter((item) => item.result && DONE_TASK_STATUSES.includes(item.status) && item.result.archive_ready !== false)
    .map((item) => ({
      taskName: item.task_name,
      domain: item.domain ?? 'unknown',
      assetType: normalizeAssetType(item),
      updatedAt: item.updated_at ?? item.timestamp,
      source: item.source,
      roleVersion: item.role_version,
      brandLine: item.brand_line,
      brandDisplay: item.brand_display,
      mcnDisplay: item.mcn_display,
      contentLine: item.content_line,
      accountLine: item.account_line,
      accountDisplay: item.account_display,
      accountType: item.account_type,
      tier: item.tier,
      routeResult: item.route_result,
      routeTarget: item.route_target,
      canCloseDeal: item.can_close_deal,
      distributionChannel: item.distribution_channel,
      contentVariant: item.content_variant,
      sourceLine: item.source_line,
      result: item.result!,
    }))
}

export type TaskNotificationItem = {
  id: string
  event_type: 'task_queued' | 'task_done' | 'task_failed' | 'task_warning' | 'task_need_human'
  task_id?: string
  task_name: string
  domain: string
  subdomain?: string
  project_line?: string
  target_group_id?: string
  notify_mode?: 'default' | 'need_human' | 'confirm' | 'assigned' | 'reminder'
  assigned_agent: string
  status: string
  summary: string
  target_group: string
  scheduler_hint: string
  created_at: string
  delivery: 'mock' | 'webhook'
  message?: string
}

type FailedTaskState = {
  taskName: string
  status: 'failed'
  message: string
  retryCount: number
  autoRetrying?: boolean
}

const scenarioTemplates: Array<{
  key:
    | 'family_study_evening'
    | 'media_publish_flow'
    | 'business_followup_flow'
    | 'builder_delivery_flow'
    | 'media_publish_with_distribution'
    | 'business_quote_with_materials'
  label: string
  description: string
}> = [
  { key: 'media_publish_with_distribution', label: 'media_publish_with_distribution', description: '跨域发布 + 分发 + 落地页' },
  { key: 'business_quote_with_materials', label: 'business_quote_with_materials', description: '跨域报价 + 物料 + 家庭确认' },
  { key: 'family_study_evening', label: 'family_study_evening', description: '晚间学习任务链' },
  { key: 'media_publish_flow', label: 'media_publish_flow', description: '内容发布任务链' },
  { key: 'business_followup_flow', label: 'business_followup_flow', description: '客户跟进任务链' },
  { key: 'builder_delivery_flow', label: 'builder_delivery_flow', description: '研发交付任务链' },
]

export function AutoTaskSystemPanel() {
  const [data, setData] = useState<AutoTaskBoardPayload | null>(null)
  const [learningRecords, setLearningRecords] = useState<ContentLearningRecord[]>([])
  const [notifications, setNotifications] = useState<TaskNotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'operations' | 'execution' | 'routing' | 'debug'>('operations')
  const [activePool, setActivePool] = useState<'builder' | 'media' | 'family' | 'business' | 'personal'>('builder')
  const [taskInput, setTaskInput] = useState('')
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [failedTask, setFailedTask] = useState<FailedTaskState | null>(null)
  const [runningTaskName, setRunningTaskName] = useState('')
  const [autoRetryState, setAutoRetryState] = useState<{ taskName: string; retryCount: number } | null>(null)
  const [controlLoadingTask, setControlLoadingTask] = useState('')
  const [expandedTaskName, setExpandedTaskName] = useState('')
  const [copyState, setCopyState] = useState('')
  const [activeNoticeDomain, setActiveNoticeDomain] = useState<'builder' | 'media' | 'family' | 'business'>('builder')
  const [activeTemplateKey, setActiveTemplateKey] = useState<
    | 'family_study_evening'
    | 'media_publish_flow'
    | 'business_followup_flow'
    | 'builder_delivery_flow'
    | 'media_publish_with_distribution'
    | 'business_quote_with_materials'
  >('media_publish_with_distribution')

  const loadBoard = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/tasks-board', { cache: 'no-store' }).then((res) => res.json() as Promise<AutoTaskBoardPayload>),
      fetch('/api/task-notifications', { cache: 'no-store' })
        .then((res) => res.json() as Promise<{ notifications?: TaskNotificationItem[] }>)
        .catch(() => ({ notifications: [] })),
      fetch('/api/content-feedback', { cache: 'no-store' })
        .then((res) => res.json() as Promise<{ records?: ContentLearningRecord[] }>)
        .catch(() => ({ records: [] })),
    ])
      .then(([json, notifyJson, learningJson]) => {
        setData(enrichBoardPayload(json))
        setNotifications(notifyJson.notifications ?? [])
        setLearningRecords(learningJson.records ?? [])
      })
      .catch(() => {
        setData(null)
        setNotifications([])
        setLearningRecords([])
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadBoard()
    const timer = window.setInterval(loadBoard, 3000)
    return () => window.clearInterval(timer)
  }, [])

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const executeTask = async (input: string, options?: { silentFailure?: boolean }) => {
    if (!input || running) return
    setRunning(true)
    setRunningTaskName(input)
    setRunError('')
    setFailedTask(null)
    try {
      const res = await fetch('/api/tasks-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || data?.error || '执行失败')
      }
      setTaskInput('')
      loadBoard()
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      setRunError(message)
      if (!options?.silentFailure) {
        setFailedTask({
          taskName: input,
          status: 'failed',
          message,
          retryCount: autoRetryState?.taskName === input ? autoRetryState.retryCount : 0,
        })
      }
      throw error instanceof Error ? error : new Error(message)
    } finally {
      setRunning(false)
      setRunningTaskName('')
    }
  }

  const createScenarioTemplate = async () => {
    if (running) return
    setRunning(true)
    setRunningTaskName(activeTemplateKey)
    setRunError('')
    setFailedTask(null)
    try {
      const res = await fetch('/api/tasks-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_key: activeTemplateKey }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || data?.error || '模板创建失败')
      }
      loadBoard()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '模板创建失败')
    } finally {
      setRunning(false)
      setRunningTaskName('')
    }
  }

  const autoRetryTask = async (taskName: string, baseMessage: string) => {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      setAutoRetryState({ taskName, retryCount: attempt })
      setFailedTask({ taskName, status: 'failed', message: baseMessage, retryCount: attempt, autoRetrying: true })
      await wait(2000)
      try {
        await executeTask(taskName, { silentFailure: true })
        setFailedTask(null)
        setAutoRetryState(null)
        loadBoard()
        return
      } catch {
        // continue to next retry
      }
    }

    setFailedTask({ taskName, status: 'failed', message: baseMessage, retryCount: 2, autoRetrying: false })
    setAutoRetryState(null)
  }

  const runTask = async () => {
    const input = taskInput.trim()
    if (!input || running) return
    try {
      await executeTask(input)
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      await autoRetryTask(input, message)
    }
  }

  const retryTask = async (taskName: string) => {
    if (running || autoRetryState) return
    try {
      await executeTask(taskName)
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      await autoRetryTask(taskName, message)
    }
  }

  const controlTask = async (taskName: string, action: 'pause' | 'resume' | 'cancel' | 'priority_up' | 'priority_down') => {
    if (running || autoRetryState || controlLoadingTask) return
    setControlLoadingTask(`${taskName}:${action}`)
    try {
      const res = await fetch('/api/tasks-board', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_name: taskName, action }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || err?.error || '操作失败')
      }
      setData(enrichBoardPayload((await res.json()) as AutoTaskBoardPayload))
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '操作失败')
    } finally {
      setControlLoadingTask('')
    }
  }

  const manualControlTask = async (taskName: string, action: 'takeover' | 'assign' | 'ignore' | 'manual_done' | 'manual_continue' | 'mark_manual_published') => {
    if (running || autoRetryState || controlLoadingTask) return
    const humanOwner = action === 'assign'
      ? window.prompt('请输入指派人', 'builder')?.trim()
      : action === 'takeover' || action === 'ignore' || action === 'manual_done' || action === 'manual_continue' || action === 'mark_manual_published'
        ? 'builder'
        : ''
    if (action === 'assign' && !humanOwner) return
    setControlLoadingTask(`${taskName}:${action}`)
    try {
      const res = await fetch('/api/tasks-board', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_name: taskName, action, human_owner: humanOwner }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || err?.error || '操作失败')
      }
      setData(enrichBoardPayload((await res.json()) as AutoTaskBoardPayload))
      loadBoard()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '操作失败')
    } finally {
      setControlLoadingTask('')
    }
  }

  const markTemplateSource = async (taskName: string) => {
    if (running || autoRetryState || controlLoadingTask) return
    setControlLoadingTask(`${taskName}:mark_template_source`)
    try {
      const res = await fetch('/api/tasks-board', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_name: taskName, action: 'mark_template_source' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || err?.error || '标记失败')
      }
      setData(enrichBoardPayload((await res.json()) as AutoTaskBoardPayload))
      loadBoard()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '标记失败')
    } finally {
      setControlLoadingTask('')
    }
  }

  const groupNotificationAction = async (
    notice: TaskNotificationItem,
    action: 'done' | 'continue' | 'transfer',
  ) => {
    if (running || autoRetryState || controlLoadingTask) return
    const humanOwner = action === 'transfer' ? window.prompt('请输入转人工负责人', notice.assigned_agent || 'builder')?.trim() : (notice.assigned_agent || 'builder')
    if (action === 'transfer' && !humanOwner) return
    setControlLoadingTask(`${notice.task_name}:group:${action}`)
    try {
      const res = await fetch('/api/task-notification-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_action: action,
          task_id: notice.task_id,
          task_name: notice.task_name,
          domain: notice.domain,
          assigned_agent: notice.assigned_agent,
          human_owner: humanOwner,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || err?.error || '群动作回写失败')
      }
      loadBoard()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '群动作回写失败')
    } finally {
      setControlLoadingTask('')
    }
  }

  const poolTabs = data?.pools ?? []
  const normalizedActivePool = poolTabs.some((pool) => pool.key === activePool) ? activePool : (poolTabs[0]?.key ?? 'builder')
  const sortedBoard = [...(data?.board ?? [])].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
  const templatePool = data?.template_pool ?? []
  const humanPendingTasks = sortedBoard.filter((item) => item.need_human)
  const poolBoard = sortedBoard.filter((item) => (item.instance_pool ?? 'builder') === normalizedActivePool)
  const runningTasks = poolBoard.filter((item) => ['doing', 'running'].includes(item.status))
  const queuedTasks = poolBoard.filter((item) => ['todo', 'queued', 'queue', 'pending', 'preparing'].includes(item.status))
  const blockedTasks = queuedTasks.filter((item) => (item.blocked_by?.length ?? 0) > 0)
  const blockedPoolTasks = poolBoard.filter((item) => item.status === 'blocked' || (item.blocked_by?.length ?? 0) > 0 || item.predicted_block)
  const pausedTasks = poolBoard.filter((item) => ['paused', 'pause'].includes(item.status))
  const doneTasks = poolBoard.filter((item) => ['success', 'done', 'cancelled', 'failed'].includes(item.status))
  const needHumanPoolTasks = poolBoard.filter((item) => item.need_human)
  const failedTasks = sortedBoard.filter((item) => item.status === 'failed')
  const abnormalTasks = sortedBoard.filter((item) => item.abnormal || item.attention)
  const stuckTasks = sortedBoard.filter((item) => item.stuck)
  const continuousFailedTasks = failedTasks.filter((item) => {
    const lastEntries = [...(item.history ?? [])].slice(-2)
    return lastEntries.length >= 2 && lastEntries.every((entry) => entry.action === 'fail' || entry.status_after === 'failed')
  })

  const runningCount = data?.running_count ?? runningTasks.length
  const queueCount = data?.queue_count ?? queuedTasks.length
  const failedCount = data?.failed_count ?? failedTasks.length
  const abnormalCount = data?.abnormal_count ?? abnormalTasks.length
  const currentConcurrency = data?.current_concurrency ?? runningCount
  const maxConcurrency = data?.max_concurrency ?? 2

  const recentDecisions = [...(data?.board ?? [])]
    .flatMap((item) =>
      (item.decision_log ?? []).map((entry) => ({
        taskName: item.task_name,
        agent: item.agent,
        decision: entry.action,
        reason: entry.reason,
        detail: entry.detail,
        timestamp: entry.timestamp,
        retryCount: item.retry_count ?? 0,
      })),
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)

  const routingDecisionTable = Array.from(
    sortedBoard.reduce((map, item) => {
      const key = [
        item.content_line ?? '-',
        item.brand_line ?? '-',
        item.account_line ?? '-',
        item.account_type ?? '-',
        item.tier ?? '-',
        String(item.can_close_deal ?? '-'),
        item.route_target ?? '-',
      ].join('|')
      if (!map.has(key)) {
        map.set(key, {
          key,
          content_line: item.content_line ?? '-',
          brand_line: item.brand_line ?? '-',
          account_line: item.account_line ?? '-',
          account_type: item.account_type ?? '-',
          tier: item.tier ?? '-',
          can_close_deal: typeof item.can_close_deal === 'boolean' ? String(item.can_close_deal) : '-',
          route_target: item.route_target ?? '-',
          count: 0,
        })
      }
      map.get(key)!.count += 1
      return map
    }, new Map<string, { key: string; content_line: string; brand_line: string; account_line: string; account_type: string; tier: string; can_close_deal: string; route_target: string; count: number }>()),
  ).map(([, value]) => value)

  const routeFocusedTasks = sortedBoard.filter((item) => item.route_target || item.content_line || item.account_line)

  const handleToggleExpandedTask = (taskName: string) => {
    setExpandedTaskName((current) => (current === taskName ? '' : taskName))
  }

  const handleCopyResult = async (taskName: string, resultText: string) => {
    try {
      await navigator.clipboard.writeText(resultText)
      setCopyState(taskName)
      window.setTimeout(() => setCopyState((current) => (current === taskName ? '' : current)), 1500)
    } catch {
      setCopyState('copy-failed')
    }
  }

  const renderTaskCard = (
    item: AutoTaskBoardItem,
    tone: 'running' | 'queue' | 'paused' | 'done',
    index: number,
  ) => {
    return (
      <DashboardAutoTaskTaskCard
        item={item}
        tone={tone}
        index={index}
        showTechnicalDetails={activeView === 'debug' || expandedTaskName === item.task_name}
        expanded={expandedTaskName === item.task_name}
        copyState={copyState}
        controlLoadingTask={controlLoadingTask}
        running={running || !!autoRetryState}
        autoRetrying={autoRetryState?.taskName === item.task_name}
        onToggleExpanded={handleToggleExpandedTask}
        onCopyResult={handleCopyResult}
        onControlTask={controlTask}
        onRetryTask={retryTask}
        onManualControlTask={manualControlTask}
      />
    )
  }

  const recentResults = data?.recent_results ?? []
  const publishCenterEntries = buildPublishCenterEntries(sortedBoard)
  const archiveCenterEntries = buildArchiveCenterEntries(sortedBoard)
  const archiveDomainGroups = Array.from(
    archiveCenterEntries.reduce((map, entry) => {
      const list = map.get(entry.domain) ?? []
      list.push(entry)
      map.set(entry.domain, list)
      return map
    }, new Map<string, ArchiveCenterEntry[]>()),
  ).sort((a, b) => b[1].length - a[1].length)
  const archiveContentLineGroups = Array.from(
    archiveCenterEntries.reduce((map, entry) => {
      const key = entry.contentLine ?? 'unknown'
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
      return map
    }, new Map<string, ArchiveCenterEntry[]>()),
  ).sort((a, b) => b[1].length - a[1].length)
  const archiveAccountLineGroups = Array.from(
    archiveCenterEntries.reduce((map, entry) => {
      const key = entry.accountLine ?? 'unknown'
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
      return map
    }, new Map<string, ArchiveCenterEntry[]>()),
  ).sort((a, b) => b[1].length - a[1].length)
  const publishSourceGroups = Array.from(
    publishCenterEntries.reduce((map, entry) => {
      const key = entry.source?.title || entry.source?.chapter_title || entry.taskName.split(' · ')[0]
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list.sort((a) => (a.contentVariant === 'short' ? -1 : 1)))
      return map
    }, new Map<string, PublishCenterEntry[]>()),
  )
  const currentProfile = data?.current_profile
  const archiveStructureGroups = Array.from(
    archiveCenterEntries.reduce((map, entry) => {
      const key = entry.result.structure_id ?? 'unknown'
      const current = map.get(key) ?? { structureId: key, count: 0, accounts: new Map<string, number>() }
      current.count += 1
      const accountKey = entry.accountDisplay || entry.accountLine || 'unknown'
      current.accounts.set(accountKey, (current.accounts.get(accountKey) ?? 0) + 1)
      map.set(key, current)
      return map
    }, new Map<string, { structureId: string; count: number; accounts: Map<string, number> }>()),
  )
    .map(([, value]) => ({
      structureId: value.structureId,
      count: value.count,
      topAccount: [...value.accounts.entries()].sort((a, b) => b[1] - a[1])[0],
    }))
    .sort((a, b) => b.count - a.count)
  const todayAutoGeneratedTasks = sortedBoard.filter((item) => item.auto_generated)
  const riskSummary = {
    predictedHigh: sortedBoard.filter((item) => item.predicted_risk === 'high').length,
    needHuman: humanPendingTasks.length,
    blocked: sortedBoard.filter((item) => item.status === 'blocked' || (item.blocked_by?.length ?? 0) > 0 || item.predicted_block).length,
    externalBlocked: sortedBoard.filter((item) => item.account_type === 'external_partner' && item.route_result === 'blocked').length,
    leadTransferred: sortedBoard.filter((item) => item.account_type === 'external_partner' && item.route_result === 'transfer').length,
  }
  const domainLoadSummaryMap = new Map<string, { domain: string; total: number; running: number; queued: number; needHuman: number; blocked: number }>()
  sortedBoard.forEach((item) => {
    const key = item.domain ?? 'unknown'
    const current = domainLoadSummaryMap.get(key) ?? { domain: key, total: 0, running: 0, queued: 0, needHuman: 0, blocked: 0 }
    current.total += 1
    if (['doing', 'running'].includes(item.status)) current.running += 1
    if (['todo', 'queued', 'queue', 'pending', 'preparing'].includes(item.status)) current.queued += 1
    if (item.need_human) current.needHuman += 1
    if (item.status === 'blocked' || (item.blocked_by?.length ?? 0) > 0 || item.predicted_block) current.blocked += 1
    domainLoadSummaryMap.set(key, current)
  })
  const domainLoadSummary = Array.from(domainLoadSummaryMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
  const executionStatusSummary = {
    running: runningTasks.length,
    queued: queuedTasks.length,
    blocked: poolBoard.filter((item) => item.status === 'blocked' || (item.blocked_by?.length ?? 0) > 0 || item.predicted_block).length,
    needHuman: poolBoard.filter((item) => item.need_human).length,
  }
  const consultantSummary = Array.from(
    sortedBoard
      .filter((item) => item.consultant_id)
      .reduce((map, item) => {
        const key = item.consultant_id as string
        const current = map.get(key) ?? { consultantId: key, owner: item.consultant_owner ?? key, activeLoad: 0, converted: 0, total: 0 }
        current.total += 1
        if (item.converted) current.converted += 1
        if (!item.converted && !item.lost && !['done', 'success', 'cancelled', 'failed'].includes(item.status)) current.activeLoad += 1
        map.set(key, current)
        return map
      }, new Map<string, { consultantId: string; owner: string; activeLoad: number; converted: number; total: number }>()),
  ).map(([, value]) => ({ ...value, conversionRate: value.total ? Math.round((value.converted / value.total) * 100) : 0 }))
    .sort((a, b) => b.activeLoad - a.activeLoad || b.total - a.total)
  const reassignmentRecords = sortedBoard.filter((item) => item.reassigned_to).slice(0, 6)
  const taskGroups = Array.from(
    new Map(
      sortedBoard
        .filter((item) => item.task_group_id)
        .map((item) => [
          item.task_group_id as string,
          {
            id: item.task_group_id as string,
            label: item.task_group_label ?? item.task_group_id ?? '-',
            template: item.template_source ?? item.template_key ?? '-',
            domain: item.domain ?? '-',
            projectLine: item.project_line ?? '-',
            count: sortedBoard.filter((entry) => entry.task_group_id === item.task_group_id).length,
          },
        ]),
    ).values(),
  )
  const parentTaskViews = Array.from(
    new Map(
      sortedBoard
        .filter((item) => item.parent_task_id)
        .map((item) => {
          const parentId = item.parent_task_id as string
          const children = sortedBoard.filter((entry) => entry.parent_task_id === parentId)
          const doneChildren = children.filter((entry) => ['done', 'success', 'cancelled'].includes(entry.status)).length
          const blockedChildren = children.filter((entry) => entry.need_human || entry.status === 'failed' || (entry.blocked_by?.length ?? 0) > 0)
          const progress = children.length ? Math.round((doneChildren / children.length) * 100) : 0
          const blockedPoint = blockedChildren[0]
          return [
            parentId,
            {
              id: parentId,
              title: item.task_group_label?.split(' · ')[0] ?? item.template_source ?? item.template_key ?? parentId,
              template: item.template_source ?? item.template_key ?? '-',
              scenarioId: item.scenario_id ?? '-',
              childCount: children.length,
              progress,
              blockedPoint: blockedPoint
                ? blockedPoint.blocked_by?.[0] ?? blockedChildren[0]?.task_name ?? '-'
                : '—',
              domains: Array.from(new Set(children.map((entry) => entry.domain).filter(Boolean))),
            },
          ]
        }),
    ).values(),
  )
  const notificationTabs: Array<{ key: 'builder' | 'media' | 'family' | 'business'; label: string }> = [
    { key: 'builder', label: 'Builder' },
    { key: 'media', label: 'Media' },
    { key: 'family', label: 'Family' },
    { key: 'business', label: 'Business' },
  ]
  const recentNotifications = notifications
    .filter((notice) => notificationTabs.some((tab) => tab.key === notice.domain))
    .slice(0, 12)
  const visibleNotifications = recentNotifications.filter((notice) => notice.domain === activeNoticeDomain)

  return (
    <section className="home-section panel strong-card auto-task-panel scheduler-hub-panel">
      <div className="home-section-head scheduler-hub-head">
        <div>
          <h3>调度队列中枢</h3>
          <p className="scheduler-hub-subtitle">基于 /api/tasks-board 的实时调度视图</p>
        </div>
        <span className="home-count">{data?.board?.length ?? 0}</span>
      </div>

      <div className="scheduler-template-strip">
        <div className="scheduler-template-chips">
          <button type="button" className="scheduler-template-chip is-active">
            <strong>Learning Loop</strong>
            <span>records {data?.learning_summary?.total_records ?? learningRecords.length} · avg {(data?.learning_summary?.avg_learning_score ?? 0).toFixed(2)} · high {(data?.learning_summary?.high_score_records ?? 0)}</span>
          </button>
          {learningRecords.slice(0, 3).map((record) => (
            <button key={record.key} type="button" className="scheduler-template-chip">
              <strong>{record.structure_id}</strong>
              <span>{record.content_line} / {record.account_line} / score {record.learning_score.toFixed(2)}</span>
            </button>
          ))}
          <button type="button" className="scheduler-template-chip">
            <strong>Business Funnel</strong>
            <span>
              leads {data?.business_summary?.total_leads ?? 0} · consultants {data?.business_summary?.assigned_consultants ?? 0} · converted {data?.business_summary?.converted ?? 0} · lost {data?.business_summary?.lost ?? 0} · attribution {data?.business_summary?.attributed ?? 0}
            </span>
          </button>
        </div>
      </div>

      <div className="auto-task-runner">
        <input
          className="auto-task-input"
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder="输入一句话任务，例如：实现注册页面"
          disabled={running}
        />
        <button className="auto-task-run-btn" type="button" onClick={runTask} disabled={running || !taskInput.trim()}>
          {running && runningTaskName === taskInput.trim() ? '执行中...' : '执行'}
        </button>
      </div>

      <div className="scheduler-template-strip">
        <div className="scheduler-template-form">
          <select className="auto-task-input" value={activeTemplateKey} onChange={(e) => setActiveTemplateKey(e.target.value as typeof activeTemplateKey)} disabled={running}>
            {scenarioTemplates.map((template) => (
              <option key={template.key} value={template.key}>{template.label}</option>
            ))}
          </select>
          <button className="auto-task-run-btn" type="button" onClick={createScenarioTemplate} disabled={running}>
            {running && runningTaskName === activeTemplateKey ? '创建中...' : '从模板创建任务组'}
          </button>
        </div>
        <div className="scheduler-template-chips">
          {scenarioTemplates.map((template) => (
            <button
              key={template.key}
              type="button"
              className={`scheduler-template-chip ${activeTemplateKey === template.key ? 'is-active' : ''}`}
              onClick={() => setActiveTemplateKey(template.key)}
            >
              <strong>{template.label}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </div>
      </div>

      {failedTask ? (
        <div className="auto-task-failed-box">
          <div className="auto-task-failed-title">失败提示</div>
          <div>任务: {failedTask.taskName}</div>
          <div>status: {failedTask.status}</div>
          <div>error: {failedTask.message}</div>
          <div>{failedTask.autoRetrying ? '正在自动重试' : '自动重试结束'}</div>
          <div>已重试次数: {autoRetryState?.retryCount ?? failedTask.retryCount}</div>
          <button className="auto-task-retry-btn" type="button" onClick={() => retryTask(failedTask.taskName)} disabled={running || !!autoRetryState}>
            {autoRetryState?.taskName === failedTask.taskName ? '自动重试中...' : '重试'}
          </button>
        </div>
      ) : null}

      {runError ? <div className="auto-task-error">{runError}</div> : null}

      <div className="scheduler-view-switch" role="tablist" aria-label="调度视图切换">
        {[
          { key: 'operations', label: '运营态', note: '进度 / 风险 / 待人工' },
          { key: 'execution', label: '执行态', note: '实例池 / 队列 / 结果' },
          { key: 'routing', label: '路由态', note: '决策表 / 链路 / 拦截解释' },
          { key: 'debug', label: '调试态', note: '完整字段 / 排障' },
        ].map((view) => (
          <button
            key={view.key}
            type="button"
            className={`scheduler-view-tab ${activeView === view.key ? 'is-active' : ''}`}
            onClick={() => setActiveView(view.key as typeof activeView)}
          >
            <strong>{view.label}</strong>
            <span>{view.note}</span>
          </button>
        ))}
      </div>

      <div className="scheduler-hub-layout">
        <div className="scheduler-hub-main">
          {activeView === 'operations' ? (
            <AutoTaskOperationsView
              parentTaskViews={parentTaskViews}
              taskGroups={taskGroups}
              todayAutoGeneratedCount={todayAutoGeneratedTasks.length}
              riskSummary={riskSummary}
              loading={loading}
              domainLoadSummary={domainLoadSummary}
              humanPendingTasks={humanPendingTasks}
              consultantSummary={consultantSummary}
              reassignmentRecords={reassignmentRecords}
            />
          ) : null}

          {activeView === 'execution' ? (
            <AutoTaskExecutionView
              poolTabs={poolTabs}
              normalizedActivePool={normalizedActivePool}
              onSelectPool={setActivePool}
              executionStatusSummary={executionStatusSummary}
              runningTasks={runningTasks}
              queuedTasks={queuedTasks}
              blockedPoolTasks={blockedPoolTasks}
              needHumanPoolTasks={needHumanPoolTasks}
              renderTaskCard={renderTaskCard}
              recentDecisions={recentDecisions}
              recentResults={recentResults}
              publishSourceGroups={publishSourceGroups}
              templatePool={templatePool}
              controlLoadingTask={controlLoadingTask}
              onManualControlTask={manualControlTask}
              archiveContentLineGroups={archiveContentLineGroups}
              archiveAccountLineGroups={archiveAccountLineGroups}
              archiveStructureGroups={archiveStructureGroups}
              archiveDomainGroups={archiveDomainGroups}
              onMarkTemplateSource={markTemplateSource}
            />
          ) : null}

          {activeView === 'routing' ? (
            <AutoTaskRoutingView
              routingDecisionTable={routingDecisionTable}
              routeFocusedTasks={routeFocusedTasks}
              renderTaskCard={renderTaskCard}
            />
          ) : null}

          {activeView === 'debug' ? (
            <>
              <AutoTaskDebugProfileCard currentProfile={currentProfile} />
              <AutoTaskDebugMainView
                parentTaskViews={parentTaskViews}
                taskGroups={taskGroups}
                poolTabs={poolTabs}
                normalizedActivePool={normalizedActivePool}
                onSelectPool={setActivePool}
                currentConcurrency={currentConcurrency}
                maxConcurrency={maxConcurrency}
                runningCount={runningCount}
                queueCount={queueCount}
                blockedCount={blockedTasks.length}
                failedCount={failedCount}
                abnormalCount={abnormalCount}
                loading={loading}
                runningTasks={runningTasks}
                queuedTasks={queuedTasks}
                pausedTasks={pausedTasks}
                doneTasks={doneTasks}
                renderTaskCard={renderTaskCard}
                recentDecisions={recentDecisions}
                humanPendingTasks={humanPendingTasks}
                onManualControlTask={manualControlTask}
                controlsDisabled={running || !!autoRetryState || !!controlLoadingTask}
              />
            </>
          ) : null}
        </div>

        {activeView === 'debug' ? (
          <AutoTaskDebugSidebar
            notificationTabs={notificationTabs}
            activeNoticeDomain={activeNoticeDomain}
            onSelectNoticeDomain={setActiveNoticeDomain}
            visibleNotifications={visibleNotifications}
            controlsDisabled={running || !!autoRetryState || !!controlLoadingTask}
            onGroupNotificationAction={groupNotificationAction}
            recentResults={recentResults}
            continuousFailedTasks={continuousFailedTasks}
            stuckTasks={stuckTasks}
            abnormalTasks={abnormalTasks}
            systemAlerts={data?.system_alerts ?? []}
          />
        ) : null}
      </div>

      <SystemTestResultPanel />
    </section>
  )
}
