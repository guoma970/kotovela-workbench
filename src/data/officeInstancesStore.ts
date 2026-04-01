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
}

export const OfficeInstancesContext = createContext<OfficeInstancesContextValue | null>(null)

export function useOfficeInstances(): OfficeInstancesContextValue {
  const ctx = useContext(OfficeInstancesContext)
  if (!ctx) {
    throw new Error('useOfficeInstances must be used within <OfficeInstancesProvider>')
  }
  return ctx
}
