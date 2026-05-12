import type { VercelRequest } from '@vercel/node'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hasKotovelaAccess,
  hasKotovelaAccessStrict,
  hashSecret,
  normalizeAccessSecret,
} from './kotovelaAccess'

const mockReq = (headers: Record<string, string | string[] | undefined> = {}) => ({ headers }) as VercelRequest

describe('kotovelaAccess', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps legacy fail-open helper and adds strict fail-closed helper', () => {
    expect(hasKotovelaAccess(mockReq())).toBe(true)
    expect(hasKotovelaAccessStrict(mockReq())).toBe(false)
  })

  it('normalizes access secrets before hashing', () => {
    expect(normalizeAccessSecret('  Guoguo970!\u200B  ')).toBe('Guoguo970!')
    expect(hashSecret(' secret ')).toBe(hashSecret('secret'))
  })

  it.each([
    ['x-kotovela-secret', 'secret'],
    ['x-kotovela-access-token', 'secret'],
    ['authorization', 'Bearer secret'],
  ])('allows valid %s header and rejects invalid values', (headerName, headerValue) => {
    vi.stubEnv('KOTOVELA_ACCESS_SECRET', 'secret')
    expect(hasKotovelaAccessStrict(mockReq({ [headerName]: headerValue }))).toBe(true)
    expect(hasKotovelaAccessStrict(mockReq({ [headerName]: 'wrong' }))).toBe(false)
  })

  it('allows valid access cookie and rejects invalid cookie', () => {
    vi.stubEnv('KOTOVELA_ACCESS_SECRET', 'secret')
    const validCookie = `kotovela_access=${encodeURIComponent(hashSecret('secret'))}`
    expect(hasKotovelaAccessStrict(mockReq({ cookie: validCookie }))).toBe(true)
    expect(hasKotovelaAccessStrict(mockReq({ cookie: 'kotovela_access=wrong' }))).toBe(false)
  })

  it('reads the first value from repeated headers', () => {
    vi.stubEnv('KOTOVELA_ACCESS_SECRET', 'secret')
    expect(hasKotovelaAccessStrict(mockReq({ 'x-kotovela-secret': ['secret', 'wrong'] }))).toBe(true)
  })
})
