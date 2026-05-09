import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleInternalApiRoute } from '../server/vercelInternalProxy.js'

const firstQueryValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? ''

export default function handler(req: VercelRequest, res: VercelResponse) {
  const action = firstQueryValue(req.query.action)
  return handleInternalApiRoute(
    req,
    res,
    action === 'actions' ? '/api/task-notification-actions' : '/api/task-notifications',
  )
}
