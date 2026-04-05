/**
 * 在 Mac mini（或任意已安装 openclaw CLI 的机器）上常驻运行，对外提供与 Vite dev 同形的 JSON。
 *
 * 启动示例：
 *   OFFICE_API_PORT=8787 OFFICE_API_TOKEN='你的密钥' OFFICE_API_CORS_ORIGIN='https://kotovelahub.vercel.app' npm run serve:office-api
 *
 * 外出访问：用 Cloudflare Tunnel / Tailscale Funnel / ngrok 等把本机端口暴露为 HTTPS，
 * 再在 Vercel internal 构建里设置 VITE_OFFICE_INSTANCES_API_PATH 指向该 HTTPS URL（含路径）。
 */
import http from 'node:http'
import { fetchOfficeInstancesPayload } from '../server/officeInstances.ts'

const PORT = Number.parseInt(process.env.OFFICE_API_PORT || '8787', 10)
const TOKEN = process.env.OFFICE_API_TOKEN?.trim()
const CORS_ORIGIN = process.env.OFFICE_API_CORS_ORIGIN?.trim() || '*'

const sendJson = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }

  if (req.method !== 'GET' || url.pathname !== '/api/office-instances') {
    sendJson(res, 404, { error: 'not_found' })
    return
  }

  if (TOKEN) {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : ''
    const queryToken = url.searchParams.get('token')?.trim() ?? ''
    if (bearer !== TOKEN && queryToken !== TOKEN) {
      sendJson(res, 401, { error: 'unauthorized' })
      return
    }
  }

  try {
    const payload = await fetchOfficeInstancesPayload()
    sendJson(res, 200, payload)
  } catch (error) {
    sendJson(res, 500, {
      error: 'office-instances fetch failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

const host = process.env.OFFICE_API_HOST?.trim() || '0.0.0.0'

server.listen(PORT, host, () => {
  console.log(
    `[office-api] listening http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${PORT}/api/office-instances`,
  )
  if (TOKEN) {
    console.log('[office-api] token auth enabled (Authorization: Bearer … or ?token=)')
  } else {
    console.warn('[office-api] OFFICE_API_TOKEN not set — only use behind VPN / tunnel with access control')
  }
})
