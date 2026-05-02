import { defaultInstanceDisplayName, defaultInstanceRoleLabel } from '../config/instanceDisplayNames'
import type { Agent, Project, Room, Task } from '../types'

export type OfficeInstanceStatus = 'doing' | 'done' | 'blocker' | 'idle' | 'active' | 'blocked'

/**
 * Normalized status mapping between backend payloads and the workbench UI.
 * Rules:
 * - doing/in_progress/running -> doing
 * - blocker/blocked/error -> blocker
 * - done/done_ok/finished -> done
 * - active/online/busy -> active
 * - idle/offline -> idle
 * - fallback -> idle
 */

/** Fallback status sentences keyed by normalized status. */
const STATUS_SENTENCE: Record<string, string> = {
  doing: 'Work is actively moving.',
  blocker: 'A blocker needs attention.',
  done: 'No active blocker detected.',
  active: 'Work is actively moving.',
  idle: 'No active blocker detected.',
  blocked: 'A blocker needs attention.',
}

const unknownStatusSentence = 'No active blocker detected.'

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
  personal: 'agent-6',
  ztl970: 'agent-6',
}

const OFFICE_AGENT_CODE_MAP: Record<string, string> = {
  main: 'INS-01',
  builder: 'INS-02',
  media: 'INS-03',
  family: 'INS-04',
  business: 'INS-05',
  personal: 'INS-06',
  ztl970: 'INS-06',
}

const canonicalInstanceKey = (key: string | undefined): string | undefined => {
  const k = key?.trim().toLowerCase()
  if (!k) return undefined
  return k === 'ztl970' ? 'personal' : k
}

const PROJECT_NAME_HINTS: Record<string, string> = {
  'kotovela workbench': 'project-1',
  kotovela: 'project-1',
  'companion prototype': 'project-2',
  'github sync': 'project-3',
  'knowledge base refresh': 'project-4',
  'external demo assets': 'project-5',
}

const PROJECT_NAME_BY_INSTANCE_KEY: Record<string, string> = {
  main: '中枢调度项目',
  builder: '研发执行项目',
  media: '内容创作项目',
  family: '家庭事务项目',
  business: '业务增长项目',
  personal: '个人助手项目',
}

/**
 * Known Feishu chat_id -> readable group names.
 * Priority order when rendering task titles:
 * 1) Payload provided group name (room/channel/chat name)
 * 2) This known-id map
 * 3) Fallback to original title
 */
const FEISHU_CHAT_ID_TO_NAME: Record<string, string> = {
  demo_kotovela_hub_research_chat: 'Kotovela Hub Demo 研发群',
  demo_workbench_legacy_chat: 'Kotovela Workbench Demo 历史群',
  demo_builder_chat: 'Builder Demo 协作群',
  demo_family_chat: 'Family Demo 协作群',
  demo_business_chat: 'Business Demo 协作群',
}

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

const clampProgressByStatus = (status: OfficeInstanceStatus, raw: number | undefined): number => {
  if (Number.isFinite(raw)) {
    return Math.min(100, Math.max(0, raw as number))
  }
  switch (status) {
    case 'done':
      return 100
    case 'doing':
    case 'active':
      return 60
    case 'blocker':
    case 'blocked':
      return 35
    default:
      return 20
  }
}

const statusActionText = (status: OfficeInstanceStatus): string => {
  switch (status) {
    case 'blocker':
    case 'blocked':
      return '阻塞待处理'
    case 'doing':
    case 'active':
      return '正在推进'
    case 'done':
      return '已完成'
    default:
      return '待分派'
  }
}

const CHAT_ID_REGEX = /\boc_[a-z0-9]{8,}\b/gi
const GENERIC_TASK_TITLE_REGEX = /^(会话活跃（暂无任务摘要）|等待新任务（飞书群）|飞书群会话|直连会话|暂无任务)$/u

const readableFeishuGroupNameFromSource = (source: Record<string, unknown>): string | undefined => {
  const explicitName = pickFirstStringFromValues([
    pickString(source.chatName),
    pickString(source.chat_name),
    pickString(source.channelName),
    pickString(source.channel_name),
    pickString(source.roomName),
    pickString(source.groupName),
    pickString(source.group),
  ])
  if (explicitName) return explicitName

  const explicitChatId = pickFirstStringFromValues([
    pickString(source.chatId),
    pickString(source.chat_id),
    pickString(source.channelId),
    pickString(source.channel_id),
  ])
  if (explicitChatId) return FEISHU_CHAT_ID_TO_NAME[explicitChatId]

  return undefined
}

