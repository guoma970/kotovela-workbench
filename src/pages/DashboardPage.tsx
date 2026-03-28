import { StatCard } from '../components/StatCard'
import { agents, decisions, projects, tasks, updates } from '../data/mockData'

const updateTypeLabel = {
  task: '任务更新',
  project: '项目更新',
  agent: '实例状态更新',
}

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
        <p className="page-note">把阻塞、优先级、更新类型和待拍板事项放到同一张驾驶舱里。</p>
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
                  <div className="item-head">
                    <h4>{task.title}</h4>
                    <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
                  </div>
                  <p>
                    来源：{task.project} · 执行实例：{task.executor}
                  </p>
                  <p>最近更新时间：{task.updatedAt}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">当前没有 blocker。</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>待拍板事项</h3>
            <span>{decisions.length} 项</span>
          </div>
          <div className="compact-list">
            {decisions.map((decision) => (
              <article key={decision.id} className="compact-item compact-card">
                <div>
                  <h4>{decision.title}</h4>
                  <p>
                    {decision.project} · {decision.owner}
                  </p>
                </div>
                <span className={`priority-badge priority-${decision.priority}`}>{decision.priority}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>当前活跃实例</h3>
            <span>{activeAgents.length} 个</span>
          </div>
          <div className="compact-list">
            {activeAgents.map((agent) => (
              <article key={agent.id} className="compact-item compact-card">
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
                <div className="item-tags">
                  <span className={`status-pill status-${project.status}`}>{project.status}</span>
                  <span className="soft-tag">任务 {project.taskCount}</span>
                </div>
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
              <article key={item.id} className={`update-item update-${item.level}`}>
                <div>
                  <div className="item-head">
                    <h4>{item.title}</h4>
                    <span className="soft-tag">{updateTypeLabel[item.type]}</span>
                  </div>
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
