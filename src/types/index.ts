export type AgentStatus = 'active' | 'idle' | 'blocked'
export type ProjectStatus = 'active' | 'planning' | 'blocked'
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done'
export type RoomStatus = 'active' | 'quiet' | 'blocked'

export interface Agent {
  id: string
  name: string
  role: string
  status: AgentStatus
  currentTask: string
  project: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  owner: string
  status: ProjectStatus
  progress: number
  focus: string
  blockers: number
}

export interface Task {
  id: string
  title: string
  project: string
  assignee: string
  status: TaskStatus
  priority: 'high' | 'medium' | 'low'
}

export interface Room {
  id: string
  name: string
  status: RoomStatus
  focus: string
  pending: number
  channelType: string
}

export interface UpdateItem {
  id: string
  title: string
  source: string
  time: string
  type: 'info' | 'warning' | 'success'
}
