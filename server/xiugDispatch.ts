import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  appendXiguoTaskLinkParams,
  buildKotovelaTaskApiUrl,
  isXiguoTaskLinkSecurityConfigured,
} from './xiguoTaskAccess.js'
import { parseSafeUpstreamUrl } from './lib/safeUpstream.js'

export type XiguoSubject = 'math' | 'writing' | 'reading'
export type FeishuStudyAudience = 'collab' | 'assign'

export type XiguoTask = {
  id: string
  projectId?: string
  title: string
  subject: XiguoSubject
  durationMinutes: number
  description: string
  dueAt?: string
  priority?: number
}

export type XiguoDispatchPayload = {
  date: string
  confirmedBy: string
  tasks: XiguoTask[]
  audience?: FeishuStudyAudience
}

export type XiguoDispatchResult =
  | { ok: true; deepLink: string }
  | { ok: false; error: string }

export type FeishuDispatchResult =
  | { ok: true; audience: FeishuStudyAudience; targetLabel: string }
  | { ok: false; error: string; audience?: FeishuStudyAudience; targetLabel?: string }

const DEFAULT_XIGUO_DEEP_LINK_ORIGIN = 'https://xiguo.kotovela.com'
const DEFAULT_FEISHU_STUDY_ACCOUNT = 'family'
const DEFAULT_FEISHU_OPEN_API_BASE_URL = 'https://open.feishu.cn'
const USER_HOME = process.env.HOME || process.env.USERPROFILE || ''
const SUBJECT_LABELS: Record<XiguoSubject, string> = {
  math: '数学',
  writing: '写作',
  reading: '语文阅读',
}
const FEISHU_STUDY_AUDIENCE_LABELS: Record<FeishuStudyAudience, string> = {
  collab: '果果学习协同群',
  assign: '果果学习布置群',
}

const execFileAsync = promisify(execFile)
const normalizeString = (value: unknown) => String(value ?? '').trim()
const parseAllowedHosts = (value: unknown) =>
  new Set(
    normalizeString(value)
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  )

const formatSubject = (subject: XiguoSubject): string => SUBJECT_LABELS[subject]

export const normalizeFeishuStudyAudience = (value: unknown): FeishuStudyAudience =>
  normalizeString(value) === 'assign' ? 'assign' : 'collab'

export const getFeishuStudyTargetLabel = (audience?: unknown) =>
  FEISHU_STUDY_AUDIENCE_LABELS[normalizeFeishuStudyAudience(audience)]

const getFeishuStudyChatId = (audience: FeishuStudyAudience = 'collab') => {
  if (audience === 'assign') {
    return normalizeString(process.env.FEISHU_STUDY_ASSIGN_CHAT_ID)
      || normalizeString(process.env.FEISHU_STUDY_CHAT_ID)
      || ''
  }

  return normalizeString(process.env.FEISHU_STUDY_COLLAB_CHAT_ID)
    || normalizeString(process.env.FEISHU_STUDY_TEST_CHAT_ID)
    || ''
}

const getMissingFeishuChatIdResult = (audience: FeishuStudyAudience): FeishuDispatchResult => ({
  ok: false,
  error: 'feishu_chat_id_not_configured',
  audience,
  targetLabel: getFeishuStudyTargetLabel(audience),
})

const getFeishuStudyWebhookUrl = (audience: FeishuStudyAudience) => {
  if (audience === 'assign') {
    return normalizeString(process.env.FEISHU_STUDY_ASSIGN_WEBHOOK)
      || normalizeString(process.env.FEISHU_STUDY_WEBHOOK)
  }

  return normalizeString(process.env.FEISHU_STUDY_COLLAB_WEBHOOK)
    || normalizeString(process.env.FEISHU_STUDY_TEST_WEBHOOK)
}

const getFeishuOpenApiBaseUrl = () => normalizeString(process.env.FEISHU_OPEN_API_BASE_URL) || DEFAULT_FEISHU_OPEN_API_BASE_URL
const hasFeishuSendMessageConfig = (audience: FeishuStudyAudience = 'collab') =>
  Boolean(
    normalizeString(process.env.FEISHU_APP_ID)
    && normalizeString(process.env.FEISHU_APP_SECRET)
    && getFeishuStudyChatId(audience),
  )

const hasLocalOpenClawMessageSender = (audience: FeishuStudyAudience = 'collab') => {
  if (process.env.VERCEL === '1') return false
  return Boolean(getFeishuStudyChatId(audience))
}

