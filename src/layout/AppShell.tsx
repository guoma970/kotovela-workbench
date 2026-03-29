import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FocusSummaryBar } from '../components/FocusSummaryBar'
import { createFocusSearch } from '../lib/workbenchLinking'

const navItems = [
  { to: '/', step: 1, label: 'Dashboard', note: '总览（中枢状态）' },
  { to: '/projects', step: 2, label: 'Projects', note: '项目地图（跟踪与承接）' },
  { to: '/rooms', step: 3, label: 'Rooms', note: '协作通道（执行牵引）' },
  { to: '/tasks', step: 4, label: 'Tasks', note: '任务流水（阻塞与待办）' },
  { to: '/agents', step: 5, label: 'Agents', note: '实例状态（指挥与分派）' },
]

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const mainRef = useRef<HTMLElement | null>(null)

  const handleNavClick = () => {
    setSidebarOpen(false)
    window.requestAnimationFrame(() => {
      mainRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
      window.scrollTo({ top: 0, behavior: 'auto' })
    })
  }

  useEffect(() => {
    document.body.classList.toggle('mobile-sidebar-open', sidebarOpen)

    return () => {
      document.body.classList.remove('mobile-sidebar-open')
    }
  }, [sidebarOpen])

  return (
    <div className={sidebarOpen ? 'app-shell app-shell-sidebar-open' : 'app-shell'}>
      <aside className={sidebarOpen ? 'sidebar sidebar-open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark brand-logo-wrap">
            <img className="brand-logo" src="/yanting-logo-tight.png" alt="言町科技" />
          </div>
          <div className="brand-copy">
            <h1>言町科技 KOTOVELA</h1>
            <p>OpenClaw协作驾驶舱</p>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={{ pathname: item.to, search: location.search }}
              end={item.to === '/'}
              onClick={handleNavClick}
              className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            >
              <span className="nav-link-step">{item.step}</span>
              <span className="nav-link-copy">
                <strong>{item.label}</strong>
                <small>{item.note}</small>
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <button
        type="button"
        className={sidebarOpen ? 'sidebar-backdrop sidebar-backdrop-visible' : 'sidebar-backdrop'}
        aria-label="关闭侧边菜单"
        onClick={() => setSidebarOpen(false)}
      />

      <main ref={mainRef} className="main-content">
        <div className="mobile-nav-bar">
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-label={sidebarOpen ? '关闭导航菜单' : '打开导航菜单'}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="mobile-nav-label">
            <strong>言町科技 KOTOVELA</strong>
            <span>OpenClaw协作驾驶舱</span>
          </div>
        </div>
        <FocusSummaryBar
          pathname={location.pathname}
          search={location.search}
          onClear={() => navigate({ search: createFocusSearch(location.search) })}
        />
        <Outlet />
      </main>
    </div>
  )
}
