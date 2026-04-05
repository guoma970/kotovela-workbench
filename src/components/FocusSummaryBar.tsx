import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useOfficeInstances } from '../data/useOfficeInstances'
import {
  buildRelationScope,
  createFocusSearch,
  getFocusTarget,
  getFocusSummary,
  parseFocusFromSearchParams,
} from '../lib/workbenchLinking'

const pageLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/agents', label: 'Agents' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/rooms', label: 'Rooms' },
]

export function FocusSummaryBar({ search, pathname, onClear }: { search: string; pathname: string; onClear?: () => void }) {
  const { agents, projects, rooms, tasks, updates } = useOfficeInstances()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(search)
  const pageData = { projects, agents, rooms, tasks }
  const focus = parseFocusFromSearchParams(searchParams)
  const focusTarget = getFocusTarget(focus)
  const summary = getFocusSummary(focus, pageData)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const baseSearch = createFocusSearch(searchParams)
  const summaryKey = summary ? `${summary.label}:${summary.value}` : null
  const expanded = summaryKey !== null && expandedKey === summaryKey
  const [isScrolled, setIsScrolled] = useState(false)

  const withExtraSearch = (extra: Record<string, string>) => {
    const params = new URLSearchParams(baseSearch.startsWith('?') ? baseSearch.slice(1) : baseSearch)
    Object.entries(extra).forEach(([key, value]) => {
      params.set(key, value)
    })
    const next = params.toString()
    return next ? `?${next}` : ''
  }

  useEffect(() => {
    if (!summary || !onClear) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClear()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [summary, onClear])

  useEffect(() => {
    const updateScrolled = () => {
      setIsScrolled(window.scrollY > 8)
    }

    updateScrolled()
    window.addEventListener('scroll', updateScrolled, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateScrolled)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)')
    const shouldLock = expanded && media.matches
    document.body.classList.toggle('focus-nav-expanded-mobile', shouldLock)

    return () => {
      document.body.classList.remove('focus-nav-expanded-mobile')
    }
  }, [expanded])

  const relationScope = buildRelationScope(focus, pageData)
  const blockerCount = tasks.filter((task) => relationScope.taskIds.has(task.id) && task.status === 'blocked').length
  const criticalUpdateCount = updates.filter(
    (item) =>
      (item.projectId && relationScope.projectIds.has(item.projectId)) ||
      (item.agentId && relationScope.agentIds.has(item.agentId)) ||
      (item.roomId && relationScope.roomIds.has(item.roomId)) ||
      (item.taskId && relationScope.taskIds.has(item.taskId)),
  ).length
  const relatedSnapshot = [
    `Projects ${relationScope.projectIds.size}`,
    `Agents ${relationScope.agentIds.size}`,
    `Rooms ${relationScope.roomIds.size}`,
    `Tasks ${relationScope.taskIds.size}`,
  ].join(' · ')
  const primaryFocusPath =
    focusTarget?.type === 'project'
      ? '/projects'
      : focusTarget?.type === 'agent'
        ? '/agents'
        : focusTarget?.type === 'room'
          ? '/rooms'
          : focusTarget?.type === 'task'
            ? '/tasks'
            : pathname

  const listSearch = (kind: 'project' | 'agent' | 'room' | 'task', id: string) =>
    createFocusSearch(searchParams, kind, id)

  const selectInOverlay = (kind: 'project' | 'agent' | 'room' | 'task', id: string) => {
    navigate(
      { pathname, search: listSearch(kind, id) },
      { replace: true, preventScrollReset: true },
    )
  }

  if (!summary) return null

  return (
    <section
      className={`panel focus-banner focus-summary-bar strong-card focus-summary-dock ${expanded ? 'focus-summary-dock-expanded' : ''} ${isScrolled ? 'focus-summary-dock-scrolled' : ''}`}
    >
      <button type="button" className="focus-close-action" aria-label="Clear linked focus" onClick={onClear}>
        Clear
      </button>
      <header className="focus-summary-header focus-summary-header-compact">
        <div className="focus-summary-title-block">
          <p className="eyebrow">Linked navigation</p>
          <h3>
            {summary.label}：{summary.value}
          </h3>
          <p className="focus-summary-inline-meta">
            {relatedSnapshot} · blocker {blockerCount}
          </p>
        </div>
        <div className="focus-summary-toolbar">
          <div className="focus-summary-chip-row">
            <NavLink className="focus-metric focus-metric-link focus-metric-mini" to={{ pathname: '/tasks', search: baseSearch }}>
              <span>Tasks</span>
              <strong>{relationScope.taskIds.size}</strong>
            </NavLink>
            <NavLink className="focus-metric focus-metric-link focus-metric-mini focus-metric-secondary" to={{ pathname: '/rooms', search: baseSearch }}>
              <span>Rooms</span>
              <strong>{relationScope.roomIds.size}</strong>
            </NavLink>
            <NavLink className="focus-metric focus-metric-link focus-metric-mini focus-metric-secondary" to={{ pathname: '/agents', search: baseSearch }}>
              <span>Agents</span>
              <strong>{relationScope.agentIds.size}</strong>
            </NavLink>
            <NavLink
              className="focus-metric focus-metric-link focus-metric-mini"
              to={{ pathname: '/tasks', search: withExtraSearch({ status: 'blocked' }) }}
            >
              <span>blocker</span>
              <strong>{blockerCount}</strong>
            </NavLink>
          </div>
          <div className="focus-summary-header-actions">
            <NavLink className="ghost-button focus-header-button focus-header-link" to={{ pathname: primaryFocusPath, search: baseSearch }}>
              Open object page
            </NavLink>
            <button
              type="button"
              className="ghost-button focus-header-button focus-expand-button"
              onClick={() => setExpandedKey((value) => (value === summaryKey ? null : summaryKey))}
              aria-expanded={expanded}
            >
              {expanded ? 'Details ˄' : 'Details ˅'}
            </button>
          </div>
        </div>
      </header>

      {expanded && (
        <div className="focus-summary-main-area">
          <section className="focus-summary-group" aria-label="Linked group details">
            <p className="section-label">Grouped details</p>
            <div className="focus-group-grid">
              <div className="focus-group-block">
                <span>Projects</span>
                <div className="focus-group-links">
                  {relationScope.projectIds.size ? (
                    [...relationScope.projectIds].map((id) => {
                      const item = projects.find((project) => project.id === id)
                      if (!item) return null
                      return (
                        <button
                          key={id}
                          type="button"
                          className="focus-group-link"
                          onClick={() => selectInOverlay('project', id)}
                        >
                          {item.name}
                        </button>
                      )
                    })
                  ) : (
                    <p>—</p>
                  )}
                </div>
              </div>
              <div className="focus-group-block">
                <span>Agents</span>
                <div className="focus-group-links">
                  {relationScope.agentIds.size ? (
                    [...relationScope.agentIds].map((id) => {
                      const item = agents.find((agent) => agent.id === id)
                      if (!item) return null
                      return (
                        <button
                          key={id}
                          type="button"
                          className="focus-group-link"
                          onClick={() => selectInOverlay('agent', id)}
                        >
                          {item.name}
                        </button>
                      )
                    })
                  ) : (
                    <p>—</p>
                  )}
                </div>
              </div>
              <div className="focus-group-block">
                <span>Rooms</span>
                <div className="focus-group-links">
                  {relationScope.roomIds.size ? (
                    [...relationScope.roomIds].map((id) => {
                      const item = rooms.find((room) => room.id === id)
                      if (!item) return null
                      return (
                        <button
                          key={id}
                          type="button"
                          className="focus-group-link"
                          onClick={() => selectInOverlay('room', id)}
                        >
                          {item.name}
                        </button>
                      )
                    })
                  ) : (
                    <p>—</p>
                  )}
                </div>
              </div>
              <div className="focus-group-block">
                <span>Tasks</span>
                <div className="focus-group-links">
                  {relationScope.taskIds.size ? (
                    [...relationScope.taskIds].map((id) => {
                      const item = tasks.find((task) => task.id === id)
                      if (!item) return null
                      return (
                        <button
                          key={id}
                          type="button"
                          className="focus-group-link"
                          onClick={() => selectInOverlay('task', id)}
                        >
                          {item.title}
                        </button>
                      )
                    })
                  ) : (
                    <p>—</p>
                  )}
                </div>
              </div>
              <div className="focus-group-block">
                <span>Key updates</span>
                <div className="focus-group-links">
                  <NavLink className="focus-group-link" to={{ pathname: '/', search: baseSearch }}>
                    {criticalUpdateCount} total
                  </NavLink>
                </div>
              </div>
            </div>
          </section>

          <div className="focus-summary-actions">
            <div className="focus-nav-links">
              {pageLinks.map((item) => {
                const isCurrent = pathname === item.to
                return (
                  <NavLink
                    key={item.to}
                    to={{ pathname: item.to, search: baseSearch }}
                    end={item.to === '/'}
                    className={isCurrent ? 'focus-page-link focus-page-link-active' : 'focus-page-link'}
                  >
                    Related items · {item.label}
                  </NavLink>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
