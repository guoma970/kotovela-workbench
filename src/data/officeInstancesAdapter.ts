import type { Agent, Project, Room, Task } from '../types'

export type OfficeInstanceStatus = 'doing' | 'done' | 'blocker' | 'idle' | 'active' | 'blocked'

/**
 * 后端状态到前端状态语义的规范映射（最小闭环）。
 * 规则：
 * - doing/in_progress/running -> doing
 * - blocker/blocked/error -> blocker
 * - done/done_ok/finished -> done
 * - active/online/busy -> active
 * - idle/offline -> idle
 * - 兜底 -> idle，避免将未知状态误判为 blocker
 */

/** Fallback status sentences keyed by normalized status. */
const STATUS_SENTENCE: Record<string, string> = {
  doing: '正在推进关键动作，等待下游确认。',
  blocker: '检测到阻塞信号，等待状态回归。',
  done: '当前未有阻塞，任务链路平稳。',
  active: '正在推进关键动作，等待下游确认。',
  idle: '当前未有阻塞，任务链路平稳。',
  blocked: '检测到阻塞信号，等待状态回归。',
}

const unknownStatusSentence = '当前未有阻塞，任务链路平稳。'

export function getStatusSentence(status: string): string {
  const key = status?.toLowerCase()
  return key && STATUS_SENTENCE[key] ? STATUS_SENTENCE[key] : unknownStatusSentence
}

export interface OfficeInstanceItem {
  key: string
  name?: string
  role?: string
  status?: string
  task?: string
  currentTask?: string
  updatedAt?: string
  ageMs?: number | string
  ageText?: string
  note?: string
  projectRelated?: string
  [key: string]: unknown
}

export interface OfficeInstancesResponse {
  instances?: OfficeInstanceItem[]
}

export interface OfficeInstanceStat {
  total: number
  doing: number
  blocked: number
  done: number
  active: number
  idle: number
}

export interface SyncedAgentResult {
  agents: Agent[]
  stats: OfficeInstanceStat
  hasRealData: boolean
}

export interface SyncedProjectResult {
  projects: Project[]
  hasRealData: boolean
}

export interface SyncedRoomResult {
  rooms: Room[]
  hasRealData: boolean
}

export interface SyncedTaskResult {
  tasks: Task[]
  hasRealData: boolean
}

const OFFICE_AGENT_ID_MAP: Record<string, string> = {
  main: 'agent-1',
  builder: 'agent-2',
  media: 'agent-3',
  family: 'agent-4',
  business: 'agent-5',
  ztl970: 'agent-6',
}

const OFFICE_AGENT_CODE_MAP: Record<string, string> = {
  main: 'INS-01',
  builder: 'INS-02',
  media: 'INS-03',
  family: 'INS-04',
  business: 'INS-05',
  ztl970: 'INS-06',
}

const PROJECT_NAME_HINTS: Record<string, string> = {
  kotovela: 'project-1',
  主项目: 'project-1',
  群助手: 'project-1',
  '羲果陪伴': 'project-2',
  'github 同步': 'project-3',
  github同步: 'project-3',
  'clawhub 内容沉淀': 'project-4',
  '对外演示素材': 'project-5',
}

const FALLBACK_PROJECT_ID = 'project-1'

const normalizeStatus = (value?: string): OfficeInstanceStatus => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''

  if (['doing', 'in_progress', 'progress', 'running'].includes(normalized)) {
    return 'doing'
  }

  if (['done', 'done_ok', 'finished', 'complete', 'completed'].includes(normalized)) {
    return 'done'
  }

  if (['blocker', 'blocked', 'error', 'critical'].includes(normalized)) {
    return 'blocker'
  }

  if (['active', 'online', 'busy'].includes(normalized)) {
    return 'active'
  }

  if (['idle', 'offline', 'unassigned', 'unknown'].includes(normalized)) {
    return 'idle'
  }

  return 'idle'
}

const pickString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return fallback
}

const normalizeTextId = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

const pickFirstStringFromValues = (values: unknown[], fallback = ''): string => {
  for (const value of values) {
    const picked = pickString(value)
    if (picked) return picked
  }

  return fallback
}

