import { useSearchParams } from 'react-router-dom'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { ObjectBadge } from '../components/ObjectBadge'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { useWorkbenchLinking } from '../lib/workbenchLinking'
import type { TaskStatus } from '../types'

const columns: { key: TaskStatus; label: string }[] = [
  { key: 'doing', label: 'Doing' },
  { key: 'blocked', label: 'Blocker' },
  { key: 'done', label: 'Done' },
]

export function TasksPage() {
  const { tasks, projects, agents, rooms, mode } = useOfficeInstances()
  const isInternal = mode === 'internal'
  const [searchParams] = useSearchParams()
  const pageData = { projects, agents, rooms, tasks }
  const linking = useWorkbenchLinking(pageData)
  const statusFilter = searchParams.get('status')
  const filteredTasks =
    statusFilter && ['doing', 'blocked', 'done'].includes(statusFilter)
      ? tasks.filter((task) => task.status === statusFilter)
      : tasks

  const cardClass = (id: string) => {
    const state = linking.getState('task', id)
    return [
      'queue-card panel-surface',
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
          <p className="eyebrow">{isInternal ? 'Tasks 任务' : 'Tasks'}</p>
          <h2>{isInternal ? '任务队列' : 'Task Queue'}</h2>
        </div>
        <p className="page-note">{isInternal ? '阻塞优先，推进进行中，再沉淀已完成任务。' : 'Prioritize blockers, move active work, then archive completed tasks.'}</p>
      </div>

      <PageLeadPanel
        heading={isInternal ? 'Tasks 任务' : 'Tasks'}
        intro={isInternal ? '先看阻塞任务，再复核进行中的执行链。' : 'Start with blocked tasks, then review work in progress.'}
        metrics={[
          { label: isInternal ? '总任务' : 'Total', value: tasks.length, to: { pathname: '/tasks' } },
          { label: isInternal ? '进行中' : 'Doing', value: tasks.filter((task) => task.status === 'doing').length, to: { pathname: '/tasks', search: '?status=doing' } },
          { label: isInternal ? '阻塞' : 'Blocker', value: tasks.filter((task) => task.status === 'blocked').length, to: { pathname: '/tasks', search: '?status=blocked' } },
          { label: isInternal ? '已完成' : 'Done', value: tasks.filter((task) => task.status === 'done').length, to: { pathname: '/tasks', search: '?status=done' } },
        ]}
        actions={
          statusFilter
            ? [
                {
                  label: isInternal ? '返回全部任务' : 'Back to all tasks',
                  to: { pathname: '/tasks' },
                },
              ]
            : []
        }
      />

      <div className="queue-grid">
        {columns.map((column) => {
          const items = filteredTasks.filter((task) => task.status === column.key)
          return (
            <section key={column.key} className="panel queue-column strong-card">
              <div className="panel-header">
                <h3>
                  {isInternal
                    ? column.key === 'doing'
                      ? '进行中'
                      : column.key === 'blocked'
                        ? '阻塞'
                        : '已完成'
                    : column.label}
                </h3>
                <span className="badge-count">{items.length}</span>
              </div>
              <div className="queue-list">
                {items.map((task) => {
                  const project = projects.find((item) => item.id === task.projectId)
                  const agent = agents.find((item) => item.id === task.executorAgentId)
                  return (
                    <article key={task.id} className={cardClass(task.id)} onClick={() => linking.select('task', task.id)}>
                      <div className="item-head">
                        <h4>{task.title}</h4>
                        <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
                      </div>
                      <div className="object-row top-gap">
                        {project && <ObjectBadge kind="project" code={project.code} name={project.name} compact clickable onClick={() => linking.select('project', project.id)} {...linking.getState('project', project.id)} />}
                        {agent && (
                          <ObjectBadge
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
                        )}
                      </div>
                      <div className="queue-meta dense-meta">
                        <span>{task.assignee}</span>
                        <span className="soft-tag">· {task.updatedAt}</span>
                      </div>
                    </article>
                  )
                })}
                {items.length === 0 && <p className="empty-state empty-compact">{isInternal ? '暂无任务' : 'No tasks'}</p>}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}
