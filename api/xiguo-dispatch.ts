import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import {
  buildXiguoFallbackDeepLink,
  dispatchToXiguo,
  getXiguoDispatchReadiness,
  normalizeFeishuStudyAudience,
  sendFeishuStudyMessage,
  type FeishuStudyAudience,
  type XiguoTask,
} from '../server/xiugDispatch.js'
import { hasKotovelaAccess } from '../server/kotovelaAccess.js'
import { callInternalApiRoute } from '../server/vercelInternalProxy.js'

const taskSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    projectId: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(120),
    subject: z.enum(['math', 'writing', 'reading']),
    durationMinutes: z.number().int().positive().max(240),
    description: z.string().trim().max(1000).default(''),
    dueAt: z.string().trim().max(80).optional(),
    priority: z.number().int().min(0).max(3).optional(),
  })
  .strict()

const dispatchRequestSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    confirmedBy: z.string().trim().min(1).max(80).default('parent'),
    audience: z.enum(['collab', 'assign']).default('collab'),
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
    const audience = normalizeFeishuStudyAudience(req.query.audience)
    return sendJson(res, 200, {
      ok: true,
      readiness: getXiguoDispatchReadiness({ audience }),
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
  const audience = body.audience as FeishuStudyAudience
  const tasks: XiguoTask[] = body.tasks
  const createResult = await callInternalApiRoute('/api/xiguo-task-create', 'POST', {
    date: body.date,
    confirmedBy: body.confirmedBy,
    audience,
    tasks,
  })
  const createBody = createResult.body as { ok?: unknown; error?: unknown; message?: unknown } | null
  if (createResult.status < 200 || createResult.status >= 300 || createBody?.ok !== true) {
    return sendJson(res, 502, {
      ok: false,
      date: body.date,
      error: 'Task creation failed; Feishu message was not sent.',
      results: {
        taskCreate: createResult.body,
      },
    })
  }

  const xiguoResult = await dispatchToXiguo({
    date: body.date,
    confirmedBy: body.confirmedBy,
    audience,
    tasks,
  })
  const deepLink = xiguoResult.ok ? xiguoResult.deepLink : buildXiguoFallbackDeepLink(body.date, tasks[0])
  const feishuResult = await sendFeishuStudyMessage(tasks, deepLink, body.date, audience)
  const allOk = xiguoResult.ok && feishuResult.ok

  return sendJson(res, allOk ? 200 : 207, {
    ok: allOk,
    date: body.date,
    audience,
    deepLink,
    results: {
      taskCreate: createResult.body,
      xiguo: xiguoResult,
      feishu: feishuResult,
    },
  })
}
