export type AgentStatus = 'active' | 'idle' | 'blocked'
export type ProjectStatus = 'active' | 'planning' | 'blocked'
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done'
export type RoomStatus = 'active' | 'quiet' | 'blocked'
export type UpdateType = 'task' | 'project' | 'agent'

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
  stage: string
  nextStep: string
  taskCount: number
}

export interface Task {
  id: string
  title: string
  project: string
  assignee: string
  executor: string
  status: TaskStatus
  priority: 'high' | 'medium' | 'low'
  updatedAt: string
}

export interface Room {
  id: string
  name: string
  status: RoomStatus
  focus: string
  pending: number
  channelType: string
  instance: string
  mainProject: string
  purpose: string
  recentAction: string
}

export interface UpdateItem {
  id: string
  title: string
  source: string
  time: string
  type: UpdateType
  level: 'info' | 'warning' | 'success'
}

export interface DecisionItem {
  id: string
  title: string
  owner: string
  project: string
  priority: 'high' | 'medium' | 'low'
}
