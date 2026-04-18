import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { formatLastSyncedAt } from '../lib/formatSyncTime'
import { createFocusSearch } from '../lib/workbenchLinking'
import type { Agent, Project, Room, Task, UpdateItem } from '../types'
import { BRAND_NAME } from '../config/brand'
import { brandAssets } from '../config/brandAssets'

type SystemModeValue = 'dev' | 'test' | 'live'
type PublishModeValue = 'manual_only' | 'auto_disabled' | 'semi_auto'

type SystemModeState = {
  systemMode: SystemModeValue
  publishMode: PublishModeValue
  forceStop?: boolean | null
}

type AuditLogEntry = {
  id: string
  action: string
  user: string
  time: string
  target: string
  result: string
}

const DEFAULT_SYSTEM_MODE: SystemModeState = {
  systemMode: 'dev',
  publishMode: 'manual_only',
  forceStop: null,
}

function normalizeSystemModeState(payload: unknown): SystemModeState {
  if (!payload || typeof payload !== 'object') return DEFAULT_SYSTEM_MODE
  const data = payload as Record<string, unknown>
  const rawSystemMode = String(data.system_mode ?? data.systemMode ?? data.mode ?? 'dev').toLowerCase()
  const rawPublishMode = String(data.publish_mode ?? data.publishMode ?? 'manual_only').toLowerCase()
  const rawForceStop = data.force_stop ?? data.forceStop

  return {
    systemMode: rawSystemMode === 'live' ? 'live' : rawSystemMode === 'test' ? 'test' : 'dev',
    publishMode:
      rawPublishMode === 'semi_auto'
        ? 'semi_auto'
        : rawPublishMode === 'auto_disabled'
          ? 'auto_disabled'
          : 'manual_only',
    forceStop: typeof rawForceStop === 'boolean' ? rawForceStop : rawForceStop == null ? null : Boolean(rawForceStop),
  }
}

