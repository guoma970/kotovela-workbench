import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Agent, Project, Room, Task } from '../types'
import { createFocusSearch, type FocusKind } from '../lib/workbenchLinking'

type EvidenceObject =
  | { kind: 'project'; id: string; code: string; name: string }
  | { kind: 'agent'; id: string; code: string; name: string }
  | { kind: 'room'; id: string; code: string; name: string }
  | { kind: 'task'; id: string; code: string; name: string }

interface EvidenceSignals {
  projectSignals: string[]
  roomSignals: string[]
  taskSignals: string[]
  agentSignals: string[]
}

const PATHNAME_BY_KIND: Record<FocusKind, string> = {
  project: '/projects',
  agent: '/agents',
  room: '/rooms',
  task: '/tasks',
}

const normalize = (value?: string) => String(value ?? '').trim().toLowerCase()

const SIGNAL_MAP: Record<FocusKind, Record<string, string[]>> = {
  project: {
    'project-1': ['kotovela_official', 'yanfami_official', 'kotoharo_official', 'guoshituan_official', 'guoma970', 'material_case', 'layout_renovation', 'floor_heating', 'kitchen_storage', 'customer_followup', 'group_buy_material', 'consultant_'],
    'project-2': ['companion_prototype', 'room-cp-01'],
    'project-3': ['github_sync', 'github'],
    'project-4': ['knowledge_base_refresh', 'knowledge base'],
    'project-5': ['external_demo_assets', 'external demo'],
  },
  room: {
    'room-2': ['kotovela_official', 'yanfami_official', 'guoshituan_official', 'account_line', 'source_line', 'attribution=', 'consultant_id=', 'lead_id='],
    'room-3': ['audit_log', 'decision_log', 'system_mode', 'opensource mode', 'internal mode'],
    'room-4': ['layout_renovation', 'floor_heating', 'kitchen_storage', 'material_case'],
  },
  task: {
    'task-1': ['system_mode', 'guardrails', 'readonly'],
    'task-2': ['account_line', 'source_line', 'attribution=', 'consultant_id=', 'content_line', 'material_case', 'layout_renovation', 'floor_heating', 'kitchen_storage', 'customer_followup', 'group_buy_material'],
  },
  agent: {
    'agent-1': ['main', 'coordinator'],
    'agent-2': ['builder'],
    'agent-3': ['media', 'content'],
    'agent-5': ['business'],
  },
}

const includesToken = (haystack: string, needle?: string) => {
  const token = normalize(needle)
  return token.length > 0 && haystack.includes(token)
}

const parseStructuredSignals = (textParts: Array<string | undefined>): EvidenceSignals => {
  const joined = textParts.filter(Boolean).join(' | ')
  const normalizedText = normalize(joined)
  const captures = [...normalizedText.matchAll(/(?:^|[^a-z0-9_])(source_line|account_line|consultant_id|project_line|content_line|attribution|lead_id)=([^|,\s]+)/g)]
  const values = captures.map((match) => `${match[1]}=${match[2]}`)
  const attributionTokens = captures
    .filter((match) => match[1] === 'attribution')
    .flatMap((match) => match[2].split('/').map((token) => token.trim()).filter(Boolean))
  const rawTokens = joined
    .split(/[|,\n]/)
    .map((part) => normalize(part))
    .filter(Boolean)

  return {
    projectSignals: [...rawTokens, ...values, ...attributionTokens],
    roomSignals: [...rawTokens, ...values, ...attributionTokens],
    taskSignals: [...rawTokens, ...values, ...attributionTokens],
    agentSignals: [...rawTokens, ...values, ...attributionTokens],
  }
}

const matchesSignalMap = (kind: FocusKind, id: string, signals: string[]) => {
  const candidates = SIGNAL_MAP[kind][id] ?? []
  return candidates.some((token: string) => signals.some((signal) => includesToken(signal, token) || includesToken(token, signal)))
}

export function resolveEvidenceObjects({
  textParts,
  projects,
  agents,
  rooms,
  tasks,
  projectId,
  agentId,
  roomId,
  taskId,
}: {
  textParts: Array<string | undefined>
  projects: Project[]
  agents: Agent[]
  rooms: Room[]
  tasks: Task[]
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
}): EvidenceObject[] {
  const text = normalize(textParts.filter(Boolean).join(' | '))
  const signals = parseStructuredSignals(textParts)
  const items: EvidenceObject[] = []
  const seen = new Set<string>()

  const push = (item?: EvidenceObject) => {
    if (!item) return
    const key = `${item.kind}:${item.id}`
    if (seen.has(key)) return
    seen.add(key)
    items.push(item)
  }

  const matchProject = (project: Project) =>
    project.id === projectId
      || includesToken(text, project.id)
      || includesToken(text, project.code)
      || includesToken(text, project.name)
      || matchesSignalMap('project', project.id, signals.projectSignals)
  const matchAgent = (agent: Agent) =>
    agent.id === agentId
      || includesToken(text, agent.id)
      || includesToken(text, agent.code)
      || includesToken(text, agent.name)
      || includesToken(text, agent.instanceKey)
      || matchesSignalMap('agent', agent.id, signals.agentSignals)
  const matchRoom = (room: Room) =>
    room.id === roomId
      || includesToken(text, room.id)
      || includesToken(text, room.code)
      || includesToken(text, room.name)
      || matchesSignalMap('room', room.id, signals.roomSignals)
  const matchTask = (task: Task) =>
    task.id === taskId
      || includesToken(text, task.id)
      || includesToken(text, task.code)
      || includesToken(text, task.title)
      || matchesSignalMap('task', task.id, signals.taskSignals)

  projects.filter(matchProject).slice(0, 2).forEach((project) => push({ kind: 'project', id: project.id, code: project.code, name: project.name }))
  agents.filter(matchAgent).slice(0, 2).forEach((agent) => push({ kind: 'agent', id: agent.id, code: agent.code, name: agent.name }))
  rooms.filter(matchRoom).slice(0, 2).forEach((room) => push({ kind: 'room', id: room.id, code: room.code, name: room.name }))
  tasks.filter(matchTask).slice(0, 2).forEach((task) => push({ kind: 'task', id: task.id, code: task.code, name: task.title }))

  return items.slice(0, 4)
}

export function EvidenceObjectLinks({
  textParts,
  currentSearch,
  projects,
  agents,
  rooms,
  tasks,
  projectId,
  agentId,
  roomId,
  taskId,
}: {
  textParts: Array<string | undefined>
  currentSearch?: string
  projects: Project[]
  agents: Agent[]
  rooms: Room[]
  tasks: Task[]
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
}) {
  const items = useMemo(
    () =>
      resolveEvidenceObjects({ textParts, projects, agents, rooms, tasks, projectId, agentId, roomId, taskId }),
    [textParts, currentSearch, projects, agents, rooms, tasks, projectId, agentId, roomId, taskId],
  )

  if (!items.length) return null

  return (
    <div className="cross-link-row top-gap evidence-link-row">
      {items.map((item) => (
        <Link
          key={`${item.kind}:${item.id}`}
          className="inline-link-chip"
          to={{ pathname: PATHNAME_BY_KIND[item.kind], search: createFocusSearch(currentSearch, item.kind, item.id) }}
        >
          {item.kind}: {item.name}
        </Link>
      ))}
    </div>
  )
}
