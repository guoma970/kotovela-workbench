import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { createFocusSearch } from '../lib/workbenchLinking'
import type { UpdateItem } from '../types'
import type { ActionItem, HomeItem } from './Dashboard/components/DashboardOverviewSections'
import { DashboardInternalView, DashboardPublicView } from './Dashboard/components/DashboardPageViews'
import { AutoTaskSystemSummaryCard } from './Dashboard/components/DashboardAutoTaskCards'
import { useSystemMode } from './Dashboard/hooks/useSystemMode'
import { buildHomeItems, formatAgentTaskLine } from './Dashboard/lib/homeItems'

export function DashboardPage() {
  const systemModeState = useSystemMode()
  const {
    agents,
    projects,
    rooms,
    tasks,
    updates,
    isLoading,
    activeDataSource,
    isFallback,
    mode,
    instances,
    lastSyncedAtMs,
    pollingIntervalMs,
  } = useOfficeInstances()
  const navigate = useNavigate()
  const [actionMessage, setActionMessage] = useState<string>('')

  const items = useMemo(() => {
    const base = buildHomeItems(agents, projects, rooms, tasks)
    if (mode !== 'internal') return base
    return base.map((item) => ({
      ...item,
      taskLine: formatAgentTaskLine(tasks, item.agentId),
    }))
  }, [agents, projects, rooms, tasks, mode])
  const blockers = items.filter((item) => item.status === 'blocker')
  const actives = items.filter((item) => item.status === 'active')
  const idles = items.filter((item) => item.status === 'idle')
  const recentUpdates = updates.slice(0, 4)
  const showInternalCockpit = mode === 'internal'
  const liveOpenClaw = activeDataSource === 'openclaw' && !isFallback && instances.length > 0

  const openProject = (projectId: string) => {
    navigate({ pathname: '/projects', search: createFocusSearch('', 'project', projectId) })
  }

  const goFocus = (pathname: string, focusType: 'project' | 'agent' | 'room' | 'task', focusId?: string) => {
    if (!focusId) return
    navigate({ pathname, search: createFocusSearch('', focusType, focusId) })
  }

  const blockerActions = (item: HomeItem): ActionItem[] =>
    showInternalCockpit
      ? [
          {
            label: '同步任务',
            onClick: () => setActionMessage(`${item.name}：建议先触发任务同步；当前前端已提供入口占位，需后端接入同步动作。`),
          },
          {
            label: '进入房间',
            onClick: () => goFocus('/rooms', 'room', item.roomId),
            disabled: !item.roomId,
            quiet: true,
          },
          {
            label: '标记待处理',
            onClick: () => item.taskId
              ? goFocus('/tasks', 'task', item.taskId)
              : setActionMessage(`${item.name}：已标记为待处理（前端占位，等待后端写回任务状态）。`),
            quiet: true,
          },
        ]
      : [
          {
            label: '去处理',
            onClick: () => goFocus('/tasks', 'task', item.taskId || item.agentId),
            disabled: !item.taskId,
          },
          {
            label: '去频道',
            onClick: () => goFocus('/rooms', 'room', item.roomId),
            disabled: !item.roomId,
            quiet: true,
          },
          {
            label: '标记完成',
            onClick: () => setActionMessage(`${item.name} 的“标记完成”已预留，当前先做触发占位。`),
            quiet: true,
          },
        ]

  const activeActions = (item: HomeItem): ActionItem[] =>
    showInternalCockpit
      ? [
          {
            label: '查看任务',
            onClick: () => goFocus('/tasks', 'task', item.taskId),
            disabled: !item.taskId,
          },
          {
            label: '协作者详情',
            onClick: () => goFocus('/agents', 'agent', item.agentId),
            quiet: true,
          },
        ]
      : [
          {
            label: '查看任务',
            onClick: () => goFocus('/tasks', 'task', item.taskId),
            disabled: !item.taskId,
          },
          {
            label: '介入',
            onClick: () => goFocus('/agents', 'agent', item.agentId),
            quiet: true,
          },
          {
            label: '暂停',
            onClick: () => setActionMessage(`${item.name} 的“暂停”已预留，当前未接 workflow。`),
            quiet: true,
          },
        ]

  const idleActions = (item: HomeItem): ActionItem[] =>
    showInternalCockpit
      ? [
          {
            label: '打开协作者',
            onClick: () => goFocus('/agents', 'agent', item.agentId),
          },
        ]
      : [
          {
            label: '分配任务',
            onClick: () => goFocus('/agents', 'agent', item.agentId),
          },
          {
            label: '拉入项目',
            onClick: () => goFocus('/projects', 'project', item.projectId),
            quiet: true,
            disabled: !item.projectId,
          },
        ]

  const viewUpdateDetail = (update: UpdateItem) => {
    if (update.taskId) {
      goFocus('/tasks', 'task', update.taskId)
      return
    }
    if (update.roomId) {
      goFocus('/rooms', 'room', update.roomId)
      return
    }
    if (update.agentId) {
      goFocus('/agents', 'agent', update.agentId)
      return
    }
    if (update.projectId) {
      goFocus('/projects', 'project', update.projectId)
      return
    }
    setActionMessage(`更新 ${update.id} 暂无详情目标。`)
  }

  if (showInternalCockpit) {
    return (
      <DashboardInternalView
        actionMessage={actionMessage}
        liveOpenClaw={liveOpenClaw}
        isLoading={isLoading}
        activeDataSource={activeDataSource}
        isFallback={isFallback}
        agents={agents}
        projects={projects}
        blockers={blockers}
        actives={actives}
        recentUpdates={recentUpdates}
        blockerActions={blockerActions}
        activeActions={activeActions}
        onViewUpdateDetail={viewUpdateDetail}
        onOpenProject={openProject}
        onOpenAgentsPage={() => navigate('/agents')}
        lastSyncedAtMs={lastSyncedAtMs}
        pollingIntervalMs={pollingIntervalMs}
        systemModeState={systemModeState}
        autoTaskSummaryCard={<AutoTaskSystemSummaryCard />}
      />
    )
  }

  return (
    <DashboardPublicView
      actionMessage={actionMessage}
      activeDataSource={activeDataSource}
      isFallback={isFallback}
      isLoading={isLoading}
      blockers={blockers}
      actives={actives}
      idles={idles}
      recentUpdates={recentUpdates}
      blockerActions={blockerActions}
      activeActions={activeActions}
      idleActions={idleActions}
      onViewUpdateDetail={viewUpdateDetail}
    />
  )
}
