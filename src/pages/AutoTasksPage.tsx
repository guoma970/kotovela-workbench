import { AutoTaskSystemPanel } from './Dashboard/components/DashboardAutoTaskPanel'
import { INTERNAL_PRODUCT_TITLE } from '../config/brand'

export function AutoTasksPage() {
  return (
    <section className="page home-page-v1">
      <div className="page-header home-header">
        <div>
          <p className="eyebrow">任务系统</p>
          <h2>{INTERNAL_PRODUCT_TITLE}</h2>
        </div>
      </div>
      <AutoTaskSystemPanel />
    </section>
  )
}
