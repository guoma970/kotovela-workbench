import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { ObjectBadge } from '../components/ObjectBadge'
import { agentStatusLabel } from '../lib/statusLabels'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

export function AgentsPage() {
  const { agents, projects, rooms, tasks, mode } = useOfficeInstances()
  const isInternal = mode === 'internal'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pageData = { projects, agents, rooms, tasks }
  const linking = useWorkbenchLinking(pageData)
  const statusFilter = searchParams.get('status')

  const goFocus = (
    pathname: string,
    kind: 'project' | 'agent' | 'room' | 'task',
    id: string,
  ) => {
    navigate({ pathname, search: createFocusSearch(linking.currentSearch, kind, id) })
  }

  const activeAgents = agents.filter((agent) => agent.status === 'active')
  const idleAgents = agents.filter((agent) => agent.status === 'idle')
  const blockedAgents = agents.filter((agent) => agent.status === 'blocked')
  const filteredAgents =
    statusFilter && ['active', 'idle', 'blocked'].includes(statusFilter)
      ? agents.filter((agent) => agent.status === statusFilter)
      : agents

  const targetAgent = agents.find((agent) => agent.status === 'blocked') ?? agents[0]
  const targetFocusSearch = targetAgent
    ? createFocusSearch(linking.currentSearch, 'agent', targetAgent.id)
    : createFocusSearch(linking.currentSearch)

  const cardClass = (id: string) => {
    const state = linking.getState('agent', id)
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
          <p className="eyebrow">{isInternal ? 'Agents 实例' : 'Agents'}</p>
          <h2>{isInternal ? '实例状态总览' : 'Agent Status'}</h2>
        </div>
        <p className="page-note">{isInternal ? '快速查看谁在阻塞、推进或待命。' : 'See who is blocked, active, or idle at a glance.'}</p>
      </div>

      <PageLeadPanel
        heading={isInternal ? 'Agents 实例' : 'Agents'}
        intro={isInternal ? '优先处理阻塞实例，再确认当前执行链。' : 'Start with blocked agents, then confirm the active execution chain.'}
        internalMode={isInternal}
        metrics={[
          { label: isInternal ? '实例' : 'Agents', value: agents.length, to: { pathname: '/agents' } },
          { label: isInternal ? '进行中' : 'Active', value: activeAgents.length, to: { pathname: '/agents', search: '?status=active' } },
          { label: isInternal ? '阻塞' : 'Blocked', value: blockedAgents.length, to: { pathname: '/agents', search: '?status=blocked' } },
          { label: isInternal ? '待命' : 'Idle', value: idleAgents.length, to: { pathname: '/agents', search: '?status=idle' } },
        ]}
        actions={
          targetAgent
            ? [
                {
                  label: isInternal ? '查看阻塞实例' : 'View blocked agent',
                  to: { pathname: '/agents', search: targetFocusSearch },
                },
              ]
            : []
        }
      />

      <div className="card-grid">
        {filteredAgents.map((agent) => {
          const project = projects.find((item) => item.id === agent.projectId)
          const linkedTasks = tasks.filter((task) => task.executorAgentId === agent.id)
          const linkedRooms = rooms.filter((room) => room.instanceIds.includes(agent.id))
          const focusSearch = createFocusSearch(linking.currentSearch, 'agent', agent.id)
          return (
            <article key={agent.id} className={cardClass(agent.id)} onClick={() => linking.select('agent', agent.id)}>
              <div className="panel-header align-start">
                <ObjectBadge
                  kind="agent"
                  code={agent.code}
                  name={agent.name}
                  hideCode={isInternal}
                  instanceKey={agent.instanceKey}
                  agentId={agent.id}
                  clickable
                  onClick={() => linking.select('agent', agent.id)}
                  {...linking.getState('agent', agent.id)}
                />
                <span className={`status-pill status-${agent.status}`}>{agentStatusLabel(agent.status, isInternal)}</span>
              </div>

              {agent.role ? <p className="agent-card-role">{agent.role}</p> : null}

              <div className="info-block emphasis-block">
                <span>{isInternal ? '当前任务' : 'Current task'}</span>
                <strong>{agent.currentTask}</strong>
              </div>

              {project && (
                <div className="object-row" style={{ marginTop: '8px' }}>
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
                </div>
              )}

              {linkedRooms.length > 0 ? (
                <div className="object-row" style={{ marginTop: '8px' }}>
                  {linkedRooms.map((room) => (
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
                  ))}
                </div>
              ) : null}

              <div className="queue-meta dense-meta" style={{ marginTop: '8px' }}>
                <span className="soft-tag">{isInternal ? '更新：' : 'Updated: '}{agent.updatedAt}</span>
                {linkedRooms.length > 0 && (
                  <span className="soft-tag">· {linkedRooms.length} {isInternal ? '个房间' : 'rooms'}</span>
                )}
                {linkedTasks.length > 0 && (
                  <span className="soft-tag">· {linkedTasks.length} {isInternal ? '个任务' : 'tasks'}</span>
                )}
              </div>

              <div className="cross-link-row">
                <NavLink className="inline-link-chip" to={{ pathname: '/tasks', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  {isInternal ? '查看关联任务' : 'View related tasks'}
                </NavLink>
                <NavLink className="inline-link-chip" to={{ pathname: '/rooms', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  {isInternal ? '查看关联房间' : 'View related rooms'}
                </NavLink>
                <NavLink className="inline-link-chip" to={{ pathname: '/projects', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  {isInternal ? '查看关联项目' : 'View related project'}
                </NavLink>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
