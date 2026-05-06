import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getXiguoDispatchReadiness } from '../server/xiugDispatch.js'
import { hasKotovelaAccess } from '../server/kotovelaAccess.js'

const sendJson = (res: VercelResponse, status: number, body: unknown) => {
  res.status(status).json(body)
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Allow', 'GET')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Kotovela-Secret, X-Kotovela-Access-Token')
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  if (!hasKotovelaAccess(req)) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
  }

  const readiness = getXiguoDispatchReadiness()
  return sendJson(res, 200, {
    ok: true,
    readiness,
  })
}
