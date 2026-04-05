export type WorkbenchMode = 'demo' | 'internal'
export type PreferredDataSource = 'mock' | 'openclaw'

const parseMode = (value: string | undefined): WorkbenchMode => {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'internal' ? 'internal' : 'demo'
}

const parsePreferredDataSource = (value: string | undefined, fallbackMode: WorkbenchMode): PreferredDataSource => {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'openclaw') return 'openclaw'
  if (normalized === 'mock') return 'mock'
  return fallbackMode === 'internal' ? 'openclaw' : 'mock'
}

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null || value === '') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const MODE = parseMode(import.meta.env.VITE_MODE)

export const runtimeConfig = {
  mode: MODE,
  preferredDataSource: parsePreferredDataSource(import.meta.env.VITE_DATA_SOURCE, MODE),
  pollingEnabled: parseBoolean(import.meta.env.VITE_POLLING_ENABLED, MODE === 'internal'),
  pollingIntervalMs: parsePositiveInt(
    import.meta.env.VITE_POLLING_INTERVAL_MS,
    MODE === 'internal' ? 5_000 : 20_000,
  ),
  visibilityRefreshEnabled: parseBoolean(import.meta.env.VITE_VISIBILITY_REFRESH, true),
  fallbackToMock: parseBoolean(import.meta.env.VITE_FALLBACK_TO_MOCK, true),
  staleMs: parsePositiveInt(import.meta.env.VITE_STALE_MS, 30_000),
  officeInstancesApiPath: import.meta.env.VITE_OFFICE_INSTANCES_API_PATH || '/api/office-instances',
} as const

export const runtimeLabels = {
  mode: runtimeConfig.mode === 'internal' ? 'Internal' : 'Demo',
  preferredDataSource: runtimeConfig.preferredDataSource === 'openclaw' ? 'OpenClaw' : 'Mock',
}
