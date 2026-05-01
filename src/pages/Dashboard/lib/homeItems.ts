import type { Agent, Project, Room, Task } from '../../../types'
import type { HomeItem } from '../components/DashboardOverviewSections'

export function formatAgentTaskLine(tasks: Task[], agentId: string): string | undefined {
  const mine = tasks.filter((task) => task.executorAgentId === agentId)
  if (mine.length === 0) return undefined

  let doing = 0
  let blocked = 0
  let done = 0
  let todo = 0
  for (const task of mine) {
    if (task.status === 'doing') doing++
    else if (task.status === 'blocked') blocked++
    else if (task.status === 'done') done++
    else if (task.status === 'todo') todo++
  }

  const parts = [`进行中 ${doing}`, `阻塞 ${blocked}`, `已完成 ${done}`]
  if (todo > 0) parts.push(`待办 ${todo}`)
  return `任务 ${mine.length} 条 · ${parts.join(' · ')}`
}

const normalizeSentence = (value?: string) => value?.trim() || '暂无明确任务'

const shortText = (value: string, max = 56): string => {
  const text = value.trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

const humanizeBlockerText = (value: string): string => {
  const normalized = value
    .replace(/超过\s*480\s*分钟未见会话上报/g, '8 小时内未收到会话上报，建议先同步任务并进入房间确认实例是否离线')
    .replace(/480\s*分钟未见会话上报/g, '8 小时内未收到会话上报，建议同步任务并检查房间')
  return shortText(normalized, 88)
}

export function buildHomeItems(agents: Agent[], projects: Project[], rooms: Room[], tasks: Task[]): HomeItem[] {
  return agents.map((agent) => {
    const relatedTasks = tasks.filter((task) => task.executorAgentId === agent.id)
    const blockerTask = relatedTasks.find((task) => task.status === 'blocked')
    const doingTask = relatedTasks.find((task) => task.status === 'doing')
    const relatedRoom = rooms.find((room) => room.instanceIds.includes(agent.id))
    const relatedProject = projects.find((project) => project.id === agent.projectId)
    const projectName = relatedProject?.name || agent.project
    const projectProgress = Number.isFinite(relatedProject?.progress) ? relatedProject!.progress : 0
    const roomName = relatedRoom?.name || '未绑定房间'
    const blockedText = humanizeBlockerText(blockerTask?.title || agent.currentTask || '阻塞事项待处理')
    const doingText = shortText(doingTask?.title || agent.currentTask || '执行事项待补充')
    const idleText = shortText(agent.currentTask || '等待任务分派')

    if (agent.status === 'blocked' || blockerTask) {
      return {
        id: agent.id,
        name: agent.name,
        status: 'blocker',
        sentence: normalizeSentence(`在 ${roomName} 阻塞：${blockedText} · 项目 ${projectName}（${projectProgress}%）`),
        updatedAt: agent.updatedAt,
        taskId: blockerTask?.id,
        roomId: relatedRoom?.id,
        projectId: agent.projectId,
        agentId: agent.id,
        instanceKey: agent.instanceKey,
      }
    }

    if (agent.status === 'active' || doingTask) {
      return {
        id: agent.id,
        name: agent.name,
        status: 'active',
        sentence: normalizeSentence(`在 ${roomName} 推进：${doingText} · 项目 ${projectName}（${projectProgress}%）`),
        updatedAt: agent.updatedAt,
        taskId: doingTask?.id,
        roomId: relatedRoom?.id,
        projectId: agent.projectId,
        agentId: agent.id,
        instanceKey: agent.instanceKey,
      }
    }

    return {
      id: agent.id,
      name: agent.name,
      status: 'idle',
      sentence: normalizeSentence(`待命于 ${roomName} · 当前关注：${idleText} · 项目 ${projectName}（${projectProgress}%）`),
      updatedAt: agent.updatedAt,
      roomId: relatedRoom?.id,
      projectId: agent.projectId,
      agentId: agent.id,
      instanceKey: agent.instanceKey,
    }
  })
}
