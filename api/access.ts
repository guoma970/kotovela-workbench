import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const ACCESS_COOKIE_NAME = 'kotovela_access'
const ACCESS_HASH_PREFIX = 'kotovela-hub-access'
const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

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

const resolveNextPath = (value: unknown) => {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

const normalizePassword = (value: unknown) => normalizeSecret(value)

const extractMultipartPassword = (value: string) => {
  const match = value.match(/name="password"[\s\S]*?\r?\n\r?\n([\s\S]*?)\r?\n--/)
  return match?.[1]
}

const readPassword = (body: unknown) => {
  if (Buffer.isBuffer(body)) {
    return readPassword(body.toString('utf8'))
  }

  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (!trimmed) return ''

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (typeof parsed === 'object' && parsed !== null && 'password' in parsed) {
        return normalizePassword((parsed as { password?: unknown }).password)
      }
    } catch {
      const formPassword = new URLSearchParams(trimmed).get('password')
      if (formPassword !== null) return normalizePassword(formPassword)
    }

    const formPassword = new URLSearchParams(trimmed).get('password')
    if (formPassword !== null) return normalizePassword(formPassword)

    const multipartPassword = extractMultipartPassword(trimmed)
    if (multipartPassword !== undefined) return normalizePassword(multipartPassword)

    return normalizePassword(trimmed)
  }

  if (typeof body === 'object' && body !== null && 'password' in body) {
    return normalizePassword((body as { password?: unknown }).password)
  }

  return ''
}

const setNoStore = (res: VercelResponse) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Vary', 'Cookie')
}

const setAccessCookie = (res: VercelResponse, secret: string) => {
  res.setHeader(
    'Set-Cookie',
    `${ACCESS_COOKIE_NAME}=${encodeURIComponent(hashSecret(secret))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ACCESS_MAX_AGE_SECONDS}`,
  )
}

const clearAccessCookie = (res: VercelResponse) => {
  res.setHeader('Set-Cookie', `${ACCESS_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)
}

const prefersHtml = (req: VercelRequest) => {
  const accept = Array.isArray(req.headers.accept) ? req.headers.accept.join(',') : req.headers.accept
  return typeof accept === 'string' && accept.includes('text/html')
}

const redirectToHome = (res: VercelResponse) => {
  res.statusCode = 303
  res.setHeader('Location', '/')
  return res.end()
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)

  const secret = normalizeSecret(process.env.KOTOVELA_ACCESS_SECRET)
  if (!secret) {
    return res.status(503).json({ ok: false, error: 'access_protection_not_configured' })
  }

  const nextPath = resolveNextPath(req.query.next)

  if (req.method === 'GET') {
    if (req.query.logout === '1') {
      clearAccessCookie(res)
      return redirectToHome(res)
    }

    const cookieValue = parseCookies(req.headers.cookie).get(ACCESS_COOKIE_NAME)
    if (prefersHtml(req)) {
      return redirectToHome(res)
    }

    return res.status(200).json({ ok: cookieValue === hashSecret(secret) })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).end()
  }

  if (readPassword(req.body) !== secret) {
    res.statusCode = 303
    res.setHeader('Location', `/?access=failed`)
    return res.end()
  }

  setAccessCookie(res, secret)
  res.statusCode = 303
  res.setHeader('Location', nextPath)
  return res.end()
}
