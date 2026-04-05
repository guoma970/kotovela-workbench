import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { createFocusSearch } from '../lib/workbenchLinking'
import type { Agent, Project, Room, Task, UpdateItem } from '../types'

type HomeStatus = 'blocker' | 'active' | 'idle'

type HomeItem = {
  id: string
  name: string
  status: HomeStatus
  sentence: string
  updatedAt: string
  taskId?: string
  roomId?: string
  projectId?: string
  agentId: string
}

const normalizeSentence = (value?: string) => value?.trim() || 'No active task'

const buildHomeItems = (agents: Agent[], projects: Project[], rooms: Room[], tasks: Task[]): HomeItem[] => {
  return agents.map((agent) => {
    const relatedTasks = tasks.filter((task) => task.executorAgentId === agent.id)
    const blockerTask = relatedTasks.find((task) => task.status === 'blocked')
    const doingTask = relatedTasks.find((task) => task.status === 'doing')
    const relatedRoom = rooms.find((room) => room.instanceIds.includes(agent.id))
    const projectName = projects.find((project) => project.id === agent.projectId)?.name || agent.project

    if (agent.status === 'blocked' || blockerTask) {
      return {
        id: agent.id,
        name: agent.name,
        status: 'blocker',
        sentence: normalizeSentence(blockerTask?.title || agent.currentTask || `${projectName} has a blocker`),
        updatedAt: agent.updatedAt,
        taskId: blockerTask?.id,
        roomId: relatedRoom?.id,
        projectId: agent.projectId,
        agentId: agent.id,
      }
    }

    if (agent.status === 'active' || doingTask) {
      return {
        id: agent.id,
        name: agent.name,
        status: 'active',
        sentence: normalizeSentence(doingTask?.title || agent.currentTask),
        updatedAt: agent.updatedAt,
        taskId: doingTask?.id,
        roomId: relatedRoom?.id,
        projectId: agent.projectId,
        agentId: agent.id,
      }
    }

    return {
      id: agent.id,
      name: agent.name,
      status: 'idle',
      sentence: normalizeSentence(agent.currentTask || `${projectName} has no active work`),
      updatedAt: agent.updatedAt,
      roomId: relatedRoom?.id,
      projectId: agent.projectId,
      agentId: agent.id,
    }
  })
}

const badgeLabel: Record<HomeStatus, string> = {
  blocker: 'BLOCKER',
  active: 'ACTIVE',
  idle: 'IDLE',
}

type ActionItem = {
  label: string
  onClick: () => void
  disabled?: boolean
  quiet?: boolean
}

function ActionRow({ actions }: { actions: ActionItem[] }) {
  if (actions.length === 0) {
    return null
  }

  return (
    <div className="home-actions">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className={action.quiet ? 'home-action home-action-quiet' : 'home-action'}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

function SectionList({
  title,
  items,
  emptyText,
  getActions,
}: {
  title: string
  items: HomeItem[]
  emptyText: string
  getActions: (item: HomeItem) => ActionItem[]
}) {
  return (
    <section className="home-section panel strong-card">
      <div className="home-section-head">
        <h3>{title}</h3>
        <span className="home-count">{items.length}</span>
      </div>

      {items.length > 0 ? (
        <div className="home-list">
          {items.map((item) => (
            <article key={item.id} className={`home-item home-item-${item.status}`}>
              <div className="home-item-top">
                <strong>{item.name}</strong>
                <span className={`home-badge home-badge-${item.status}`}>{badgeLabel[item.status]}</span>
              </div>
              <p>{item.sentence}</p>
              <div className="home-item-meta">Updated {item.updatedAt}</div>
              <ActionRow actions={getActions(item)} />
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">{emptyText}</p>
      )}
    </section>
  )
}

function RecentUpdates({
  updates,
  onViewDetail,
}: {
  updates: UpdateItem[]
  onViewDetail: (update: UpdateItem) => void
}) {
  return (
    <section className="home-section panel strong-card">
      <div className="home-section-head">
        <h3>Recent Updates</h3>
        <span className="home-count">{updates.length}</span>
      </div>

      {updates.length > 0 ? (
        <div className="home-list">
          {updates.map((update) => (
            <article key={update.id} className="home-item home-item-update">
              <div className="home-item-top">
                <strong>{update.source}</strong>
                <span className="home-time">{update.time}</span>
              </div>
              <p>{update.title}</p>
              <ActionRow actions={[{ label: '查看详情', onClick: () => onViewDetail(update) }]} />
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">No recent updates.</p>
      )}
    </section>
  )
}

export function DashboardPage() {
  const { agents, projects, rooms, tasks, updates, isLoading, activeDataSource, isFallback } = useOfficeInstances()
  const navigate = useNavigate()
  const [actionMessage, setActionMessage] = useState<string>('')

  const items = useMemo(() => buildHomeItems(agents, projects, rooms, tasks), [agents, projects, rooms, tasks])
  const blockers = items.filter((item) => item.status === 'blocker')
  const actives = items.filter((item) => item.status === 'active')
  const idles = items.filter((item) => item.status === 'idle')
  const recentUpdates = updates.slice(0, 4)

  const goFocus = (pathname: string, focusType: 'project' | 'agent' | 'room' | 'task', focusId?: string) => {
    if (!focusId) return
    navigate({ pathname, search: createFocusSearch('', focusType, focusId) })
  }

  const blockerActions = (item: HomeItem): ActionItem[] => [
    {
      label: '去处理',
      onClick: () => goFocus('/tasks', 'task', item.taskId || item.agentId),
      disabled: !item.taskId,
    },
    {
      label: '去房间',
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

  const activeActions = (item: HomeItem): ActionItem[] => [
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

  const idleActions = (item: HomeItem): ActionItem[] => [
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

  return (
    <section className="page home-page-v1">
      <div className="page-header home-header">
        <div>
          <p className="eyebrow">KOTOVELA HUB</p>
          <h2>KOTOVELA HUB</h2>
        </div>
        <p className="page-note">
          Real-time internal status is visible here. Current data source: {activeDataSource === 'openclaw' ? 'OpenClaw' : 'Mock'}
          {isFallback ? ' (fallback)' : ''}
          {isLoading ? ' · refreshing' : ' · live status visible'}
        </p>
      </div>

      <div className="home-runtime-strip">
        <span className={`home-runtime-pill ${activeDataSource === 'openclaw' ? 'is-live' : ''}`}>
          数据源：{activeDataSource === 'openclaw' ? 'OpenClaw' : 'Mock'}
        </span>
        <span className="home-runtime-pill">刷新状态：{isLoading ? '更新中' : '已展示最新状态'}</span>
        <span className="home-runtime-pill">模式：Internal</span>
        {isFallback ? <span className="home-runtime-pill">当前 fallback 到 Mock</span> : null}
      </div>

      {actionMessage ? <div className="home-action-feedback">{actionMessage}</div> : null}

      <div className="home-v1-grid">
        <SectionList title="Blocker" items={blockers} emptyText="No blockers right now." getActions={blockerActions} />
        <SectionList title="Active" items={actives} emptyText="No active items right now." getActions={activeActions} />
        <SectionList title="Idle" items={idles} emptyText="No idle items right now." getActions={idleActions} />
        <RecentUpdates updates={recentUpdates} onViewDetail={viewUpdateDetail} />
      </div>
    </section>
  )
}
