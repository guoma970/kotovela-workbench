import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { consultantSettingsConfig, type ConsultantRecord } from '../config/consultantSettings'
import { APP_MODE } from '../config/brand'
import { formatReadableDetail, formatReadableOwner, formatReadableTaskTitle, formatReadableTime } from '../lib/readableText'

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

const consultantFieldLabels = {
  display_role: '角色展示名',
  name: '显示名称',
  role: '负责角色',
  domain: '擅长方向',
  active_load: '当前工作量',
  status: '状态',
  account_type: '账号类型',
  assignment_scope: '适用事项',
  note: '备注',
} as const

const consultantStatusLabels: Record<ConsultantRecord['status'], string> = {
  online: '在线',
  busy: '繁忙',
  offline: '离线',
}

const consultantAccountTypeLabels: Record<ConsultantRecord['account_type'], string> = {
  owned: '自有账号',
  brand: '品牌账号',
  ip: 'IP账号',
  external_partner: '外部合作方',
  demo: '演示账号',
}

const consultantRoleLabels: Record<string, string> = {
  group_leader_consultant: '团长顾问',
  material_consultant: '材料顾问',
  heating_consultant: '地暖顾问',
  residential_consultant: '住宅顾问',
  business_consultant: '业务顾问',
}

const consultantDomainLabels: Record<string, string> = {
  business: '业务跟进',
  material_case: '材料案例',
  floor_heating: '地暖系统',
  layout_renovation: '户型改造',
}

const consultantRouteResultLabels: Record<string, string> = {
  direct: '直达',
  blocked: '拦截',
  transfer: '转派',
}

const consultantPartnerModeLabels: Record<string, string> = {
  content_only: '仅内容协作',
  consult_only: '仅咨询协作',
  no_delivery: '暂停交付',
}

const consultantRouteTargetLabels: Record<string, string> = {
  'business.lead_router': '业务跟进池',
  'manual_review.required': '待人工复核',
  family_pool: '家庭池',
  media_pool: '内容池',
  business_pool: '业务池',
  individual_pool: '个人池',
  brand_pool: '品牌池',
  external_partner_pool: '外部合作池',
}

const systemModeLabels: Record<string, string> = {
  dev: '开发模式',
  test: '测试验证',
  staging: '预发模式',
  live: '正式运行',
  production: '生产模式',
}

const publishModeLabels: Record<string, string> = {
  manual_only: '仅手动发布',
  auto_disabled: '人工确认后发布',
  semi_auto: '半自动发布',
  assisted: '人工确认后发布',
  auto: '自动发布',
}

function formatConsultantRole(role: string) {
  return consultantRoleLabels[role] ?? formatReadableDetail(role)
}

function formatConsultantDomain(value: string) {
  return consultantDomainLabels[value] ?? formatReadableDetail(value)
}

function formatAssignmentScope(value: string) {
  return value
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (consultantDomainLabels[item]) return consultantDomainLabels[item]
      if (consultantAccountTypeLabels[item as keyof typeof consultantAccountTypeLabels]) return consultantAccountTypeLabels[item as keyof typeof consultantAccountTypeLabels]
      return item
        .replace(/official_account/gi, '官方账号')
        .replace(/lead_router/gi, '线索分发')
        .replace(/article lead/gi, '文章线索')
        .replace(/customer_followup/gi, '客户跟进')
        .replace(/residential/gi, '住宅咨询')
        .replace(/guoshituan/gi, '果实团')
        .replace(/kotoharo/gi, '言家')
        .replace(/yanfami/gi, '言范家')
        .replace(/demo/gi, '演示环境')
        .replace(/[._-]+/g, ' ')
    })
    .join(' / ')
}

function formatSystemMode(mode: string) {
  return systemModeLabels[mode] ?? mode
}

function formatPublishMode(mode: string) {
  return publishModeLabels[mode] ?? mode
}

function formatRouteResult(value?: string) {
  return value ? (consultantRouteResultLabels[value] ?? value) : '-'
}

function formatPartnerMode(value?: string) {
  return value ? (consultantPartnerModeLabels[value] ?? value) : '-'
}

