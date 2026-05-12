import type { IncomingMessage, ServerResponse } from 'node:http'
import { fetchModelUsagePayload } from '../modelUsage'

export default async function modelUsageHandler(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  if (req.method !== 'GET') {
    next()
    return
  }

  try {
    const payload = await fetchModelUsagePayload()
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(payload))
  } catch (error) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: 'model-usage fetch failed',
        message: error instanceof Error ? error.message : String(error),
      }),
    )
  }
}
