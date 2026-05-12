import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EvidenceObjectLinks } from '../components/EvidenceObjectLinks'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { buildEvidenceParserFixtureDataset, buildEvidenceRow, summarizeFixtureDataset, type EvidenceBucketExample, type EvidenceDriftSummary, type EvidenceRow } from '../lib/evidenceAcceptance'
import { formatReadableDetail, formatReadableKey, formatReadableOwner, formatReadableTaskTitle, formatReadableTime } from '../lib/readableText'
import { UI_TERMS } from '../lib/uiTerms'
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

const DRIFT_BUCKET_DISPLAY = [
  { key: 'signal_map_room', label: '协作群线索匹配', description: '协作群/来源维度仍需复核的未匹配样本。' },
  { key: 'signal_map_content', label: '内容线索匹配', description: '内容维度仍需复核的未匹配样本。' },
] as const

const SOURCE_LABELS: Record<string, string> = {
  'tasks-board': '任务记录',
  leads: '待跟进记录',
  'audit-log': '操作记录',
}

const MATCH_SOURCE_LABELS: Record<string, string> = {
  none: '暂未识别',
  direct_id: '编号直连',
  direct_name: '名称直连',
  signal_map_account: '账号线索',
  signal_map_room: '协作群线索',
  signal_map_content: '内容线索',
  signal_map_only: '线索辅助',
}

const CATEGORY_LABELS: Record<string, string> = {
  resolved: '已识别',
  missing_signals: '线索不足',
  text_too_thin: '信息过少',
  no_object_match: '仍待补线索',
}

const REASON_LABELS: Record<string, string> = {
  resolved: '已完成识别',
  signal_parts_empty: '缺少可用线索',
  text_under_min_length: '描述信息过少',
  signals_present_but_unmapped: '已有线索，但还找不到对应对象',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
  none: '暂无',
}

const ALERT_LEVEL_LABELS: Record<string, string> = {
  none: '正常',
  watch: '留意',
  warning: '提醒',
  critical: '重点关注',
}

const displaySource = (value: string) => SOURCE_LABELS[value] ?? value
const displayMatchSource = (value: string) => MATCH_SOURCE_LABELS[value] ?? value
const displayCategory = (value: string) => CATEGORY_LABELS[value] ?? value
const displayReason = (value: string) => REASON_LABELS[value] ?? value
const displayConfidence = (value: string) => CONFIDENCE_LABELS[value] ?? value
const displayAlertLevel = (value: string) => ALERT_LEVEL_LABELS[value] ?? value

function displaySignalPart(value: string) {
  const [rawKey, rawValue] = value.split('=')
  if (!rawValue) return formatReadableTaskTitle(value)

  const keyLabels: Record<string, string> = {
    project_line: '项目线索',
    source_line: '来源协作群',
    account_line: '账号线索',
    content_line: '内容线索',
    consultant_id: '顾问编号',
    attribution: '来源补充',
    lead_id: '待跟进编号',
  }

  const displayValue = rawKey === 'consultant_id'
    ? formatReadableOwner(rawValue)
    : formatReadableKey(rawValue)

  return `${keyLabels[rawKey] ?? formatReadableKey(rawKey)}：${displayValue}`
}

function renderBucketExampleMeta(example: EvidenceBucketExample) {
  return `${displaySource(example.source)} · ${formatReadableTime(example.timestamp)}`
}

