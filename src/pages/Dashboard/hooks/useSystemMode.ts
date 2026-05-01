import { useEffect, useState } from 'react'
import type { SystemModeState } from '../components/DashboardOverviewSections'

const DEFAULT_SYSTEM_MODE: SystemModeState = {
  systemMode: 'dev',
  publishMode: 'manual_only',
  forceStop: false,
}

function normalizeSystemModeState(payload: unknown): SystemModeState {
  if (!payload || typeof payload !== 'object') return DEFAULT_SYSTEM_MODE
  const data = payload as Record<string, unknown>
  const rawSystemMode = String(data.system_mode ?? data.systemMode ?? data.mode ?? 'dev').toLowerCase()
  const rawPublishMode = String(data.publish_mode ?? data.publishMode ?? 'manual_only').toLowerCase()
  const rawForceStop = data.force_stop ?? data.forceStop

  return {
    systemMode: rawSystemMode === 'live' ? 'live' : rawSystemMode === 'test' ? 'test' : 'dev',
    publishMode:
      rawPublishMode === 'semi_auto'
        ? 'semi_auto'
        : rawPublishMode === 'auto_disabled'
          ? 'auto_disabled'
          : 'manual_only',
    forceStop: typeof rawForceStop === 'boolean' ? rawForceStop : rawForceStop == null ? false : Boolean(rawForceStop),
  }
}

export function useSystemMode() {
  const [state, setState] = useState<SystemModeState>(DEFAULT_SYSTEM_MODE)

  useEffect(() => {
    let cancelled = false

    const loadSystemMode = async () => {
      try {
        const response = await fetch('/api/system-mode', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) {
          setState(normalizeSystemModeState(data))
        }
      } catch {
        if (!cancelled) {
          setState(DEFAULT_SYSTEM_MODE)
        }
      }
    }

    void loadSystemMode()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
