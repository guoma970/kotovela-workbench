export type SystemModeValue = 'dev' | 'test' | 'live'
export type PublishModeValue = 'auto_disabled' | 'manual_only' | 'semi_auto'

export type SystemControlState = {
  app_mode: 'internal' | 'opensource'
  system_mode: SystemModeValue
  publish_mode: PublishModeValue
  force_stop: boolean
  warning: boolean
  overload: boolean
  live_guardrails: {
    enabled: boolean
    message: string
  }
  decision_log: Array<{
    timestamp: string
    action: string
    reason: string
    detail: string
    actor?: string
  }>
  updated_at: string
}

export const DEFAULT_SYSTEM_CONTROL_STATE: SystemControlState = {
  app_mode: 'opensource',
  system_mode: 'dev',
  publish_mode: 'manual_only',
  force_stop: false,
  warning: false,
  overload: false,
  live_guardrails: {
    enabled: false,
    message: 'Non-live environment, safe for demo and validation.',
  },
  decision_log: [],
  updated_at: new Date(0).toISOString(),
}

export function normalizeSystemControlState(payload: unknown, appMode: 'internal' | 'opensource'): SystemControlState {
  if (!payload || typeof payload !== 'object') {
    return {
      ...DEFAULT_SYSTEM_CONTROL_STATE,
      app_mode: appMode,
    }
  }

  const data = payload as Record<string, unknown>
  const systemMode = String(data.system_mode ?? data.systemMode ?? DEFAULT_SYSTEM_CONTROL_STATE.system_mode).toLowerCase()
  const publishMode = String(data.publish_mode ?? data.publishMode ?? DEFAULT_SYSTEM_CONTROL_STATE.publish_mode).toLowerCase()
  const liveGuardrails = data.live_guardrails && typeof data.live_guardrails === 'object'
    ? (data.live_guardrails as Record<string, unknown>)
    : {}

  return {
    app_mode: appMode,
    system_mode: systemMode === 'live' ? 'live' : systemMode === 'test' ? 'test' : 'dev',
    publish_mode: publishMode === 'semi_auto' ? 'semi_auto' : publishMode === 'auto_disabled' ? 'auto_disabled' : 'manual_only',
    force_stop: Boolean(data.force_stop ?? data.forceStop ?? false),
    warning: Boolean(data.warning ?? false),
    overload: Boolean(data.overload ?? false),
    live_guardrails: {
      enabled: Boolean(liveGuardrails.enabled ?? (systemMode === 'live')),
      message: String(liveGuardrails.message ?? (systemMode === 'live' ? 'LIVE MODE · Real business traffic enabled' : 'Non-live environment, safe for demo and validation.')),
    },
    decision_log: Array.isArray(data.decision_log)
      ? data.decision_log.map((entry) => {
          const record = entry as Record<string, unknown>
          return {
            timestamp: String(record.timestamp ?? ''),
            action: String(record.action ?? ''),
            reason: String(record.reason ?? ''),
            detail: String(record.detail ?? ''),
            actor: record.actor ? String(record.actor) : undefined,
          }
        })
      : [],
    updated_at: String(data.updated_at ?? data.updatedAt ?? DEFAULT_SYSTEM_CONTROL_STATE.updated_at),
  }
}
