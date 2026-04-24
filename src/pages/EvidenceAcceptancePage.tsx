import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EvidenceObjectLinks } from '../components/EvidenceObjectLinks'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { buildEvidenceParserFixtureDataset, buildEvidenceRow, summarizeFixtureDataset, type EvidenceDriftSummary, type EvidenceRow } from '../lib/evidenceAcceptance'
import { useWorkbenchLinking } from '../lib/workbenchLinking'

type BoardEntry = {
  task_name?: string
  status?: string
  project_line?: string
  source_line?: string
  account_line?: string
  content_line?: string
  consultant_id?: string
  assigned_agent?: string
  agent?: string
  route_target?: string
  route_result?: string
  decision_log?: Array<{ action?: string; reason?: string; detail?: string; timestamp?: string }>
}

type LeadEntry = {
  lead_id?: string
  title?: string
  status?: string
  source_line?: string
  account_line?: string
  content_line?: string
  consultant_id?: string
  decision_log?: Array<{ action?: string; reason?: string; detail?: string; timestamp?: string }>
}

type AuditEntry = {
  id?: string
  action?: string
  target?: string
  result?: string
  user?: string
  time?: string
}

const normalize = (value?: string) => String(value ?? '').trim()

export function EvidenceAcceptancePage() {
  const { projects, agents, rooms, tasks, mode } = useOfficeInstances()
  const isInternal = mode === 'internal'
  const linking = useWorkbenchLinking({ projects, agents, rooms, tasks })
  const [board, setBoard] = useState<BoardEntry[]>([])
  const [leads, setLeads] = useState<LeadEntry[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [driftSummary, setDriftSummary] = useState<EvidenceDriftSummary | null>(null)

  useEffect(() => {
    if (!isInternal) {
      setBoard([])
      setLeads([])
      setAuditEntries([])
      return
    }

    let cancelled = false
    Promise.all([
      fetch('/api/tasks-board', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : { board: [] })),
      fetch('/api/leads', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : { leads: [] })),
      fetch('/api/audit-log', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : { entries: [] })),
    ])
      .then(([boardPayload, leadsPayload, auditPayload]) => {
        if (cancelled) return
        setBoard(Array.isArray(boardPayload?.board) ? boardPayload.board : [])
        setLeads(Array.isArray(leadsPayload?.leads) ? leadsPayload.leads : [])
        setAuditEntries(Array.isArray(auditPayload?.entries) ? auditPayload.entries : [])
      })
      .catch(() => {
        if (cancelled) return
        setBoard([])
        setLeads([])
        setAuditEntries([])
      })

    return () => {
      cancelled = true
    }
  }, [isInternal])

  useEffect(() => {
    if (!isInternal) {
      setDriftSummary(null)
      return
    }

    let cancelled = false
    fetch('/evidence/dev75/drift-trend.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled) return
        setDriftSummary(payload)
      })
      .catch(() => {
        if (cancelled) return
        setDriftSummary(null)
      })

    return () => {
      cancelled = true
    }
  }, [isInternal])

  const rows = useMemo<EvidenceRow[]>(() => {
    if (!isInternal) return []

    const result: EvidenceRow[] = []
    const pushRow = (row: { id: string; source: 'tasks-board' | 'leads' | 'audit-log'; title: string; detail: string; timestamp: string; textParts: string[]; signalParts: string[] }) => {
      result.push(buildEvidenceRow(row, { projects, agents, rooms, tasks }))
    }

    board.slice(0, 24).forEach((entry, entryIndex) => {
      ;(entry.decision_log ?? []).slice(-2).forEach((log, logIndex) => {
        pushRow({
          id: `task-${entryIndex}-${logIndex}`,
          source: 'tasks-board',
          title: entry.task_name ?? `task-${entryIndex + 1}`,
          detail: `${log.action ?? '-'} · ${log.reason ?? '-'} · ${log.detail ?? '-'}`,
          timestamp: log.timestamp ?? '-',
          textParts: [entry.task_name, log.action, log.reason, log.detail].map((item) => normalize(item)),
          signalParts: [entry.project_line, entry.source_line, entry.account_line, entry.content_line, entry.consultant_id, entry.assigned_agent, entry.agent, entry.route_target, entry.route_result].map((item) => normalize(item)),
        })
      })
    })

    leads.slice(0, 24).forEach((entry, entryIndex) => {
      ;(entry.decision_log ?? []).slice(-2).forEach((log, logIndex) => {
        pushRow({
          id: `lead-${entryIndex}-${logIndex}`,
          source: 'leads',
          title: entry.title ?? entry.lead_id ?? `lead-${entryIndex + 1}`,
          detail: `${log.action ?? '-'} · ${log.reason ?? '-'} · ${log.detail ?? '-'}`,
          timestamp: log.timestamp ?? '-',
          textParts: [entry.title, entry.lead_id, log.action, log.reason, log.detail].map((item) => normalize(item)),
          signalParts: [entry.source_line, entry.account_line, entry.content_line, entry.consultant_id, entry.status].map((item) => normalize(item)),
        })
      })
    })

    auditEntries.slice(0, 24).forEach((entry, entryIndex) => {
      pushRow({
        id: `audit-${entryIndex}`,
        source: 'audit-log',
        title: entry.action ?? `audit-${entryIndex + 1}`,
        detail: `${entry.target ?? '-'} · ${entry.result ?? '-'}`,
        timestamp: entry.time ?? '-',
        textParts: [entry.action, entry.target, entry.result].map((item) => normalize(item)),
        signalParts: [entry.user, entry.target, entry.result].map((item) => normalize(item)),
      })
    })

    return result
  }, [isInternal, board, leads, auditEntries, projects, agents, rooms, tasks])

  const fixtureDataset = useMemo(
    () => buildEvidenceParserFixtureDataset({ projects, agents, rooms, tasks }),
    [projects, agents, rooms, tasks],
  )

  const fixtureSummary = useMemo(() => summarizeFixtureDataset(fixtureDataset), [fixtureDataset])

  const summary = useMemo(() => {
    const bySource = {
      'tasks-board': rows.filter((row) => row.source === 'tasks-board'),
      leads: rows.filter((row) => row.source === 'leads'),
      'audit-log': rows.filter((row) => row.source === 'audit-log'),
    }
    const unresolved = rows.filter((row) => !row.success)
    const successCount = rows.filter((row) => row.success).length
    const successRate = rows.length ? Math.round((successCount / rows.length) * 100) : 0
    const missReasonCounts = unresolved.reduce<Record<string, number>>((acc, row) => {
      acc[row.reason] = (acc[row.reason] ?? 0) + 1
      return acc
    }, {})
    const heuristicDriftCounts = unresolved.reduce<Record<string, number>>((acc, row) => {
      if (row.matchSource.startsWith('signal_map_')) acc[row.matchSource] = (acc[row.matchSource] ?? 0) + 1
      return acc
    }, {})

    return { bySource, unresolved, successCount, successRate, missReasonCounts, heuristicDriftCounts }
  }, [rows])

  return (
    <section className="page evidence-acceptance-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">DEV-75 Evidence Acceptance</p>
          <h2>{isInternal ? 'evidence 命中率验收页' : 'Evidence acceptance'}</h2>
        </div>
        <p className="page-note">
          {isInternal
            ? '把 parser 命中结果、未命中原因、回链成功率放到同一页，直接暴露“哪些日志还回不去对象”。'
            : 'Open source mode keeps this page isolated. No internal evidence payload is rendered.'}
        </p>
      </div>

      <section className="panel strong-card evidence-hero-card">
        <div className="evidence-hero-metrics">
          <article className="evidence-metric-card">
            <span>evidence rows</span>
            <strong>{rows.length}</strong>
          </article>
          <article className="evidence-metric-card is-hit">
            <span>parser hits</span>
            <strong>{summary.successCount}</strong>
          </article>
          <article className="evidence-metric-card is-miss">
            <span>unresolved</span>
            <strong>{summary.unresolved.length}</strong>
          </article>
          <article className="evidence-metric-card">
            <span>link-back success</span>
            <strong>{summary.successRate}%</strong>
          </article>
        </div>
        <div className="cross-link-row top-gap">
          <Link className="inline-link-chip" to="/tasks">Tasks evidence</Link>
          <Link className="inline-link-chip" to="/leads">Leads evidence</Link>
          <Link className="inline-link-chip" to="/system-control">System control</Link>
        </div>
      </section>

      {isInternal ? (
        <>
          <div className="evidence-acceptance-grid">
            {Object.entries(summary.bySource).map(([source, list]) => {
              const hitCount = list.filter((row) => row.success).length
              const rate = list.length ? Math.round((hitCount / list.length) * 100) : 0
              return (
                <section key={source} className="panel strong-card evidence-source-card">
                  <div className="panel-header">
                    <h3>{source}</h3>
                    <span className="badge-count">{list.length}</span>
                  </div>
                  <div className="evidence-source-stats">
                    <span className="inline-link-chip">hits {hitCount}</span>
                    <span className="inline-link-chip">misses {list.length - hitCount}</span>
                    <span className="inline-link-chip">success {rate}%</span>
                  </div>
                </section>
              )
            })}
          </div>

          <section className="panel strong-card">
            <div className="panel-header">
              <h3>未命中原因</h3>
              <span className="badge-count">{Object.keys(summary.missReasonCounts).length}</span>
            </div>
            <div className="evidence-source-stats">
              {Object.entries(summary.missReasonCounts).map(([reason, count]) => (
                <span key={reason} className="inline-link-chip">{reason} · {count}</span>
              ))}
              {Object.keys(summary.missReasonCounts).length === 0 ? <span className="inline-link-chip">all resolved</span> : null}
            </div>
            <div className="evidence-source-stats top-gap">
              {Object.entries(summary.heuristicDriftCounts).map(([source, count]) => (
                <span key={source} className="inline-link-chip">heuristic {source} · {count}</span>
              ))}
              {Object.keys(summary.heuristicDriftCounts).length === 0 ? <span className="inline-link-chip">heuristic clean</span> : null}
            </div>
          </section>

          <section className="panel strong-card">
            <div className="panel-header">
              <h3>heuristic drift alert</h3>
              <span className="badge-count">{driftSummary?.alerts.length ?? 0}</span>
            </div>
            <div className="evidence-source-stats">
              {driftSummary?.samples.map((sample) => (
                <span key={sample.sampleId} className="inline-link-chip">{sample.label} · unresolved {sample.unresolved} · heuristic {sample.heuristicHits}</span>
              ))}
              {!driftSummary?.samples.length ? <span className="inline-link-chip">trend snapshot unavailable</span> : null}
            </div>
            <div className="evidence-source-stats top-gap">
              {driftSummary?.alerts.map((alert) => (
                <span key={alert.source} className="inline-link-chip">{alert.level} · {alert.source} · latest {alert.latestCount} · Δ {alert.delta >= 0 ? `+${alert.delta}` : alert.delta} {alert.driftStartedAt ? `· first ${alert.driftStartedAt}` : ''}</span>
              ))}
              {driftSummary && !driftSummary.alerts.length ? <span className="inline-link-chip">no threshold breach</span> : null}
            </div>
            <div className="consultant-evidence-list top-gap">
              {driftSummary?.buckets.map((bucket) => (
                <article key={bucket.source} className="consultant-evidence-card">
                  <div className="audit-log-item-top">
                    <strong>{bucket.source}</strong>
                    <span className={bucket.alertLevel === 'critical' || bucket.alertLevel === 'warning' ? 'evidence-state-miss' : 'evidence-state-hit'}>
                      {bucket.alertLevel} · latest {bucket.latestCount}
                    </span>
                  </div>
                  <p>
                    previous {bucket.previousCount} → latest {bucket.latestCount}，Δ {bucket.delta >= 0 ? `+${bucket.delta}` : bucket.delta}，ratio {(bucket.latestRatio * 100).toFixed(0)}%
                  </p>
                  <small>{bucket.driftStartedAt ? `first drift ${bucket.driftStartedAt}` : 'no early drift trigger'}</small>
                  <div className="cross-link-row top-gap">
                    {driftSummary.samples.map((sample, index) => (
                      <span key={`${bucket.source}-${sample.sampleId}`} className="inline-link-chip">{sample.label} · {bucket.counts[index] ?? 0}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel strong-card">
            <div className="panel-header">
              <h3>parser fixture dataset</h3>
              <span className="badge-count">{fixtureDataset.length}</span>
            </div>
            <div className="evidence-source-stats">
              {Object.entries(fixtureSummary.byCategory ?? {}).map(([reason, count]) => (
                <span key={reason} className="inline-link-chip">{reason} · {count}</span>
              ))}
              {Object.entries(fixtureSummary.byMatchSource ?? {}).map(([source, count]) => (
                <span key={source} className="inline-link-chip">source {source} · {count}</span>
              ))}
              {Object.entries(fixtureSummary.byMatchConfidence ?? {}).map(([confidence, count]) => (
                <span key={confidence} className="inline-link-chip">confidence {confidence} · {count}</span>
              ))}
            </div>
            <div className="consultant-evidence-list top-gap">
              {fixtureDataset.map(({ fixture, row }) => (
                <article key={fixture.id} className="consultant-evidence-card">
                  <div className="audit-log-item-top">
                    <strong>{fixture.title}</strong>
                    <span className={row.success ? 'evidence-state-hit' : 'evidence-state-miss'}>
                      {row.success ? `hit × ${row.hitCount}` : `${row.category} / ${row.reason}`}
                    </span>
                  </div>
                  <p>{fixture.detail}</p>
                  <small>expected {fixture.expectation.category} / {fixture.expectation.reason}</small>
                  <div className="cross-link-row top-gap">
                    <span className="inline-link-chip">match_source {row.matchSource}</span>
                    <span className="inline-link-chip">match_confidence {row.matchConfidence}</span>
                    {fixture.signalParts.map((item) => (
                      <span key={`${fixture.id}-${item}`} className="inline-link-chip">{item}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel strong-card">
            <div className="panel-header">
              <h3>未回链日志</h3>
              <span className="badge-count">{summary.unresolved.length}</span>
            </div>
            <div className="consultant-evidence-list evidence-unresolved-list">
              {summary.unresolved.slice(0, 12).map((row) => (
                <article key={row.id} className="consultant-evidence-card">
                  <div className="audit-log-item-top">
                    <strong>{row.title}</strong>
                    <span>{row.source}</span>
                  </div>
                  <p>{row.detail}</p>
                  <small>{row.reason} · {row.timestamp}</small>
                  <div className="cross-link-row top-gap">
                    <span className="inline-link-chip">match_source {row.matchSource}</span>
                    <span className="inline-link-chip">match_confidence {row.matchConfidence}</span>
                    {row.signalParts.map((item) => (
                      <span key={`${row.id}-${item}`} className="inline-link-chip">{item}</span>
                    ))}
                  </div>
                </article>
              ))}
              {summary.unresolved.length === 0 ? <p className="empty-state">暂无未回链日志。</p> : null}
            </div>
          </section>

          <section className="panel strong-card">
            <div className="panel-header">
              <h3>parser 命中明细</h3>
              <span className="badge-count">{rows.length}</span>
            </div>
            <div className="consultant-evidence-list">
              {rows.slice(0, 18).map((row) => (
                <article key={row.id} className="consultant-evidence-card">
                  <div className="audit-log-item-top">
                    <strong>{row.title}</strong>
                    <span className={row.success ? 'evidence-state-hit' : 'evidence-state-miss'}>
                      {row.success ? `hit × ${row.hitCount}` : row.reason}
                    </span>
                  </div>
                  <p>{row.detail}</p>
                  <small>{row.source} · {row.timestamp}</small>
                  <div className="cross-link-row top-gap">
                    <span className="inline-link-chip">match_source {row.matchSource}</span>
                    <span className="inline-link-chip">match_confidence {row.matchConfidence}</span>
                  </div>
                  <EvidenceObjectLinks
                    textParts={row.textParts}
                    signalParts={row.signalParts}
                    currentSearch={linking.currentSearch}
                    projects={projects}
                    agents={agents}
                    rooms={rooms}
                    tasks={tasks}
                  />
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="panel strong-card">
          <div className="panel-header">
            <h3>mode isolation</h3>
            <span className="badge-count">readonly</span>
          </div>
          <p className="page-note">opensource 模式下不读取 internal evidence payload，不显示 parser rows，也不渲染对象回链。</p>
          <div className="evidence-source-stats">
            <span className="inline-link-chip">evidence rows 0</span>
            <span className="inline-link-chip">parser hits 0</span>
            <span className="inline-link-chip">unresolved 0</span>
          </div>
        </section>
      )}
    </section>
  )
}
