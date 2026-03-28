import { projects } from '../data/mockData'

export function ProjectsPage() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Projects</p>
          <h2>项目看板</h2>
        </div>
        <p className="page-note">先用静态结构展示项目状态和推进度。</p>
      </div>

      <div className="panel list-panel">
        {projects.map((project) => (
          <article key={project.id} className="list-row stacked-row">
            <div>
              <h3>{project.name}</h3>
              <p>
                负责人：{project.owner} · 进度：{project.progress}%
              </p>
            </div>
            <div className="row-meta">
              <span className={`status-pill status-${project.status}`}>{project.status}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
