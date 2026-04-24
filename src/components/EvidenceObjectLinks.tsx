import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Agent, Project, Room, Task } from '../types'
import { inferStructuredSignalBucket } from '../lib/evidenceDriftBucket'
import { createFocusSearch, type FocusKind } from '../lib/workbenchLinking'

type EvidenceObject =
  | { kind: 'project'; id: string; code: string; name: string }
  | { kind: 'agent'; id: string; code: string; name: string }
  | { kind: 'room'; id: string; code: string; name: string }
  | { kind: 'task'; id: string; code: string; name: string }

export type EvidenceMatchSource =
  | 'none'
  | 'direct_id'
  | 'direct_name'
  | 'signal_map_account'
  | 'signal_map_room'
  | 'signal_map_content'
  | 'signal_map_only'
export type EvidenceMatchConfidence = 'none' | 'low' | 'medium' | 'high'

export interface EvidenceResolutionResult {
  items: EvidenceObject[]
  matchSource: EvidenceMatchSource
  matchConfidence: EvidenceMatchConfidence
}

interface EvidenceSignals {
  projectSignals: string[]
  roomSignals: string[]
  taskSignals: string[]
  agentSignals: string[]
  accountSignals: string[]
  roomSourceSignals: string[]
  contentSignals: string[]
}

export interface EvidenceRoutingHints {
  projectIds?: Array<string | undefined>
  roomIds?: Array<string | undefined>
  taskIds?: Array<string | undefined>
  agentIds?: Array<string | undefined>
  projectSignals?: Array<string | undefined>
  roomSignals?: Array<string | undefined>
  taskSignals?: Array<string | undefined>
  agentSignals?: Array<string | undefined>
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
  const accountSignals = captures
    .filter((match) => match[1] === 'account_line' || match[1] === 'attribution')
    .flatMap((match) => [match[2], `${match[1]}=${match[2]}`])
    .concat(attributionTokens)
  const roomSourceSignals = captures
    .filter((match) => match[1] === 'source_line' || match[1] === 'lead_id')
    .flatMap((match) => [match[2], `${match[1]}=${match[2]}`])
  const contentSignals = captures
    .filter((match) => match[1] === 'content_line' || match[1] === 'project_line')
    .flatMap((match) => [match[2], `${match[1]}=${match[2]}`])
  const rawTokens = joined
    .split(/[|,\n]/)
    .map((part) => normalize(part))
    .filter(Boolean)

  return {
    projectSignals: [...rawTokens, ...values, ...attributionTokens],
    roomSignals: [...rawTokens, ...values, ...attributionTokens],
    taskSignals: [...rawTokens, ...values, ...attributionTokens],
    agentSignals: [...rawTokens, ...values, ...attributionTokens],
    accountSignals: accountSignals.map((part) => normalize(part)).filter(Boolean),
    roomSourceSignals: roomSourceSignals.map((part) => normalize(part)).filter(Boolean),
    contentSignals: contentSignals.map((part) => normalize(part)).filter(Boolean),
  }
}

const matchesSignalMap = (kind: FocusKind, id: string, signals: string[]) => {
  const candidates = SIGNAL_MAP[kind][id] ?? []
  return candidates.some((token: string) => signals.some((signal) => includesToken(signal, token) || includesToken(token, signal)))
}

const normalizeList = (values: Array<string | undefined> = []) => values.map((value) => normalize(value)).filter(Boolean)

const includesAnyToken = (signals: string[], candidates: string[]) =>
  candidates.some((candidate) => signals.some((signal) => includesToken(signal, candidate) || includesToken(candidate, signal)))

export function resolveEvidenceObjects({
  textParts,
  signalParts = [],
  projects,
  agents,
  rooms,
  tasks,
  projectId,
  agentId,
  roomId,
  taskId,
  routingHints,
}: {
  textParts: Array<string | undefined>
  signalParts?: Array<string | undefined>
  projects: Project[]
  agents: Agent[]
  rooms: Room[]
  tasks: Task[]
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
  routingHints?: EvidenceRoutingHints
}): EvidenceObject[] {
  return resolveEvidenceMatch({ textParts, signalParts, projects, agents, rooms, tasks, projectId, agentId, roomId, taskId, routingHints }).items
}

