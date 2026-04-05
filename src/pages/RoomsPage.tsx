import { NavLink } from 'react-router-dom'
import { ObjectBadge } from '../components/ObjectBadge'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

export function RoomsPage() {
  const { rooms, projects, agents, tasks } = useOfficeInstances()
  const pageData = { projects, agents, rooms, tasks }
  const linking = useWorkbenchLinking(pageData)
  const pendingCount = rooms.reduce((sum, room) => sum + room.pending, 0)

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
          <h2>Room Status</h2>
        </div>
        <p className="page-note">Each room shows its name, status, purpose, and most recent action.</p>
      </div>

      <PageLeadPanel
        heading="Rooms"
        intro="Start with room capacity and pending load, then jump to Tasks, Projects, and Agents." 
        metrics={[
          { label: 'Rooms', value: rooms.length, to: { pathname: '/rooms' } },
          { label: 'Active rooms', value: rooms.filter((room) => room.status === 'active').length, to: { pathname: '/rooms' } },
          { label: 'Pending total', value: pendingCount, to: { pathname: '/tasks' } },
          { label: 'Agents', value: agents.length, to: { pathname: '/agents' } },
        ]}
        actions={[
          { label: 'Go to tasks', to: { pathname: '/tasks' } },
          { label: 'Go to projects', to: { pathname: '/projects' } },
          { label: 'Go to agents', to: { pathname: '/agents' } },
        ]}
      />

      <div className="card-grid">
        {rooms.map((room) => {
          const project = projects.find((item) => item.id === room.mainProjectId)
          const linkedAgents = agents.filter((agent) => room.instanceIds.includes(agent.id))
          const focusSearch = createFocusSearch(linking.currentSearch, 'room', room.id)
          return (
            <article key={room.id} className={cardClass(room.id)} onClick={() => linking.select('room', room.id)}>
              <div className="panel-header align-start">
                <ObjectBadge kind="room" code={room.code} name={room.name} clickable onClick={() => linking.select('room', room.id)} {...linking.getState('room', room.id)} />
                <span className={`status-pill status-${room.status}`}>{room.status}</span>
              </div>
              <div className="context-strip">
                <div>
                  <span>Status</span>
                  <strong className={`status-dot status-${room.status}`}>{room.status}</strong>
                </div>
                <div>
                  <span>Pending</span>
                  <strong>
                    <NavLink
                      className="context-strip-metric-link"
                      to={{ pathname: '/tasks', search: focusSearch }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {room.pending}
                    </NavLink>
                  </strong>
                </div>
              </div>
              <div className="info-block emphasis-block">
                <span>Purpose</span>
                <strong>{room.purpose}</strong>
              </div>
              <div className="info-block">
                <span>Recent action</span>
                <strong>{room.recentAction}</strong>
              </div>
              <div className="relation-stack">
                <div>
                  <span className="section-label">Project</span>
                  <div className="object-row top-gap">
                    {project && <ObjectBadge kind="project" code={project.code} name={project.name} compact clickable onClick={() => linking.select('project', project.id)} {...linking.getState('project', project.id)} />}
                  </div>
                </div>
                <div>
                  <span className="section-label">Agents {linkedAgents.length > 0 ? '' : '—'}</span>
                  <div className="object-row top-gap">
                    {linkedAgents.map((agent) => (
                      <ObjectBadge key={agent.id} kind="agent" code={agent.code} name={agent.name} compact clickable onClick={() => linking.select('agent', agent.id)} {...linking.getState('agent', agent.id)} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="cross-link-row">
                <NavLink className="inline-link-chip" to={{ pathname: '/tasks', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  Related tasks
                </NavLink>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}