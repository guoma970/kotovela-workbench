import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { formatLastSyncedAt } from '../lib/formatSyncTime'
import { createFocusSearch } from '../lib/workbenchLinking'
import type { Agent, Project, Room, Task, UpdateItem } from '../types'

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
  const syncStatusLine = isLoading
    ? '正在拉取 OpenClaw…'
    : activeDataSource === 'openclaw' && !isFallback
      ? `上次同步 ${formatLastSyncedAt(lastSyncedAtMs)} · 每 ${pollSec} 秒轮询`
      : isFallback
        ? `上次成功同步 ${formatLastSyncedAt(lastSyncedAtMs)} · 已回退 Mock · 每 ${pollSec} 秒重试`
        : `当前为 Mock 数据 · 未轮询 OpenClaw`

  return (
    <section className="control-summary panel strong-card">
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
  action: 'retry' | 'warning' | 'need_human' | 'notify_result' | 'manual_takeover' | 'manual_assign' | 'manual_ignore' | 'manual_done' | 'manual_continue' | 'preempt' | 'priority_up' | 'priority_down' | 'strategy_generate_task' | 'risk_detected' | 'precheck_block'
  reason: string
  detail: string
  memory_hit?: string
  profile_rule?: string
}

type UserProfile = {
  user_id: string
  tags: string[]
  preferences: Record<string, unknown>
  behavior_patterns: Record<string, unknown>
}

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
  user_id?: string
  memory_hits?: string[]
  profile_tags?: string[]
  recommended_execute_at?: string
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
  board: AutoTaskBoardItem[]
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
      .then((json: AutoTaskBoardPayload) => setData(json))
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

export function AutoTaskSystemPanel() {
  const [data, setData] = useState<AutoTaskBoardPayload | null>(null)
  const [notifications, setNotifications] = useState<TaskNotificationItem[]>([])
  const [loading, setLoading] = useState(true)
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
    ])
      .then(([json, notifyJson]) => {
        setData(json)
        setNotifications(notifyJson.notifications ?? [])
      })
      .catch(() => {
        setData(null)
        setNotifications([])
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
      setData((await res.json()) as AutoTaskBoardPayload)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '操作失败')
    } finally {
      setControlLoadingTask('')
    }
  }

  const manualControlTask = async (taskName: string, action: 'takeover' | 'assign' | 'ignore' | 'manual_done' | 'manual_continue') => {
    if (running || autoRetryState || controlLoadingTask) return
    const humanOwner = action === 'assign'
      ? window.prompt('请输入指派人', 'builder')?.trim()
      : action === 'takeover' || action === 'ignore' || action === 'manual_done' || action === 'manual_continue'
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
      setData((await res.json()) as AutoTaskBoardPayload)
      loadBoard()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '操作失败')
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

  const renderTaskCard = (
    item: AutoTaskBoardItem,
    tone: 'running' | 'queue' | 'paused' | 'done',
    index: number,
  ) => {
    const isBusy = Boolean(controlLoadingTask)
    const updatedAt = item.updated_at || item.timestamp || item.queued_at || '-'
    const resultText = item.result?.content ?? ''
    const expanded = expandedTaskName === item.task_name
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
              <div><span>decision_log</span><pre>{item.decision_log.map((entry) => `[${entry.timestamp}] ${entry.action} | ${entry.reason} | ${entry.detail}${entry.memory_hit ? ` | memory_hit=${entry.memory_hit}` : ''}${entry.profile_rule ? ` | profile_rule=${entry.profile_rule}` : ''}`).join('\n')}</pre></div>
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
  const currentProfile = data?.current_profile
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

      <div className="scheduler-hub-layout">
        <div className="scheduler-hub-main">
          {currentProfile ? (
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
        </div>

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
      </div>
    </section>
  )
}

export function DashboardPage() {
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
          <div>
            <p className="eyebrow">KOTOVELA HUB</p>
            <h2>驾驶舱总览</h2>
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
        />

        <div className="home-v1-grid home-v1-grid--internal">
          <div className="home-internal-main-col">
            <AutoTaskSystemSummaryCard />
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
        <div>
          <p className="eyebrow">开源演示</p>
          <h2>OpenClaw × KOTOVELA</h2>
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
