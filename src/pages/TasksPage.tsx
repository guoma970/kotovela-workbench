import { NavLink } from 'react-router-dom'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { ObjectBadge } from '../components/ObjectBadge'
import { agents, projects, rooms, tasks } from '../data/mockData'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'
import type { TaskStatus } from '../types'

const columns: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'doing', label: 'Doing' },
  { key: 'blocked', label: 'Blocker' },
  { key: 'done', label: 'Done' },
]

const pageData = { projects, agents, rooms, tasks }

export function TasksPage() {
  const linking = useWorkbenchLinking(pageData)

  const allColumns = ['todo', 'doing', 'blocked', 'done'] as const
  const counts = allColumns.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status).length
      return acc
    },
    { todo: 0, doing: 0, blocked: 0, done: 0 } as Record<'todo' | 'doing' | 'blocked' | 'done', number>,
  )

  const overdueTask = tasks.find((task) => task.status === 'blocked')
  const overdueSearch = overdueTask
    ? createFocusSearch(linking.currentSearch, 'task', overdueTask.id)
    : createFocusSearch(linking.currentSearch)

  const highPriorityTasks = tasks.filter((task) => task.priority === 'high').length

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
          <p className="eyebrow">Tasks</p>
          <h2>任务队列</h2>
        </div>
        <p className="page-note">每条任务都挂上任务单、项目、执行实例三个统一识别点，并接入轻联动高亮。</p>
      </div>

      <PageLeadPanel
        heading="Tasks"
        intro="先看 todo 再看 blocker 与 doing，确保待办和阻塞任务有明确追踪对象。"
        metrics={[
          { label: '任务总数', value: tasks.length },
          { label: 'todo', value: counts.todo },
          { label: 'doing', value: counts.doing },
          { label: 'blocker', value: counts.blocked },
          { label: 'done', value: counts.done },
          { label: '高优先级', value: highPriorityTasks },
        ]}
        actions={
          overdueTask
            ? [
                {
                  label: `先打通阻塞项 · ${overdueTask.code}`,
                  to: { pathname: '/', search: overdueSearch },
                },
                {
                  label: '查看该任务下的实例',
                  to: { pathname: '/agents', search: overdueSearch },
                },
              ]
            : []
        }
      />

      <div className="queue-grid">
        {columns.map((column) => {
          const items = tasks.filter((task) => task.status === column.key)
          return (
            <section key={column.key} className="panel queue-column strong-card">
              <div className="panel-header">
                <h3>{column.label}</h3>
                <span>{items.length} 条</span>
              </div>
              <div className="queue-list">
                {items.map((task) => {
                  const project = projects.find((item) => item.id === task.projectId)
                  const agent = agents.find((item) => item.id === task.executorAgentId)
                  const linkedRooms = rooms.filter(
                    (room) => room.mainProjectId === task.projectId || room.instanceIds.includes(task.executorAgentId),
                  )
                  const focusSearch = createFocusSearch(linking.currentSearch, 'task', task.id)
                  return (
                    <article key={task.id} className={cardClass(task.id)} onClick={() => linking.select('task', task.id)}>
                      <div className="item-head">
                        <h4>{task.title}</h4>
                        <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
                      </div>
                      <div className="object-row top-gap">
                        <ObjectBadge kind="task" code={task.code} compact clickable onClick={() => linking.select('task', task.id)} {...linking.getState('task', task.id)} />
                        {project && <ObjectBadge kind="project" code={project.code} name={project.name} compact clickable onClick={() => linking.select('project', project.id)} {...linking.getState('project', project.id)} />}
                        {agent && <ObjectBadge kind="agent" code={agent.code} name={agent.name} compact clickable onClick={() => linking.select('agent', agent.id)} {...linking.getState('agent', agent.id)} />}
                      </div>
                      <div className="object-row top-gap">
                        {linkedRooms.map((room) => (
                          <ObjectBadge key={room.id} kind="room" code={room.code} name={room.name} compact clickable onClick={() => linking.select('room', room.id)} {...linking.getState('room', room.id)} />
                        ))}
                      </div>
                      <div className="cross-link-row">
                        <NavLink className="inline-link-chip" to={{ pathname: '/projects', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                          查看相关项 · Projects
                        </NavLink>
                        <NavLink className="inline-link-chip" to={{ pathname: '/rooms', search: focusSearch }} onClick={(event) => event.stopPropagation()}>
                          查看相关项 · Rooms
                        </NavLink>
                      </div>
                      <div className="queue-meta dense-meta">
                        <span>负责人：{task.assignee}</span>
                        <span>更新时间：{task.updatedAt}</span>
                      </div>
                    </article>
                  )
                })}
                {items.length === 0 && <p className="empty-state">当前没有任务。</p>}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}