const prettifyTaskTitle = (
  rawTitle: string,
  source: Record<string, unknown>,
): string => {
  if (!rawTitle) return rawTitle

  const fallbackGroupName = readableFeishuGroupNameFromSource(source)
  const replaced = rawTitle.replace(CHAT_ID_REGEX, (chatId) => {
    const mapped = FEISHU_CHAT_ID_TO_NAME[chatId]
    const groupName = fallbackGroupName || mapped
    return groupName || chatId
  })

  // Last fallback: if the title still contains chat_id tokens, strip raw ids for readability.
  CHAT_ID_REGEX.lastIndex = 0
  if (CHAT_ID_REGEX.test(replaced)) {
    CHAT_ID_REGEX.lastIndex = 0
    return replaced
      .replace(/飞书群会话[:：]\s*oc_[a-z0-9]+/gi, '飞书群会话')
      .replace(/群会话[:：]\s*oc_[a-z0-9]+/gi, '群会话')
      .replace(CHAT_ID_REGEX, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }
  return replaced
}

const resolveTaskTitle = (item: OfficeInstanceItem, source: Record<string, unknown>): string => {
  const rawTitle = pickFirstStringFromValues([
    pickString(source.title),
    pickString(source.taskTitle),
    item.task,
    item.currentTask,
  ])

  const prettified = prettifyTaskTitle(rawTitle, source)
  if (prettified && !GENERIC_TASK_TITLE_REGEX.test(prettified)) {
    return prettified
  }

  // If title is too generic, fallback to more context-rich fields.
  const richFallback = pickFirstStringFromValues([
    pickString(source.note),
    pickString(source.projectRelated),
    readableFeishuGroupNameFromSource(source),
    item.currentTask,
    item.task,
  ])

  if (richFallback) return prettifyTaskTitle(richFallback, source)
  return prettified || '待补充任务摘要'
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
        // Fallback to semantic name mapping for known project names.
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

const foldProjectStatus = (a: Project['status'], b: Project['status']): Project['status'] => {
  if (a === 'blocked' || b === 'blocked') return 'blocked'
  if (a === 'active' || b === 'active') return 'active'
  return 'planning'
}

/** Merge per-instance project rows that share the same canonical id (multi-instance → one portfolio row). */
export function mergeSyncedProjects(projects: Project[]): Project[] {
  if (projects.length === 0) return projects

  const byId = new Map<string, Project[]>()
  for (const p of projects) {
    const list = byId.get(p.id) ?? []
    list.push(p)
    byId.set(p.id, list)
  }

  const merged: Project[] = []
  for (const group of byId.values()) {
    if (group.length === 1) {
      merged.push({ ...group[0], instanceCount: 1 })
      continue
    }

    const blockers = group.reduce((sum, p) => sum + p.blockers, 0)
    const taskCount = group.reduce((sum, p) => sum + p.taskCount, 0)
    const progressAvg = Math.round(group.reduce((sum, p) => sum + p.progress, 0) / group.length)
    const status = group.map((p) => p.status).reduce(foldProjectStatus, 'planning')
    const roomIds = [...new Set(group.flatMap((p) => p.roomIds))]
    const blockedFirst = group.find((p) => p.blockers > 0)
    const base = blockedFirst ?? group[0]

    merged.push({
      ...base,
      blockers,
      taskCount,
      progress: progressAvg,
      status,
      roomIds,
      instanceCount: group.length,
      owner: `${group.length} 个实例`,
      focus: blockedFirst?.focus ?? base.focus,
      nextStep: blockedFirst?.nextStep ?? base.nextStep,
      stage: blockedFirst?.stage ?? base.stage,
    })
  }

  return merged.sort((a, b) => {
    if (b.blockers !== a.blockers) return b.blockers - a.blockers
    if (b.progress !== a.progress) return b.progress - a.progress
    return a.name.localeCompare(b.name)
  })
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
  const key = canonicalInstanceKey(item.key)
  if (!key) return fallback
  return OFFICE_AGENT_ID_MAP[key] ?? `office-${key}`
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

  const key = canonicalInstanceKey(item.key)
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

  const key = canonicalInstanceKey(item.key)
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

  const key = canonicalInstanceKey(item.key)
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

const isSafeRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const isSafeOfficeInstanceItem = (value: unknown): value is OfficeInstanceItem => {
  if (!isSafeRecord(value)) return false
  const hasIdentity = typeof value.key === 'string' || typeof value.name === 'string' || typeof value.id === 'string'
  const safeScalar = ['key', 'name', 'role', 'status', 'task', 'currentTask', 'updatedAt', 'ageText'].every((field) => {
    const fieldValue = value[field]
    return fieldValue === undefined || typeof fieldValue === 'string' || typeof fieldValue === 'number'
  })
  return hasIdentity && safeScalar
}

export function parseOfficeInstancesPayload(payload: unknown): OfficeInstanceItem[] {
  if (!isSafeRecord(payload)) {
    return []
  }

  const raw = Array.isArray(payload.instances) ? payload.instances : []

  return raw
    .filter(isSafeOfficeInstanceItem)
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

  const syncedAgents = instances.map((item, index) => {
    const key = canonicalInstanceKey(item.key)
    const source = item as Record<string, unknown>
    const fallbackAgent = key ? buildFallbackAgent(key, fallbackAgents) : undefined
    const projectName = pickString(source.projectName || source.project || source.mainProject)
    const canonicalProjectId = getProjectIdFromInstance(item, index)

    return {
      ...fallbackAgent,
      id: fallbackAgent?.id ?? `office-${key || 'unknown'}`,
      code: fallbackAgent?.code ?? OFFICE_AGENT_CODE_MAP[key ?? ''] ?? key?.toUpperCase() ?? 'INS-00',
      name:
        pickFirstStringFromValues([pickString(source.displayName), pickString(source.display_name)]) ||
        defaultInstanceDisplayName(key) ||
        pickString(item.name) ||
        fallbackAgent?.name ||
        `实例 ${key || 'unknown'}`,
      role:
        pickString(source.role) ||
        item.role ||
        defaultInstanceRoleLabel(key) ||
        fallbackAgent?.role ||
        '未设置角色',
      status: toAgentStatus(normalizeStatus(item.status)),
      currentTask: pickString(source.currentTask) || pickString(source.current_task) || item.task || fallbackAgent?.currentTask || '暂无任务',
      project: projectName || fallbackAgent?.project || 'KOTOVELA',
      projectId: canonicalProjectId,
      updatedAt: pickString(source.ageText || source.updatedAt || source.updatedAtText, fallbackAgent?.updatedAt || '刚刚'),
      instanceKey: key,
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
    const instanceKey = canonicalInstanceKey(item.key)
    const projectId = getProjectIdFromInstance(item, index)
    const projectName = pickFirstStringFromValues([
      pickString(source.projectName),
      pickString(source.project),
      pickString(source.projectRelated),
      pickString(source.mainProject),
      instanceKey ? PROJECT_NAME_BY_INSTANCE_KEY[instanceKey] : '',
      pickString(item.name, ''),
      `实例 ${instanceKey || index + 1}`,
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
      pickString(source.channelName),
    ])
    const taskSummary = resolveTaskTitle(item, source)
    const actionText = statusActionText(normalized)
    const progress = clampProgressByStatus(normalized, Number.isFinite(progressRaw) ? progressRaw : undefined)

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
      progress,
      focus: pickFirstStringFromValues(
        [
          pickString(source.focus),
          pickString(source.goal),
          `${actionText}：${taskSummary}`,
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
          roomHint ? `在 ${roomHint} 跟进：${taskSummary}` : '',
          `${actionText}：${taskSummary}`,
          '等待任务推进',
        ],
        '等待任务推进',
      ),
      taskCount: Number.isFinite(taskCountRaw) ? taskCountRaw : item.task || item.currentTask ? 1 : 0,
      roomIds: [roomId],
    }
  })

  return { projects: mergeSyncedProjects(projects), hasRealData: true }
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
      pickString(source.projectRelated),
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

    const anchorAgentId = getAgentIdByInstance(item)
    if (anchorAgentId && !instanceIds.includes(anchorAgentId)) {
      instanceIds.unshift(anchorAgentId)
    }

    const roomName = pickFirstStringFromValues([
      pickString(source.roomName),
      pickString(source.channelName),
      pickString(source.channel),
      pickString(source.name),
      `实例 ${canonicalInstanceKey(item.key) || index + 1} 房间`,
    ], `实例 ${canonicalInstanceKey(item.key) || index + 1} 房间`)

    const statusText = pickFirstStringFromValues([
      pickString(source.focus),
      pickString(item.role),
      pickString(source.purpose),
      '承载任务讨论与执行汇报',
    ], '实例承载空间')
    const taskSummary = resolveTaskTitle(item, source)
    const actionText = statusActionText(normalized)

    const recentAction = pickFirstStringFromValues([
      pickString(source.recentAction),
      pickString(source.lastAction),
      `${actionText}：${taskSummary}`,
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
      pickString(source.projectRelated),
      'KOTOVELA',
    ], 'KOTOVELA')

    return {
      id: taskId,
      code: pickString(source.taskCode, `TSK-${taskId.slice(-3).toUpperCase()}`),
      title: resolveTaskTitle(item, source),
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

export async function loadOfficeInstances(apiPath = '/api/office-instances', signal?: AbortSignal): Promise<OfficeInstanceItem[]> {
  const response = await fetch(apiPath, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Office instances request failed: ${response.status}`)
  }

  const payload = (await response.json()) as OfficeInstancesResponse
  return parseOfficeInstancesPayload(payload)
}
