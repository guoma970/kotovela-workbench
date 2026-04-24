import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EvidenceObjectLinks } from '../components/EvidenceObjectLinks'
import { ObjectBadge } from '../components/ObjectBadge'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

type TaskBoardStatus = 'running' | 'queue' | 'paused' | 'done' | 'need_human'

type TaskListItem = {
  task_id: string
  title: string
  status: TaskBoardStatus
  priority: string
  owner: string
  updated_at: string
  source: 'internal' | 'opensource'
  project_line?: string
  source_line?: string
  account_line?: string
  content_line?: string
  consultant_id?: string
  attribution?: { source?: string; medium?: string; campaign?: string; content?: string }
  decision_log: Array<{ action: string; reason: string; detail: string; timestamp: string }>
}

type BoardPayload = {
  board?: Array<{
    task_id?: string
    id?: string
    task_name?: string
    title?: string
    status?: string
    priority?: number | string
    assigned_agent?: string
    agent?: string
    owner?: string
    updated_at?: string
    timestamp?: string
    need_human?: boolean
    project_line?: string
    source_line?: string
    account_line?: string
    content_line?: string
    consultant_id?: string
    attribution?: { source?: string; medium?: string; campaign?: string; content?: string }
    decision_log?: Array<{ action?: string; reason?: string; detail?: string; timestamp?: string }>
  }>
}

type AuditEntry = {
  id: string
  action: string
  target: string
  result: string
  time: string
  actor?: string
}

const STATUS_COLUMNS: Array<{ key: TaskBoardStatus; label: string; labelZh: string }> = [
  { key: 'running', label: 'Running', labelZh: '进行中' },
  { key: 'queue', label: 'Queue', labelZh: '排队中' },
  { key: 'paused', label: 'Paused', labelZh: '暂停' },
  { key: 'done', label: 'Done', labelZh: '已完成' },
  { key: 'need_human', label: 'Need Human', labelZh: '需人工处理' },
]

const normalizeStatus = (status?: string, needHuman?: boolean): TaskBoardStatus => {
  if (needHuman) return 'need_human'
  const normalized = String(status ?? '').toLowerCase()
  if (['running', 'doing', 'active', 'in_progress'].includes(normalized)) return 'running'
  if (['queue', 'queued', 'todo', 'pending'].includes(normalized)) return 'queue'
  if (['paused', 'blocked', 'suspended'].includes(normalized)) return 'paused'
  if (['done', 'success', 'completed', 'cancelled'].includes(normalized)) return 'done'
  if (['need_human', 'manual', 'manual_review'].includes(normalized)) return 'need_human'
  return 'queue'
}

const normalizePriority = (priority: number | string | undefined): string => {
  if (typeof priority === 'number') {
    if (priority >= 80) return 'high'
    if (priority >= 50) return 'medium'
    return 'low'
  }
  const normalized = String(priority ?? '').toLowerCase()
  if (['high', 'medium', 'low'].includes(normalized)) return normalized
  return normalized || 'unknown'
}

