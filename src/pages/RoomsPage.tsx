import { NavLink } from 'react-router-dom'
import { ObjectBadge } from '../components/ObjectBadge'
import { agents, projects, rooms, tasks } from '../data/mockData'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

const pageData = { projects, agents, rooms, tasks }

export function RoomsPage() {
  const linking = useWorkbenchLinking(pageData)

  const cardClass = (id: string) => {
    const state = linking.getState('room', id)
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
          <p className="eyebrow">Rooms</p>
          <h2>群与通道状态</h2>
        </div>
        <p className="page-note">群/房间保持独立统一标识，并明确承接项目、归属实例和对应任务范围。</p>
      </div>

      <div className="card-grid">
        {rooms.map((room) => {
          const project = projects.find((item) => item.id === room.mainProjectId)
          const linkedAgents = agents.filter((agent) => room.instanceIds.includes(agent.id))
          const linkedTasks = tasks.filter(
            (task) => task.projectId === room.mainProjectId || room.instanceIds.includes(task.executorAgentId),
          )
          const focusSearch = createFocusSearch(linking.currentSearch, 'room', room.id)
          return (
            <article key={room.id} className={cardClass(room.id)} onClick={() => linking.select('room', room.id)}>
              <div className="panel-header align-start">
                <ObjectBadge kind="room" code={room.code} name={room.name} clickable onClick={() => linking.select('room', room.id)} {...linking.getState('room', room.id)} />
                <span className={`status-pill status-${room.status}`}>{room.status}</span>
              </div>
              <div className="context-strip">
                <div>
                  <span>通道类型</span>
                  <strong>{room.channelType}</strong>
                </div>
                <div>
                  <span>待处理项</span>
                  <strong>{room.pending}</strong>
                </div>
              </div>
              <div className="info-block emphasis-block">
                <span>当前用途</span>
                <strong>{room.purpose}</strong>
              </div>
              <div className="relation-stack">
                <div>
                  <span className="section-label">承接项目</span>
                  <div className="object-row top-gap">
                    {project && <ObjectBadge kind="project" code={project.code} name={project.name} compact clickable onClick={() => linking.select('project', project.id)} {...linking.getState('project', project.id)} />}
                  </div>
                </div>
                <div>
                  <span className="section-label">归属实例</span>
                  <div className="object-row top-gap">
                    {linkedAgents.map((agent) => (
                      <ObjectBadge key={agent.id} kind="agent" code={agent.code} name={agent.name} compact clickable onClick={() => linking.select('agent', agent.id)} {...linking.getState('agent', agent.id)} />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="section-label">牵动任务</span>
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
                <NavLink className="inline-link-chip" to={{ pathname: '/projects', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  查看相关项 · Projects
                </NavLink>
                <NavLink className="inline-link-chip" to={{ pathname: '/agents', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  查看相关项 · Agents
                </NavLink>
              </div>
              <div className="info-block">
                <span>最近动作类型</span>
                <strong>{room.recentAction}</strong>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
