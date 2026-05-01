import { useEffect, useState } from 'react'
import { EvidenceObjectLinks } from '../../../components/EvidenceObjectLinks'
import { consultantSettingsConfig } from '../../../config/consultantSettings'
import { useOfficeInstances } from '../../../data/useOfficeInstances'
import { formatLastSyncedAt } from '../../../lib/formatSyncTime'
import { useWorkbenchLinking } from '../../../lib/workbenchLinking'
import type { Agent, Project, UpdateItem } from '../../../types'

export type SystemModeValue = 'dev' | 'test' | 'live'
type PublishModeValue = 'manual_only' | 'auto_disabled' | 'semi_auto'

export type SystemModeState = {
  systemMode: SystemModeValue
  publishMode: PublishModeValue
  forceStop: boolean
}

type AuditLogEntry = {
  id: string
  action: string
  user: string
  time: string
  target: string
  result: string
}

type ProjectSnapshot = Pick<Project, 'id' | 'name' | 'progress' | 'blockers'>

type HomeStatus = 'blocker' | 'active' | 'idle'

export type HomeItem = {
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
  taskLine?: string
}

export type ActionItem = {
  label: string
  onClick: () => void
  disabled?: boolean
  quiet?: boolean
}

const badgeLabel: Record<HomeStatus, string> = {
  blocker: 'BLOCKER',
  active: 'ACTIVE',
  idle: 'IDLE',
}

const consultantStatusLabel: Record<string, string> = {
  online: '在线',
  busy: '繁忙',
  offline: '离线',
}

const consultantAccountTypeLabel: Record<string, string> = {
  owned: '自有账号',
  brand: '品牌账号',
  ip: 'IP账号',
  external_partner: '外部合作方',
  demo: '演示账号',
}

const consultantRoleLabel: Record<string, string> = {
  group_leader_consultant: '团长顾问',
  material_consultant: '材料顾问',
  heating_consultant: '地暖顾问',
  residential_consultant: '住宅顾问',
  business_consultant: '业务顾问',
}

function formatConsultantStatus(value: string) {
  return consultantStatusLabel[value] ?? value
}

function formatConsultantAccountType(value: string) {
  return consultantAccountTypeLabel[value] ?? value
}

function formatConsultantRole(value: string) {
  return consultantRoleLabel[value] ?? value
}

function formatAuditAction(value: string) {
  return value
    .replace(/consultant_assigned/gi, '已完成分配')
    .replace(/system_mode/gi, '系统设置调整')
    .replace(/publish_mode/gi, '发布状态调整')
    .replace(/force_stop/gi, '紧急停止调整')
    .replace(/guardrails/gi, '安全规则调整')
    .replace(/[._-]+/g, ' ')
}

function formatAuditResult(value: string) {
  return value
    .replace(/assigned to/gi, '已分配给')
    .replace(/consultant/gi, '顾问')
    .replace(/[._-]+/g, ' ')
}

const buildProjectSnapshots = (projects: Project[]): ProjectSnapshot[] => {
  const snapshots = new Map<string, ProjectSnapshot>()
  for (const project of projects) {
    const key = project.name.trim() || project.id
    const current = snapshots.get(key)
    if (!current) {
      snapshots.set(key, {
        id: project.id,
        name: project.name,
        progress: project.progress,
        blockers: project.blockers,
      })
      continue
    }
    snapshots.set(key, {
      ...current,
      progress: Math.max(current.progress, project.progress),
      blockers: current.blockers + project.blockers,
    })
  }
  return Array.from(snapshots.values())
}