const pickFirstIdFromValues = (values: unknown[]): string | undefined => {
  for (const value of values) {
    const direct = normalizeTextId(value)
    if (direct) return direct

    if (typeof value === 'object' && value !== null) {
      const nested = value as Record<string, unknown>

      const nestedId =
        normalizeTextId(nested.id) ||
        normalizeTextId(nested.key) ||
        normalizeTextId((nested as { taskId?: unknown }).taskId) ||
        normalizeTextId((nested as { projectId?: unknown }).projectId)

      if (nestedId) return nestedId

      const nestedName =
        normalizeTextId(nested.name) ||
        normalizeTextId((nested as { title?: unknown }).title)
      if (nestedName) {
        // 回退到名称语义映射（只用于已知主项目名）
        const hintKey = nestedName.trim().toLowerCase()
        if (PROJECT_NAME_HINTS[hintKey]) {
          return PROJECT_NAME_HINTS[hintKey]
        }
      }
    }

    if (Array.isArray(value)) {
      const arrVal = value.map((v) => normalizeTextId(v)).find(Boolean)
      if (arrVal) return arrVal
    }
  }

  return undefined
}

const toAgentStatus = (status: OfficeInstanceStatus): Agent['status'] => {
  switch (status) {
    case 'doing':
      return 'active'
    case 'done':
      return 'idle'
    case 'active':
      return 'active'
    case 'blocker':
    case 'blocked':
      return 'blocked'
    case 'idle':
      return 'idle'
    default:
      return 'idle'
  }
}

const toProjectStatus = (status: OfficeInstanceStatus): Project['status'] => {
  switch (status) {
    case 'doing':
    case 'active':
      return 'active'
    case 'blocker':
    case 'blocked':
      return 'blocked'
    default:
      return 'planning'
  }
}

const toRoomStatus = (status: OfficeInstanceStatus): Room['status'] => {
  switch (status) {
    case 'doing':
    case 'active':
      return 'active'
    case 'blocker':
    case 'blocked':
      return 'blocked'
    default:
      return 'quiet'
  }
}

const toTaskStatus = (status: OfficeInstanceStatus): Task['status'] => {
  switch (status) {
    case 'doing':
    case 'active':
      return 'doing'
    case 'blocker':
    case 'blocked':
      return 'blocked'
    case 'done':
      return 'done'
    default:
      return 'todo'
  }
}

const toTaskPriority = (index: number): Task['priority'] => {
  const priorities: Task['priority'][] = ['high', 'medium', 'low']
  return priorities[index % priorities.length]
}

const getAgentIdByInstance = (item: OfficeInstanceItem, fallback = 'agent-1'): string => {
  const key = item.key?.trim()
  if (!key) return fallback
  return OFFICE_AGENT_ID_MAP[key] ?? `office-${key.toLowerCase()}`
}

const getAssigneeAgentIdByTask = (item: OfficeInstanceItem): string => {
  const explicit = pickFirstIdFromValues([
    (item as Record<string, unknown>).assigneeAgentId,
    (item as Record<string, unknown>).executorAgentId,
    (item as Record<string, unknown>).agentId,
  ])

  return explicit ? `agent-${explicit}`.replace(/^agent-agent-/, 'agent-') : getAgentIdByInstance(item)
}

const mapProjectHintToId = (value: unknown): string | undefined => {
  const text = pickString(value)
  if (!text) return undefined
  return PROJECT_NAME_HINTS[text.toLowerCase()] || PROJECT_NAME_HINTS[text]
}

const asObject = (value: unknown): Record<string, unknown> | undefined => {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined
}

const getProjectIdFromInstance = (item: OfficeInstanceItem, index: number): string => {
  const source = item as Record<string, unknown>

  const explicitProjectId = pickFirstIdFromValues([
    source.projectId,
    source.project_id,
    source.mainProjectId,
    asObject(source.project)?.id,
    asObject(source.project)?.key,
    source.project_code,
    source.projectCode,
    asObject(source.mainProject)?.id,
    source.mainProjectId,
    source.relatedProjectId,
  ])

  if (explicitProjectId) {
    return explicitProjectId
  }

  const explicitProjectName = pickFirstStringFromValues([
    pickString(source.project),
    pickString(source.projectName),
    pickString(source.mainProject),
    pickString(source.projectTitle),
    pickString(source.title),
  ])

  const hinted = mapProjectHintToId(explicitProjectName)
  if (hinted) {
    return hinted
  }

  const key = item.key?.trim()
  return key ? `project-${key}` : `project-${index + 1}`
}

