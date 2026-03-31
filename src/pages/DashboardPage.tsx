import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { ObjectBadge } from '../components/ObjectBadge'
import { StatCard } from '../components/StatCard'
import { decisions } from '../data/mockData'
import type { OfficeInstanceItem } from '../data/officeInstancesAdapter'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { createFocusSearch, getFocusTarget, parseFocusFromSearchParams, useWorkbenchLinking } from '../lib/workbenchLinking'
import type { Agent, Project, Task } from '../types'

const updateTypeLabel = {
  task: '任务更新',
  project: '项目更新',
  agent: '实例状态更新',
  room: '群动态',
}

type OperationStatus = 'doing' | 'done' | 'blocker'
type FilterMode = 'all' | 'doing' | 'blocker'

type OfficeInstance = {
  id: string
  key: string
  name: string
  role: string
  status: OperationStatus
  task: string
  updatedAt: string
  ageMs: number
  note: string
  projectRelated: string
  agentId: string
}

type InstanceMetrics = {
  activeInstances: number
  doingInstances: number
  blockedInstances: number
  doneInstances: number
}

type OfficeSeat = {
  id: string
  key: string
  name: string
  role: string
  agentId: string
}

const OFFICE_SEAT_MAP: OfficeSeat[] = [
  { id: 'seat-main', key: 'main', name: '小树', role: '中枢调度', agentId: 'agent-1' },
  { id: 'seat-zhu', key: 'builder', name: '小筑', role: '研发执行', agentId: 'agent-2' },
  { id: 'seat-guo', key: 'media', name: '小果', role: '内容助手', agentId: 'agent-3' },
  { id: 'seat-xi', key: 'family', name: '小羲', role: '家庭助手', agentId: 'agent-4' },
  { id: 'seat-yan', key: 'business', name: '小言', role: '业务助手', agentId: 'agent-5' },
  { id: 'seat-qi', key: 'ztl970', name: '小柒', role: '个人助手', agentId: 'agent-6' },
]

const officeBlueprint: OfficeSeat[] = OFFICE_SEAT_MAP

const REFRESH_INTERVAL_SECONDS = 20

const statusSentence: Record<OperationStatus, string> = {
  doing: '正在推进关键动作，等待下游确认。',
  blocker: '检测到阻塞信号，等待状态回归。',
  done: '当前未有阻塞，任务链路平稳。',
}

const operationStatusTone: Record<OperationStatus, 'doing' | 'done' | 'blocker'> = {
  doing: 'doing',
  blocker: 'blocker',
  done: 'done',
}

const normalizeStatus = (value?: string): OperationStatus => {
  if (value === 'blocker' || value === 'doing' || value === 'done') {
    return value
  }

  if (value === 'blocked' || value === 'active' || value === 'idle') {
    return value === 'blocked' ? 'blocker' : value === 'active' ? 'doing' : 'done'
  }

  return 'done'
}

const normalizeApiInstances = (
  apiInstances: OfficeInstanceItem[],
  syncedAgents: Agent[],
  syncedProjects: Project[],
): OfficeInstance[] => {
  return officeBlueprint.map((seat) => {
    const raw = apiInstances.find((item) => item.key === seat.key)
    const agent = syncedAgents.find((item) => item.id === seat.agentId)
    const relatedProject = agent
      ? (syncedProjects.find((project) => project.id === agent.projectId)?.name ?? '未绑定项目')
      : '待启用席位'

    const status = normalizeStatus(raw?.status)

    return {
      id: seat.id,
      key: seat.key,
      name: seat.name,
      role: raw?.role || seat.role,
      status,
      task: raw?.task || raw?.currentTask || agent?.currentTask || '暂无任务',
      updatedAt: raw?.ageText || raw?.updatedAt || agent?.updatedAt || '刚刚',
      ageMs: typeof raw?.ageMs === 'number' ? Math.max(0, raw.ageMs) : 0,
      note: raw?.note || statusSentence[status],
      projectRelated: raw?.projectRelated || relatedProject,
      agentId: seat.agentId,
    }
  })
}

