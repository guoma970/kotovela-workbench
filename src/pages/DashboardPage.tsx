import { NavLink } from 'react-router-dom'
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

export function DashboardPage() {
  const activeAgents = agents.filter((item) => item.status === 'active')
  const doingTasks = tasks.filter((item) => item.status === 'doing')
  const blockedTasks = tasks.filter((item) => item.status === 'blocked')
  const activeProjects = projects.filter((item) => item.status === 'active')
  const topProject = projects.find((item) => item.id === 'project-1')
  const criticalUpdates = updates.slice(0, 3)
  const linking = useWorkbenchLinking(pageData)

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
            <NavLink className="inline-link-chip" to={{ pathname: '/projects', search: createFocusSearch(linking.currentSearch, 'project', topProject.id) }}>
              查看相关项 · Projects
            </NavLink>
            <NavLink className="inline-link-chip" to={{ pathname: '/tasks', search: createFocusSearch(linking.currentSearch, 'project', topProject.id) }}>
              查看相关项 · Tasks
            </NavLink>
            <NavLink className="inline-link-chip" to={{ pathname: '/rooms', search: createFocusSearch(linking.currentSearch, 'project', topProject.id) }}>
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
