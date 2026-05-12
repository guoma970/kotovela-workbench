import type { Plugin } from 'vite'
import officeInstancesHandler from './officeInstances'

export function devApiPlugin(): Plugin {
  return {
    name: 'kotovela-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/office-instances', officeInstancesHandler)
    },
  }
}
