import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  if (!value) return '暂未同步'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂未同步'
  return date.toLocaleString('zh-CN', { hour12: false })
}

const formatTier = (value?: string) => {
  if (!value) return '暂未同步'
  return value.replace(/[_-]+/g, ' ')
}

const formatFlag = (value?: boolean, truthy = '开启', falsy = '关闭', fallback = '暂未同步') => {
  if (typeof value !== 'boolean') return fallback
  return value ? truthy : falsy
}

const maskEmail = (value?: string) => {
  if (!value) return undefined
  return value.replace(
    /([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*)(@[\w.-]+\.[A-Za-z]{2,})/g,
    (_, first: string, _middle: string, domain: string) => `${first}***${domain}`,
  )
}

const formatAccountLabel = (value?: string, fallback = '账号信息暂未同步') => {
  if (!value) return fallback
  const masked = maskEmail(value) ?? value
  return masked.replace(/^openai-codex:/, 'Codex 账号：')
}

const formatDisabledReason = (value?: string) => {
  switch (value) {
    case 'org_level_disabled':
      return '组织层已关闭'
    case 'user_level_disabled':
      return '当前账号已关闭'
    case 'rate_limit_reached':
      return '已达到限额'
    case undefined:
    case '':
      return '当前未限制'
    default:
      return value.replace(/[_-]+/g, ' ')
  }
}

const formatModelName = (value?: string) => maskEmail(value) ?? value ?? '模型信息暂未同步'

const formatModelList = (values: string[]) =>
  values.length ? values.map((item) => formatModelName(item)).join(' / ') : '模型信息暂未同步'

const formatModelUsageSource = (value?: ModelUsagePayload['source']) => {
  switch (value) {
    case 'local-openclaw':
      return '本机实时数据'
    case 'partial':
      return '部分同步成功'
    case 'unavailable':
      return '当前不可用'
    default:
      return '加载中'
  }
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
                <small>{item.messageCount} 条用量记录 · 缓存命中 {formatNumber(item.cacheRead)}</small>
              </div>
              <div className="model-usage-rank-value">
                <span>{formatNumber(item.totalTokens)}</span>
                <div className="model-usage-bar"><i style={{ width: `${Math.max(4, (item.totalTokens / max) * 100)}%` }} /></div>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">近窗口内暂无可解析的用量记录。</p>
        )}
      </div>
    </section>
  )
}