const getRoomIdFromInstance = (item: OfficeInstanceItem, index: number): string => {
  const source = item as Record<string, unknown>

  const explicitRoomId = pickFirstIdFromValues([
    source.roomId,
    source.room_id,
    source.mainRoomId,
    source.main_room_id,
    asObject(source.room)?.id,
    asObject(source.room)?.key,
    asObject(source.mainRoom)?.id,
    asObject(source.mainRoom)?.key,
  ])

  if (explicitRoomId) {
    return explicitRoomId
  }

  const roomCode = pickFirstStringFromValues([pickString(source.roomCode), pickString(source.mainRoomCode)])
  if (roomCode) {
    return `room-${roomCode.replace(/\s+/g, '-')}`
  }

  const key = item.key?.trim()
  return key ? `room-${key}` : `room-${index + 1}`
}

const getTaskIdFromInstance = (item: OfficeInstanceItem, index: number): string => {
  const source = item as Record<string, unknown>

  const explicitTaskId = pickFirstIdFromValues([
    source.taskId,
    source.task_id,
    source.mainTaskId,
    source.main_task_id,
    source.id,
    source.code,
    (source.task as Record<string, unknown>)?.id,
    (source.task as Record<string, unknown>)?.key,
    (source.taskInfo as Record<string, unknown>)?.id,
  ])

  if (explicitTaskId) {
    return explicitTaskId
  }

  const code = pickString(source.taskCode || source.task_name)
  if (code) {
    return `task-${code.replace(/^TSK-?/i, '').trim() ? code.trim() : code}`
  }

  const key = item.key?.trim()
  return key ? `task-${key}` : `task-${index + 1}`
}

const parseInstanceArrayIds = (value: unknown, fallbackPrefix: string, index: number): string[] => {
  if (Array.isArray(value)) {
    const ids = value
      .map((entry) => {
        const text = pickFirstIdFromValues([entry])
        return text
      })
      .filter((entry): entry is string => Boolean(entry))

    if (ids.length > 0) {
      return ids
    }
  }

  if (typeof value === 'string') {
    const text = value.trim()
    if (text) {
      return text
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((itemId) => `${fallbackPrefix}-${itemId}`)
    }
  }

  return [`${fallbackPrefix}-${index + 1}`]
}

const buildFallbackAgent = (key: string, fallbackAgents: Agent[]): Agent | undefined => {
  const mappedId = OFFICE_AGENT_ID_MAP[key]
  if (!mappedId) {
    return undefined
  }

  return fallbackAgents.find((item) => item.id === mappedId)
}

export function parseOfficeInstancesPayload(payload: unknown): OfficeInstanceItem[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const root = payload as { instances?: unknown }
  const raw = Array.isArray(root.instances) ? root.instances : []

  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .filter((item): item is OfficeInstanceItem => {
      return typeof item === 'object' && item !== null
    })
    .map((item) => {
      const asItem = item as OfficeInstanceItem

      return {
        ...asItem,
        key: pickString(asItem.key),
        name: pickString(asItem.name),
        role: pickString(asItem.role),
        status: pickString(asItem.status),
        task: pickString(asItem.task),
        currentTask: pickString(asItem.currentTask),
        updatedAt: pickString(asItem.updatedAt),
        ageText: pickString(asItem.ageText),
      }
    })
}

export const syncOfficeInstancesToAgents = (
  instances: OfficeInstanceItem[] | undefined,
  fallbackAgents: Agent[],
): SyncedAgentResult => {
  if (!Array.isArray(instances) || instances.length === 0) {
    const fallbackStat = fallbackAgents.reduce(
      (acc, item) => {
        acc.total += 1
        if (item.status === 'active') acc.active += 1
        if (item.status === 'idle') acc.idle += 1
        if (item.status === 'blocked') acc.blocked += 1
        return acc
      },
      { total: 0, doing: 0, blocked: 0, done: 0, active: 0, idle: 0 } as OfficeInstanceStat,
    )

    return { agents: fallbackAgents, stats: fallbackStat, hasRealData: false }
  }

  const syncedAgents = instances.map((item) => {
    const key = item.key?.trim()
    const source = item as Record<string, unknown>
    const fallbackAgent = key ? buildFallbackAgent(key, fallbackAgents) : undefined
    const projectName = pickString(source.projectName || source.project || source.mainProject)

    return {
      ...fallbackAgent,
      id: fallbackAgent?.id ?? `office-${key || 'unknown'}`,
      code: fallbackAgent?.code ?? OFFICE_AGENT_CODE_MAP[key ?? ''] ?? key?.toUpperCase() ?? 'INS-00',
      name: item.name || fallbackAgent?.name || `实例 ${key || 'unknown'}`,
      role: item.role || fallbackAgent?.role || '未设置角色',
      status: toAgentStatus(normalizeStatus(item.status)),
      currentTask: pickString(source.currentTask) || pickString(source.current_task) || item.task || fallbackAgent?.currentTask || '暂无任务',
      project: projectName || fallbackAgent?.project || 'KOTOVELA',
      projectId: pickFirstIdFromValues([source.projectId, source.project_id]) || fallbackAgent?.projectId || FALLBACK_PROJECT_ID,
      updatedAt: pickString(source.ageText || source.updatedAt || source.updatedAtText, fallbackAgent?.updatedAt || '刚刚'),
    }
  })

  const normalizedItems = instances.map((item) => normalizeStatus(item.status))

  const realStat = syncedAgents.reduce(
    (acc, item) => {
      acc.total += 1
      if (item.status === 'active') acc.active += 1
      if (item.status === 'idle') acc.idle += 1
      if (item.status === 'blocked') acc.blocked += 1
      return acc
    },
    { total: 0, doing: 0, blocked: 0, done: 0, active: 0, idle: 0 } as OfficeInstanceStat,
  )

  normalizedItems.forEach((status) => {
    if (status === 'doing') realStat.doing += 1
    if (status === 'done') realStat.done += 1
    if (status === 'blocker') realStat.blocked += 1
  })

  return { agents: syncedAgents, stats: realStat, hasRealData: true }
}