export function resolveEvidenceMatch({
  textParts,
  signalParts = [],
  projects,
  agents,
  rooms,
  tasks,
  projectId,
  agentId,
  roomId,
  taskId,
  routingHints,
}: {
  textParts: Array<string | undefined>
  signalParts?: Array<string | undefined>
  projects: Project[]
  agents: Agent[]
  rooms: Room[]
  tasks: Task[]
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
  routingHints?: EvidenceRoutingHints
}): EvidenceResolutionResult {
  const allTextParts = [...textParts, ...signalParts]
  const text = normalize(allTextParts.filter(Boolean).join(' | '))
  const signals = parseStructuredSignals(allTextParts)
  const projectHints = new Set(normalizeList([projectId, ...(routingHints?.projectIds ?? []), ...(routingHints?.projectSignals ?? [])]))
  const agentHints = new Set(normalizeList([agentId, ...(routingHints?.agentIds ?? []), ...(routingHints?.agentSignals ?? [])]))
  const roomHints = new Set(normalizeList([roomId, ...(routingHints?.roomIds ?? []), ...(routingHints?.roomSignals ?? [])]))
  const taskHints = new Set(normalizeList([taskId, ...(routingHints?.taskIds ?? []), ...(routingHints?.taskSignals ?? [])]))
  const items: EvidenceObject[] = []
  const seen = new Set<string>()
  let hasDirectIdMatch = false
  let hasDirectNameMatch = false

  const directIdTokens = new Set([
    ...projects.flatMap((item) => [item.id, item.code]),
    ...agents.flatMap((item) => [item.id, item.code]),
    ...rooms.flatMap((item) => [item.id, item.code]),
    ...tasks.flatMap((item) => [item.id, item.code]),
    projectId,
    agentId,
    roomId,
    taskId,
    ...(routingHints?.projectIds ?? []),
    ...(routingHints?.agentIds ?? []),
    ...(routingHints?.roomIds ?? []),
    ...(routingHints?.taskIds ?? []),
  ].map((item) => normalize(item)).filter(Boolean))

  const directNameTokens = new Set([
    ...projects.map((item) => item.name),
    ...agents.flatMap((item) => [item.name, item.instanceKey]),
    ...rooms.map((item) => item.name),
    ...tasks.map((item) => item.title),
    ...(routingHints?.projectSignals ?? []),
    ...(routingHints?.agentSignals ?? []),
    ...(routingHints?.roomSignals ?? []),
    ...(routingHints?.taskSignals ?? []),
  ].map((item) => normalize(item)).filter(Boolean))

  for (const token of directIdTokens) {
    if (includesToken(text, token) || includesToken(token, text)) {
      hasDirectIdMatch = true
      break
    }
  }

  if (!hasDirectIdMatch) {
    for (const token of directNameTokens) {
      if (includesToken(text, token) || includesToken(token, text)) {
        hasDirectNameMatch = true
        break
      }
    }
  }

  const push = (item?: EvidenceObject) => {
    if (!item) return
    const key = `${item.kind}:${item.id}`
    if (seen.has(key)) return
    seen.add(key)
    items.push(item)
  }

  const matchProject = (project: Project) =>
    projectHints.has(normalize(project.id))
      || projectHints.has(normalize(project.code))
      || projectHints.has(normalize(project.name))
      || includesToken(text, project.id)
      || includesToken(text, project.code)
      || includesToken(text, project.name)
      || matchesSignalMap('project', project.id, [...signals.projectSignals, ...projectHints])
  const matchAgent = (agent: Agent) =>
    agentHints.has(normalize(agent.id))
      || agentHints.has(normalize(agent.code))
      || agentHints.has(normalize(agent.name))
      || agentHints.has(normalize(agent.instanceKey))
      || includesToken(text, agent.id)
      || includesToken(text, agent.code)
      || includesToken(text, agent.name)
      || includesToken(text, agent.instanceKey)
      || matchesSignalMap('agent', agent.id, [...signals.agentSignals, ...agentHints])
  const matchRoom = (room: Room) =>
    roomHints.has(normalize(room.id))
      || roomHints.has(normalize(room.code))
      || roomHints.has(normalize(room.name))
      || includesToken(text, room.id)
      || includesToken(text, room.code)
      || includesToken(text, room.name)
      || matchesSignalMap('room', room.id, [...signals.roomSignals, ...roomHints])
  const matchTask = (task: Task) =>
    taskHints.has(normalize(task.id))
      || taskHints.has(normalize(task.code))
      || taskHints.has(normalize(task.title))
      || includesToken(text, task.id)
      || includesToken(text, task.code)
      || includesToken(text, task.title)
      || matchesSignalMap('task', task.id, [...signals.taskSignals, ...taskHints])

  projects.filter(matchProject).slice(0, 2).forEach((project) => push({ kind: 'project', id: project.id, code: project.code, name: project.name }))
  agents.filter(matchAgent).slice(0, 2).forEach((agent) => push({ kind: 'agent', id: agent.id, code: agent.code, name: agent.name }))
  rooms.filter(matchRoom).slice(0, 2).forEach((room) => push({ kind: 'room', id: room.id, code: room.code, name: room.name }))
  tasks.filter(matchTask).slice(0, 2).forEach((task) => push({ kind: 'task', id: task.id, code: task.code, name: task.title }))

  const resolvedItems = items.slice(0, 4)
  const signalMapSource: EvidenceMatchSource = (() => {
    const projectTokens = Object.values(SIGNAL_MAP.project).flat()
    const roomTokens = Object.values(SIGNAL_MAP.room).flat()
    const taskTokens = Object.values(SIGNAL_MAP.task).flat()
    const inferredBucket = inferStructuredSignalBucket(signalParts.filter((part): part is string => Boolean(part)))
    const accountDrift = includesAnyToken(signals.accountSignals, [...projectTokens, ...roomTokens, ...taskTokens])
    const roomDrift = includesAnyToken(signals.roomSourceSignals, [...roomTokens, ...taskTokens])
    const contentDrift = includesAnyToken(signals.contentSignals, [...projectTokens, ...roomTokens, ...taskTokens])

    if (inferredBucket === 'signal_map_room' && roomDrift) return 'signal_map_room'
    if (inferredBucket === 'signal_map_content' && contentDrift) return 'signal_map_content'
    if (inferredBucket === 'signal_map_account' && accountDrift) return 'signal_map_account'
    if (roomDrift) return 'signal_map_room'
    if (contentDrift) return 'signal_map_content'
    if (accountDrift) return 'signal_map_account'
    return 'signal_map_only'
  })()
  const matchSource: EvidenceMatchSource = resolvedItems.length === 0
    ? 'none'
    : hasDirectIdMatch
      ? 'direct_id'
      : hasDirectNameMatch
        ? 'direct_name'
        : signalMapSource
  const matchConfidence: EvidenceMatchConfidence = matchSource === 'direct_id'
    ? 'high'
    : matchSource === 'direct_name'
      ? 'medium'
      : matchSource === 'signal_map_account' || matchSource === 'signal_map_room' || matchSource === 'signal_map_content' || matchSource === 'signal_map_only'
        ? 'low'
        : 'none'

  return { items: resolvedItems, matchSource, matchConfidence }
}

