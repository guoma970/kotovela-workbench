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
import { formatReadableDetail, formatReadableOwner, formatReadableTaskTitle, formatReadableTime } from '../lib/readableText'
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

const SYSTEM_MODE_LABELS: Record<SystemModeValue, string> = {
  dev: '开发验证',
  test: '测试验证',
  live: '正式运行',
}

const PUBLISH_MODE_LABELS: Record<PublishModeValue, string> = {
  auto_disabled: '自动发布关闭',
  manual_only: '仅手动发布',
  semi_auto: '半自动发布',
}

const APP_MODE_LABELS: Record<string, string> = {
  internal: '内部版',
  opensource: '开源版',
}

const formatControlDetail = (value: string) =>
  formatReadableDetail(value)
    .replace(/system_mode/g, '系统模式')
    .replace(/publish_mode/g, '发布状态')
    .replace(/force_stop/g, '紧急停止')
    .replace(/guardrails/g, '安全规则')
    .replace(/warning/g, '安全提醒')
    .replace(/overload/g, '负载状态')
    .replace(/manual_change/g, '人工调整')
    .replace(/builder/gi, '研发位')
    .replace(/=true/g, '=已开启')
    .replace(/=false/g, '=未开启')

const formatControlAction = (value: string) =>
  formatControlDetail(value)
    .replace(/_updated/gi, '已更新')
    .replace(/system_mode_updated/gi, '已调整运行方式')
    .replace(/publish_mode_updated/gi, '已调整发布节奏')
    .replace(/force_stop_updated/gi, '已调整紧急停止')
    .replace(/warning_updated/gi, '已调整风险提醒')
    .replace(/overload_updated/gi, '已调整繁忙程度')
    .replace(/guardrails_updated/gi, '已调整保护规则')
    .replace(/system mode/gi, '系统模式调整')
    .replace(/publish mode/gi, '发布状态调整')
    .replace(/force stop/gi, '紧急停止调整')
    .replace(/live guardrails/gi, '安全规则调整')

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
        ? '正式模式 · 真实业务流量已开启'
        : '非正式环境，仅供联调与验证',
    [state.system_mode],
  )

  const isReadonlyOpenSource = APP_MODE === 'opensource'

  return (
    <section className="page consultant-settings-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">系统设置</p>
          <h2>系统设置</h2>
        </div>
        <p className="page-note">统一查看当前如何运行、发布节奏是否放开，以及遇到异常时是否会立即拦停。</p>
      </div>

      <section className={`panel strong-card system-mode-bar ${state.system_mode === 'live' ? 'is-live' : state.system_mode === 'test' ? 'is-test' : 'is-dev'}`}>
        <div className="system-mode-bar-main">
          <span className="system-mode-bar-label">系统模式</span><strong className="system-mode-bar-value">{SYSTEM_MODE_LABELS[state.system_mode]}</strong>
          <span className="system-mode-bar-divider">/</span>
          <span className="system-mode-bar-label">发布状态</span><strong className="system-mode-bar-value">{PUBLISH_MODE_LABELS[state.publish_mode]}</strong>
          <span className={`system-mode-flag ${state.force_stop ? 'is-on' : 'is-off'}`}>紧急停止：{state.force_stop ? '已开启' : '未开启'}</span>
        </div>
        <div className="system-mode-bar-side">{liveHint}</div>
      </section>

      {isReadonlyOpenSource ? <p className="page-note">开源演示模式只读展示，不写入内部控制状态。</p> : null}
      {error ? <p className="page-note" style={{ color: '#fca5a5' }}>{error}</p> : null}

      <section className="panel strong-card consultant-editor-panel">
        <div className="panel-header align-start">
          <h3>运行与发布设置</h3>
          <span className="home-count">{APP_MODE_LABELS[state.app_mode] ?? state.app_mode}</span>
        </div>
        <div className="consultant-form-grid">
          <label>
            <span>运行方式</span>
            <select value={state.system_mode} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ system_mode: e.target.value as SystemModeValue })}>
              <option value="dev">开发验证</option>
              <option value="test">测试验证</option>
              <option value="live">正式运行</option>
            </select>
          </label>
          <label>
            <span>发布节奏</span>
            <select value={state.publish_mode} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ publish_mode: e.target.value as PublishModeValue })}>
              <option value="auto_disabled">自动发布关闭</option>
              <option value="manual_only">仅手动发布</option>
              <option value="semi_auto">半自动发布</option>
            </select>
          </label>
          <label>
            <span>紧急停止</span>
            <select value={String(state.force_stop)} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ force_stop: e.target.value === 'true' })}>
              <option value="false">未开启</option>
              <option value="true">已开启</option>
            </select>
          </label>
          <label>
            <span>风险提醒</span>
            <select value={String(state.warning)} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ warning: e.target.value === 'true' })}>
              <option value="false">未开启</option>
              <option value="true">已开启</option>
            </select>
          </label>
          <label>
            <span>繁忙程度</span>
            <select value={String(state.overload)} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ overload: e.target.value === 'true' })}>
              <option value="false">正常</option>
              <option value="true">偏高</option>
            </select>
          </label>
          <label>
            <span>保护规则</span>
            <select value={String(state.live_guardrails.enabled)} disabled={saving || isReadonlyOpenSource} onChange={(e) => save({ live_guardrails: { ...state.live_guardrails, enabled: e.target.value === 'true' } as SystemControlState['live_guardrails'] })}>
              <option value="false">未开启</option>
              <option value="true">已开启</option>
            </select>
          </label>
        </div>

        <div className="cross-link-row top-gap">
          <span className="inline-link-chip">风险提醒：{state.warning ? '已开启' : '未开启'}</span>
          <span className="inline-link-chip">繁忙程度：{state.overload ? '偏高' : '正常'}</span>
          <span className="inline-link-chip">保护规则：{state.live_guardrails.enabled ? '已开启' : '未开启'}</span>
          <Link className="inline-link-chip" to="/">返回总览</Link>
        </div>
      </section>

      <section className="panel strong-card">
        <div className="panel-header">
          <h3>最近系统调整</h3>
          <span className="badge-count">{auditEntries.length}</span>
        </div>
        <p className="page-note">先看最近改了什么、为什么改；如需排障，再展开原始记录。</p>
        <div className="consultant-evidence-list">
          {state.decision_log.slice(0, 6).map((entry, index) => (
            <article key={`${entry.timestamp}-${index}`} className="consultant-evidence-card">
              <strong>{formatControlAction(entry.action)}</strong>
              <p>{formatControlDetail(entry.reason)}</p>
              <small>{formatReadableOwner(entry.actor)} · {formatReadableTime(entry.timestamp)}</small>
              <details className="scheduler-debug-block" style={{ marginTop: 8 }}>
                <summary className="scheduler-task-result-head">
                  <strong>查看原始记录</strong>
                </summary>
                <div className="top-gap">
                  <p>详细说明：{formatControlDetail(entry.detail)}</p>
                  <EvidenceObjectLinks
                    textParts={[entry.action, entry.reason, entry.detail, entry.actor]}
                    signalParts={[entry.detail, entry.actor]}
                    currentSearch={linking.currentSearch}
                    projects={projects}
                    agents={agents}
                    rooms={rooms}
                    tasks={tasks}
                    routingHints={{
                      agentSignals: [entry.actor],
                      roomSignals: [entry.reason, entry.detail],
                      taskSignals: [entry.action, entry.reason],
                    }}
                  />
                </div>
              </details>
            </article>
          ))}
          {!state.decision_log.length ? <p className="empty-state">还没有操作记录。</p> : null}
        </div>
        <details className="scheduler-debug-block top-gap">
          <summary className="scheduler-task-result-head">
            <strong>查看原始变更记录（排障用）</strong>
          </summary>
          <div className="consultant-evidence-list top-gap">
            {auditEntries.filter((entry) => entry.action.includes('system_mode')).slice(0, 6).map((entry, index) => (
              <article key={`${entry.id}-${index}`} className="consultant-evidence-card">
                <strong>{formatControlAction(entry.action)}</strong>
                <p>{formatReadableTaskTitle(entry.target)}</p>
                <small>{formatControlDetail(entry.result)} · {formatReadableTime(entry.time)}</small>
                <EvidenceObjectLinks
                  textParts={[entry.action, entry.target, entry.result]}
                  signalParts={[entry.user, entry.target, entry.result]}
                  currentSearch={linking.currentSearch}
                  projects={projects}
                  agents={agents}
                  rooms={rooms}
                  tasks={tasks}
                  routingHints={{
                    agentSignals: [entry.user],
                    roomSignals: [entry.target, entry.result],
                    taskSignals: [entry.action],
                  }}
                />
              </article>
            ))}
          </div>
        </details>
      </section>
    </section>
  )
}
