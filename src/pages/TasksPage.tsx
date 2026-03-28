import { tasks } from '../data/mockData'

export function TasksPage() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h2>任务队列</h2>
        </div>
        <p className="page-note">先放任务标题、归属、负责人和状态，不做复杂排程。</p>
      </div>

      <div className="panel list-panel">
        {tasks.map((task) => (
          <article key={task.id} className="list-row stacked-row">
            <div>
              <h3>{task.title}</h3>
              <p>
                {task.project} · {task.assignee} · 优先级：{task.priority}
              </p>
            </div>
            <div className="row-meta">
              <span className={`status-pill status-${task.status}`}>{task.status}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
