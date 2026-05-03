import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { fetchModelUsagePayload } from '../server/modelUsage.js'

const usageBucketSchema = z
  .object({
    key: z.string(),
    label: z.string().optional(),
    input: z.number().finite().nonnegative(),
    output: z.number().finite().nonnegative(),
    cacheRead: z.number().finite().nonnegative(),
    cacheWrite: z.number().finite().nonnegative(),
    totalTokens: z.number().finite().nonnegative(),
    messageCount: z.number().finite().nonnegative(),
  })
  .passthrough()

const modelUsagePayloadSchema = z
  .object({
    generated_at: z.string(),
    source: z.enum(['local-openclaw', 'partial', 'unavailable']),
    window_hours: z.number().finite().positive(),
    codex_usage: z
      .object({
        five_hour_left_pct: z.number().finite().optional(),
        week_left_pct: z.number().finite().optional(),
        raw_line: z.string().optional(),
      })
      .passthrough()
      .optional(),
    claude_code_usage: z.record(z.string(), z.unknown()).optional(),
    agents: z.array(z.record(z.string(), z.unknown())),
    recent_usage: z
      .object({
        input: z.number().finite().nonnegative(),
        output: z.number().finite().nonnegative(),
        cacheRead: z.number().finite().nonnegative(),
        cacheWrite: z.number().finite().nonnegative(),
        totalTokens: z.number().finite().nonnegative(),
        messageCount: z.number().finite().nonnegative(),
        by_model: z.array(usageBucketSchema),
        by_agent: z.array(usageBucketSchema),
      })
      .passthrough(),
    warnings: z.array(z.string()),
  })
  .passthrough()

const upstreamUrl = process.env.MODEL_USAGE_UPSTREAM_URL?.trim()
const upstreamToken = process.env.MODEL_USAGE_UPSTREAM_TOKEN?.trim()
const configuredAllowedOrigin = process.env.ALLOWED_ORIGIN?.trim()
const upstreamAllowedHosts = new Set(
  (process.env.MODEL_USAGE_UPSTREAM_ALLOW_HOSTS ?? '')
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
    throw new Error('MODEL_USAGE_UPSTREAM_URL is not a valid URL')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('MODEL_USAGE_UPSTREAM_URL must use https')
  }

  if (isPrivateHostname(parsed.hostname)) {
    throw new Error('MODEL_USAGE_UPSTREAM_URL must not target localhost or private networks')
  }

  if (upstreamAllowedHosts.size > 0 && !upstreamAllowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error('MODEL_USAGE_UPSTREAM_URL host is not allowlisted')
  }

  return parsed.toString()
}

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

const fetchUpstreamPayload = async () => {
  if (!upstreamUrl) {
    return null
  }

  const response = await fetch(parseSafeUpstreamUrl(upstreamUrl), {
    headers: upstreamToken ? { Authorization: `Bearer ${upstreamToken}` } : undefined,
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`model usage upstream responded ${response.status}`)
  }

  return modelUsagePayloadSchema.parse(await response.json())
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
    const payload = (await fetchUpstreamPayload()) ?? (await fetchModelUsagePayload())
    res.status(200).json(payload)
  } catch (error) {
    try {
      const fallbackPayload = await fetchModelUsagePayload()
      res.status(200).json({
        ...fallbackPayload,
        warnings: [
          `model usage upstream unavailable: ${error instanceof Error ? error.message : String(error)}`,
          ...fallbackPayload.warnings,
        ].slice(0, 20),
      })
    } catch (fallbackError) {
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
        warnings: [
          `model usage unavailable: ${error instanceof Error ? error.message : String(error)}`,
          `model usage fallback unavailable: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
        ],
      })
    }
  }
}
