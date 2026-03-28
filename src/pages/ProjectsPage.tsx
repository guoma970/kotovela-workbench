import { projects } from '../data/mockData'

export function ProjectsPage() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Projects</p>
          <h2>项目看板</h2>
        </div>
        <p className="page-note">统一展示阶段、负责人、状态、blocker、下一步和关联任务数。</p>
      </div>

      <div className="card-grid project-grid">
        {projects.map((project) => (
          <article key={project.id} className="panel info-card strong-card">
            <div className="panel-header">
              <h3>{project.name}</h3>
              <span className={`status-pill status-${project.status}`}>{project.status}</span>
            </div>
            <div className="info-pairs">
              <div>
                <span>当前阶段</span>
                <strong>{project.stage}</strong>
              </div>
              <div>
                <span>当前负责人</span>
                <strong>{project.owner}</strong>
              </div>
              <div>
                <span>Blocker</span>
                <strong>{project.blockers}</strong>
              </div>
              <div>
                <span>当前关联任务数</span>
                <strong>{project.taskCount}</strong>
              </div>
            </div>
            <div className="info-block">
              <span>当前重点</span>
              <strong>{project.focus}</strong>
            </div>
            <div className="info-block">
              <span>下一步</span>
              <strong>{project.nextStep}</strong>
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