export function ModelUsagePage() {
  const [payload, setPayload] = useState<ModelUsagePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const activeRequestRef = useRef(0)
  const activeAbortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    const requestId = activeRequestRef.current + 1
    activeRequestRef.current = requestId
    activeAbortRef.current?.abort()
    const abortController = new AbortController()
    activeAbortRef.current = abortController
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/model-usage', { cache: 'no-store', signal: abortController.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const nextPayload = await response.json() as ModelUsagePayload
      if (requestId !== activeRequestRef.current) return
      setPayload(nextPayload)
    } catch (err) {
      if (abortController.signal.aborted || requestId !== activeRequestRef.current) return
      setError(err instanceof Error ? err.message : '模型额度加载失败')
    } finally {
      if (requestId === activeRequestRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      void load()
    }, 60_000)
    return () => {
      window.clearInterval(timer)
      activeAbortRef.current?.abort()
    }
  }, [load])

  const activeCodexOrder = useMemo(() => {
    const main = payload?.agents.find((agent) => agent.id === 'main')
    return main?.codex_order.length
      ? main.codex_order.map((item) => formatAccountLabel(item)).join(' → ')
      : '账号顺序暂未同步'
  }, [payload])

  const claudeRecent = payload?.claude_code_usage?.recent_activity

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Kotovela Hub · 用量统计'

    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <section className="page model-usage-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Kotovela Hub</p>
          <h2>用量统计</h2>
        </div>
        <p className="page-note">本页只读展示当前模型用量、账号先后顺序和近 24 小时调用记录；账号默认脱敏展示，不显示敏感信息。</p>
      </div>

      <div className="model-usage-provider-grid">
        <section className="panel strong-card model-usage-hero">
          <div>
            <span className="model-usage-kicker">Codex</span>
            <strong className="model-usage-hero-value">{payload?.codex_usage?.five_hour_left_pct ?? '-'}%</strong>
            <p>5 小时额度剩余 · 当前策略：{activeCodexOrder}</p>
            <UsageMeter value={payload?.codex_usage?.five_hour_left_pct} />
          </div>
          <div className="model-usage-hero-side">
            <span className={`model-usage-state ${pctTone(payload?.codex_usage?.five_hour_left_pct)}`}>
              5 小时 {payload?.codex_usage?.five_hour_left_pct ?? '-'}%
            </span>
            <span className={`model-usage-state ${pctTone(payload?.codex_usage?.week_left_pct)}`}>
              周额度 {payload?.codex_usage?.week_left_pct ?? '-'}%
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
              附加额度 {formatFlag(payload?.claude_code_usage?.has_extra_usage_enabled, '已开启', '未开启')}
            </span>
            <span className="model-usage-state">
              {formatNumber(claudeRecent?.known_session_count)} 本机会话
            </span>
            <span className="model-usage-state">
              {formatNumber(payload?.claude_code_usage?.project_count)} 个项目
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
          <span className="stat-label">输入 / 输出</span>
          <strong className="stat-value">{formatNumber(payload?.recent_usage.input)} / {formatNumber(payload?.recent_usage.output)}</strong>
        </article>
        <article className="stat-card strong-card">
          <span className="stat-label">缓存命中</span>
          <strong className="stat-value">{formatNumber(payload?.recent_usage.cacheRead)}</strong>
        </article>
        <article className="stat-card strong-card">
          <span className="stat-label">记录条数</span>
          <strong className="stat-value">{formatNumber(payload?.recent_usage.messageCount)}</strong>
        </article>
      </div>

      <section className="panel strong-card">
        <div className="panel-header">
          <h3>Claude Code 使用状态</h3>
          <span className="home-count">{payload?.claude_code_usage ? '本机 Claude' : '当前不可用'}</span>
        </div>
        <div className="model-usage-agent-grid">
          <article className="model-usage-agent-card">
            <div className="model-usage-agent-head">
              <strong>账户与限流档位</strong>
              <span>Claude</span>
            </div>
            <p>组织档位：<b>{formatTier(payload?.claude_code_usage?.organization_rate_limit_tier)}</b></p>
            <p>个人档位：<b>{formatTier(payload?.claude_code_usage?.user_rate_limit_tier)}</b></p>
            <p>附加额度：<b>{formatFlag(payload?.claude_code_usage?.has_extra_usage_enabled, '已开启', '未开启')}</b></p>
            <p>限额提醒：<b>{formatFlag(payload?.claude_code_usage?.usage_limit_notifications_enabled, '已开启', '未开启')}</b></p>
            <p>附加额度状态：{formatDisabledReason(payload?.claude_code_usage?.extra_usage_disabled_reason)}</p>
          </article>
          <article className="model-usage-agent-card">
            <div className="model-usage-agent-head">
              <strong>最近活跃度</strong>
              <span>近 {payload?.window_hours ?? 24} 小时</span>
            </div>
            <p>活跃记录数：<b>{formatNumber(claudeRecent?.event_count)}</b></p>
            <p>活跃会话数：<b>{formatNumber(claudeRecent?.session_count)}</b></p>
            <p>已识别本机会话：<b>{formatNumber(claudeRecent?.known_session_count)}</b>（活跃 {formatNumber(claudeRecent?.active_session_count)} / 空闲 {formatNumber(claudeRecent?.idle_session_count)}）</p>
            <p>最近记录：{formatTime(claudeRecent?.last_event_at)}</p>
            <p>最近会话：{formatTime(claudeRecent?.last_session_at)}</p>
          </article>
        </div>
      </section>

      <section className="panel strong-card">
        <div className="panel-header">
          <h3>协作者与账号顺序</h3>
          <span className="badge-count">{payload?.agents.length ?? 0}</span>
        </div>
        <div className="model-usage-agent-grid">
          {payload?.agents.map((agent) => (
            <article key={agent.id} className="model-usage-agent-card">
              <div className="model-usage-agent-head">
                <strong>{agent.label}</strong>
                <span>{agent.id}</span>
              </div>
              <p>当前模型：<b>{formatModelName(agent.configured_model)}</b></p>
              <p>备用模型：{formatModelList(agent.fallback_models)}</p>
              <p>账号顺序：{agent.codex_order.length ? agent.codex_order.map((item) => formatAccountLabel(item)).join(' → ') : '账号顺序暂未同步'}</p>
              <p>最近可用账号：{agent.codex_last_good ? formatAccountLabel(agent.codex_last_good) : '账号信息暂未同步'}</p>
              {agent.codex_session_overrides.length ? (
              <p>临时切换账号：{agent.codex_session_overrides.map((item) => `${formatAccountLabel(item.profile)} × ${item.count}`).join(' / ')}</p>
              ) : null}
              {agent.codex_usage_stats.length ? (
                <div className="model-usage-profile-list">
                  {agent.codex_usage_stats.map((stats) => (
                    <small key={stats.profile}>
                      {formatAccountLabel(stats.profile)} · 异常次数 {stats.error_count ?? 0}
                      {stats.cooldown_reason ? ` · 暂停原因 ${stats.cooldown_reason}` : ''}
                      {stats.last_used ? ` · 最近使用 ${formatTime(stats.last_used)}` : ''}
                    </small>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <div className="model-usage-rank-grid">
        <UsageRankList title="按模型查看" items={payload?.recent_usage.by_model ?? []} />
        <UsageRankList title="按协作者查看" items={payload?.recent_usage.by_agent ?? []} />
      </div>

      <section className="panel strong-card">
        <div className="panel-header">
          <h3>数据更新与提醒</h3>
          <span className="home-count">{formatModelUsageSource(payload?.source)}</span>
        </div>
        <p className="page-note">
          更新时间：{formatTime(payload?.generated_at)}。额度百分比来自本机状态检查；近 24 小时用量来自本机使用记录；Claude Code 状态来自本机账户与会话信息。
        </p>
        {payload?.warnings.length ? (
          <div className="consultant-evidence-list">
            {payload.warnings.map((warning) => (
              <article key={warning} className="consultant-evidence-card">
                <strong>提示</strong>
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
