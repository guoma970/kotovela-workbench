import { useCallback, useEffect, useRef, useState } from 'react'

type PollingFetchResult = {
  lastSyncedAtMs?: number | null
  error?: string
}

type PollingFetchOptions = {
  enabled: boolean
  pollingEnabled: boolean
  pollingIntervalMs: number
  visibilityRefreshEnabled: boolean
  staleMs: number
  initialHasBootstrapped?: boolean
  fetcher: (signal: AbortSignal) => Promise<PollingFetchResult>
  onError?: (error: unknown) => PollingFetchResult
}

export function usePollingFetch({
  enabled,
  pollingEnabled,
  pollingIntervalMs,
  visibilityRefreshEnabled,
  staleMs,
  initialHasBootstrapped = false,
  fetcher,
  onError,
}: PollingFetchOptions) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastSyncedAtMs, setLastSyncedAtMs] = useState<number | null>(null)
  const [hasBootstrapped, setHasBootstrapped] = useState(initialHasBootstrapped)

  const lastFetchMsRef = useRef(0)
  const activeRequestRef = useRef(0)
  const activeAbortRef = useRef<AbortController | null>(null)

  const applyResult = useCallback((result: PollingFetchResult) => {
    if (Object.prototype.hasOwnProperty.call(result, 'lastSyncedAtMs')) {
      setLastSyncedAtMs(result.lastSyncedAtMs ?? null)
      if (typeof result.lastSyncedAtMs === 'number') {
        lastFetchMsRef.current = result.lastSyncedAtMs
      }
    }
    if (typeof result.error === 'string') {
      setError(result.error)
    }
  }, [])

  const runFetch = useCallback(async () => {
    if (!enabled) {
      setLastSyncedAtMs(null)
      setHasBootstrapped(true)
      return
    }

    const requestId = activeRequestRef.current + 1
    activeRequestRef.current = requestId
    activeAbortRef.current?.abort()
    const abortController = new AbortController()
    activeAbortRef.current = abortController

    setIsLoading(true)
    setError('')

    try {
      const result = await fetcher(abortController.signal)
      if (requestId !== activeRequestRef.current) return
      applyResult(result)
    } catch (fetchError) {
      if (abortController.signal.aborted || requestId !== activeRequestRef.current) return
      const handled = onError?.(fetchError)
      if (handled !== undefined) {
        applyResult(handled)
      } else {
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError))
      }
    } finally {
      if (requestId === activeRequestRef.current) {
        setIsLoading(false)
        setHasBootstrapped(true)
      }
    }
  }, [applyResult, enabled, fetcher, onError])

  useEffect(() => {
    void runFetch()
  }, [runFetch])

  useEffect(() => {
    if (!enabled || !pollingEnabled) {
      return
    }

    let timer: number | undefined
    const scheduleNextPoll = () => {
      const jitterMs = Math.floor(Math.random() * 1000)
      timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          void runFetch()
        }
        scheduleNextPoll()
      }, pollingIntervalMs + jitterMs)
    }

    scheduleNextPoll()

    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      activeAbortRef.current?.abort()
    }
  }, [enabled, pollingEnabled, pollingIntervalMs, runFetch])

  useEffect(() => {
    if (!enabled || !visibilityRefreshEnabled) {
      return
    }

    const shouldRefresh = () => {
      const elapsed = Date.now() - lastFetchMsRef.current
      return elapsed > staleMs
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && shouldRefresh()) {
        void runFetch()
      }
    }

    const handleOnline = () => {
      if (shouldRefresh()) {
        void runFetch()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [enabled, runFetch, staleMs, visibilityRefreshEnabled])

  const refresh = useCallback(() => {
    void runFetch()
  }, [runFetch])

  return {
    error,
    hasBootstrapped,
    isLoading,
    lastSyncedAtMs,
    refresh,
  }
}
