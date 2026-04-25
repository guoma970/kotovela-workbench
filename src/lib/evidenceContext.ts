export type StableEvidenceRoutingHints = {
  projectIds?: string[]
  roomIds?: string[]
  taskIds?: string[]
  agentIds?: string[]
  projectSignals?: string[]
  roomSignals?: string[]
  taskSignals?: string[]
  agentSignals?: string[]
}

export type TaskBoardEvidenceLike = {
  task_name?: string
  title?: string
  domain?: string
  project_line?: string
  source_line?: string
  account_line?: string
  content_line?: string
  consultant_id?: string
  assigned_agent?: string
  agent?: string
  preferred_agent?: string
  lead_id?: string
  attribution?: { source?: string; medium?: string; campaign?: string; content?: string } | null
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
  routingHints?: StableEvidenceRoutingHints
}

export type StableEvidenceContext = {
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
  routingHints: StableEvidenceRoutingHints
}

const normalize = (value?: string) => String(value ?? '').trim()

const uniq = (values: Array<string | undefined>) => {
  const seen = new Set<string>()
  return values
    .map((value) => normalize(value))
    .filter((value) => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

const AGENT_ID_BY_KEY: Record<string, string> = {
  main: 'agent-1',
  builder: 'agent-2',
  media: 'agent-3',
  family: 'agent-4',
  business: 'agent-5',
  personal: 'agent-6',
  ztl970: 'agent-6',
}

function inferAgentId(item: TaskBoardEvidenceLike) {
  const direct = normalize(item.agentId)
  if (direct) return direct
  const raw = normalize(item.assigned_agent || item.agent || item.preferred_agent).toLowerCase()
  if (raw && AGENT_ID_BY_KEY[raw]) return AGENT_ID_BY_KEY[raw]
  if (normalize(item.consultant_id)) return 'agent-5'
  if (normalize(item.domain).toLowerCase() === 'business') return 'agent-5'
  return undefined
}

export function inferTaskBoardEvidenceContext(item: TaskBoardEvidenceLike): StableEvidenceContext {
  const projectId = normalize(item.projectId) || 'project-1'
  const taskId = normalize(item.taskId) || (normalize(item.lead_id) || normalize(item.content_line) || normalize(item.source_line) || normalize(item.account_line) ? 'task-2' : undefined)
  const roomId = normalize(item.roomId) || (normalize(item.lead_id) || normalize(item.source_line) || normalize(item.consultant_id) ? 'room-2' : undefined)
  const agentId = inferAgentId(item)

  const routingHints: StableEvidenceRoutingHints = {
    projectIds: uniq([projectId, item.project_line, item.attribution?.source]),
    roomIds: uniq([roomId, item.source_line, item.lead_id]),
    taskIds: uniq([taskId, item.lead_id, item.task_name, item.title]),
    agentIds: uniq([agentId, item.assigned_agent, item.agent, item.preferred_agent, item.consultant_id]),
    projectSignals: uniq([item.project_line, item.account_line, item.attribution?.source, item.attribution?.campaign]),
    roomSignals: uniq([item.source_line, item.consultant_id, item.lead_id]),
    taskSignals: uniq([item.content_line, item.task_name, item.title, item.attribution?.content]),
    agentSignals: uniq([item.assigned_agent, item.agent, item.preferred_agent, item.consultant_id]),
  }

  return {
    projectId,
    agentId,
    roomId,
    taskId,
    routingHints,
  }
}
