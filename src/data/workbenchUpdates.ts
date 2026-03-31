import type { Agent, Project, Room, Task, UpdateItem } from '../types'
import type { OfficeInstanceItem } from './officeInstancesAdapter'
import type { DataSource } from './officeInstancesStore'

const MAX_AGE_MS = Number.MAX_SAFE_INTEGER

const levelPriority: Record<UpdateItem['level'], number> = {
  warning: 0,
  info: 1,
  success: 2,
}

const UPDATE_LIMIT = 12

const parseAgeTextMs = (value?: string): number | undefined => {
  if (!value) return undefined

  if (value.includes('刚刚')) {
    return 0
  }

  const secondMatch = value.match(/(\d+)\s*秒(?:前)?/)
  if (secondMatch) {
    return Number(secondMatch[1]) * 1000
  }

  const minuteMatch = value.match(/(\d+)\s*分钟前/)
  if (minuteMatch) {
    return Number(minuteMatch[1]) * 60 * 1000
  }

  const hourMatch = value.match(/(\d+)\s*小时前/)
  if (hourMatch) {
    return Number(hourMatch[1]) * 60 * 60 * 1000
  }

  return undefined
}

const toNumericAgeMs = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  return undefined
}

const normalizeUpdateState = (value?: string): 'blocked' | 'doing' | 'done' => {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    return 'done'
  }

  if (['blocker', 'blocked', 'error', 'critical'].includes(normalized)) {
    return 'blocked'
  }

  if (['doing', 'active', 'online', 'busy', 'running', 'in_progress'].includes(normalized)) {
    return 'doing'
  }

  return 'done'
}

const pickReadableTask = (task?: Task, item?: OfficeInstanceItem, room?: Room) => {
  const rawTask = task?.title || item?.currentTask || item?.task
  if (rawTask && rawTask !== '暂无任务') {
    return rawTask
  }

  if (room?.recentAction && room.recentAction !== '实例回传更新') {
    return room.recentAction
  }

  const note = typeof item?.note === 'string' ? item.note.trim() : ''
  if (note) {
    return note
  }

  return '状态已同步'
}

const buildUpdateTitle = (state: 'blocked' | 'doing' | 'done', actor: string, detail: string) => {
  if (state === 'blocked') {
    return `${actor} 当前受阻：${detail}`
  }

  if (state === 'doing') {
    return `${actor} 正在推进：${detail}`
  }

  return `${actor} 最近已同步：${detail}`
}

const buildUpdateLevel = (state: 'blocked' | 'doing' | 'done'): UpdateItem['level'] => {
  if (state === 'blocked') {
    return 'warning'
  }

  if (state === 'doing') {
    return 'info'
  }

  return 'success'
}

const normalizeTaskText = (item?: OfficeInstanceItem) => {
  const rawTask = [item?.currentTask, item?.task].find((value) => typeof value === 'string' && value.trim().length > 0)
  return rawTask?.trim() || '暂无任务'
}

const findRelatedAgent = (
  item: OfficeInstanceItem,
  agents: Agent[],
  fallbackAgents: Agent[],
  index: number,
) => {
  const syncedAgent = agents.find((agent) => agent.name === item.name || agent.role === item.role) ?? agents[index]
  const fallbackAgent =
    (syncedAgent ? fallbackAgents.find((agent) => agent.id === syncedAgent.id) : undefined) ?? fallbackAgents[index]

  return { syncedAgent, fallbackAgent }
}

const findRelatedTask = (tasks: Task[], agent?: Agent, item?: OfficeInstanceItem) => {
  const taskText = [item?.task, item?.currentTask].filter((value): value is string => Boolean(value && value !== '暂无任务'))

  return (
    tasks.find(
      (task) =>
        taskText.includes(task.title) &&
        (!agent || task.executorAgentId === agent.id || task.assigneeAgentId === agent.id),
    ) ??
    (agent
      ? tasks.find((task) => task.executorAgentId === agent.id || task.assigneeAgentId === agent.id)
      : undefined)
  )
}

