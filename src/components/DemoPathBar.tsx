import { Link, NavLink, useLocation } from 'react-router-dom'

const demoPath = [
  { to: '/', label: '总览', note: '当前聚焦：全局状态（中枢概览）' },
  { to: '/projects', label: '项目', note: '当前聚焦：项目推进（跟踪与承接）' },
  { to: '/rooms', label: '频道', note: '当前聚焦：协作频道（执行牵引）' },
  { to: '/tasks', label: '任务', note: '当前聚焦：任务进展（有卡点与待办）' },
  { to: '/agents', label: '协作者', note: '当前聚焦：协作者状态（指挥与分配）' },
]

export function DemoPathBar({ mode = 'inline' }: { mode?: 'inline' | 'sidebar' }) {
  const location = useLocation()
  const activeIndex = demoPath.findIndex((item) => item.to === location.pathname)

  const currentPathText = location.pathname === '/' ? '总览' : location.pathname.replace('/', '')

  if (mode === 'sidebar') {
    return (
      <section className="demo-sidebar">
        <div className="demo-sidebar-head">
          <p className="eyebrow">使用路径</p>
          <strong>{currentPathText}</strong>
        </div>
        <p className="demo-sidebar-note">先看总览，再顺着项目、频道、任务、协作者一路追进去。</p>
        <div className="demo-sidebar-links">
          {demoPath.map((item, index) => {
            const isActive = index === activeIndex
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive: navActive }) =>
                  `demo-sidebar-link ${navActive || isActive ? 'demo-sidebar-link-active' : ''}`
                }
              >
                <span className="demo-sidebar-step">{index + 1}</span>
                <span className="demo-sidebar-copy">
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                </span>
              </NavLink>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <section className="panel demo-path">
      <div className="demo-path-header">
        <div>
          <p className="eyebrow">查看路径</p>
          <h3>一条 5 步查看线：{currentPathText}</h3>
        </div>
        <p className="page-note">默认按照 总览 → 项目 → 频道 → 任务 → 协作者 展示核心信息链路。</p>
      </div>
      <div className="demo-path-steps">
        {demoPath.map((item, index) => {
          const isActive = index === activeIndex
          const isDone = index < activeIndex
          return (
            <div key={item.to} className="demo-step-wrap">
              <NavLink
                to={item.to}
                className={() => `demo-step ${isActive ? 'demo-step-active' : isDone ? 'demo-step-done' : ''}`}
              >
                <span className="demo-step-index">{index + 1}</span>
                <span className="demo-step-text">
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                </span>
              </NavLink>
              {index < demoPath.length - 1 && <span className="demo-step-divider">→</span>}
            </div>
          )
        })}
      </div>
      <div className="demo-path-footer">
        {activeIndex >= 0 && activeIndex < demoPath.length - 1 ? (
          <Link to={demoPath[activeIndex + 1].to} className="inline-link-chip">
            下一步：{demoPath[activeIndex + 1].label}
          </Link>
        ) : (
          <Link to="/" className="inline-link-chip">
            重新从头查看：总览
          </Link>
        )}
        <span className="soft-tag">未接真实 API，仅用于原型演示</span>
      </div>
    </section>
  )
}
