import { createHmac, timingSafeEqual } from 'node:crypto'

type XiguoTaskTokenPayload = {
  v: 1
  purpose: 'xiguo-homework'
  taskId: string
  projectId?: string
  exp: number
}

export type XiguoTaskTokenCheck =
  | { ok: true; payload: XiguoTaskTokenPayload }
  | { ok: false; error: string }

const DEFAULT_XIGUO_TASK_LINK_TTL_SECONDS = 60 * 60 * 24 * 3
const DEFAULT_KOTOVELA_PUBLIC_ORIGIN = 'https://kotovelahub.vercel.app'

const normalizeString = (value: unknown) => String(value ?? '').trim()

const getTaskLinkSecret = () =>
  normalizeString(process.env.XIGUO_LINK_SECRET)
  || normalizeString(process.env.KOTOVELA_ACCESS_SECRET)
  || normalizeString(process.env.XIGUO_API_KEY)

const encodeBase64Url = (value: string | Buffer) => Buffer.from(value).toString('base64url')

const decodeBase64Url = (value: string) => Buffer.from(value, 'base64url').toString('utf8')

const signPayload = (payloadBase64: string, secret: string) =>
  createHmac('sha256', secret).update(payloadBase64).digest('base64url')

const safeCompare = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export const isXiguoTaskLinkSecurityConfigured = () => Boolean(getTaskLinkSecret())

export const resolveKotovelaPublicOrigin = () =>
  normalizeString(process.env.KOTOVELA_PUBLIC_ORIGIN) || DEFAULT_KOTOVELA_PUBLIC_ORIGIN

export const createXiguoTaskLinkToken = (input: {
  taskId: string
  projectId?: string
  expiresInSeconds?: number
  nowMs?: number
}) => {
  const secret = getTaskLinkSecret()
  if (!secret) return ''

  const ttlSeconds = Math.max(
    60,
    Number(input.expiresInSeconds ?? process.env.XIGUO_TASK_LINK_TTL_SECONDS ?? DEFAULT_XIGUO_TASK_LINK_TTL_SECONDS),
  )
  const nowMs = input.nowMs ?? Date.now()
  const payload: XiguoTaskTokenPayload = {
    v: 1,
    purpose: 'xiguo-homework',
    taskId: input.taskId,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
  }
  const payloadBase64 = encodeBase64Url(JSON.stringify(payload))
  return `${payloadBase64}.${signPayload(payloadBase64, secret)}`
}

export const verifyXiguoTaskLinkToken = (input: {
  token: string
  taskId: string
  projectId?: string
  nowMs?: number
}): XiguoTaskTokenCheck => {
  const secret = getTaskLinkSecret()
  if (!secret) return { ok: false, error: 'xiguo_link_secret_not_configured' }

  const [payloadBase64, signature] = input.token.split('.')
  if (!payloadBase64 || !signature) return { ok: false, error: 'invalid_token_format' }

  const expected = signPayload(payloadBase64, secret)
  if (!safeCompare(signature, expected)) return { ok: false, error: 'invalid_token_signature' }

  let payload: XiguoTaskTokenPayload
  try {
    payload = JSON.parse(decodeBase64Url(payloadBase64)) as XiguoTaskTokenPayload
  } catch {
    return { ok: false, error: 'invalid_token_payload' }
  }

  if (payload.v !== 1 || payload.purpose !== 'xiguo-homework') {
    return { ok: false, error: 'invalid_token_purpose' }
  }
  if (payload.taskId !== input.taskId) return { ok: false, error: 'task_id_mismatch' }
  if (input.projectId && payload.projectId && payload.projectId !== input.projectId) {
    return { ok: false, error: 'project_id_mismatch' }
  }
  if (payload.exp < Math.floor((input.nowMs ?? Date.now()) / 1000)) {
    return { ok: false, error: 'token_expired' }
  }

  return { ok: true, payload }
}

export const buildKotovelaTaskApiUrl = (pathname: string, input: { taskId: string; projectId?: string }) => {
  const url = new URL(pathname, resolveKotovelaPublicOrigin())
  url.searchParams.set('taskId', input.taskId)
  if (input.projectId) url.searchParams.set('projectId', input.projectId)
  const token = createXiguoTaskLinkToken(input)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

export const appendXiguoTaskLinkParams = (deepLink: string, input: { taskId: string; projectId?: string }) => {
  const url = new URL(deepLink)
  url.searchParams.set('taskId', input.taskId)
  if (input.projectId) url.searchParams.set('projectId', input.projectId)
  const token = createXiguoTaskLinkToken(input)
  if (token) url.searchParams.set('token', token)
  url.searchParams.set('source', 'kotovela-hub')
  return url.toString()
}