export function EvidenceObjectLinks({
  textParts,
  signalParts = [],
  currentSearch,
  projects,
  agents,
  rooms,
  tasks,
  projectId,
  agentId,
  roomId,
  taskId,
  routingHints,
}: {
  textParts: Array<string | undefined>
  signalParts?: Array<string | undefined>
  currentSearch?: string
  projects: Project[]
  agents: Agent[]
  rooms: Room[]
  tasks: Task[]
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
  routingHints?: EvidenceRoutingHints
}) {
  const items = useMemo(
    () =>
      resolveEvidenceObjects({ textParts, signalParts, projects, agents, rooms, tasks, projectId, agentId, roomId, taskId, routingHints }),
    [textParts, signalParts, currentSearch, projects, agents, rooms, tasks, projectId, agentId, roomId, taskId, routingHints],
  )

  if (!items.length) return null

  return (
    <div className="cross-link-row top-gap evidence-link-row" data-evidence-links="true">
      {items.map((item) => (
        <Link
          key={`${item.kind}:${item.id}`}
          className="inline-link-chip"
          data-evidence-link="true"
          to={{ pathname: PATHNAME_BY_KIND[item.kind], search: createFocusSearch(currentSearch, item.kind, item.id) }}
        >
          {item.kind}: {item.name}
        </Link>
      ))}
    </div>
  )
}
