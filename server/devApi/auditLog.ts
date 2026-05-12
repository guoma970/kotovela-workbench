import type { IncomingMessage, ServerResponse } from 'node:http'
import { readAuditLog } from './auditLogStore'

export default async function auditLogHandler(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  if (req.method !== 'GET') {
    next()
    return
  }

  try {
    const entries = await readAuditLog()
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify({ entries }))
  } catch (error) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: 'audit-log fetch failed',
        message: error instanceof Error ? error.message : String(error),
      }),
    )
  }
}
