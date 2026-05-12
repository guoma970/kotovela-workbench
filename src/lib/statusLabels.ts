import type { AgentStatus, ProjectStatus, RoomStatus, TaskStatus } from '../types'
import { UI_TERMS } from './uiTerms'

export function agentStatusLabel(status: AgentStatus, _internal: boolean): string {
  void _internal
  const map: Record<AgentStatus, string> = {
    active: UI_TERMS.doing,
    idle: UI_TERMS.idle,
    blocked: UI_TERMS.blocked,
  }
  return map[status] ?? status
}

export function projectStatusLabel(status: ProjectStatus, _internal: boolean): string {
  void _internal
  const map: Record<ProjectStatus, string> = {
    active: UI_TERMS.doing,
    planning: '规划中',
    blocked: UI_TERMS.blocked,
  }
  return map[status] ?? status
}

export function roomStatusLabel(status: RoomStatus, _internal: boolean): string {
  void _internal
  const map: Record<RoomStatus, string> = {
    active: '活跃',
    quiet: '安静',
    blocked: UI_TERMS.blocked,
  }
  return map[status] ?? status
}

export function taskStatusLabel(status: TaskStatus, _internal: boolean): string {
  void _internal
  const map: Record<TaskStatus, string> = {
    todo: '待办',
    doing: UI_TERMS.doing,
    blocked: UI_TERMS.blocked,
    done: UI_TERMS.done,
  }
  return map[status] ?? status
}

export function priorityLabel(priority: 'high' | 'medium' | 'low', _internal: boolean): string {
  void _internal
  const map = { high: '高', medium: '中', low: '低' } as const
  return map[priority] ?? priority
}
