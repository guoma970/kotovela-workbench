import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EvidenceObjectLinks } from '../components/EvidenceObjectLinks'
import { ObjectBadge } from '../components/ObjectBadge'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { mockLeads } from '../data/mockLeads'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { formatReadableDetail, formatReadableKey, formatReadableOwner, formatReadableTaskTitle, formatReadableTime } from '../lib/readableText'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'
import type { StableEvidenceRoutingHints } from '../lib/evidenceContext'

type LeadStatus = 'queue' | 'running' | 'done' | 'lost' | 'need_human'

type InternalLeadPayloadItem = {
  lead_id?: string
  name?: string
  task_name?: string
  source?: string
  source_line?: string
  account_line?: string
  content_line?: string
  attribution?: { source?: string; medium?: string; campaign?: string; content?: string }
  status?: string
  assignment_status?: string
  owner?: string
  consultant_owner?: string
  consultant_id?: string
  updated_at?: string
  reassigned_at?: string
  decision_log?: Array<{ action?: string; reason?: string; detail?: string; timestamp?: string }>
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
  routingHints?: StableEvidenceRoutingHints
}

type LeadListItem = {
  lead_id: string
  name: string
  source: string
  status: LeadStatus
  owner: string
  updated_at: string
  source_mode: 'internal' | 'opensource'
  source_line?: string
  account_line?: string
  content_line?: string
  consultant_id?: string
  attribution?: { source?: string; medium?: string; campaign?: string; content?: string }
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
  routingHints?: StableEvidenceRoutingHints
  decision_log: Array<{ action: string; reason: string; detail: string; timestamp: string }>
}

type AuditEntry = {
  id: string
  action: string
  target: string
  result: string
  time: string
  actor?: string
}

const STATUS_COLUMNS: Array<{ key: LeadStatus; label: string; labelZh: string }> = [
  { key: 'queue', label: '排队中', labelZh: '排队中' },
  { key: 'running', label: '跟进中', labelZh: '跟进中' },
  { key: 'done', label: '已转化', labelZh: '已转化' },
  { key: 'lost', label: '已流失', labelZh: '已流失' },
  { key: 'need_human', label: '需人工处理', labelZh: '需人工处理' },
]

const LEAD_STATUS_LABEL_ZH: Record<LeadStatus, string> = {
  queue: '排队中',
  running: '跟进中',
  done: '已转化',
  lost: '已流失',
  need_human: '需人工处理',
}

const LEAD_ACTION_LABELS: Record<string, string> = {
  consultant_assigned: '已完成分配',
  priority_up: '已提高优先级',
  priority_down: '已降低优先级',
  pause: '已暂停',
  resume: '已恢复跟进',
  transfer: '已转派',
  retry: '已重新尝试',
  manual_review: '转人工处理',
}

const formatLeadLogText = (value?: string, fallback = '未补充说明') => {
  if (!value || value === '-') return fallback
  if (LEAD_ACTION_LABELS[value]) return LEAD_ACTION_LABELS[value]
  return formatReadableDetail(value)
    .replace(/consultant_assigned/gi, '已完成分配')
    .replace(/manual_review.required/gi, '待人工复核')
    .replace(/business.lead_router/gi, '业务跟进池')
    .replace(/route_target/gi, '处理去向')
    .replace(/route_result/gi, '处理结果')
    .replace(/decision_log/gi, '处理记录')
    .replace(/audit_log/gi, '变更记录')
    .replace(/[._-]+/g, ' ')
}

const buildLeadSummary = (lead: LeadListItem) => {
  if (lead.status === 'queue') return '这条待跟进事项还在排队，先确认来源和负责人是否明确。'
  if (lead.status === 'running') return '正在跟进中，重点看负责人和最近处理动态。'
  if (lead.status === 'need_human') return '需要人工判断，建议先补充客户意图或确认分配方向。'
  if (lead.status === 'done') return '已经转化或完成，可在处理动态里回看依据。'
  return '已关闭或流失，可用于复盘来源和跟进路径。'
}

