import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FocusSummaryBar } from '../components/FocusSummaryBar'
import { createFocusSearch } from '../lib/workbenchLinking'
import { useOfficeInstances } from '../data/useOfficeInstances'

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
  const { mode, preferredDataSource, activeDataSource, isFallback } = useOfficeInstances()
  const currentNavItem =
    navItems.find((item) => (item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to))) ?? navItems[0]
  const focusSearchParams = new URLSearchParams(location.search)
  const hasLinkedFocus = Boolean(
    focusSearchParams.get('focusType') ||
    focusSearchParams.get('focusId') ||
    focusSearchParams.get('project') ||
    focusSearchParams.get('agent') ||
    focusSearchParams.get('room') ||
    focusSearchParams.get('task'),
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const mainRef = useRef<HTMLElement | null>(null)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)

  // State for swipe-to-close gesture
  const [touchStart, setTouchStart] = useState(0)
  const [touchDelta, setTouchDelta] = useState(0)

  const handleNavClick = () => {
    setSidebarOpen(false)
    menuButtonRef.current?.focus()
    window.requestAnimationFrame(() => {
      mainRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
      window.scrollTo({ top: 0, behavior: 'auto' })
    })
  }

  // Focus Management & Body Class
  const sidebarFocusablesRef = useRef<HTMLElement[]>([])

  useEffect(() => {
    document.body.classList.toggle('mobile-sidebar-open', sidebarOpen)

    if (sidebarOpen) {
      const focusableElements = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
      )
      sidebarFocusablesRef.current = focusableElements ? Array.from(focusableElements) : []

      if (focusableElements && focusableElements.length > 0) {
        focusableElements[0].focus()
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          const focusables = sidebarFocusablesRef.current
          const first = focusables[0]
          const last = focusables[focusables.length - 1]

          if (!sidebarRef.current?.contains(document.activeElement)) {
            first?.focus()
            e.preventDefault()
            return
          }

          if (e.shiftKey && document.activeElement === first) {
            last?.focus()
            e.preventDefault()
          } else if (!e.shiftKey && document.activeElement === last) {
            first?.focus()
            e.preventDefault()
          }
        }

        if (e.key === 'Escape') {
          setSidebarOpen(false)
          menuButtonRef.current?.focus()
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.classList.remove('mobile-sidebar-open')
      }
    } else {
      // This part handles returning focus when sidebar is closed via methods other than nav click
      if (document.activeElement && sidebarRef.current?.contains(document.activeElement)) {
        menuButtonRef.current?.focus()
      }
    }
  }, [sidebarOpen])

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (sidebarRef.current) {
      sidebarRef.current.style.transition = 'none'
    }
    setTouchStart(e.targetTouches[0].clientX)
    setTouchDelta(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.targetTouches[0].clientX - touchStart
    if (delta < 0) {
      setTouchDelta(delta)
    }
  }

  const handleTouchEnd = () => {
    if (sidebarRef.current) {
      sidebarRef.current.style.transition = '' // Restore transitions
    }
    if (sidebarRef.current && Math.abs(touchDelta) > sidebarRef.current.offsetWidth / 3) {
      setSidebarOpen(false)
      menuButtonRef.current?.focus()
    }
    setTouchDelta(0)
  }

  const sidebarStyle: CSSProperties = touchDelta !== 0
    ? {
        transform: `translateX(${Math.min(0, touchDelta)}px)`,
        boxShadow: `0 24px 60px rgba(0, 0, 0, ${0.38 - Math.abs(touchDelta) * 0.001})`,
      }
    : {}


  return (
    <div className={sidebarOpen ? 'app-shell app-shell-sidebar-open' : 'app-shell'}>
      <aside
        ref={sidebarRef}
        className={sidebarOpen ? 'sidebar sidebar-open' : 'sidebar'}
        style={sidebarStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        aria-modal="true"
        role="dialog"
      >
        <div className="brand">
          <div className="brand-mark brand-logo-wrap">
            <img className="brand-logo" src="/yanting-logo-tight.png" alt="言町科技" />
          </div>
          <div className="brand-copy">
            <h1>言町科技 KOTOVELA</h1>
            <p>OpenClaw协作驾驶舱</p>
            <p style={{ marginTop: '6px', fontSize: '12px', opacity: 0.8 }}>
              {mode === 'internal' ? 'Internal' : 'Demo'} · 目标 {preferredDataSource === 'openclaw' ? 'OpenClaw' : 'Mock'}
              {isFallback ? ' · Fallback 到 Mock' : activeDataSource === 'openclaw' ? ' · OpenClaw 已接入' : ' · Mock 运行中'}
            </p>
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
        onClick={() => {
          setSidebarOpen(false)
          menuButtonRef.current?.focus()
        }}
        tabIndex={-1}
      />

      <main ref={mainRef} className="main-content">
        <div className="mobile-nav-bar">
          <button
            ref={menuButtonRef}
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
          <div className="mobile-nav-copy">
            <div className="mobile-nav-label">
              <strong>{currentNavItem.label}</strong>
              <span>{currentNavItem.note}</span>
            </div>
            <div className="mobile-nav-meta">
              <span>言町科技 KOTOVELA</span>
              <span className={hasLinkedFocus ? 'mobile-nav-pill' : 'mobile-nav-pill mobile-nav-pill-muted'}>
                {hasLinkedFocus ? '联动中' : '当前页'}
              </span>
            </div>
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