const buildOfficeFallback = (agents: Agent[], projects: Project[], tasks: Task[]): OfficeInstance[] => {
  return officeBlueprint.map((seat) => {
    const agent = agents.find((item) => item.id === seat.agentId)
    const relatedTasks = agent ? tasks.filter((task) => task.executorAgentId === agent.id) : []
    const projectRelated = agent ? (projects.find((project) => project.id === agent.projectId)?.name ?? '未绑定项目') : '待启用席位'
    const taskSource =
      relatedTasks.find((task) => task.status === 'doing') ||
      relatedTasks.find((task) => task.status === 'blocked') ||
      relatedTasks[0] ||
      { title: agent?.currentTask || '暂无任务' }

    const status: OperationStatus =
      relatedTasks.some((task) => task.status === 'blocked') || agent?.status === 'blocked'
        ? 'blocker'
        : relatedTasks.some((task) => task.status === 'doing') || agent?.status === 'active'
          ? 'doing'
          : 'done'

    return {
      id: seat.id,
      key: seat.key,
      name: seat.name,
      role: seat.role,
      status,
      task: taskSource.title,
      updatedAt: agent?.updatedAt || '刚刚',
      ageMs: 0,
      note: statusSentence[status],
      projectRelated,
      agentId: seat.agentId,
    }
  })
}

