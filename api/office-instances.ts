import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchOfficeInstancesPayload } from '../server/officeInstances.js'

const upstreamUrl = process.env.OFFICE_INSTANCES_UPSTREAM_URL?.trim()
const upstreamToken = process.env.OFFICE_INSTANCES_UPSTREAM_TOKEN?.trim()

const fetchUpstreamPayload = async () => {
  if (!upstreamUrl) {
    return null
  }

  const response = await fetch(upstreamUrl, {
    headers: upstreamToken ? { Authorization: `Bearer ${upstreamToken}` } : undefined,
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`office upstream responded ${response.status}`)
  }

  return response.json()
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
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
