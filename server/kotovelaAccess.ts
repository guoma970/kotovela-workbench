import { createHash } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'

const ACCESS_COOKIE_NAME = 'kotovela_access'
const ACCESS_HASH_PREFIX = 'kotovela-hub-access'

export const normalizeAccessSecret = (value: unknown) =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()

const hashSecret = (secret: string) =>
  createHash('sha256').update(`${ACCESS_HASH_PREFIX}:${normalizeAccessSecret(secret)}`).digest('hex')

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

export const hasKotovelaAccess = (req: VercelRequest) => {
  const secret = normalizeAccessSecret(process.env.KOTOVELA_ACCESS_SECRET)
  if (!secret) return true

  const directSecret = normalizeAccessSecret(readHeader(req, 'x-kotovela-secret'))
  const accessToken = normalizeAccessSecret(readHeader(req, 'x-kotovela-access-token'))
  const authorization = normalizeAccessSecret(readHeader(req, 'authorization'))
  const bearer = authorization.toLowerCase().startsWith('bearer ') ? normalizeAccessSecret(authorization.slice(7)) : ''
  const cookieValue = parseCookies(req.headers.cookie).get(ACCESS_COOKIE_NAME)

  return directSecret === secret || accessToken === secret || bearer === secret || cookieValue === hashSecret(secret)
}
