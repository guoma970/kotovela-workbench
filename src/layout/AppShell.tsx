import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FocusSummaryBar } from '../components/FocusSummaryBar'
import { createFocusSearch } from '../lib/workbenchLinking'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { formatLastSyncedAt } from '../lib/formatSyncTime'
import { BRAND_NAME, brandConfig } from '../config/brand'
import { brandAssets } from '../config/brandAssets'

const getNavItems = (isInternal: boolean) =>
  isInternal
    ? [
        { group: '驾驶舱层', to: '/', step: 1, label: 'Dashboard 总览', note: '系统状态 · 同步概览' },
        { group: '驾驶舱层', to: '/projects', step: 2, label: 'Projects 项目', note: '项目组合 · 负责人 · 阻塞' },
        { group: '驾驶舱层', to: '/rooms', step: 3, label: 'Rooms 房间', note: '协作通道 · 关联实例' },
        { group: '驾驶舱层', to: '/tasks', step: 4, label: 'Tasks 任务', note: '执行队列 · 阻塞优先' },
        { group: '驾驶舱层', to: '/leads', step: 5, label: 'Leads 线索', note: '线索列表 · 状态归一' },
        { group: '调度系统', to: '/scheduler', step: 6, label: 'Scheduler 调度', note: '执行控制 · 队列调度' },
        { group: '调度系统', to: '/consultants', step: 7, label: 'Consultants 顾问', note: '顾问配置 · 分配规则' },
        { group: '执行层', to: '/agents', step: 8, label: 'Agents 实例', note: '实例状态 · 路由分派' },
      ]
    : [
        { group: 'Cockpit', to: '/', step: 1, label: 'Dashboard', note: 'Overview and system status' },
        { group: 'Cockpit', to: '/projects', step: 2, label: 'Projects', note: 'Portfolio and ownership' },
        { group: 'Cockpit', to: '/rooms', step: 3, label: 'Rooms', note: 'Channels and coordination' },
        { group: 'Cockpit', to: '/tasks', step: 4, label: 'Tasks', note: 'Execution and blockers' },
        { group: 'Cockpit', to: '/leads', step: 5, label: 'Leads', note: 'Lead list and normalized status' },
        { group: 'Scheduling', to: '/scheduler', step: 6, label: 'Scheduler', note: 'Execution control and queue' },
        { group: 'Scheduling', to: '/consultants', step: 7, label: 'Consultants', note: 'Consultant settings and routing' },
        { group: 'Execution', to: '/agents', step: 8, label: 'Agents', note: 'Agent activity and routing' },
      ]

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    mode,
    preferredDataSource,
    activeDataSource,
    isFallback,
    lastSyncedAtMs,
    pollingIntervalMs,
  } = useOfficeInstances()
  const productName = BRAND_NAME
  const navItems = getNavItems(mode === 'internal')
  /** 中英文结合：主标题英文，其下先中文再英文补充（公开版同样双语，便于国内叙事 + 国际访客扫读）。 */
  const productSubtitleZh =
    mode === 'internal' ? '内部驾驶舱 · 实例状态与项目跟进' : brandConfig.subtitleZh
  /** 内部版不再堆叠英文「Internal / Target」调试行，仅公开版保留中英副线。 */
  const productTaglineEn =
    mode === 'internal' ? null : brandConfig.taglineEn
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
            <img className="brand-logo" src={brandAssets.logo} alt={`${brandAssets.logoAlt} · ${productName} · ${productSubtitleZh}`} />
          </div>
          <div className="brand-copy">
            <h1>{productName}</h1>
            <p className="brand-subtitle-zh">{productSubtitleZh}</p>
            {productTaglineEn ? <p className="brand-subtitle-en">{productTaglineEn}</p> : null}
            {mode === 'internal' ? (
              <p className="brand-sync-meta">
                {preferredDataSource === 'openclaw' ? (
                  <>
                    数据源：{isFallback ? 'OpenClaw（已回退 Mock）' : 'OpenClaw'}
                    <br />
                    上次同步 {formatLastSyncedAt(lastSyncedAtMs)} · 每{' '}
                    {Math.max(1, Math.round(pollingIntervalMs / 1000))} 秒刷新
                  </>
                ) : (
                  <>数据源：Mock · 不请求 OpenClaw</>
                )}
              </p>
            ) : (
              <p className="brand-runtime-line">
                Demo · 目标数据源 {preferredDataSource === 'openclaw' ? 'OpenClaw' : 'Mock'}
                {isFallback ? ' · 已回退 Mock' : activeDataSource === 'openclaw' ? ' · 已连接 OpenClaw' : ' · 当前 Mock'}
              </p>
            )}
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item, index) => (
            <div key={item.to}>
              {index === 0 || navItems[index - 1].group !== item.group ? (
                <div className="nav-group-title">{item.group}</div>
              ) : null}
              <NavLink
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
            </div>
          ))}
        </nav>
      </aside>
      <button
        type="button"
        className={sidebarOpen ? 'sidebar-backdrop sidebar-backdrop-visible' : 'sidebar-backdrop'}
        aria-label="Close sidebar"
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
            aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="mobile-nav-logo-wrap" aria-hidden="true">
            <img className="mobile-nav-logo" src={brandAssets.logo} alt="" />
          </div>
          <div className="mobile-nav-copy">
            <div className="mobile-nav-label">
              <strong>{currentNavItem.label}</strong>
              <span>{currentNavItem.note}</span>
            </div>
            <div className="mobile-nav-meta">
              <span>{productName}</span>
              <span className={hasLinkedFocus ? 'mobile-nav-pill' : 'mobile-nav-pill mobile-nav-pill-muted'}>
                {hasLinkedFocus ? (mode === 'internal' ? '关联焦点' : 'Linked focus') : mode === 'internal' ? '当前页面' : 'Current page'}
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
