import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { consultantSettingsConfig, type ConsultantRecord } from '../config/consultantSettings'
import { APP_MODE, BRAND_NAME } from '../config/brand'

type BoardItem = {
  task_name: string
  domain?: string
  account_type?: string
  consultant_id?: string
  consultant_owner?: string
  active_load?: number
  route_result?: string
  route_target?: string
  assignment_status?: string
  decision_log?: Array<{
    action?: string
    reason?: string
    detail?: string
    partner_mode?: string
    rule_hit_reason?: string
  }>
}

type BoardPayload = {
  board?: BoardItem[]
}

type AuditEntry = {
  id: string
  action: string
  user: string
  time: string
  target: string
  result: string
}

type SystemModeState = {
  systemMode: string
  publishMode: string
  forceStop: boolean
}

const defaultSystemMode: SystemModeState = {
  systemMode: 'dev',
  publishMode: 'manual_only',
  forceStop: false,
}

function normalizeSystemModeState(payload: unknown): SystemModeState {
  if (!payload || typeof payload !== 'object') return defaultSystemMode
  const data = payload as Record<string, unknown>
  return {
    systemMode: String(data.system_mode ?? data.systemMode ?? 'dev'),
    publishMode: String(data.publish_mode ?? data.publishMode ?? 'manual_only'),
    forceStop: Boolean(data.force_stop ?? data.forceStop ?? false),
  }
}