function useSystemMode() {
  const [state, setState] = useState<SystemModeState>(DEFAULT_SYSTEM_MODE)

  useEffect(() => {
    let cancelled = false

    const loadSystemMode = async () => {
      try {
        const response = await fetch('/api/system-mode', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) {
          setState(normalizeSystemModeState(data))
        }
      } catch {
        if (!cancelled) {
          setState(DEFAULT_SYSTEM_MODE)
        }
      }
    }

    loadSystemMode()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}

function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])

  useEffect(() => {
    let cancelled = false

    const loadAuditLog = async () => {
      try {
        const response = await fetch('/api/audit-log', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        })
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) {
          setEntries(Array.isArray(data?.entries) ? data.entries : [])
        }
      } catch {
        if (!cancelled) setEntries([])
      }
    }

    loadAuditLog()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="home-section panel strong-card audit-log-panel">
      <div className="home-section-head">
        <h3>操作日志面板</h3>
        <span className="home-count">{entries.length}</span>
      </div>
      {entries.length ? (
        <div className="audit-log-list">
          {entries.slice(0, 8).map((entry) => (
            <article key={entry.id} className="audit-log-item">
              <div className="audit-log-item-top">
                <strong>{entry.action}</strong>
                <span>{entry.time}</span>
              </div>
              <p>{entry.target}</p>
              <small>{entry.user} · {entry.result}</small>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">暂无审计记录。</p>
      )}
    </section>
  )
}

/** 内部版中控：一页看清数据源、健康度、实例与项目概况（不重复堆叠条带）。 */
function InternalControlSummary({
  livePayload,
  isLoading,
  activeDataSource,
  isFallback,
  agents,
  projects,
  onOpenProject,
  onOpenAgentsIdle,
  lastSyncedAtMs,
  pollingIntervalMs,
  systemModeState,
}: {
  livePayload: boolean
  isLoading: boolean
  activeDataSource: 'mock' | 'openclaw'
  isFallback: boolean
  agents: Agent[]
  projects: Project[]
  onOpenProject: (projectId: string) => void
  onOpenAgentsIdle: () => void
  lastSyncedAtMs: number | null
  pollingIntervalMs: number
  systemModeState: SystemModeState
}) {
  const blocked = agents.filter((a) => a.status === 'blocked').length
  const active = agents.filter((a) => a.status === 'active').length
  const idle = agents.filter((a) => a.status === 'idle').length
  const projectsWithBlockers = projects.filter((p) => p.blockers > 0).length
  const topProjects = [...projects]
    .sort((a, b) => {
      if (b.blockers !== a.blockers) return b.blockers - a.blockers
      return b.progress - a.progress
    })
    .slice(0, 6)

  const sourceLine =
    activeDataSource === 'openclaw'
      ? isFallback
        ? '数据源 OpenClaw 不可用，已回退 Mock'
        : livePayload
          ? '数据源 OpenClaw · 实例 payload 已接入'
          : '数据源 OpenClaw（当前无实例行，展示同步口径）'
      : '数据源 Mock · 演示口径'

  const healthLine =
    blocked > 0
      ? `需关注：${blocked} 个实例阻塞`
      : active > 0
        ? `进行中：${active} 个实例 · 整体在推进`
        : idle === agents.length && agents.length > 0
          ? '当前无进行中任务，实例待命'
          : '暂无实例数据'

  const pollSec = Math.max(1, Math.round(pollingIntervalMs / 1000))
  const { systemMode, publishMode, forceStop } = systemModeState
  const systemModeTone = systemMode === 'live' ? 'is-live' : systemMode === 'test' ? 'is-test' : 'is-dev'
  const syncStatusLine = isLoading
    ? '正在拉取 OpenClaw…'
    : activeDataSource === 'openclaw' && !isFallback
      ? `上次同步 ${formatLastSyncedAt(lastSyncedAtMs)} · 每 ${pollSec} 秒轮询`
      : isFallback
        ? `上次成功同步 ${formatLastSyncedAt(lastSyncedAtMs)} · 已回退 Mock · 每 ${pollSec} 秒重试`
        : `当前为 Mock 数据 · 未轮询 OpenClaw`

  return (
    <section className="control-summary panel strong-card">
      <div className={`system-mode-bar ${systemModeTone}`}>
        <div className="system-mode-bar-main">
          <span className="system-mode-bar-label">SYSTEM MODE</span>
          <strong className="system-mode-bar-value">{systemMode}</strong>
          <span className="system-mode-bar-divider" aria-hidden>
            /
          </span>
          <span className="system-mode-bar-label">PUBLISH MODE</span>
          <strong className="system-mode-bar-value">{publishMode}</strong>
          {forceStop != null ? (
            <span className={`system-mode-flag ${forceStop ? 'is-on' : 'is-off'}`}>
              FORCE STOP: {forceStop ? 'ON' : 'OFF'}
            </span>
          ) : null}
        </div>
        <div className="system-mode-bar-side">
          {systemMode === 'live' ? 'LIVE 模式高风险，请谨慎操作发布链路。' : null}
        </div>
      </div>

      <div className="control-summary-top">
        <div className="control-summary-title-block">
          <h2 className="control-summary-heading">中控总览</h2>
          <p className="control-summary-health">{healthLine}</p>
          <p className="control-summary-sub">
            上方：各项目整体进度（阻塞多的优先）；下方：按实例看谁在做，并汇总该实例名下的任务完成情况。
          </p>
        </div>
        <div className="control-summary-meta">
          <span className={`control-summary-pill ${activeDataSource === 'openclaw' && !isFallback ? 'is-live' : ''}`}>
            {sourceLine}
          </span>
          <span className="control-summary-pill control-summary-pill-wide">{syncStatusLine}</span>
        </div>
      </div>

      <div className="control-summary-metrics" role="list">
        <div className="control-metric" role="listitem">
          <span className="control-metric-label">实例</span>
          <strong className="control-metric-value">{agents.length}</strong>
        </div>
        <div className="control-metric is-blocked" role="listitem">
          <span className="control-metric-label">阻塞</span>
          <strong className="control-metric-value">{blocked}</strong>
        </div>
        <div className="control-metric is-active" role="listitem">
          <span className="control-metric-label">进行中</span>
          <strong className="control-metric-value">{active}</strong>
        </div>
        <div className="control-metric is-idle" role="listitem">
          <span className="control-metric-label">待命</span>
          <strong className="control-metric-value">{idle}</strong>
        </div>
        <div className="control-metric" role="listitem">
          <span className="control-metric-label">项目</span>
          <strong className="control-metric-value">{projects.length}</strong>
        </div>
        <div className={`control-metric ${projectsWithBlockers > 0 ? 'is-blocked' : ''}`} role="listitem">
          <span className="control-metric-label">项目阻塞</span>
          <strong className="control-metric-value">{projectsWithBlockers}</strong>
        </div>
      </div>

      {topProjects.length > 0 ? (
        <div className="control-project-snapshot">
          <div className="control-project-snapshot-head">
            <span className="control-project-snapshot-title">项目进度快照</span>
            <span className="control-project-snapshot-hint">阻塞优先排序 · 点击进项目板</span>
          </div>
          <ul className="control-project-snapshot-list">
            {topProjects.map((project) => (
              <li key={project.id}>
                <button type="button" className="control-project-line" onClick={() => onOpenProject(project.id)}>
                  <span className="control-project-line-name">{project.name}</span>
                  <span className="control-project-line-track" aria-hidden>
                    <span
                      className="control-project-line-fill"
                      style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
                    />
                  </span>
                  <span className="control-project-line-pct">{project.progress}%</span>
                  {project.blockers > 0 ? (
                    <span className="control-project-line-badge">{project.blockers} 阻塞</span>
                  ) : (
                    <span className="control-project-line-ok">—</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {idle > 0 ? (
        <div className="control-summary-footer">
          <button type="button" className="control-idle-link" onClick={onOpenAgentsIdle}>
            待命实例 {idle} 个 — 在 Agents 页查看全部
          </button>
        </div>
      ) : null}
    </section>
  )
}

type HomeStatus = 'blocker' | 'active' | 'idle'

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

type TemplatePoolEntry = {
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

type UserProfile = {
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

type AutoTaskBoardItem = {
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

type SystemTestCase = {
  module: string
  case_id: string
  input: string
  expected: string
  actual: string
  result: 'pass' | 'fail'
  note?: string
}

type SystemTestDefect = {
  id: string
  severity: 'P0' | 'P1' | 'P2'
  reproducible: string
  suggestion: string
  note: string
}

type SystemTestPayload = {
  summary: {
    task_id: string
    run_id: string
    generated_at: string
    total_cases: number
    pass: number
    fail: number
    failed_modules: string[]
    build_status?: string
    commit_message?: string
  }
  cases: SystemTestCase[]
  defects: SystemTestDefect[]
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
  guoshituan: '果石团',
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

function formatDecisionLogEntry(entry: AutoDecisionLogEntry) {
  return `[${entry.timestamp}] ${entry.action} | ${entry.reason} | ${entry.detail}${entry.route_result ? ` | route_result=${entry.route_result}` : ''}${entry.route_target ? ` | route_target=${entry.route_target}` : ''}${entry.account_type ? ` | account_type=${entry.account_type}` : ''}${entry.tier ? ` | tier=${entry.tier}` : ''}${entry.brand_display ? ` | brand_display=${entry.brand_display}` : ''}${entry.mcn_display ? ` | mcn_display=${entry.mcn_display}` : ''}${typeof entry.can_close_deal === 'boolean' ? ` | can_close_deal=${entry.can_close_deal}` : ''}${entry.rule_hit_reason ? ` | rule_hit_reason=${entry.rule_hit_reason}` : ''}${entry.whitelist_hit ? ` | whitelist_hit=${entry.whitelist_hit}` : ''}${entry.block_reason ? ` | block_reason=${entry.block_reason}` : ''}${entry.partner_mode ? ` | partner_mode=${entry.partner_mode}` : ''}${entry.publish_rhythm_hit ? ` | publish_rhythm_hit=${entry.publish_rhythm_hit}` : ''}${entry.persona_hit ? ` | persona_hit=${entry.persona_hit}` : ''}${entry.publish_risk_warning?.length ? ` | publish_risk_warning=${entry.publish_risk_warning.join('/')}` : ''}${entry.memory_hit ? ` | memory_hit=${entry.memory_hit}` : ''}${entry.profile_rule ? ` | profile_rule=${entry.profile_rule}` : ''}`
}

function getRouteChain(item: AutoTaskBoardItem) {
  return [
    item.content_line ?? '-',
    item.brand_display ?? item.brand_line ?? '-',
    item.account_display ?? item.account_line ?? '-',
    item.route_result ?? '-',
    item.route_target ?? '-',
  ]
}

function getExternalPartnerMode(item: AutoTaskBoardItem): ExternalPartnerMode | null {
  if (item.account_type !== 'external_partner') return null
  if ((item.decision_log ?? []).some((entry) => entry.partner_mode === 'consult_only')) return 'consult_only'
  if ((item.decision_log ?? []).some((entry) => entry.partner_mode === 'content_only')) return 'content_only'
  return item.domain === 'media' ? 'content_only' : 'no_delivery'
}

type PublishCenterEntry = {
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

type ArchiveCenterEntry = {
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

function getRecommendedTemplates(templates: TemplatePoolEntry[], domain: string, assetType: PublishCenterEntry['assetType']) {
  const expectedAssetType = assetType === 'media' ? 'script' : assetType === 'business' ? 'reply' : assetType === 'family' ? 'plan' : 'generic'
  return templates
    .filter((template) => template.domain === domain && template.asset_type === expectedAssetType)
    .sort((a, b) => {
      if (b.use_count !== a.use_count) return b.use_count - a.use_count
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
    .slice(0, 2)
}

type TaskNotificationItem = {
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

function AutoTaskSystemSummaryCard() {
  const navigate = useNavigate()
  const [data, setData] = useState<AutoTaskBoardPayload | null>(null)

  useEffect(() => {
    fetch('/api/tasks-board', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json: AutoTaskBoardPayload) => setData(enrichBoardPayload(json)))
      .catch(() => setData(null))
  }, [])

  return (
    <section className="home-section panel strong-card auto-task-summary-card">
      <div className="home-section-head">
        <h3>任务调度系统</h3>
        <span className="home-count">{data?.total ?? 0}</span>
      </div>
      <div className="auto-task-overview">
        <div className="auto-task-metric"><span>total</span><strong>{data?.total ?? 0}</strong></div>
        <div className="auto-task-metric"><span>success</span><strong>{data?.success ?? 0}</strong></div>
        <div className={`auto-task-metric ${(data?.failed ?? 0) > 0 ? 'is-failed' : ''}`}><span>failed</span><strong>{data?.failed ?? 0}</strong></div>
      </div>
      <button className="auto-task-go-btn" type="button" onClick={() => navigate('/scheduler')}>
        查看详情 / 进入系统
      </button>
    </section>
  )
}

type HomeItem = {
  id: string
  name: string
  status: HomeStatus
  sentence: string
  updatedAt: string
  taskId?: string
  roomId?: string
  projectId?: string
  agentId: string
  instanceKey?: string
  /** Internal cockpit: compact task counts for this executor instance */
  taskLine?: string
}

/** Per-instance task rollup (tasks where executor = agent). */
function formatAgentTaskLine(tasks: Task[], agentId: string): string | undefined {
  const mine = tasks.filter((t) => t.executorAgentId === agentId)
  if (mine.length === 0) return undefined
  let doing = 0
  let blocked = 0
  let done = 0
  let todo = 0
  for (const t of mine) {
    if (t.status === 'doing') doing++
    else if (t.status === 'blocked') blocked++
    else if (t.status === 'done') done++
    else if (t.status === 'todo') todo++
  }
  const parts = [`进行中 ${doing}`, `阻塞 ${blocked}`, `已完成 ${done}`]
  if (todo > 0) parts.push(`待办 ${todo}`)
  return `任务 ${mine.length} 条 · ${parts.join(' · ')}`
}

const normalizeSentence = (value?: string) => value?.trim() || '暂无明确任务'

const shortText = (value: string, max = 56): string => {
  const text = value.trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

const buildHomeItems = (agents: Agent[], projects: Project[], rooms: Room[], tasks: Task[]): HomeItem[] => {
  return agents.map((agent) => {
    const relatedTasks = tasks.filter((task) => task.executorAgentId === agent.id)
    const blockerTask = relatedTasks.find((task) => task.status === 'blocked')
    const doingTask = relatedTasks.find((task) => task.status === 'doing')
    const relatedRoom = rooms.find((room) => room.instanceIds.includes(agent.id))
    const relatedProject = projects.find((project) => project.id === agent.projectId)
    const projectName = relatedProject?.name || agent.project
    const projectProgress = Number.isFinite(relatedProject?.progress) ? relatedProject!.progress : 0
    const roomName = relatedRoom?.name || '未绑定房间'
    const blockedText = shortText(blockerTask?.title || agent.currentTask || '阻塞事项待处理')
    const doingText = shortText(doingTask?.title || agent.currentTask || '执行事项待补充')
    const idleText = shortText(agent.currentTask || '等待任务分派')

    if (agent.status === 'blocked' || blockerTask) {
      return {
        id: agent.id,
        name: agent.name,
        status: 'blocker',
        sentence: normalizeSentence(
          `在 ${roomName} 阻塞：${blockedText} · 项目 ${projectName}（${projectProgress}%）`,
        ),
        updatedAt: agent.updatedAt,
        taskId: blockerTask?.id,
        roomId: relatedRoom?.id,
        projectId: agent.projectId,
        agentId: agent.id,
        instanceKey: agent.instanceKey,
      }
    }

    if (agent.status === 'active' || doingTask) {
      return {
        id: agent.id,
        name: agent.name,
        status: 'active',
        sentence: normalizeSentence(
          `在 ${roomName} 推进：${doingText} · 项目 ${projectName}（${projectProgress}%）`,
        ),
        updatedAt: agent.updatedAt,
        taskId: doingTask?.id,
        roomId: relatedRoom?.id,
        projectId: agent.projectId,
        agentId: agent.id,
        instanceKey: agent.instanceKey,
      }
    }

    return {
      id: agent.id,
      name: agent.name,
      status: 'idle',
      sentence: normalizeSentence(
        `待命于 ${roomName} · 当前关注：${idleText} · 项目 ${projectName}（${projectProgress}%）`,
      ),
      updatedAt: agent.updatedAt,
      roomId: relatedRoom?.id,
      projectId: agent.projectId,
      agentId: agent.id,
      instanceKey: agent.instanceKey,
    }
  })
}

const badgeLabel: Record<HomeStatus, string> = {
  blocker: 'BLOCKER',
  active: 'ACTIVE',
  idle: 'IDLE',
}

type ActionItem = {
  label: string
  onClick: () => void
  disabled?: boolean
  quiet?: boolean
}

function ActionRow({ actions }: { actions: ActionItem[] }) {
  if (actions.length === 0) {
    return null
  }

  return (
    <div className="home-actions">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className={action.quiet ? 'home-action home-action-quiet' : 'home-action'}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

function SectionList({
  title,
  items,
  emptyText,
  getActions,
  statusLabels,
  updatedLabel = 'Updated',
}: {
  title: string
  items: HomeItem[]
  emptyText: string
  getActions: (item: HomeItem) => ActionItem[]
  statusLabels?: Record<HomeStatus, string>
  updatedLabel?: string
}) {
  const labels = statusLabels ?? badgeLabel
  return (
    <section className="home-section panel strong-card">
      <div className="home-section-head">
        <h3>{title}</h3>
        <span className="home-count">{items.length}</span>
      </div>

      {items.length > 0 ? (
        <div className="home-list">
          {items.map((item) => (
            <article key={item.id} className={`home-item home-item-${item.status}`}>
              <div className="home-item-top">
                <strong>{item.name}</strong>
                <span className={`home-badge home-badge-${item.status}`}>{labels[item.status]}</span>
              </div>
              <p>{item.sentence}</p>
              {item.taskLine ? <p className="home-item-taskline">{item.taskLine}</p> : null}
              <div className="home-item-meta">
                {item.instanceKey ? <span className="home-item-key">{item.instanceKey}</span> : null}
                <span>
                  {updatedLabel} {item.updatedAt}
                </span>
              </div>
              <ActionRow actions={getActions(item)} />
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">{emptyText}</p>
      )}
    </section>
  )
}

function RecentUpdates({
  updates,
  onViewDetail,
  title = 'Recent Updates',
  emptyText = 'No recent updates.',
  detailLabel = '查看详情',
}: {
  updates: UpdateItem[]
  onViewDetail: (update: UpdateItem) => void
  title?: string
  emptyText?: string
  detailLabel?: string
}) {
  return (
    <section className="home-section panel strong-card">
      <div className="home-section-head">
        <h3>{title}</h3>
        <span className="home-count">{updates.length}</span>
      </div>

      {updates.length > 0 ? (
        <div className="home-list">
          {updates.map((update) => (
            <article key={update.id} className="home-item home-item-update">
              <div className="home-item-top">
                <strong>{update.source}</strong>
                <span className="home-time">{update.time}</span>
              </div>
              <p>{update.title}</p>
              <ActionRow actions={[{ label: detailLabel, onClick: () => onViewDetail(update) }]} />
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">{emptyText}</p>
      )}
    </section>
  )
}

function SystemTestResultPanel() {
  const [payload, setPayload] = useState<SystemTestPayload | null>(null)

  useEffect(() => {
    fetch('/system-test-results.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setPayload(json as SystemTestPayload | null))
      .catch(() => setPayload(null))
  }, [])

  if (!payload) return null

  return (
    <section className="scheduler-system-test-panel" aria-label="系统测试结果">
      <div className="scheduler-section-title">系统测试结果</div>
      <div id="system-test-summary" className="scheduler-system-test-summary">
        <div className="scheduler-overview-grid">
          <div className="scheduler-overview-metric"><span>total cases</span><strong>{payload.summary.total_cases}</strong></div>
          <div className="scheduler-overview-metric"><span>pass</span><strong>{payload.summary.pass}</strong></div>
          <div className="scheduler-overview-metric is-failed"><span>fail</span><strong>{payload.summary.fail}</strong></div>
          <div className="scheduler-overview-metric is-warning"><span>failed modules</span><strong>{payload.summary.failed_modules.join(' / ') || 'none'}</strong></div>
        </div>
      </div>
      <div id="test-case-table" className="scheduler-routing-table-wrap scheduler-system-test-table-wrap">
        <table className="scheduler-routing-table scheduler-system-test-table">
          <thead>
            <tr>
              <th>case_id</th>
              <th>module</th>
              <th>input</th>
              <th>expected</th>
              <th>actual</th>
              <th>result</th>
              <th>note</th>
            </tr>
          </thead>
          <tbody>
            {payload.cases.map((item) => (
              <tr key={item.case_id} className={item.result === 'fail' ? 'is-failed' : ''}>
                <td>{item.case_id}</td>
                <td>{item.module}</td>
                <td>{item.input}</td>
                <td>{item.expected}</td>
                <td>{item.actual}</td>
                <td>{item.result}</td>
                <td>{item.note || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div id="defect-list" className="scheduler-routing-table-wrap scheduler-system-test-table-wrap">
        <table className="scheduler-routing-table scheduler-system-test-table">
          <thead>
            <tr>
              <th>id</th>
              <th>severity</th>
              <th>reproducible</th>
              <th>suggestion</th>
              <th>note</th>
            </tr>
          </thead>
          <tbody>
            {payload.defects.length ? payload.defects.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.severity}</td>
                <td>{item.reproducible}</td>
                <td>{item.suggestion}</td>
                <td>{item.note}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5}>无缺陷</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

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
  const pausedTasks = poolBoard.filter((item) => ['paused', 'pause'].includes(item.status))
  const doneTasks = poolBoard.filter((item) => ['success', 'done', 'cancelled', 'failed'].includes(item.status))
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

  const renderTaskCard = (
    item: AutoTaskBoardItem,
    tone: 'running' | 'queue' | 'paused' | 'done',
    index: number,
  ) => {
    const isBusy = Boolean(controlLoadingTask)
    const updatedAt = item.updated_at || item.timestamp || item.queued_at || '-'
    const resultText = item.result?.content ?? ''
    const expanded = expandedTaskName === item.task_name
    const routeChain = getRouteChain(item)
    const externalPartnerMode = getExternalPartnerMode(item)
    const flags = [
      item.auto_generated ? 'auto_generated' : '',
      item.trigger_source ? `trigger_${item.trigger_source}` : '',
      item.predicted_risk ? `risk_${item.predicted_risk}` : '',
      item.predicted_block ? 'predicted_block' : '',
      item.attention ? 'attention' : '',
      item.stuck ? 'stuck' : '',
      item.abnormal ? 'abnormal' : '',
      item.need_human ? 'need_human' : '',
      item.auto_action ? `auto_${item.auto_action}` : '',
    ].filter(Boolean)

    return (
      <article className={`scheduler-task-card scheduler-task-card-${tone}`} key={`${tone}-${item.task_name}-${index}`}>
        <div className="scheduler-task-top">
          <strong>{item.task_name}</strong>
          <span className={`scheduler-status scheduler-status-${item.status}`}>{item.status}</span>
        </div>
        <div className="scheduler-task-meta-grid">
          <span>agent: {item.agent}</span>
          <span>pool: {item.instance_pool ?? '-'}</span>
          <span>domain: {item.domain ?? '-'}</span>
          <span>parent_task_id: {item.parent_task_id ?? '-'}</span>
          <span>scenario_id: {item.scenario_id ?? '-'}</span>
          <span>task_group: {item.task_group_label ?? '-'}</span>
          <span>task_group_id: {item.task_group_id ?? '-'}</span>
          <span>template_source: {item.template_source ?? item.template_key ?? '-'}</span>
          <span>subdomain: {item.subdomain ?? '-'}</span>
          <span>project_line: {item.project_line ?? '-'}</span>
          <span>brand_display: {item.brand_display ?? item.brand_line ?? '-'}</span>
          <span>mcn_display: {item.mcn_display ?? item.mcn_line ?? '-'}</span>
          <span>account_display: {item.account_display ?? item.account_line ?? '-'}</span>
          <span>account_type: {item.account_type ?? '-'}</span>
          <span>tier: {item.tier ?? '-'}</span>
          <span>route_result: {item.route_result ?? '-'}</span>
          <span>route_target: {item.route_target ?? '-'}</span>
          <span>can_close_deal: {typeof item.can_close_deal === 'boolean' ? String(item.can_close_deal) : '-'}</span>
          <span>notify_mode: {item.notify_mode ?? '-'}</span>
          <span>target_group_id: {item.target_group_id ?? '-'}</span>
          <span>preferred_agent: {item.preferred_agent ?? '-'}</span>
          <span>assigned_agent: {item.assigned_agent ?? '-'}</span>
          <span>target_system: {item.target_system ?? '-'}</span>
          <span>template_task_index: {item.template_task_index ?? '-'}</span>
          <span>slot_id: {item.slot_id ?? '-'}</span>
          <span>status: {item.status}</span>
          <span>auto_generated: {item.auto_generated ? 'true' : 'false'}</span>
          <span>trigger_source: {item.trigger_source ?? '-'}</span>
          <span>predicted_risk: {item.predicted_risk ?? '-'}</span>
          <span>predicted_block: {item.predicted_block ? 'true' : 'false'}</span>
          <span>dependency_status: {item.dependency_status ?? ((item.blocked_by?.length ?? 0) > 0 ? 'blocked' : 'ready')}</span>
          <span>priority: P{item.priority}</span>
          <span>user_id: {item.user_id ?? '-'}</span>
          <span>recommended_execute_at: {item.recommended_execute_at ?? '-'}</span>
          <span>retry_count: {item.retry_count ?? 0}</span>
          <span>need_human: {item.need_human ? 'true' : 'false'}</span>
          <span>human_owner: {item.human_owner ?? '-'}</span>
          <span>taken_over_at: {item.taken_over_at ?? '-'}</span>
          <span>manual_decision: {item.manual_decision ?? '-'}</span>
          <span>auto_action: {item.auto_action ?? '-'}</span>
        </div>
        {item.depends_on?.length ? (
          <div className="scheduler-task-result-block">
            <div className="scheduler-task-result-head"><strong>依赖链路</strong></div>
            <div className="scheduler-task-result-content">
              <div><span>depends_on</span><strong>{item.depends_on.join(' -> ')}</strong></div>
              <div><span>blocked_by</span><strong>{item.blocked_by?.length ? item.blocked_by.join(', ') : '-'}</strong></div>
            </div>
          </div>
        ) : null}
        <div className="scheduler-task-result-block">
          <div className="scheduler-task-result-head"><strong>路由链路</strong></div>
          <div className="scheduler-route-chain">
            {routeChain.map((segment, routeIndex) => (
              <Fragment key={`${item.task_name}-route-${routeIndex}`}>
                <span className="scheduler-route-node">{segment}</span>
                {routeIndex < routeChain.length - 1 ? <span className="scheduler-route-arrow">→</span> : null}
              </Fragment>
            ))}
          </div>
          {externalPartnerMode ? (
            <div className="scheduler-partner-mode-row">
              <span className={`scheduler-partner-mode is-${externalPartnerMode}`}>external_partner · {externalPartnerMode}</span>
            </div>
          ) : null}
        </div>
        {flags.length > 0 ? (
          <div className="auto-task-flags">
            {flags.map((flag) => (
              <span className={`auto-task-flag is-${flag}`} key={`${item.task_name}-${flag}`}>
                {flag}
              </span>
            ))}
          </div>
        ) : null}
        {item.result ? (
          <div className="scheduler-task-result-block">
            <div className="scheduler-task-result-head">
              <strong>执行结果</strong>
              <div className="scheduler-task-result-actions">
                <button
                  className="auto-task-row-btn"
                  type="button"
                  onClick={() => setExpandedTaskName(expanded ? '' : item.task_name)}
                >
                  {expanded ? '收起' : '展开'}
                </button>
                <button
                  className="auto-task-row-btn"
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(resultText)
                      setCopyState(item.task_name)
                      window.setTimeout(() => setCopyState((current) => (current === item.task_name ? '' : current)), 1500)
                    } catch {
                      setCopyState('copy-failed')
                    }
                  }}
                >
                  {copyState === item.task_name ? '已复制' : '复制'}
                </button>
              </div>
            </div>
            {expanded ? (
              <div className="scheduler-task-result-content">
                <div><span>type</span><strong>{item.result.type}</strong></div>
                <div><span>content</span><pre>{item.result.content}</pre></div>
              </div>
            ) : null}
          </div>
        ) : null}
        {item.decision_log?.length ? (
          <div className="scheduler-task-result-block">
            <div className="scheduler-task-result-head"><strong>自动决策</strong></div>
            <div className="scheduler-task-result-content">
              <div><span>last_action</span><strong>{item.auto_action ?? '-'}</strong></div>
              <div><span>memory_hits</span><strong>{item.memory_hits?.join(', ') || '-'}</strong></div>
              <div><span>profile_tags</span><strong>{item.profile_tags?.join(', ') || '-'}</strong></div>
              <div><span>decision_log</span><pre>{item.decision_log.map((entry) => formatDecisionLogEntry(entry)).join('\n')}</pre></div>
              <div><span>decision_detail</span>
                <div className="scheduler-decision-detail-list">
                  {item.decision_log.map((entry, entryIndex) => (
                    <article className="scheduler-decision-detail-card" key={`${item.task_name}-decision-${entryIndex}`}>
                      <strong>{entry.action}</strong>
                      <p>规则命中原因: {entry.rule_hit_reason ?? entry.reason}</p>
                      <p>白名单命中: {entry.whitelist_hit ?? '-'}</p>
                      <p>拦截原因: {entry.block_reason ?? '-'}</p>
                      {entry.partner_mode ? <p>external_partner: {entry.partner_mode}</p> : null}
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="scheduler-task-foot">
          <span>{updatedAt}</span>
          <div className="auto-task-actions">
            {tone === 'running' ? (
              <>
                <button className="auto-task-row-btn" type="button" onClick={() => controlTask(item.task_name, 'pause')} disabled={running || !!autoRetryState || isBusy}>
                  {controlLoadingTask === `${item.task_name}:pause` ? '执行中...' : '暂停'}
                </button>
                <button className="auto-task-row-btn" type="button" onClick={() => controlTask(item.task_name, 'cancel')} disabled={running || !!autoRetryState || isBusy}>
                  {controlLoadingTask === `${item.task_name}:cancel` ? '执行中...' : '取消'}
                </button>
              </>
            ) : null}
            {tone === 'queue' ? (
              <>
                <button className="auto-task-row-btn" type="button" onClick={() => controlTask(item.task_name, 'priority_up')} disabled={running || !!autoRetryState || isBusy}>
                  {controlLoadingTask === `${item.task_name}:priority_up` ? '执行中...' : '提优先级'}
                </button>
                <button className="auto-task-row-btn" type="button" onClick={() => controlTask(item.task_name, 'priority_down')} disabled={running || !!autoRetryState || isBusy}>
                  {controlLoadingTask === `${item.task_name}:priority_down` ? '执行中...' : '降优先级'}
                </button>
              </>
            ) : null}
            {tone === 'paused' ? (
              <button className="auto-task-row-btn" type="button" onClick={() => controlTask(item.task_name, 'resume')} disabled={running || !!autoRetryState || isBusy}>
                {controlLoadingTask === `${item.task_name}:resume` ? '执行中...' : '恢复'}
              </button>
            ) : null}
            {tone === 'done' && item.status === 'failed' ? (
              <button className="auto-task-row-btn" type="button" onClick={() => retryTask(item.task_name)} disabled={running || !!autoRetryState || isBusy}>
                {autoRetryState?.taskName === item.task_name ? '自动重试中...' : '重试'}
              </button>
            ) : null}
            {item.need_human ? (
              <>
                <button className="auto-task-row-btn" type="button" onClick={() => manualControlTask(item.task_name, 'takeover')} disabled={running || !!autoRetryState || isBusy}>
                  {controlLoadingTask === `${item.task_name}:takeover` ? '执行中...' : '接管'}
                </button>
                <button className="auto-task-row-btn" type="button" onClick={() => manualControlTask(item.task_name, 'assign')} disabled={running || !!autoRetryState || isBusy}>
                  {controlLoadingTask === `${item.task_name}:assign` ? '执行中...' : '指派'}
                </button>
                <button className="auto-task-row-btn" type="button" onClick={() => manualControlTask(item.task_name, 'ignore')} disabled={running || !!autoRetryState || isBusy}>
                  {controlLoadingTask === `${item.task_name}:ignore` ? '执行中...' : '忽略'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </article>
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
          <h3>Scheduler 调度系统中枢</h3>
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
            <>
              <section className="scheduler-overview-card">
                <div className="scheduler-section-title">主任务 / 场景任务组进度</div>
                {parentTaskViews.length ? (
                  <div className="scheduler-parent-task-list">
                    {parentTaskViews.slice(0, 6).map((parent) => (
                      <article className="scheduler-parent-task-card" key={parent.id}>
                        <div className="scheduler-parent-task-top">
                          <strong>{parent.title}</strong>
                          <span>{parent.template}</span>
                        </div>
                        <div className="scheduler-parent-task-meta">
                          <span>子任务 {parent.childCount}</span>
                          <span>进度 {parent.progress}%</span>
                          <span>阻塞点 {parent.blockedPoint}</span>
                        </div>
                        <div className="scheduler-parent-task-domains">
                          {parent.domains.map((domain) => (
                            <span key={`${parent.id}-${domain}`} className="scheduler-parent-domain-chip">{domain}</span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <div className="auto-task-empty">暂无主任务进度</div>}
                {taskGroups.length ? (
                  <div className="scheduler-task-groups">
                    {taskGroups.slice(0, 6).map((group) => (
                      <div className="scheduler-task-group-chip" key={group.id}>
                        <strong>{group.label}</strong>
                        <span>{group.template} · {group.count} tasks · {group.domain} / {group.projectLine}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="scheduler-overview-card">
                <div className="scheduler-section-title">运营摘要</div>
                <div className="scheduler-overview-grid scheduler-overview-grid-ops">
                  <div className="scheduler-overview-metric"><span>今日 auto_generated</span><strong>{todayAutoGeneratedTasks.length}</strong></div>
                  <div className="scheduler-overview-metric is-warning"><span>predicted_risk</span><strong>{riskSummary.predictedHigh}</strong></div>
                  <div className="scheduler-overview-metric is-warning"><span>need_human</span><strong>{riskSummary.needHuman}</strong></div>
                  <div className="scheduler-overview-metric is-failed"><span>blocked</span><strong>{riskSummary.blocked}</strong></div>
                  <div className="scheduler-overview-metric is-warning"><span>external_blocked</span><strong>{riskSummary.externalBlocked}</strong></div>
                  <div className="scheduler-overview-metric"><span>lead_transferred</span><strong>{riskSummary.leadTransferred}</strong></div>
                  <div className="scheduler-overview-metric is-concurrency"><span>同步状态</span><strong>{loading ? '刷新中' : '已同步'}</strong></div>
                </div>
                <div className="scheduler-summary-grid">
                  <div className="scheduler-decisions-card">
                    <div className="scheduler-section-title">各 domain 负载摘要</div>
                    <div className="scheduler-decision-list">
                      {domainLoadSummary.length ? domainLoadSummary.map((entry) => (
                        <article className="scheduler-decision-item" key={entry.domain}>
                          <div className="scheduler-decision-top"><strong>{entry.domain}</strong><span>{entry.total} tasks</span></div>
                          <p>running {entry.running} · queued {entry.queued}</p>
                          <small>blocked {entry.blocked} · need_human {entry.needHuman}</small>
                        </article>
                      )) : <div className="auto-task-empty">暂无 domain 负载数据</div>}
                    </div>
                  </div>
                  <section className="scheduler-decisions-card scheduler-pending-human-card">
                    <div className="scheduler-section-title">待人工处理摘要</div>
                    <div className="scheduler-decision-list">
                      {humanPendingTasks.length ? humanPendingTasks.slice(0, 8).map((item, index) => {
                        const latestDecision = [...(item.decision_log ?? [])].slice(-1)[0]
                        return (
                          <article className="scheduler-decision-item scheduler-human-item" key={`${item.task_name}-ops-human-${index}`}>
                            <div className="scheduler-decision-top"><strong>{item.task_name}</strong><span>{item.domain ?? '-'}</span></div>
                            <p>{latestDecision?.reason ?? 'need_human'}</p>
                            <small>{item.human_owner ?? '-'} · {latestDecision?.detail ?? item.manual_decision ?? '-'}</small>
                          </article>
                        )
                      }) : <div className="auto-task-empty">暂无待人工处理任务</div>}
                    </div>
                  </section>
                </div>
              </section>
            </>
          ) : null}

          {activeView === 'execution' ? (
            <>
              <section className="scheduler-overview-card">
                <div className="scheduler-section-title">当前实例池任务</div>
                <div className="scheduler-pool-overview">
                  {poolTabs.map((pool) => (
                    <button
                      key={pool.key}
                      type="button"
                      className={`scheduler-pool-card ${normalizedActivePool === pool.key ? 'is-active' : ''} is-${pool.health}`}
                      onClick={() => setActivePool(pool.key)}
                    >
                      <div className="scheduler-pool-card-top"><strong>{pool.label}</strong><span>{pool.health}</span></div>
                      <div className="scheduler-pool-card-metrics"><span>并发 {pool.running_count}/{pool.max_concurrency}</span><span>queue {pool.queue_count}</span></div>
                    </button>
                  ))}
                </div>
                <div className="scheduler-overview-grid">
                  <div className="scheduler-overview-metric is-concurrency"><span>running</span><strong>{executionStatusSummary.running}</strong></div>
                  <div className="scheduler-overview-metric"><span>queued</span><strong>{executionStatusSummary.queued}</strong></div>
                  <div className="scheduler-overview-metric is-failed"><span>blocked</span><strong>{executionStatusSummary.blocked}</strong></div>
                  <div className="scheduler-overview-metric is-warning"><span>need_human</span><strong>{executionStatusSummary.needHuman}</strong></div>
                  <div className="scheduler-overview-metric"><span>pool</span><strong>{normalizedActivePool}</strong></div>
                </div>
              </section>

              <section className="scheduler-queue-card">
                <div className="scheduler-section-title">调度队列 · {normalizedActivePool}</div>
                <div className="scheduler-queue-grid">
                  <div className="scheduler-lane">
                    <div className="scheduler-lane-head"><h4>Running</h4><span>{runningTasks.length}</span></div>
                    <div className="scheduler-lane-list">{runningTasks.length ? runningTasks.map((item, index) => renderTaskCard(item, 'running', index)) : <div className="auto-task-empty">暂无 Running 任务</div>}</div>
                  </div>
                  <div className="scheduler-lane">
                    <div className="scheduler-lane-head"><h4>Queued</h4><span>{queuedTasks.length}</span></div>
                    <div className="scheduler-lane-list">{queuedTasks.length ? queuedTasks.map((item, index) => renderTaskCard(item, 'queue', index)) : <div className="auto-task-empty">暂无 Queued 任务</div>}</div>
                  </div>
                  <div className="scheduler-lane">
                    <div className="scheduler-lane-head"><h4>Blocked</h4><span>{executionStatusSummary.blocked}</span></div>
                    <div className="scheduler-lane-list">{poolBoard.filter((item) => item.status === 'blocked' || (item.blocked_by?.length ?? 0) > 0 || item.predicted_block).length ? poolBoard.filter((item) => item.status === 'blocked' || (item.blocked_by?.length ?? 0) > 0 || item.predicted_block).map((item, index) => renderTaskCard(item, 'paused', index)) : <div className="auto-task-empty">暂无 Blocked 任务</div>}</div>
                  </div>
                  <div className="scheduler-lane">
                    <div className="scheduler-lane-head"><h4>Need Human</h4><span>{executionStatusSummary.needHuman}</span></div>
                    <div className="scheduler-lane-list">{poolBoard.filter((item) => item.need_human).length ? poolBoard.filter((item) => item.need_human).map((item, index) => renderTaskCard(item, 'done', index)) : <div className="auto-task-empty">暂无 Need Human 任务</div>}</div>
                  </div>
                </div>
              </section>

              <div className="scheduler-summary-grid">
                <section className="scheduler-decisions-card">
                  <div className="scheduler-section-title">最近决策</div>
                  <div className="scheduler-decision-list">
                    {recentDecisions.length ? recentDecisions.map((decision, index) => (
                      <article className="scheduler-decision-item" key={`${decision.taskName}-${decision.timestamp}-${index}`}>
                        <div className="scheduler-decision-top"><strong>{decision.decision}</strong><span>{decision.timestamp}</span></div>
                        <p>{decision.taskName} · {decision.agent}</p>
                        <small>{decision.reason} · {decision.detail}</small>
                      </article>
                    )) : <div className="auto-task-empty">暂无自动决策记录</div>}
                  </div>
                </section>
                <section className="scheduler-alert-card">
                  <div className="scheduler-section-title">当前执行结果</div>
                  <div className="scheduler-alert-group">
                    {recentResults.length ? recentResults.map((entry, index) => (
                      <div className="scheduler-result-item" key={`${entry.task_name}-execution-${index}`}>
                        <strong>{entry.task_name}</strong>
                        <p>{entry.result.content}</p>
                        <small>{entry.updated_at ?? '-'}</small>
                      </div>
                    )) : <div className="auto-task-empty">暂无结果</div>}
                  </div>
                </section>
              </div>

              <div className="scheduler-summary-grid scheduler-centers-grid">
                <section className="scheduler-alert-card">
                  <div className="scheduler-section-title">发布中心</div>
                  <div className="scheduler-alert-group">
                    {publishSourceGroups.length ? publishSourceGroups.map(([sourceKey, entries], groupIndex) => (
                      <section className="scheduler-archive-group" key={`${sourceKey}-${groupIndex}`}>
                        <div className="scheduler-archive-group-head">
                          <strong>{sourceKey}</strong>
                          <span>{entries.length} 个版本</span>
                        </div>
                        <div className="scheduler-alert-group">
                    {entries.map((entry, index) => (
                      (() => {
                        const recommendedTemplates = getRecommendedTemplates(templatePool, entry.domain, entry.assetType)
                        return (
                      <article className="scheduler-result-item scheduler-center-card" key={`${entry.taskName}-publish-${index}`}>
                        <div className="scheduler-center-card-top">
                          <strong>{entry.taskName}</strong>
                          <span>{entry.domain} · {entry.assetType} · {entry.contentVariant || '-'}</span>
                        </div>
                        <div className="scheduler-publish-grid">
                          <div><span>brand_display</span><p>{entry.brandDisplay || entry.brandLine || '-'}</p></div>
                          <div><span>mcn_display</span><p>{entry.mcnDisplay || '-'}</p></div>
                          <div><span>account_display</span><p>{entry.accountDisplay || entry.accountLine || '-'}</p></div>
                          <div><span>account_type</span><p>{entry.accountType || '-'}</p></div>
                          <div><span>tier</span><p>{entry.tier || '-'}</p></div>
                          <div><span>route_result</span><p>{entry.routeResult || '-'}</p></div>
                          <div><span>route_target</span><p>{entry.routeTarget || '-'}</p></div>
                          <div><span>can_close_deal</span><p>{typeof entry.canCloseDeal === 'boolean' ? String(entry.canCloseDeal) : '-'}</p></div>
                          <div><span>distribution_channel</span><p>{entry.distributionChannel || '-'}</p></div>
                          <div><span>content_variant</span><p>{entry.contentVariant || '-'}</p></div>
                          <div><span>source_line</span><p>{entry.sourceLine || '-'}</p></div>
                          <div><span>persona</span><p>{entry.result.persona || entry.result.persona_id || '-'}</p></div>
                          <div><span>structure_type</span><p>{entry.result.structure_type || '-'}</p></div>
                          <div><span>structure_id</span><p>{entry.result.structure_id || '-'}</p></div>
                          <div><span>CTA policy</span><p>{entry.result.cta_policy || '-'}</p></div>
                          <div><span>骨架摘要</span><p>{entry.result.structure_summary || Object.keys(entry.result.section_map || {}).join(' / ') || '-'}</p></div>
                          <div><span>source_type</span><p>{entry.source?.source_type || '-'}</p></div>
                          <div><span>source_project</span><p>{entry.source?.source_project || '-'}</p></div>
                          <div><span>role_version</span><p>{entry.roleVersion || '-'}</p></div>
                          <div><span>章节标题</span><p>{entry.source?.chapter_title || '-'}</p></div>
                          <div><span>推荐发布时间</span><p>{entry.result.recommend_publish_time || '-'}</p></div>
                          <div><span>发布频率</span><p>{entry.result.recommend_frequency || '-'}</p></div>
                          <div><span>今日建议发</span><p>{typeof entry.result.publish_today === 'boolean' ? (entry.result.publish_today ? 'true' : 'false') : '-'}</p></div>
                          <div><span>建议标题</span><p>{entry.result.suggested_title || entry.result.title || '-'}</p></div>
                          <div><span>首评建议</span><p>{entry.result.suggested_first_comment || '-'}</p></div>
                          <div><span>互动问题</span><p>{entry.result.suggested_interaction_question || '-'}</p></div>
                          <div><span>风控提示</span><p>{entry.result.publish_risk_warning?.join(' / ') || '无'}</p></div>
                        </div>
                        {entry.assetType === 'media' ? (
                          <div className="scheduler-publish-grid">
                            <div><span>title</span><p>{entry.result.title || '-'}</p></div>
                            <div><span>hook</span><p>{entry.result.hook || '-'}</p></div>
                            <div><span>outline</span><p>{entry.result.outline?.join(' / ') || '-'}</p></div>
                            <div><span>script</span><p>{entry.result.script || '-'}</p></div>
                            <div><span>publish_text</span><p>{entry.result.publish_text || '-'}</p></div>
                          </div>
                        ) : null}
                        {entry.contentVariant === 'article' ? (
                          <div className="scheduler-publish-grid">
                            <div><span>structure</span><p>{entry.result.structure?.join(' / ') || entry.result.outline?.join(' / ') || '-'}</p></div>
                            <div><span>section_map</span><p>{Object.entries(entry.result.section_map || {}).map(([key, value]) => `${key}: ${value}`).join(' / ') || '-'}</p></div>
                            <div><span>full_article</span><p>{entry.result.full_article || entry.result.script || '-'}</p></div>
                          </div>
                        ) : null}
                        {entry.assetType === 'business' ? (
                          <div className="scheduler-publish-grid">
                            <div><span>摘要</span><p>{entry.result.content || entry.result.title || '-'}</p></div>
                            <div><span>跟进建议</span><p>{entry.result.publish_text || entry.result.hook || '-'}</p></div>
                          </div>
                        ) : null}
                        {entry.assetType === 'family' ? (
                          <div className="scheduler-publish-grid">
                            <div><span>学习计划</span><p>{entry.result.outline?.join(' / ') || entry.result.content || '-'}</p></div>
                            <div><span>提醒文案</span><p>{entry.result.publish_text || entry.result.hook || '-'}</p></div>
                          </div>
                        ) : null}
                        {entry.assetType === 'generic' ? (
                          <div className="scheduler-publish-grid">
                            <div><span>摘要</span><p>{entry.result.content || '-'}</p></div>
                          </div>
                        ) : null}
                        <div className="scheduler-center-actions">
                          <button className="auto-task-row-btn" type="button" onClick={async () => { await navigator.clipboard.writeText(entry.result.publish_text || entry.result.content || '') }}>
                            复制可发布内容
                          </button>
                          <button className="auto-task-row-btn" type="button" onClick={() => manualControlTask(entry.taskName, 'mark_manual_published')}>
                            {controlLoadingTask === `${entry.taskName}:mark_manual_published` ? '记录中...' : '人工已发布'}
                          </button>
                          <small>{entry.updatedAt ?? '-'}</small>
                        </div>
                        {entry.result.manual_published_at ? <small>已由 {entry.result.manual_published_by || '-'} 于 {entry.result.manual_published_at} 记录人工发布</small> : null}
                        <div className="scheduler-template-recommendations">
                          <span>推荐相似模板</span>
                          {recommendedTemplates.length ? recommendedTemplates.map((template) => (
                            <div className="scheduler-template-rec-item" key={template.template_id}>
                              <strong>{template.source_task_name ?? template.template_id}</strong>
                              <small>use_count {template.use_count}</small>
                            </div>
                          )) : <small>暂无</small>}
                        </div>
                      </article>
                        )
                      })()
                    ))}
                        </div>
                      </section>
                    )) : <div className="auto-task-empty">暂无可发布结果</div>}
                  </div>
                </section>

                <section className="scheduler-alert-card">
                  <div className="scheduler-section-title">结果沉淀中心</div>
                  <div className="scheduler-task-groups">
                    {archiveContentLineGroups.map(([line, entries]) => <div className="scheduler-task-group-chip" key={`content-${line}`}><strong>content_line</strong><span>{line} · {entries.length} 条</span></div>)}
                    {archiveAccountLineGroups.map(([line, entries]) => <div className="scheduler-task-group-chip" key={`account-${line}`}><strong>account_display</strong><span>{entries[0]?.accountDisplay || line} · {entries.length} 条</span></div>)}
                  </div>
                  <div className="scheduler-task-groups">
                    {archiveStructureGroups.map((entry) => (
                      <div className="scheduler-task-group-chip" key={`structure-${entry.structureId}`}>
                        <strong>structure_id</strong>
                        <span>{entry.structureId} · use_count {entry.count} · top_account {entry.topAccount?.[0] || '-'} ({entry.topAccount?.[1] || 0})</span>
                      </div>
                    ))}
                  </div>
                  <div className="scheduler-archive-groups">
                    {archiveDomainGroups.length ? archiveDomainGroups.map(([domain, entries]) => (
                      <section className="scheduler-archive-group" key={domain}>
                        <div className="scheduler-archive-group-head">
                          <strong>{domain}</strong>
                          <span>{entries.length} 条</span>
                        </div>
                        <div className="scheduler-alert-group">
                          {entries.map((entry, index) => (
                            (() => {
                              const recommendedTemplates = getRecommendedTemplates(templatePool, domain, entry.assetType)
                              return (
                            <article className="scheduler-result-item scheduler-center-card" key={`${entry.taskName}-archive-${index}`}>
                              <div className="scheduler-center-card-top">
                                <strong>{entry.taskName}</strong>
                                <span>{entry.assetType} · {entry.contentVariant || '-'}</span>
                              </div>
                              <div className="scheduler-publish-grid">
                                <div><span>brand_display</span><p>{entry.brandDisplay || entry.brandLine || '-'}</p></div>
                                <div><span>mcn_display</span><p>{entry.mcnDisplay || '-'}</p></div>
                                <div><span>account_display</span><p>{entry.accountDisplay || entry.accountLine || '-'}</p></div>
                                <div><span>account_type</span><p>{entry.accountType || '-'}</p></div>
                                <div><span>tier</span><p>{entry.tier || '-'}</p></div>
                                <div><span>route_result</span><p>{entry.routeResult || '-'}</p></div>
                                <div><span>route_target</span><p>{entry.routeTarget || '-'}</p></div>
                                <div><span>can_close_deal</span><p>{typeof entry.canCloseDeal === 'boolean' ? String(entry.canCloseDeal) : '-'}</p></div>
                                <div><span>distribution_channel</span><p>{entry.distributionChannel || '-'}</p></div>
                                <div><span>content_variant</span><p>{entry.contentVariant || '-'}</p></div>
                                <div><span>source_line</span><p>{entry.sourceLine || '-'}</p></div>
                                <div><span>persona</span><p>{entry.result.persona || entry.result.persona_id || '-'}</p></div>
                                <div><span>structure_type</span><p>{entry.result.structure_type || '-'}</p></div>
                                <div><span>structure_id</span><p>{entry.result.structure_id || '-'}</p></div>
                                <div><span>CTA policy</span><p>{entry.result.cta_policy || '-'}</p></div>
                                <div><span>骨架摘要</span><p>{entry.result.structure_summary || Object.keys(entry.result.section_map || {}).join(' / ') || '-'}</p></div>
                                <div><span>source_type</span><p>{entry.source?.source_type || '-'}</p></div>
                                <div><span>source_project</span><p>{entry.source?.source_project || '-'}</p></div>
                                <div><span>role_version</span><p>{entry.roleVersion || '-'}</p></div>
                                <div><span>章节标题</span><p>{entry.source?.chapter_title || '-'}</p></div>
                              </div>
                              <p>{entry.result.content || entry.result.publish_text || '-'}</p>
                              <div className="scheduler-center-actions">
                                <button className="auto-task-row-btn" type="button" onClick={async () => { await navigator.clipboard.writeText(JSON.stringify(entry.result, null, 2)) }}>
                                  复制
                                </button>
                                <button className="auto-task-row-btn" type="button" onClick={() => markTemplateSource(entry.taskName)}>
                                  {controlLoadingTask === `${entry.taskName}:mark_template_source` ? '标记中...' : '标记为模板来源'}
                                </button>
                                <small>{entry.updatedAt ?? '-'}</small>
                              </div>
                              <div className="scheduler-template-recommendations">
                                <span>推荐相似模板</span>
                                {recommendedTemplates.length ? recommendedTemplates.map((template) => (
                                  <div className="scheduler-template-rec-item" key={template.template_id}>
                                    <strong>{template.source_task_name ?? template.template_id}</strong>
                                    <small>use_count {template.use_count}</small>
                                  </div>
                                )) : <small>暂无</small>}
                              </div>
                            </article>
                              )
                            })()
                          ))}
                        </div>
                      </section>
                    )) : <div className="auto-task-empty">暂无可沉淀结果</div>}
                  </div>
                </section>
              </div>
            </>
          ) : null}

          {activeView === 'routing' ? (
            <>
              <section className="scheduler-overview-card">
                <div className="scheduler-section-title">内容归属决策表</div>
                <div className="scheduler-routing-table-wrap">
                  <table className="scheduler-routing-table">
                    <thead>
                      <tr>
                        <th>content_line</th>
                        <th>brand_line</th>
                        <th>account_line</th>
                        <th>account_type</th>
                        <th>tier</th>
                        <th>can_close_deal</th>
                        <th>route_target</th>
                        <th>tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routingDecisionTable.map((row) => (
                        <tr key={row.key}>
                          <td>{row.content_line}</td>
                          <td>{row.brand_line}</td>
                          <td>{row.account_line}</td>
                          <td>{row.account_type}</td>
                          <td>{row.tier}</td>
                          <td>{row.can_close_deal}</td>
                          <td>{row.route_target}</td>
                          <td>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="scheduler-queue-card">
                <div className="scheduler-section-title">任务路由可视化</div>
                <div className="scheduler-route-card-list">
                  {routeFocusedTasks.length ? routeFocusedTasks.map((item, index) => renderTaskCard(item, item.route_result === 'blocked' ? 'paused' : item.route_result === 'transfer' ? 'done' : 'queue', index)) : <div className="auto-task-empty">暂无路由数据</div>}
                </div>
              </section>
            </>
          ) : null}

          {activeView === 'debug' && currentProfile ? (
            <section className="scheduler-overview-card">
              <div className="scheduler-section-title">用户画像卡片</div>
              <div className="scheduler-task-result-content">
                <div><span>user_id</span><strong>{currentProfile.user_id}</strong></div>
                <div><span>tags</span><strong>{currentProfile.tags.join(' / ') || '-'}</strong></div>
                <div><span>preferences</span><pre>{JSON.stringify(currentProfile.preferences, null, 2)}</pre></div>
                <div><span>behavior_patterns</span><pre>{JSON.stringify(currentProfile.behavior_patterns, null, 2)}</pre></div>
              </div>
            </section>
          ) : null}

          {activeView === 'debug' ? (
          <>
          <section className="scheduler-overview-card">
            <div className="scheduler-section-title">调度概览</div>
            {parentTaskViews.length ? (
              <div className="scheduler-parent-task-list">
                {parentTaskViews.slice(0, 6).map((parent) => (
                  <article className="scheduler-parent-task-card" key={parent.id}>
                    <div className="scheduler-parent-task-top">
                      <strong>{parent.title}</strong>
                      <span>{parent.template}</span>
                    </div>
                    <div className="scheduler-parent-task-meta">
                      <span>子任务 {parent.childCount}</span>
                      <span>进度 {parent.progress}%</span>
                      <span>blocked {parent.blockedPoint}</span>
                    </div>
                    <div className="scheduler-parent-task-domains">
                      {parent.domains.map((domain) => (
                        <span key={`${parent.id}-${domain}`} className="scheduler-parent-domain-chip">{domain}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {taskGroups.length ? (
              <div className="scheduler-task-groups">
                {taskGroups.slice(0, 6).map((group) => (
                  <div className="scheduler-task-group-chip" key={group.id}>
                    <strong>{group.label}</strong>
                    <span>{group.template} · {group.count} tasks · {group.domain} / {group.projectLine}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="scheduler-pool-overview">
              {poolTabs.map((pool) => (
                <button
                  key={pool.key}
                  type="button"
                  className={`scheduler-pool-card ${normalizedActivePool === pool.key ? 'is-active' : ''} is-${pool.health}`}
                  onClick={() => setActivePool(pool.key)}
                >
                  <div className="scheduler-pool-card-top">
                    <strong>{pool.label}</strong>
                    <span>{pool.health}</span>
                  </div>
                  <div className="scheduler-pool-card-metrics">
                    <span>并发 {pool.running_count}/{pool.max_concurrency}</span>
                    <span>queue {pool.queue_count}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="scheduler-overview-grid">
              <div className="scheduler-overview-metric is-concurrency"><span>并发数</span><strong>{currentConcurrency}/{maxConcurrency}</strong></div>
              <div className="scheduler-overview-metric"><span>running_count</span><strong>{runningCount}</strong></div>
              <div className="scheduler-overview-metric"><span>queue_count</span><strong>{queueCount}</strong></div>
              <div className="scheduler-overview-metric is-warning"><span>blocked_count</span><strong>{blockedTasks.length}</strong></div>
              <div className="scheduler-overview-metric is-failed"><span>failed_count</span><strong>{failedCount}</strong></div>
              <div className="scheduler-overview-metric is-warning"><span>abnormal_count</span><strong>{abnormalCount}</strong></div>
            </div>
            <div className="scheduler-sync-line">{loading ? '调度状态: 刷新中' : '调度状态: 已同步'}</div>
          </section>

          <section className="scheduler-queue-card">
            <div className="scheduler-section-title">调度队列 · {normalizedActivePool}</div>
            <div className="scheduler-queue-grid">
              <div className="scheduler-lane">
                <div className="scheduler-lane-head"><h4>Running</h4><span>{runningTasks.length}</span></div>
                <div className="scheduler-lane-list">{runningTasks.length ? runningTasks.map((item, index) => renderTaskCard(item, 'running', index)) : <div className="auto-task-empty">暂无 Running 任务</div>}</div>
              </div>
              <div className="scheduler-lane">
                <div className="scheduler-lane-head"><h4>Queue</h4><span>{queuedTasks.length}</span></div>
                <div className="scheduler-lane-list">{queuedTasks.length ? queuedTasks.map((item, index) => renderTaskCard(item, 'queue', index)) : <div className="auto-task-empty">暂无 Queue 任务</div>}</div>
              </div>
              <div className="scheduler-lane">
                <div className="scheduler-lane-head"><h4>Paused</h4><span>{pausedTasks.length}</span></div>
                <div className="scheduler-lane-list">{pausedTasks.length ? pausedTasks.map((item, index) => renderTaskCard(item, 'paused', index)) : <div className="auto-task-empty">暂无 Paused 任务</div>}</div>
              </div>
              <div className="scheduler-lane">
                <div className="scheduler-lane-head"><h4>Done</h4><span>{doneTasks.length}</span></div>
                <div className="scheduler-lane-list">{doneTasks.length ? doneTasks.map((item, index) => renderTaskCard(item, 'done', index)) : <div className="auto-task-empty">暂无 Done 任务</div>}</div>
              </div>
            </div>
          </section>

          <section className="scheduler-decisions-card">
            <div className="scheduler-section-title">最近决策</div>
            <div className="scheduler-decision-list">
              {recentDecisions.length ? recentDecisions.map((decision, index) => (
                <article className="scheduler-decision-item" key={`${decision.taskName}-${decision.timestamp}-${index}`}>
                  <div className="scheduler-decision-top">
                    <strong>{decision.decision}</strong>
                    <span>{decision.timestamp}</span>
                  </div>
                  <p>{decision.taskName} · {decision.agent}</p>
                  <small>{decision.reason} · {decision.detail}{decision.decision === 'retry' ? ` · retry_count ${decision.retryCount}` : ''}</small>
                </article>
              )) : <div className="auto-task-empty">暂无自动决策记录</div>}
            </div>
          </section>

          <section className="scheduler-decisions-card scheduler-pending-human-card">
            <div className="scheduler-section-title">待人工处理</div>
            <div className="scheduler-decision-list">
              {humanPendingTasks.length ? humanPendingTasks.map((item, index) => {
                const latestDecision = [...(item.decision_log ?? [])].slice(-1)[0]
                return (
                  <article className="scheduler-decision-item scheduler-human-item" key={`${item.task_name}-human-${index}`}>
                    <div className="scheduler-decision-top">
                      <strong>{item.task_name}</strong>
                      <span>{item.domain ?? '-'}</span>
                    </div>
                    <p>reason: {latestDecision?.reason ?? 'need_human'}</p>
                    <small>human_owner: {item.human_owner ?? '-'} · latest decision: {latestDecision?.detail ?? item.manual_decision ?? '-'}</small>
                    <div className="auto-task-actions scheduler-human-actions">
                      <button className="auto-task-row-btn" type="button" onClick={() => manualControlTask(item.task_name, 'manual_done')} disabled={running || !!autoRetryState || !!controlLoadingTask}>已处理</button>
                      <button className="auto-task-row-btn" type="button" onClick={() => manualControlTask(item.task_name, 'manual_continue')} disabled={running || !!autoRetryState || !!controlLoadingTask}>继续执行</button>
                      <button className="auto-task-row-btn" type="button" onClick={() => manualControlTask(item.task_name, 'assign')} disabled={running || !!autoRetryState || !!controlLoadingTask}>转人工</button>
                    </div>
                  </article>
                )
              }) : <div className="auto-task-empty">暂无待人工处理任务</div>}
            </div>
          </section>
          </>
          ) : null}
        </div>

        {activeView === 'debug' ? (
        <aside className="scheduler-alert-card">
          <div className="scheduler-section-title">群通知回执</div>
          <div className="scheduler-notice-tabs" role="tablist" aria-label="群通知域名切换">
            {notificationTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`scheduler-notice-tab ${activeNoticeDomain === tab.key ? 'is-active' : ''}`}
                onClick={() => setActiveNoticeDomain(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="scheduler-alert-group">
            {visibleNotifications.length ? visibleNotifications.map((notice) => (
              <div className={`scheduler-alert-item scheduler-notice-card is-${notice.event_type === 'task_failed' ? 'critical' : notice.event_type === 'task_warning' || notice.event_type === 'task_need_human' ? 'warning' : 'abnormal'}`} key={notice.id}>
                <strong>{notice.target_group}</strong>
                <pre>{notice.message || `【${notice.event_type === 'task_warning' ? '任务告警' : '任务完成'}】\ntask_id：${notice.task_id ?? '-'}\ntask_name：${notice.task_name}\ndomain：${notice.domain}\nassigned_agent：${notice.assigned_agent}\n状态：${notice.status}\n摘要：${notice.summary}\n👉 查看：/scheduler`}</pre>
                {notice.event_type === 'task_need_human' ? (
                  <div className="auto-task-actions scheduler-human-actions">
                    <button className="auto-task-row-btn" type="button" onClick={() => groupNotificationAction(notice, 'done')} disabled={running || !!autoRetryState || !!controlLoadingTask}>已处理</button>
                    <button className="auto-task-row-btn" type="button" onClick={() => groupNotificationAction(notice, 'continue')} disabled={running || !!autoRetryState || !!controlLoadingTask}>继续执行</button>
                    <button className="auto-task-row-btn" type="button" onClick={() => groupNotificationAction(notice, 'transfer')} disabled={running || !!autoRetryState || !!controlLoadingTask}>转人工</button>
                  </div>
                ) : null}
                <small>{notice.task_id ?? '-'} · {notice.project_line ?? '-'} · {notice.notify_mode ?? '-'} · {notice.target_group_id ?? '-'} · {notice.delivery} · {notice.created_at}</small>
              </div>
            )) : <div className="auto-task-empty">暂无通知回执</div>}
          </div>
          <div className="scheduler-section-title">最近结果</div>
          <div className="scheduler-alert-group">
            {recentResults.length ? recentResults.map((entry, index) => (
              <div className="scheduler-result-item" key={`${entry.task_name}-${index}`}>
                <strong>{entry.task_name}</strong>
                <p>{entry.result.content}</p>
                <small>{entry.updated_at ?? '-'}</small>
              </div>
            )) : <div className="auto-task-empty">暂无结果</div>}
          </div>
          <div className="scheduler-section-title">系统告警</div>
          <div className="scheduler-alert-group">
            <h4>连续失败任务</h4>
            {continuousFailedTasks.length ? continuousFailedTasks.map((item, index) => (
              <div className="scheduler-alert-item is-critical" key={`failed-${item.task_name}-${index}`}>{item.task_name} · {item.agent}</div>
            )) : <div className="auto-task-empty">暂无连续失败任务</div>}
          </div>
          <div className="scheduler-alert-group">
            <h4>stuck 任务</h4>
            {stuckTasks.length ? stuckTasks.map((item, index) => (
              <div className="scheduler-alert-item is-warning" key={`stuck-${item.task_name}-${index}`}>{item.task_name} · {item.agent}</div>
            )) : <div className="auto-task-empty">暂无 stuck 任务</div>}
          </div>
          <div className="scheduler-alert-group">
            <h4>异常任务</h4>
            {abnormalTasks.length ? abnormalTasks.map((item, index) => (
              <div className="scheduler-alert-item is-abnormal" key={`abnormal-${item.task_name}-${index}`}>{item.task_name} · {item.agent}</div>
            )) : <div className="auto-task-empty">暂无 abnormal / attention 任务</div>}
          </div>
          {(data?.system_alerts?.length ?? 0) > 0 ? (
            <div className="scheduler-alert-group">
              <h4>系统级告警</h4>
              {data?.system_alerts?.map((alert, index) => (
                <div className={`scheduler-alert-item is-${alert.level}`} key={`sys-alert-${index}`}>{alert.task_name || '-'} · {alert.agent || '-'} · {alert.reason}</div>
              ))}
            </div>
          ) : null}
        </aside>
        ) : null}
      </div>

      <SystemTestResultPanel />
    </section>
  )
}

export function DashboardPage() {
  const systemModeState = useSystemMode()
  const {
    agents,
    projects,
    rooms,
    tasks,
    updates,
    isLoading,
    activeDataSource,
    isFallback,
    mode,
    instances,
    lastSyncedAtMs,
    pollingIntervalMs,
  } = useOfficeInstances()
  const navigate = useNavigate()
  const [actionMessage, setActionMessage] = useState<string>('')

  const items = useMemo(() => {
    const base = buildHomeItems(agents, projects, rooms, tasks)
    if (mode !== 'internal') return base
    return base.map((item) => ({
      ...item,
      taskLine: formatAgentTaskLine(tasks, item.agentId),
    }))
  }, [agents, projects, rooms, tasks, mode])
  const blockers = items.filter((item) => item.status === 'blocker')
  const actives = items.filter((item) => item.status === 'active')
  const idles = items.filter((item) => item.status === 'idle')
  const recentUpdates = updates.slice(0, 4)
  const showInternalCockpit = mode === 'internal'
  const liveOpenClaw = activeDataSource === 'openclaw' && !isFallback && instances.length > 0

  const openProject = (projectId: string) => {
    navigate({ pathname: '/projects', search: createFocusSearch('', 'project', projectId) })
  }

  const goFocus = (pathname: string, focusType: 'project' | 'agent' | 'room' | 'task', focusId?: string) => {
    if (!focusId) return
    navigate({ pathname, search: createFocusSearch('', focusType, focusId) })
  }

  const blockerActions = (item: HomeItem): ActionItem[] => [
    {
      label: '去处理',
      onClick: () => goFocus('/tasks', 'task', item.taskId || item.agentId),
      disabled: !item.taskId,
    },
    {
      label: '去房间',
      onClick: () => goFocus('/rooms', 'room', item.roomId),
      disabled: !item.roomId,
      quiet: true,
    },
    ...(showInternalCockpit
      ? []
      : [
          {
            label: '标记完成',
            onClick: () => setActionMessage(`${item.name} 的“标记完成”已预留，当前先做触发占位。`),
            quiet: true,
          } satisfies ActionItem,
        ]),
  ]

  const activeActions = (item: HomeItem): ActionItem[] =>
    showInternalCockpit
      ? [
          {
            label: '查看任务',
            onClick: () => goFocus('/tasks', 'task', item.taskId),
            disabled: !item.taskId,
          },
          {
            label: '实例详情',
            onClick: () => goFocus('/agents', 'agent', item.agentId),
            quiet: true,
          },
        ]
      : [
          {
            label: '查看任务',
            onClick: () => goFocus('/tasks', 'task', item.taskId),
            disabled: !item.taskId,
          },
          {
            label: '介入',
            onClick: () => goFocus('/agents', 'agent', item.agentId),
            quiet: true,
          },
          {
            label: '暂停',
            onClick: () => setActionMessage(`${item.name} 的“暂停”已预留，当前未接 workflow。`),
            quiet: true,
          },
        ]

  const idleActions = (item: HomeItem): ActionItem[] =>
    showInternalCockpit
      ? [
          {
            label: '打开实例',
            onClick: () => goFocus('/agents', 'agent', item.agentId),
          },
        ]
      : [
          {
            label: '分配任务',
            onClick: () => goFocus('/agents', 'agent', item.agentId),
          },
          {
            label: '拉入项目',
            onClick: () => goFocus('/projects', 'project', item.projectId),
            quiet: true,
            disabled: !item.projectId,
          },
        ]

  const viewUpdateDetail = (update: UpdateItem) => {
    if (update.taskId) {
      goFocus('/tasks', 'task', update.taskId)
      return
    }
    if (update.roomId) {
      goFocus('/rooms', 'room', update.roomId)
      return
    }
    if (update.agentId) {
      goFocus('/agents', 'agent', update.agentId)
      return
    }
    if (update.projectId) {
      goFocus('/projects', 'project', update.projectId)
      return
    }
    setActionMessage(`更新 ${update.id} 暂无详情目标。`)
  }

  if (showInternalCockpit) {
    return (
      <section className="page home-page-v1 home-page--internal-control">
        <div className="page-header home-header home-header--compact home-header--internal-dash">
          <div className="page-brand-head">
            <div className="page-brand-logo-wrap" aria-hidden="true">
              <img className="page-brand-logo" src={brandAssets.logo} alt="" />
            </div>
            <div>
              <p className="eyebrow">{BRAND_NAME}</p>
              <h2>{BRAND_NAME}</h2>
            </div>
          </div>
          <p className="page-note home-internal-page-note">
            核心两件事：各实例在你名下的任务完成情况；各「项目」维度的整体进度（开发、自媒体、家庭事务等可都建成项目，用进度条与阻塞数管控）。
          </p>
        </div>

        {actionMessage ? <div className="home-action-feedback">{actionMessage}</div> : null}

        <InternalControlSummary
          livePayload={liveOpenClaw}
          isLoading={isLoading}
          activeDataSource={activeDataSource}
          isFallback={isFallback}
          agents={agents}
          projects={projects}
          onOpenProject={openProject}
          onOpenAgentsIdle={() => navigate('/agents')}
          lastSyncedAtMs={lastSyncedAtMs}
          pollingIntervalMs={pollingIntervalMs}
          systemModeState={systemModeState}
        />

        <div className="home-v1-grid home-v1-grid--internal">
          <div className="home-internal-main-col">
            <AutoTaskSystemSummaryCard />
            <AuditLogPanel />
            <SectionList
              title="需处理"
              items={blockers}
              emptyText="当前没有阻塞实例。"
              getActions={blockerActions}
              statusLabels={{ blocker: '阻塞', active: '进行中', idle: '待命' }}
              updatedLabel="更新于"
            />
            <SectionList
              title="进行中"
              items={actives}
              emptyText="当前没有进行中的实例。"
              getActions={activeActions}
              statusLabels={{ blocker: '阻塞', active: '进行中', idle: '待命' }}
              updatedLabel="更新于"
            />
          </div>
          <RecentUpdates
            updates={recentUpdates}
            onViewDetail={viewUpdateDetail}
            title="最近动态"
            emptyText="暂无动态。"
            detailLabel="查看"
          />
        </div>
      </section>
    )
  }

  return (
    <section className="page home-page-v1">
      <div className="page-header home-header">
        <div className="page-brand-head">
          <div className="page-brand-logo-wrap" aria-hidden="true">
            <img className="page-brand-logo" src={brandAssets.logo} alt="" />
          </div>
          <div>
            <p className="eyebrow">{BRAND_NAME}</p>
            <h2>{BRAND_NAME}</h2>
          </div>
        </div>
        <p className="page-note">
          线上公开站为仓库内置 <strong>Mock</strong>，不依赖实机 API。克隆仓库后可在本地以 Demo / Internal 模式连接 OpenClaw。
        </p>
      </div>

      <div className="home-runtime-strip">
        <span className={`home-runtime-pill ${activeDataSource === 'openclaw' ? 'is-live' : ''}`}>
          数据源：{activeDataSource === 'openclaw' ? 'OpenClaw' : 'Mock'}
        </span>
        <span className="home-runtime-pill">刷新状态：{isLoading ? '更新中' : '已展示最新状态'}</span>
        <span className="home-runtime-pill">模式：公开演示</span>
        {isFallback ? <span className="home-runtime-pill">当前 fallback 到 Mock</span> : null}
      </div>

      {actionMessage ? <div className="home-action-feedback">{actionMessage}</div> : null}

      <div className="home-v1-grid">
        <SectionList title="Blocker" items={blockers} emptyText="No blockers right now." getActions={blockerActions} />
        <SectionList title="Active" items={actives} emptyText="No active items right now." getActions={activeActions} />
        <SectionList title="Idle" items={idles} emptyText="No idle items right now." getActions={idleActions} />
        <RecentUpdates updates={recentUpdates} onViewDetail={viewUpdateDetail} />
      </div>
    </section>
  )
}
