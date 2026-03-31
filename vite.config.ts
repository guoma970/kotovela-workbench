import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchOfficeInstancesPayload } from './server/officeInstances'

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  plugins: [
    react(),
    {
      name: 'office-instances-api',
      configureServer(server) {
        server.middlewares.use('/api/office-instances', async (req, res, next) => {
          if (req.method !== 'GET') {
            next()
            return
          }

          try {
            const payload = await fetchOfficeInstancesPayload()
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'office-instances fetch failed',
                message: error instanceof Error ? error.message : String(error),
              }),
            )
          }
        })
      },
    },
  ],
})
