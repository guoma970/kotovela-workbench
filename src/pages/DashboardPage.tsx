import { StatCard } from '../components/StatCard'
import { agents, projects, tasks, updates } from '../data/mockData'

export function DashboardPage() {
  const activeAgents = agents.filter((item) => item.status === 'active').length
  const doingTasks = tasks.filter((item) => item.status === 'doing').length
  const blockers = tasks.filter((item) => item.status === 'blocked').length
  const activeProjects = projects.filter((item) => item.status === 'active').length

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>中枢总览</h2>
        </div>
        <p className="page-note">先看结构、状态和最近变化，不上复杂后台逻辑。</p>
      </div>

      <div className="stats-grid">
        <StatCard label="活跃实例数" value={activeAgents} tone="blue" />
        <StatCard label="进行中任务数" value={doingTasks} tone="green" />
        <StatCard label="blocker 数" value={blockers} tone="red" />
        <StatCard label="活跃项目数" value={activeProjects} tone="orange" />
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>最近更新流</h3>
          <span>{updates.length} 条</span>
        </div>
        <div className="update-list">
          {updates.map((item) => (
            <article key={item.id} className={`update-item update-${item.type}`}>
              <div>
                <h4>{item.title}</h4>
                <p>
                  {item.source} · {item.time}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