function ActionRow({ actions }: { actions: ActionItem[] }) {
  if (actions.length === 0) return null

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

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const { mode, projects, agents, rooms, tasks } = useOfficeInstances()
  const isInternal = mode === 'internal'
  const linking = useWorkbenchLinking({ projects, agents, rooms, tasks })

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

    void loadAuditLog()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="home-section panel strong-card audit-log-panel">
      <div className="home-section-head">
        <h3>最近系统动态</h3>
        <span className="home-count">{entries.length}</span>
      </div>
      {entries.length ? (
        <div className="audit-log-list">
          {entries.slice(0, 8).map((entry) => {
            const relatedAgent = agents.find((agent) =>
              [agent.id, agent.code, agent.name, agent.instanceKey].some(
                (value) => value && entry.user.toLowerCase().includes(String(value).toLowerCase()),
              ),
            )
            const relatedProject = projects.find((project) =>
              [project.id, project.code, project.name].some(
                (value) => value && entry.target.toLowerCase().includes(String(value).toLowerCase()),
              ),
            )
            const relatedTask = tasks.find((task) =>
              [task.id, task.code, task.title].some(
                (value) => value && entry.target.toLowerCase().includes(String(value).toLowerCase()),
              ),
            )
            const relatedRoom = rooms.find((room) =>
              [room.id, room.code, room.name].some(
                (value) => value && entry.target.toLowerCase().includes(String(value).toLowerCase()),
              ),
            )

            return (
              <article key={entry.id} className="audit-log-item consultant-evidence-card">
                <div className="audit-log-item-top">
                  <strong>{formatAuditAction(entry.action)}</strong>
                  <span>{entry.time}</span>
                </div>
                <p>最近处理对象：{entry.target}</p>
                <small>
                  {entry.user} · {formatAuditResult(entry.result)}
                </small>
                {isInternal ? (
                  <details className="scheduler-debug-block" style={{ marginTop: 8 }}>
                    <summary className="scheduler-task-result-head">
                      <strong>查看原始记录</strong>
                    </summary>
                    <div className="top-gap">
                      <EvidenceObjectLinks
                        textParts={[entry.action, entry.target, entry.result]}
                        signalParts={[entry.user, entry.target, entry.result]}
                        currentSearch={linking.currentSearch}
                        projects={projects}
                        agents={agents}
                        rooms={rooms}
                        tasks={tasks}
                        projectId={relatedProject?.id}
                        agentId={relatedAgent?.id}
                        roomId={relatedRoom?.id}
                        taskId={relatedTask?.id}
                        routingHints={{
                          projectSignals: [entry.target, entry.result],
                          agentSignals: [entry.user],
                          roomSignals: [entry.target],
                          taskSignals: [entry.action, entry.target],
                        }}
                      />
                    </div>
                  </details>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : (
        <p className="empty-state">还没有操作记录。</p>
      )}
    </section>
  )
}

export function ConsultantConfigSummaryCard() {
  const consultants = consultantSettingsConfig.consultants
  const activeCount = consultants.filter((item) => item.status !== 'offline').length
  const { mode, projects, agents, rooms, tasks } = useOfficeInstances()
  const isInternal = mode === 'internal'
  const linking = useWorkbenchLinking({ projects, agents, rooms, tasks })

  return (
    <section className="home-section panel strong-card audit-log-panel">
      <div className="home-section-head">
        <h3>顾问配置摘要</h3>
        <span className="home-count">{consultants.length}</span>
      </div>
      <div className="audit-log-list">
        {consultants.slice(0, 4).map((item) => {
          const relatedAgent = agents.find((agent) =>
            [agent.id, agent.code, agent.name, agent.instanceKey].some(
              (value) =>
                value &&
                [item.name, item.consultant_id].some(
                  (target) =>
                    target.toLowerCase().includes(String(value).toLowerCase()) ||
                    String(value).toLowerCase().includes(target.toLowerCase()),
                ),
            ),
          )
          const relatedProject = projects.find((project) =>
            [project.id, project.code, project.name].some(
              (value) => value && item.domain.toLowerCase().includes(String(value).toLowerCase()),
            ),
          )
          const relatedRoom = rooms.find((room) =>
            [room.id, room.code, room.name].some(
              (value) => value && item.account_type.toLowerCase().includes(String(value).toLowerCase()),
            ),
          )

          return (
            <article key={item.consultant_id} className="audit-log-item consultant-evidence-card">
              <div className="audit-log-item-top">
                <strong>{item.name}</strong>
                <span>{formatConsultantStatus(item.status)}</span>
              </div>
              <p>
                {formatConsultantRole(item.role)} · {formatConsultantAccountType(item.account_type)} · {item.domain}
              </p>
              <small>
                顾问编号 {item.consultant_id} · 当前工作量 {item.active_load}
              </small>
              {isInternal ? (
                <EvidenceObjectLinks
                  textParts={[item.name, item.role, item.domain]}
                  signalParts={[item.consultant_id, item.account_type, item.domain]}
                  currentSearch={linking.currentSearch}
                  projects={projects}
                  agents={agents}
                  rooms={rooms}
                  tasks={tasks}
                  projectId={relatedProject?.id}
                  agentId={relatedAgent?.id}
                  roomId={relatedRoom?.id}
                  routingHints={{
                    agentSignals: [item.name, item.consultant_id],
                    projectSignals: [item.domain],
                    roomSignals: [item.account_type],
                    taskSignals: [item.role],
                  }}
                />
              ) : null}
            </article>
          )
        })}
      </div>
      <div className="cross-link-row top-gap">
        <span className="inline-link-chip">应用模式 {consultantSettingsConfig.mode === 'internal' ? '内部版' : '开源版'}</span>
        <span className="inline-link-chip">活跃顾问 {activeCount}</span>
      </div>
    </section>
  )
}

export function InternalControlSummary({
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
  const blocked = agents.filter((agent) => agent.status === 'blocked').length
  const active = agents.filter((agent) => agent.status === 'active').length
  const idle = agents.filter((agent) => agent.status === 'idle').length
  const projectsWithBlockers = buildProjectSnapshots(projects).filter((project) => project.blockers > 0).length
  const topProjects = buildProjectSnapshots(projects)
    .sort((left, right) => {
      if (right.blockers !== left.blockers) return right.blockers - left.blockers
      return right.progress - left.progress
    })
    .slice(0, 6)

  const sourceLine =
    activeDataSource === 'openclaw'
      ? isFallback
        ? '当前使用演示数据'
        : livePayload
          ? '实时数据已连接'
          : '实时数据已连接'
      : '当前使用演示数据'

  const healthLine =
    blocked > 0
      ? `需关注：${blocked} 个协作者有卡点`
      : active > 0
        ? `推进中：${active} 个协作者 · 整体在推进`
        : idle === agents.length && agents.length > 0
          ? '当前没有进行中的任务 · 一切顺利'
          : '协作者数据加载中，请稍候。'

  void pollingIntervalMs
  const { systemMode, publishMode, forceStop } = systemModeState
  const systemModeTone = systemMode === 'live' ? 'is-live' : systemMode === 'test' ? 'is-test' : 'is-dev'
  const syncStatusLine = isLoading
    ? '数据加载中…'
    : activeDataSource === 'openclaw' && !isFallback
      ? `${formatLastSyncedAt(lastSyncedAtMs)} 更新 · 自动刷新`
      : isFallback
        ? `${formatLastSyncedAt(lastSyncedAtMs)} 更新 · 当前使用演示数据 · 自动刷新`
        : '当前使用演示数据'

  return (
    <section className="control-summary panel strong-card">
      <div className={`system-mode-bar ${systemModeTone}`}>
        <div className="system-mode-bar-main">
          <span className="system-mode-bar-label">系统模式</span>
          <strong className="system-mode-bar-value">{systemMode}</strong>
          <span className="system-mode-bar-divider" aria-hidden>
            /
          </span>
          <span className="system-mode-bar-label">发布状态</span>
          <strong className="system-mode-bar-value">{publishMode}</strong>
          <span className={`system-mode-flag ${forceStop ? 'is-on' : 'is-off'}`}>
            紧急停止：{forceStop ? '已开启' : '未开启'}
          </span>
        </div>
        <div className="system-mode-bar-side">
          {systemMode === 'live' ? '正式模式 · 真实业务流量已开启' : '非正式环境，仅供联调与验证'}
        </div>
      </div>

      <div className="control-summary-top">
        <div className="control-summary-title-block">
          <h2 className="control-summary-heading">中控总览</h2>
          <p className="control-summary-health">{healthLine}</p>
          <p className="control-summary-sub">
            上方：各项目整体进度（卡点多的优先）；下方：按协作者看谁在推进，并汇总该协作者名下的任务完成情况。
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
          <span className="control-metric-label">协作者</span>
          <strong className="control-metric-value">{agents.length}</strong>
        </div>
        <div className="control-metric is-blocked" role="listitem">
          <span className="control-metric-label">有卡点</span>
          <strong className="control-metric-value">{blocked}</strong>
        </div>
        <div className="control-metric is-active" role="listitem">
          <span className="control-metric-label">推进中</span>
          <strong className="control-metric-value">{active}</strong>
        </div>
        <div className="control-metric is-idle" role="listitem">
          <span className="control-metric-label">空闲</span>
          <strong className="control-metric-value">{idle}</strong>
        </div>
        <div className="control-metric" role="listitem">
          <span className="control-metric-label">项目</span>
          <strong className="control-metric-value">{projects.length}</strong>
        </div>
        <div className={`control-metric ${projectsWithBlockers > 0 ? 'is-blocked' : ''}`} role="listitem">
          <span className="control-metric-label">项目卡点</span>
          <strong className="control-metric-value">{projectsWithBlockers}</strong>
        </div>
      </div>

      {topProjects.length > 0 ? (
        <div className="control-project-snapshot">
          <div className="control-project-snapshot-head">
            <span className="control-project-snapshot-title">项目进度快照</span>
            <span className="control-project-snapshot-hint">卡点优先排序 · 点击进项目板</span>
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
                    <span className="control-project-line-badge">{project.blockers} 个卡点</span>
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
            空闲协作者 {idle} 个 — 在协作者状态页查看全部
          </button>
        </div>
      ) : null}
    </section>
  )
}

export function SectionList({
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

export function RecentUpdates({
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
