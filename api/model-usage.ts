import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchModelUsagePayload } from '../server/modelUsage.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')

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
