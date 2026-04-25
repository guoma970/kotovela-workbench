import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchOfficeInstancesPayload } from '../server/officeInstances'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const payload = await fetchOfficeInstancesPayload()
    res.status(200).json(payload)
  } catch (error) {
    res.status(500).json({
      error: 'office-instances fetch failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