export const syncProjectsFromInstances = (
  instances: OfficeInstanceItem[] | undefined,
  fallbackProjects: Project[],
): SyncedProjectResult => {
  if (!Array.isArray(instances) || instances.length === 0) {
    return { projects: fallbackProjects, hasRealData: false }
  }

  const projects: Project[] = instances.map((item, index) => {
    const source = item as Record<string, unknown>
    const normalized = normalizeStatus(item.status)
    const projectId = getProjectIdFromInstance(item, index)
    const projectName = pickFirstStringFromValues([
      pickString(source.projectName),
      pickString(source.project),
      pickString(source.mainProject),
      pickString(item.name, ''),
      `实例 ${item.key || index + 1}`,
    ], '未命名项目')
    const ownerAgentId = getAssigneeAgentIdByTask(item)
    const roomId = getRoomIdFromInstance(item, index)

    const progressRaw =
      typeof source.progress === 'number' ? source.progress : Number.parseInt(pickString(source.progress), 10)
    const taskCountRaw =
      typeof source.taskCount === 'number'
        ? source.taskCount
        : Number.parseInt(pickString(source.taskCount), 10)

    const owner = pickFirstStringFromValues([
      pickString(source.owner),
      pickString(source.ownerName),
      pickString(source.lead),
      item.role,
    ], '实例负责人')

    const roomHint = pickFirstStringFromValues([
      pickString(source.roomName),
      pickString(source.mainRoom),
      pickString(source.group),
    ])

    return {
      id: projectId,
      code: pickFirstStringFromValues(
        [
          pickString(source.projectCode),
          pickString(source.code),
          `PRJ-${projectId.slice(-3).toUpperCase()}`,
        ],
        `PRJ-${projectId.slice(-3).toUpperCase()}`,
      ),
      name: projectName,
      owner,
      ownerAgentId,
      status: toProjectStatus(normalized),
      progress: Number.isFinite(progressRaw) ? Math.min(100, Math.max(0, progressRaw)) : 20,
      focus: pickFirstStringFromValues(
        [
          pickString(source.focus),
          pickString(source.goal),
          item.task,
          item.currentTask,
          '与实例状态同步',
        ],
        '与实例状态同步',
      ),
      blockers: normalized === 'blocker' ? 1 : 0,
      stage: pickFirstStringFromValues(
        [
          pickString(source.stage),
          pickString(source.phase),
          pickString(source.statusText),
          '运行态',
        ],
        '运行态',
      ),
      nextStep: pickFirstStringFromValues(
        [
          pickString(source.nextStep),
          pickString(source.next),
          roomHint,
          item.currentTask,
          '等待任务推进',
        ],
        '等待任务推进',
      ),
      taskCount: Number.isFinite(taskCountRaw) ? taskCountRaw : item.task || item.currentTask ? 1 : 0,
      roomIds: [roomId],
    }
  })

  return { projects: projects, hasRealData: true }
}

