import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fetchOfficeInstancesPayload } from './server/officeInstances'

const execFileAsync = promisify(execFile)

export default defineConfig(({ mode }) => {
  const isInternal = mode === 'internal'

  return {
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
        name: 'pwa-html-by-mode',
        transformIndexHtml(html) {
          if (!isInternal) return html
          return html
            .replace('/manifest.demo.webmanifest', '/manifest.internal.webmanifest')
            .replace(
              '<meta name="description" content="OpenClaw × KOTOVELA · 开源多实例协作演示（Mock）" />',
              '<meta name="description" content="KOTOVELA HUB · 内部驾驶舱：实例状态与项目跟进" />',
            )
            .replace(
              '<meta name="apple-mobile-web-app-title" content="O×KOTOVELA" />',
              '<meta name="apple-mobile-web-app-title" content="HUB" />',
            )
            .replace('<title>OpenClaw × KOTOVELA</title>', '<title>KOTOVELA HUB</title>')
        },
      },
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

          server.middlewares.use('/api/tasks-board', async (req, res, next) => {
            const filePath = path.resolve('/Users/ztl/OpenClaw-Runner/tasks-board.json')

            if (req.method === 'GET') {
              try {
                const payload = await fs.readFile(filePath, 'utf8')
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Cache-Control', 'no-store')
                res.end(payload)
              } catch (error) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: 'tasks-board fetch failed',
                    message: error instanceof Error ? error.message : String(error),
                  }),
                )
              }
              return
            }

            if (req.method === 'POST') {
              try {
                const chunks: Buffer[] = []
                for await (const chunk of req) chunks.push(Buffer.from(chunk))
                const bodyText = Buffer.concat(chunks).toString('utf8')
                const body = bodyText ? JSON.parse(bodyText) : {}
                const taskInput = String(body?.input || '').trim()
                if (!taskInput) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'missing input' }))
                  return
                }

                if (taskInput.startsWith('fail:')) {
                  throw new Error(taskInput.slice(5).trim() || '模拟失败')
                }

                await execFileAsync(process.execPath, ['simulate-fs-tasks.js', taskInput], {
                  cwd: '/Users/ztl/OpenClaw-Runner',
                  maxBuffer: 50 * 1024 * 1024,
                })

                const payload = await fs.readFile(filePath, 'utf8')
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(payload)
              } catch (error) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: 'tasks-board execute failed',
                    message: error instanceof Error ? error.message : String(error),
                  }),
                )
              }
              return
            }

            next()
          })
        },
      },
    ],
  }
})
