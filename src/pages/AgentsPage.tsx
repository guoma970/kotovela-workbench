import { NavLink } from 'react-router-dom'
import { ObjectBadge } from '../components/ObjectBadge'
import { agents, projects, rooms, tasks } from '../data/mockData'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

const pageData = { projects, agents, rooms, tasks }

export function AgentsPage() {
  const linking = useWorkbenchLinking(pageData)

  const cardClass = (id: string) => {
    const state = linking.getState('agent', id)
    return [
      'panel info-card strong-card',
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
          <p className="eyebrow">Agents</p>
          <h2>实例状态</h2>
        </div>
        <p className="page-note">实例统一使用同一标识卡，在 Dashboard / Tasks / Projects / Rooms 之间一眼能对上。</p>
      </div>

      <div className="card-grid">
        {agents.map((agent) => {
          const project = projects.find((item) => item.id === agent.projectId)
          const linkedTasks = tasks.filter((task) => task.executorAgentId === agent.id)
          const linkedRooms = rooms.filter((room) => room.instanceIds.includes(agent.id))
          const focusSearch = createFocusSearch(linking.currentSearch, 'agent', agent.id)
          return (
            <article key={agent.id} className={cardClass(agent.id)} onClick={() => linking.select('agent', agent.id)}>
              <div className="panel-header align-start">
                <ObjectBadge kind="agent" code={agent.code} name={agent.name} clickable onClick={() => linking.select('agent', agent.id)} {...linking.getState('agent', agent.id)} />
                <span className={`status-pill status-${agent.status}`}>{agent.status}</span>
              </div>
              <div className="context-strip">
                <div>
                  <span>角色</span>
                  <strong>{agent.role}</strong>
                </div>
                <div>
                  <span>更新时间</span>
                  <strong>{agent.updatedAt}</strong>
                </div>
              </div>
              <div className="info-block emphasis-block">
                <span>当前任务</span>
                <strong>{agent.currentTask}</strong>
              </div>
              <div className="relation-stack">
                <div>
                  <span className="section-label">所属项目</span>
                  <div className="object-row top-gap">
                    {project && <ObjectBadge kind="project" code={project.code} name={project.name} compact clickable onClick={() => linking.select('project', project.id)} {...linking.getState('project', project.id)} />}
                  </div>
                </div>
                <div>
                  <span className="section-label">关联房间</span>
                  <div className="object-row top-gap">
                    {linkedRooms.map((room) => (
                      <ObjectBadge key={room.id} kind="room" code={room.code} name={room.name} compact clickable onClick={() => linking.select('room', room.id)} {...linking.getState('room', room.id)} />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="section-label">关联任务</span>
                  <div className="object-row top-gap">
                    {linkedTasks.map((task) => (
                      <ObjectBadge key={task.id} kind="task" code={task.code} name={task.title} compact clickable onClick={() => linking.select('task', task.id)} {...linking.getState('task', task.id)} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="cross-link-row">
                <NavLink className="inline-link-chip" to={{ pathname: '/tasks', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  查看相关项 · Tasks
                </NavLink>
                <NavLink className="inline-link-chip" to={{ pathname: '/rooms', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  查看相关项 · Rooms
                </NavLink>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
