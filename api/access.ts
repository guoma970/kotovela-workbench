import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const ACCESS_COOKIE_NAME = 'kotovela_access'
const ACCESS_HASH_PREFIX = 'kotovela-hub-access'
const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const hashSecret = (secret: string) =>
  createHash('sha256').update(`${ACCESS_HASH_PREFIX}:${secret}`).digest('hex')

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

const readPassword = (body: unknown) => {
  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (!trimmed) return ''

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (typeof parsed === 'object' && parsed !== null && 'password' in parsed) {
        return String((parsed as { password?: unknown }).password ?? '')
      }
    } catch {
      return new URLSearchParams(trimmed).get('password') ?? ''
    }

    return new URLSearchParams(trimmed).get('password') ?? ''
  }

  if (typeof body === 'object' && body !== null && 'password' in body) {
    return String((body as { password?: unknown }).password ?? '')
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

export default function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)

  const secret = process.env.KOTOVELA_ACCESS_SECRET?.trim()
  if (!secret) {
    return res.status(503).json({ ok: false, error: 'access_protection_not_configured' })
  }

  const nextPath = resolveNextPath(req.query.next)

  if (req.method === 'GET') {
    if (req.query.logout === '1') {
      clearAccessCookie(res)
      res.statusCode = 303
      res.setHeader('Location', '/')
      return res.end()
    }

    const cookieValue = parseCookies(req.headers.cookie).get(ACCESS_COOKIE_NAME)
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
