import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchOfficeInstancesPayload } from '../server/officeInstances.js'

const upstreamUrl = process.env.OFFICE_INSTANCES_UPSTREAM_URL?.trim()
const upstreamToken = process.env.OFFICE_INSTANCES_UPSTREAM_TOKEN?.trim()
const configuredAllowedOrigin = process.env.ALLOWED_ORIGIN?.trim()
const upstreamAllowedHosts = new Set(
  (process.env.OFFICE_INSTANCES_UPSTREAM_ALLOW_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
)

const isPrivateHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase()
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(normalized)) return true
  if (normalized.endsWith('.local') || normalized.endsWith('.internal')) return true
  if (/^10\./.test(normalized)) return true
  if (/^192\.168\./.test(normalized)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true
  if (/^169\.254\./.test(normalized)) return true
  return false
}

const parseSafeUpstreamUrl = (value: string) => {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('OFFICE_INSTANCES_UPSTREAM_URL is not a valid URL')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('OFFICE_INSTANCES_UPSTREAM_URL must use https')
  }

  if (isPrivateHostname(parsed.hostname)) {
    throw new Error('OFFICE_INSTANCES_UPSTREAM_URL must not target localhost or private networks')
  }

  if (upstreamAllowedHosts.size > 0 && !upstreamAllowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error('OFFICE_INSTANCES_UPSTREAM_URL host is not allowlisted')
  }

  return parsed.toString()
}

const isLocalHostHeader = (host: string) =>
  host.includes('localhost') ||
  host.startsWith('127.0.0.1') ||
  host.startsWith('0.0.0.0') ||
  host.startsWith('[::1]') ||
  /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(host)

const resolveAllowedOrigin = (req: VercelRequest) => {
  if (configuredAllowedOrigin) return configuredAllowedOrigin
  const host = req.headers.host?.trim()
  if (!host) return undefined
  const protocol = isLocalHostHeader(host) ? 'http' : 'https'
  return `${protocol}://${host}`
}

const fetchUpstreamPayload = async () => {
  if (!upstreamUrl) {
    return null
  }

  const safeUpstreamUrl = parseSafeUpstreamUrl(upstreamUrl)

  const response = await fetch(safeUpstreamUrl, {
    headers: upstreamToken ? { Authorization: `Bearer ${upstreamToken}` } : undefined,
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`office upstream responded ${response.status}`)
  }

  return response.json()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = resolveAllowedOrigin(req)
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Vary', 'Origin, Host')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0')

  try {
    const payload = (await fetchUpstreamPayload()) ?? (await fetchOfficeInstancesPayload())
    res.status(200).json(payload)
  } catch (error) {
    try {
      const fallbackPayload = await fetchOfficeInstancesPayload()
      res.status(200).json(fallbackPayload)
    } catch (fallbackError) {
      res.status(500).json({
        error: 'office-instances fetch failed',
        message: error instanceof Error ? error.message : String(error),
        fallbackMessage: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      })
    }
  }
}
