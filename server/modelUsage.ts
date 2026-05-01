import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const USER_HOME = process.env.HOME ?? ''
const OPENCLAW_BIN = process.env.OPENCLAW_BIN?.trim() || (USER_HOME ? path.join(USER_HOME, '.npm-global/bin/openclaw') : 'openclaw')
const OPENCLAW_HOME = process.env.OPENCLAW_HOME?.trim() || (USER_HOME ? path.join(USER_HOME, '.openclaw') : '.openclaw')
const OPENCLAW_CONFIG_FILE = path.join(OPENCLAW_HOME, 'openclaw.json')
const AGENTS_ROOT = path.join(OPENCLAW_HOME, 'agents')
const CLAUDE_HOME = path.join(USER_HOME, '.claude')
const CLAUDE_STATE_FILE = path.join(USER_HOME, '.claude.json')
const CLAUDE_HISTORY_FILE = path.join(CLAUDE_HOME, 'history.jsonl')
const CLAUDE_SESSIONS_DIR = path.join(CLAUDE_HOME, 'sessions')
const WINDOW_HOURS = 24
const MAX_SESSION_FILES_PER_AGENT = 40

const AGENT_LABELS: Record<string, string> = {
  main: '小树 / 数字指挥官',
  builder: '小筑 / 开发助手',
  media: '小果 / 内容助手',
  family: '小羲 / 家庭助手',
  business: '小言 / 业务助手',
  personal: '小柒 / 个人助手',
}

type UnknownRecord = Record<string, unknown>

export type ModelUsageBucket = {
  key: string
  label?: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  messageCount: number
}

export type ModelUsagePayload = {
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
    by_model: ModelUsageBucket[]
    by_agent: ModelUsageBucket[]
  }
  warnings: string[]
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readJsonFile = async (filePath: string): Promise<UnknownRecord | undefined> => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as UnknownRecord
  } catch {
    return undefined
  }
}

const toIso = (value: unknown): string | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return new Date(value).toISOString()
}

const stringValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

const toTimestamp = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const toIsoFromValue = (value: unknown): string | undefined => {
  const timestamp = toTimestamp(value)
  return typeof timestamp === 'number' ? new Date(timestamp).toISOString() : undefined
}

const numberValue = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return value
}

const addUsage = (
  target: Pick<ModelUsageBucket, 'input' | 'output' | 'cacheRead' | 'cacheWrite' | 'totalTokens' | 'messageCount'>,
  usage: UnknownRecord,
) => {
  const input = numberValue(usage.input)
  const output = numberValue(usage.output)
  const cacheRead = numberValue(usage.cacheRead)
  const cacheWrite = numberValue(usage.cacheWrite)
  const totalTokens =
    numberValue(usage.totalTokens) || numberValue(usage.total) || input + output + cacheRead + cacheWrite

  target.input += input
  target.output += output
  target.cacheRead += cacheRead
  target.cacheWrite += cacheWrite
  target.totalTokens += totalTokens
  target.messageCount += 1
}

const upsertBucket = (buckets: Map<string, ModelUsageBucket>, key: string, label?: string) => {
  const existing = buckets.get(key)
  if (existing) return existing
  const next: ModelUsageBucket = {
    key,
    label,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    messageCount: 0,
  }
  buckets.set(key, next)
  return next
}