export function getXiguoDispatchReadiness(input?: { audience?: unknown }) {
  const audience = normalizeFeishuStudyAudience(input?.audience)
  const targetLabel = getFeishuStudyTargetLabel(audience)
  const xiguoApiUrlConfigured = Boolean(normalizeString(process.env.XIGUO_API_URL))
  const xiguoApiKeyConfigured = Boolean(normalizeString(process.env.XIGUO_API_KEY))
  const xiguoLinkSecurityConfigured = isXiguoTaskLinkSecurityConfigured()
  const feishuChatIdConfigured = Boolean(getFeishuStudyChatId(audience))
  const feishuSendMessageConfigured = hasFeishuSendMessageConfig(audience)
  const feishuWebhookConfigured = Boolean(getFeishuStudyWebhookUrl(audience))
  const openclawRelayConfigured = Boolean(normalizeString(process.env.OPENCLAW_STUDY_MESSAGE_API_URL))
  const openclawCliConfigured = hasLocalOpenClawMessageSender(audience)
  const feishuTransportConfigured = feishuSendMessageConfigured || feishuWebhookConfigured || openclawRelayConfigured || openclawCliConfigured
  const feishuConfigured = feishuChatIdConfigured && feishuTransportConfigured
  const xiguoConfigured = xiguoApiUrlConfigured && xiguoApiKeyConfigured
  const missing = [
    !xiguoApiUrlConfigured || !xiguoApiKeyConfigured ? '羲果陪伴接口' : '',
    !xiguoLinkSecurityConfigured ? '作业链接安全密钥' : '',
    !feishuChatIdConfigured ? '飞书目标群 chatId' : '',
    feishuChatIdConfigured && !feishuTransportConfigured ? `${targetLabel}发送入口` : '',
  ].filter(Boolean)

  return {
    audience,
    targetLabel,
    xiguoConfigured,
    xiguoLinkSecurityConfigured,
    feishuConfigured,
    feishuTransport: feishuSendMessageConfigured
      ? 'sendMessage'
      : feishuWebhookConfigured
        ? 'webhook'
        : openclawRelayConfigured
          ? 'openclaw-relay'
          : openclawCliConfigured
            ? 'openclaw-cli'
            : 'none',
    allConfigured: xiguoConfigured && xiguoLinkSecurityConfigured && feishuConfigured,
    missing,
    message:
      missing.length === 0
        ? `羲果陪伴和${targetLabel}都已接好。`
        : `还需要接好：${missing.join('、')}。`,
  }
}

export function buildXiguoFallbackDeepLink(date: string, task?: Pick<XiguoTask, 'id'> & { projectId?: string }) {
  const url = new URL('/ai-session', DEFAULT_XIGUO_DEEP_LINK_ORIGIN)
  url.searchParams.set('role', 'child')
  url.searchParams.set('date', date)
  if (!task) return url.toString()
  return appendXiguoTaskLinkParams(url.toString(), { taskId: task.id, projectId: task.projectId })
}

export function buildFeishuStudyMessage(
  tasks: XiguoTask[],
  deepLink: string,
  date: string,
  audience: FeishuStudyAudience = 'collab',
): string {
  const currentTask = tasks[0]
  const isCollab = audience === 'collab'
  if (!currentTask) {
    return [
      isCollab ? '【测试确认】今日学习任务待确认' : '今日学习提醒',
      '',
      `日期：${date}`,
      isCollab ? '先发到协同群确认，确认后再发到布置群。' : '',
      '',
      `开始学习：${deepLink}`,
    ].filter(Boolean).join('\n')
  }

  return [
    isCollab ? '【测试确认】果果学习任务待确认' : '果果，开始今天的第一个学习节点啦～',
    '',
    `现在做：${currentTask.title}`,
    `科目：${formatSubject(currentTask.subject)}`,
    `专注：${currentTask.durationMinutes} 分钟`,
    currentTask.description ? `内容：${currentTask.description}` : '',
    '',
    isCollab ? '这是测试任务，先在协同群确认内容和链接；确认后再发到学习布置群。' : '先完成这一项，后面再看下一步。',
    '',
    `开始学习：${deepLink}`,
  ].filter(Boolean).join('\n')
}

const parseXiguoResponse = async (response: Response): Promise<XiguoDispatchResult> => {
  const data = await response.json().catch(() => null) as { ok?: unknown; deepLink?: unknown } | null
  if (data?.ok !== true || typeof data.deepLink !== 'string' || !data.deepLink.trim()) {
    return { ok: false, error: 'Xiguo API returned unexpected response' }
  }

  return { ok: true, deepLink: data.deepLink.trim() }
}

