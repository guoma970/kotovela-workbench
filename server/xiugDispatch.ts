import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

export type XiguoSubject = 'math' | 'writing' | 'reading'

export type XiguoTask = {
  id: string
  title: string
  subject: XiguoSubject
  durationMinutes: number
  description: string
}

export type XiguoDispatchPayload = {
  date: string
  confirmedBy: string
  tasks: XiguoTask[]
}

export type XiguoDispatchResult =
  | { ok: true; deepLink: string }
  | { ok: false; error: string }

export type FeishuDispatchResult =
  | { ok: true }
  | { ok: false; error: string }

const DEFAULT_XIGUO_DEEP_LINK_ORIGIN = 'https://xiguo.kotovela.com'
const DEFAULT_FEISHU_STUDY_CHAT_ID = 'oc_6c11384fb9a6316cfce5eacb84fb7414'
const DEFAULT_FEISHU_STUDY_ACCOUNT = 'family'
const USER_HOME = process.env.HOME || process.env.USERPROFILE || ''
const SUBJECT_LABELS: Record<XiguoSubject, string> = {
  math: '数学',
  writing: '写作',
  reading: '语文阅读',
}

const execFileAsync = promisify(execFile)
const normalizeString = (value: unknown) => String(value ?? '').trim()

const formatSubject = (subject: XiguoSubject): string => SUBJECT_LABELS[subject]

const getFeishuStudyChatId = () => normalizeString(process.env.FEISHU_STUDY_CHAT_ID) || DEFAULT_FEISHU_STUDY_CHAT_ID

const hasLocalOpenClawMessageSender = () => {
  if (process.env.VERCEL === '1') return false
  return Boolean(getFeishuStudyChatId())
}

export function getXiguoDispatchReadiness() {
  const xiguoApiUrlConfigured = Boolean(normalizeString(process.env.XIGUO_API_URL))
  const xiguoApiKeyConfigured = Boolean(normalizeString(process.env.XIGUO_API_KEY))
  const feishuWebhookConfigured = Boolean(normalizeString(process.env.FEISHU_STUDY_WEBHOOK))
  const openclawRelayConfigured = Boolean(normalizeString(process.env.OPENCLAW_STUDY_MESSAGE_API_URL))
  const openclawCliConfigured = hasLocalOpenClawMessageSender()
  const feishuConfigured = feishuWebhookConfigured || openclawRelayConfigured || openclawCliConfigured
  const xiguoConfigured = xiguoApiUrlConfigured && xiguoApiKeyConfigured
  const missing = [
    !xiguoApiUrlConfigured || !xiguoApiKeyConfigured ? '羲果陪伴接口' : '',
    !feishuConfigured ? '飞书学习布置群发送入口' : '',
  ].filter(Boolean)

  return {
    xiguoConfigured,
    feishuConfigured,
    feishuTransport: feishuWebhookConfigured
      ? 'webhook'
      : openclawRelayConfigured
        ? 'openclaw-relay'
        : openclawCliConfigured
          ? 'openclaw-cli'
          : 'none',
    allConfigured: xiguoConfigured && feishuConfigured,
    missing,
    message:
      missing.length === 0
        ? '羲果陪伴和飞书学习布置群都已接好。'
        : `还需要接好：${missing.join('、')}。`,
  }
}

export function buildXiguoFallbackDeepLink(date: string) {
  const url = new URL('/ai-session', DEFAULT_XIGUO_DEEP_LINK_ORIGIN)
  url.searchParams.set('role', 'child')
  url.searchParams.set('date', date)
  return url.toString()
}

export function buildFeishuStudyMessage(tasks: XiguoTask[], deepLink: string, date: string): string {
  const currentTask = tasks[0]
  if (!currentTask) {
    return ['今日学习提醒', '', `日期：${date}`, '', `开始学习：${deepLink}`].join('\n')
  }

  return [
    '果果，开始今天的第一个学习节点啦～',
    '',
    `现在做：${currentTask.title}`,
    `科目：${formatSubject(currentTask.subject)}`,
    `专注：${currentTask.durationMinutes} 分钟`,
    currentTask.description ? `内容：${currentTask.description}` : '',
    '',
    '先完成这一项，后面再看下一步。',
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
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        date: payload.date,
        confirmedBy: payload.confirmedBy,
        dispatchedAt: new Date().toISOString(),
        tasks: payload.tasks,
      }),
      signal: AbortSignal.timeout(12_000),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { ok: false, error: `Xiguo API error ${response.status}: ${text.slice(0, 500)}` }
    }

    return await parseXiguoResponse(response)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function sendFeishuStudyMessage(
  tasks: XiguoTask[],
  deepLink: string,
  date: string,
): Promise<FeishuDispatchResult> {
  const text = buildFeishuStudyMessage(tasks, deepLink, date)
  const relayUrl = normalizeString(process.env.OPENCLAW_STUDY_MESSAGE_API_URL)
  if (relayUrl) return sendOpenClawStudyRelayMessage(text, date)

  const webhookUrl = normalizeString(process.env.FEISHU_STUDY_WEBHOOK)
  if (webhookUrl) return sendFeishuWebhookMessage(webhookUrl, text)

  if (hasLocalOpenClawMessageSender()) return sendOpenClawCliStudyMessage(text)

  return { ok: false, error: 'Feishu study message sender not configured' }
}

const sendOpenClawStudyRelayMessage = async (text: string, date: string): Promise<FeishuDispatchResult> => {
  const relayUrl = normalizeString(process.env.OPENCLAW_STUDY_MESSAGE_API_URL)
  const relayToken = normalizeString(process.env.OPENCLAW_STUDY_MESSAGE_TOKEN)
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
        chatId: getFeishuStudyChatId(),
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      const raw = await response.text().catch(() => '')
      return { ok: false, error: `OpenClaw relay error ${response.status}: ${raw.slice(0, 500)}` }
    }

    const data = await response.json().catch(() => null) as { ok?: unknown; error?: unknown } | null
    if (data?.ok !== true) {
      return { ok: false, error: `OpenClaw relay returned unexpected response: ${String(data?.error ?? '')}` }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

const sendFeishuWebhookMessage = async (webhookUrl: string, text: string): Promise<FeishuDispatchResult> => {
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
      return { ok: false, error: `Feishu webhook error ${response.status}: ${text.slice(0, 500)}` }
    }

    const data = await response.json().catch(() => null) as { code?: unknown; msg?: unknown } | null
    if (typeof data?.code === 'number' && data.code !== 0) {
      return { ok: false, error: `Feishu error code ${data.code}: ${String(data.msg ?? '')}` }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const sendOpenClawCliStudyMessage = async (text: string): Promise<FeishuDispatchResult> => {
  const openclawBin = normalizeString(process.env.OPENCLAW_BIN) || (USER_HOME ? path.join(USER_HOME, '.npm-global/bin/openclaw') : 'openclaw')
  const accountId = normalizeString(process.env.FEISHU_STUDY_ACCOUNT) || DEFAULT_FEISHU_STUDY_ACCOUNT
  const chatId = getFeishuStudyChatId()

  try {
    await execFileAsync(
      openclawBin,
      ['message', 'send', '--account', accountId, '--channel', 'feishu', '--target', chatId, '--message', text, '--json'],
      {
        timeout: 15_000,
        maxBuffer: 1024 * 1024,
      },
    )
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
