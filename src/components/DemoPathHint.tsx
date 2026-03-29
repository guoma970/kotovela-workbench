import { NavLink, useLocation } from 'react-router-dom'

type Step = {
  to: string
  label: string
  hint: string
}

const steps: Step[] = [
  { to: '/', label: 'Dashboard', hint: '当前聚焦：总览（中枢状态）' },
  { to: '/projects', label: 'Projects', hint: '当前聚焦：项目地图（跟踪与承接）' },
  { to: '/rooms', label: 'Rooms', hint: '当前聚焦：协作通道（执行牵引）' },
  { to: '/tasks', label: 'Tasks', hint: '当前聚焦：任务流水（阻塞与待办）' },
  { to: '/agents', label: 'Agents', hint: '当前聚焦：实例状态（指挥与分派）' },
]

export function DemoPathHint() {
  const location = useLocation()

  return (
    <section className="panel strong-card demo-path">
      <div className="panel-header">
        <h3>Demo 演示路径</h3>
        <span>自然演示，不需任何说明弹窗</span>
      </div>
      <div className="demo-path-strip">
        {steps.map((step) => (
          <NavLink
            key={step.to}
            to={step.to}
            className={({ isActive }) =>
              isActive ? 'demo-step is-current' : 'demo-step'
            }
          >
            <strong>{step.label}</strong>
            <span>{step.hint}</span>
          </NavLink>
        ))}
      </div>
      <p className="page-note demo-path-tip">
        适合给第一位观看者：打开即从 <strong>Dashboard</strong> 看全局，再顺序点入
        <span className="path-inline">Projects → Rooms → Tasks → Agents</span>
        {location.pathname === '/agents'
          ? '（最后在实例层复盘执行闭环）'
          : '（可快速打通跨页联动）'}。
      </p>
    </section>
  )
}
