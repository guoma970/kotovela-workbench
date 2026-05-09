import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleInternalWorkbenchRequest } from './internalWorkbench.js'

const configuredAllowedOrigin = process.env.ALLOWED_ORIGIN?.trim()
const upstreamAllowedHosts = new Set(
  (process.env.INTERNAL_API_UPSTREAM_ALLOW_HOSTS ?? process.env.OFFICE_INSTANCES_UPSTREAM_ALLOW_HOSTS ?? '')
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
  if (requestOrigin && new URL(requestOrigin).host === host) return requestOrigin
  if (!isLocalHostHeader(host)) return undefined
  return `http://${host}`
}

const resolveUpstreamOrigin = () => {
  const explicitBase = process.env.INTERNAL_API_UPSTREAM_ORIGIN?.trim() || process.env.OFFICE_API_UPSTREAM_ORIGIN?.trim()
  const derivedFromOffice = process.env.OFFICE_INSTANCES_UPSTREAM_URL?.trim()
  const derivedFromUsage = process.env.MODEL_USAGE_UPSTREAM_URL?.trim()
  const candidate = explicitBase || derivedFromOffice || derivedFromUsage
  if (!candidate) return undefined

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error('INTERNAL_API_UPSTREAM_ORIGIN is not a valid URL')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('internal upstream must use https')
  }

  if (isPrivateHostname(parsed.hostname)) {
    throw new Error('internal upstream must not target localhost or private networks')
  }

  if (upstreamAllowedHosts.size > 0 && !upstreamAllowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error('internal upstream host is not allowlisted')
  }

  return parsed.origin
}

const readRequestBody = (req: VercelRequest) => {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined
  return req.body
}

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

const proxyToUpstreamRaw = async (input: {
  pathname: string
  method?: string
  body?: unknown
  search?: string
}) => {
  const origin = resolveUpstreamOrigin()
  if (!origin) return undefined

  const target = new URL(input.pathname, origin)
  target.search = input.search ?? ''

  const token = process.env.INTERNAL_API_UPSTREAM_TOKEN?.trim()
    || process.env.OFFICE_INSTANCES_UPSTREAM_TOKEN?.trim()
    || process.env.MODEL_USAGE_UPSTREAM_TOKEN?.trim()
  const body = input.method === 'GET' || input.method === 'HEAD' ? undefined : input.body
  const response = await fetch(target, {
    method: input.method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })

  const text = await response.text()
  const parsed = text ? JSON.parse(text) as unknown : null
  return { status: response.status, body: parsed }
}

const proxyToUpstream = async (pathname: string, req: VercelRequest) => {
  const requestUrl = new URL(req.url ?? pathname, `https://${req.headers.host ?? 'kotovelahub.vercel.app'}`)
  return proxyToUpstreamRaw({
    pathname,
    method: req.method,
    body: readRequestBody(req),
    search: requestUrl.search,
  })
}

export async function callInternalApiRoute(pathname: string, method: string, body?: unknown, search = '') {
  const normalizedMethod = method.toUpperCase()

  try {
    const proxied = await proxyToUpstreamRaw({ pathname, method: normalizedMethod, body, search })
    if (proxied) return proxied
  } catch (error) {
    if (normalizedMethod !== 'GET') {
      return {
        status: 502,
        body: {
          error: 'internal upstream unavailable',
          message: error instanceof Error ? error.message : String(error),
        },
      }
    }
  }

  const fallbackInput = normalizedMethod === 'GET'
    ? Object.fromEntries(new URLSearchParams(search.startsWith('?') ? search.slice(1) : search))
    : body
  const fallback = await handleInternalWorkbenchRequest(pathname, normalizedMethod, fallbackInput)
  return { status: fallback.status, body: fallback.body }
}

export async function handleInternalApiRoute(req: VercelRequest, res: VercelResponse, pathname: string) {
  const allowedOrigin = resolveAllowedOrigin(req)
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Vary', 'Origin, Host')
  res.setHeader('Cache-Control', 'no-store, max-age=0')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    const proxied = await proxyToUpstream(pathname, req)
    if (proxied) {
      return res.status(proxied.status).json(proxied.body)
    }
  } catch (error) {
    if (req.method !== 'GET') {
      return res.status(502).json({
        error: 'internal upstream unavailable',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    const requestQuery = Object.fromEntries(new URL(req.url ?? pathname, `https://${req.headers.host ?? 'kotovelahub.vercel.app'}`).searchParams)
    const fallbackInput = req.method === 'GET'
      ? requestQuery
      : { ...requestQuery, ...asObject(req.body) }
    const fallback = await handleInternalWorkbenchRequest(pathname, req.method ?? 'GET', fallbackInput)
    if (fallback.allow) res.setHeader('Allow', fallback.allow)
    return res.status(fallback.status).json(fallback.body)
  } catch (error) {
    return res.status(500).json({
      error: `${pathname} fetch failed`,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
