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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">言</div>
          <div>
            <h1>KOTOVELA</h1>
            <p>OpenClaw 协作驾驶舱</p>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={{ pathname: item.to, search: location.search }}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <FocusSummaryBar
          pathname={location.pathname}
          search={location.search}
          onClear={() => navigate({ search: createFocusSearch(location.search) })}
        />
        <DemoPathBar />
        <Outlet />
      </main>
    </div>
  )
}
