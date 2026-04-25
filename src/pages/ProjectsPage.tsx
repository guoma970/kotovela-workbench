import { NavLink } from 'react-router-dom'
import { ObjectBadge } from '../components/ObjectBadge'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

export function ProjectsPage() {
  const { projects, agents, rooms, tasks } = useOfficeInstances()
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
          <h2>项目看板</h2>
        </div>
        <p className="page-note">每个项目含状态、阶段、阻塞数、项目成员和关联任务。</p>
      </div>

      <PageLeadPanel
        heading="Projects"
        intro="先看项目总量与阻塞，再顺着数字跳到 Tasks / Rooms / Agents，页面不会停在单点浏览。"
        metrics={[
          { label: '项目总数', value: projects.length, to: { pathname: '/projects' } },
          { label: '活跃项目', value: projects.filter((project) => project.status === 'active').length, to: { pathname: '/projects' } },
          { label: '总阻塞项', value: blockedCount, to: { pathname: '/tasks', search: '?status=blocked' } },
          { label: '承接房间', value: rooms.length, to: { pathname: '/rooms' } },
        ]}
        actions={[
          { label: '下一步看任务流水', to: { pathname: '/tasks' } },
          { label: '下一步看承接房间', to: { pathname: '/rooms' } },
          { label: '下一步看实例状态', to: { pathname: '/agents' } },
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
                  <span>阶段</span>
                  <strong>{project.stage}</strong>
                </div>
                <div>
                  <span>负责人</span>
                  <strong>{project.owner}</strong>
                </div>
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
              <div className="info-block emphasis-block">
                <span>重点 / 下一步</span>
                <strong>{project.focus}</strong>
                <strong style={{ marginTop: '4px', fontWeight: 400, color: '#97a7c5', fontSize: '0.85em' }}>→ {project.nextStep}</strong>
              </div>
              <div className="relation-stack">
                <div>
                  <span className="section-label">实例</span>
                  <div className="object-row top-gap">
                    {linkedAgents.length > 0 ? (
                      linkedAgents.map((agent) => (
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
                      ))
                    ) : (
                      <span className="soft-tag">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="section-label">房间</span>
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
                  <span className="section-label">关联任务 {linkedTasks.length > 3 ? `(共${linkedTasks.length})` : ''}</span>
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
                  关联任务
                </NavLink>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}