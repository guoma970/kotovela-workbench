import type { IncomingMessage, ServerResponse } from 'node:http'
import { fetchOfficeInstancesPayload } from '../officeInstances'

export default async function officeInstancesHandler(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
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
}
