import { AutoTaskSystemPanel } from './Dashboard/components/DashboardAutoTaskPanel'
import { BRAND_NAME } from '../config/brand'

export function AutoTasksPage() {
  return (
    <section className="page home-page-v1">
      <div className="page-header home-header">
        <div>
          <p className="eyebrow">{BRAND_NAME}</p>
          <h2>执行工作台</h2>
        </div>
        <p className="page-note">把任务分配、执行进度、结果回报和待人工处理集中到同一页查看，先看结果，再按需展开原始记录。</p>
      </div>
      <AutoTaskSystemPanel />
    </section>
  )
}