function formatRouteTarget(value?: string) {
  if (!value || value === '-') return '暂未分配'
  return consultantRouteTargetLabels[value] ?? formatReadableDetail(value)
}

function formatDecisionSnippet(value?: string) {
  if (!value) return '未补充说明'
  return formatReadableDetail(value)
    .replace(/consultant/gi, '顾问')
    .replace(/external_partner/gi, '外部合作方')
    .replace(/route/gi, '分配')
    .replace(/rule_hit_reason/gi, '命中原因')
}

function formatAssignmentAction(value?: string) {
  if (!value || value === '-') return '已记录分配动作'
  return formatReadableDetail(value)
    .replace(/consultant_assigned/gi, '已完成顾问分配')
    .replace(/manual_review/gi, '已转人工复核')
    .replace(/priority_up/gi, '已提高优先级')
    .replace(/priority_down/gi, '已降低优先级')
    .replace(/[._-]+/g, ' ')
}

function formatAuditResult(value?: string) {
  if (!value || value === '-') return '已记录结果'
  return formatReadableDetail(value)
    .replace(/assigned to/gi, '已分配给')
    .replace(/consultant/gi, '顾问')
    .replace(/[._-]+/g, ' ')
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
        domain: item.domain ?? '-',
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
  const consultantNameById = useMemo(
    () => new Map(consultants.map((item) => [item.consultant_id, item.name])),
    [consultants],
  )

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
          <p className="eyebrow">{APP_MODE === 'internal' ? '角色配置' : 'Consultants'}</p>
          <h2>{consultantSettingsConfig.pageTitle}</h2>
        </div>
        <p className="page-note">
          {consultantSettingsConfig.pageNote} 当前页面默认先展示业务结果与配置摘要，原始编号和内部口径折叠到下层。
        </p>
      </div>

      <section className="panel strong-card consultant-mode-strip">
        <div className="info-pairs">
          <div className="context-strip"><span>当前环境</span><strong>{APP_MODE === 'internal' ? '内部版' : '开源版'}</strong></div>
          <div className="context-strip"><span>运行方式</span><strong>{formatSystemMode(systemMode.systemMode)}</strong></div>
          <div className="context-strip"><span>发布节奏</span><strong>{formatPublishMode(systemMode.publishMode)}</strong></div>
          <div className="context-strip"><span>紧急停止</span><strong>{systemMode.forceStop ? '已开启' : '未开启'}</strong></div>
          <div className="context-strip"><span>顾问数量</span><strong>{consultants.length}</strong></div>
          <div className="context-strip"><span>当前承载量</span><strong>{totalActiveLoad}</strong></div>
        </div>
        <p className="page-note top-gap">
          {APP_MODE === 'internal'
            ? '当前口径已支持“顾问可兼任团长”，团长顾问可以直接承接线索分发。'
            : '开源版只保留安全的演示顾问样例，不暴露内部团长分配信息。'}
        </p>
        <div className="cross-link-row top-gap">
          <Link className="inline-link-chip" to="/scheduler">查看执行记录</Link>
          <Link className="inline-link-chip" to="/">返回总览</Link>
        </div>
      </section>

      <div className="consultant-settings-grid">
        <section className="panel strong-card consultant-editor-panel">
          <div className="panel-header align-start">
            <h3>顾问配置</h3>
            <span className="home-count">{consultants.length}</span>
          </div>
          <p className="page-note">先看每位顾问负责什么、当前多忙、适合承接哪些事项；如需排障，再展开原始编号和内部口径。</p>
          <div className="consultant-card-list">
            {consultants.map((item) => (
              <article key={item.consultant_id} className="consultant-card">
                <div className="consultant-card-top">
                  <div>
                    <strong>{item.name}</strong>
                    <small style={{ display: 'block', marginTop: 4, color: '#7f8ea3' }}>
                      {formatConsultantRole(item.role)} · {formatConsultantDomain(item.domain)}
                    </small>
                  </div>
                  <span className={`status-pill status-${item.status === 'online' ? 'active' : item.status === 'busy' ? 'blocked' : 'idle'}`}>
                    {consultantStatusLabels[item.status]}
                  </span>
                </div>
                <div className="consultant-form-grid">
                  <label>
                    <span>{consultantFieldLabels.display_role}</span>
                    <input value={formatConsultantRole(item.role)} readOnly />
                  </label>
                  <label>
                    <span>{consultantFieldLabels.name}</span>
                    <input value={item.name} onChange={(event) => updateConsultant(item.consultant_id, 'name', event.target.value)} />
                  </label>
                  <label>
                    <span>{consultantFieldLabels.role}</span>
                    <input value={formatConsultantRole(item.role)} readOnly />
                  </label>
                  <label>
                    <span>{consultantFieldLabels.domain}</span>
                    <input value={formatConsultantDomain(item.domain)} readOnly />
                  </label>
                  <label>
                    <span>{consultantFieldLabels.active_load}</span>
                    <input type="number" value={item.active_load} onChange={(event) => updateConsultant(item.consultant_id, 'active_load', event.target.value)} />
                  </label>
                  <label>
                    <span>{consultantFieldLabels.status}</span>
                    <select value={item.status} onChange={(event) => updateConsultant(item.consultant_id, 'status', event.target.value)}>
                      <option value="online">{consultantStatusLabels.online}</option>
                      <option value="busy">{consultantStatusLabels.busy}</option>
                      <option value="offline">{consultantStatusLabels.offline}</option>
                    </select>
                  </label>
                  <label>
                    <span>{consultantFieldLabels.account_type}</span>
                    <select value={item.account_type} onChange={(event) => updateConsultant(item.consultant_id, 'account_type', event.target.value)}>
                      <option value="owned">{consultantAccountTypeLabels.owned}</option>
                      <option value="brand">{consultantAccountTypeLabels.brand}</option>
                      <option value="ip">{consultantAccountTypeLabels.ip}</option>
                      <option value="external_partner">{consultantAccountTypeLabels.external_partner}</option>
                      <option value="demo">{consultantAccountTypeLabels.demo}</option>
                    </select>
                  </label>
                  <label>
                    <span>{consultantFieldLabels.assignment_scope}</span>
                    <input value={formatAssignmentScope(item.assignment_scope)} readOnly />
                  </label>
                  <label>
                    <span>{consultantFieldLabels.note}</span>
                    <input value={item.note} onChange={(event) => updateConsultant(item.consultant_id, 'note', event.target.value)} />
                  </label>
                </div>
                <details className="scheduler-debug-block top-gap">
                  <summary className="scheduler-task-result-head">
                    <strong>查看原始顾问口径</strong>
                  </summary>
                  <div className="top-gap">
                    <p>原始编号：{item.consultant_id}</p>
                    <p>角色代码：{item.role}</p>
                    <p>领域代码：{item.domain}</p>
                    <p>适用范围代码：{item.assignment_scope}</p>
                  </div>
                </details>
              </article>
            ))}
          </div>
        </section>

        <section className="panel strong-card consultant-rule-panel">
          <div className="panel-header align-start">
            <h3>顾问分配规则摘要</h3>
            <span className="home-count">{consultantSettingsConfig.ruleSummary.length}</span>
          </div>
          <ul className="consultant-rule-list">
            {consultantSettingsConfig.ruleSummary.map((rule, index) => (
              <li key={`${rule}-${index}`}>{rule}</li>
            ))}
          </ul>
        </section>

        <section className="panel strong-card consultant-load-panel">
          <div className="panel-header align-start">
            <h3>顾问承载概览</h3>
            <span className="home-count">{consultantLoadSummary.length}</span>
          </div>
          <div className="consultant-evidence-list">
            {consultantLoadSummary.map((item, index) => (
              <article key={`${item.consultantId}-${index}`} className="consultant-evidence-card">
                <strong>{formatReadableOwner(item.owner)}</strong>
                <p>当前工作量 {item.active} · 总计 {item.total}</p>
                <small>主要方向：{item.domains.map((domain) => formatConsultantDomain(domain)).join(' / ') || '暂未同步'}</small>
              </article>
            ))}
            {!consultantLoadSummary.length ? <p className="empty-state">当前无顾问负载回写数据，保留配置态展示。</p> : null}
          </div>
        </section>

        <section className="panel strong-card consultant-risk-panel">
          <div className="panel-header align-start">
            <h3>外部合作方保护</h3>
            <span className="home-count">{externalPartnerEvidence.length}</span>
          </div>
          <div className="consultant-evidence-list">
            {externalPartnerEvidence.map((item, index) => (
              <article key={`${item.task_name}-${index}`} className="consultant-evidence-card">
                <strong>{formatReadableTaskTitle(item.task_name)}</strong>
                <p>去向判断 {formatRouteResult(item.route_result)} → {formatRouteTarget(item.route_target)}</p>
                <small>合作方式：{formatPartnerMode(item.partner_mode)} · 处理方向：{formatConsultantDomain(item.domain ?? 'business')}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="panel strong-card consultant-audit-panel">
          <div className="panel-header align-start">
            <h3>最近分配结果</h3>
            <span className="home-count">{assignmentEvidence.length}</span>
          </div>
          <p className="page-note">先看最近有哪些事项被分给了谁，以及这样分配的原因；原始记录折叠到下层，排障时再展开。</p>
          <div className="consultant-evidence-list">
            {assignmentEvidence.map((item, index) => {
              const lastEntry = [...(item.decision_log ?? [])].slice(-1)[0]
              const consultantName = item.consultant_id ? consultantNameById.get(item.consultant_id) ?? formatReadableOwner(item.consultant_id) : '待确认'
              return (
                <article key={`${item.task_name}-${index}`} className="consultant-evidence-card">
                  <strong>{formatReadableTaskTitle(item.task_name)}</strong>
                  <p>已分给：{consultantName}</p>
                  <small>原因：{formatDecisionSnippet(lastEntry?.rule_hit_reason ?? lastEntry?.reason ?? lastEntry?.detail)}</small>
                  <details className="scheduler-debug-block" style={{ marginTop: 8 }}>
                    <summary className="scheduler-task-result-head">
                      <strong>查看原始分配依据</strong>
                    </summary>
                    <div className="top-gap">
                      <p>领域：{formatConsultantDomain(item.domain ?? '未标注')} · 去向判断：{formatRouteResult(item.route_result)} → {formatRouteTarget(item.route_target)}</p>
                      <p>顾问编号：{item.consultant_id ?? '暂未同步'}</p>
                      <small>
                        {(item.decision_log ?? [])
                          .slice(-2)
                          .map((entry) => `${formatAssignmentAction(entry.action)} · ${formatDecisionSnippet(entry.reason ?? entry.detail)} · ${formatDecisionSnippet(entry.rule_hit_reason)}`)
                          .join('；') || '暂无原始分配记录'}
                      </small>
                    </div>
                  </details>
                  {item.consultant_id === 'consultant_guoshituan_main' ? <small>补充说明：团长顾问可直接承接顾问线索。</small> : null}
                </article>
              )
            })}
            {!assignmentEvidence.length ? <p className="empty-state">最近还没有新的分配结果。</p> : null}
          </div>
          <details className="scheduler-debug-block top-gap">
            <summary className="scheduler-task-result-head">
              <strong>查看原始分配记录（排障用）</strong>
            </summary>
            <div className="consultant-evidence-list top-gap">
              {auditEvidence.map((entry, index) => (
                <article key={`${entry.id}-${index}`} className="consultant-evidence-card">
                  <strong>{formatAssignmentAction(entry.action)}</strong>
                  <p>{formatReadableTaskTitle(entry.target)}</p>
                  <small>{formatReadableOwner(entry.user)} · {formatAuditResult(entry.result)} · {formatReadableTime(entry.time)}</small>
                </article>
              ))}
              {!auditEvidence.length ? <p className="empty-state">暂无原始分配记录。</p> : null}
            </div>
          </details>
        </section>
      </div>
    </section>
  )
}
