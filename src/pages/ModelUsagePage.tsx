import { useEffect, useMemo, useState } from 'react'

type UsageBucket = {
  key: string
  label?: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  messageCount: number
}

type ModelUsagePayload = {
  generated_at: string
  source: 'local-openclaw' | 'partial' | 'unavailable'
  window_hours: number
  codex_usage?: {
    five_hour_left_pct?: number
    week_left_pct?: number
    raw_line?: string
  }
  claude_code_usage?: {
    subscription_created_at?: string
    organization_rate_limit_tier?: string
    user_rate_limit_tier?: string
    has_extra_usage_enabled?: boolean
    extra_usage_disabled_reason?: string
    usage_limit_notifications_enabled?: boolean
    project_count: number
    recent_activity: {
      event_count: number
      session_count: number
      active_session_count: number
      idle_session_count: number
      known_session_count: number
      last_event_at?: string
      last_session_at?: string
    }
  }
  agents: Array<{
    id: string
    label: string
    configured_model?: string
    fallback_models: string[]
    codex_profiles: string[]
    codex_order: string[]
    codex_last_good?: string
    codex_session_overrides: Array<{
      profile: string
      count: number
    }>
    codex_usage_stats: Array<{
      profile: string
      error_count?: number
      cooldown_reason?: string
      cooldown_until?: string
      last_used?: string
      last_failure_at?: string
    }>
  }>
  recent_usage: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    totalTokens: number
    messageCount: number
    by_model: UsageBucket[]
    by_agent: UsageBucket[]
  }
  warnings: string[]
}

const numberFormatter = new Intl.NumberFormat('zh-CN')

const formatNumber = (value: number | undefined) => numberFormatter.format(Math.round(value ?? 0))

const formatTime = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

const formatTier = (value?: string) => {
  if (!value) return '-'
  return value.replace(/[_-]+/g, ' ')
}

const formatFlag = (value?: boolean, truthy = '开启', falsy = '关闭') => {
  if (typeof value !== 'boolean') return '-'
  return value ? truthy : falsy
}

const pctTone = (value?: number) => {
  if (typeof value !== 'number') return 'is-unknown'
  if (value <= 15) return 'is-critical'
  if (value <= 35) return 'is-warning'
  return 'is-healthy'
}

function UsageMeter({ value }: { value?: number }) {
  const safeValue = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 0
  return (
    <div className="model-usage-meter" aria-label={`remaining ${safeValue}%`}>
      <span style={{ width: `${safeValue}%` }} />
    </div>
  )
}

