import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendXiguoTaskLinkParams,
  buildKotovelaTaskApiUrl,
  createXiguoTaskLinkToken,
  isXiguoTaskLinkSecurityConfigured,
  resolveKotovelaPublicOrigin,
  verifyXiguoTaskLinkToken,
} from './xiguoTaskAccess'

const decodePayload = (token: string) => {
  const [payloadBase64] = token.split('.')
  return JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as Record<string, unknown>
}

const encodePayload = (payload: Record<string, unknown>) => Buffer.from(JSON.stringify(payload)).toString('base64url')

describe('xiguoTaskAccess', () => {
  beforeEach(() => {
    vi.stubEnv('XIGUO_LINK_SECRET', '')
    vi.stubEnv('KOTOVELA_ACCESS_SECRET', '')
    vi.stubEnv('XIGUO_API_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates and verifies a valid task link token', () => {
    vi.stubEnv('XIGUO_LINK_SECRET', 'primary-secret')
    const token = createXiguoTaskLinkToken({ taskId: 'task-1', projectId: 'project-1', nowMs: 1_000, expiresInSeconds: 120 })
    const result = verifyXiguoTaskLinkToken({ token, taskId: 'task-1', projectId: 'project-1', nowMs: 2_000 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.payload.taskId).toBe('task-1')
  })

  it('fails when payload is tampered', () => {
    vi.stubEnv('XIGUO_LINK_SECRET', 'primary-secret')
    const token = createXiguoTaskLinkToken({ taskId: 'task-1', nowMs: 1_000 })
    const [, signature] = token.split('.')
    const tampered = `${encodePayload({ ...decodePayload(token), taskId: 'task-2' })}.${signature}`
    expect(verifyXiguoTaskLinkToken({ token: tampered, taskId: 'task-2', nowMs: 2_000 })).toEqual({ ok: false, error: 'invalid_token_signature' })
  })

  it('fails when signature is tampered', () => {
    vi.stubEnv('XIGUO_LINK_SECRET', 'primary-secret')
    const token = createXiguoTaskLinkToken({ taskId: 'task-1', nowMs: 1_000 })
    expect(verifyXiguoTaskLinkToken({ token: `${token}x`, taskId: 'task-1', nowMs: 2_000 })).toEqual({ ok: false, error: 'invalid_token_signature' })
  })

  it('fails expired tokens', () => {
    vi.stubEnv('XIGUO_LINK_SECRET', 'primary-secret')
    const token = createXiguoTaskLinkToken({ taskId: 'task-1', nowMs: 1_000, expiresInSeconds: 60 })
    expect(verifyXiguoTaskLinkToken({ token, taskId: 'task-1', nowMs: 70_000 })).toEqual({ ok: false, error: 'token_expired' })
  })

  it('fails taskId and projectId mismatches', () => {
    vi.stubEnv('XIGUO_LINK_SECRET', 'primary-secret')
    const token = createXiguoTaskLinkToken({ taskId: 'task-1', projectId: 'project-1', nowMs: 1_000 })
    expect(verifyXiguoTaskLinkToken({ token, taskId: 'task-2', nowMs: 2_000 })).toEqual({ ok: false, error: 'task_id_mismatch' })
    expect(verifyXiguoTaskLinkToken({ token, taskId: 'task-1', projectId: 'project-2', nowMs: 2_000 })).toEqual({ ok: false, error: 'project_id_mismatch' })
  })

  it('fails without a configured secret', () => {
    expect(isXiguoTaskLinkSecurityConfigured()).toBe(false)
    expect(createXiguoTaskLinkToken({ taskId: 'task-1' })).toBe('')
    expect(verifyXiguoTaskLinkToken({ token: 'a.b', taskId: 'task-1' })).toEqual({ ok: false, error: 'xiguo_link_secret_not_configured' })
  })

  it('supports secret rotation fallback order', () => {
    vi.stubEnv('XIGUO_LINK_SECRET', 'primary-secret')
    const token = createXiguoTaskLinkToken({ taskId: 'task-1', nowMs: 1_000 })
    vi.stubEnv('XIGUO_LINK_SECRET', '')
    vi.stubEnv('KOTOVELA_ACCESS_SECRET', 'primary-secret')
    expect(verifyXiguoTaskLinkToken({ token, taskId: 'task-1', nowMs: 2_000 }).ok).toBe(true)
  })

  it('returns invalid format and payload errors', () => {
    vi.stubEnv('XIGUO_LINK_SECRET', 'primary-secret')
    expect(verifyXiguoTaskLinkToken({ token: 'broken', taskId: 'task-1' })).toEqual({ ok: false, error: 'invalid_token_format' })
    expect(verifyXiguoTaskLinkToken({ token: '%%%.' + 'signature', taskId: 'task-1' })).toEqual({ ok: false, error: 'invalid_token_signature' })
  })

  it('builds public URLs with signed task params', () => {
    vi.stubEnv('XIGUO_LINK_SECRET', 'primary-secret')
    vi.stubEnv('KOTOVELA_PUBLIC_ORIGIN', 'https://hub.example.com')
    expect(resolveKotovelaPublicOrigin()).toBe('https://hub.example.com')
    const url = buildKotovelaTaskApiUrl('/api/xiguo-task', { taskId: 'task-1', projectId: 'project-1' })
    expect(url).toContain('https://hub.example.com/api/xiguo-task')
    expect(url).toContain('token=')
    const deepLink = appendXiguoTaskLinkParams('https://xiguo.example.com/task', { taskId: 'task-1' })
    expect(deepLink).toContain('source=kotovela-hub')
  })
})
