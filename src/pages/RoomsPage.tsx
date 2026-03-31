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
          <h2>群与通道状态</h2>
        </div>
        <p className="page-note">每个房间展示：名称、状态、当前用途、最近动作类型。</p>
      </div>

      <PageLeadPanel
        heading="Rooms"
        intro="先看房间承接量和待处理规模，再顺着数字跳到 Tasks / Projects / Agents，保持从通道继续往下走。"
        metrics={[
          { label: '房间总数', value: rooms.length, to: { pathname: '/rooms' } },
          { label: '活跃房间', value: rooms.filter((room) => room.status === 'active').length, to: { pathname: '/rooms' } },
          { label: '待处理总量', value: pendingCount, to: { pathname: '/tasks' } },
          { label: '承接实例', value: agents.length, to: { pathname: '/agents' } },
        ]}
        actions={[
          { label: '下一步看任务流水', to: { pathname: '/tasks' } },
          { label: '下一步看项目地图', to: { pathname: '/projects' } },
          { label: '下一步看实例状态', to: { pathname: '/agents' } },
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
                  <span>状态</span>
                  <strong className={`status-dot status-${room.status}`}>{room.status}</strong>
                </div>
                <div>
                  <span>待处理</span>
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
                <span>当前用途</span>
                <strong>{room.purpose}</strong>
              </div>
              <div className="info-block">
                <span>最近动作</span>
                <strong>{room.recentAction}</strong>
              </div>
              <div className="relation-stack">
                <div>
                  <span className="section-label">承接项目</span>
                  <div className="object-row top-gap">
                    {project && <ObjectBadge kind="project" code={project.code} name={project.name} compact clickable onClick={() => linking.select('project', project.id)} {...linking.getState('project', project.id)} />}
                  </div>
                </div>
                <div>
                  <span className="section-label">实例 {linkedAgents.length > 0 ? '' : '—'}</span>
                  <div className="object-row top-gap">
                    {linkedAgents.map((agent) => (
                      <ObjectBadge key={agent.id} kind="agent" code={agent.code} name={agent.name} compact clickable onClick={() => linking.select('agent', agent.id)} {...linking.getState('agent', agent.id)} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="cross-link-row">
                <NavLink className="inline-link-chip" to={{ pathname: '/tasks', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
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