const buildLeadNextAction = (lead: LeadListItem) => {
  if (lead.status === 'queue') return '确认负责人，必要时进入自动化派发。'
  if (lead.status === 'running') return '等待负责人回报下一步，或补充客户关键需求。'
  if (lead.status === 'need_human') return '人工确认是否继续跟进、改派或关闭。'
  if (lead.status === 'done') return '确认转化记录是否完整，必要时沉淀案例。'
  return '复盘流失原因，避免同类线索重复丢失。'
}

const buildLeadSignals = (lead: LeadListItem) =>
  [
    { label: '来源', value: lead.source },
    { label: '来源协作群', value: lead.source_line },
    { label: '账号/协作群', value: lead.account_line },
    { label: '内容线', value: lead.content_line },
    { label: '顾问', value: lead.consultant_id },
    { label: '渠道', value: lead.attribution?.source },
  ]
    .filter((item): item is { label: string; value: string } => Boolean(item.value))
    .slice(0, 4)
    .map((item) => ({
      ...item,
      value: item.label === '顾问' ? formatReadableOwner(item.value) : formatReadableKey(item.value),
    }))

const normalizeLeadStatus = (status?: string, assignmentStatus?: string): LeadStatus => {
  const s = String(status ?? '').toLowerCase()
  const a = String(assignmentStatus ?? '').toLowerCase()
  const merged = `${s}|${a}`
  if (['need_human', 'manual', 'manual_review', 'pending'].some((item) => merged.includes(item))) return 'need_human'
  if (['queue', 'queued', 'todo', 'new'].some((item) => merged.includes(item))) return 'queue'
  if (['running', 'doing', 'in_progress', 'assigned', 'reassigned', 'active'].some((item) => merged.includes(item))) return 'running'
  if (['converted', 'done', 'success', 'completed'].some((item) => merged.includes(item))) return 'done'
  if (['lost', 'failed', 'cancelled', 'closed_lost'].some((item) => merged.includes(item))) return 'lost'
  return 'queue'
}

