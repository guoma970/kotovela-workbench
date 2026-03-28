import { NavLink } from 'react-router-dom'
import { agents, projects, rooms, tasks, updates } from '../data/mockData'
import {
  buildRelationScope,
  createFocusSearch,
  getFocusSummary,
  parseFocusFromSearchParams,
} from '../lib/workbenchLinking'

const pageData = { projects, agents, rooms, tasks }

const pageLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/agents', label: 'Agents' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/rooms', label: 'Rooms' },
]

export function FocusSummaryBar({ search, pathname, onClear }: { search: string; pathname: string; onClear?: () => void }) {
  const searchParams = new URLSearchParams(search)
  const focus = parseFocusFromSearchParams(searchParams)
  const summary = getFocusSummary(focus, pageData)

  if (!summary) return null

  const relationScope = buildRelationScope(focus, pageData)
  const blockerCount = tasks.filter((task) => relationScope.taskIds.has(task.id) && task.status === 'blocked').length
  const criticalUpdateCount = updates.filter(
    (item) =>
      (item.projectId && relationScope.projectIds.has(item.projectId)) ||
      (item.agentId && relationScope.agentIds.has(item.agentId)) ||
      (item.roomId && relationScope.roomIds.has(item.roomId)) ||
      (item.taskId && relationScope.taskIds.has(item.taskId)),
  ).length

  return (
    <section className="panel focus-banner focus-summary-bar strong-card">
      {onClear && (
        <button
          type="button"
          className="focus-close-action"
          onClick={onClear}
          aria-label="关闭联动卡片"
          title="关闭联动卡片"
        >
          ×
        </button>
      )}
      <div className="focus-summary-main">
        <div className="focus-summary-meta">
          <p className="eyebrow">Cross-page Focus</p>
          <h3>
            {summary.label}：{summary.value}
          </h3>
          <p className="page-note">当前上下文会跟着你跨页保留，相关项目、实例、任务和房间会继续联动高亮。</p>
        </div>

        <div className="focus-metrics">
          <div className="focus-metric">
            <span>任务</span>
            <strong>{relationScope.taskIds.size}</strong>
          </div>
          <div className="focus-metric">
            <span>房间</span>
            <strong>{relationScope.roomIds.size}</strong>
          </div>
          <div className="focus-metric">
            <span>实例</span>
            <strong>{relationScope.agentIds.size}</strong>
          </div>
          <div className="focus-metric">
            <span>blocker</span>
            <strong>{blockerCount}</strong>
          </div>
          <div className="focus-metric">
            <span>关键更新</span>
            <strong>{criticalUpdateCount}</strong>
          </div>
        </div>
      </div>

      <div className="focus-summary-actions">
        <div className="focus-nav-links">
          {pageLinks.map((item) => {
            const isCurrent = pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={{ pathname: item.to, search: createFocusSearch(searchParams) }}
                end={item.to === '/'}
                className={isCurrent ? 'focus-page-link focus-page-link-active' : 'focus-page-link'}
              >
                查看相关项 · {item.label}
              </NavLink>
            )
          })}
        </div>
      </div>
    </section>
  )
}
