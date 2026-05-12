import { describe, expect, it } from 'vitest'
import { isPrivateHostname, parseSafeUpstreamUrl } from './safeUpstream'

describe('safeUpstream', () => {
  it('accepts https public upstream URLs', () => {
    expect(parseSafeUpstreamUrl('https://api.example.com/path?q=1', { envName: 'TEST_URL' })).toBe('https://api.example.com/path?q=1')
  })

  it.each([
    'http://api.example.com',
    'https://localhost/api',
    'https://127.0.0.1/api',
    'https://0.0.0.0/api',
    'https://example.local/api',
    'https://example.internal/api',
    'https://10.0.0.5/api',
    'https://192.168.1.10/api',
    'https://172.16.0.2/api',
    'https://172.31.255.2/api',
    'https://169.254.1.1/api',
  ])('rejects unsafe upstream %s', (value) => {
    expect(() => parseSafeUpstreamUrl(value, { envName: 'TEST_URL' })).toThrow(/TEST_URL/)
  })

  it('rejects malformed URLs', () => {
    expect(() => parseSafeUpstreamUrl('not-a-url', { envName: 'TEST_URL' })).toThrow('TEST_URL is not a valid URL')
  })

  it('enforces allowlisted hosts when provided', () => {
    const allowedHosts = new Set(['safe.example.com'])
    expect(parseSafeUpstreamUrl('https://safe.example.com/api', { envName: 'TEST_URL', allowedHosts })).toBe('https://safe.example.com/api')
    expect(() => parseSafeUpstreamUrl('https://other.example.com/api', { envName: 'TEST_URL', allowedHosts })).toThrow('TEST_URL host is not allowlisted')
  })

  it.each([
    ['localhost', true],
    ['127.0.0.1', true],
    ['10.1.2.3', true],
    ['192.168.8.1', true],
    ['172.20.0.1', true],
    ['api.example.com', false],
  ])('detects private hostname %s', (hostname, expected) => {
    expect(isPrivateHostname(hostname)).toBe(expected)
  })
})
