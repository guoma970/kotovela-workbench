import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { ObjectBadge } from '../components/ObjectBadge'
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
  doing: '推进中',
  blocker: '阻塞',
  done: '平稳',
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

  const officeInstances = useMemo(
    () =>
      dataSource === 'real'
        ? normalizeApiInstances(rawInstances, agents, projects)
        : buildOfficeFallback(agents, projects, tasks),
    [agents, dataSource, projects, rawInstances, tasks],
  )

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
        <p className="page-note">先看 blocker / 活跃实例 / 关键更新，再查项目、群、任务的承接关系。</p>
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
              <h2>实例工位图</h2>
            </div>
            <p className="page-note">共 {officeBlueprint.length} 个席位 · {dataSource === 'real' ? '实时数据' : 'Mock demo'}{isLoading ? ' · 刷新中' : ''}</p>
          </div>

          <div className="office-controls">
            <div className="office-refresh-meta">
              <span className="status-pill status-blue">{countdown}s 后刷新</span>
              <span className="soft-tag">{filteredInstances.length}/{officeInstances.length}</span>
              {error ? <span className="soft-tag error-tag">{error}</span> : null}
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
                Doing
              </button>
              <button
                className={`ghost-button ${filter === 'blocker' ? 'is-active-filter' : ''}`}
                type="button"
                onClick={() => setFilter('blocker')}
              >
                Blocker
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
                    <p className="office-note">{instance.note}</p>
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
              <p className="hero-copy" style={{ marginTop: '4px' }}>下一步：{topProject.nextStep}</p>
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
              <span>阶段</span>
              <strong>{topProject.stage}</strong>
            </div>
            <div>
              <span>待拍板</span>
              <strong>{decisions.length}</strong>
            </div>
            <div>
              <span>Blocker</span>
              <strong className="text-red">{blockedTasks.length}</strong>
            </div>
          </div>
        </section>
      )}

      <div className="dashboard-grid dashboard-priority-grid">
        <div className="panel panel-alert blocker-panel strong-card">
          <div className="panel-header">
            <h3>Blocker</h3>
            <span className="badge-count">{blockedTasks.length}</span>
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
                    </div>
                    <div className="cross-link-row">
                      <NavLink className="inline-link-chip" to={{ pathname: '/tasks', search: createFocusSearch(linking.currentSearch, 'task', task.id) }}>
                        查看详情
                      </NavLink>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="empty-state">暂无 blocker。</p>
          )}
        </div>

        <div className="stack-column">
          <div className="panel strong-card">
            <div className="panel-header">
              <h3>最近更新</h3>
              <span className="badge-count">{criticalUpdates.length}</span>
            </div>
            <div className="update-list">
              {criticalUpdates.map((item) => {
                const project = item.projectId
                  ? projects.find((project) => project.id === item.projectId)
                  : undefined
                const agent = item.agentId ? agents.find((agent) => agent.id === item.agentId) : undefined
                const task = item.taskId ? tasks.find((task) => task.id === item.taskId) : undefined
                const focusKind = item.taskId
                  ? 'task'
                  : item.agentId
                    ? 'agent'
                    : 'project'
                const focusId = item.taskId ?? item.agentId ?? item.projectId
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
                      <p className="soft-tag" style={{ marginTop: '6px' }}>{item.source} · {item.time}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          {decisions.length > 0 && (
            <div className="panel strong-card">
              <div className="panel-header">
                <h3>待拍板</h3>
                <span className="badge-count">{decisions.length}</span>
              </div>
              <div className="compact-list">
                {decisions.slice(0, 4).map((decision) => {
                  const project = projects.find((item) => item.id === decision.projectId)
                  const owner = agents.find((item) => item.id === decision.ownerAgentId)
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
          )}
        </div>
      </div>
    </section>
  )
}