export function TasksPage() {
  const { tasks, projects, rooms, agents, mode } = useOfficeInstances()
  const isInternal = mode === 'internal'
  const navigate = useNavigate()
  const linking = useWorkbenchLinking({ tasks, projects, rooms, agents })
  const [internalTasks, setInternalTasks] = useState<TaskListItem[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])

  useEffect(() => {
    if (!isInternal) {
      setInternalTasks([])
      return
    }

    let cancelled = false
    fetch('/api/tasks-board', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<BoardPayload>) : null))
      .then((payload) => {
        if (cancelled || !payload?.board) return
        const mapped = payload.board.map((item, index) => ({
          task_id: item.task_id ?? item.id ?? `internal-${index + 1}`,
          title: item.task_name ?? item.title ?? `Task ${index + 1}`,
          status: normalizeStatus(item.status, item.need_human),
          priority: normalizePriority(item.priority),
          owner: item.owner ?? item.assigned_agent ?? item.agent ?? 'unassigned',
          updated_at: item.updated_at ?? item.timestamp ?? '-',
          source: 'internal' as const,
          project_line: item.project_line,
          source_line: item.source_line,
          account_line: item.account_line,
          content_line: item.content_line,
          consultant_id: item.consultant_id,
          attribution: item.attribution,
          decision_log: (item.decision_log ?? []).map((entry) => ({
            action: entry.action ?? '-',
            reason: entry.reason ?? '-',
            detail: entry.detail ?? '-',
            timestamp: entry.timestamp ?? '-',
          })),
        }))
        setInternalTasks(mapped)
      })
      .catch(() => {
        if (!cancelled) setInternalTasks([])
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
        if (!cancelled) setAuditEntries(Array.isArray(payload?.entries) ? payload.entries.slice(0, 6) : [])
      })
      .catch(() => {
        if (!cancelled) setAuditEntries([])
      })

    return () => {
      cancelled = true
    }
  }, [isInternal])

  const openSourceTasks = useMemo<TaskListItem[]>(
    () =>
      tasks.map((task) => ({
        task_id: task.code,
        title: task.title,
        status: normalizeStatus(task.status, false),
        priority: task.priority,
        owner: task.assignee,
        updated_at: task.updatedAt,
        source: 'opensource',
        decision_log: [],
      })),
    [tasks],
  )

  const effectiveTasks = isInternal && internalTasks.length > 0 ? internalTasks : openSourceTasks

  const goFocus = (pathname: string, kind: 'project' | 'agent' | 'room' | 'task', id: string) => {
    navigate({ pathname, search: createFocusSearch(linking.currentSearch, kind, id) })
  }

  const resolveTaskRecord = (task: TaskListItem) =>
    tasks.find(
      (item) =>
        item.id === task.task_id ||
        item.code === task.task_id ||
        item.title === task.title,
    )

  const cardClass = (task: TaskListItem) => {
    const record = resolveTaskRecord(task)
    if (!record) return 'queue-card panel-surface'
    const state = linking.getState('task', record.id)
    return [
      'queue-card panel-surface',
      state.isSelected ? 'surface-selected' : '',
      !state.isSelected && state.isRelated ? 'surface-related' : '',
      state.isDimmed ? 'surface-dimmed' : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{isInternal ? 'Tasks 任务' : 'Tasks'}</p>
          <h2>{isInternal ? '任务列表页' : 'Task List'}</h2>
        </div>
        <p className="page-note">
          {isInternal
            ? 'internal / opensource 任务数据隔离，字段统一为 task_id / title / status / priority / owner / updated_at。'
            : 'Task list with unified fields: task_id, title, status, priority, owner, updated_at.'}
        </p>
      </div>

      <PageLeadPanel
        heading={isInternal ? '任务队列' : 'Task Queue'}
        intro={isInternal ? '按状态查看当前任务结果与责任归属。' : 'Track task status results by queue state.'}
        internalMode={isInternal}
        metrics={STATUS_COLUMNS.map((column) => ({
          label: isInternal ? column.labelZh : column.label,
          value: effectiveTasks.filter((task) => task.status === column.key).length,
        }))}
        internalHint={isInternal ? 'internal 模式优先读取 /api/tasks-board；opensource 模式仅使用 mock 任务。' : undefined}
      />

      <div className="queue-grid">
        {STATUS_COLUMNS.map((column) => {
          const list = effectiveTasks.filter((task) => task.status === column.key)
          return (
            <section key={column.key} className="panel queue-column strong-card">
              <div className="panel-header">
                <h3>{isInternal ? column.labelZh : column.label}</h3>
                <span className="badge-count">{list.length}</span>
              </div>
              <div className="queue-list">
                {list.map((task) => {
                  const taskRecord = resolveTaskRecord(task)
                  const project = taskRecord ? projects.find((item) => item.id === taskRecord.projectId) : undefined
                  const agent = taskRecord ? agents.find((item) => item.id === taskRecord.executorAgentId || item.id === taskRecord.assigneeAgentId) : undefined
                  const linkedRooms = taskRecord
                    ? rooms.filter((room) => room.mainProjectId === taskRecord.projectId || room.instanceIds.includes(taskRecord.executorAgentId))
                    : []
                  return (
                    <article key={task.task_id} className={cardClass(task)}>
                      <div className="item-head">
                        <h4>{task.title}</h4>
                        <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
                      </div>
                      <div className="queue-meta dense-meta" style={{ marginTop: 8 }}>
                        <span>task_id: {task.task_id}</span>
                      </div>
                      <div className="queue-meta dense-meta">
                        <span>status: {task.status}</span>
                      </div>
                      <div className="queue-meta dense-meta">
                        <span>owner: {task.owner}</span>
                      </div>
                      <div className="queue-meta dense-meta">
                        <span>updated_at: {task.updated_at}</span>
                      </div>
                      {taskRecord ? (
                        <div className="relation-stack" style={{ marginTop: 12 }}>
                          <div>
                            <span className="section-label">{isInternal ? '回链项目' : 'Linked project'}</span>
                            <div className="object-row top-gap">
                              {project ? (
                                <ObjectBadge
                                  kind="project"
                                  code={project.code}
                                  name={project.name}
                                  hideCode={isInternal}
                                  compact
                                  clickable
                                  onClick={() => goFocus('/projects', 'project', project.id)}
                                  {...linking.getState('project', project.id)}
                                />
                              ) : (
                                <span className="soft-tag">—</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="section-label">{isInternal ? '回链房间' : 'Linked rooms'}</span>
                            <div className="object-row top-gap">
                              {linkedRooms.length > 0 ? (
                                linkedRooms.slice(0, 2).map((room) => (
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
                                ))
                              ) : (
                                <span className="soft-tag">—</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="section-label">{isInternal ? '回链实例' : 'Linked agent'}</span>
                            <div className="object-row top-gap">
                              {agent ? (
                                <ObjectBadge
                                  kind="agent"
                                  code={agent.code}
                                  name={agent.name}
                                  hideCode={isInternal}
                                  instanceKey={agent.instanceKey}
                                  agentId={agent.id}
                                  compact
                                  clickable
                                  onClick={() => goFocus('/agents', 'agent', agent.id)}
                                  {...linking.getState('agent', agent.id)}
                                />
                              ) : (
                                <span className="soft-tag">—</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
                {list.length === 0 ? <p className="empty-state empty-compact">{isInternal ? '暂无任务' : 'No tasks'}</p> : null}
              </div>
            </section>
          )
        })}
      </div>

      {isInternal ? (
        <section className="panel strong-card">
          <div className="panel-header">
            <h3>decision_log / audit_log 证据</h3>
            <span className="badge-count">{auditEntries.length}</span>
          </div>
          <p className="page-note">
            decision_log 来自 <code>/api/tasks-board</code> 的任务调度结果，audit_log 来自 <code>/api/audit-log</code> 的动作记录，当前任务页只读展示，不改写现有 guardrails。
          </p>
          <div className="consultant-evidence-list">
            {effectiveTasks
              .flatMap((task) => task.decision_log.slice(-2).map((entry, index) => ({ key: `${task.task_id}-${index}`, task, entry })))
              .slice(0, 10)
              .map(({ key, task, entry }) => {
                const taskRecord = resolveTaskRecord(task)
                const project = taskRecord ? projects.find((item) => item.id === taskRecord.projectId) : undefined
                const agent = taskRecord ? agents.find((item) => item.id === taskRecord.executorAgentId || item.id === taskRecord.assigneeAgentId) : undefined
                const linkedRoom = taskRecord
                  ? rooms.find((room) => room.mainProjectId === taskRecord.projectId || room.instanceIds.includes(taskRecord.executorAgentId))
                  : undefined
                return (
                  <article key={key} className="consultant-evidence-card">
                    <strong>{entry.action}</strong>
                    <p>{entry.reason} · {entry.detail}</p>
                    <small>{task.task_id} · {entry.timestamp}</small>
                    <EvidenceObjectLinks
                      textParts={[task.title, task.task_id, entry.reason, entry.detail]}
                      signalParts={[
                        task.project_line,
                        task.source_line,
                        task.account_line,
                        task.content_line,
                        task.consultant_id,
                        task.attribution ? `attribution=${task.attribution.source}/${task.attribution.medium}/${task.attribution.campaign}` : undefined,
                        task.attribution?.content,
                      ]}
                      currentSearch={linking.currentSearch}
                      projects={projects}
                      agents={agents}
                      rooms={rooms}
                      tasks={tasks}
                      projectId={project?.id}
                      agentId={agent?.id}
                      roomId={linkedRoom?.id}
                      taskId={taskRecord?.id}
                    />
                  </article>
                )
              })}
            {!effectiveTasks.some((task) => task.decision_log.length > 0) ? <p className="empty-state">暂无 decision_log 证据。</p> : null}
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