export function EvidenceAcceptancePage() {
  const { projects, agents, rooms, tasks, mode } = useOfficeInstances()
  const isInternal = mode === 'internal'
  const linking = useWorkbenchLinking({ projects, agents, rooms, tasks })
  const [internalBoard, setInternalBoard] = useState<BoardEntry[]>([])
  const [internalLeads, setInternalLeads] = useState<LeadEntry[]>([])
  const [internalAuditEntries, setInternalAuditEntries] = useState<AuditEntry[]>([])
  const [internalDriftSummary, setInternalDriftSummary] = useState<EvidenceDriftSummary | null>(null)

  useEffect(() => {
    if (!isInternal) return

    let cancelled = false
    Promise.all([
      fetch('/api/tasks-board', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : { board: [] })),
      fetch('/api/leads', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : { leads: [] })),
      fetch('/api/audit-log', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : { entries: [] })),
    ])
      .then(([boardPayload, leadsPayload, auditPayload]) => {
        if (cancelled) return
        setInternalBoard(Array.isArray(boardPayload?.board) ? boardPayload.board : [])
        setInternalLeads(Array.isArray(leadsPayload?.leads) ? leadsPayload.leads : [])
        setInternalAuditEntries(Array.isArray(auditPayload?.entries) ? auditPayload.entries : [])
      })
      .catch(() => {
        if (cancelled) return
        setInternalBoard([])
        setInternalLeads([])
        setInternalAuditEntries([])
      })

    return () => {
      cancelled = true
    }
  }, [isInternal])

  useEffect(() => {
    if (!isInternal) return

    let cancelled = false
    fetch('/evidence/dev78/drift-trend.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled) return
        setInternalDriftSummary(payload)
      })
      .catch(() => {
        if (cancelled) return
        setInternalDriftSummary(null)
      })

    return () => {
      cancelled = true
    }
  }, [isInternal])

  const board = useMemo(() => (isInternal ? internalBoard : []), [isInternal, internalBoard])
  const leads = useMemo(() => (isInternal ? internalLeads : []), [isInternal, internalLeads])
  const auditEntries = useMemo(() => (isInternal ? internalAuditEntries : []), [isInternal, internalAuditEntries])
  const driftSummary = isInternal ? internalDriftSummary : null

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
          signalParts: [
            entry.project_line ? `project_line=${entry.project_line}` : undefined,
            entry.source_line ? `source_line=${entry.source_line}` : undefined,
            entry.account_line ? `account_line=${entry.account_line}` : undefined,
            entry.content_line ? `content_line=${entry.content_line}` : undefined,
            entry.consultant_id ? `consultant_id=${entry.consultant_id}` : undefined,
            entry.assigned_agent,
            entry.agent,
            entry.route_target,
            entry.route_result,
          ].map((item) => normalize(item)),
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
          signalParts: [
            entry.source_line ? `source_line=${entry.source_line}` : undefined,
            entry.account_line ? `account_line=${entry.account_line}` : undefined,
            entry.content_line ? `content_line=${entry.content_line}` : undefined,
            entry.consultant_id ? `consultant_id=${entry.consultant_id}` : undefined,
            entry.status,
          ].map((item) => normalize(item)),
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

  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])

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
          <p className="eyebrow">结果验收</p>
          <h2>{UI_TERMS.evidence}</h2>
        </div>
        <p className="page-note">
          {isInternal
            ? '第一屏先看识别率、待补线索和波动提醒；样本、原始记录和对象关联放到下层排障。'
            : '开源版只展示隔离后的演示内容，不渲染内部结果记录。'}
        </p>
      </div>

      <section className="panel strong-card evidence-hero-card">
        <div className="evidence-hero-metrics">
          <article className="evidence-metric-card">
            <span>检查记录</span>
            <strong>{rows.length}</strong>
          </article>
          <article className="evidence-metric-card is-hit">
            <span>已识别</span>
            <strong>{summary.successCount}</strong>
          </article>
          <article className="evidence-metric-card is-miss">
            <span>待补线索</span>
            <strong>{summary.unresolved.length}</strong>
          </article>
          <article className="evidence-metric-card">
            <span>自动识别率</span>
            <strong>{summary.successRate}%</strong>
          </article>
        </div>
        <div className="cross-link-row top-gap">
          <Link className="inline-link-chip" to="/tasks">任务验证</Link>
          <Link className="inline-link-chip" to="/leads">待跟进验证</Link>
          <Link className="inline-link-chip" to="/system-control">总开关</Link>
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
                    <h3>{displaySource(source)}</h3>
                    <span className="badge-count">{list.length}</span>
                  </div>
                  <div className="evidence-source-stats">
                    <span className="inline-link-chip">已识别 {hitCount}</span>
                    <span className="inline-link-chip">待补线索 {list.length - hitCount}</span>
                    <span className="inline-link-chip">自动识别率 {rate}%</span>
                  </div>
                </section>
              )
            })}
          </div>

          <section className="panel strong-card">
            <div className="panel-header">
              <h3>为什么还没识别出来</h3>
              <span className="badge-count">{Object.keys(summary.missReasonCounts).length}</span>
            </div>
            <div className="evidence-source-stats">
              {Object.entries(summary.missReasonCounts).map(([reason, count]) => (
                <span key={reason} className="inline-link-chip">{displayReason(reason)} · {count}</span>
              ))}
              {Object.keys(summary.missReasonCounts).length === 0 ? <span className="inline-link-chip">当前都已识别</span> : null}
            </div>
            <div className="evidence-source-stats top-gap">
              {Object.entries(summary.heuristicDriftCounts).map(([source, count]) => (
                <span key={source} className="inline-link-chip">线索辅助 {displayMatchSource(source)} · {count}</span>
              ))}
              {Object.keys(summary.heuristicDriftCounts).length === 0 ? <span className="inline-link-chip">线索提示正常</span> : null}
            </div>
          </section>

          <section className="panel strong-card">
            <div className="panel-header">
              <h3>近期识别波动提醒</h3>
              <span className="badge-count">{driftSummary?.alerts.length ?? 0}</span>
            </div>
            <div className="evidence-source-stats">
              {driftSummary?.samples.map((sample, index) => (
                    <span key={`${sample.sampleId}-${index}`} className="inline-link-chip">{formatReadableDetail(sample.label)} · 待补线索 {sample.unresolved} · 线索辅助 {sample.heuristicHits}</span>
              ))}
              {!driftSummary?.samples.length ? <span className="inline-link-chip">近期趋势暂不可用</span> : null}
            </div>
            <div className="evidence-source-stats top-gap">
              {driftSummary?.alerts.map((alert, index) => (
                <span key={`${alert.source}-${index}`} className="inline-link-chip">{displayAlertLevel(alert.level)} · {displayMatchSource(alert.source)} · 最新 {alert.latestCount} · Δ {alert.delta >= 0 ? `+${alert.delta}` : alert.delta} {alert.driftStartedAt ? `· 首次 ${formatReadableTime(alert.driftStartedAt)}` : ''}</span>
              ))}
              {driftSummary && !driftSummary.alerts.length ? <span className="inline-link-chip">未触发阈值</span> : null}
            </div>
            <div className="consultant-evidence-list top-gap">
              {driftSummary?.buckets.map((bucket, bucketIndex) => (
                <article key={`${bucket.source}-${bucketIndex}`} className="consultant-evidence-card">
                    <div className="audit-log-item-top">
                      <strong>{displayMatchSource(bucket.source)}</strong>
                      <span className={bucket.alertLevel === 'critical' || bucket.alertLevel === 'warning' ? 'evidence-state-miss' : 'evidence-state-hit'}>
                        {displayAlertLevel(bucket.alertLevel)} · 最新 {bucket.latestCount}
                      </span>
                    </div>
                  <p>
                    上次 {bucket.previousCount} → 最新 {bucket.latestCount}，Δ {bucket.delta >= 0 ? `+${bucket.delta}` : bucket.delta}，占比 {(bucket.latestRatio * 100).toFixed(0)}%
                  </p>
                  <small>{bucket.driftStartedAt ? `首次波动 ${formatReadableTime(bucket.driftStartedAt)}` : '未触发早期波动'}</small>
                  <div className="cross-link-row top-gap">
                    {driftSummary.samples.map((sample, index) => (
                      <span key={`${bucket.source}-${sample.sampleId}-${index}`} className="inline-link-chip">{formatReadableDetail(sample.label)} · {bucket.counts[index] ?? 0}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <details className="scheduler-debug-block top-gap">
              <summary className="scheduler-task-result-head">
                <strong>查看波动样本（排障用）</strong>
              </summary>
              <div className="consultant-evidence-list top-gap">
                {DRIFT_BUCKET_DISPLAY.map(({ key, label, description }) => {
                  const examples = driftSummary?.bucket_top_examples?.[key] ?? []
                  return (
                    <article key={key} className="consultant-evidence-card">
                      <div className="audit-log-item-top">
                        <strong>{label}未匹配样本</strong>
                        <span className={examples.length > 0 ? 'evidence-state-miss' : 'evidence-state-hit'}>{examples.length}</span>
                      </div>
                      <p>{description}</p>
                      <div className="consultant-evidence-list top-gap">
                        {examples.map((example, exampleIndex) => {
                          const linkedRow = rowById.get(example.rowId)
                          const linkedTextParts = linkedRow?.textParts ?? [example.title, example.detail]
                          const linkedSignalParts = linkedRow?.signalParts ?? example.signalParts
                          const linkedProjectId = linkedRow?.projectId ?? example.projectId
                          const linkedAgentId = linkedRow?.agentId ?? example.agentId
                          const linkedRoomId = linkedRow?.roomId ?? example.roomId
                          const linkedTaskId = linkedRow?.taskId ?? example.taskId
                          const linkedRoutingHints = linkedRow?.routingHints ?? example.routingHints
                          const hasLinkedRow = Boolean(linkedRow)

                          return (
                            <article key={`${key}-${example.rowId}-${exampleIndex}`} className="consultant-evidence-card">
                              <div className="audit-log-item-top">
                                <strong>{formatReadableTaskTitle(example.title)}</strong>
                                <span>{displayMatchSource(example.matchSource)}</span>
                              </div>
                              <p>{formatReadableDetail(example.detail)}</p>
                              <small>{renderBucketExampleMeta(example)} · {hasLinkedRow ? '已通过当前验证记录关联' : linkedProjectId || linkedAgentId || linkedRoomId || linkedTaskId ? '已通过导出对象线索关联' : '仅剩线索辅助，缺少记录级关联提示'}</small>
                              <div className="cross-link-row top-gap">
                                {example.signalParts.map((item, signalIndex) => (
                                  <span key={`${example.rowId}-${item}-${signalIndex}`} className="inline-link-chip">{displaySignalPart(item)}</span>
                                ))}
                              </div>
                              <EvidenceObjectLinks
                                textParts={linkedTextParts}
                                signalParts={linkedSignalParts}
                                currentSearch={linking.currentSearch}
                                projects={projects}
                                agents={agents}
                                rooms={rooms}
                                tasks={tasks}
                                projectId={linkedProjectId}
                                agentId={linkedAgentId}
                                roomId={linkedRoomId}
                                taskId={linkedTaskId}
                                routingHints={linkedRoutingHints}
                              />
                            </article>
                          )
                        })}
                        {examples.length === 0 ? <p className="empty-state">暂无代表样本。</p> : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            </details>
          </section>

          <section className="panel strong-card">
            <div className="panel-header">
              <h3>系统自检样本</h3>
              <span className="badge-count">{fixtureDataset.length}</span>
            </div>
            <div className="evidence-source-stats">
              {Object.entries(fixtureSummary.byCategory ?? {}).map(([reason, count]) => (
                <span key={reason} className="inline-link-chip">{displayCategory(reason)} · {count}</span>
              ))}
              {Object.entries(fixtureSummary.byMatchSource ?? {}).map(([source, count]) => (
                <span key={source} className="inline-link-chip">关联方式 {displayMatchSource(source)} · {count}</span>
              ))}
              {Object.entries(fixtureSummary.byMatchConfidence ?? {}).map(([confidence, count]) => (
                <span key={confidence} className="inline-link-chip">可信度 {displayConfidence(confidence)} · {count}</span>
              ))}
            </div>
            <p className="page-note">这组样本用于确认最近一轮更新后，自动识别逻辑是否仍然稳定；详细样本折叠到下层。</p>
            <details className="scheduler-debug-block top-gap">
              <summary className="scheduler-task-result-head">
                <strong>查看系统自检样本（排障用）</strong>
              </summary>
              <div className="consultant-evidence-list top-gap">
                {fixtureDataset.map(({ fixture, row }) => (
                  <article key={fixture.id} className="consultant-evidence-card">
                    <div className="audit-log-item-top">
                      <strong>{formatReadableTaskTitle(fixture.title)}</strong>
                      <span className={row.success ? 'evidence-state-hit' : 'evidence-state-miss'}>
                        {row.success ? `已命中 × ${row.hitCount}` : `${displayCategory(row.category)} / ${displayReason(row.reason)}`}
                      </span>
                    </div>
                    <p>{formatReadableDetail(fixture.detail)}</p>
                    <small>预期：{displayCategory(fixture.expectation.category)} / {displayReason(fixture.expectation.reason)}</small>
                    <div className="cross-link-row top-gap">
                      <span className="inline-link-chip">识别来源 {displayMatchSource(row.matchSource)}</span>
                      <span className="inline-link-chip">可信度 {displayConfidence(row.matchConfidence)}</span>
                      {fixture.signalParts.map((item, signalIndex) => (
                        <span key={`${fixture.id}-${item}-${signalIndex}`} className="inline-link-chip">{displaySignalPart(item)}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </details>
          </section>

          <section className="panel strong-card">
            <div className="panel-header">
              <h3>仍待人工补线索的记录</h3>
              <span className="badge-count">{summary.unresolved.length}</span>
            </div>
            <div className="consultant-evidence-list evidence-unresolved-list">
              {summary.unresolved.slice(0, 12).map((row) => (
                <article key={row.id} className="consultant-evidence-card">
                  <div className="audit-log-item-top">
                    <strong>{formatReadableTaskTitle(row.title)}</strong>
                    <span>{displaySource(row.source)}</span>
                  </div>
                  <p>{formatReadableDetail(row.detail)}</p>
                  <small>{displayReason(row.reason)} · {formatReadableTime(row.timestamp)}</small>
                  <div className="cross-link-row top-gap">
                    <span className="inline-link-chip">识别来源 {displayMatchSource(row.matchSource)}</span>
                    <span className="inline-link-chip">可信度 {displayConfidence(row.matchConfidence)}</span>
                    {row.signalParts.map((item, signalIndex) => (
                      <span key={`${row.id}-${item}-${signalIndex}`} className="inline-link-chip">{displaySignalPart(item)}</span>
                    ))}
                  </div>
                </article>
              ))}
              {summary.unresolved.length === 0 ? <p className="empty-state">暂无未关联记录。</p> : null}
            </div>
          </section>

          <section className="panel strong-card">
            <div className="panel-header">
              <h3>最近关联结果</h3>
              <span className="badge-count">{rows.length}</span>
            </div>
            <div className="consultant-evidence-list">
              {rows.slice(0, 18).map((row) => (
                <article key={row.id} className="consultant-evidence-card">
                  <div className="audit-log-item-top">
                    <strong>{formatReadableTaskTitle(row.title)}</strong>
                    <span className={row.success ? 'evidence-state-hit' : 'evidence-state-miss'}>
                      {row.success ? `已关联 × ${row.hitCount}` : displayReason(row.reason)}
                    </span>
                  </div>
                  <p>{formatReadableDetail(row.detail)}</p>
                  <small>{displaySource(row.source)} · {formatReadableTime(row.timestamp)}</small>
                  <div className="cross-link-row top-gap">
                    <span className="inline-link-chip">关联方式 {displayMatchSource(row.matchSource)}</span>
                    <span className="inline-link-chip">把握度 {displayConfidence(row.matchConfidence)}</span>
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
            <h3>模式隔离</h3>
            <span className="badge-count">只读</span>
          </div>
          <p className="page-note">开源演示模式下不读取内部验证数据，不显示内部记录，也不渲染对象关联。</p>
          <div className="evidence-source-stats">
            <span className="inline-link-chip">验证记录 0</span>
            <span className="inline-link-chip">匹配成功 0</span>
            <span className="inline-link-chip">未关联 0</span>
          </div>
        </section>
      )}
    </section>
  )
}
