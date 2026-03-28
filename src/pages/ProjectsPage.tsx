import { NavLink } from 'react-router-dom'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { ObjectBadge } from '../components/ObjectBadge'
import { agents, projects, rooms, tasks } from '../data/mockData'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

const pageData = { projects, agents, rooms, tasks }

export function ProjectsPage() {
  const linking = useWorkbenchLinking(pageData)

  const totalTaskCount = tasks.length
  const activeProjects = projects.filter((project) => project.status === 'active')
  const blockedProjects = projects.filter((project) => project.status === 'blocked')
  const planningProjects = projects.filter((project) => project.status === 'planning')

  const topFocusProject = [...projects].sort((a, b) => b.blockers - a.blockers || b.progress - a.progress)[0]
  const topFocusSearch = topFocusProject
    ? createFocusSearch(linking.currentSearch, 'project', topFocusProject.id)
    : createFocusSearch(linking.currentSearch)
  const keyProject = topFocusProject?.name ?? '暂无主项目'

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
        <p className="page-note">统一展示项目主标识、实例承接、关联群和任务量，跟 Dashboard / Tasks / Rooms 保持同一识别方式。</p>
      </div>

      <PageLeadPanel
        heading="Projects"
        intro="先看主项目、阻塞项目与任务总量，确认下一步演示切口。"
        metrics={[
          { label: '项目总数', value: projects.length },
          { label: '进行中', value: activeProjects.length },
          { label: '待拍板', value: blockedProjects.length },
          { label: '待执行', value: planningProjects.length },
          { label: '任务总量', value: totalTaskCount },
          { label: '当前主航道', value: keyProject },
        ]}
        actions={
          topFocusProject
            ? [
                {
                  label: `查看主项目相关任务 · ${topFocusProject.name}`,
                  to: { pathname: '/tasks', search: topFocusSearch },
                },
                {
                  label: `看主项目承接群 · ${topFocusProject.name}`,
                  to: { pathname: '/rooms', search: topFocusSearch },
                },
              ]
            : []
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
                    clickable
                    onClick={() => linking.select('project', project.id)}
                    {...linking.getState('project', project.id)}
                  />
                </div>
                <span className={`status-pill status-${project.status}`}>{project.status}</span>
              </div>
              <div className="context-strip">
                <div>
                  <span>当前阶段</span>
                  <strong>{project.stage}</strong>
                </div>
                <div>
                  <span>负责人</span>
                  <strong>{project.owner}</strong>
                </div>
                <div>
                  <span>Blocker</span>
                  <strong>{project.blockers}</strong>
                </div>
                <div>
                  <span>任务量</span>
                  <strong>{project.taskCount}</strong>
                </div>
              </div>
              <div className="info-block emphasis-block">
                <span>当前重点</span>
                <strong>{project.focus}</strong>
              </div>
              <div className="info-block">
                <span>下一步</span>
                <strong>{project.nextStep}</strong>
              </div>
              <div className="relation-stack">
                <div>
                  <span className="section-label">关联实例</span>
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
                          openInPanel
                          onClick={() => linking.select('agent', agent.id)}
                          {...linking.getState('agent', agent.id)}
                        />
                      ))
                    ) : (
                      <span className="soft-tag">暂未绑定实例</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="section-label">承接群 / 房间</span>
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
                      <span className="soft-tag">暂无房间承接</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="section-label">关联任务</span>
                  <div className="object-row top-gap">
                    {linkedTasks.length > 0 ? (
                      linkedTasks.map((task) => (
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
                      ))
                    ) : (
                      <span className="soft-tag">暂无任务挂载</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="cross-link-row">
                <NavLink
                  className="inline-link-chip"
                  to={{ pathname: '/tasks', search: focusSearch }}
                  onClick={(event) => event.stopPropagation()}
                >
                  查看相关项 · Tasks
                </NavLink>
                <NavLink
                  className="inline-link-chip"
                  to={{ pathname: '/rooms', search: focusSearch }}
                  onClick={(event) => event.stopPropagation()}
                >
                  查看相关项 · Rooms
                </NavLink>
                <NavLink
                  className="inline-link-chip"
                  to={{ pathname: '/agents', search: focusSearch }}
                  onClick={(event) => event.stopPropagation()}
                >
                  查看相关项 · Agents
                </NavLink>
              </div>
              <div className="progress-bar project-card-progress">
                <div style={{ width: `${project.progress}%` }} />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
