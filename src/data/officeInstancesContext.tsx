import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadOfficeInstances,
  syncOfficeInstancesToAgents,
  syncProjectsFromInstances,
  syncRoomsFromInstances,
  syncTasksFromInstances,
  type OfficeInstanceItem,
} from './officeInstancesAdapter'
import { updates as fallbackUpdates } from './mockData'
import { OfficeInstancesContext, type DataSource } from './officeInstancesStore'
import { deriveWorkbenchUpdates, diffWorkbenchUpdates, mergeWorkbenchUpdates } from './workbenchUpdates'
import type { Agent, Project, Room, Task } from '../types'

const STALE_MS = 30_000 // Consider data stale after 30 seconds; triggers auto-refresh on visibility

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
  const [instances, setInstances] = useState<OfficeInstanceItem[]>([])
  const [updates, setUpdates] = useState(fallbackUpdates)
  const [dataSource, setDataSource] = useState<DataSource>('mock')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Track last successful fetch time for stale-while-revalidate
  const lastFetchMsRef = useRef(0)
  const liveInstancesRef = useRef<OfficeInstanceItem[]>([])
  const liveUpdatesRef = useRef(fallbackUpdates)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const raw = await loadOfficeInstances()
      if (raw.length === 0) {
        throw new Error('Office instances payload was empty')
      }

      const nextAgents = syncOfficeInstancesToAgents(raw, fallbackAgents).agents
      const nextProjects = syncProjectsFromInstances(raw, fallbackProjects).projects
      const nextRooms = syncRoomsFromInstances(raw, fallbackRooms).rooms
      const nextTasks = syncTasksFromInstances(raw, fallbackTasks).tasks
      const previousLiveInstances = liveInstancesRef.current
      const nextUpdates =
        previousLiveInstances.length > 0
          ? mergeWorkbenchUpdates(
              diffWorkbenchUpdates({
                previousInstances: previousLiveInstances,
                nextInstances: raw,
                agents: nextAgents,
                projects: nextProjects,
                rooms: nextRooms,
                tasks: nextTasks,
                fallbackAgents,
              }),
              liveUpdatesRef.current,
            )
          : deriveWorkbenchUpdates({
              dataSource: 'real',
              instances: raw,
              agents: nextAgents,
              projects: nextProjects,
              rooms: nextRooms,
              tasks: nextTasks,
              fallbackAgents,
              fallbackUpdates,
            })

      setInstances(raw)
      setUpdates(nextUpdates)
      setDataSource('real')
      liveInstancesRef.current = raw
      liveUpdatesRef.current = nextUpdates
      lastFetchMsRef.current = Date.now()
    } catch {
      setDataSource('mock')
      setUpdates(fallbackUpdates)
      liveUpdatesRef.current = fallbackUpdates
      setError('实时接口不可用，已回退至本地快照')
    } finally {
      setIsLoading(false)
    }
  }, [fallbackAgents, fallbackProjects, fallbackRooms, fallbackTasks])

  // Initial fetch
  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // Auto-refresh triggers:
  // 1. Visibility change — user returns to tab after data may have changed
  // 2. Network comes back online
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastFetchMsRef.current
        if (elapsed > STALE_MS) {
          void fetchData()
        }
      }
    }

    const handleOnline = () => {
      const elapsed = Date.now() - lastFetchMsRef.current
      if (elapsed > STALE_MS) {
        void fetchData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [fetchData])

  const refresh = useCallback(() => {
    void fetchData()
  }, [fetchData])

  // Fall back to local mock data when API is unavailable
  const effectiveAgents = dataSource === 'mock' ? fallbackAgents : null
  const effectiveProjects = dataSource === 'mock' ? fallbackProjects : null
  const effectiveRooms = dataSource === 'mock' ? fallbackRooms : null
  const effectiveTasks = dataSource === 'mock' ? fallbackTasks : null

  const syncAgents = (() => {
    if (effectiveAgents) return effectiveAgents
    const result = syncOfficeInstancesToAgents(instances, fallbackAgents)
    return result.agents
  })()

  const syncProjects = (() => {
    if (effectiveProjects) return effectiveProjects
    const result = syncProjectsFromInstances(instances, fallbackProjects)
    return result.projects
  })()

  const syncRooms = (() => {
    if (effectiveRooms) return effectiveRooms
    const result = syncRoomsFromInstances(instances, fallbackRooms)
    return result.rooms
  })()

  const syncTasks = (() => {
    if (effectiveTasks) return effectiveTasks
    const result = syncTasksFromInstances(instances, fallbackTasks)
    return result.tasks
  })()

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
