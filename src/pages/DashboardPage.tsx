import { useMemo } from 'react'
import { useOfficeInstances } from '../data/useOfficeInstances'
import type { Agent, Project, Task, UpdateItem } from '../types'

type HomeStatus = 'blocker' | 'active' | 'idle'

type HomeItem = {
  id: string
  name: string
  status: HomeStatus
  sentence: string
  updatedAt: string
}

const normalizeSentence = (value?: string) => value?.trim() || '暂无任务'

const buildHomeItems = (agents: Agent[], projects: Project[], tasks: Task[]): HomeItem[] => {
  return agents.map((agent) => {
    const relatedTasks = tasks.filter((task) => task.executorAgentId === agent.id)
    const blockerTask = relatedTasks.find((task) => task.status === 'blocked')
    const doingTask = relatedTasks.find((task) => task.status === 'doing')
    const projectName = projects.find((project) => project.id === agent.projectId)?.name || agent.project

    if (agent.status === 'blocked' || blockerTask) {
      return {
        id: agent.id,
        name: agent.name,
        status: 'blocker',
        sentence: normalizeSentence(blockerTask?.title || agent.currentTask || `${projectName} 存在阻塞项`),
        updatedAt: agent.updatedAt,
      }
    }

    if (agent.status === 'active' || doingTask) {
      return {
        id: agent.id,
        name: agent.name,
        status: 'active',
        sentence: normalizeSentence(doingTask?.title || agent.currentTask),
        updatedAt: agent.updatedAt,
      }
    }

    return {
      id: agent.id,
      name: agent.name,
      status: 'idle',
      sentence: normalizeSentence(agent.currentTask || `${projectName} 暂无进行中事项`),
      updatedAt: agent.updatedAt,
    }
  })
}

const badgeLabel: Record<HomeStatus, string> = {
  blocker: 'BLOCKER',
  active: 'ACTIVE',
  idle: 'IDLE',
}

function SectionList({ title, items, emptyText }: { title: string; items: HomeItem[]; emptyText: string }) {
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
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">{emptyText}</p>
      )}
    </section>
  )
}

function RecentUpdates({ updates }: { updates: UpdateItem[] }) {
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
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">暂无更新。</p>
      )}
    </section>
  )
}

export function DashboardPage() {
  const { agents, projects, tasks, updates, isLoading, activeDataSource, isFallback } = useOfficeInstances()

  const items = useMemo(() => buildHomeItems(agents, projects, tasks), [agents, projects, tasks])
  const blockers = items.filter((item) => item.status === 'blocker')
  const actives = items.filter((item) => item.status === 'active')
  const idles = items.filter((item) => item.status === 'idle')
  const recentUpdates = updates.slice(0, 4)

  return (
    <section className="page home-page-v1">
      <div className="page-header home-header">
        <div>
          <p className="eyebrow">Internal Home v1</p>
          <h2>Internal 控制台首页</h2>
        </div>
        <p className="page-note">
          只保留状态和一句话任务。当前数据源：{activeDataSource === 'openclaw' ? 'OpenClaw' : 'Mock'}
          {isFallback ? '（fallback）' : ''}
          {isLoading ? ' · 刷新中' : ''}
        </p>
      </div>

      <div className="home-v1-grid">
        <SectionList title="Blocker" items={blockers} emptyText="当前没有 blocker。" />
        <SectionList title="Active" items={actives} emptyText="当前没有 active 项。" />
        <SectionList title="Idle" items={idles} emptyText="当前没有 idle 项。" />
        <RecentUpdates updates={recentUpdates} />
      </div>
    </section>
  )
}
