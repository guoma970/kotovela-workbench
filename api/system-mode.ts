import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleInternalApiRoute } from '../server/vercelInternalProxy.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handleInternalApiRoute(req, res, '/api/system-mode')
}
