import { agents } from '../data/mockData'

export function AgentsPage() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Agents</p>
          <h2>实例状态</h2>
        </div>
        <p className="page-note">按实例维度看清角色、任务、所属项目和更新时间。</p>
      </div>

      <div className="card-grid">
        {agents.map((agent) => (
          <article key={agent.id} className="panel info-card">
            <div className="panel-header">
              <h3>{agent.name}</h3>
              <span className={`status-pill status-${agent.status}`}>{agent.status}</span>
            </div>
            <div className="info-pairs">
              <div>
                <span>角色</span>
                <strong>{agent.role}</strong>
              </div>
              <div>
                <span>当前任务</span>
                <strong>{agent.currentTask}</strong>
              </div>
              <div>
                <span>所属项目</span>
                <strong>{agent.project}</strong>
              </div>
              <div>
                <span>最后更新时间</span>
                <strong>{agent.updatedAt}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