export async function dispatchToXiguo(payload: XiguoDispatchPayload): Promise<XiguoDispatchResult> {
  const apiUrl = normalizeString(process.env.XIGUO_API_URL)
  const apiKey = normalizeString(process.env.XIGUO_API_KEY)

  if (!apiUrl) return { ok: false, error: 'XIGUO_API_URL not configured' }
  if (!apiKey) return { ok: false, error: 'XIGUO_API_KEY not configured' }

  try {
    const safeApiUrl = parseSafeUpstreamUrl(apiUrl, {
      envName: 'XIGUO_API_URL',
      allowedHosts: parseAllowedHosts(process.env.XIGUO_API_ALLOW_HOSTS),
    })
    const response = await fetch(safeApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        date: payload.date,
        confirmedBy: payload.confirmedBy,
        dispatchedAt: new Date().toISOString(),
        tasks: payload.tasks.map((task) => ({
          ...task,
          hubTaskUrl: buildKotovelaTaskApiUrl('/api/xiguo-task', { taskId: task.id, projectId: task.projectId }),
          statusCallbackUrl: buildKotovelaTaskApiUrl('/api/xiguo-task-status', { taskId: task.id, projectId: task.projectId }),
        })),
      }),
      signal: AbortSignal.timeout(12_000),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { ok: false, error: `Xiguo API error ${response.status}: ${text.slice(0, 500)}` }
    }

    return await parseXiguoResponse(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('XIGUO_API_URL')) return { ok: false, error: `xiguo upstream rejected: ${message}` }
    return { ok: false, error: message }
  }
}

export async function sendFeishuStudyMessage(
  tasks: XiguoTask[],
  deepLink: string,
  date: string,
  audienceInput: FeishuStudyAudience = 'collab',
): Promise<FeishuDispatchResult> {
  const audience = normalizeFeishuStudyAudience(audienceInput)
  if (!getFeishuStudyChatId(audience)) return getMissingFeishuChatIdResult(audience)

  const firstTask = tasks[0]
  const taskDeepLink = firstTask ? appendXiguoTaskLinkParams(deepLink, { taskId: firstTask.id, projectId: firstTask.projectId }) : deepLink
  const text = buildFeishuStudyMessage(tasks, taskDeepLink, date, audience)
  if (hasFeishuSendMessageConfig(audience)) return sendFeishuOpenApiMessage(text, audience)

  const relayUrl = normalizeString(process.env.OPENCLAW_STUDY_MESSAGE_API_URL)
  if (relayUrl) return sendOpenClawStudyRelayMessage(text, date, audience)

  const webhookUrl = getFeishuStudyWebhookUrl(audience)
  if (webhookUrl) return sendFeishuWebhookMessage(webhookUrl, text, audience)

  if (hasLocalOpenClawMessageSender(audience)) return sendOpenClawCliStudyMessage(text, audience)

  return {
    ok: false,
    error: 'Feishu study message sender not configured',
    audience,
    targetLabel: getFeishuStudyTargetLabel(audience),
  }
}

export const sendFeishuNeedHumanMessage = async (input: {
  taskId: string
  taskName: string
  reason: string
  deepLink?: string
}): Promise<FeishuDispatchResult> => {
  if (!getFeishuStudyChatId('collab')) return getMissingFeishuChatIdResult('collab')

  const text = [
    '羲果学习任务需要人工确认',
    '',
    `任务：${input.taskName}`,
    `原因：${input.reason}`,
    `任务编号：${input.taskId}`,
    input.deepLink ? `查看：${input.deepLink}` : '',
    '',
    '请小羲 / family 协作群确认下一步。',
  ].filter(Boolean).join('\n')

  if (hasFeishuSendMessageConfig('collab')) return sendFeishuOpenApiMessage(text, 'collab')

  const relayUrl = normalizeString(process.env.OPENCLAW_STUDY_MESSAGE_API_URL)
  if (relayUrl) return sendOpenClawStudyRelayMessage(text, new Date().toISOString().slice(0, 10), 'collab')

  const webhookUrl = getFeishuStudyWebhookUrl('collab')
  if (webhookUrl) return sendFeishuWebhookMessage(webhookUrl, text, 'collab')

  if (hasLocalOpenClawMessageSender('collab')) return sendOpenClawCliStudyMessage(text, 'collab')

  return {
    ok: false,
    error: 'Feishu need-human message sender not configured',
    audience: 'collab',
    targetLabel: getFeishuStudyTargetLabel('collab'),
  }
}

