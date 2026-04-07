import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

interface PageLeadPanelMetric {
  label: string
  value: string | number
  to?: { pathname: string; search?: string }
}

interface PageLeadPanelAction {
  label: string
  to: { pathname: string; search?: string }
}

interface PageLeadPanelProps {
  heading: string
  intro: string
  metrics: PageLeadPanelMetric[]
  actions?: PageLeadPanelAction[]
  /** Internal mode: short semantics line (e.g. project vs room vs task). */
  internalHint?: string
  /** Internal mode copy preference. */
  internalMode?: boolean
}

const MOBILE_PAGE_LEAD_MEDIA = '(max-width: 960px)'

const getIsCompactViewport = () =>
  typeof window !== 'undefined' ? window.matchMedia(MOBILE_PAGE_LEAD_MEDIA).matches : false

export function PageLeadPanel({ heading, intro, metrics, actions = [], internalHint, internalMode = false }: PageLeadPanelProps) {
  const [isCompactViewport, setIsCompactViewport] = useState(getIsCompactViewport)
  const [expanded, setExpanded] = useState(() => !getIsCompactViewport())

  useEffect(() => {
    const media = window.matchMedia(MOBILE_PAGE_LEAD_MEDIA)
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactViewport(event.matches)
      if (!event.matches) {
        setExpanded(true)
      }
    }

    media.addEventListener('change', handleChange)
    return () => {
      media.removeEventListener('change', handleChange)
    }
  }, [])

  const collapsed = isCompactViewport && !expanded
  const visibleMetrics = collapsed ? metrics.slice(0, 3) : metrics
  const visibleActions = collapsed ? actions.slice(0, 1) : actions
  const hiddenMetricCount = metrics.length - visibleMetrics.length
  const hiddenActionCount = actions.length - visibleActions.length

  return (
    <section className={`panel strong-card page-lead-panel ${collapsed ? 'page-lead-panel-collapsed' : ''}`}>
      <div className="panel-header">
        <h3>{internalMode ? `页面快照 · ${heading}` : `Page snapshot · ${heading}`}</h3>
        <div className="page-lead-toolbar">
          <span>{internalMode ? (collapsed ? '紧凑视图' : '当前视图') : collapsed ? 'Compact view' : 'Current view'}</span>
          {isCompactViewport && (
            <button
              type="button"
              className="ghost-button page-lead-toggle"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {internalMode ? (expanded ? '收起' : '展开') : expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
      </div>
      <p className={`page-note ${collapsed ? 'page-lead-intro-compact' : ''}`}>{intro}</p>
      {internalHint ? (
        <p className={`page-note page-note-hint ${collapsed ? 'page-lead-intro-compact' : ''}`}>{internalHint}</p>
      ) : null}
      <div className="info-pairs">
        {visibleMetrics.map((item) => (
          item.to ? (
            <NavLink key={item.label} className="context-strip context-strip-link" to={item.to}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </NavLink>
          ) : (
            <div key={item.label} className="context-strip">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          )
        ))}
      </div>
      {visibleActions.length > 0 && (
        <div className="cross-link-row top-gap">
          {visibleActions.map((action) => (
            <NavLink
              key={action.label}
              className="inline-link-chip"
              to={action.to}
            >
              {action.label}
            </NavLink>
          ))}
        </div>
      )}
      {collapsed && (hiddenMetricCount > 0 || hiddenActionCount > 0) && (
        <button type="button" className="page-lead-peek" onClick={() => setExpanded(true)}>
          {internalMode
            ? `还有 ${hiddenMetricCount} 个指标、${hiddenActionCount} 个后续动作`
            : `${hiddenMetricCount} more metrics and ${hiddenActionCount} more next steps`}
        </button>
      )}
    </section>
  )
}
