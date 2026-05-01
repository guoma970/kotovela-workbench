export type AutoTaskHistoryEntry = {
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

export type AutoDecisionLogEntry = {
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
    | 'strategy_generate_task'
    | 'risk_detected'
    | 'precheck_block'
    | 'lead_auto_transfer'
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

export type AutoTaskSource = {
  source_type: 'book_manuscript' | 'product_brochure' | 'case_booklet'
  source_project: 'japanese_renovation_guide' | 'product_material_system' | 'case_library'
  chapter_title?: string
  core_points: string
  title?: string
}

export type AccountType = 'owned' | 'brand' | 'ip' | 'external_partner'
export type ChannelTier = 'L1' | 'L2' | 'L3'
export type RouteResult = 'direct' | 'blocked' | 'transfer'
export type ExternalPartnerMode = 'content_only' | 'consult_only' | 'no_delivery'

export type AutoTaskTemplateKey =
  | 'family_study_evening'
  | 'media_publish_flow'
  | 'business_followup_flow'
  | 'builder_delivery_flow'
  | 'media_publish_with_distribution'
  | 'business_quote_with_materials'

export type AutoTaskBoardItem = {
  task_name: string
  agent: string
  parent_task_id?: string
  scenario_id?: string
  task_group_id?: string
  task_group_label?: string
  template_key?: AutoTaskTemplateKey
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
  content_line?:
    | 'layout_renovation'
    | 'kitchen_storage'
    | 'material_case'
    | 'floor_heating'
    | 'group_buy_material'
    | 'customer_followup'
    | 'growth_record'
    | 'ai_tools'
  account_line?:
    | 'yanfami_official'
    | 'kotoharo_official'
    | 'kotovela_official'
    | 'guoshituan_official'
    | 'guoma970'
    | 'latin_boy_guoguo'
    | 'luyi_children'
    | 'chongming_storage'
    | 'openclaw'
    | 'mom970'
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

export type ContentLearningRecord = {
  key: string
  content_line: string
  account_line: string
  structure_id: string
  structure_type: string
  feedback_count: number
  avg_score: number
  learning_score: number
}

export type PoolTab = {
  key: 'builder' | 'media' | 'family' | 'business' | 'personal'
  label: string
  max_concurrency: number
  running_count: number
  queue_count: number
  health: 'healthy' | 'warning' | 'critical'
}

export type SystemAlertItem = {
  level: 'warning' | 'critical'
  task_name?: string
  agent?: string
  reason: string
}

export type AutoTaskBoardPayload = {
  total: number
  success: number
  failed: number
  max_concurrency?: number
  current_concurrency?: number
  running_count?: number
  queue_count?: number
  failed_count?: number
  abnormal_count?: number
  pools?: PoolTab[]
  system_alerts?: SystemAlertItem[]
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

export type TaskCardTone = 'running' | 'queue' | 'paused' | 'done'

export type RoutingDecisionRow = {
  key: string
  content_line: string
  brand_line: string
  account_line: string
  account_type: string
  tier: string
  can_close_deal: string
  route_target: string
  count: number
}

export type ParentTaskView = {
  id: string
  title: string
  template: string
  childCount: number
  progress: number
  blockedPoint: string
  domains: Array<string | undefined>
}

export type TaskGroupView = {
  id: string
  label: string
  template: string
  domain: string
  projectLine: string
  count: number
}

export type RecentDecision = {
  taskName: string
  agent: string
  decision: string
  reason: string
  detail: string
  timestamp: string
  retryCount: number
}

export type RecentResult = {
  task_name: string
  updated_at?: string
  result: {
    content: string
  }
}

export type AlertTaskItem = {
  task_name: string
  agent: string
}

export type RiskSummary = {
  predictedHigh: number
  needHuman: number
  blocked: number
  externalBlocked: number
  leadTransferred: number
}

export type DomainLoadSummaryEntry = {
  domain: string
  total: number
  running: number
  queued: number
  needHuman: number
  blocked: number
}

export type ConsultantSummaryEntry = {
  consultantId: string
  owner: string
  activeLoad: number
  converted: number
  total: number
  conversionRate: number
}

export type ReassignmentRecord = {
  lead_id?: string
  reassigned_at?: string
  task_name: string
  consultant_id?: string
  reassigned_to?: string
  reassigned_reason?: string
}

export type ExecutionStatusSummary = {
  running: number
  queued: number
  blocked: number
  needHuman: number
}

export type ArchiveStructureGroup = {
  structureId: string
  count: number
  topAccount?: [string, number]
}

export type NotificationDomain = 'builder' | 'media' | 'family' | 'business'