function UsageRankList({ title, items }: { title: string; items: UsageBucket[] }) {
  const max = Math.max(...items.map((item) => item.totalTokens), 1)
  return (
    <section className="panel strong-card model-usage-rank-panel">
      <div className="panel-header">
        <h3>{title}</h3>
        <span className="badge-count">{items.length}</span>
      </div>
      <div className="model-usage-rank-list">
        {items.length ? (
          items.slice(0, 8).map((item) => (
            <article key={item.key} className="model-usage-rank-row">
              <div>
                <strong>{item.label || item.key}</strong>
                <small>{item.messageCount} 条 assistant usage · cache read {formatNumber(item.cacheRead)}</small>
              </div>
              <div className="model-usage-rank-value">
                <span>{formatNumber(item.totalTokens)}</span>
                <div className="model-usage-bar"><i style={{ width: `${Math.max(4, (item.totalTokens / max) * 100)}%` }} /></div>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">近窗口内暂无可解析 usage。</p>
        )}
      </div>
    </section>
  )
}

export function ModelUsagePage() {
  const [payload, setPayload] = useState<ModelUsagePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/model-usage', { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setPayload(await response.json() as ModelUsagePayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : '模型额度加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const activeCodexOrder = useMemo(() => {
    const main = payload?.agents.find((agent) => agent.id === 'main')
    return main?.codex_order.join(' → ') || '-'
  }, [payload])

  const claudeRecent = payload?.claude_code_usage?.recent_activity

  return (
    <section className="page model-usage-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Model Usage</p>
          <h2>模型额度与使用情况</h2>
        </div>
        <p className="page-note">本页只读展示 OpenClaw 本机模型、Codex 调用顺序、Claude Code 账户信息与近 24 小时调用记录，不显示敏感密钥。</p>
      </div>

      <div className="model-usage-provider-grid">
        <section className="panel strong-card model-usage-hero">
          <div>
            <span className="model-usage-kicker">OpenAI Codex</span>
            <strong className="model-usage-hero-value">{payload?.codex_usage?.five_hour_left_pct ?? '-'}%</strong>
            <p>5 小时额度剩余 · 当前策略：{activeCodexOrder}</p>
            <UsageMeter value={payload?.codex_usage?.five_hour_left_pct} />
          </div>
          <div className="model-usage-hero-side">
            <span className={`model-usage-state ${pctTone(payload?.codex_usage?.five_hour_left_pct)}`}>
              5h {payload?.codex_usage?.five_hour_left_pct ?? '-'}%
            </span>
            <span className={`model-usage-state ${pctTone(payload?.codex_usage?.week_left_pct)}`}>
              Week {payload?.codex_usage?.week_left_pct ?? '-'}%
            </span>
            <button className="auto-task-go-btn" type="button" onClick={load} disabled={loading}>
              {loading ? '刷新中' : '刷新'}
            </button>
          </div>
        </section>

        <section className="panel strong-card model-usage-hero model-usage-hero-claude">
          <div>
            <span className="model-usage-kicker">Claude Code</span>
            <strong className="model-usage-hero-value">{formatNumber(claudeRecent?.event_count)}</strong>
            <p>近 {payload?.window_hours ?? 24} 小时本机活跃记录 · 组织档位：{formatTier(payload?.claude_code_usage?.organization_rate_limit_tier)}</p>
            <div className="model-usage-inline-meta">
              <small>最近活跃：{formatTime(claudeRecent?.last_event_at || claudeRecent?.last_session_at)}</small>
              <small>订阅开始：{formatTime(payload?.claude_code_usage?.subscription_created_at)}</small>
            </div>
          </div>
          <div className="model-usage-hero-side">
            <span className={`model-usage-state ${payload?.claude_code_usage?.has_extra_usage_enabled ? 'is-healthy' : 'is-warning'}`}>
              Extra usage {formatFlag(payload?.claude_code_usage?.has_extra_usage_enabled, 'on', 'off')}
            </span>
            <span className="model-usage-state">
              {formatNumber(claudeRecent?.known_session_count)} sessions
            </span>
            <span className="model-usage-state">
              {formatNumber(payload?.claude_code_usage?.project_count)} projects
            </span>
          </div>
        </section>
      </div>

      {error ? <p className="page-note" style={{ color: '#fca5a5' }}>{error}</p> : null}

      <div className="stats-grid model-usage-stat-grid">
        <article className="stat-card strong-card">
          <span className="stat-label">近 {payload?.window_hours ?? 24} 小时用量</span>
          <strong className="stat-value">{formatNumber(payload?.recent_usage.totalTokens)}</strong>
        </article>
        <article className="stat-card strong-card">
          <span className="stat-label">input / output</span>
          <strong className="stat-value">{formatNumber(payload?.recent_usage.input)} / {formatNumber(payload?.recent_usage.output)}</strong>
        </article>
        <article className="stat-card strong-card">
          <span className="stat-label">cache read</span>
          <strong className="stat-value">{formatNumber(payload?.recent_usage.cacheRead)}</strong>
        </article>
        <article className="stat-card strong-card">
          <span className="stat-label">usage messages</span>
          <strong className="stat-value">{formatNumber(payload?.recent_usage.messageCount)}</strong>
        </article>
      </div>

      <section className="panel strong-card">
        <div className="panel-header">
          <h3>Claude Code 本机额度线索</h3>
          <span className="home-count">{payload?.claude_code_usage ? 'local-claude' : 'unavailable'}</span>
        </div>
        <div className="model-usage-agent-grid">
          <article className="model-usage-agent-card">
            <div className="model-usage-agent-head">
              <strong>账户与限流档位</strong>
              <span>Claude</span>
            </div>
            <p>组织档位：<b>{formatTier(payload?.claude_code_usage?.organization_rate_limit_tier)}</b></p>
            <p>个人档位：<b>{formatTier(payload?.claude_code_usage?.user_rate_limit_tier)}</b></p>
            <p>Extra usage：<b>{formatFlag(payload?.claude_code_usage?.has_extra_usage_enabled, '已开启', '未开启')}</b></p>
            <p>限额提醒：<b>{formatFlag(payload?.claude_code_usage?.usage_limit_notifications_enabled, '已开启', '未开启')}</b></p>
            <p>关闭原因：{payload?.claude_code_usage?.extra_usage_disabled_reason || '-'}</p>
          </article>
          <article className="model-usage-agent-card">
            <div className="model-usage-agent-head">
              <strong>最近活跃度</strong>
              <span>{payload?.window_hours ?? 24}h</span>
            </div>
            <p>history 记录：<b>{formatNumber(claudeRecent?.event_count)}</b></p>
            <p>活跃 sessionId：<b>{formatNumber(claudeRecent?.session_count)}</b></p>
            <p>已知本机会话：<b>{formatNumber(claudeRecent?.known_session_count)}</b>（active {formatNumber(claudeRecent?.active_session_count)} / idle {formatNumber(claudeRecent?.idle_session_count)}）</p>
            <p>最近 history：{formatTime(claudeRecent?.last_event_at)}</p>
            <p>最近 session：{formatTime(claudeRecent?.last_session_at)}</p>
          </article>
        </div>
      </section>

      <section className="panel strong-card">
        <div className="panel-header">
          <h3>实例模型与 Codex 账号顺序</h3>
          <span className="badge-count">{payload?.agents.length ?? 0}</span>
        </div>
        <div className="model-usage-agent-grid">
          {payload?.agents.map((agent) => (
            <article key={agent.id} className="model-usage-agent-card">
              <div className="model-usage-agent-head">
                <strong>{agent.label}</strong>
                <span>{agent.id}</span>
              </div>
              <p>当前模型：<b>{agent.configured_model || '-'}</b></p>
              <p>Fallback：{agent.fallback_models.length ? agent.fallback_models.join(' / ') : '-'}</p>
              <p>Codex 顺序：{agent.codex_order.length ? agent.codex_order.join(' → ') : '-'}</p>
              <p>lastGood：{agent.codex_last_good || '-'}</p>
              {agent.codex_session_overrides.length ? (
                <p>会话覆盖：{agent.codex_session_overrides.map((item) => `${item.profile} × ${item.count}`).join(' / ')}</p>
              ) : null}
              {agent.codex_usage_stats.length ? (
                <div className="model-usage-profile-list">
                  {agent.codex_usage_stats.map((stats) => (
                    <small key={stats.profile}>
                      {stats.profile} · errors {stats.error_count ?? 0}
                      {stats.cooldown_reason ? ` · cooldown ${stats.cooldown_reason}` : ''}
                      {stats.last_used ? ` · last ${formatTime(stats.last_used)}` : ''}
                    </small>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <div className="model-usage-rank-grid">
        <UsageRankList title="按模型聚合" items={payload?.recent_usage.by_model ?? []} />
        <UsageRankList title="按实例聚合" items={payload?.recent_usage.by_agent ?? []} />
      </div>

      <section className="panel strong-card">
        <div className="panel-header">
          <h3>数据源与告警</h3>
          <span className="home-count">{payload?.source ?? 'loading'}</span>
        </div>
        <p className="page-note">
          更新时间：{formatTime(payload?.generated_at)}。Codex 百分比来自 `openclaw models status`，用量数据来自本机近 24 小时会话记录；Claude Code 线索来自本机 `.claude.json`、`history.jsonl` 与 `sessions` 元数据。
        </p>
        {payload?.warnings.length ? (
          <div className="consultant-evidence-list">
            {payload.warnings.map((warning) => (
              <article key={warning} className="consultant-evidence-card">
                <strong>warning</strong>
                <p>{warning}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">暂无数据采集告警。</p>
        )}
      </section>
    </section>
  )
}
