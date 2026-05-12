import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useOfficeInstances } from '../../../data/useOfficeInstances'
import { UI_TERMS } from '../../../lib/uiTerms'
import type { Task } from '../../../types'

type BriefingTask = Omit<Task, 'status'> & {
  ageText?: string
  task_name?: string
  need_human?: boolean
  status?: string
  updated_at?: string
}

const isBusyAgent = (status?: string) => {
  const normalized = status?.toLowerCase()
  return Boolean(normalized) && normalized !== 'idle' && normalized !== 'blocked' && normalized !== 'blocker'
}

const getTaskTitle = (task?: BriefingTask) =>
  task?.task_name || task?.title || '任务详情暂未同步'

const getTaskAge = (task?: BriefingTask) =>
  task?.ageText || task?.updatedAt || task?.updated_at || '刚刚'

const isTodayLike = (value?: string) => {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  if (/(刚刚|秒|分钟|小时|just now|min|hour)/i.test(normalized)) return true

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false

  const today = new Date()
  return parsed.getFullYear() === today.getFullYear()
    && parsed.getMonth() === today.getMonth()
    && parsed.getDate() === today.getDate()
}

const isBlockedTask = (task: BriefingTask) =>
  task.status === 'blocker' || task.status === 'blocked'

const isWaitingTask = (task: BriefingTask) =>
  task.need_human === true || ['awaiting_decision', 'need_human', 'pending_decision'].includes(String(task.status))

export function TodayBriefing() {
  const { agents, tasks, updates } = useOfficeInstances()

  const briefing = useMemo(() => {
    const typedTasks = tasks as BriefingTask[]
    const blockedTasks = typedTasks.filter(isBlockedTask)
    const waitingTasks = typedTasks.filter(isWaitingTask)
    const doneTasks = typedTasks.filter((task) => task.status === 'done' && isTodayLike(task.updatedAt || task.updated_at))

    return {
      onlineCount: agents.filter((agent) => isBusyAgent(agent.status)).length,
      blockedCount: blockedTasks.length,
      waitingCount: waitingTasks.length,
      doneToday: doneTasks.length,
      firstBlocked: blockedTasks[0],
      firstWaiting: waitingTasks[0],
      latestUpdateTitle: updates[0]?.title,
    }
  }, [agents, tasks, updates])

  const rows = [
    briefing.blockedCount > 0
      ? {
          label: UI_TERMS.blocked,
          text: `${getTaskTitle(briefing.firstBlocked)}（已等 ${getTaskAge(briefing.firstBlocked)}）`,
          to: '/tasks?focus=blocker',
        }
      : null,
    briefing.waitingCount > 0
      ? {
          label: '待你拍板',
          text: getTaskTitle(briefing.firstWaiting),
          to: '/tasks?focus=waiting',
        }
      : null,
    briefing.doneToday > 0
      ? {
          label: '今天完成',
          text: `${briefing.doneToday} 件`,
          to: '/tasks?focus=done',
        }
      : null,
  ].filter((row): row is { label: string; text: string; to: string } => Boolean(row))

  return (
    <section className="today-briefing panel strong-card" aria-label="今日一句话">
      <div className="today-briefing-main">
        <p className="eyebrow">今日一句话</p>
        <h2>
          言町今天的状态：{briefing.onlineCount} 个{UI_TERMS.agent}在岗，{briefing.blockedCount} 件事卡住了，
          {briefing.waitingCount} 件等你拍板。
        </h2>
      </div>

      {rows.length > 0 ? (
        <div className="today-briefing-links" aria-label="今日重点">
          {rows.map((row) => (
            <NavLink key={row.label} className="today-briefing-link" to={row.to}>
              <span>{row.label}</span>
              <strong>{row.text}</strong>
            </NavLink>
          ))}
        </div>
      ) : (
        <p className="today-briefing-empty">
          当前没有卡住或待拍板事项{briefing.latestUpdateTitle ? `，最近动态：${briefing.latestUpdateTitle}` : '，可以继续推进。'}
        </p>
      )}
    </section>
  )
}
