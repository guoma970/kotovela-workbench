import { createContext, useContext } from 'react'
import type { Agent, Project, Room, Task, UpdateItem } from '../types'
import type { OfficeInstanceItem } from './officeInstancesAdapter'
import type { PreferredDataSource, WorkbenchMode } from '../config/runtime'

export type DataSource = 'mock' | 'openclaw'

export interface OfficeInstancesContextValue {
  agents: Agent[]
  projects: Project[]
  rooms: Room[]
  tasks: Task[]
  updates: UpdateItem[]
  mode: WorkbenchMode
  preferredDataSource: PreferredDataSource
  activeDataSource: DataSource
  isFallback: boolean
  pollingEnabled: boolean
  pollingIntervalMs: number
  visibilityRefreshEnabled: boolean
  isLoading: boolean
  error: string
  refresh: () => void
  instances: OfficeInstanceItem[]
  /** 最近一次成功从 OpenClaw 拉取并完成处理的时间戳（ms）；Mock 或未成功过为 null */
  lastSyncedAtMs: number | null
}

export const OfficeInstancesContext = createContext<OfficeInstancesContextValue | null>(null)

export function useOfficeInstances(): OfficeInstancesContextValue {
  const ctx = useContext(OfficeInstancesContext)
  if (!ctx) {
    throw new Error('useOfficeInstances must be used within <OfficeInstancesProvider>')
  }
  return ctx
}
