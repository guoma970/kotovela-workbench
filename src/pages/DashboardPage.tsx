import { StatCard } from '../components/StatCard'
import { agents, projects, tasks, updates } from '../data/mockData'

export function DashboardPage() {
  const activeAgents = agents.filter((item) => item.status === 'active')
  const doingTasks = tasks.filter((item) => item.status === 'doing')
  const blockedTasks = tasks.filter((item) => item.status === 'blocked')
  const activeProjects = projects.filter((item) => item.status === 'active')
  const projectPipeline = projects.filter((item) => item.status !== 'blocked')

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>中枢总览</h2>
        </div>
        <p className="page-note">先把当前工作状态看清楚，再决定下一步推进。</p>
      </div>

      <div className="stats-grid strong-grid">
        <StatCard label="活跃实例数" value={activeAgents.length} tone="blue" />
        <StatCard label="进行中任务数" value={doingTasks.length} tone="green" />
        <StatCard label="blocker 数" value={blockedTasks.length} tone="red" />
        <StatCard label="活跃项目数" value={activeProjects.length} tone="orange" />
      </div>

      <div className="dashboard-grid">
        <div className="panel panel-alert blocker-panel">
          <div className="panel-header">
            <h3>Blocker 区</h3>
            <span>{blockedTasks.length} 个阻塞</span>
          </div>
          {blockedTasks.length > 0 ? (
            <div className="alert-list">
              {blockedTasks.map((task) => (
                <article key={task.id} className="alert-item">
                  <h4>{task.title}</h4>
                  <p>
                    {task.project} · {task.assignee} · 优先级：{task.priority}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">当前没有 blocker。</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>当前活跃实例</h3>
            <span>{activeAgents.length} 个</span>
          </div>
          <div className="compact-list">
            {activeAgents.map((agent) => (
              <article key={agent.id} className="compact-item">
                <div>
                  <h4>{agent.name}</h4>
                  <p>
                    {agent.role} · {agent.currentTask}
                  </p>
                </div>
                <span>{agent.updatedAt}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>当前项目推进</h3>
            <span>{projectPipeline.length} 个在推进</span>
          </div>
          <div className="project-progress-list">
            {projectPipeline.map((project) => (
              <article key={project.id} className="progress-item">
                <div className="progress-head">
                  <h4>{project.name}</h4>
                  <span>{project.progress}%</span>
                </div>
                <p>{project.focus}</p>
                <div className="progress-bar">
                  <div style={{ width: `${project.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel panel-wide">
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
      </div>
    </section>
  )
}
