import { AutoTaskSystemPanel } from './Dashboard/components/DashboardAutoTaskPanel'
import { INTERNAL_PRODUCT_TITLE } from '../config/brand'

export function AutoTasksPage() {
  return (
    <section className="page home-page-v1">
      <div className="page-header home-header">
        <div>
          <p className="eyebrow">执行中枢</p>
          <h2>{INTERNAL_PRODUCT_TITLE}</h2>
        </div>
        <p className="page-note">把任务分配、执行进度、结果回报和待人工处理集中到同一页查看。</p>
      </div>
      <AutoTaskSystemPanel />
    </section>
  )
}
