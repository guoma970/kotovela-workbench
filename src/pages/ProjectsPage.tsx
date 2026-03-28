import { projects } from '../data/mockData'

export function ProjectsPage() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Projects</p>
          <h2>项目看板</h2>
        </div>
        <p className="page-note">本轮聚焦 5 个核心项目的状态、重点和阻塞情况。</p>
      </div>

      <div className="card-grid">
        {projects.map((project) => (
          <article key={project.id} className="panel info-card">
            <div className="panel-header">
              <h3>{project.name}</h3>
              <span className={`status-pill status-${project.status}`}>{project.status}</span>
            </div>
            <div className="info-pairs">
              <div>
                <span>负责人</span>
                <strong>{project.owner}</strong>
              </div>
              <div>
                <span>当前重点</span>
                <strong>{project.focus}</strong>
              </div>
              <div>
                <span>推进度</span>
                <strong>{project.progress}%</strong>
              </div>
              <div>
                <span>Blocker</span>
                <strong>{project.blockers}</strong>
              </div>
            </div>
            <div className="progress-bar project-card-progress">
              <div style={{ width: `${project.progress}%` }} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
