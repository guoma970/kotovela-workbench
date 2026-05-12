export const isPrivateHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase()
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(normalized)) return true
  if (normalized.endsWith('.local') || normalized.endsWith('.internal')) return true
  if (/^10\./.test(normalized)) return true
  if (/^192\.168\./.test(normalized)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true
  if (/^169\.254\./.test(normalized)) return true
  return false
}

export const parseSafeUpstreamUrl = (
  value: string,
  opts: {
    envName: string
    allowedHosts?: Set<string>
  },
) => {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${opts.envName} is not a valid URL`)
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${opts.envName} must use https`)
  }

  if (isPrivateHostname(parsed.hostname)) {
    throw new Error(`${opts.envName} must not target localhost or private networks`)
  }

  if (opts.allowedHosts?.size && !opts.allowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error(`${opts.envName} host is not allowlisted`)
  }

  return parsed.toString()
}
