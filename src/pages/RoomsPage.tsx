import { NavLink, useNavigate } from 'react-router-dom'
import { ObjectBadge } from '../components/ObjectBadge'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { roomStatusLabel } from '../lib/statusLabels'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

export function RoomsPage() {
  const { rooms, projects, agents, tasks, mode } = useOfficeInstances()
  const isInternal = mode === 'internal'
  const navigate = useNavigate()
  const pageData = { projects, agents, rooms, tasks }
  const linking = useWorkbenchLinking(pageData)
  const pendingCount = rooms.reduce((sum, room) => sum + room.pending, 0)

  const goFocus = (
    pathname: string,
    kind: 'project' | 'agent' | 'room' | 'task',
    id: string,
  ) => {
    navigate({ pathname, search: createFocusSearch(linking.currentSearch, kind, id) })
  }

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
          <p className="eyebrow">{isInternal ? 'Rooms 房间' : 'Rooms'}</p>
          <h2>{isInternal ? '房间状态总览' : 'Room Status'}</h2>
        </div>
        <p className="page-note">{isInternal ? '查看每个房间的状态、用途与最近动作。' : 'Each room shows its name, status, purpose, and most recent action.'}</p>
      </div>

      <PageLeadPanel
        heading={isInternal ? 'Rooms 房间' : 'Rooms'}
        intro={isInternal ? '先看房间容量与待处理量，再跳转任务、项目和实例。' : 'Start with room capacity and pending load, then jump to Tasks, Projects, and Agents.'}
        internalMode={isInternal}
        metrics={[
          { label: isInternal ? '房间' : 'Rooms', value: rooms.length, to: { pathname: '/rooms' } },
          { label: isInternal ? '活跃房间' : 'Active rooms', value: rooms.filter((room) => room.status === 'active').length, to: { pathname: '/rooms' } },
          { label: isInternal ? '待处理总数' : 'Pending total', value: pendingCount, to: { pathname: '/tasks' } },
          { label: isInternal ? '实例' : 'Agents', value: agents.length, to: { pathname: '/agents' } },
        ]}
        actions={[
          { label: isInternal ? '进入任务' : 'Go to tasks', to: { pathname: '/tasks' } },
          { label: isInternal ? '进入项目' : 'Go to projects', to: { pathname: '/projects' } },
          { label: isInternal ? '进入实例' : 'Go to agents', to: { pathname: '/agents' } },
        ]}
        internalHint={
          isInternal
            ? '房间：协作入口（如飞书群或话题），表达「在哪个频道对接」；具体执行项以「任务」为准。'
            : undefined
        }
      />

      <div className="card-grid">
        {rooms.map((room) => {
          const project = projects.find((item) => item.id === room.mainProjectId)
          const linkedAgents = agents.filter((agent) => room.instanceIds.includes(agent.id))
          const focusSearch = createFocusSearch(linking.currentSearch, 'room', room.id)
          return (
            <article key={room.id} className={cardClass(room.id)} onClick={() => linking.select('room', room.id)}>
              <div className="panel-header align-start">
                <ObjectBadge kind="room" code={room.code} name={room.name} hideCode={isInternal} clickable onClick={() => linking.select('room', room.id)} {...linking.getState('room', room.id)} />
                <span className={`status-pill status-${room.status}`}>{roomStatusLabel(room.status, isInternal)}</span>
              </div>
              <div className="context-strip">
                <div>
                  <span>{isInternal ? '状态' : 'Status'}</span>
                  <strong className={`status-dot status-${room.status}`}>{roomStatusLabel(room.status, isInternal)}</strong>
                </div>
                <div>
                  <span>{isInternal ? '待处理' : 'Pending'}</span>
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
                <span>{isInternal ? '用途' : 'Purpose'}</span>
                <strong>{room.purpose}</strong>
              </div>
              <div className="info-block">
                <span>{isInternal ? '最近动作' : 'Recent action'}</span>
                <strong>{room.recentAction}</strong>
              </div>
              <div className="relation-stack">
                <div>
                  <span className="section-label">{isInternal ? '项目' : 'Project'}</span>
                  <div className="object-row top-gap">
                    {project && (
                      <ObjectBadge
                        kind="project"
                        code={project.code}
                        name={project.name}
                        hideCode={isInternal}
                        compact
                        clickable
                        onClick={() => goFocus('/projects', 'project', project.id)}
                        {...linking.getState('project', project.id)}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <span className="section-label">{isInternal ? '实例' : 'Agents'} {linkedAgents.length > 0 ? '' : '—'}</span>
                  <div className="object-row top-gap">
                    {linkedAgents.map((agent) => (
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
                    ))}
                  </div>
                </div>
              </div>
              <div className="cross-link-row">
                <NavLink className="inline-link-chip" to={{ pathname: '/tasks', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  {isInternal ? '关联任务' : 'Related tasks'}
                </NavLink>
                <NavLink className="inline-link-chip" to={{ pathname: '/projects', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  {isInternal ? '关联项目' : 'Related project'}
                </NavLink>
                <NavLink className="inline-link-chip" to={{ pathname: '/agents', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  {isInternal ? '关联实例' : 'Related agents'}
                </NavLink>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}