export function LeadsPage() {
  const { mode, tasks, projects, rooms, agents } = useOfficeInstances()
  const isInternal = mode === 'internal'
  const navigate = useNavigate()
  const linking = useWorkbenchLinking({ tasks, projects, rooms, agents })
  const [internalLeads, setInternalLeads] = useState<LeadListItem[]>([])
  const [internalAuditEntries, setInternalAuditEntries] = useState<AuditEntry[]>([])

  useEffect(() => {
    if (!isInternal) return

    let cancelled = false
    fetch('/api/leads', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ leads?: InternalLeadPayloadItem[] }>) : null))
      .then((payload) => {
        if (cancelled) return
        const mapped = (payload?.leads ?? []).map((item, index) => ({
          lead_id: item.lead_id ?? `internal-lead-${index + 1}`,
          name: item.name ?? item.task_name ?? `Lead ${index + 1}`,
          source: item.source ?? item.source_line ?? item.account_line ?? item.attribution?.source ?? 'internal_api',
          status: normalizeLeadStatus(item.status, item.assignment_status),
          owner: item.owner ?? item.consultant_owner ?? item.consultant_id ?? 'unassigned',
          updated_at: item.updated_at ?? item.reassigned_at ?? '-',
          source_mode: 'internal' as const,
          source_line: item.source_line,
          account_line: item.account_line,
          content_line: item.content_line,
          consultant_id: item.consultant_id,
          attribution: item.attribution,
          projectId: item.projectId,
          agentId: item.agentId,
          roomId: item.roomId,
          taskId: item.taskId,
          routingHints: item.routingHints,
          decision_log: (item.decision_log ?? []).map((entry) => ({
            action: entry.action ?? '-',
            reason: entry.reason ?? '-',
            detail: entry.detail ?? '-',
            timestamp: entry.timestamp ?? '-',
          })),
        }))
        setInternalLeads(mapped)
      })
      .catch(() => {
        if (!cancelled) setInternalLeads([])
      })

    return () => {
      cancelled = true
    }
  }, [isInternal])

  useEffect(() => {
    if (!isInternal) return

    let cancelled = false
    fetch('/api/audit-log', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ entries?: AuditEntry[] }>) : null))
      .then((payload) => {
        if (!cancelled) setInternalAuditEntries(Array.isArray(payload?.entries) ? payload.entries.slice(0, 8) : [])
      })
      .catch(() => {
        if (!cancelled) setInternalAuditEntries([])
      })

    return () => {
      cancelled = true
    }
  }, [isInternal])

  const auditEntries = isInternal ? internalAuditEntries : []

  const openSourceLeads = useMemo<LeadListItem[]>(
    () =>
      mockLeads.map((item) => ({
        lead_id: item.lead_id,
        name: item.name,
        source: item.source,
        status: normalizeLeadStatus(item.status, undefined),
        owner: item.owner,
        updated_at: item.updated_at,
        source_mode: 'opensource',
        decision_log: [],
      })),
    [],
  )

  const effectiveLeads = isInternal && internalLeads.length > 0 ? internalLeads : openSourceLeads

  const goFocus = (pathname: string, kind: 'project' | 'agent' | 'room' | 'task', id: string) => {
    navigate({ pathname, search: createFocusSearch(linking.currentSearch, kind, id) })
  }

  const resolveLeadRelations = (lead: LeadListItem) => {
    const relatedTask =
      (lead.taskId ? tasks.find((task) => task.id === lead.taskId || task.code === lead.taskId) : undefined) ??
      tasks.find((task) => task.title === lead.name || task.code === lead.lead_id) ??
      tasks.find((task) => task.title.includes(lead.name) || lead.name.includes(task.title))
    const relatedAgent =
      (lead.agentId ? agents.find((agent) => agent.id === lead.agentId || agent.code === lead.agentId) : undefined) ??
      agents.find((agent) => agent.name === lead.owner || agent.id === lead.owner) ??
      (relatedTask ? agents.find((agent) => agent.id === relatedTask.executorAgentId || agent.id === relatedTask.assigneeAgentId) : undefined)
    const relatedProject =
      (lead.projectId ? projects.find((project) => project.id === lead.projectId || project.code === lead.projectId) : undefined) ??
      (relatedTask ? projects.find((project) => project.id === relatedTask.projectId) : undefined) ??
      projects.find((project) => project.name.includes(lead.source) || lead.source.includes(project.code.toLowerCase()))
    const relatedRooms = rooms.filter(
      (room) =>
        (relatedProject && room.mainProjectId === relatedProject.id) ||
        (relatedAgent && room.instanceIds.includes(relatedAgent.id)),
    )

    return { relatedTask, relatedAgent, relatedProject, relatedRooms }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">待跟进</p>
          <h2>待跟进看板</h2>
        </div>
        <p className="page-note">
          默认展示待跟进事项的业务摘要、负责人和下一步；编号、字段和关联对象可展开查看。
        </p>
      </div>

      <PageLeadPanel
        heading="待跟进一览"
        intro="先看需人工处理和跟进中；每张卡片都给出来源、负责人和下一步。"
        internalMode={isInternal}
        metrics={STATUS_COLUMNS.map((column) => ({
          label: column.labelZh,
          value: effectiveLeads.filter((lead) => lead.status === column.key).length,
        }))}
        actions={[
          { label: '进入总览', to: { pathname: '/' } },
          { label: '进入自动化', to: { pathname: '/scheduler' } },
        ]}
        internalHint={isInternal ? '内部版优先读取真实待跟进记录；暂时没有同步数据时，会先显示演示样例。' : undefined}
      />

      <section className="panel strong-card queue-column">
        <div className="panel-header">
          <h3>当前待跟进列表</h3>
          <span className="badge-count">{effectiveLeads.length}</span>
        </div>
        <div className="queue-list">
          {effectiveLeads.map((lead, index) => {
            const { relatedTask, relatedAgent, relatedProject, relatedRooms } = resolveLeadRelations(lead)
            return (
              <article
                key={`${lead.lead_id}-${index}`}
                className={[
                  'queue-card panel-surface task-readable-card',
                  relatedTask ? (linking.getState('task', relatedTask.id).isSelected ? 'surface-selected' : '') : '',
                  relatedTask && !linking.getState('task', relatedTask.id).isSelected && linking.getState('task', relatedTask.id).isRelated ? 'surface-related' : '',
                ].filter(Boolean).join(' ')}
              >
                <div className="task-card-kicker">
                  <span className={`task-status-chip task-status-${lead.status}`}>
                    {LEAD_STATUS_LABEL_ZH[lead.status]}
                  </span>
                  <span className={`priority-badge priority-${lead.status === 'done' ? 'low' : lead.status === 'running' ? 'medium' : 'high'}`}>
                    {LEAD_STATUS_LABEL_ZH[lead.status]}
                  </span>
                </div>
                <h4 className="task-readable-title">{formatReadableTaskTitle(lead.name)}</h4>
                <p className="task-readable-summary">{buildLeadSummary(lead)}</p>
                {isInternal ? (
                  <div className="task-next-action">
                    <span>下一步</span>
                    <strong>{buildLeadNextAction(lead)}</strong>
                  </div>
                ) : null}
                <div className="task-readable-meta">
                  <span>负责人：{isInternal ? formatReadableOwner(lead.owner) : lead.owner}</span>
                  <span>更新：{isInternal ? formatReadableTime(lead.updated_at) : lead.updated_at}</span>
                </div>
                {isInternal ? (
                  <div className="task-signal-row" aria-label="待跟进业务线索">
                    {buildLeadSignals(lead).map((signal) => (
                      <span key={`${lead.lead_id}-${signal.label}-${signal.value}`}>
                        <small>{signal.label}</small>
                        {signal.value}
                      </span>
                    ))}
                  </div>
                ) : null}
                <details className="task-raw-details">
                  <summary>查看编号、来源与关联对象</summary>
                  <div className="queue-meta dense-meta" style={{ marginTop: 8 }}><span>待跟进编号：{lead.lead_id}</span></div>
                  <div className="queue-meta dense-meta"><span>原始来源：{formatReadableKey(lead.source)}</span></div>
                  <div className="queue-meta dense-meta"><span>展示口径：{lead.source_mode === 'internal' ? '内部实时/快照数据' : '演示数据'}</span></div>
                  {(relatedProject || relatedAgent || relatedRooms.length > 0) ? (
                    <div className="relation-stack" style={{ marginTop: 12 }}>
                    <div>
                      <span className="section-label">关联项目</span>
                      <div className="object-row top-gap">
                        {relatedProject ? (
                          <ObjectBadge
                            kind="project"
                            code={relatedProject.code}
                            name={relatedProject.name}
                            hideCode={isInternal}
                            compact
                            clickable
                            onClick={() => goFocus('/projects', 'project', relatedProject.id)}
                            {...linking.getState('project', relatedProject.id)}
                          />
                        ) : <span className="soft-tag">—</span>}
                      </div>
                    </div>
                    <div>
                      <span className="section-label">关联协作群</span>
                      <div className="object-row top-gap">
                        {relatedRooms.length > 0 ? relatedRooms.slice(0, 2).map((room) => (
                          <ObjectBadge
                            key={room.id}
                            kind="room"
                            code={room.code}
                            name={room.name}
                            compact
                            clickable
                            onClick={() => goFocus('/rooms', 'room', room.id)}
                            {...linking.getState('room', room.id)}
                          />
                        )) : <span className="soft-tag">—</span>}
                      </div>
                    </div>
                    <div>
                      <span className="section-label">关联同事</span>
                      <div className="object-row top-gap">
                        {relatedAgent ? (
                          <ObjectBadge
                            kind="agent"
                            code={relatedAgent.code}
                            name={relatedAgent.name}
                            hideCode={isInternal}
                            compact
                            clickable
                            instanceKey={relatedAgent.instanceKey}
                            agentId={relatedAgent.id}
                            onClick={() => goFocus('/agents', 'agent', relatedAgent.id)}
                            {...linking.getState('agent', relatedAgent.id)}
                          />
                        ) : <span className="soft-tag">—</span>}
                      </div>
                    </div>
                    </div>
                  ) : null}
                </details>
              </article>
            )
          })}
          {effectiveLeads.length === 0 ? <p className="empty-state empty-compact">{isInternal ? '暂无线索' : 'No leads'}</p> : null}
        </div>
      </section>

      {isInternal ? (
        <section className="panel strong-card">
          <div className="panel-header">
            <h3>最近处理动态</h3>
            <span className="badge-count">
              {effectiveLeads.reduce((sum, lead) => sum + Math.min(lead.decision_log.length, 2), 0)}
            </span>
          </div>
          <p className="page-note">
            先看最近发生了什么、为什么这样跟进；如需排障，再展开原始说明和变更记录。
          </p>
          <div className="consultant-evidence-list">
            {effectiveLeads
              .flatMap((lead) => lead.decision_log.slice(-2).map((entry, index) => ({ key: `${lead.lead_id}-${index}`, leadId: lead.lead_id, lead, ...entry })))
              .slice(0, 10)
              .map((entry) => {
                const leadRecord = entry.lead ?? effectiveLeads.find((lead) => lead.lead_id === entry.leadId) ?? {
                  lead_id: entry.leadId,
                  name: entry.detail,
                  source: entry.detail,
                  status: 'queue',
                  owner: entry.detail,
                  updated_at: entry.timestamp,
                  source_mode: 'internal',
                  decision_log: [],
                }
                const relations = resolveLeadRelations(leadRecord)
                const routingHints = {
                  ...(leadRecord.routingHints ?? {}),
                  projectIds: [
                    ...(leadRecord.routingHints?.projectIds ?? []),
                    ...(relations.relatedProject ? [relations.relatedProject.id, relations.relatedProject.code, relations.relatedProject.name] : []),
                  ].filter((value): value is string => Boolean(value)),
                  agentIds: [
                    ...(leadRecord.routingHints?.agentIds ?? []),
                    ...(relations.relatedAgent ? [relations.relatedAgent.id, relations.relatedAgent.code, relations.relatedAgent.name, relations.relatedAgent.instanceKey] : []),
                  ].filter((value): value is string => Boolean(value)),
                  roomIds: [
                    ...(leadRecord.routingHints?.roomIds ?? []),
                    ...(relations.relatedRooms[0] ? [relations.relatedRooms[0].id, relations.relatedRooms[0].code, relations.relatedRooms[0].name] : []),
                  ].filter((value): value is string => Boolean(value)),
                  taskIds: [
                    ...(leadRecord.routingHints?.taskIds ?? []),
                    ...(relations.relatedTask ? [relations.relatedTask.id, relations.relatedTask.code, relations.relatedTask.title] : [leadRecord.lead_id, leadRecord.name]),
                  ].filter((value): value is string => Boolean(value)),
                  projectSignals: [...(leadRecord.routingHints?.projectSignals ?? []), leadRecord.source, leadRecord.account_line].filter((value): value is string => Boolean(value)),
                  roomSignals: [...(leadRecord.routingHints?.roomSignals ?? []), leadRecord.source_line, leadRecord.consultant_id].filter((value): value is string => Boolean(value)),
                  taskSignals: [...(leadRecord.routingHints?.taskSignals ?? []), leadRecord.content_line, leadRecord.attribution?.content].filter((value): value is string => Boolean(value)),
                  agentSignals: [...(leadRecord.routingHints?.agentSignals ?? []), leadRecord.owner, leadRecord.consultant_id].filter((value): value is string => Boolean(value)),
                }
                return (
                  <article key={entry.key} className="consultant-evidence-card">
                  <strong>{formatReadableTaskTitle(leadRecord.name)}</strong>
                  <p>最近处理：{formatLeadLogText(entry.action, '已记录处理动作')}</p>
                    <small>原因：{formatLeadLogText(entry.reason)} · {formatReadableTime(entry.timestamp)}</small>
                    <details className="scheduler-debug-block" style={{ marginTop: 8 }}>
                      <summary className="scheduler-task-result-head">
                        <strong>查看处理依据</strong>
                      </summary>
                      <div className="top-gap">
                        <p>处理说明：{formatLeadLogText(entry.detail)}</p>
                        <p>待跟进编号：{entry.leadId}</p>
                        <EvidenceObjectLinks
                          textParts={[entry.leadId, entry.reason, entry.detail]}
                          signalParts={[
                            leadRecord.source,
                            leadRecord.source_line ? `source_line=${leadRecord.source_line}` : undefined,
                            leadRecord.account_line ? `account_line=${leadRecord.account_line}` : undefined,
                            leadRecord.content_line ? `content_line=${leadRecord.content_line}` : undefined,
                            leadRecord.owner,
                            leadRecord.consultant_id ? `consultant_id=${leadRecord.consultant_id}` : undefined,
                            leadRecord.attribution ? `attribution=${leadRecord.attribution.source}/${leadRecord.attribution.medium}/${leadRecord.attribution.campaign}` : undefined,
                            leadRecord.attribution?.content,
                          ]}
                          currentSearch={linking.currentSearch}
                          projects={projects}
                          agents={agents}
                          rooms={rooms}
                          tasks={tasks}
                          projectId={relations.relatedProject?.id}
                          agentId={relations.relatedAgent?.id}
                          taskId={relations.relatedTask?.id}
                          roomId={relations.relatedRooms[0]?.id}
                          routingHints={routingHints}
                        />
                      </div>
                    </details>
                  </article>
                )
              })}
            {!effectiveLeads.some((lead) => lead.decision_log.length > 0) ? <p className="empty-state">暂无处理记录。</p> : null}
          </div>
          <details className="scheduler-debug-block top-gap">
            <summary className="scheduler-task-result-head">
              <strong>查看变更记录（排障用）</strong>
            </summary>
            <div className="consultant-evidence-list top-gap">
              {auditEntries.map((entry, index) => (
                <article key={`${entry.id}-${index}`} className="consultant-evidence-card">
                  <strong>{formatLeadLogText(entry.action, '已记录变更')}</strong>
                  <p>{formatLeadLogText(entry.target, '涉及对象已记录')}</p>
                  <small>{formatLeadLogText(entry.result, '结果已记录')} · {formatReadableTime(entry.time)}</small>
                  <EvidenceObjectLinks
                    textParts={[entry.action, entry.target, entry.result]}
                    signalParts={[entry.actor, entry.target, entry.result]}
                    currentSearch={linking.currentSearch}
                    projects={projects}
                    agents={agents}
                    rooms={rooms}
                    tasks={tasks}
                    routingHints={{
                      agentSignals: [entry.actor].filter((value): value is string => Boolean(value)),
                      roomSignals: [entry.target],
                      taskSignals: [entry.target, entry.result],
                    }}
                  />
                </article>
              ))}
              {!auditEntries.length ? <p className="empty-state">暂无变更记录。</p> : null}
            </div>
          </details>
        </section>
      ) : null}
    </section>
  )
}