const fetchFeishuTenantAccessToken = async () => {
  const appId = normalizeString(process.env.FEISHU_APP_ID)
  const appSecret = normalizeString(process.env.FEISHU_APP_SECRET)
  if (!appId || !appSecret) throw new Error('FEISHU_APP_ID or FEISHU_APP_SECRET not configured')

  const response = await fetch(`${getFeishuOpenApiBaseUrl()}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) {
    const raw = await response.text().catch(() => '')
    throw new Error(`Feishu token error ${response.status}: ${raw.slice(0, 500)}`)
  }

  const data = await response.json().catch(() => null) as { code?: unknown; msg?: unknown; tenant_access_token?: unknown } | null
  if (data?.code !== 0 || typeof data.tenant_access_token !== 'string' || !data.tenant_access_token.trim()) {
    throw new Error(`Feishu token response invalid: ${String(data?.msg ?? data?.code ?? 'unknown')}`)
  }

  return data.tenant_access_token.trim()
}

const sendFeishuOpenApiMessage = async (text: string, audience: FeishuStudyAudience): Promise<FeishuDispatchResult> => {
  const targetLabel = getFeishuStudyTargetLabel(audience)
  const receiveId = getFeishuStudyChatId(audience)
  if (!receiveId) return getMissingFeishuChatIdResult(audience)

  try {
    const tenantAccessToken = await fetchFeishuTenantAccessToken()
    const response = await fetch(`${getFeishuOpenApiBaseUrl()}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenantAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      }),
      signal: AbortSignal.timeout(8_000),
    })

    if (!response.ok) {
      const raw = await response.text().catch(() => '')
      return { ok: false, error: `Feishu sendMessage error ${response.status}: ${raw.slice(0, 500)}`, audience, targetLabel }
    }

    const data = await response.json().catch(() => null) as { code?: unknown; msg?: unknown } | null
    if (data?.code !== 0) {
      return { ok: false, error: `Feishu sendMessage code ${String(data?.code)}: ${String(data?.msg ?? '')}`, audience, targetLabel }
    }

    return { ok: true, audience, targetLabel }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), audience, targetLabel }
  }
}

const sendOpenClawStudyRelayMessage = async (
  text: string,
  date: string,
  audience: FeishuStudyAudience,
): Promise<FeishuDispatchResult> => {
  const relayUrl = normalizeString(process.env.OPENCLAW_STUDY_MESSAGE_API_URL)
  const relayToken = normalizeString(process.env.OPENCLAW_STUDY_MESSAGE_TOKEN)
  const targetLabel = getFeishuStudyTargetLabel(audience)
  const chatId = getFeishuStudyChatId(audience)
  if (!chatId) return getMissingFeishuChatIdResult(audience)

  try {
    const response = await fetch(relayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(relayToken ? { Authorization: `Bearer ${relayToken}` } : {}),
      },
      body: JSON.stringify({
        text,
        date,
        audience,
        targetLabel,
        chatId,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      const raw = await response.text().catch(() => '')
      return { ok: false, error: `OpenClaw relay error ${response.status}: ${raw.slice(0, 500)}`, audience, targetLabel }
    }

    const data = await response.json().catch(() => null) as { ok?: unknown; error?: unknown } | null
    if (data?.ok !== true) {
      return { ok: false, error: `OpenClaw relay returned unexpected response: ${String(data?.error ?? '')}`, audience, targetLabel }
    }

    return { ok: true, audience, targetLabel }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), audience, targetLabel }
  }
}

const sendFeishuWebhookMessage = async (
  webhookUrl: string,
  text: string,
  audience: FeishuStudyAudience,
): Promise<FeishuDispatchResult> => {
  const targetLabel = getFeishuStudyTargetLabel(audience)
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'text',
        content: { text },
      }),
      signal: AbortSignal.timeout(8_000),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { ok: false, error: `Feishu webhook error ${response.status}: ${text.slice(0, 500)}`, audience, targetLabel }
    }

    const data = await response.json().catch(() => null) as { code?: unknown; msg?: unknown } | null
    if (typeof data?.code === 'number' && data.code !== 0) {
      return { ok: false, error: `Feishu error code ${data.code}: ${String(data.msg ?? '')}`, audience, targetLabel }
    }

    return { ok: true, audience, targetLabel }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), audience, targetLabel }
  }
}

export const sendOpenClawCliStudyMessage = async (
  text: string,
  audienceInput: FeishuStudyAudience = 'collab',
): Promise<FeishuDispatchResult> => {
  const audience = normalizeFeishuStudyAudience(audienceInput)
  const targetLabel = getFeishuStudyTargetLabel(audience)
  const openclawBin = normalizeString(process.env.OPENCLAW_BIN) || (USER_HOME ? path.join(USER_HOME, '.npm-global/bin/openclaw') : 'openclaw')
  const accountId = normalizeString(process.env.FEISHU_STUDY_ACCOUNT) || DEFAULT_FEISHU_STUDY_ACCOUNT
  const chatId = getFeishuStudyChatId(audience)
  if (!chatId) return getMissingFeishuChatIdResult(audience)

  try {
    await execFileAsync(
      openclawBin,
      ['message', 'send', '--account', accountId, '--channel', 'feishu', '--target', chatId, '--message', text, '--json'],
      {
        timeout: 15_000,
        maxBuffer: 1024 * 1024,
      },
    )
    return { ok: true, audience, targetLabel }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), audience, targetLabel }
  }
}
