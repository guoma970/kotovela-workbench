import { useEffect, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { ObjectBadge } from '../components/ObjectBadge'
import { syncTasksFromInstances, loadOfficeInstances } from '../data/officeInstancesAdapter'
import { agents, projects, rooms, tasks as mockTasks } from '../data/mockData'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'
import type { Task, TaskStatus } from '../types'

const columns: { key: TaskStatus; label: string }[] = [
  { key: 'doing', label: 'Doing' },
  { key: 'blocked', label: 'Blocker' },
  { key: 'done', label: 'Done' },
]

function useTasksData() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks)

  useEffect(() => {
    let isActive = true

    loadOfficeInstances()
      .then((instances) => {
        if (!isActive) return

        const synced = syncTasksFromInstances(instances, mockTasks)
        setTasks(synced.tasks)
      })
      .catch(() => {
        if (!isActive) return
        setTasks(mockTasks)
      })

    return () => {
      isActive = false
    }
  }, [])

  return tasks
}

export function TasksPage() {
  const tasks = useTasksData()
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
          <p className="eyebrow">Tasks</p>
          <h2>任务队列</h2>
        </div>
        <p className="page-note">每条任务都挂上任务单、项目、执行实例三个识别点，并接入轻联动高亮。数据来源：优先读取最新状态，同步不可用时自动回退到本地快照。</p>
      </div>

      <PageLeadPanel
        heading="Tasks"
        intro="先按状态筛选任务，再进到项目、实例、房间链路里核对执行归属。"
        metrics={[
          { label: '任务总数', value: tasks.length, to: { pathname: '/tasks' } },
          { label: 'Doing', value: tasks.filter((task) => task.status === 'doing').length, to: { pathname: '/tasks', search: '?status=doing' } },
          { label: 'Blocker', value: tasks.filter((task) => task.status === 'blocked').length, to: { pathname: '/tasks', search: '?status=blocked' } },
          { label: 'Done', value: tasks.filter((task) => task.status === 'done').length, to: { pathname: '/tasks', search: '?status=done' } },
        ]}
        actions={
          statusFilter
            ? [
                {
                  label: '返回全部任务',
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
