import { NavLink, useNavigate } from 'react-router-dom'
import { ObjectBadge } from '../components/ObjectBadge'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { projectStatusLabel } from '../lib/statusLabels'
import { UI_TERMS } from '../lib/uiTerms'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

export function ProjectsPage() {
  const { projects, agents, rooms, tasks, mode } = useOfficeInstances()
  const showCockpitDetail = mode === 'internal'
  const navigate = useNavigate()
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

  const goFocus = (
    pathname: string,
    kind: 'project' | 'agent' | 'room' | 'task',
    id: string,
  ) => {
    navigate({ pathname, search: createFocusSearch(linking.currentSearch, kind, id) })
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{UI_TERMS.project}</p>
          <h2>项目看板总览</h2>
        </div>
        <p className="page-note">
          每个项目展示阶段、负责人、卡住的事与关联同事。
        </p>
      </div>

      <PageLeadPanel
        heading={UI_TERMS.project}
        intro={
          showCockpitDetail
            ? `先看项目数量与${UI_TERMS.blocker}，再进入任务、协作群与同事。`
            : `先看项目数量与${UI_TERMS.blocker}，再进入任务、协作群与同事。`
        }
        internalMode={showCockpitDetail}
        metrics={[
          { label: UI_TERMS.project, value: projects.length, to: { pathname: '/projects' } },
          { label: '正在做的项目', value: projects.filter((project) => project.status === 'active').length, to: { pathname: '/projects' } },
          { label: UI_TERMS.blocker, value: blockedCount, to: { pathname: '/tasks', search: '?status=blocked' } },
          { label: UI_TERMS.room, value: rooms.length, to: { pathname: '/rooms' } },
        ]}
        actions={[
          { label: '进入任务', to: { pathname: '/tasks' } },
          { label: '进入协作群', to: { pathname: '/rooms' } },
          { label: '查看同事', to: { pathname: '/agents' } },
        ]}
        internalHint={
          showCockpitDetail
            ? '项目：多同事、多任务下的成果与阶段归属；在飞书群里布置的具体事，落在「任务」里。'
            : undefined
        }
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
                    hideCode={showCockpitDetail}
                    clickable
                    onClick={() => linking.select('project', project.id)}
                    {...linking.getState('project', project.id)}
                  />
                </div>
                <span className={`status-pill status-${project.status}`}>{projectStatusLabel(project.status, showCockpitDetail)}</span>
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
                {showCockpitDetail && (project.instanceCount ?? 0) > 1 ? (
                  <div>
                    <span>{UI_TERMS.agent}</span>
                    <strong>{project.instanceCount}</strong>
                  </div>
                ) : null}
                <div>
                  <span>{UI_TERMS.blocker}</span>
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
                <span>项目焦点 / 下一步</span>
                <strong>{project.focus}</strong>
                <strong style={{ marginTop: '4px', fontWeight: 400, color: '#97a7c5', fontSize: '0.85em' }}>→ {project.nextStep}</strong>
              </div>
              <div className="relation-stack">
                <div>
                  <span className="section-label">{UI_TERMS.agent}</span>
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
                          onClick={() => goFocus('/agents', 'agent', agent.id)}
                          {...linking.getState('agent', agent.id)}
                        />
                      ))
                    ) : (
                      <span className="soft-tag">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="section-label">{UI_TERMS.room}</span>
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
                          onClick={() => goFocus('/rooms', 'room', room.id)}
                          {...linking.getState('room', room.id)}
                        />
                      ))
                    ) : (
                      <span className="soft-tag">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="section-label">
                    {UI_TERMS.task} {linkedTasks.length > 3 ? `(${linkedTasks.length} 个)` : ''}
                  </span>
                  <div className="object-row top-gap">
                    {linkedTasks.slice(0, 3).map((task) => (
                      <ObjectBadge
                        key={task.id}
                        kind="task"
                        code={task.code}
                        name={task.title}
                        compact
                        clickable
                        onClick={() => goFocus('/tasks', 'task', task.id)}
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
