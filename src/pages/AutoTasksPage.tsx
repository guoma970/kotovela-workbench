import { AutoTaskSystemPanel } from './Dashboard/components/DashboardAutoTaskPanel'
import { BRAND_NAME } from '../config/brand'

export function AutoTasksPage() {
  return (
    <section className="page home-page-v1">
      <div className="page-header home-header">
        <div>
          <p className="eyebrow">{BRAND_NAME}</p>
          <h2>执行中枢：先看结果</h2>
        </div>
        <p className="page-note">第一屏先看正在推进什么、哪里卡住、下一步谁处理；原始记录和排障字段折叠到下层。</p>
      </div>
      <AutoTaskSystemPanel />
    </section>
  )
}
