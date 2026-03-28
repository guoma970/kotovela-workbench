import { tasks } from '../data/mockData'
import type { TaskStatus } from '../types'

const columns: { key: TaskStatus; label: string }[] = [
  { key: 'doing', label: 'Doing' },
  { key: 'blocked', label: 'Blocker' },
  { key: 'done', label: 'Done' },
]

export function TasksPage() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h2>任务队列</h2>
        </div>
        <p className="page-note">按 doing / blocker / done 拆开，先把任务流看清楚。</p>
      </div>

      <div className="queue-grid">
        {columns.map((column) => {
          const items = tasks.filter((task) => task.status === column.key)
          return (
            <section key={column.key} className="panel queue-column">
              <div className="panel-header">
                <h3>{column.label}</h3>
                <span>{items.length} 条</span>
              </div>
              <div className="queue-list">
                {items.map((task) => (
                  <article key={task.id} className="queue-card">
                    <h4>{task.title}</h4>
                    <p>{task.project}</p>
                    <div className="queue-meta">
                      <span>{task.assignee}</span>
                      <span>优先级：{task.priority}</span>
                    </div>
                  </article>
                ))}
                {items.length === 0 && <p className="empty-state">当前没有任务。</p>}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}
