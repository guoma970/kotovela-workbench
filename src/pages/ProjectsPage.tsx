import { NavLink } from 'react-router-dom'
import { ObjectBadge } from '../components/ObjectBadge'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

export function ProjectsPage() {
  const { projects, agents, rooms, tasks, mode } = useOfficeInstances()
  const showCockpitDetail = mode === 'internal'
  const pageData = { projects, agents, rooms, tasks }
  const linking = useWorkbenchLinking(pageData)
  const blockedCount = projects.reduce((sum, project) => sum + project.blockers, 0)

  const cardClass = (id: string) => {
    const state = linking.getState('project', id)
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
          <p className="eyebrow">Projects</p>
          <h2>Project Board</h2>
        </div>
        <p className="page-note">Each project shows status, stage, blockers, linked agents, and linked tasks.</p>
      </div>

      <PageLeadPanel
        heading="Projects"
        intro="Start with project volume and blockers, then jump into Tasks, Rooms, and Agents." 
        metrics={[
          { label: 'Projects', value: projects.length, to: { pathname: '/projects' } },
          { label: 'Active projects', value: projects.filter((project) => project.status === 'active').length, to: { pathname: '/projects' } },
          { label: 'Total blockers', value: blockedCount, to: { pathname: '/tasks', search: '?status=blocked' } },
          { label: 'Rooms', value: rooms.length, to: { pathname: '/rooms' } },
        ]}
        actions={[
          { label: 'Go to tasks', to: { pathname: '/tasks' } },
          { label: 'Go to rooms', to: { pathname: '/rooms' } },
          { label: 'Go to agents', to: { pathname: '/agents' } },
        ]}
      />

      <div className="card-grid project-grid">
        {projects.map((project) => {
          const linkedAgents = agents.filter((agent) => agent.projectId === project.id)
          const linkedRooms = rooms.filter((room) => room.mainProjectId === project.id)
          const linkedTasks = tasks.filter((task) => task.projectId === project.id)
          const focusSearch = createFocusSearch(linking.currentSearch, 'project', project.id)
          return (
            <article key={project.id} className={cardClass(project.id)} onClick={() => linking.select('project', project.id)}>
              <div className="panel-header align-start">
                <div>
                  <ObjectBadge
                    kind="project"
                    code={project.code}
                    name={project.name}
                    clickable
                    onClick={() => linking.select('project', project.id)}
                    {...linking.getState('project', project.id)}
                  />
                </div>
                <span className={`status-pill status-${project.status}`}>{project.status}</span>
              </div>
              <div className="context-strip">
                <div>
                  <span>Stage</span>
                  <strong>{project.stage}</strong>
                </div>
                <div>
                  <span>Owner</span>
                  <strong>{project.owner}</strong>
                </div>
                {showCockpitDetail && (project.instanceCount ?? 0) > 1 ? (
                  <div>
                    <span>实例</span>
                    <strong>{project.instanceCount}</strong>
                  </div>
                ) : null}
                <div>
                  <span>Blocker</span>
                  <strong>
                    <NavLink
                      className="context-strip-metric-link"
                      to={{ pathname: '/tasks', search: focusSearch }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {project.blockers}
                    </NavLink>
                  </strong>
                </div>
              </div>
              {showCockpitDetail ? (
                <div className="project-progress-wrap" aria-label={`进度 ${project.progress}%`}>
                  <div className="project-progress-label">
                    <span>进度</span>
                    <span className="project-progress-pct">{project.progress}%</span>
                  </div>
                  <div className="project-progress-track">
                    <div
                      className="project-progress-fill"
                      style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
                    />
                  </div>
                </div>
              ) : null}
              <div className="info-block emphasis-block">
                <span>Focus / next step</span>
                <strong>{project.focus}</strong>
                <strong style={{ marginTop: '4px', fontWeight: 400, color: '#97a7c5', fontSize: '0.85em' }}>→ {project.nextStep}</strong>
              </div>
              <div className="relation-stack">
                <div>
                  <span className="section-label">Agents</span>
                  <div className="object-row top-gap">
                    {linkedAgents.length > 0 ? (
                      linkedAgents.map((agent) => (
                        <ObjectBadge
                          key={agent.id}
                          kind="agent"
                          code={agent.code}
                          name={agent.name}
                          instanceKey={agent.instanceKey}
                          agentId={agent.id}
                          compact
                          clickable
                          onClick={() => linking.select('agent', agent.id)}
                          {...linking.getState('agent', agent.id)}
                        />
                      ))
                    ) : (
                      <span className="soft-tag">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="section-label">Rooms</span>
                  <div className="object-row top-gap">
                    {linkedRooms.length > 0 ? (
                      linkedRooms.map((room) => (
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
                      ))
                    ) : (
                      <span className="soft-tag">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="section-label">Tasks {linkedTasks.length > 3 ? `(${linkedTasks.length} total)` : ''}</span>
                  <div className="object-row top-gap">
                    {linkedTasks.slice(0, 3).map((task) => (
                      <ObjectBadge
                        key={task.id}
                        kind="task"
                        code={task.code}
                        name={task.title}
                        compact
                        clickable
                        onClick={() => linking.select('task', task.id)}
                        {...linking.getState('task', task.id)}
                      />
                    ))}
                    {linkedTasks.length === 0 && <span className="soft-tag">—</span>}
                  </div>
                </div>
              </div>
              <div className="cross-link-row">
                <NavLink
                  className="inline-link-chip"
                  to={{ pathname: '/tasks', search: focusSearch }}
                  onClick={(event) => event.stopPropagation()}
                >
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