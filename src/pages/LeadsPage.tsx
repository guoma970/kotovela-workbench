import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EvidenceObjectLinks } from '../components/EvidenceObjectLinks'
import { ObjectBadge } from '../components/ObjectBadge'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { mockLeads } from '../data/mockLeads'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

type LeadStatus = 'queue' | 'running' | 'done' | 'lost' | 'need_human'

type InternalLeadPayloadItem = {
  lead_id?: string
  name?: string
  task_name?: string
  source?: string
  attribution?: { source?: string; medium?: string; campaign?: string; content?: string }
  status?: string
  assignment_status?: string
  owner?: string
  consultant_owner?: string
  consultant_id?: string
  updated_at?: string
  reassigned_at?: string
  decision_log?: Array<{ action?: string; reason?: string; detail?: string; timestamp?: string }>
}

type LeadListItem = {
  lead_id: string
  name: string
  source: string
  status: LeadStatus
  owner: string
  updated_at: string
  source_mode: 'internal' | 'opensource'
  consultant_id?: string
  attribution?: { source?: string; medium?: string; campaign?: string; content?: string }
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
  { key: 'queue', label: 'Queue', labelZh: '排队中' },
  { key: 'running', label: 'Running', labelZh: '跟进中' },
  { key: 'done', label: 'Done', labelZh: '已转化' },
  { key: 'lost', label: 'Lost', labelZh: '已流失' },
  { key: 'need_human', label: 'Need Human', labelZh: '需人工处理' },
]

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
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])

  useEffect(() => {
    if (!isInternal) {
      setInternalLeads([])
      return
    }

    let cancelled = false
    fetch('/api/leads', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ leads?: InternalLeadPayloadItem[] }>) : null))
      .then((payload) => {
        if (cancelled) return
        const mapped = (payload?.leads ?? []).map((item, index) => ({
          lead_id: item.lead_id ?? `internal-lead-${index + 1}`,
          name: item.name ?? item.task_name ?? `Lead ${index + 1}`,
          source: item.source ?? item.attribution?.source ?? 'internal_api',
          status: normalizeLeadStatus(item.status, item.assignment_status),
          owner: item.owner ?? item.consultant_owner ?? item.consultant_id ?? 'unassigned',
          updated_at: item.updated_at ?? item.reassigned_at ?? '-',
          source_mode: 'internal' as const,
          consultant_id: item.consultant_id,
          attribution: item.attribution,
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
    if (!isInternal) {
      setAuditEntries([])
      return
    }

    let cancelled = false
    fetch('/api/audit-log', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ entries?: AuditEntry[] }>) : null))
      .then((payload) => {
        if (!cancelled) setAuditEntries(Array.isArray(payload?.entries) ? payload.entries.slice(0, 8) : [])
      })
      .catch(() => {
        if (!cancelled) setAuditEntries([])
      })

    return () => {
      cancelled = true
    }
  }, [isInternal])

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
      tasks.find((task) => task.title === lead.name || task.code === lead.lead_id) ??
      tasks.find((task) => task.title.includes(lead.name) || lead.name.includes(task.title))
    const relatedAgent =
      agents.find((agent) => agent.name === lead.owner || agent.id === lead.owner) ??
      (relatedTask ? agents.find((agent) => agent.id === relatedTask.executorAgentId || agent.id === relatedTask.assigneeAgentId) : undefined)
    const relatedProject =
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
          <p className="eyebrow">{isInternal ? 'Leads 线索' : 'Leads'}</p>
          <h2>{isInternal ? '线索列表页' : 'Lead List'}</h2>
        </div>
        <p className="page-note">
          {isInternal
            ? 'internal / opensource 数据源隔离，字段统一为 lead_id / name / source / status / owner / updated_at。'
            : 'Mode-isolated lead list with unified fields: lead_id, name, source, status, owner, updated_at.'}
        </p>
      </div>

      <PageLeadPanel
        heading={isInternal ? '线索队列' : 'Lead Queue'}
        intro={isInternal ? '统一状态口径后查看线索跟进结果。' : 'Track leads with normalized status labels.'}
        internalMode={isInternal}
        metrics={STATUS_COLUMNS.map((column) => ({
          label: isInternal ? column.labelZh : column.label,
          value: effectiveLeads.filter((lead) => lead.status === column.key).length,
        }))}
        actions={[
          { label: isInternal ? '进入 Dashboard' : 'Go to Dashboard', to: { pathname: '/' } },
          { label: isInternal ? '进入 Scheduler' : 'Go to Scheduler', to: { pathname: '/scheduler' } },
        ]}
        internalHint={isInternal ? 'internal 模式优先读取 /api/leads；opensource 模式仅使用 mock leads。' : undefined}
      />

      <section className="panel strong-card queue-column">
        <div className="panel-header">
          <h3>{isInternal ? '当前线索列表结果' : 'Current Leads'}</h3>
          <span className="badge-count">{effectiveLeads.length}</span>
        </div>
        <div className="queue-list">
          {effectiveLeads.map((lead) => {
            const { relatedTask, relatedAgent, relatedProject, relatedRooms } = resolveLeadRelations(lead)
            return (
              <article
                key={lead.lead_id}
                className={[
                  'queue-card panel-surface',
                  relatedTask ? (linking.getState('task', relatedTask.id).isSelected ? 'surface-selected' : '') : '',
                  relatedTask && !linking.getState('task', relatedTask.id).isSelected && linking.getState('task', relatedTask.id).isRelated ? 'surface-related' : '',
                ].filter(Boolean).join(' ')}
              >
                <div className="item-head">
                  <h4>{lead.name}</h4>
                  <span className={`priority-badge priority-${lead.status === 'done' ? 'low' : lead.status === 'running' ? 'medium' : 'high'}`}>
                    {lead.status}
                  </span>
                </div>
                <div className="queue-meta dense-meta" style={{ marginTop: 8 }}><span>lead_id: {lead.lead_id}</span></div>
                <div className="queue-meta dense-meta"><span>source: {lead.source}</span></div>
                <div className="queue-meta dense-meta"><span>status: {lead.status}</span></div>
                <div className="queue-meta dense-meta"><span>owner: {lead.owner}</span></div>
                <div className="queue-meta dense-meta"><span>updated_at: {lead.updated_at}</span></div>
                <div className="queue-meta dense-meta"><span>mode: {lead.source_mode}</span></div>
                {(relatedProject || relatedAgent || relatedRooms.length > 0) ? (
                  <div className="relation-stack" style={{ marginTop: 12 }}>
                    <div>
                      <span className="section-label">{isInternal ? '回链项目' : 'Linked project'}</span>
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
                      <span className="section-label">{isInternal ? '回链房间' : 'Linked rooms'}</span>
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
                      <span className="section-label">{isInternal ? '回链实例' : 'Linked agent'}</span>
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
              </article>
            )
          })}
          {effectiveLeads.length === 0 ? <p className="empty-state empty-compact">{isInternal ? '暂无线索' : 'No leads'}</p> : null}
        </div>
      </section>

      {isInternal ? (
        <section className="panel strong-card">
          <div className="panel-header">
            <h3>decision_log / audit_log 证据</h3>
            <span className="badge-count">{auditEntries.length}</span>
          </div>
          <p className="page-note">
            decision_log 来自 <code>/api/leads</code> 回传的线索决策轨迹，audit_log 来自 <code>/api/audit-log</code> 的动作记录，当前线索页只读展示。
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
                return (
                  <article key={entry.key} className="consultant-evidence-card">
                    <strong>{entry.action}</strong>
                    <p>{entry.reason} · {entry.detail}</p>
                    <small>{entry.leadId} · {entry.timestamp}</small>
                    <EvidenceObjectLinks
                      textParts={[entry.leadId, entry.reason, entry.detail]}
                      signalParts={[
                        leadRecord.source,
                        leadRecord.owner,
                        leadRecord.consultant_id,
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
                    />
                  </article>
                )
              })}
            {!effectiveLeads.some((lead) => lead.decision_log.length > 0) ? <p className="empty-state">暂无 decision_log 证据。</p> : null}
          </div>
          <div className="consultant-evidence-list" style={{ marginTop: 12 }}>
            {auditEntries.map((entry) => (
              <article key={entry.id} className="consultant-evidence-card">
                <strong>{entry.action}</strong>
                <p>{entry.target}</p>
                <small>{entry.result} · {entry.time}</small>
                <EvidenceObjectLinks
                  textParts={[entry.action, entry.target, entry.result]}
                  signalParts={[entry.actor, entry.target, entry.result]}
                  currentSearch={linking.currentSearch}
                  projects={projects}
                  agents={agents}
                  rooms={rooms}
                  tasks={tasks}
                />
              </article>
            ))}
            {!auditEntries.length ? <p className="empty-state">暂无 audit_log 证据。</p> : null}
          </div>
        </section>
      ) : null}
    </section>
  )
}
