import type { IncomingMessage, ServerResponse } from 'node:http'

type TaskBoardItem = Record<string, unknown> & {
  task_name: string
  agent?: string
  assigned_agent?: string
  domain?: string
  human_owner?: string
  manual_decision?: string
  notify_mode?: string
  project_line?: string
  status?: string
  subdomain?: string
  target_group_id?: string
  updated_at?: string
}

type TaskBoardPayload = Record<string, unknown> & {
  board: TaskBoardItem[]
  generated_at?: string
}

type TaskNotificationRecord = Record<string, unknown>

type TaskNotificationActionsDeps = {
  taskBoardFile: string
  readTaskBoard: (filePath: string) => Promise<TaskBoardPayload>
  writeTaskBoard: (filePath: string, payload: TaskBoardPayload) => Promise<void>
  readTaskNotifications: () => Promise<TaskNotificationRecord[]>
  writeTaskNotifications: (notifications: TaskNotificationRecord[]) => Promise<void>
  toTaskId: (taskName: string) => string
  applyManualTaskAction: (target: TaskBoardItem, action: string, humanOwner: string, now: string) => Promise<void> | void
  normalizeNotifyDomain: (value?: string) => string
}

const getDeps = (deps: Record<string, unknown>): TaskNotificationActionsDeps => ({
  taskBoardFile: deps.taskBoardFile as TaskNotificationActionsDeps['taskBoardFile'],
  readTaskBoard: deps.readTaskBoard as TaskNotificationActionsDeps['readTaskBoard'],
  writeTaskBoard: deps.writeTaskBoard as TaskNotificationActionsDeps['writeTaskBoard'],
  readTaskNotifications: deps.readTaskNotifications as TaskNotificationActionsDeps['readTaskNotifications'],
  writeTaskNotifications: deps.writeTaskNotifications as TaskNotificationActionsDeps['writeTaskNotifications'],
  toTaskId: deps.toTaskId as TaskNotificationActionsDeps['toTaskId'],
  applyManualTaskAction: deps.applyManualTaskAction as TaskNotificationActionsDeps['applyManualTaskAction'],
  normalizeNotifyDomain: deps.normalizeNotifyDomain as TaskNotificationActionsDeps['normalizeNotifyDomain'],
})

const readBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const bodyText = Buffer.concat(chunks).toString('utf8')
  return bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {}
}

export function createTaskNotificationActionsHandler(rawDeps: Record<string, unknown>) {
  const {
    taskBoardFile,
    readTaskBoard,
    writeTaskBoard,
    readTaskNotifications,
    writeTaskNotifications,
    toTaskId,
    applyManualTaskAction,
    normalizeNotifyDomain,
  } = getDeps(rawDeps)

  return async function taskNotificationActionsHandler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method !== 'POST') {
      next()
      return
    }

    try {
      const body = await readBody(req)
      const groupAction = String(body.group_action || body.action || '').trim()
      const taskId = String(body.task_id || '').trim()
      const taskName = String(body.task_name || '').trim()
      const domain = String(body.domain || '').trim()
      const assignedAgent = String(body.assigned_agent || '').trim()
      const humanOwner = String(body.human_owner || body.operator || assignedAgent || 'builder').trim()

      const actionMap: Record<string, string> = {
        done: 'manual_done',
        processed: 'manual_done',
        continue: 'manual_continue',
        transfer: 'assign',
        assign: 'assign',
      }
      const mappedAction = actionMap[groupAction]
      if (!mappedAction) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'unsupported group_action' }))
        return
      }

      const payload = await readTaskBoard(taskBoardFile)
      const target = payload.board.find((item) => toTaskId(item.task_name) === taskId)
        ?? payload.board.find((item) => item.task_name === taskName)
        ?? payload.board.find((item) => (item.domain ?? '') === domain && (item.assigned_agent ?? item.agent ?? '') === assignedAgent)

      if (!target) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'task not found' }))
        return
      }

      const now = new Date().toISOString()
      await applyManualTaskAction(target, mappedAction, humanOwner, now)
      target.updated_at = now
      payload.generated_at = now
      await writeTaskBoard(taskBoardFile, payload)

      const notifications = await readTaskNotifications()
      notifications.unshift({
        id: `${now}-${toTaskId(target.task_name)}-${groupAction}`,
        event_type: 'task_need_human',
        task_id: toTaskId(target.task_name),
        task_name: target.task_name,
        domain: normalizeNotifyDomain(target.domain),
        subdomain: target.subdomain ?? 'engineering',
        project_line: target.project_line ?? 'builder_default',
        notify_mode: target.notify_mode ?? 'need_human',
        assigned_agent: target.assigned_agent ?? target.agent ?? 'builder',
        status: target.status ?? '-',
        summary: `群内动作已回写：${groupAction}`,
        target_group: 'Mock Feishu 群动作',
        target_group_id: target.target_group_id ?? 'mock_group_action',
        target_channel: target.domain ?? 'builder',
        scheduler_hint: '群动作已同步到 Scheduler',
        created_at: now,
        delivery: 'mock',
        message: [
          '【群内动作已回写】',
          `task_id：${toTaskId(target.task_name)}`,
          `task_name：${target.task_name}`,
          `domain：${normalizeNotifyDomain(target.domain)}`,
          `assigned_agent：${target.assigned_agent ?? target.agent ?? 'builder'}`,
          `group_action：${groupAction}`,
          `human_owner：${humanOwner}`,
          `manual_decision：${target.manual_decision ?? '-'}`,
        ].join('\n'),
      })
      await writeTaskNotifications(notifications.slice(0, 60))

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, task_name: target.task_name, manual_decision: target.manual_decision }))
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: 'task-notification-action failed',
          message: error instanceof Error ? error.message : String(error),
        }),
      )
    }
  }
}
