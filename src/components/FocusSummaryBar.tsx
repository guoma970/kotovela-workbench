import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { agents, projects, rooms, tasks, updates } from '../data/mockData'
import {
  buildRelationScope,
  createFocusSearch,
  getFocusSummary,
  parseFocusFromSearchParams,
} from '../lib/workbenchLinking'

const pageData = { projects, agents, rooms, tasks }

const pageLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/agents', label: 'Agents' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/rooms', label: 'Rooms' },
]

export function FocusSummaryBar({ search, pathname, onClear }: { search: string; pathname: string; onClear?: () => void }) {
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(search)
  const focus = parseFocusFromSearchParams(searchParams)
  const summary = getFocusSummary(focus, pageData)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const baseSearch = createFocusSearch(searchParams)
  const summaryKey = summary ? `${summary.label}:${summary.value}` : null
  const expanded = summaryKey !== null && expandedKey === summaryKey

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

  const relationScope = buildRelationScope(focus, pageData)
  const blockerCount = tasks.filter((task) => relationScope.taskIds.has(task.id) && task.status === 'blocked').length
  const criticalUpdateCount = updates.filter(
    (item) =>
      (item.projectId && relationScope.projectIds.has(item.projectId)) ||
      (item.agentId && relationScope.agentIds.has(item.agentId)) ||
      (item.roomId && relationScope.roomIds.has(item.roomId)) ||
      (item.taskId && relationScope.taskIds.has(item.taskId)),
  ).length

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
      className={`panel focus-banner focus-summary-bar strong-card focus-summary-dock ${expanded ? 'focus-summary-dock-expanded' : ''}`}
    >
      <header className="focus-summary-header focus-summary-header-compact">
        <div className="focus-summary-title-block">
          <p className="eyebrow">联动导航条</p>
          <h3>
            {summary.label}：{summary.value}
          </h3>
          <p className="page-note">保留上下文，优先用于持续导航，不打断当前页面。</p>
        </div>
        <div className="focus-summary-toolbar">
          <div className="focus-summary-chip-row">
            <NavLink className="focus-metric focus-metric-link focus-metric-mini" to={{ pathname: '/tasks', search: baseSearch }}>
              <span>任务</span>
              <strong>{relationScope.taskIds.size}</strong>
            </NavLink>
            <NavLink className="focus-metric focus-metric-link focus-metric-mini" to={{ pathname: '/rooms', search: baseSearch }}>
              <span>房间</span>
              <strong>{relationScope.roomIds.size}</strong>
            </NavLink>
            <NavLink className="focus-metric focus-metric-link focus-metric-mini" to={{ pathname: '/agents', search: baseSearch }}>
              <span>实例</span>
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
            <button
              type="button"
              className="ghost-button focus-header-button"
              onClick={() => setExpandedKey((value) => (value === summaryKey ? null : summaryKey))}
            >
              {expanded ? '收起详情' : '展开详情'}
            </button>
            <button type="button" className="ghost-button focus-header-button" onClick={onClear}>
              关闭导航
            </button>
          </div>
        </div>
      </header>

      {expanded && (
        <div className="focus-summary-main-area">
          <section className="focus-summary-group" aria-label="联动分组信息区">
            <p className="section-label">分组信息区</p>
            <div className="focus-group-grid">
              <div className="focus-group-block">
                <span>项目</span>
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
                <span>实例</span>
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
                <span>房间</span>
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
                <span>任务</span>
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
                <span>关键更新</span>
                <div className="focus-group-links">
                  <NavLink className="focus-group-link" to={{ pathname: '/', search: baseSearch }}>
                    当前共 {criticalUpdateCount} 条
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
                    查看相关项 · {item.label}
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
