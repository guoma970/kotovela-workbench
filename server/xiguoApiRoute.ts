import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleInternalApiRoute } from './vercelInternalProxy.js'
import { hasKotovelaAccess } from './kotovelaAccess.js'
import { verifyXiguoTaskLinkToken } from './xiguoTaskAccess.js'

type XiguoRouteOptions = {
  pathname: '/api/xiguo-task' | '/api/xiguo-task-status' | '/api/xiguo-task-create' | '/api/xiguo-task-alerts'
  allow: string[]
  internalOnly?: boolean
}

const DEFAULT_XIGUO_ALLOWED_ORIGIN = 'https://xiguo.kotovela.com'

const normalizeString = (value: unknown) => String(value ?? '').trim()

const firstQueryValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? ''

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

const readHeader = (req: VercelRequest, name: string) => {
  const value = req.headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const isLocalOrigin = (origin: string) => {
  try {
    const url = new URL(origin)
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)
  } catch {
    return false
  }
}

const setXiguoCors = (req: VercelRequest, res: VercelResponse, methods: string[]) => {
  const allowedOrigin = normalizeString(process.env.XIGUO_ALLOWED_ORIGIN) || DEFAULT_XIGUO_ALLOWED_ORIGIN
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : ''
  if (origin === allowedOrigin || isLocalOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '))
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Kotovela-Secret, X-Kotovela-Access-Token, X-Xiguo-Task-Token',
  )
  res.setHeader('Vary', 'Origin, Host')
  res.setHeader('Cache-Control', 'no-store, max-age=0')
}

const getTaskScope = (req: VercelRequest) => {
  const body = asObject(req.body)
  const authorization = normalizeString(readHeader(req, 'authorization'))
  const queryTaskId = firstQueryValue(req.query.taskId) || firstQueryValue(req.query.task_id)
  const queryProjectId = firstQueryValue(req.query.projectId) || firstQueryValue(req.query.project_id)
  return {
    taskId: normalizeString(body.taskId ?? body.task_id ?? queryTaskId),
    projectId: normalizeString(body.projectId ?? body.project_id ?? queryProjectId),
    token: normalizeString(
      body.token
      ?? firstQueryValue(req.query.token)
      ?? req.headers['x-xiguo-task-token']
      ?? authorization.replace(/^Bearer\s+/i, ''),
    ),
  }
}

const hasTaskScopedAccess = (req: VercelRequest) => {
  if (hasKotovelaAccess(req)) return true

  const { taskId, projectId, token } = getTaskScope(req)
  if (!taskId || !token) return false

  return verifyXiguoTaskLinkToken({
    taskId,
    projectId: projectId || undefined,
    token,
  }).ok
}

const mergeQueryIntoBody = (req: VercelRequest) => {
  if (req.method === 'GET') return
  req.body = {
    taskId: firstQueryValue(req.query.taskId) || firstQueryValue(req.query.task_id),
    projectId: firstQueryValue(req.query.projectId) || firstQueryValue(req.query.project_id),
    token: firstQueryValue(req.query.token),
    ...asObject(req.body),
  }
}

export async function handleXiguoApiRoute(req: VercelRequest, res: VercelResponse, options: XiguoRouteOptions) {
  setXiguoCors(req, res, options.allow)

  if (req.method === 'OPTIONS') return res.status(204).end()

  if (process.env.VERCEL_BUILD_MODE === 'opensource') {
    return res.status(404).json({ ok: false, error: 'not_found' })
  }

  if (!options.allow.includes(req.method ?? '')) {
    res.setHeader('Allow', options.allow.join(', '))
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  if (options.internalOnly ? !hasKotovelaAccess(req) : !hasTaskScopedAccess(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  mergeQueryIntoBody(req)
  return handleInternalApiRoute(req, res, options.pathname)
}
