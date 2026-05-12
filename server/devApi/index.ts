import type { Plugin } from 'vite'
import modelUsageHandler from './modelUsage'
import officeInstancesHandler from './officeInstances'
import { createSystemModeHandler } from './systemMode'

type DevApiPluginOptions = {
  isInternal?: boolean
}

export function devApiPlugin({ isInternal = false }: DevApiPluginOptions = {}): Plugin {
  return {
    name: 'kotovela-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/office-instances', officeInstancesHandler)
      server.middlewares.use('/api/model-usage', modelUsageHandler)
      server.middlewares.use('/api/system-mode', createSystemModeHandler({ isInternal }))
    },
  }
}
