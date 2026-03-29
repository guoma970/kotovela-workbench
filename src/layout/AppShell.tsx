import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { DemoPathBar } from '../components/DemoPathBar'
import { FocusSummaryBar } from '../components/FocusSummaryBar'
import { createFocusSearch } from '../lib/workbenchLinking'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/agents', label: 'Agents' },
  { to: '/projects', label: 'Projects' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/rooms', label: 'Rooms' },
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
              {item.label}
            </NavLink>
          ))}
        </nav>
        <DemoPathBar mode="sidebar" />
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
