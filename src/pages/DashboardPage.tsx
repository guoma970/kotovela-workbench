import { useMemo, useState } from 'react'
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
  const topProjects = projects.slice(0, 6)

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
            <span className="control-project-snapshot-hint">阻塞优先 · 点击进项目板</span>
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
}

const normalizeSentence = (value?: string) => value?.trim() || 'No active task'

const buildHomeItems = (agents: Agent[], projects: Project[], rooms: Room[], tasks: Task[]): HomeItem[] => {
  return agents.map((agent) => {
    const relatedTasks = tasks.filter((task) => task.executorAgentId === agent.id)
    const blockerTask = relatedTasks.find((task) => task.status === 'blocked')
    const doingTask = relatedTasks.find((task) => task.status === 'doing')
    const relatedRoom = rooms.find((room) => room.instanceIds.includes(agent.id))
    const projectName = projects.find((project) => project.id === agent.projectId)?.name || agent.project

    if (agent.status === 'blocked' || blockerTask) {
      return {
        id: agent.id,
        name: agent.name,
        status: 'blocker',
        sentence: normalizeSentence(blockerTask?.title || agent.currentTask || `${projectName} has a blocker`),
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
        sentence: normalizeSentence(doingTask?.title || agent.currentTask),
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
      sentence: normalizeSentence(agent.currentTask || `${projectName} has no active work`),
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

  const items = useMemo(() => buildHomeItems(agents, projects, rooms, tasks), [agents, projects, rooms, tasks])
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
        <div className="page-header home-header home-header--compact">
          <div>
            <p className="eyebrow">KOTOVELA HUB</p>
            <h2>驾驶舱总览</h2>
          </div>
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
