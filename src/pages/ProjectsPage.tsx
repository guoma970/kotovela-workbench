import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { DemoPathHint } from '../components/DemoPathHint'
import { ObjectBadge } from '../components/ObjectBadge'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { syncProjectsFromInstances, loadOfficeInstances } from '../data/officeInstancesAdapter'
import { agents, projects as mockProjects, rooms, tasks } from '../data/mockData'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'
import type { Project } from '../types'

function useProjectsData() {
  const [projects, setProjects] = useState<Project[]>(mockProjects)

  useEffect(() => {
    let isActive = true

    loadOfficeInstances()
      .then((instances) => {
        if (!isActive) return

        const synced = syncProjectsFromInstances(instances, mockProjects)
        setProjects(synced.projects)
      })
      .catch(() => {
        if (!isActive) return
        setProjects(mockProjects)
      })

    return () => {
      isActive = false
    }
  }, [])

  return projects
}

export function ProjectsPage() {
  const projects = useProjectsData()
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
        <p className="page-note">
          统一展示项目主标识、实例承接、关联群和任务量，跟 Dashboard / Tasks / Rooms 保持同一识别方式。<br />
          数据来源：当前列表以演示态（mock）为主，相关实例状态与面板支持真实源回传。
        </p>
      </div>

      <DemoPathHint />

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
                  <span>当前阶段</span>
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
                <div>
                  <span>任务量</span>
                  <strong>
                    <NavLink
                      className="context-strip-metric-link"
                      to={{ pathname: '/tasks', search: focusSearch }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {project.taskCount}
                    </NavLink>
                  </strong>
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
