import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Agent, Project, Room, Task } from '../types'
import { createFocusSearch, type FocusKind } from '../lib/workbenchLinking'

type EvidenceObject =
  | { kind: 'project'; id: string; code: string; name: string }
  | { kind: 'agent'; id: string; code: string; name: string }
  | { kind: 'room'; id: string; code: string; name: string }
  | { kind: 'task'; id: string; code: string; name: string }

const PATHNAME_BY_KIND: Record<FocusKind, string> = {
  project: '/projects',
  agent: '/agents',
  room: '/rooms',
  task: '/tasks',
}

const normalize = (value?: string) => String(value ?? '').trim().toLowerCase()

const includesToken = (haystack: string, needle?: string) => {
  const token = normalize(needle)
  return token.length > 0 && haystack.includes(token)
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
    project.id === projectId || includesToken(text, project.id) || includesToken(text, project.code) || includesToken(text, project.name)
  const matchAgent = (agent: Agent) =>
    agent.id === agentId || includesToken(text, agent.id) || includesToken(text, agent.code) || includesToken(text, agent.name) || includesToken(text, agent.instanceKey)
  const matchRoom = (room: Room) =>
    room.id === roomId || includesToken(text, room.id) || includesToken(text, room.code) || includesToken(text, room.name)
  const matchTask = (task: Task) =>
    task.id === taskId || includesToken(text, task.id) || includesToken(text, task.code) || includesToken(text, task.title)

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
