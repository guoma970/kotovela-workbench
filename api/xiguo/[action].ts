import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleXiguoApiRoute } from '../../server/xiguoApiRoute.js'

type XiguoAction = 'task' | 'task-status' | 'task-create' | 'task-alerts'

const firstQueryValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? ''

const routeByAction: Record<XiguoAction, Parameters<typeof handleXiguoApiRoute>[2]> = {
  task: {
    pathname: '/api/xiguo-task',
    allow: ['GET'],
  },
  'task-status': {
    pathname: '/api/xiguo-task-status',
    allow: ['POST', 'PATCH'],
  },
  'task-create': {
    pathname: '/api/xiguo-task-create',
    allow: ['POST'],
    internalOnly: true,
  },
  'task-alerts': {
    pathname: '/api/xiguo-task-alerts',
    allow: ['POST'],
    internalOnly: true,
  },
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const action = firstQueryValue(req.query.action)

  if (action !== 'task' && action !== 'task-status' && action !== 'task-create' && action !== 'task-alerts') {
    res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS')
    return res.status(404).json({ ok: false, error: 'not_found' })
  }

  return handleXiguoApiRoute(req, res, routeByAction[action])
}