const getUpdateAgeMs = (item: OfficeInstanceItem, task?: Task, agent?: Agent) => {
  return (
    toNumericAgeMs(item.ageMs) ??
    parseAgeTextMs(item.ageText) ??
    parseAgeTextMs(item.updatedAt) ??
    parseAgeTextMs(task?.updatedAt) ??
    parseAgeTextMs(agent?.updatedAt) ??
    MAX_AGE_MS
  )
}

const buildUpdateContext = ({
  item,
  index,
  agents,
  projects,
  rooms,
  tasks,
  fallbackAgents,
}: {
  item: OfficeInstanceItem
  index: number
  agents: Agent[]
  projects: Project[]
  rooms: Room[]
  tasks: Task[]
  fallbackAgents: Agent[]
}) => {
  const { syncedAgent, fallbackAgent } = findRelatedAgent(item, agents, fallbackAgents, index)
  const relatedTask = findRelatedTask(tasks, syncedAgent, item)
  const relatedProject = projects.find((project) => project.id === (relatedTask?.projectId || syncedAgent?.projectId))
  const relatedRoom =
    rooms.find((room) => syncedAgent && room.instanceIds.includes(syncedAgent.id)) ??
    rooms.find((room) => relatedProject && room.mainProjectId === relatedProject.id)
  const state = normalizeUpdateState(item.status || syncedAgent?.status)
  const actorName = fallbackAgent?.name || syncedAgent?.name || item.name || item.key || '实例'
  const detail = pickReadableTask(relatedTask, item, relatedRoom)
  const time = item.ageText || item.updatedAt || relatedTask?.updatedAt || syncedAgent?.updatedAt || '刚刚'

  return {
    syncedAgent,
    relatedTask,
    relatedProject,
    relatedRoom,
    state,
    actorName,
    detail,
    time,
  }
}

const buildDiffUpdateTitle = ({
  actorName,
  previousItem,
  currentItem,
  detail,
}: {
  actorName: string
  previousItem?: OfficeInstanceItem
  currentItem: OfficeInstanceItem
  detail: string
}) => {
  if (!previousItem) {
    return `${actorName} 已接入动态同步：${detail}`
  }

  const previousState = normalizeUpdateState(previousItem.status)
  const currentState = normalizeUpdateState(currentItem.status)
  const previousTask = normalizeTaskText(previousItem)
  const currentTask = normalizeTaskText(currentItem)

  if (previousState !== currentState) {
    if (currentState === 'blocked') {
      return `${actorName} 转入阻塞：${detail}`
    }

    if (previousState === 'blocked') {
      return `${actorName} 已解除阻塞：${detail}`
    }

    if (currentState === 'doing') {
      return `${actorName} 进入推进中：${detail}`
    }

    return `${actorName} 已切回平稳状态：${detail}`
  }

  if (previousTask !== currentTask) {
    return `${actorName} 已切换任务：${detail}`
  }

  return `${actorName} 状态已刷新：${detail}`
}

const buildUpdateType = (task?: Task, room?: Room): UpdateItem['type'] => {
  if (task) return 'task'
  if (room) return 'room'
  return 'agent'
}

const buildUpdateFingerprint = (item: UpdateItem) =>
  [item.title, item.source, item.type, item.projectId, item.agentId, item.roomId, item.taskId].join('|')

