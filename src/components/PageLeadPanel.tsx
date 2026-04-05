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
}

const MOBILE_PAGE_LEAD_MEDIA = '(max-width: 960px)'

const getIsCompactViewport = () =>
  typeof window !== 'undefined' ? window.matchMedia(MOBILE_PAGE_LEAD_MEDIA).matches : false

export function PageLeadPanel({ heading, intro, metrics, actions = [] }: PageLeadPanelProps) {
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
        <h3>Page snapshot · {heading}</h3>
        <div className="page-lead-toolbar">
          <span>{collapsed ? 'Compact view' : 'Current view'}</span>
          {isCompactViewport && (
            <button
              type="button"
              className="ghost-button page-lead-toggle"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
      </div>
      <p className={`page-note ${collapsed ? 'page-lead-intro-compact' : ''}`}>{intro}</p>
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
          {hiddenMetricCount} more metrics and {hiddenActionCount} more next steps
        </button>
      )}
    </section>
  )
}
