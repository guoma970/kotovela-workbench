import type { Plugin } from 'vite'
import modelUsageHandler from './modelUsage'
import officeInstancesHandler from './officeInstances'

export function devApiPlugin(): Plugin {
  return {
    name: 'kotovela-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/office-instances', officeInstancesHandler)
      server.middlewares.use('/api/model-usage', modelUsageHandler)
    },
  }
}