export function deriveWorkbenchUpdates({
  dataSource,
  instances,
  agents,
  projects,
  rooms,
  tasks,
  fallbackAgents,
  fallbackUpdates,
}: {
  dataSource: DataSource
  instances: OfficeInstanceItem[]
  agents: Agent[]
  projects: Project[]
  rooms: Room[]
  tasks: Task[]
  fallbackAgents: Agent[]
  fallbackUpdates: UpdateItem[]
}): UpdateItem[] {
  if (dataSource !== 'real' || instances.length === 0) {
    return fallbackUpdates
  }

  const derived = instances
    .map((item, index) => {
      const { syncedAgent, relatedTask, relatedProject, relatedRoom, state, actorName, detail, time } = buildUpdateContext({
        item,
        index,
        agents,
        projects,
        rooms,
        tasks,
        fallbackAgents,
      })

      return {
        update: {
          id: `live-update-${item.key || syncedAgent?.id || index + 1}`,
          title: buildUpdateTitle(state, actorName, detail),
          source: actorName,
          time,
          type: buildUpdateType(relatedTask, relatedRoom),
          level: buildUpdateLevel(state),
          projectId: relatedTask?.projectId || relatedProject?.id,
          agentId: syncedAgent?.id,
          roomId: relatedRoom?.id,
          taskId: relatedTask?.id,
        } satisfies UpdateItem,
        ageMs: getUpdateAgeMs(item, relatedTask, syncedAgent),
      }
    })
    .sort((left, right) => {
      const levelGap = levelPriority[left.update.level] - levelPriority[right.update.level]
      if (levelGap !== 0) {
        return levelGap
      }

      return left.ageMs - right.ageMs
    })
    .map((item) => item.update)

  return derived.length > 0 ? derived : fallbackUpdates
}

export function diffWorkbenchUpdates({
  previousInstances,
  nextInstances,
  agents,
  projects,
  rooms,
  tasks,
  fallbackAgents,
}: {
  previousInstances: OfficeInstanceItem[]
  nextInstances: OfficeInstanceItem[]
  agents: Agent[]
  projects: Project[]
  rooms: Room[]
  tasks: Task[]
  fallbackAgents: Agent[]
}): UpdateItem[] {
  const previousByKey = new Map(previousInstances.map((item) => [item.key, item]))
  const changedItems: Array<{ update: UpdateItem; levelRank: number; ageMs: number }> = []

  nextInstances.forEach((item, index) => {
    const previousItem = previousByKey.get(item.key)
    const previousState = normalizeUpdateState(previousItem?.status)
    const currentState = normalizeUpdateState(item.status)
    const previousTask = normalizeTaskText(previousItem)
    const currentTask = normalizeTaskText(item)

    if (previousItem && previousState === currentState && previousTask === currentTask) {
      return
    }

    const { syncedAgent, relatedTask, relatedProject, relatedRoom, state, actorName, detail } = buildUpdateContext({
      item,
      index,
      agents,
      projects,
      rooms,
      tasks,
      fallbackAgents,
    })

    changedItems.push({
      update: {
        id: `live-diff-${item.key || syncedAgent?.id || index + 1}-${Date.now()}-${index}`,
        title: buildDiffUpdateTitle({ actorName, previousItem, currentItem: item, detail }),
        source: actorName,
        time: '刚刚',
        type: buildUpdateType(relatedTask, relatedRoom),
        level: buildUpdateLevel(state),
        projectId: relatedTask?.projectId || relatedProject?.id,
        agentId: syncedAgent?.id,
        roomId: relatedRoom?.id,
        taskId: relatedTask?.id,
      },
      levelRank: levelPriority[buildUpdateLevel(state)],
      ageMs: getUpdateAgeMs(item, relatedTask, syncedAgent),
    })
  })

  return changedItems
    .sort((left, right) => {
      if (left.levelRank !== right.levelRank) {
        return left.levelRank - right.levelRank
      }

      return left.ageMs - right.ageMs
    })
    .map((item) => item.update)
}

export function mergeWorkbenchUpdates(nextUpdates: UpdateItem[], currentUpdates: UpdateItem[]): UpdateItem[] {
  const deduped = new Map<string, UpdateItem>()

  for (const item of [...nextUpdates, ...currentUpdates]) {
    const fingerprint = buildUpdateFingerprint(item)
    if (!deduped.has(fingerprint)) {
      deduped.set(fingerprint, item)
    }
  }

  return [...deduped.values()].slice(0, UPDATE_LIMIT)
}
