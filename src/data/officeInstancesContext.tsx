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
import { runtimeConfig, type PreferredDataSource, type WorkbenchMode } from '../config/runtime'
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
  const [instances, setInstances] = useState<OfficeInstanceItem[]>([])
  const [updates, setUpdates] = useState(fallbackUpdates)
  const [activeDataSource, setActiveDataSource] = useState<DataSource>(
    runtimeConfig.preferredDataSource === 'openclaw' ? 'openclaw' : 'mock',
  )
  const [isFallback, setIsFallback] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastSyncedAtMs, setLastSyncedAtMs] = useState<number | null>(null)
  const [hasBootstrapped, setHasBootstrapped] = useState(runtimeConfig.preferredDataSource === 'mock')

  const lastFetchMsRef = useRef(0)
  const liveInstancesRef = useRef<OfficeInstanceItem[]>([])
  const liveUpdatesRef = useRef(fallbackUpdates)

  const mode: WorkbenchMode = runtimeConfig.mode
  const preferredDataSource: PreferredDataSource = runtimeConfig.preferredDataSource
  const pollingEnabled = runtimeConfig.pollingEnabled
  const pollingIntervalMs = runtimeConfig.pollingIntervalMs
  const visibilityRefreshEnabled = runtimeConfig.visibilityRefreshEnabled

  const applyMockSnapshot = useCallback(
    (nextError = '') => {
      setInstances([])
      setUpdates(fallbackUpdates)
      setActiveDataSource('mock')
      setIsFallback(preferredDataSource === 'openclaw')
      liveInstancesRef.current = []
      liveUpdatesRef.current = fallbackUpdates
      setError(nextError)
    },
    [preferredDataSource],
  )

  const fetchData = useCallback(async () => {
    if (preferredDataSource === 'mock') {
      setLastSyncedAtMs(null)
      applyMockSnapshot('')
      setHasBootstrapped(true)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const raw = await loadOfficeInstances(runtimeConfig.officeInstancesApiPath)
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
              dataSource: 'openclaw',
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
      setActiveDataSource('openclaw')
      setIsFallback(false)
      liveInstancesRef.current = raw
      liveUpdatesRef.current = nextUpdates
      const now = Date.now()
      lastFetchMsRef.current = now
      setLastSyncedAtMs(now)
    } catch (fetchError) {
      if (runtimeConfig.fallbackToMock) {
        applyMockSnapshot('OpenClaw 接口不可用，已自动回退到 Mock 数据')
      } else {
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError))
      }
    } finally {
      setIsLoading(false)
      setHasBootstrapped(true)
    }
  }, [fallbackAgents, fallbackProjects, fallbackRooms, fallbackTasks, preferredDataSource, applyMockSnapshot])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!pollingEnabled || preferredDataSource !== 'openclaw') {
      return
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }
      void fetchData()
    }, pollingIntervalMs)

    return () => window.clearInterval(timer)
  }, [fetchData, pollingEnabled, pollingIntervalMs, preferredDataSource])

  useEffect(() => {
    if (!visibilityRefreshEnabled || preferredDataSource !== 'openclaw') {
      return
    }

    const shouldRefresh = () => {
      const elapsed = Date.now() - lastFetchMsRef.current
      return elapsed > runtimeConfig.staleMs
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && shouldRefresh()) {
        void fetchData()
      }
    }

    const handleOnline = () => {
      if (shouldRefresh()) {
        void fetchData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [fetchData, preferredDataSource, visibilityRefreshEnabled])

  const refresh = useCallback(() => {
    void fetchData()
  }, [fetchData])

  const isInternalOpenclawBootstrap =
    mode === 'internal' && preferredDataSource === 'openclaw' && !hasBootstrapped && !isFallback

  const effectiveAgents = isInternalOpenclawBootstrap ? [] : activeDataSource === 'mock' ? fallbackAgents : null
  const effectiveProjects = isInternalOpenclawBootstrap ? [] : activeDataSource === 'mock' ? fallbackProjects : null
  const effectiveRooms = isInternalOpenclawBootstrap ? [] : activeDataSource === 'mock' ? fallbackRooms : null
  const effectiveTasks = isInternalOpenclawBootstrap ? [] : activeDataSource === 'mock' ? fallbackTasks : null

  const syncAgents = effectiveAgents ?? syncOfficeInstancesToAgents(instances, fallbackAgents).agents
  const syncProjects = effectiveProjects ?? syncProjectsFromInstances(instances, fallbackProjects).projects
  const syncRooms = effectiveRooms ?? syncRoomsFromInstances(instances, fallbackRooms).rooms
  const syncTasks = effectiveTasks ?? syncTasksFromInstances(instances, fallbackTasks).tasks

  return (
    <OfficeInstancesContext.Provider
      value={{
        agents: syncAgents,
        projects: syncProjects,
        rooms: syncRooms,
        tasks: syncTasks,
        updates: isInternalOpenclawBootstrap ? [] : updates,
        mode,
        preferredDataSource,
        activeDataSource,
        isFallback,
        pollingEnabled,
        pollingIntervalMs,
        visibilityRefreshEnabled,
        isLoading,
        error,
        refresh,
        instances,
        lastSyncedAtMs,
      }}
    >
      {children}
    </OfficeInstancesContext.Provider>
  )
}
