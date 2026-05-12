import type { Plugin } from 'vite'
import auditLogHandler from './auditLog'
import modelUsageHandler from './modelUsage'
import officeInstancesHandler from './officeInstances'
import { createSystemModeHandler } from './systemMode'
import { createTasksBoardHandler } from './tasksBoard'

type DevApiPluginOptions = {
  isInternal?: boolean
  tasksBoard?: Record<string, unknown>
}

export function devApiPlugin({ isInternal = false, tasksBoard }: DevApiPluginOptions = {}): Plugin {
  return {
    name: 'kotovela-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/office-instances', officeInstancesHandler)
      server.middlewares.use('/api/model-usage', modelUsageHandler)
      server.middlewares.use('/api/system-mode', createSystemModeHandler({ isInternal }))
      server.middlewares.use('/api/audit-log', auditLogHandler)
      if (tasksBoard) {
        server.middlewares.use('/api/tasks-board', createTasksBoardHandler(tasksBoard))
      }
    },
  }
}
