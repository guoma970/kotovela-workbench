const DEFAULT_DEV_BASE_URL = 'http://localhost:5173'

function trimTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export function resolveBaseUrl({ envNames = [], fallback = DEFAULT_DEV_BASE_URL, path = '' } = {}) {
  const configured = [
    ...envNames.map((name) => process.env[name]).filter(Boolean),
    process.env.BASE_URL,
    process.env.APP_BASE_URL,
    fallback,
  ].find(Boolean)

  const baseUrl = trimTrailingSlash(String(configured || DEFAULT_DEV_BASE_URL))
  const suffix = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  return `${baseUrl}${suffix}`
}

export { DEFAULT_DEV_BASE_URL }
