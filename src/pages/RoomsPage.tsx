import { NavLink, useNavigate } from 'react-router-dom'
import { ObjectBadge } from '../components/ObjectBadge'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { roomStatusLabel } from '../lib/statusLabels'
import { UI_TERMS } from '../lib/uiTerms'
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
          <p className="eyebrow">{UI_TERMS.room}</p>
          <h2>协作群状态总览</h2>
        </div>
        <p className="page-note">查看每个协作群的状态、用途与最近动作。</p>
      </div>

      <PageLeadPanel
        heading={UI_TERMS.room}
        intro="先看协作群容量与待处理量，再跳转任务、项目和同事。"
        internalMode={isInternal}
        metrics={[
          { label: UI_TERMS.room, value: rooms.length, to: { pathname: '/rooms' } },
          { label: '活跃协作群', value: rooms.filter((room) => room.status === 'active').length, to: { pathname: '/rooms' } },
          { label: '待处理总数', value: pendingCount, to: { pathname: '/tasks' } },
          { label: UI_TERMS.agent, value: agents.length, to: { pathname: '/agents' } },
        ]}
        actions={[
          { label: '进入任务', to: { pathname: '/tasks' } },
          { label: '进入项目', to: { pathname: '/projects' } },
          { label: '查看同事', to: { pathname: '/agents' } },
        ]}
        internalHint={
          isInternal
            ? '协作群：协作入口（如飞书群或话题），表达「在哪个群里对接」；具体执行项以「任务」为准。'
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
                  <span>状态</span>
                  <strong className={`status-dot status-${room.status}`}>{roomStatusLabel(room.status, isInternal)}</strong>
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
                <span>用途</span>
                <strong>{room.purpose}</strong>
              </div>
              <div className="info-block">
                <span>最近动作</span>
                <strong>{room.recentAction}</strong>
              </div>
              <div className="relation-stack">
                <div>
                  <span className="section-label">{UI_TERMS.project}</span>
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
                  <span className="section-label">{UI_TERMS.agent} {linkedAgents.length > 0 ? '' : '—'}</span>
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
                  关联任务
                </NavLink>
                <NavLink className="inline-link-chip" to={{ pathname: '/projects', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  关联项目
                </NavLink>
                <NavLink className="inline-link-chip" to={{ pathname: '/agents', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  关联同事
                </NavLink>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
