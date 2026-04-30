import { useCallback, useRef, useState } from 'react'
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
import { usePollingFetch } from './hooks/usePollingFetch'
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

  const liveInstancesRef = useRef<OfficeInstanceItem[]>([])
  const liveUpdatesRef = useRef(fallbackUpdates)

  const mode: WorkbenchMode = runtimeConfig.mode
  const preferredDataSource: PreferredDataSource = runtimeConfig.preferredDataSource
  const pollingEnabled = runtimeConfig.pollingEnabled
  const pollingIntervalMs = runtimeConfig.pollingIntervalMs
  const visibilityRefreshEnabled = runtimeConfig.visibilityRefreshEnabled

  const applyMockSnapshot = useCallback(
    () => {
      setInstances([])
      setUpdates(fallbackUpdates)
      setActiveDataSource('mock')
      setIsFallback(preferredDataSource === 'openclaw')
      liveInstancesRef.current = []
      liveUpdatesRef.current = fallbackUpdates
    },
    [preferredDataSource],
  )

  const fetchData = useCallback(async (signal: AbortSignal) => {
    if (preferredDataSource === 'mock') {
      applyMockSnapshot()
      return { lastSyncedAtMs: null, error: '' }
    }

    const raw = await loadOfficeInstances(runtimeConfig.officeInstancesApiPath, signal)
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

    return {
      lastSyncedAtMs: now,
      error: '',
    }
  }, [fallbackAgents, fallbackProjects, fallbackRooms, fallbackTasks, preferredDataSource, applyMockSnapshot])

  const { error, hasBootstrapped, isLoading, lastSyncedAtMs, refresh } = usePollingFetch({
    enabled: true,
    pollingEnabled: pollingEnabled && preferredDataSource === 'openclaw',
    pollingIntervalMs,
    visibilityRefreshEnabled: visibilityRefreshEnabled && preferredDataSource === 'openclaw',
    staleMs: runtimeConfig.staleMs,
    initialHasBootstrapped: runtimeConfig.preferredDataSource === 'mock',
    fetcher: fetchData,
    onError: (fetchError) => {
      if (runtimeConfig.fallbackToMock) {
        const fallbackMessage = 'OpenClaw 接口不可用，已自动回退到 Mock 数据'
        applyMockSnapshot()
        return { lastSyncedAtMs: null, error: fallbackMessage }
      }
      return {
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
      }
    },
  })

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