export const syncRoomsFromInstances = (
  instances: OfficeInstanceItem[] | undefined,
  fallbackRooms: Room[],
): SyncedRoomResult => {
  if (!Array.isArray(instances) || instances.length === 0) {
    return { rooms: fallbackRooms, hasRealData: false }
  }

  const rooms = instances.map((item, index) => {
    const source = item as Record<string, unknown>
    const normalized = normalizeStatus(item.status)
    const roomId = getRoomIdFromInstance(item, index)
    const projectId = getProjectIdFromInstance(item, index)
    const projectName = pickFirstStringFromValues([
      pickString(source.mainProject),
      pickString(source.projectName),
      pickString(source.project),
      'KOTOVELA',
    ], 'KOTOVELA')

    const instanceId = pickFirstIdFromValues([
      pickString(source.key) && source.key,
      source.instanceId,
      source.instance_id,
    ])

    const instanceIds = parseInstanceArrayIds(
      source.instanceIds,
      `inst-${roomId}`,
      index,
    )

    if (instanceId && instanceIds.length === 1) {
      instanceIds[0] = instanceId
    }

    const roomName = pickFirstStringFromValues([
      pickString(source.roomName),
      pickString(source.channelName),
      pickString(source.channel),
      pickString(source.name),
      `实例 ${item.key || index + 1} 房间`,
    ], `实例 ${item.key || index + 1} 房间`)

    const statusText = pickFirstStringFromValues([
      pickString(source.focus),
      pickString(item.role),
      pickString(source.purpose),
      '实例承载空间',
    ], '实例承载空间')

    const recentAction = pickFirstStringFromValues([
      pickString(source.recentAction),
      pickString(source.lastAction),
      pickString(source.currentTask),
      item.task,
      '实例回传更新',
    ], '实例回传更新')

    const channelType = pickFirstStringFromValues(
      [pickString(source.channelType), pickString(source.channel), pickString(source.type), 'Feishu 群聊'],
      'Feishu 群聊',
    )

    const pending = Number.isFinite(Number(source.pending))
      ? Number(source.pending)
      : Array.isArray(source.pendingTasks)
        ? (source.pendingTasks as unknown[]).length
        : 0

    return {
      id: roomId,
      code: pickString(source.roomCode, `ROOM-${roomId.slice(-4).toUpperCase()}`),
      name: roomName,
      status: toRoomStatus(normalized),
      focus: statusText,
      pending,
      channelType,
      instance: pickFirstStringFromValues([
        pickString(source.instanceName),
        pickString(item.name),
        roomName,
      ], '未绑定实例'),
      instanceIds,
      mainProject: projectName,
      mainProjectId: projectId,
      purpose: pickFirstStringFromValues([pickString(source.purpose), pickString(source.description)], '承载任务讨论与执行汇报'),
      recentAction,
    }
  })

  return { rooms: rooms, hasRealData: true }
}

export const syncTasksFromInstances = (
  instances: OfficeInstanceItem[] | undefined,
  fallbackTasks: Task[],
): SyncedTaskResult => {
  if (!Array.isArray(instances) || instances.length === 0) {
    return { tasks: fallbackTasks, hasRealData: false }
  }

  const tasks = instances.map((item, index) => {
    const source = item as Record<string, unknown>
    const normalized = normalizeStatus(item.status)
    const taskId = getTaskIdFromInstance(item, index)
    const executorAgentId = getAssigneeAgentIdByTask(item)
    const projectId = getProjectIdFromInstance(item, index)

    const projectName = pickFirstStringFromValues([
      pickString(source.projectName),
      pickString(source.project),
      'KOTOVELA',
    ], 'KOTOVELA')

    return {
      id: taskId,
      code: pickString(source.taskCode, `TSK-${taskId.slice(-3).toUpperCase()}`),
      title: pickFirstStringFromValues([
        pickString(source.title),
        pickString(source.taskTitle),
        item.task,
        item.currentTask,
        '未命名任务',
      ], '未命名任务'),
      project: projectName,
      projectId,
      assignee: pickFirstStringFromValues([pickString(source.assignee), pickString(source.owner)], item.name || '实例'),
      assigneeAgentId: executorAgentId,
      executor: pickFirstStringFromValues([pickString(source.executor), pickString(source.operator)], item.name || '实例'),
      executorAgentId,
      status: toTaskStatus(normalized),
      priority: toTaskPriority(index),
      updatedAt: pickFirstStringFromValues([
        pickString(source.updatedAt),
        pickString(source.ageText),
        pickString(item.ageText),
      ], '刚刚'),
    }
  })

  return { tasks: tasks, hasRealData: true }
}

export async function loadOfficeInstances(): Promise<OfficeInstanceItem[]> {
  const response = await fetch('/api/office-instances', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Office instances request failed: ${response.status}`)
  }

  const payload = (await response.json()) as OfficeInstancesResponse
  return parseOfficeInstancesPayload(payload)
}
