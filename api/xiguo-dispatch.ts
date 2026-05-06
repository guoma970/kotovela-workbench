import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import {
  buildXiguoFallbackDeepLink,
  dispatchToXiguo,
  getXiguoDispatchReadiness,
  sendFeishuStudyMessage,
  type XiguoTask,
} from '../server/xiugDispatch.js'
import { hasKotovelaAccess } from '../server/kotovelaAccess.js'

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

const sendJson = (res: VercelResponse, status: number, body: unknown) => {
  res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Allow', 'GET, POST')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Kotovela-Secret, X-Kotovela-Access-Token')
    return res.status(204).end()
  }

  if (!['GET', 'POST'].includes(req.method ?? '')) {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  if (!hasKotovelaAccess(req)) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      readiness: getXiguoDispatchReadiness(),
    })
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
