import type { Plugin } from 'vite'
import auditLogHandler from './auditLog'
import { createConsultantsHandler } from './consultants'
import { createContentFeedbackHandler } from './contentFeedback'
import { createLeadStatsHandler } from './leadStats'
import { createLeadUpdateHandler } from './leadUpdate'
import { createLeadsHandler } from './leads'
import { createMemoryHandler } from './memory'
import modelUsageHandler from './modelUsage'
import officeInstancesHandler from './officeInstances'
import { createProfileHandler } from './profile'
import { createSystemModeHandler } from './systemMode'
import { createTasksBoardHandler } from './tasksBoard'

type DevApiPluginOptions = {
  consultants?: Record<string, unknown>
  contentFeedback?: Record<string, unknown>
  isInternal?: boolean
  leadStats?: Record<string, unknown>
  leadUpdate?: Record<string, unknown>
  leads?: Record<string, unknown>
  memory?: Record<string, unknown>
  profile?: Record<string, unknown>
  tasksBoard?: Record<string, unknown>
}

export function devApiPlugin({ consultants, contentFeedback, isInternal = false, leadStats, leadUpdate, leads, memory, profile, tasksBoard }: DevApiPluginOptions = {}): Plugin {
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
      if (leads) {
        server.middlewares.use('/api/leads', createLeadsHandler(leads))
      }
      if (consultants) {
        server.middlewares.use('/api/consultants', createConsultantsHandler(consultants))
      }
      if (leadUpdate) {
        server.middlewares.use('/api/lead-update', createLeadUpdateHandler(leadUpdate))
      }
      if (leadStats) {
        server.middlewares.use('/api/lead-stats', createLeadStatsHandler(leadStats))
      }
      if (memory) {
        server.middlewares.use('/api/memory', createMemoryHandler(memory))
      }
      if (contentFeedback) {
        server.middlewares.use('/api/content-feedback', createContentFeedbackHandler(contentFeedback))
      }
      if (profile) {
        server.middlewares.use('/api/profile', createProfileHandler(profile))
      }
    },
  }
}
