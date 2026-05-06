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
const SUBJECT_LABELS: Record<XiguoSubject, string> = {
  math: '数学',
  writing: '写作',
  reading: '语文阅读',
}

const normalizeString = (value: unknown) => String(value ?? '').trim()

const formatSubject = (subject: XiguoSubject): string => SUBJECT_LABELS[subject]

export function getXiguoDispatchReadiness() {
  const xiguoApiUrlConfigured = Boolean(normalizeString(process.env.XIGUO_API_URL))
  const xiguoApiKeyConfigured = Boolean(normalizeString(process.env.XIGUO_API_KEY))
  const feishuWebhookConfigured = Boolean(normalizeString(process.env.FEISHU_STUDY_WEBHOOK))
  const xiguoConfigured = xiguoApiUrlConfigured && xiguoApiKeyConfigured
  const missing = [
    !xiguoApiUrlConfigured || !xiguoApiKeyConfigured ? '羲果陪伴接口' : '',
    !feishuWebhookConfigured ? '飞书学习布置群机器人' : '',
  ].filter(Boolean)

  return {
    xiguoConfigured,
    feishuConfigured: feishuWebhookConfigured,
    allConfigured: xiguoConfigured && feishuWebhookConfigured,
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
  const taskLines = tasks
    .map((task, index) => {
      const description = task.description ? ` · ${task.description}` : ''
      return `${index + 1}. ${task.title}｜${formatSubject(task.subject)}｜${task.durationMinutes} 分钟${description}`
    })
    .join('\n')

  const totalDuration = tasks.reduce((sum, task) => sum + task.durationMinutes, 0)

  return [
    '今日学习计划',
    '',
    `日期：${date}`,
    `任务数：${tasks.length} 个，预计 ${totalDuration} 分钟`,
    '',
    taskLines,
    '',
    '果妈已确认，可以开始执行。',
    '',
    `开始学习：${deepLink}`,
  ].join('\n')
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
  const webhookUrl = normalizeString(process.env.FEISHU_STUDY_WEBHOOK)
  if (!webhookUrl) return { ok: false, error: 'FEISHU_STUDY_WEBHOOK not configured' }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'text',
        content: { text: buildFeishuStudyMessage(tasks, deepLink, date) },
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
