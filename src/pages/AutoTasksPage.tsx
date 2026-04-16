import { AutoTaskSystemPanel } from './DashboardPage'

export function AutoTasksPage() {
  return (
    <section className="page home-page-v1">
      <div className="page-header home-header">
        <div>
          <p className="eyebrow">任务系统</p>
          <h2>任务调度系统</h2>
        </div>
      </div>
      <AutoTaskSystemPanel />
    </section>
  )
}
