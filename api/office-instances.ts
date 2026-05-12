import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { parseSafeUpstreamUrl } from '../server/lib/safeUpstream.js'
import { fetchOfficeInstancesPayload } from '../server/officeInstances.js'

const officeInstanceSchema = z
  .object({
    key: z.enum(['main', 'builder', 'media', 'family', 'business', 'personal']),
    name: z.string(),
    role: z.string(),
    status: z.string(),
    task: z.string(),
    updatedAt: z.string(),
    ageMs: z.number().finite().nonnegative(),
    ageText: z.string().optional(),
    note: z.string().optional(),
    projectRelated: z.string().optional(),
  })
  .strict()

const officeInstancesPayloadSchema = z
  .object({
    source: z.string(),
    generatedAt: z.string(),
    snapshotGeneratedAt: z.string().optional(),
    instances: z.array(officeInstanceSchema),
  })
  .strict()

const upstreamUrl = process.env.OFFICE_INSTANCES_UPSTREAM_URL?.trim()
const upstreamToken = process.env.OFFICE_INSTANCES_UPSTREAM_TOKEN?.trim()
const configuredAllowedOrigin = process.env.ALLOWED_ORIGIN?.trim()
const upstreamAllowedHosts = new Set(
  (process.env.OFFICE_INSTANCES_UPSTREAM_ALLOW_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
)

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

  const safeUpstreamUrl = parseSafeUpstreamUrl(upstreamUrl, {
    envName: 'OFFICE_INSTANCES_UPSTREAM_URL',
    allowedHosts: upstreamAllowedHosts,
  })

  const response = await fetch(safeUpstreamUrl, {
    headers: upstreamToken ? { Authorization: `Bearer ${upstreamToken}` } : undefined,
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`office upstream responded ${response.status}`)
  }

  return officeInstancesPayloadSchema.parse(await response.json())
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
