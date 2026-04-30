import type { AgentStatus, ProjectStatus, RoomStatus, TaskStatus } from '../types'

export function agentStatusLabel(status: AgentStatus, internal: boolean): string {
  if (!internal) return status
  const map: Record<AgentStatus, string> = {
    active: '推进中',
    idle: '空闲',
    blocked: '有卡点',
  }
  return map[status] ?? status
}

export function projectStatusLabel(status: ProjectStatus, internal: boolean): string {
  if (!internal) return status
  const map: Record<ProjectStatus, string> = {
    active: '推进中',
    planning: '规划中',
    blocked: '有卡点',
  }
  return map[status] ?? status
}

export function roomStatusLabel(status: RoomStatus, internal: boolean): string {
  if (!internal) return status
  const map: Record<RoomStatus, string> = {
    active: '活跃',
    quiet: '安静',
    blocked: '有卡点',
  }
  return map[status] ?? status
}

export function taskStatusLabel(status: TaskStatus, internal: boolean): string {
  if (!internal) return status
  const map: Record<TaskStatus, string> = {
    todo: '待办',
    doing: '推进中',
    blocked: '有卡点',
    done: '已完成',
  }
  return map[status] ?? status
}

export function priorityLabel(priority: 'high' | 'medium' | 'low', internal: boolean): string {
  if (!internal) return priority
  const map = { high: '高', medium: '中', low: '低' } as const
  return map[priority] ?? priority
}
