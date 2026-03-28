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
        <p className="page-note">补齐优先级、项目标识、执行实例和更新时间，让队列更像真实工作流。</p>
      </div>

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
                {items.map((task) => (
                  <article key={task.id} className="queue-card">
                    <div className="item-head">
                      <h4>{task.title}</h4>
                      <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
                    </div>
                    <div className="item-tags">
                      <span className="soft-tag">项目：{task.project}</span>
                      <span className="soft-tag">实例：{task.executor}</span>
                    </div>
                    <div className="queue-meta dense-meta">
                      <span>负责人：{task.assignee}</span>
                      <span>更新时间：{task.updatedAt}</span>
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