export function ConsultantsPage() {
  const [consultants, setConsultants] = useState<ConsultantRecord[]>(consultantSettingsConfig.consultants)
  const [board, setBoard] = useState<BoardItem[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [systemMode, setSystemMode] = useState<SystemModeState>(defaultSystemMode)

  useEffect(() => {
    fetch('/api/tasks-board', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: BoardPayload | null) => setBoard(Array.isArray(payload?.board) ? payload.board : []))
      .catch(() => setBoard([]))

    fetch('/api/audit-log', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { entries?: AuditEntry[] } | null) => setAuditEntries(Array.isArray(payload?.entries) ? payload.entries : []))
      .catch(() => setAuditEntries([]))

    fetch('/api/system-mode', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => setSystemMode(normalizeSystemModeState(payload)))
      .catch(() => setSystemMode(defaultSystemMode))
  }, [])

  const consultantLoadSummary = useMemo(() => {
    const summary = new Map<string, { total: number; active: number; owner: string; domains: Set<string> }>()
    board.forEach((item) => {
      if (!item.consultant_id) return
      const current = summary.get(item.consultant_id) ?? {
        total: 0,
        active: 0,
        owner: item.consultant_owner ?? item.consultant_id,
        domains: new Set<string>(),
      }
      current.total += 1
      if (!['done', 'success', 'failed', 'cancelled', 'lost', 'converted'].includes(item.assignment_status ?? '')) {
        current.active += 1
      }
      if (item.domain) current.domains.add(item.domain)
      summary.set(item.consultant_id, current)
    })
    return Array.from(summary.entries()).map(([consultantId, value]) => ({
      consultantId,
      owner: value.owner,
      total: value.total,
      active: value.active,
      domains: Array.from(value.domains),
    }))
  }, [board])

  const externalPartnerEvidence = useMemo(
    () =>
      board.filter((item) => item.account_type === 'external_partner').map((item) => ({
        task_name: item.task_name,
        route_result: item.route_result ?? '-',
        route_target: item.route_target ?? '-',
        consultant_id: item.consultant_id ?? '-',
        partner_mode:
          item.decision_log?.find((entry) => entry.partner_mode)?.partner_mode ??
          item.decision_log?.find((entry) => entry.reason?.includes('external_partner'))?.partner_mode ??
          '-',
      })),
    [board],
  )

  const assignmentEvidence = useMemo(
    () =>
      board
        .filter((item) => item.consultant_id || item.decision_log?.some((entry) => entry.rule_hit_reason || entry.reason?.includes('consultant')))
        .slice(0, 6),
    [board],
  )

  const auditEvidence = auditEntries.filter((entry) => entry.action.includes('consultant')).slice(0, 6)
  const totalActiveLoad = consultants.reduce((sum, item) => sum + item.active_load, 0)

  const updateConsultant = (consultantId: string, key: keyof ConsultantRecord, value: string) => {
    setConsultants((current) =>
      current.map((item) => {
        if (item.consultant_id !== consultantId) return item
        if (key === 'active_load') {
          return { ...item, active_load: Number(value) || 0 }
        }
        if (key === 'status') {
          return { ...item, status: value as ConsultantRecord['status'] }
        }
        return { ...item, [key]: value }
      }),
    )
  }

  return (
    <section className="page consultant-settings-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{APP_MODE === 'internal' ? 'Consultants 顾问' : 'Consultants'}</p>
          <h2>{consultantSettingsConfig.pageTitle}</h2>
        </div>
        <p className="page-note">
          {consultantSettingsConfig.pageNote} 当前品牌：<strong>{BRAND_NAME}</strong>
        </p>
      </div>

      <section className="panel strong-card consultant-mode-strip">
        <div className="info-pairs">
          <div className="context-strip"><span>app_mode</span><strong>{APP_MODE}</strong></div>
          <div className="context-strip"><span>system_mode</span><strong>{systemMode.systemMode}</strong></div>
          <div className="context-strip"><span>publish_mode</span><strong>{systemMode.publishMode}</strong></div>
          <div className="context-strip"><span>force_stop</span><strong>{String(systemMode.forceStop)}</strong></div>
          <div className="context-strip"><span>consultant_pool</span><strong>{consultants.length}</strong></div>
          <div className="context-strip"><span>configured_active_load</span><strong>{totalActiveLoad}</strong></div>
        </div>
        <p className="page-note top-gap">
          {APP_MODE === 'internal'
            ? '当前口径已纳入“顾问可为团长”，例如 consultant_guoshituan_main 以团长顾问身份承接 lead_router。'
            : 'Open-source mode only keeps mock-safe consultant samples and does not expose internal group leader assignments.'}
        </p>
        <div className="cross-link-row top-gap">
          <Link className="inline-link-chip" to="/scheduler">查看调度证据</Link>
          <Link className="inline-link-chip" to="/">返回 Dashboard</Link>
        </div>
      </section>

      <div className="consultant-settings-grid">
        <section className="panel strong-card consultant-editor-panel">
          <div className="panel-header align-start">
            <h3>顾问配置</h3>
            <span className="home-count">{consultants.length}</span>
          </div>
          <p className="page-note">当前为最小可用配置页，支持 consultant_id / name / role / status / account_type / active_load / domain 展示与本地编辑。</p>
          <div className="consultant-card-list">
            {consultants.map((item) => (
              <article key={item.consultant_id} className="consultant-card">
                <div className="consultant-card-top">
                  <strong>{item.consultant_id}</strong>
                  <span className={`status-pill status-${item.status === 'online' ? 'active' : item.status === 'busy' ? 'blocked' : 'idle'}`}>
                    {item.status}
                  </span>
                </div>
                <div className="consultant-form-grid">
                  <label>
                    <span>display_role</span>
                    <input value={item.role === 'group_leader_consultant' ? '团长顾问 / group leader consultant' : item.role} readOnly />
                  </label>
                  <label>
                    <span>name</span>
                    <input value={item.name} onChange={(event) => updateConsultant(item.consultant_id, 'name', event.target.value)} />
                  </label>
                  <label>
                    <span>role</span>
                    <input value={item.role} onChange={(event) => updateConsultant(item.consultant_id, 'role', event.target.value)} />
                  </label>
                  <label>
                    <span>domain</span>
                    <input value={item.domain} onChange={(event) => updateConsultant(item.consultant_id, 'domain', event.target.value)} />
                  </label>
                  <label>
                    <span>active_load</span>
                    <input type="number" value={item.active_load} onChange={(event) => updateConsultant(item.consultant_id, 'active_load', event.target.value)} />
                  </label>
                  <label>
                    <span>status</span>
                    <select value={item.status} onChange={(event) => updateConsultant(item.consultant_id, 'status', event.target.value)}>
                      <option value="online">online</option>
                      <option value="busy">busy</option>
                      <option value="offline">offline</option>
                    </select>
                  </label>
                  <label>
                    <span>account_type</span>
                    <select value={item.account_type} onChange={(event) => updateConsultant(item.consultant_id, 'account_type', event.target.value)}>
                      <option value="owned">owned</option>
                      <option value="brand">brand</option>
                      <option value="ip">ip</option>
                      <option value="external_partner">external_partner</option>
                      <option value="demo">demo</option>
                    </select>
                  </label>
                  <label>
                    <span>assignment_scope</span>
                    <input value={item.assignment_scope} onChange={(event) => updateConsultant(item.consultant_id, 'assignment_scope', event.target.value)} />
                  </label>
                  <label>
                    <span>note</span>
                    <input value={item.note} onChange={(event) => updateConsultant(item.consultant_id, 'note', event.target.value)} />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel strong-card consultant-rule-panel">
          <div className="panel-header align-start">
            <h3>顾问分配规则落点</h3>
            <span className="home-count">{consultantSettingsConfig.ruleSummary.length}</span>
          </div>
          <ul className="consultant-rule-list">
            {consultantSettingsConfig.ruleSummary.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div className="consultant-evidence-list">
            {assignmentEvidence.map((item) => (
              <article key={item.task_name} className="consultant-evidence-card">
                <strong>{item.task_name}</strong>
                <p>domain {item.domain ?? '-'} · consultant_id {item.consultant_id ?? '-'} · route {item.route_result ?? '-'} → {item.route_target ?? '-'}</p>
                <small>
                  {(item.decision_log ?? [])
                    .slice(-2)
                    .map((entry) => `${entry.reason ?? entry.action ?? '-'} / ${entry.rule_hit_reason ?? entry.detail ?? '-'}`)
                    .join('；') || 'no decision log'}
                </small>
                {item.consultant_id === 'consultant_guoshituan_main' ? <small>role evidence: 团长顾问可直接承接 consultant_id</small> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="panel strong-card consultant-load-panel">
          <div className="panel-header align-start">
            <h3>Dashboard 顾问负载摘要</h3>
            <span className="home-count">{consultantLoadSummary.length}</span>
          </div>
          <div className="consultant-evidence-list">
            {consultantLoadSummary.map((item) => (
              <article key={item.consultantId} className="consultant-evidence-card">
                <strong>{item.owner}</strong>
                <p>{item.consultantId}</p>
                <small>active_load {item.active} · total {item.total} · domains {item.domains.join(', ') || '-'}</small>
              </article>
            ))}
            {!consultantLoadSummary.length ? <p className="empty-state">当前无顾问负载回写数据，保留配置态展示。</p> : null}
          </div>
        </section>

        <section className="panel strong-card consultant-risk-panel">
          <div className="panel-header align-start">
            <h3>external_partner 防误分配</h3>
            <span className="home-count">{externalPartnerEvidence.length}</span>
          </div>
          <div className="consultant-evidence-list">
            {externalPartnerEvidence.map((item) => (
              <article key={item.task_name} className="consultant-evidence-card">
                <strong>{item.task_name}</strong>
                <p>route {item.route_result} → {item.route_target}</p>
                <small>consultant_id {item.consultant_id} · partner_mode {item.partner_mode}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="panel strong-card consultant-audit-panel">
          <div className="panel-header align-start">
            <h3>decision / audit 证据</h3>
            <span className="home-count">{auditEvidence.length}</span>
          </div>
          <div className="consultant-evidence-list">
            {auditEvidence.map((entry) => (
              <article key={entry.id} className="consultant-evidence-card">
                <strong>{entry.action}</strong>
                <p>{entry.target}</p>
                <small>{entry.user} · {entry.result} · {entry.time}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
