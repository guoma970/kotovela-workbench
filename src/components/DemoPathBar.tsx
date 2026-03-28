import { Link, NavLink, useLocation } from 'react-router-dom'

const demoPath = [
  { to: '/', label: 'Dashboard', note: '中枢总览与 blocker 检查' },
  { to: '/projects', label: 'Projects', note: '确认主项目与承接对象' },
  { to: '/rooms', label: 'Rooms', note: '核对房间/群与参与实例' },
  { to: '/tasks', label: 'Tasks', note: '看任务流与优先级' },
  { to: '/agents', label: 'Agents', note: '追踪实例执行状态' },
]

export function DemoPathBar() {
  const location = useLocation()
  const activeIndex = demoPath.findIndex((item) => item.to === location.pathname)

  const currentPathText = location.pathname === '/' ? 'Dashboard' : location.pathname.replace('/', '')

  return (
    <section className="panel demo-path">
      <div className="demo-path-header">
        <div>
          <p className="eyebrow">演示路径</p>
          <h3>一条 5 步演示线：{currentPathText}</h3>
        </div>
        <p className="page-note">默认按照 Dashboard → Projects → Rooms → Tasks → Agents 展示核心信息链路。</p>
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
            重新从头演示：Dashboard
          </Link>
        )}
        <span className="soft-tag">未接真实 API，仅用于原型演示</span>
      </div>
    </section>
  )
}
