import { NavLink, useLocation } from 'react-router-dom'

type Step = {
  to: string
  label: string
  hint: string
}

const steps: Step[] = [
  { to: '/', label: '总览', hint: '当前聚焦：全局状态（中枢概览）' },
  { to: '/projects', label: '项目', hint: '当前聚焦：项目推进（跟踪与承接）' },
  { to: '/rooms', label: '协作群', hint: '当前聚焦：协作群（执行牵引）' },
  { to: '/tasks', label: '任务', hint: '当前聚焦：任务进展（卡住与待办）' },
  { to: '/agents', label: '同事', hint: '当前聚焦：同事状态（指挥与分配）' },
]

export function DemoPathHint() {
  const location = useLocation()

  return (
    <section className="panel strong-card demo-path">
      <div className="panel-header">
        <h3>演示路径</h3>
        <span>自然查看，不需额外说明弹窗</span>
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
        适合给第一次查看的人：打开即从 <strong>总览</strong> 看全局，再顺序点入
        <span className="path-inline">项目 → 协作群 → 任务 → 同事</span>
        {location.pathname === '/agents'
          ? '（最后在同事层复盘执行闭环）'
          : '（可快速打通跨页联动）'}。
      </p>
    </section>
  )
}
