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

export function PageLeadPanel({ heading, intro, metrics, actions = [] }: PageLeadPanelProps) {
  return (
    <section className="panel strong-card page-lead-panel">
      <div className="panel-header">
        <h3>页面速览 · {heading}</h3>
        <span>当前视角</span>
      </div>
      <p className="page-note">{intro}</p>
      <div className="info-pairs">
        {metrics.map((item) => (
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
      {actions.length > 0 && (
        <div className="cross-link-row top-gap">
          {actions.map((action) => (
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
    </section>
  )
}
