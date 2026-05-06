import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import {
  buildXiguoFallbackDeepLink,
  dispatchToXiguo,
  sendFeishuStudyMessage,
  type XiguoTask,
} from '../server/xiugDispatch.js'

const ACCESS_COOKIE_NAME = 'kotovela_access'
const ACCESS_HASH_PREFIX = 'kotovela-hub-access'

const taskSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(120),
    subject: z.enum(['math', 'writing', 'reading']),
    durationMinutes: z.number().int().positive().max(240),
    description: z.string().trim().max(1000).default(''),
  })
  .strict()

const dispatchRequestSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    confirmedBy: z.string().trim().min(1).max(80).default('parent'),
    tasks: z.array(taskSchema).min(1).max(20),
  })
  .strict()

const normalizeSecret = (value: unknown) =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()

const hashSecret = (secret: string) =>
  createHash('sha256').update(`${ACCESS_HASH_PREFIX}:${normalizeSecret(secret)}`).digest('hex')

const parseCookies = (cookieHeader: string | undefined) => {
  const cookies = new Map<string, string>()
  if (!cookieHeader) return cookies

  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (!name) continue
    cookies.set(name, decodeURIComponent(rest.join('=')))
  }

  return cookies
}

const readHeader = (req: VercelRequest, name: string) => {
  const value = req.headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const hasAccess = (req: VercelRequest) => {
  const secret = normalizeSecret(process.env.KOTOVELA_ACCESS_SECRET)
  if (!secret) return true

  const directSecret = normalizeSecret(readHeader(req, 'x-kotovela-secret'))
  const accessToken = normalizeSecret(readHeader(req, 'x-kotovela-access-token'))
  const authorization = normalizeSecret(readHeader(req, 'authorization'))
  const bearer = authorization.toLowerCase().startsWith('bearer ') ? normalizeSecret(authorization.slice(7)) : ''
  const cookieValue = parseCookies(req.headers.cookie).get(ACCESS_COOKIE_NAME)

  return directSecret === secret || accessToken === secret || bearer === secret || cookieValue === hashSecret(secret)
}

const sendJson = (res: VercelResponse, status: number, body: unknown) => {
  res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Allow', 'POST')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Kotovela-Secret, X-Kotovela-Access-Token')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  if (!hasAccess(req)) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
  }

  const parsed = dispatchRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return sendJson(res, 400, {
      ok: false,
      error: 'Invalid dispatch payload',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const body = parsed.data
  const tasks: XiguoTask[] = body.tasks
  const xiguoResult = await dispatchToXiguo({
    date: body.date,
    confirmedBy: body.confirmedBy,
    tasks,
  })
  const deepLink = xiguoResult.ok ? xiguoResult.deepLink : buildXiguoFallbackDeepLink(body.date)
  const feishuResult = await sendFeishuStudyMessage(tasks, deepLink, body.date)
  const allOk = xiguoResult.ok && feishuResult.ok

  return sendJson(res, allOk ? 200 : 207, {
    ok: allOk,
    date: body.date,
    deepLink,
    results: {
      xiguo: xiguoResult,
      feishu: feishuResult,
    },
  })
}
