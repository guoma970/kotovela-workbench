import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchModelUsagePayload } from '../server/modelUsage.js'

const configuredAllowedOrigin = process.env.ALLOWED_ORIGIN?.trim()

const isLocalHostHeader = (host: string) =>
  host.includes('localhost') ||
  host.startsWith('127.0.0.1') ||
  host.startsWith('0.0.0.0') ||
  host.startsWith('[::1]') ||
  /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(host)

const normalizeOrigin = (value: string) => {
  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}

const resolveAllowedOrigin = (req: VercelRequest) => {
  if (configuredAllowedOrigin) return configuredAllowedOrigin
  const host = req.headers.host?.trim()
  if (!host) return undefined
  const requestOrigin = typeof req.headers.origin === 'string' ? normalizeOrigin(req.headers.origin.trim()) : undefined
  if (requestOrigin) {
    const originHost = new URL(requestOrigin).host
    if (originHost === host) return requestOrigin
    return undefined
  }
  if (!isLocalHostHeader(host)) return undefined
  const protocol = isLocalHostHeader(host) ? 'http' : 'https'
  return `${protocol}://${host}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = resolveAllowedOrigin(req)
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Vary', 'Origin, Host')
  res.setHeader('Cache-Control', 'no-store, max-age=0')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  try {
    const payload = await fetchModelUsagePayload()
    res.status(200).json(payload)
  } catch (error) {
    res.status(200).json({
      generated_at: new Date().toISOString(),
      source: 'unavailable',
      window_hours: 24,
      agents: [],
      recent_usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        messageCount: 0,
        by_model: [],
        by_agent: [],
      },
      warnings: [`model usage unavailable: ${error instanceof Error ? error.message : String(error)}`],
    })
  }
}