export function DashboardPage() {
  const {
    agents,
    projects,
    rooms,
    tasks,
    updates,
    dataSource,
    isLoading,
    error,
    refresh,
    instances: rawInstances,
  } = useOfficeInstances()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [pulseIds, setPulseIds] = useState<string[]>([])
  const previousInstancesRef = useRef<OfficeInstance[]>([])

  const activeAgents = agents.filter((item) => item.status === 'active')
  const doingTasks = tasks.filter((item) => item.status === 'doing')
  const blockedTasks = tasks.filter((item) => item.status === 'blocked')
  const doneTasks = tasks.filter((item) => item.status === 'done')

  const topProject = projects.find((item) => item.id === 'project-1')
  const criticalUpdates = updates.slice(0, 3)
  const linking = useWorkbenchLinking({ projects, agents, rooms, tasks })
  const hasFocusOverlay = Boolean(getFocusTarget(parseFocusFromSearchParams(searchParams)))
  const keyTask = blockedTasks[0] ?? doingTasks[0]
  const keyFocusSearch = keyTask
    ? createFocusSearch(linking.currentSearch, 'task', keyTask.id)
    : createFocusSearch(linking.currentSearch, 'project', topProject?.id)
  const keyProjectSearch = topProject ? createFocusSearch(linking.currentSearch, 'project', topProject.id) : createFocusSearch(linking.currentSearch)

  const deriveMetricsFromInstances = (items: OfficeInstance[]): InstanceMetrics => ({
    activeInstances: items.length,
    doingInstances: items.filter((item) => item.status === 'doing').length,
    blockedInstances: items.filter((item) => item.status === 'blocker').length,
    doneInstances: items.filter((item) => item.status === 'done').length,
  })

  const officeInstances = useMemo(
    () =>
      dataSource === 'real'
        ? normalizeApiInstances(rawInstances, agents, projects)
        : buildOfficeFallback(agents, projects, tasks),
    [agents, dataSource, projects, rawInstances, tasks],
  )

  const instanceStats = useMemo(() => deriveMetricsFromInstances(officeInstances), [officeInstances])

  const filteredInstances = useMemo(() => {
    if (filter === 'all') {
      return officeInstances
    }
    return officeInstances.filter((instance) => instance.status === filter)
  }, [officeInstances, filter])

  useEffect(() => {
    const previous = previousInstancesRef.current
    if (previous.length > 0) {
      const changed = officeInstances
        .filter((item) => {
          const current = previous.find((previousItem) => previousItem.id === item.id)
          return !current || current.status !== item.status || current.task !== item.task || current.updatedAt !== item.updatedAt
        })
        .map((item) => item.id)

      if (changed.length > 0) {
        setPulseIds(changed)
      }
    }

    previousInstancesRef.current = officeInstances
    setCountdown(REFRESH_INTERVAL_SECONDS)
  }, [officeInstances])

  const refreshOffice = useCallback(() => {
    setCountdown(REFRESH_INTERVAL_SECONDS)
    refresh()
  }, [refresh])

  useEffect(() => {
    const timer = setInterval(() => {
      if (hasFocusOverlay) {
        return
      }
      setCountdown((prev) => {
        if (prev <= 1) {
          refresh()
          return REFRESH_INTERVAL_SECONDS
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [hasFocusOverlay, refresh])

  useEffect(() => {
    if (!pulseIds.length) {
      return
    }

    const t = setTimeout(() => setPulseIds([]), 1100)
    return () => clearTimeout(t)
  }, [pulseIds])

  const cardClass = (kind: 'project' | 'agent' | 'room' | 'task', id: string, base: string) => {
    const state = linking.getState(kind, id)
    return [
      base,
      state.isSelected ? 'surface-selected' : '',
      !state.isSelected && state.isRelated ? 'surface-related' : '',
      state.isDimmed ? 'surface-dimmed' : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>中枢总览</h2>
        </div>
        <p className="page-note">先看 blocker、待拍板和关键更新，再看项目、实例、群之间的承接关系。数据来源：优先读取最新状态，接口不可用时自动回退到本地快照。</p>
      </div>

      <PageLeadPanel
        heading="Dashboard"
        intro="先看全局态势（阻塞与节奏），再点进对应对象确认交付路径。"
        metrics={[
          { label: '活跃实例', value: activeAgents.length, to: { pathname: '/agents', search: '?status=active' } },
          { label: '进行中任务', value: doingTasks.length, to: { pathname: '/tasks', search: '?status=doing' } },
          { label: '阻塞项', value: blockedTasks.length, to: { pathname: '/tasks', search: '?status=blocked' } },
          { label: '已完成任务', value: doneTasks.length, to: { pathname: '/tasks', search: '?status=done' } },
          { label: '待拍板', value: decisions.length },
          { label: '项目总数', value: projects.length, to: { pathname: '/projects' } },
        ]}
        actions={
          topProject
            ? [
                {
                  label: '先看主项目 · Projects',
                  to: { pathname: '/projects', search: keyProjectSearch },
                },
                {
                  label: '先看阻塞任务 · Tasks',
                  to: { pathname: '/tasks', search: keyFocusSearch },
                },
                {
                  label: '回看主线脉络 · Rooms',
                  to: { pathname: '/rooms', search: keyProjectSearch },
                },
              ]
            : []
        }
      />


      <section className="office-shell">
        <div className="panel strong-card office-board">
          <div className="page-header">
            <div>
              <p className="eyebrow">Office Board</p>
              <h2>言町科技实例工位图</h2>
            </div>
            <p className="page-note">{officeBlueprint.length} 个实例工位固定展示，支持 20s 自动刷新与手动刷新。 {dataSource === 'real' ? '(实时源已接入)' : '(已回退至本地快照)'}{isLoading ? ' · 刷新中' : ''}</p>
          </div>

          <div className="office-controls">
            <div className="office-refresh-meta">
              <span className="status-pill status-blue">下一次刷新：{countdown}s</span>
              <span className="soft-tag">当前显示：{filteredInstances.length}/{officeInstances.length}</span>
              {error ? <span className="soft-tag">{error}</span> : null}
              <button className="ghost-button" type="button" onClick={() => navigate(-1)}>
                返回上一步
              </button>
              <button className="ghost-button" type="button" onClick={refreshOffice}>
                手动刷新
              </button>
            </div>
            <div className="office-filters">
              <button
                className={`ghost-button ${filter === 'all' ? 'is-active-filter' : ''}`}
                type="button"
                onClick={() => setFilter('all')}
              >
                全部
              </button>
              <button
                className={`ghost-button ${filter === 'doing' ? 'is-active-filter' : ''}`}
                type="button"
                onClick={() => setFilter('doing')}
              >
                仅 doing
              </button>
              <button
                className={`ghost-button ${filter === 'blocker' ? 'is-active-filter' : ''}`}
                type="button"
                onClick={() => setFilter('blocker')}
              >
                仅 blocker
              </button>
            </div>
          </div>

          <div className="office-floor">
            {filteredInstances.length > 0 ? (
              filteredInstances.map((instance) => {
                const linkedAgent = agents.find((agent) => agent.id === instance.agentId)
                const linkedProject = linkedAgent
                  ? projects.find((project) => project.id === linkedAgent.projectId)
                  : undefined
                const linkedTask = tasks.find((task) => task.executorAgentId === instance.agentId && task.title === instance.task)
                  ?? tasks.find((task) => task.executorAgentId === instance.agentId)

                return (
                  <article
                    key={instance.id}
                    className={`office-seat ${pulseIds.includes(instance.id) ? 'office-seat-flash' : ''} ${instance.agentId ? 'office-seat-clickable' : ''}`}
                    onClick={() => {
                      if (instance.agentId) {
                        linking.select('agent', instance.agentId)
                      }
                    }}
                  >
                    <span className="office-zone">工位示例</span>
                    <div className="office-head">
                      {instance.agentId ? (
                        <button
                          className="office-title-link"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            navigate({ pathname: '/agents', search: createFocusSearch(linking.currentSearch, 'agent', instance.agentId) })
                          }}
                        >
                          <h3>{instance.name}</h3>
                        </button>
                      ) : (
                        <h3>{instance.name}</h3>
                      )}
                      <button
                        className={`status-pill status-${operationStatusTone[instance.status]} office-status-button`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setFilter(instance.status === 'done' ? 'all' : instance.status)
                        }}
                      >
                        {instance.status}
                      </button>
                    </div>
                    <div className="office-meta-row office-meta-row-primary">
                      <span>当前任务</span>
                      <strong className={linkedTask ? 'office-metric-value' : ''}>
                        {linkedTask ? (
                          <button
                            className="office-metric-link office-metric-link-block"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              navigate({ pathname: '/tasks', search: createFocusSearch(linking.currentSearch, 'task', linkedTask.id) })
                            }}
                          >
                            {instance.task}
                          </button>
                        ) : (
                          instance.task
                        )}
                      </strong>
                    </div>
                    <div className="office-meta-row office-meta-row-project">
                      <span>关联项目</span>
                      <strong className={linkedProject ? 'office-metric-value' : ''}>
                        {linkedProject ? (
                          <button
                            className="office-metric-link office-metric-link-block"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              navigate({ pathname: '/projects', search: createFocusSearch(linking.currentSearch, 'project', linkedProject.id) })
                            }}
                          >
                            {instance.projectRelated}
                          </button>
                        ) : (
                          instance.projectRelated
                        )}
                      </strong>
                    </div>
                    <div className="office-foot-grid">
                      <div className="office-meta-row office-meta-row-compact">
                        <span>角色</span>
                        <strong className={instance.agentId ? 'office-metric-value' : ''}>
                          {instance.agentId ? (
                            <button
                              className="office-metric-link office-metric-link-block"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                navigate({ pathname: '/agents', search: createFocusSearch(linking.currentSearch, 'agent', instance.agentId) })
                              }}
                            >
                              {instance.role}
                            </button>
                          ) : (
                            instance.role
                          )}
                        </strong>
                      </div>
                      <div className="office-meta-row office-meta-row-compact">
                        <span>最近更新时间</span>
                        <strong>{instance.updatedAt}</strong>
                      </div>
                    </div>
                    <p className="office-note">{instance.note}</p>
                    <div className="office-link-row">
                      {instance.agentId ? (
                        <button
                          className="inline-link-chip"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            navigate({ pathname: '/agents', search: createFocusSearch(linking.currentSearch, 'agent', instance.agentId) })
                          }}
                        >
                          查看实例详情
                        </button>
                      ) : (
                        <span className="soft-tag">当前无任务源，预留工位</span>
                      )}
                    </div>
                  </article>
                )
              })
            ) : (
              <p className="empty-state">当前筛选无实例，切换为"全部"后可恢复显示。</p>
            )}
          </div>
        </div>
      </section>

      {topProject && (
        <section className={cardClass('project', topProject.id, 'panel hero-panel strong-card')}>
          <div className="hero-main">
            <div>
              <p className="hero-kicker">当前主航道</p>
              <h3>{topProject.name}</h3>
              <p className="hero-copy">{topProject.focus}</p>
            </div>
            <div className="hero-badges">
              <ObjectBadge
                kind="project"
                code={topProject.code}
                name={topProject.name}
                clickable
                onClick={() => linking.select('project', topProject.id)}
                {...linking.getState('project', topProject.id)}
              />
              {agents
                .filter((agent) => agent.projectId === topProject.id)
                .map((agent) => (
                  <ObjectBadge
                    key={agent.id}
                    kind="agent"
                    code={agent.code}
                    name={agent.name}
                    compact
                    clickable
                   
                    onClick={() => linking.select('agent', agent.id)}
                    {...linking.getState('agent', agent.id)}
                  />
                ))}
              {rooms
                .filter((room) => room.mainProjectId === topProject.id)
                .map((room) => (
                  <ObjectBadge
                    key={room.id}
                    kind="room"
                    code={room.code}
                    name={room.name}
                    compact
                    clickable
                    onClick={() => linking.select('room', room.id)}
                    {...linking.getState('room', room.id)}
                  />
                ))}
            </div>
          </div>
          <div className="hero-meta">
            <div>
              <span>当前阶段</span>
              <strong>{topProject.stage}</strong>
            </div>
            <div>
              <span>待拍板</span>
              <strong>{decisions.length} 项</strong>
            </div>
            <div>
              <span>关键 blocker</span>
              <strong>{blockedTasks.length} 项</strong>
            </div>
            <div>
              <span>下一步</span>
              <strong>{topProject.nextStep}</strong>
            </div>
          </div>
          <div className="cross-link-row">
            <NavLink className="inline-link-chip" to={{ pathname: '/projects', search: keyProjectSearch }}>
              查看相关项 · Projects
            </NavLink>
            <NavLink className="inline-link-chip" to={{ pathname: '/tasks', search: keyProjectSearch }}>
              查看相关项 · Tasks
            </NavLink>
            <NavLink className="inline-link-chip" to={{ pathname: '/rooms', search: keyProjectSearch }}>
              查看相关项 · Rooms
            </NavLink>
          </div>
        </section>
      )}

      <div className="stats-grid strong-grid">
        <StatCard label="活跃实例数" value={instanceStats.activeInstances} tone="blue" />
        <StatCard label="进行中实例数" value={instanceStats.doingInstances} tone="green" />
        <StatCard label="阻塞实例数" value={instanceStats.blockedInstances} tone="red" />
        <StatCard label="完成实例数" value={instanceStats.doneInstances} tone="orange" />
      </div>

      <div className="dashboard-grid dashboard-priority-grid">
        <div className="panel panel-alert blocker-panel strong-card">
          <div className="panel-header">
            <h3>Blocker 区</h3>
            <span>{blockedTasks.length} 个阻塞</span>
          </div>
          {blockedTasks.length > 0 ? (
            <div className="alert-list">
              {blockedTasks.map((task) => {
                const project = projects.find((item) => item.id === task.projectId)
                const agent = agents.find((item) => item.id === task.executorAgentId)
                return (
                  <article key={task.id} className={cardClass('task', task.id, 'alert-item priority-surface')}>
                    <div className="item-head">
                      <h4>{task.title}</h4>
                      <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
                    </div>
                    <div className="object-row">
                      <ObjectBadge
                        kind="task"
                        code={task.code}
                        name={task.title}
                        compact
                        clickable
                        onClick={() => linking.select('task', task.id)}
                        {...linking.getState('task', task.id)}
                      />
                      {project && (
                        <ObjectBadge
                          kind="project"
                          code={project.code}
                          name={project.name}
                          compact
                          clickable
                          onClick={() => linking.select('project', project.id)}
                          {...linking.getState('project', project.id)}
                        />
                      )}
                      {agent && (
                        <ObjectBadge
                          kind="agent"
                          code={agent.code}
                          name={agent.name}
                          compact
                          clickable
                         
                          onClick={() => linking.select('agent', agent.id)}
                          {...linking.getState('agent', agent.id)}
                        />
                      )}
                    </div>
                    <div className="cross-link-row">
                      <NavLink className="inline-link-chip" to={{ pathname: '/tasks', search: createFocusSearch(linking.currentSearch, 'task', task.id) }}>
                        查看相关项 · Tasks
                      </NavLink>
                    </div>
                    <p>最近更新时间：{task.updatedAt}</p>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="empty-state">当前没有 blocker。</p>
          )}
        </div>

        <div className="stack-column">
          <div className="panel strong-card">
            <div className="panel-header">
              <h3>待拍板事项</h3>
              <span>{decisions.length} 项</span>
            </div>
            <div className="compact-list">
              {decisions.map((decision) => {
                const project = projects.find((item) => item.id === decision.projectId)
                const owner = agents.find((item) => item.id === decision.ownerAgentId)
                const relatedAgent = decision.relatedAgentId
                  ? agents.find((item) => item.id === decision.relatedAgentId)
                  : undefined
                const relatedTask = decision.relatedTaskId
                  ? tasks.find((item) => item.id === decision.relatedTaskId)
                  : undefined
                return (
                  <article
                    key={decision.id}
                    className={cardClass('project', decision.projectId, 'compact-item compact-card panel-surface')}
                  >
                    <div>
                      <h4>{decision.title}</h4>
                      <div className="object-row top-gap">
                        {project && (
                          <ObjectBadge
                            kind="project"
                            code={project.code}
                            name={project.name}
                            compact
                            clickable
                            onClick={() => linking.select('project', project.id)}
                            {...linking.getState('project', project.id)}
                          />
                        )}
                        {relatedAgent && (
                          <ObjectBadge
                            kind="agent"
                            code={relatedAgent.code}
                            name={relatedAgent.name}
                            compact
                            clickable
                           
                            onClick={() => linking.select('agent', relatedAgent.id)}
                            {...linking.getState('agent', relatedAgent.id)}
                          />
                        )}
                        {relatedTask && (
                          <ObjectBadge
                            kind="task"
                            code={relatedTask.code}
                            name={relatedTask.title}
                            compact
                            clickable
                            onClick={() => linking.select('task', relatedTask.id)}
                            {...linking.getState('task', relatedTask.id)}
                          />
                        )}
                        {owner && (
                          <ObjectBadge
                            kind="agent"
                            code={owner.code}
                            name={owner.name}
                            compact
                            clickable
                           
                            onClick={() => linking.select('agent', owner.id)}
                            {...linking.getState('agent', owner.id)}
                          />
                        )}
                      </div>
                    </div>
                    <span className={`priority-badge priority-${decision.priority}`}>{decision.priority}</span>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="panel strong-card">
            <div className="panel-header">
              <h3>最近关键更新</h3>
              <span>{criticalUpdates.length} 条</span>
            </div>
            <div className="update-list">
              {criticalUpdates.map((item) => {
                const project = item.projectId
                  ? projects.find((project) => project.id === item.projectId)
                  : undefined
                const agent = item.agentId ? agents.find((agent) => agent.id === item.agentId) : undefined
                const room = item.roomId ? rooms.find((room) => room.id === item.roomId) : undefined
                const task = item.taskId ? tasks.find((task) => task.id === item.taskId) : undefined
                const focusKind = item.taskId
                  ? 'task'
                  : item.roomId
                    ? 'room'
                    : item.agentId
                      ? 'agent'
                      : 'project'
                const focusId = item.taskId ?? item.roomId ?? item.agentId ?? item.projectId
                if (!focusId) return null

                return (
                  <article key={item.id} className={cardClass(focusKind, focusId, `update-item update-${item.level} panel-surface`)}>
                    <div>
                      <div className="item-head">
                        <h4>{item.title}</h4>
                        <span className="soft-tag">{updateTypeLabel[item.type]}</span>
                      </div>
                      <div className="object-row top-gap">
                        {project && (
                          <ObjectBadge
                            kind="project"
                            code={project.code}
                            name={project.name}
                            compact
                            clickable
                            onClick={() => linking.select('project', project.id)}
                            {...linking.getState('project', project.id)}
                          />
                        )}
                        {agent && (
                          <ObjectBadge
                            kind="agent"
                            code={agent.code}
                            name={agent.name}
                            compact
                            clickable
                           
                            onClick={() => linking.select('agent', agent.id)}
                            {...linking.getState('agent', agent.id)}
                          />
                        )}
                        {room && (
                          <ObjectBadge
                            kind="room"
                            code={room.code}
                            name={room.name}
                            compact
                            clickable
                            onClick={() => linking.select('room', room.id)}
                            {...linking.getState('room', room.id)}
                          />
                        )}
                        {task && (
                          <ObjectBadge
                            kind="task"
                            code={task.code}
                            name={task.title}
                            compact
                            clickable
                            onClick={() => linking.select('task', task.id)}
                            {...linking.getState('task', task.id)}
                          />
                        )}
                      </div>
                      <div className="cross-link-row top-gap">
                        <NavLink className="inline-link-chip" to={{ pathname: '/', search: createFocusSearch(linking.currentSearch, focusKind, focusId) }}>
                          查看相关项 · Dashboard
                        </NavLink>
                        <NavLink className="inline-link-chip" to={{ pathname: '/tasks', search: createFocusSearch(linking.currentSearch, focusKind, focusId) }}>
                          查看相关项 · Tasks
                        </NavLink>
                      </div>
                      <p>
                        {item.source} · {item.time}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>

        <div className="panel panel-wide strong-card">
          <div className="panel-header">
            <h3>跨页映射</h3>
            <span>同一对象在不同页面的定位</span>
          </div>
          <div className="mapping-grid">
            {projects.slice(0, 3).map((project) => {
              const linkedAgents = agents.filter((agent) => agent.projectId === project.id)
              const linkedRooms = rooms.filter((room) => room.mainProjectId === project.id)
              const linkedTasks = tasks.filter((task) => task.projectId === project.id)
              return (
                <article key={project.id} className={cardClass('project', project.id, 'mapping-card panel-surface')}>
                  <div className="mapping-head">
                    <ObjectBadge
                      kind="project"
                      code={project.code}
                      name={project.name}
                      clickable
                      onClick={() => linking.select('project', project.id)}
                      {...linking.getState('project', project.id)}
                    />
                    <span className={`status-pill status-${project.status}`}>{project.status}</span>
                  </div>
                  <div className="mapping-lines">
                    <p>Dashboard / Projects / Tasks / Rooms 都以同一项目标识串联。</p>
                    <div className="object-row">
                      {linkedAgents.map((agent) => (
                        <ObjectBadge
                          key={agent.id}
                          kind="agent"
                          code={agent.code}
                          name={agent.name}
                          compact
                          clickable
                         
                          onClick={() => linking.select('agent', agent.id)}
                          {...linking.getState('agent', agent.id)}
                        />
                      ))}
                    </div>
                    <div className="object-row">
                      {linkedRooms.map((room) => (
                        <ObjectBadge
                          key={room.id}
                          kind="room"
                          code={room.code}
                          name={room.name}
                          compact
                          clickable
                          onClick={() => linking.select('room', room.id)}
                          {...linking.getState('room', room.id)}
                        />
                      ))}
                      <span className="soft-tag">任务 {linkedTasks.length}</span>
                    </div>
                    <div className="cross-link-row">
                      <NavLink className="inline-link-chip" to={{ pathname: '/projects', search: createFocusSearch(linking.currentSearch, 'project', project.id) }}>
                        查看相关项 · Projects
                      </NavLink>
                      <NavLink className="inline-link-chip" to={{ pathname: '/rooms', search: createFocusSearch(linking.currentSearch, 'project', project.id) }}>
                        查看相关项 · Rooms
                      </NavLink>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
