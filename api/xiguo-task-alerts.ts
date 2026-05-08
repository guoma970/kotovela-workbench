import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleXiguoApiRoute } from '../server/xiguoApiRoute.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handleXiguoApiRoute(req, res, {
    pathname: '/api/xiguo-task-alerts',
    allow: ['POST'],
    internalOnly: true,
  })
}