const readOpenClawStatus = async (warnings: string[]) => {
  try {
    const { stdout } = await execFileAsync(OPENCLAW_BIN, ['models', 'status', '--agent', 'main'], {
      timeout: 8_000,
      maxBuffer: 1024 * 1024,
    })
    const rawLine = stdout.split('\n').find((line) => line.includes('openai-codex usage:'))?.trim()
    if (!rawLine) return undefined

    return {
      raw_line: rawLine,
      five_hour_left_pct: Number(rawLine.match(/5h\s+(\d+)%\s+left/)?.[1] ?? Number.NaN),
      week_left_pct: Number(rawLine.match(/Week\s+(\d+)%\s+left/)?.[1] ?? Number.NaN),
    }
  } catch (error) {
    warnings.push(`openclaw models status unavailable: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

const readAgentRuntime = async (agentId: string, config: UnknownRecord) => {
  const agentsConfig = isRecord(config.agents) ? config.agents : {}
  const list = isRecord(agentsConfig.list) ? agentsConfig.list : {}
  const agentConfig = isRecord(list[agentId]) ? list[agentId] : {}
  const model = isRecord(agentConfig.model) ? agentConfig.model : {}
  const configuredModel = typeof model.primary === 'string' ? model.primary : undefined
  const fallbackModels = Array.isArray(model.fallbacks)
    ? model.fallbacks.filter((item): item is string => typeof item === 'string')
    : []

  const authProfiles = await readJsonFile(path.join(AGENTS_ROOT, agentId, 'agent', 'auth-profiles.json'))
  const authState = await readJsonFile(path.join(AGENTS_ROOT, agentId, 'agent', 'auth-state.json'))
  const sessionsIndex = await readJsonFile(path.join(AGENTS_ROOT, agentId, 'sessions', 'sessions.json'))
  const profiles = isRecord(authProfiles?.profiles) ? authProfiles.profiles : {}
  const stateOrder = isRecord(authState?.order) ? authState.order : {}
  const stateLastGood = isRecord(authState?.lastGood) ? authState.lastGood : {}
  const stateUsageStats = isRecord(authState?.usageStats) ? authState.usageStats : {}

  const codexProfiles = Object.keys(profiles).filter((profile) => profile.startsWith('openai-codex:')).sort()
  const codexOrder = Array.isArray(stateOrder['openai-codex'])
    ? stateOrder['openai-codex'].filter((item): item is string => typeof item === 'string')
    : []
  const codexUsageStats = Object.entries(stateUsageStats)
    .filter(([profile]) => profile.startsWith('openai-codex:'))
    .map(([profile, value]) => {
      const stats = isRecord(value) ? value : {}
      return {
        profile,
        error_count: typeof stats.errorCount === 'number' ? stats.errorCount : undefined,
        cooldown_reason: typeof stats.cooldownReason === 'string' ? stats.cooldownReason : undefined,
        cooldown_until: toIso(stats.cooldownUntil),
        last_used: toIso(stats.lastUsed),
        last_failure_at: toIso(stats.lastFailureAt),
      }
    })
  const sessionOverrideCounts = new Map<string, number>()
  if (isRecord(sessionsIndex)) {
    for (const value of Object.values(sessionsIndex)) {
      if (!isRecord(value) || typeof value.authProfileOverride !== 'string') continue
      if (!value.authProfileOverride.startsWith('openai-codex:')) continue
      sessionOverrideCounts.set(value.authProfileOverride, (sessionOverrideCounts.get(value.authProfileOverride) ?? 0) + 1)
    }
  }

  return {
    id: agentId,
    label: AGENT_LABELS[agentId] ?? agentId,
    configured_model: configuredModel,
    fallback_models: fallbackModels,
    codex_profiles: codexProfiles,
    codex_order: codexOrder,
    codex_last_good: typeof stateLastGood['openai-codex'] === 'string' ? stateLastGood['openai-codex'] : undefined,
    codex_session_overrides: Array.from(sessionOverrideCounts.entries()).map(([profile, count]) => ({ profile, count })),
    codex_usage_stats: codexUsageStats,
  }
}

const listRecentSessionFiles = async (agentId: string, sinceMs: number) => {
  const sessionsDir = path.join(AGENTS_ROOT, agentId, 'sessions')
  try {
    const entries = await fs.readdir(sessionsDir)
    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.endsWith('.jsonl') && !entry.includes('.checkpoint.') && !entry.includes('.trajectory.'))
        .map(async (entry) => {
          const filePath = path.join(sessionsDir, entry)
          const stat = await fs.stat(filePath)
          return { filePath, mtimeMs: stat.mtimeMs, size: stat.size }
        }),
    )
    return candidates
      .filter((item) => item.mtimeMs >= sinceMs)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, MAX_SESSION_FILES_PER_AGENT)
  } catch {
    return []
  }
}

const collectRecentUsage = async (agentIds: string[], warnings: string[]) => {
  const sinceMs = Date.now() - WINDOW_HOURS * 60 * 60 * 1000
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, messageCount: 0 }
  const byModel = new Map<string, ModelUsageBucket>()
  const byAgent = new Map<string, ModelUsageBucket>()

  for (const agentId of agentIds) {
    const files = await listRecentSessionFiles(agentId, sinceMs)
    for (const file of files) {
      try {
        const raw = await fs.readFile(file.filePath, 'utf8')
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue
          const entry = JSON.parse(line) as UnknownRecord
          const message = isRecord(entry.message) ? entry.message : undefined
          if (!message || message.role !== 'assistant' || !isRecord(message.usage)) continue

          const timestamp = typeof message.timestamp === 'number' ? message.timestamp : Date.parse(String(entry.timestamp ?? ''))
          if (!Number.isFinite(timestamp) || timestamp < sinceMs) continue

          const provider = typeof message.provider === 'string' ? message.provider : 'unknown'
          const model = typeof message.model === 'string' ? message.model : 'unknown'
          const modelKey = `${provider}/${model}`

          addUsage(totals, message.usage)
          addUsage(upsertBucket(byModel, modelKey), message.usage)
          addUsage(upsertBucket(byAgent, agentId, AGENT_LABELS[agentId] ?? agentId), message.usage)
        }
      } catch (error) {
        warnings.push(`session usage skipped: ${path.basename(file.filePath)} (${error instanceof Error ? error.message : String(error)})`)
      }
    }
  }

  const sortBuckets = (buckets: Map<string, ModelUsageBucket>) =>
    Array.from(buckets.values()).sort((a, b) => b.totalTokens - a.totalTokens)

  return {
    ...totals,
    by_model: sortBuckets(byModel),
    by_agent: sortBuckets(byAgent),
  }
}

const readClaudeHistoryActivity = async (warnings: string[]) => {
  const sinceMs = Date.now() - WINDOW_HOURS * 60 * 60 * 1000
  try {
    const raw = await fs.readFile(CLAUDE_HISTORY_FILE, 'utf8')
    const sessionIds = new Set<string>()
    let eventCount = 0
    let lastEventMs = 0

    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      const entry = JSON.parse(line) as UnknownRecord
      const timestamp = toTimestamp(entry.timestamp)
      if (typeof timestamp !== 'number' || timestamp < sinceMs) continue

      eventCount += 1
      if (typeof entry.sessionId === 'string' && entry.sessionId) {
        sessionIds.add(entry.sessionId)
      }
      if (timestamp > lastEventMs) lastEventMs = timestamp
    }

    return {
      event_count: eventCount,
      session_count: sessionIds.size,
      last_event_at: lastEventMs ? new Date(lastEventMs).toISOString() : undefined,
    }
  } catch (error) {
    warnings.push(`claude history unavailable: ${error instanceof Error ? error.message : String(error)}`)
    return {
      event_count: 0,
      session_count: 0,
      last_event_at: undefined,
    }
  }
}

const readClaudeSessionsActivity = async (warnings: string[]) => {
  try {
    const entries = await fs.readdir(CLAUDE_SESSIONS_DIR)
    let activeSessionCount = 0
    let idleSessionCount = 0
    let knownSessionCount = 0
    let lastSessionMs = 0

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      const session = await readJsonFile(path.join(CLAUDE_SESSIONS_DIR, entry))
      if (!session) continue

      knownSessionCount += 1
      if (session.status === 'idle') idleSessionCount += 1
      else activeSessionCount += 1

      const updatedAt = toTimestamp(session.updatedAt) ?? toTimestamp(session.startedAt)
      if (typeof updatedAt === 'number' && updatedAt > lastSessionMs) {
        lastSessionMs = updatedAt
      }
    }

    return {
      active_session_count: activeSessionCount,
      idle_session_count: idleSessionCount,
      known_session_count: knownSessionCount,
      last_session_at: lastSessionMs ? new Date(lastSessionMs).toISOString() : undefined,
    }
  } catch (error) {
    warnings.push(`claude sessions unavailable: ${error instanceof Error ? error.message : String(error)}`)
    return {
      active_session_count: 0,
      idle_session_count: 0,
      known_session_count: 0,
      last_session_at: undefined,
    }
  }
}

const readClaudeCodeUsage = async (warnings: string[]) => {
  const state = await readJsonFile(CLAUDE_STATE_FILE)
  if (!state) {
    warnings.push('claude state unavailable: ~/.claude.json missing or unreadable')
    return undefined
  }

  const oauthAccount = isRecord(state.oauthAccount) ? state.oauthAccount : {}
  const growthbook = isRecord(state.cachedGrowthBookFeatures) ? state.cachedGrowthBookFeatures : {}
  const projects = isRecord(state.projects) ? state.projects : {}

  const [historyActivity, sessionActivity] = await Promise.all([
    readClaudeHistoryActivity(warnings),
    readClaudeSessionsActivity(warnings),
  ])

  return {
    subscription_created_at: toIsoFromValue(oauthAccount.subscriptionCreatedAt),
    organization_rate_limit_tier: stringValue(oauthAccount.organizationRateLimitTier),
    user_rate_limit_tier: stringValue(oauthAccount.userRateLimitTier),
    has_extra_usage_enabled:
      typeof oauthAccount.hasExtraUsageEnabled === 'boolean' ? oauthAccount.hasExtraUsageEnabled : undefined,
    extra_usage_disabled_reason: stringValue(state.cachedExtraUsageDisabledReason),
    usage_limit_notifications_enabled:
      typeof growthbook.tengu_c4w_usage_limit_notifications_enabled === 'boolean'
        ? growthbook.tengu_c4w_usage_limit_notifications_enabled
        : undefined,
    project_count: Object.keys(projects).length,
    recent_activity: {
      ...historyActivity,
      ...sessionActivity,
    },
  }
}

export async function fetchModelUsagePayload(): Promise<ModelUsagePayload> {
  const warnings: string[] = []
  const agentIds = Object.keys(AGENT_LABELS)
  const config = (await readJsonFile(OPENCLAW_CONFIG_FILE)) ?? {}

  const [codexUsage, claudeCodeUsage, agents, recentUsage] = await Promise.all([
    readOpenClawStatus(warnings),
    readClaudeCodeUsage(warnings),
    Promise.all(agentIds.map((agentId) => readAgentRuntime(agentId, config))),
    collectRecentUsage(agentIds, warnings),
  ])

  const hasAgentRuntimeSignals = agents.some(
    (agent) =>
      Boolean(agent.configured_model) ||
      agent.fallback_models.length > 0 ||
      agent.codex_profiles.length > 0 ||
      agent.codex_order.length > 0 ||
      agent.codex_session_overrides.length > 0 ||
      agent.codex_usage_stats.length > 0,
  )
  const hasUsageSignals = recentUsage.totalTokens > 0 || recentUsage.messageCount > 0
  const hasAnySignals = Boolean(codexUsage) || Boolean(claudeCodeUsage) || hasAgentRuntimeSignals || hasUsageSignals
  const source: ModelUsagePayload['source'] = !hasAnySignals ? 'unavailable' : warnings.length > 0 ? 'partial' : 'local-openclaw'

  return {
    generated_at: new Date().toISOString(),
    source,
    window_hours: WINDOW_HOURS,
    codex_usage: codexUsage
      ? {
          ...codexUsage,
          five_hour_left_pct: Number.isFinite(codexUsage.five_hour_left_pct) ? codexUsage.five_hour_left_pct : undefined,
          week_left_pct: Number.isFinite(codexUsage.week_left_pct) ? codexUsage.week_left_pct : undefined,
        }
      : undefined,
    claude_code_usage: claudeCodeUsage,
    agents,
    recent_usage: recentUsage,
    warnings: warnings.slice(0, 20),
  }
}
