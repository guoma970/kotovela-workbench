export type AgentStatus = 'active' | 'idle' | 'blocked'
export type ProjectStatus = 'active' | 'planning' | 'blocked'
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done'
export type RoomStatus = 'active' | 'quiet' | 'blocked'
export type UpdateType = 'task' | 'project' | 'agent' | 'room'

export interface Agent {
  id: string
  code: string
  name: string
  role: string
  status: AgentStatus
  currentTask: string
  project: string
  projectId: string
  updatedAt: string
  /** OpenClaw office instance key (e.g. main, builder) when synced from live payload */
  instanceKey?: string
}

export interface Project {
  id: string
  code: string
  name: string
  owner: string
  ownerAgentId: string
  status: ProjectStatus
  progress: number
  focus: string
  blockers: number
  stage: string
  nextStep: string
  taskCount: number
  roomIds: string[]
  /** When multiple office instances map to the same project id */
  instanceCount?: number
}

export interface Task {
  id: string
  code: string
  title: string
  project: string
  projectId: string
  assignee: string
  assigneeAgentId: string
  executor: string
  executorAgentId: string
  status: TaskStatus
  priority: 'high' | 'medium' | 'low'
  updatedAt: string
}

export interface Room {
  id: string
  code: string
  name: string
  status: RoomStatus
  focus: string
  pending: number
  channelType: string
  instance: string
  instanceIds: string[]
  mainProject: string
  mainProjectId: string
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
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
}

export interface DecisionItem {
  id: string
  title: string
  owner: string
  ownerAgentId: string
  project: string
  projectId: string
  relatedAgentId?: string
  relatedTaskId?: string
  priority: 'high' | 'medium' | 'low'
}
