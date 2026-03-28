import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { ObjectBadge } from '../components/ObjectBadge'
import { StatCard } from '../components/StatCard'
import { agents, decisions, projects, rooms, tasks, updates } from '../data/mockData'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

const updateTypeLabel = {
  task: '任务更新',
  project: '项目更新',
  agent: '实例状态更新',
  room: '群动态',
}

const pageData = { projects, agents, rooms, tasks }

type OperationStatus = 'doing' | 'done' | 'blocker'
type FilterMode = 'all' | 'doing' | 'blocker'

type OfficeInstance = {
  id: string
  name: string
  role: string
  status: OperationStatus
  task: string
  updatedAt: string
  note: string
  agentId?: string
}

const REFRESH_INTERVAL_SECONDS = 20

const officeBlueprint: Array<{ id: string; name: string; role: string; agentId?: string }> = [
  ...agents.map((agent, index) => ({
    id: `seat-${index + 1}`,
    name: agent.name,
    role: agent.role,
    agentId: agent.id,
  })),
  { id: 'seat-extra', name: '待启用席位', role: '预留', agentId: undefined },
]

const operationStatusTone: Record<OperationStatus, 'doing' | 'done' | 'blocker'> = {
  doing: 'doing',
  blocker: 'blocker',
  done: 'done',
}

const statusSentence: Record<OperationStatus, string> = {
  doing: '正在推进关键动作，等待下游确认。',
  blocker: '检测到阻塞信号，等待状态回归。',
  done: '当前未有阻塞，任务链路平稳。',
}

const getAgentStatus = (agent: (typeof agents)[number] | undefined, executorTasks: typeof tasks): OperationStatus => {
  if (!agent) {
    return 'done'
  }
  if (agent.status === 'blocked' || executorTasks.some((task) => task.status === 'blocked')) {
    return 'blocker'
  }
  if (agent.status === 'active' || executorTasks.some((task) => task.status === 'doing')) {
    return 'doing'
  }
  return 'done'
}

const buildOfficeInstances = (tick: number): OfficeInstance[] => {
  return officeBlueprint.map((seat) => {
    const agent = agents.find((item) => item.id === seat.agentId)
    const relatedTasks = agent ? tasks.filter((task) => task.executorAgentId === agent.id) : []
    const base = getAgentStatus(agent, relatedTasks)
    const pulse = tick % 3
    const status: OperationStatus =
      pulse === 0
        ? base
        : pulse === 1
          ? 'doing'
          : base === 'done'
            ? 'blocker'
            : 'done'

    const taskSource =
      relatedTasks.find((task) => task.status === 'doing') ||
      relatedTasks.find((task) => task.status === 'blocked') ||
      relatedTasks[0] ||
      { title: agent?.currentTask || '暂无新任务' }

    return {
      id: seat.id,
      name: seat.name,
      role: seat.role,
      status,
      task: taskSource.title,
      updatedAt: `${tick * 10}秒前`,
      note: statusSentence[status],
      agentId: seat.agentId,
    }
  })
}

