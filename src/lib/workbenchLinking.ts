import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Agent, Project, Room, Task } from '../types'

export type FocusKind = 'project' | 'agent' | 'room' | 'task'

export interface FocusState {
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
}

export interface RelationScope {
  projectIds: Set<string>
  agentIds: Set<string>
  roomIds: Set<string>
  taskIds: Set<string>
}

const focusParamMap: Record<FocusKind, keyof FocusState> = {
  project: 'projectId',
  agent: 'agentId',
  room: 'roomId',
  task: 'taskId',
}

export function parseFocusFromSearchParams(searchParams: URLSearchParams): FocusState {
  const focusType = searchParams.get('focusType') as FocusKind | null
  const focusId = searchParams.get('focusId') ?? undefined

  if (focusType && focusId && focusType in focusParamMap) {
    return { [focusParamMap[focusType]]: focusId }
  }

  return {
    projectId: searchParams.get('project') ?? undefined,
    agentId: searchParams.get('agent') ?? undefined,
    roomId: searchParams.get('room') ?? undefined,
    taskId: searchParams.get('task') ?? undefined,
  }
}

export function getFocusTarget(focus: FocusState): { type: FocusKind; id: string } | undefined {
  if (focus.projectId) return { type: 'project', id: focus.projectId }
  if (focus.agentId) return { type: 'agent', id: focus.agentId }
  if (focus.roomId) return { type: 'room', id: focus.roomId }
  if (focus.taskId) return { type: 'task', id: focus.taskId }
  return undefined
}

export function createFocusSearch(
  currentSearchParams: URLSearchParams | string | undefined,
  focusType?: FocusKind,
  focusId?: string,
) {
  const base = typeof currentSearchParams === 'string'
    ? new URLSearchParams(currentSearchParams)
    : new URLSearchParams(currentSearchParams)

  base.delete('project')
  base.delete('agent')
  base.delete('room')
  base.delete('task')
  base.delete('focusType')
  base.delete('focusId')

  if (focusType && focusId) {
    base.set('focusType', focusType)
    base.set('focusId', focusId)
  }

  const next = base.toString()
  return next ? `?${next}` : ''
}

export function buildRelationScope(
  focus: FocusState,
  data: { projects: Project[]; agents: Agent[]; rooms: Room[]; tasks: Task[] },
): RelationScope {
  const scope: RelationScope = {
    projectIds: new Set<string>(),
    agentIds: new Set<string>(),
    roomIds: new Set<string>(),
    taskIds: new Set<string>(),
  }

  const includeProject = (projectId?: string) => {
    if (!projectId) return
    scope.projectIds.add(projectId)

    data.agents.filter((agent) => agent.projectId === projectId).forEach((agent) => scope.agentIds.add(agent.id))
    data.rooms.filter((room) => room.mainProjectId === projectId).forEach((room) => scope.roomIds.add(room.id))
    data.tasks.filter((task) => task.projectId === projectId).forEach((task) => scope.taskIds.add(task.id))
  }

  const includeAgent = (agentId?: string) => {
    if (!agentId) return
    const agent = data.agents.find((item) => item.id === agentId)
    if (!agent) return

    scope.agentIds.add(agent.id)
    includeProject(agent.projectId)
    data.rooms
      .filter((room) => room.instanceIds.includes(agent.id))
      .forEach((room) => scope.roomIds.add(room.id))
    data.tasks
      .filter(
        (task) => task.executorAgentId === agent.id || task.assigneeAgentId === agent.id,
      )
      .forEach((task) => scope.taskIds.add(task.id))
  }

  const includeRoom = (roomId?: string) => {
    if (!roomId) return
    const room = data.rooms.find((item) => item.id === roomId)
    if (!room) return

    scope.roomIds.add(room.id)
    includeProject(room.mainProjectId)
    room.instanceIds.forEach((agentId) => includeAgent(agentId))
  }

  const includeTask = (taskId?: string) => {
    if (!taskId) return
    const task = data.tasks.find((item) => item.id === taskId)
    if (!task) return

    scope.taskIds.add(task.id)
    includeProject(task.projectId)
    includeAgent(task.executorAgentId)
  }

  if (focus.projectId) includeProject(focus.projectId)
  if (focus.agentId) includeAgent(focus.agentId)
  if (focus.roomId) includeRoom(focus.roomId)
  if (focus.taskId) includeTask(focus.taskId)

  return scope
}

export function useWorkbenchLinking(data: {
  projects: Project[]
  agents: Agent[]
  rooms: Room[]
  tasks: Task[]
}) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const focus = useMemo<FocusState>(() => parseFocusFromSearchParams(searchParams), [searchParams])

  const relationScope = useMemo(() => buildRelationScope(focus, data), [focus, data])

  const hasFocus = Boolean(focus.projectId || focus.agentId || focus.roomId || focus.taskId)

  const getState = (kind: FocusKind, id: string) => {
    const paramKey = focusParamMap[kind]
    const isSelected = focus[paramKey] === id
    const isRelated = relationScope[`${kind}Ids` as keyof RelationScope] instanceof Set
      ? (relationScope[`${kind}Ids` as keyof RelationScope] as Set<string>).has(id)
      : false
    const isDimmed = hasFocus && !isSelected && !isRelated
    return { isSelected, isRelated, isDimmed }
  }

  const select = (kind: FocusKind, id: string) => {
    navigate(
      { search: createFocusSearch(searchParams, kind, id) },
      { replace: true, preventScrollReset: true },
    )
  }

  const clear = () => {
    navigate(
      { search: createFocusSearch(searchParams) },
      { replace: true, preventScrollReset: true },
    )
  }

  return { focus, relationScope, hasFocus, getState, select, clear, currentSearch: createFocusSearch(searchParams) }
}

export function getFocusSummary(
  focus: FocusState,
  data: { projects: Project[]; agents: Agent[]; rooms: Room[]; tasks: Task[] },
) {
  if (focus.projectId) {
    const item = data.projects.find((project) => project.id === focus.projectId)
    return item ? { label: '当前联动项目', value: item.name } : undefined
  }

  if (focus.agentId) {
    const item = data.agents.find((agent) => agent.id === focus.agentId)
    return item ? { label: '当前联动实例', value: item.name } : undefined
  }

  if (focus.roomId) {
    const item = data.rooms.find((room) => room.id === focus.roomId)
    return item ? { label: '当前联动群/房间', value: item.name } : undefined
  }

  if (focus.taskId) {
    const item = data.tasks.find((task) => task.id === focus.taskId)
    return item ? { label: '当前联动任务', value: item.title } : undefined
  }

  return undefined
}
