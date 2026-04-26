import { useCallback, useState } from 'react'
import {
  type OfficeInstanceItem,
} from './officeInstancesAdapter'
import { updates as fallbackUpdates } from './mockData'
import { OfficeInstancesContext, type DataSource } from './officeInstancesStore'
import type { Agent, Project, Room, Task } from '../types'


export function OfficeInstancesProvider({
  children,
  fallbackAgents,
  fallbackProjects,
  fallbackRooms,
  fallbackTasks,
}: {
  children: React.ReactNode
  fallbackAgents: Agent[]
  fallbackProjects: Project[]
  fallbackRooms: Room[]
  fallbackTasks: Task[]
}) {
  const [instances] = useState<OfficeInstanceItem[]>([])
  const [updates] = useState(fallbackUpdates)
  const [dataSource] = useState<DataSource>('mock')
  const [isLoading] = useState(false)
  const [error] = useState('')

  const refresh = useCallback(() => {
    // Public showcase mode intentionally uses bundled mock data only.
  }, [])

  // Public showcase mode: use bundled mock data only.
  const syncAgents = fallbackAgents
  const syncProjects = fallbackProjects
  const syncRooms = fallbackRooms
  const syncTasks = fallbackTasks

  return (
    <OfficeInstancesContext.Provider
      value={{
        // Flat surface — matches pages' current destructuring
        agents: syncAgents,
        projects: syncProjects,
        rooms: syncRooms,
        tasks: syncTasks,
        updates,
        dataSource,
        isLoading,
        error,
        refresh,
        // Raw data
        instances,
      }}
    >
      {children}
    </OfficeInstancesContext.Provider>
  )
}