export function DashboardPage() {
  const [refreshTick, setRefreshTick] = useState(0)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [instances, setInstances] = useState<OfficeInstance[]>(() => buildOfficeInstances(0))
  const [pulseIds, setPulseIds] = useState<string[]>([])

  const activeAgents = agents.filter((item) => item.status === 'active')
  const doingTasks = tasks.filter((item) => item.status === 'doing')
  const blockedTasks = tasks.filter((item) => item.status === 'blocked')
  const activeProjects = projects.filter((item) => item.status === 'active')
  const doneTasks = tasks.filter((item) => item.status === 'done')
  const topProject = projects.find((item) => item.id === 'project-1')
  const criticalUpdates = updates.slice(0, 3)
  const linking = useWorkbenchLinking(pageData)
  const keyTask = blockedTasks[0] ?? doingTasks[0]
  const keyFocusSearch = keyTask
    ? createFocusSearch(linking.currentSearch, 'task', keyTask.id)
    : createFocusSearch(linking.currentSearch, 'project', topProject?.id)
  const keyProjectSearch = topProject ? createFocusSearch(linking.currentSearch, 'project', topProject.id) : createFocusSearch(linking.currentSearch)

  const filteredInstances = useMemo(() => {
    if (filter === 'all') {
      return instances
    }
    return instances.filter((instance) => instance.status === filter)
  }, [instances, filter])

  const refreshOffice = useCallback(() => {
    const nextTick = refreshTick + 1
    const next = buildOfficeInstances(nextTick)
    const changed = instances
      .filter((item) => {
        const current = next.find((n) => n.id === item.id)
        return !current || current.status !== item.status || current.task !== item.task
      })
      .map((item) => item.id)

    setInstances(next)
    setPulseIds(changed)
    setRefreshTick(nextTick)
    setCountdown(REFRESH_INTERVAL_SECONDS)
  }, [instances, refreshTick])

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refreshOffice()
          return REFRESH_INTERVAL_SECONDS
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [refreshOffice])

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
        <p className="page-note">先看 blocker、待拍板和关键更新，再看项目、实例、群之间的承接关系。</p>
      </div>

      <PageLeadPanel
        heading="Dashboard"
        intro="先看全局态势（阻塞与节奏），再点进对应对象确认交付路径。"
        metrics={[
          { label: '活跃实例', value: activeAgents.length },
          { label: '进行中任务', value: doingTasks.length },
          { label: '阻塞项', value: blockedTasks.length },
          { label: '已完成任务', value: doneTasks.length },
          { label: '待拍板', value: decisions.length },
          { label: '项目总数', value: projects.length },
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
              <h2>KOTOVELA 实例工位图</h2>
            </div>
            <p className="page-note">6 个实例工位固定展示，支持 20s 自动刷新与手动刷新。</p>
          </div>

          <div className="office-controls">
            <div className="office-refresh-meta">
              <span className="status-pill status-blue">下一次刷新：{countdown}s</span>
              <span className="soft-tag">当前显示：{filteredInstances.length}/{instances.length}</span>
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
                const agent = instance.agentId ? agents.find((item) => item.id === instance.agentId) : undefined
                const projectRelated = agent ? (projects.find((item) => item.id === agent.projectId)?.name ?? '未绑定项目') : '待启用席位'
                return (
                  <article
                    key={instance.id}
                    className={`office-seat ${pulseIds.includes(instance.id) ? 'office-seat-flash' : ''}`}
                  >
                    <span className="office-zone">工位示例</span>
                    <div className="office-head">
                      <h3>{instance.name}</h3>
                      <span className={`status-pill status-${operationStatusTone[instance.status]}`}>{instance.status}</span>
                    </div>
                    <div className="office-meta-row">
                      <span>角色</span>
                      <strong>{instance.role}</strong>
                    </div>
                    <div className="office-meta-row">
                      <span>关联项目</span>
                      <strong>{projectRelated}</strong>
                    </div>
                    <div className="office-meta-row">
                      <span>当前任务</span>
                      <strong>{instance.task}</strong>
                    </div>
                    <div className="office-meta-row">
                      <span>最近更新时间</span>
                      <strong>{instance.updatedAt}</strong>
                    </div>
                    <p className="office-note">{instance.note}</p>
                    <div className="office-link-row">
                      {instance.agentId ? (
                        <button
                          className="inline-link-chip"
                          type="button"
                          onClick={() => linking.select('agent', instance.agentId ?? '')}
                        >
                          查看实例详情
                        </button>
                      ) : (
                        <span className="soft-tag">当前无任务源，预留工位位</span>
                      )}
                    </div>
                  </article>
                )
              })
            ) : (
              <p className="empty-state">当前筛选无实例，切换为“全部”后可恢复显示。</p>
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
        <StatCard label="活跃实例数" value={activeAgents.length} tone="blue" />
        <StatCard label="进行中任务数" value={doingTasks.length} tone="green" />
        <StatCard label="blocker 数" value={blockedTasks.length} tone="red" />
        <StatCard label="活跃项目数" value={activeProjects.length} tone="orange" />
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
