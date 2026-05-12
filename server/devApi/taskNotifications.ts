import type { IncomingMessage, ServerResponse } from 'node:http'

type TaskNotificationRecord = Record<string, unknown>

type TaskNotificationsDeps = {
  readTaskNotifications: () => Promise<TaskNotificationRecord[]>
}

const getDeps = (deps: Record<string, unknown>): TaskNotificationsDeps => ({
  readTaskNotifications: deps.readTaskNotifications as TaskNotificationsDeps['readTaskNotifications'],
})

export function createTaskNotificationsHandler(rawDeps: Record<string, unknown>) {
  const { readTaskNotifications } = getDeps(rawDeps)

  return async function taskNotificationsHandler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method !== 'GET') {
      next()
      return
    }

    try {
      const notifications = await readTaskNotifications()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ notifications }))
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: 'task-notifications fetch failed',
          message: error instanceof Error ? error.message : String(error),
        }),
      )
    }
  }
}
