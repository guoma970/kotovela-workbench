import { agents } from '../data/mockData'

export function AgentsPage() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Agents</p>
          <h2>实例状态</h2>
        </div>
        <p className="page-note">展示当前协作实例的角色、状态与手头任务。</p>
      </div>

      <div className="panel list-panel">
        {agents.map((agent) => (
          <article key={agent.id} className="list-row">
            <div>
              <h3>{agent.name}</h3>
              <p>
                {agent.role} · {agent.currentTask}
              </p>
            </div>
            <div className="row-meta">
              <span className={`status-pill status-${agent.status}`}>{agent.status}</span>
              <span>{agent.updatedAt}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
