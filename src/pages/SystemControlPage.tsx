import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EvidenceObjectLinks } from '../components/EvidenceObjectLinks'
import { APP_MODE } from '../config/brand'
import {
  DEFAULT_SYSTEM_CONTROL_STATE,
  normalizeSystemControlState,
  type PublishModeValue,
  type SystemControlState,
  type SystemModeValue,
} from '../config/systemControl'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { useWorkbenchLinking } from '../lib/workbenchLinking'

type AuditEntry = {
  id: string
  action: string
  user: string
  time: string
  target: string
  result: string
  actor?: string
}

export function SystemControlPage() {
  const { projects, agents, rooms, tasks } = useOfficeInstances()
  const linking = useWorkbenchLinking({ projects, agents, rooms, tasks })
  const [state, setState] = useState<SystemControlState>({ ...DEFAULT_SYSTEM_CONTROL_STATE, app_mode: APP_MODE })
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const [modeRes, auditRes] = await Promise.all([
      fetch('/api/system-mode', { cache: 'no-store' }),
      fetch('/api/audit-log', { cache: 'no-store' }),
    ])

    if (modeRes.ok) {
      const payload = await modeRes.json()
      setState(normalizeSystemControlState(payload, APP_MODE))
    }

    if (auditRes.ok) {
      const payload = await auditRes.json()
      setAuditEntries(Array.isArray(payload?.entries) ? payload.entries : [])
    }
  }

  useEffect(() => {
    load().catch(() => setError('系统状态加载失败，请稍后重试'))
  }, [])

  const save = async (patch: Partial<SystemControlState>) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/system-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, actor: 'builder' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || 'update failed')
      }
      const payload = await res.json()
      setState(normalizeSystemControlState(payload, APP_MODE))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const liveHint = useMemo(
    () =>
      state.system_mode === 'live'
        ? 'LIVE MODE · Real business traffic enabled'
        : '非 live 环境，仅供联调与验证',
    [state.system_mode],
  )

  const isReadonlyOpenSource = APP_MODE === 'opensource'

  return (
    <section className="page consultant-settings-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">System Control</p>
          <h2>系统控制页</h2>
        </div>
        <p className="page-note">最小可用控制台，展示并控制 system_mode / publish_mode / force_stop / warning / overload。</p>
      </div>

      <section className={`panel strong-card system-mode-bar ${state.system_mode === 'live' ? 'is-live' : state.system_mode === 'test' ? 'is-test' : 'is-dev'}`}>
        <div className="system-mode-bar-main">
          <span className="system-mode-bar-label">SYSTEM MODE</span><strong className="system-mode-bar-value">{state.system_mode}</strong>
          <span className="system-mode-bar-divider">/</span>
          <span className="system-mode-bar-label">PUBLISH MODE</span><strong className="system-mode-bar-value">{state.publish_mode}</strong>
          <span className={`system-mode-flag ${state.force_stop ? 'is-on' : 'is-off'}`}>FORCE STOP: {state.force_stop ? 'ON' : 'OFF'}</span>
        </div>
        <div className="system-mode-bar-side">{liveHint}</div>
      </section>

      {isReadonlyOpenSource ? <p className="page-note">opensource 模式只读展示，不写入 internal 控制状态。</p> : null}
      {error ? <p className="page-note" style={{ color: '#fca5a5' }}>{error}</p> : null}

      <section className="panel strong-card consultant-editor-panel">
        <div className="panel-header align-start">
          <h3>控制面板</h3>
          <span className="home-count">app_mode {state.app_mode}</span>
        </div>
        <div className="consultant-form-grid">
          <label>
            <span>system_mode</span>
            <select value={state.system_mode} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ system_mode: e.target.value as SystemModeValue })}>
              <option value="dev">dev</option>
              <option value="test">test</option>
              <option value="live">live</option>
            </select>
          </label>
          <label>
            <span>publish_mode</span>
            <select value={state.publish_mode} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ publish_mode: e.target.value as PublishModeValue })}>
              <option value="auto_disabled">auto_disabled</option>
              <option value="manual_only">manual_only</option>
              <option value="semi_auto">semi_auto</option>
            </select>
          </label>
          <label>
            <span>force_stop</span>
            <select value={String(state.force_stop)} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ force_stop: e.target.value === 'true' })}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </label>
          <label>
            <span>warning</span>
            <select value={String(state.warning)} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ warning: e.target.value === 'true' })}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </label>
          <label>
            <span>overload</span>
            <select value={String(state.overload)} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ overload: e.target.value === 'true' })}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </label>
          <label>
            <span>live_guardrails.enabled</span>
            <select value={String(state.live_guardrails.enabled)} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ live_guardrails: { ...state.live_guardrails, enabled: e.target.value === 'true' } as SystemControlState['live_guardrails'] })}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </label>
        </div>

        <div className="cross-link-row top-gap">
          <span className="inline-link-chip">warning: {String(state.warning)}</span>
          <span className="inline-link-chip">overload: {String(state.overload)}</span>
          <span className="inline-link-chip">guardrails: {state.live_guardrails.enabled ? 'enabled' : 'disabled'}</span>
          <Link className="inline-link-chip" to="/">返回 Dashboard</Link>
        </div>
      </section>

      <section className="panel strong-card">
        <div className="panel-header">
          <h3>decision_log / audit_log 证据</h3>
          <span className="badge-count">{auditEntries.length}</span>
        </div>
        <div className="consultant-evidence-list">
          {state.decision_log.slice(0, 6).map((entry, index) => (
            <article key={`${entry.timestamp}-${index}`} className="consultant-evidence-card">
              <strong>{entry.action}</strong>
              <p>{entry.reason} · {entry.detail}</p>
              <small>{entry.actor || '-'} · {entry.timestamp}</small>
              <EvidenceObjectLinks
                textParts={[entry.action, entry.reason, entry.detail, entry.actor]}
                signalParts={[entry.detail, entry.actor]}
                currentSearch={linking.currentSearch}
                projects={projects}
                agents={agents}
                rooms={rooms}
                tasks={tasks}
              />
            </article>
          ))}
          {auditEntries.filter((entry) => entry.action.includes('system_mode')).slice(0, 6).map((entry) => (
            <article key={entry.id} className="consultant-evidence-card">
              <strong>{entry.action}</strong>
              <p>{entry.target}</p>
              <small>{entry.result} · {entry.time}</small>
              <EvidenceObjectLinks
                textParts={[entry.action, entry.target, entry.result]}
                signalParts={[entry.actor, entry.target, entry.result]}
                currentSearch={linking.currentSearch}
                projects={projects}
                agents={agents}
                rooms={rooms}
                tasks={tasks}
              />
            </article>
          ))}
          {!state.decision_log.length ? <p className="empty-state">暂无 decision_log 证据。</p> : null}
        </div>
      </section>
    </section>
  )
}
