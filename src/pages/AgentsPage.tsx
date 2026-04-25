import { useSearchParams } from 'react-router-dom'
import { NavLink } from 'react-router-dom'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { ObjectBadge } from '../components/ObjectBadge'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

export function AgentsPage() {
  const { agents, projects, rooms, tasks } = useOfficeInstances()
  const [searchParams] = useSearchParams()
  const pageData = { projects, agents, rooms, tasks }
  const linking = useWorkbenchLinking(pageData)
  const statusFilter = searchParams.get('status')

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
          <p className="eyebrow">Agents</p>
          <h2>实例状态</h2>
        </div>
        <p className="page-note">一眼看出谁卡住 / 谁在干 / 谁空着。</p>
      </div>

      <PageLeadPanel
        heading="Agents"
        intro="优先处理阻塞实例，接着确认活跃实例的任务链路。"
        metrics={[
          { label: '实例', value: agents.length, to: { pathname: '/agents' } },
          { label: '活跃', value: activeAgents.length, to: { pathname: '/agents', search: '?status=active' } },
          { label: '阻塞', value: blockedAgents.length, to: { pathname: '/agents', search: '?status=blocked' } },
          { label: '待命', value: idleAgents.length, to: { pathname: '/agents', search: '?status=idle' } },
        ]}
        actions={
          targetAgent
            ? [
                {
                  label: '查看阻塞实例',
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
                <ObjectBadge kind="agent" code={agent.code} name={agent.name} clickable onClick={() => linking.select('agent', agent.id)} {...linking.getState('agent', agent.id)} />
                <span className={`status-pill status-${agent.status}`}>{agent.status}</span>
              </div>

              <div className="info-block emphasis-block">
                <span>当前任务</span>
                <strong>{agent.currentTask}</strong>
              </div>

              {project && (
                <div className="object-row" style={{ marginTop: '8px' }}>
                  <ObjectBadge kind="project" code={project.code} name={project.name} compact clickable onClick={() => linking.select('project', project.id)} {...linking.getState('project', project.id)} />
                </div>
              )}

              <div className="queue-meta dense-meta" style={{ marginTop: '8px' }}>
                <span className="soft-tag">更新：{agent.updatedAt}</span>
                {linkedRooms.length > 0 && (
                  <span className="soft-tag">· {linkedRooms.length} 个房间</span>
                )}
                {linkedTasks.length > 0 && (
                  <span className="soft-tag">· {linkedTasks.length} 个任务</span>
                )}
              </div>

              <div className="cross-link-row">
                <NavLink className="inline-link-chip" to={{ pathname: '/tasks', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                  查看关联任务
                </NavLink>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
