import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EvidenceObjectLinks } from '../components/EvidenceObjectLinks'
import { ObjectBadge } from '../components/ObjectBadge'
import { PageLeadPanel } from '../components/PageLeadPanel'
import { useOfficeInstances } from '../data/useOfficeInstances'
import { formatReadableDetail, formatReadableOwner, formatReadableTaskTitle } from '../lib/readableText'
import { createFocusSearch, useWorkbenchLinking } from '../lib/workbenchLinking'

type TaskBoardStatus = 'running' | 'queue' | 'paused' | 'done' | 'need_human'

type TaskListItem = {
  task_id: string
  title: string
  status: TaskBoardStatus
  priority: string
  owner: string
  updated_at: string
  source: 'internal' | 'opensource'
  project_line?: string
  source_line?: string
  account_line?: string
  content_line?: string
  consultant_id?: string
  attribution?: { source?: string; medium?: string; campaign?: string; content?: string }
  decision_log: Array<{ action: string; reason: string; detail: string; timestamp: string }>
}

type StudySubject = 'math' | 'writing' | 'reading'

type StudyPlanTask = {
  localId: string
  title: string
  subject: StudySubject
  durationMinutes: number
  description: string
}

type StudyDispatchState = {
  status: 'idle' | 'sending' | 'success' | 'partial' | 'error'
  message: string
  deepLink?: string
  xiguoOk?: boolean
  feishuOk?: boolean
}

type BoardPayload = {
  board?: Array<{
    task_id?: string
    id?: string
    task_name?: string
    title?: string
    status?: string
    priority?: number | string
    assigned_agent?: string
    agent?: string
    owner?: string
    updated_at?: string
    timestamp?: string
    need_human?: boolean
    project_line?: string
    source_line?: string
    account_line?: string
    content_line?: string
    consultant_id?: string
    attribution?: { source?: string; medium?: string; campaign?: string; content?: string }
    decision_log?: Array<{ action?: string; reason?: string; detail?: string; timestamp?: string }>
  }>
}

type AuditEntry = {
  id: string
  action: string
  target: string
  result: string
  time: string
  actor?: string
}

const STATUS_COLUMNS: Array<{ key: TaskBoardStatus; label: string; labelZh: string; helperZh: string }> = [
  { key: 'need_human', label: 'Need Human', labelZh: '需人工处理', helperZh: '需要你或负责人确认下一步，优先看。' },
  { key: 'paused', label: 'Paused', labelZh: '已暂停', helperZh: '目前有卡点，先看暂停原因。' },
  { key: 'running', label: 'Running', labelZh: '进行中', helperZh: '正在有人推进，优先看下一步和负责人。' },
  { key: 'queue', label: 'Queue', labelZh: '排队中', helperZh: '还没开始处理，等待调度或接单。' },
  { key: 'done', label: 'Done', labelZh: '已完成', helperZh: '已经处理完，可回看依据和记录。' },
]

const STUDY_SUBJECT_OPTIONS: Array<{ value: StudySubject; label: string }> = [
  { value: 'math', label: '数学' },
  { value: 'reading', label: '语文阅读' },
  { value: 'writing', label: '写作' },
]

const TASK_STATUS_LABEL_ZH: Record<TaskBoardStatus, string> = {
  running: '进行中',
  queue: '排队中',
  paused: '已暂停',
  done: '已完成',
  need_human: '需人工处理',
}

const TASK_PRIORITY_LABEL_ZH: Record<string, string> = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
  unknown: '未标注优先级',
}

const EMPTY_COLUMN_TEXT_ZH: Record<TaskBoardStatus, string> = {
  running: '当前没有正在推进的任务。',
  queue: '当前没有排队等待的任务。',
  paused: '当前没有暂停任务，一切顺利。',
  done: '当前没有新的完成记录。',
  need_human: '当前没有需要人工处理的任务。',
}

const OWNER_LABELS: Record<string, string> = {
  main: '小树 / 中枢调度',
  builder: '小筑 / 开发执行',
  media: '小果 / 内容助手',
  family: '小羲 / 家庭助手',
  business: '小言 / 业务助手',
  personal: '小柒 / 个人助手',
  ztl970: '果妈970 / 项目负责人',
  unassigned: '暂未分配',
}

const OWNER_SHORT_LABELS: Record<string, string> = {
  main: '小树',
  builder: '小筑',
  media: '小果',
  family: '小羲',
  business: '小言',
  personal: '小柒',
  ztl970: '果妈970',
  unassigned: '未分配',
}

const BUSINESS_SIGNAL_LABELS: Record<string, string> = {
  builder: '研发执行',
  builder_page: '页面开发',
  business: '业务跟进',
  business_default: '业务默认分配',
  customer_followup: '客户跟进',
  family: '家庭事务',
  family_study: '家庭学习',
  latin_boy: '拉丁男孩果果',
  layout_renovation: '户型改造',
  media: '内容协作',
  media_publish_with_distribution: '内容发布与分发',
  mom970: '果妈970',
  openclaw_content: 'OpenClaw 内容运营',
  personal: '个人助手',
  personal_reminder: '个人提醒',
  kitchen_storage: '厨房收纳',
  consultant_kotovela_floor_heating: '地暖顾问',
  consultant_kotoharo_material: '建材顾问',
  consultant_yanfami_residential: '户型顾问',
  kotovelahub: 'Kotovela Hub',
  KOTOVELAHUB研发群: 'Kotovela Hub 研发群',
  tech: '技术线',
}

const TASK_ACTION_LABELS: Record<string, string> = {
  consultant_assigned: '已完成分配',
  blocked: '有卡点',
  dependency_waiting: '等待依赖完成',
  notify_result: '已同步结果',
  priority_up: '已提高优先级',
  priority_down: '已降低优先级',
  pause: '已暂停',
  resume: '已恢复处理',
  retry: '已重新尝试',
  transfer: '已转派',
  direct: '直接处理',
  manual_review: '转人工处理',
  predictive_risk: '预测风险',
  risk_detected: '发现风险',
  task_done: '任务完成',
}

const formatTaskLogText = (value?: string, fallback = '未补充说明') => {
  if (!value || value === '-') return fallback
  if (TASK_ACTION_LABELS[value]) return TASK_ACTION_LABELS[value]
  return formatReadableDetail(value)
    .replace(/task done/gi, '任务完成')
    .replace(/risk detected/gi, '发现风险')
    .replace(/dependency waiting/gi, '等待依赖完成')
    .replace(/predictive risk/gi, '预测风险')
    .replace(/notify result/gi, '已同步结果')
    .replace(/business default/gi, '业务默认分配')
    .replace(/consultant_assigned/gi, '已完成分配')
    .replace(/manual_review.required/gi, '待人工复核')
    .replace(/business.lead_router/gi, '业务跟进池')
    .replace(/route_target/gi, '处理去向')
    .replace(/route_result/gi, '处理结果')
    .replace(/decision_log/gi, '处理记录')
    .replace(/audit_log/gi, '变更记录')
    .replace(/[._-]+/g, ' ')
}

const normalizeOwnerKey = (value?: string) =>
  String(value ?? '')
    .replace(/^实例\s*/i, '')
    .replace(/^consultant_/i, '')
    .trim()
    .toLowerCase()

const formatOwnerLabel = (value?: string, short = false) => {
  const key = normalizeOwnerKey(value)
  const labels = short ? OWNER_SHORT_LABELS : OWNER_LABELS
  if (labels[key]) return labels[key]
  if (!key) return short ? '未分配' : '暂未分配'
  return formatReadableOwner(key)
}

const formatBusinessSignal = (value?: string, fallback = '暂未同步') => {
  if (!value || value === '-') return fallback
  if (BUSINESS_SIGNAL_LABELS[value]) return BUSINESS_SIGNAL_LABELS[value]
  if (BUSINESS_SIGNAL_LABELS[value.toLowerCase()]) return BUSINESS_SIGNAL_LABELS[value.toLowerCase()]
  const compact = value.replace(/^consultant_/i, '')
  if (BUSINESS_SIGNAL_LABELS[compact]) return BUSINESS_SIGNAL_LABELS[compact]
  if (BUSINESS_SIGNAL_LABELS[compact.toLowerCase()]) return BUSINESS_SIGNAL_LABELS[compact.toLowerCase()]
  return formatReadableDetail(compact)
    .replace(/^oc_[a-z0-9]+$/i, '飞书群会话')
    .replace(/^room-/i, '频道 ')
    .replace(/^task-/i, '任务 ')
    .replace(/^project-/i, '项目 ')
    .replace(/kotovela/gi, 'Kotovela')
    .replace(/openclaw content/gi, 'OpenClaw 内容运营')
    .replace(/media publish with distribution/gi, '内容发布与分发')
    .replace(/[._-]+/g, ' ')
}

const humanizeTaskText = (value?: string, fallback = '任务内容暂未同步') => {
  if (!value || value === '-') return fallback
  return value
    .replace(/当前缺少\s*live session/gi, '当前没有实时会话')
    .replace(/live session/gi, '实时会话')
    .replace(/snapshot\(([^)]+)\)\s*兜底/gi, '快照兜底（$1）')
    .replace(/snapshot\s*/gi, '快照 ')
    .replace(/无会话上报/gi, '暂无会话回报')
    .replace(/请同步任务标题\/摘要/gi, '等待补充任务说明')
    .replace(/直连会话进行中/gi, '直连会话进行中')
    .replace(/oc_[a-z0-9]+/gi, '飞书群会话')
    .replace(/\bstab-\d+/gi, '稳定任务')
    .replace(/media_publish_with_distribution/gi, '内容发布与分发')
    .replace(/openclaw_content/gi, 'OpenClaw 内容运营')
    .replace(/priority queue builder/gi, '优先级队列')
    .replace(/priority_up changes priority and writes decision log/gi, '已提高优先级并记录处理依据')
    .replace(/priority_down changes priority and writes decision log/gi, '已降低优先级并记录处理依据')
    .replace(/pause sets status paused/gi, '任务已暂停')
    .replace(/resume clears pause state and returns active control/gi, '任务已恢复处理')
    .replace(/template creates blocked dependency tasks and decision log/gi, '模板已生成依赖任务和处理记录')
    .replace(/blocked tasks later emit unblocked\/dependency_resolved evidence/gi, '依赖解除后会补充完成依据')
    .replace(/routes to/gi, '分配给')
    .replace(/assigned to/gi, '已分配给')
    .replace(/domain/gi, '领域')
    .replace(/project_line/gi, '项目线')
    .replace(/content_line/gi, '内容线')
    .replace(/consultant_/gi, '顾问 ')
    .replace(/[{}"]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const formatUpdatedAt = (value?: string) => {
  if (!value || value === '-') return '暂未同步'
  if (/^刚刚|^最近|^超过/.test(value)) return value
  if (/^snapshot/i.test(value)) return value.replace(/^snapshot\s*/i, '快照时间：')

  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return humanizeTaskText(value, '暂未同步')

  const diffMs = Date.now() - timestamp
  if (diffMs < 0) return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp)
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `最近 ${diffMinutes} 分钟`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `最近 ${diffHours} 小时`
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp)
}

const buildTaskHeadline = (task: TaskListItem) => {
  const rawTitle = task.title
  if (/当前缺少\s*live session/i.test(rawTitle)) return '没有实时会话，正在使用快照兜底'
  if (/oc_[a-z0-9]+|飞书群会话/i.test(rawTitle)) return '飞书群有新会话待处理'

  const instanceMatch = rawTitle.match(/^实例\s+([a-z0-9_-]+)\s*[·:：-]\s*(.+)$/i)
  if (instanceMatch) return `${formatOwnerLabel(instanceMatch[1], true)}：${humanizeTaskText(instanceMatch[2])}`

  return formatReadableTaskTitle(humanizeTaskText(rawTitle))
}

const buildTaskSummary = (task: TaskListItem) => {
  if (/当前缺少\s*live session|暂用\s*snapshot/i.test(task.title)) {
    return '这条不是最新实时回报，建议先确认对应协作者是否在线或是否有新会话。'
  }
  if (/oc_[a-z0-9]+|飞书群会话/i.test(task.title)) {
    return '来自飞书研发群的会话任务，先看负责人是否已经接手，再看是否需要人工确认。'
  }
  if (task.status === 'running') return '任务正在推进，等待负责人下一次状态回报或完成依据。'
  if (task.status === 'queue') return '任务已进入队列，还没有开始执行，等待调度分配。'
  if (task.status === 'paused') return '任务暂时停住了，需要先处理卡点再继续。'
  if (task.status === 'done') return '任务已经处理完，可以在处理动态里回看依据。'
  return '这条任务需要人工判断，请先确认负责人和下一步。'
}

const buildNextAction = (task: TaskListItem) => {
  if (task.status === 'need_human') return '人工确认处理方式，并补充清晰任务说明。'
  if (/当前缺少\s*live session|暂用\s*snapshot/i.test(task.title)) return '让对应协作者上线或产生新会话，再刷新驾驶舱。'
  if (/oc_[a-z0-9]+|飞书群会话/i.test(task.title)) return '由小树确认是否派发；需要开发时转给小筑。'
  if (task.status === 'running') return '等待负责人回报进度；如超时，进入执行验证页排查。'
  if (task.status === 'queue') return '等待中枢调度接单或明确负责人。'
  if (task.status === 'paused') return '先处理卡点，再恢复任务。'
  return '查看处理记录，确认是否需要复盘或追加任务。'
}

const buildTaskSignals = (task: TaskListItem) =>
  [
    { label: '项目线', value: task.project_line },
    { label: '来源', value: task.source_line },
    { label: '账号/频道', value: task.account_line },
    { label: '内容线', value: task.content_line },
    { label: '顾问', value: task.consultant_id },
    { label: '渠道', value: task.attribution?.source },
  ]
    .filter((item): item is { label: string; value: string } => Boolean(item.value))
    .slice(0, 4)
    .map((item) => ({ ...item, value: formatBusinessSignal(item.value) }))

const getTaskFreshnessClass = (task: TaskListItem) => {
  if (/当前缺少\s*live session|暂用\s*snapshot|超过\s*\d+\s*分钟/i.test(`${task.title} ${task.updated_at}`)) return 'task-freshness-stale'
  if (/^刚刚|^最近/.test(task.updated_at)) return 'task-freshness-live'
  return 'task-freshness-neutral'
}

const isFallbackTask = (task: TaskListItem) =>
  /当前缺少\s*live session|暂用\s*snapshot|没有实时会话|快照兜底|超过\s*\d+\s*分钟/i.test(`${task.title} ${task.updated_at}`)

const needsAttention = (task: TaskListItem) =>
  task.status === 'need_human' || task.status === 'paused' || isFallbackTask(task) || task.priority === 'high'

const getTaskTriageLabel = (task: TaskListItem) => {
  if (task.status === 'need_human') return '需要确认'
  if (task.status === 'paused') return '先解卡点'
  if (isFallbackTask(task)) return '同步异常'
  if (task.status === 'running') return '跟进进度'
  if (task.status === 'queue') return '等待接单'
  return '结果回看'
}

const getTaskTriageTone = (task: TaskListItem) => {
  if (task.status === 'need_human' || task.status === 'paused') return 'danger'
  if (isFallbackTask(task)) return 'warning'
  if (task.status === 'running') return 'live'
  if (task.status === 'done') return 'done'
  return 'waiting'
}

const getTaskReason = (task: TaskListItem) => {
  if (task.status === 'need_human') return '系统判断这条需要人工确认。'
  if (task.status === 'paused') return '任务已停住，需要先处理卡点。'
  if (isFallbackTask(task)) return '当前不是最新实时会话，建议先恢复同步。'
  if (task.status === 'running') return '负责人正在推进，等待下一次回报。'
  if (task.status === 'queue') return '任务已进入队列，等待中枢派发或接单。'
  return '任务已完成，可复查处理依据。'
}

const getTaskUpdatedMs = (value?: string) => {
  if (!value || value === '-') return 0
  const recentMatch = value.match(/^最近\s*(\d+)\s*(秒|分钟|小时)/)
  if (recentMatch) {
    const amount = Number(recentMatch[1])
    const unit = recentMatch[2]
    const multiplier = unit === '秒' ? 1_000 : unit === '分钟' ? 60_000 : 3_600_000
    return Date.now() - amount * multiplier
  }
  if (/^刚刚/.test(value)) return Date.now()
  const snapshotMatch = value.match(/snapshot\s*([0-9/: T-]+)/i)
  const timestamp = Date.parse(snapshotMatch?.[1] ?? value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

const getTaskPriorityScore = (priority: string) => {
  if (priority === 'high') return 4
  if (priority === 'medium') return 3
  if (priority === 'unknown') return 2
  if (priority === 'low') return 1
  return 0
}

const sortTasksForBoard = (tasks: TaskListItem[]) =>
  [...tasks].sort((a, b) => {
    const needHumanDelta = Number(b.status === 'need_human') - Number(a.status === 'need_human')
    if (needHumanDelta) return needHumanDelta
    const priorityDelta = getTaskPriorityScore(b.priority) - getTaskPriorityScore(a.priority)
    if (priorityDelta) return priorityDelta
    return getTaskUpdatedMs(b.updated_at) - getTaskUpdatedMs(a.updated_at)
  })

const getVisibleTaskLimit = (status: TaskBoardStatus) => {
  if (status === 'done') return 8
  if (status === 'queue') return 10
  return 12
}

const normalizeStatus = (status?: string, needHuman?: boolean): TaskBoardStatus => {
  if (needHuman) return 'need_human'
  const normalized = String(status ?? '').toLowerCase()
  if (['running', 'doing', 'active', 'in_progress'].includes(normalized)) return 'running'
  if (['queue', 'queued', 'todo', 'pending'].includes(normalized)) return 'queue'
  if (['paused', 'blocked', 'suspended'].includes(normalized)) return 'paused'
  if (['done', 'success', 'completed', 'cancelled'].includes(normalized)) return 'done'
  if (['need_human', 'manual', 'manual_review'].includes(normalized)) return 'need_human'
  return 'queue'
}

const normalizePriority = (priority: number | string | undefined): string => {
  if (typeof priority === 'number') {
    if (priority >= 80) return 'high'
    if (priority >= 50) return 'medium'
    return 'low'
  }
  const normalized = String(priority ?? '').toLowerCase()
  if (['high', 'medium', 'low'].includes(normalized)) return normalized
  return normalized || 'unknown'
}

const toDateInputValue = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

const createStudyTask = (date: string, index: number, overrides: Partial<StudyPlanTask> = {}): StudyPlanTask => ({
  localId: overrides.localId ?? `study-${date}-${index}-${Date.now()}`,
  title: overrides.title ?? '',
  subject: overrides.subject ?? 'math',
  durationMinutes: overrides.durationMinutes ?? 20,
  description: overrides.description ?? '',
})

const createDefaultStudyTasks = (date: string): StudyPlanTask[] => [
  createStudyTask(date, 1, {
    localId: `study-${date}-math`,
    title: '数学练习',
    subject: 'math',
    durationMinutes: 25,
    description: '按今天计划完成练习并订正错题。',
  }),
  createStudyTask(date, 2, {
    localId: `study-${date}-reading`,
    title: '语文阅读',
    subject: 'reading',
    durationMinutes: 15,
    description: '完成一篇阅读理解，标出不确定的题目。',
  }),
]

export function TasksPage() {
  const { tasks, projects, rooms, agents, mode } = useOfficeInstances()
  const isInternal = mode === 'internal'
  const navigate = useNavigate()
  const linking = useWorkbenchLinking({ tasks, projects, rooms, agents })
  const [internalTasks, setInternalTasks] = useState<TaskListItem[]>([])
  const [internalAuditEntries, setInternalAuditEntries] = useState<AuditEntry[]>([])
  const [studyDate, setStudyDate] = useState(() => toDateInputValue())
  const [studyTasks, setStudyTasks] = useState<StudyPlanTask[]>(() => createDefaultStudyTasks(toDateInputValue()))
  const [studyDispatchState, setStudyDispatchState] = useState<StudyDispatchState>({
    status: 'idle',
    message: '填写后点击确认，会同时派发到羲果陪伴；飞书 webhook 配好后会同步提醒群里。',
  })

  useEffect(() => {
    if (!isInternal) return

    let cancelled = false
    fetch('/api/tasks-board', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<BoardPayload>) : null))
      .then((payload) => {
        if (cancelled || !payload?.board) return
        const mapped = payload.board.map((item, index) => ({
          task_id: item.task_id ?? item.id ?? `internal-${index + 1}`,
          title: item.task_name ?? item.title ?? `Task ${index + 1}`,
          status: normalizeStatus(item.status, item.need_human),
          priority: normalizePriority(item.priority),
          owner: item.owner ?? item.assigned_agent ?? item.agent ?? 'unassigned',
          updated_at: item.updated_at ?? item.timestamp ?? '-',
          source: 'internal' as const,
          project_line: item.project_line,
          source_line: item.source_line,
          account_line: item.account_line,
          content_line: item.content_line,
          consultant_id: item.consultant_id,
          attribution: item.attribution,
          decision_log: (item.decision_log ?? []).map((entry) => ({
            action: entry.action ?? '-',
            reason: entry.reason ?? '-',
            detail: entry.detail ?? '-',
            timestamp: entry.timestamp ?? '-',
          })),
        }))
        setInternalTasks(mapped)
      })
      .catch(() => {
        if (!cancelled) setInternalTasks([])
      })

    return () => {
      cancelled = true
    }
  }, [isInternal])

  useEffect(() => {
    if (!isInternal) return

    let cancelled = false
    fetch('/api/audit-log', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ entries?: AuditEntry[] }>) : null))
      .then((payload) => {
        if (!cancelled) setInternalAuditEntries(Array.isArray(payload?.entries) ? payload.entries.slice(0, 6) : [])
      })
      .catch(() => {
        if (!cancelled) setInternalAuditEntries([])
      })

    return () => {
      cancelled = true
    }
  }, [isInternal])

  const auditEntries = isInternal ? internalAuditEntries : []

  const openSourceTasks = useMemo<TaskListItem[]>(
    () =>
      tasks.map((task) => ({
        task_id: task.code,
        title: task.title,
        status: normalizeStatus(task.status, false),
        priority: task.priority,
        owner: task.assignee,
        updated_at: task.updatedAt,
        source: 'opensource',
        decision_log: [],
      })),
    [tasks],
  )

  const effectiveTasks = isInternal && internalTasks.length > 0 ? internalTasks : openSourceTasks
  const visibleTaskStats = useMemo(() => {
    const attentionTasks = sortTasksForBoard(effectiveTasks.filter(needsAttention))
    const activeTasks = sortTasksForBoard(effectiveTasks.filter((task) => task.status === 'running'))
    const waitingTasks = sortTasksForBoard(effectiveTasks.filter((task) => task.status === 'queue'))
    const recentlyDoneTasks = sortTasksForBoard(effectiveTasks.filter((task) => task.status === 'done'))

    return {
      attentionTasks,
      focusTasks: [...attentionTasks, ...activeTasks, ...waitingTasks, ...recentlyDoneTasks]
        .filter((task, index, source) => source.findIndex((item) => item.task_id === task.task_id) === index)
        .slice(0, 5),
      activeTasks,
      waitingTasks,
      recentlyDoneTasks,
    }
  }, [effectiveTasks])

  const goFocus = (pathname: string, kind: 'project' | 'agent' | 'room' | 'task', id: string) => {
    navigate({ pathname, search: createFocusSearch(linking.currentSearch, kind, id) })
  }

  const updateStudyTask = (localId: string, patch: Partial<StudyPlanTask>) => {
    setStudyTasks((current) => current.map((task) => (task.localId === localId ? { ...task, ...patch } : task)))
  }

  const addStudyTask = () => {
    setStudyTasks((current) => [...current, createStudyTask(studyDate, current.length + 1)])
  }

  const removeStudyTask = (localId: string) => {
    setStudyTasks((current) => (current.length > 1 ? current.filter((task) => task.localId !== localId) : current))
  }

  const resetStudyTasks = () => {
    setStudyTasks(createDefaultStudyTasks(studyDate))
    setStudyDispatchState({
      status: 'idle',
      message: '已恢复默认学习计划，可按今天情况微调后再派发。',
    })
  }

  const handleStudyDispatch = async () => {
    const cleanedTasks = studyTasks
      .map((task, index) => ({
        id: `study-${studyDate}-${index + 1}`,
        title: task.title.trim(),
        subject: task.subject,
        durationMinutes: Number(task.durationMinutes),
        description: task.description.trim(),
      }))
      .filter((task) => task.title && Number.isFinite(task.durationMinutes) && task.durationMinutes > 0)

    if (!studyDate || cleanedTasks.length === 0) {
      setStudyDispatchState({
        status: 'error',
        message: '请至少填写 1 个学习任务，并确认日期、标题和时长。',
      })
      return
    }

    setStudyDispatchState({ status: 'sending', message: '正在派发到羲果陪伴，并尝试同步飞书提醒...' })

    try {
      const response = await fetch('/api/xiguo-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: studyDate,
          confirmedBy: 'parent',
          tasks: cleanedTasks,
        }),
      })
      const data = await response.json().catch(() => null) as {
        ok?: boolean
        deepLink?: string
        results?: {
          xiguo?: { ok?: boolean; error?: string }
          feishu?: { ok?: boolean; error?: string }
        }
        error?: string
      } | null

      if (response.ok && data?.ok) {
        setStudyDispatchState({
          status: 'success',
          message: '已发送到果果的学习 App，并同步飞书学习布置群。',
          deepLink: data.deepLink,
          xiguoOk: true,
          feishuOk: true,
        })
        return
      }

      const xiguoOk = data?.results?.xiguo?.ok === true
      const feishuOk = data?.results?.feishu?.ok === true
      const detail = data?.results?.xiguo?.error || data?.results?.feishu?.error || data?.error || '派发未完全成功'
      setStudyDispatchState({
        status: response.status === 207 ? 'partial' : 'error',
        message: response.status === 207 ? `部分完成：${detail}` : `派发失败：${detail}`,
        deepLink: data?.deepLink,
        xiguoOk,
        feishuOk,
      })
    } catch (error) {
      setStudyDispatchState({
        status: 'error',
        message: `派发请求失败：${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  const resolveTaskRecord = (task: TaskListItem) =>
    tasks.find(
      (item) =>
        item.id === task.task_id ||
        item.code === task.task_id ||
        item.title === task.title,
    )

  const cardClass = (task: TaskListItem) => {
    const record = resolveTaskRecord(task)
    if (!record) return 'queue-card panel-surface'
    const state = linking.getState('task', record.id)
    return [
      'queue-card panel-surface',
      state.isSelected ? 'surface-selected' : '',
      !state.isSelected && state.isRelated ? 'surface-related' : '',
      state.isDimmed ? 'surface-dimmed' : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  const renderTaskCard = (task: TaskListItem) => {
    const taskRecord = resolveTaskRecord(task)
    const project = taskRecord ? projects.find((item) => item.id === taskRecord.projectId) : undefined
    const agent = taskRecord ? agents.find((item) => item.id === taskRecord.executorAgentId || item.id === taskRecord.assigneeAgentId) : undefined
    const linkedRooms = taskRecord
      ? rooms.filter((room) => room.mainProjectId === taskRecord.projectId || room.instanceIds.includes(taskRecord.executorAgentId))
      : []
    const taskSignals = buildTaskSignals(task)
    return (
      <article key={task.task_id} className={`${cardClass(task)} task-readable-card ${getTaskFreshnessClass(task)}`}>
        <div className="task-card-kicker">
          <span className={`task-status-chip task-status-${task.status}`}>
            {isInternal ? TASK_STATUS_LABEL_ZH[task.status] : task.status}
          </span>
          <span className={`priority-badge priority-${task.priority}`}>{isInternal ? (TASK_PRIORITY_LABEL_ZH[task.priority] ?? task.priority) : task.priority}</span>
        </div>
        <h4 className="task-readable-title">{isInternal ? buildTaskHeadline(task) : task.title}</h4>
        <p className="task-readable-summary">{isInternal ? buildTaskSummary(task) : task.task_id}</p>
        {isInternal ? (
          <div className="task-next-action">
            <span>下一步</span>
            <strong>{buildNextAction(task)}</strong>
          </div>
        ) : null}
        <div className="task-readable-meta">
          <span>负责人：{isInternal ? formatOwnerLabel(task.owner) : task.owner}</span>
          <span>更新：{isInternal ? formatUpdatedAt(task.updated_at) : task.updated_at}</span>
        </div>
        {isInternal && taskSignals.length > 0 ? (
          <div className="task-signal-row" aria-label="任务业务线索">
            {taskSignals.map((signal) => (
              <span key={`${signal.label}-${signal.value}`}>
                <small>{signal.label}</small>
                {signal.value}
              </span>
            ))}
          </div>
        ) : null}
        <details className="task-raw-details">
          <summary>{isInternal ? '查看原始信息与关联对象' : 'Details'}</summary>
          <div className="queue-meta dense-meta">
            <span>{isInternal ? '任务编号' : 'task_id'}：{task.task_id}</span>
          </div>
          <div className="queue-meta dense-meta">
            <span>{isInternal ? '原始标题' : 'title'}：{humanizeTaskText(task.title)}</span>
          </div>
          <div className="queue-meta dense-meta">
            <span>{isInternal ? '状态' : 'status'}：{isInternal ? TASK_STATUS_LABEL_ZH[task.status] : task.status}</span>
          </div>
          {taskRecord ? (
            <div className="relation-stack" style={{ marginTop: 12 }}>
              <div>
                <span className="section-label">{isInternal ? '关联项目' : 'Linked project'}</span>
                <div className="object-row top-gap">
                  {project ? (
                    <ObjectBadge
                      kind="project"
                      code={project.code}
                      name={project.name}
                      hideCode={isInternal}
                      compact
                      clickable
                      onClick={() => goFocus('/projects', 'project', project.id)}
                      {...linking.getState('project', project.id)}
                    />
                  ) : (
                    <span className="soft-tag">—</span>
                  )}
                </div>
              </div>
              <div>
                <span className="section-label">{isInternal ? '关联频道' : 'Linked rooms'}</span>
                <div className="object-row top-gap">
                  {linkedRooms.length > 0 ? (
                    linkedRooms.slice(0, 2).map((room) => (
                      <ObjectBadge
                        key={room.id}
                        kind="room"
                        code={room.code}
                        name={room.name}
                        compact
                        clickable
                        onClick={() => goFocus('/rooms', 'room', room.id)}
                        {...linking.getState('room', room.id)}
                      />
                    ))
                  ) : (
                    <span className="soft-tag">—</span>
                  )}
                </div>
              </div>
              <div>
                <span className="section-label">{isInternal ? '关联协作者' : 'Linked agent'}</span>
                <div className="object-row top-gap">
                  {agent ? (
                    <ObjectBadge
                      kind="agent"
                      code={agent.code}
                      name={agent.name}
                      hideCode={isInternal}
                      instanceKey={agent.instanceKey}
                      agentId={agent.id}
                      compact
                      clickable
                      onClick={() => goFocus('/agents', 'agent', agent.id)}
                      {...linking.getState('agent', agent.id)}
                    />
                  ) : (
                    <span className="soft-tag">—</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </details>
      </article>
    )
  }

  const renderFocusTask = (task: TaskListItem, index: number) => (
    <article key={`focus-${task.task_id}`} className={`task-focus-card task-focus-${getTaskTriageTone(task)}`}>
      <div className="task-focus-rank">{index + 1}</div>
      <div className="task-focus-body">
        <div className="task-focus-topline">
          <span>{getTaskTriageLabel(task)}</span>
          <small>{formatUpdatedAt(task.updated_at)}</small>
        </div>
        <strong>{isInternal ? buildTaskHeadline(task) : task.title}</strong>
        <p>{getTaskReason(task)}</p>
        <div className="task-focus-foot">
          <span>负责人：{isInternal ? formatOwnerLabel(task.owner, true) : task.owner}</span>
          <span>下一步：{buildNextAction(task)}</span>
        </div>
      </div>
    </article>
  )

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{isInternal ? '任务' : 'Tasks'}</p>
          <h2>{isInternal ? '任务看板' : 'Task List'}</h2>
        </div>
        <p className="page-note">
          {isInternal
            ? '默认展示给人看的任务摘要、负责人和下一步；原始编号与排障信息可展开查看。'
            : 'Task list with unified fields: task_id, title, status, priority, owner, updated_at.'}
        </p>
      </div>

      <PageLeadPanel
        heading={isInternal ? '任务快照' : 'Task Queue'}
        intro={isInternal ? '先看进行中、已暂停和需人工处理；每张卡片都会告诉你“现在是什么事”和“下一步做什么”。' : 'Track task status results by queue state.'}
        internalMode={isInternal}
        metrics={STATUS_COLUMNS.map((column) => ({
          label: isInternal ? column.labelZh : column.label,
          value: effectiveTasks.filter((task) => task.status === column.key).length,
        }))}
        internalHint={isInternal ? '内部版优先读取真实任务记录；暂时没有同步数据时，会先显示演示样例。' : undefined}
      />

      {isInternal ? (
        <section className="study-dispatch-panel panel strong-card">
          <div className="study-dispatch-copy">
            <span className="eyebrow">羲果陪伴</span>
            <h3>今日学习计划派发</h3>
            <p>家长确认后，把学习任务写入果果的学习 App；飞书 webhook 配好后，会同步提醒学习布置群。</p>
          </div>
          <div className="study-dispatch-form" aria-label="今日学习计划派发">
            <label className="study-field">
              <span>计划日期</span>
              <input
                type="date"
                value={studyDate}
                onChange={(event) => setStudyDate(event.target.value)}
              />
            </label>
            <div className="study-task-list">
              {studyTasks.map((task, index) => (
                <article key={task.localId} className="study-task-row">
                  <div className="study-task-row-head">
                    <strong>任务 {index + 1}</strong>
                    <button type="button" className="ghost-button" onClick={() => removeStudyTask(task.localId)} disabled={studyTasks.length <= 1}>
                      移除
                    </button>
                  </div>
                  <div className="study-task-grid">
                    <label className="study-field">
                      <span>标题</span>
                      <input
                        value={task.title}
                        onChange={(event) => updateStudyTask(task.localId, { title: event.target.value })}
                        placeholder="例如：数学练习"
                      />
                    </label>
                    <label className="study-field">
                      <span>科目</span>
                      <select
                        value={task.subject}
                        onChange={(event) => updateStudyTask(task.localId, { subject: event.target.value as StudySubject })}
                      >
                        {STUDY_SUBJECT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="study-field">
                      <span>预计时长</span>
                      <input
                        type="number"
                        min={1}
                        max={240}
                        value={task.durationMinutes}
                        onChange={(event) => updateStudyTask(task.localId, { durationMinutes: Number(event.target.value) })}
                      />
                    </label>
                    <label className="study-field study-field-wide">
                      <span>说明</span>
                      <input
                        value={task.description}
                        onChange={(event) => updateStudyTask(task.localId, { description: event.target.value })}
                        placeholder="例如：练习册第45-47页"
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
            <div className="study-dispatch-actions">
              <button type="button" className="ghost-button" onClick={addStudyTask}>添加任务</button>
              <button type="button" className="ghost-button" onClick={resetStudyTasks}>恢复默认</button>
              <button type="button" className="focus-header-button" onClick={handleStudyDispatch} disabled={studyDispatchState.status === 'sending'}>
                {studyDispatchState.status === 'sending' ? '正在派发...' : '确认并发送'}
              </button>
            </div>
            <div className={`study-dispatch-result study-dispatch-${studyDispatchState.status}`}>
              <span>{studyDispatchState.message}</span>
              {studyDispatchState.deepLink ? <a href={studyDispatchState.deepLink} target="_blank" rel="noreferrer">打开羲果陪伴</a> : null}
              {studyDispatchState.status === 'partial' ? (
                <small>
                  羲果：{studyDispatchState.xiguoOk ? '已完成' : '未完成'} · 飞书：{studyDispatchState.feishuOk ? '已完成' : '未完成'}
                </small>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {isInternal ? (
        <section className="task-command-center panel strong-card">
          <div className="task-command-copy">
            <span className="eyebrow">今日先看</span>
            <h3>先处理会影响推进的任务</h3>
            <p>这里把需人工确认、已暂停、实时同步异常和高优先级任务提前，下面状态列再保留完整清单。</p>
          </div>
          <div className="task-command-stats" aria-label="任务处理重点">
            <div className="task-command-stat is-attention">
              <span>需要你看</span>
              <strong>{visibleTaskStats.attentionTasks.length}</strong>
            </div>
            <div className="task-command-stat">
              <span>正在推进</span>
              <strong>{visibleTaskStats.activeTasks.length}</strong>
            </div>
            <div className="task-command-stat">
              <span>等待接单</span>
              <strong>{visibleTaskStats.waitingTasks.length}</strong>
            </div>
            <div className="task-command-stat">
              <span>完成记录</span>
              <strong>{visibleTaskStats.recentlyDoneTasks.length}</strong>
            </div>
          </div>
          <div className="task-focus-list">
            {visibleTaskStats.focusTasks.map(renderFocusTask)}
            {visibleTaskStats.focusTasks.length === 0 ? <p className="empty-state">当前没有需要优先看的任务。</p> : null}
          </div>
        </section>
      ) : null}

      {isInternal ? (
        <section className="task-read-guide panel strong-card">
          <div>
            <span className="eyebrow">怎么读</span>
            <h3>先判断任务是否需要你介入</h3>
            <p>默认只展示每列最重要、最近的任务；任务编号、频道编号、处理依据都收在“查看原始信息”或“较早记录”里。</p>
          </div>
          <div className="task-read-guide-steps">
            <span>1. 看状态列</span>
            <span>2. 看下一步</span>
            <span>3. 需要排障再展开详情</span>
          </div>
        </section>
      ) : null}

      <div className="queue-grid">
        {STATUS_COLUMNS.map((column) => {
          const list = sortTasksForBoard(effectiveTasks.filter((task) => task.status === column.key))
          const visibleLimit = isInternal ? getVisibleTaskLimit(column.key) : list.length
          const visibleList = list.slice(0, visibleLimit)
          const hiddenList = list.slice(visibleLimit)
          return (
            <section key={column.key} className="panel queue-column strong-card">
              <div className="panel-header">
                <div>
                  <h3>{isInternal ? column.labelZh : column.label}</h3>
                  {isInternal ? <p className="queue-column-note">{column.helperZh}</p> : null}
                </div>
                <span className="badge-count">{list.length}</span>
              </div>
              <div className="queue-list">
                {visibleList.map(renderTaskCard)}
                {hiddenList.length > 0 ? (
                  <details className="task-history-fold">
                    <summary>还有 {hiddenList.length} 条较早记录，展开查看</summary>
                    <div className="queue-list top-gap">{hiddenList.map(renderTaskCard)}</div>
                  </details>
                ) : null}
                {list.length === 0 ? <p className="empty-state empty-compact">{isInternal ? EMPTY_COLUMN_TEXT_ZH[column.key] : 'No tasks'}</p> : null}
              </div>
            </section>
          )
        })}
      </div>

      {isInternal ? (
        <section className="panel strong-card">
          <div className="panel-header">
            <h3>最近处理动态</h3>
            <span className="badge-count">
              {effectiveTasks.reduce((sum, task) => sum + Math.min(task.decision_log.length, 2), 0)}
            </span>
          </div>
          <p className="page-note">
            先看最近发生了什么、为什么这样处理；如需排障，再展开原始说明和变更记录。
          </p>
          <div className="consultant-evidence-list">
            {effectiveTasks
              .flatMap((task) => task.decision_log.slice(-2).map((entry, index) => ({ key: `${task.task_id}-${index}`, task, entry })))
              .slice(0, 10)
              .map(({ key, task, entry }) => {
                const taskRecord = resolveTaskRecord(task)
                const project = taskRecord ? projects.find((item) => item.id === taskRecord.projectId) : undefined
                const agent = taskRecord ? agents.find((item) => item.id === taskRecord.executorAgentId || item.id === taskRecord.assigneeAgentId) : undefined
                const linkedRoom = taskRecord
                  ? rooms.find((room) => room.mainProjectId === taskRecord.projectId || room.instanceIds.includes(taskRecord.executorAgentId))
                  : undefined
                const routingHints = {
                  projectIds: project ? [project.id, project.code, project.name] : [],
                  agentIds: (agent ? [agent.id, agent.code, agent.name, agent.instanceKey] : []).filter((value): value is string => Boolean(value)),
                  roomIds: linkedRoom ? [linkedRoom.id, linkedRoom.code, linkedRoom.name] : [],
                  taskIds: taskRecord ? [taskRecord.id, taskRecord.code, taskRecord.title] : [task.task_id, task.title],
                  projectSignals: [task.project_line].filter((value): value is string => Boolean(value)),
                  roomSignals: [task.account_line, task.source_line].filter((value): value is string => Boolean(value)),
                  taskSignals: [task.content_line].filter((value): value is string => Boolean(value)),
                  agentSignals: [task.owner, task.consultant_id].filter((value): value is string => Boolean(value)),
                }
                return (
                  <article key={key} className="consultant-evidence-card">
                    <strong>{buildTaskHeadline(task)}</strong>
                    <p>最近处理：{formatTaskLogText(entry.action, '已记录处理动作')}</p>
                    <small>原因：{formatTaskLogText(entry.reason)} · {formatUpdatedAt(entry.timestamp)}</small>
                    <details className="scheduler-debug-block" style={{ marginTop: 8 }}>
                      <summary className="scheduler-task-result-head">
                        <strong>查看处理依据</strong>
                      </summary>
                      <div className="top-gap">
                        <p>处理说明：{formatTaskLogText(entry.detail)}</p>
                        <p>原始任务编号（排障用）：{task.task_id}</p>
                        <EvidenceObjectLinks
                          textParts={[task.title, task.task_id, entry.reason, entry.detail]}
                          signalParts={[
                            task.project_line ? `project_line=${task.project_line}` : undefined,
                            task.source_line ? `source_line=${task.source_line}` : undefined,
                            task.account_line ? `account_line=${task.account_line}` : undefined,
                            task.content_line ? `content_line=${task.content_line}` : undefined,
                            task.consultant_id ? `consultant_id=${task.consultant_id}` : undefined,
                            task.attribution ? `attribution=${task.attribution.source}/${task.attribution.medium}/${task.attribution.campaign}` : undefined,
                            task.attribution?.content,
                          ]}
                          currentSearch={linking.currentSearch}
                          projects={projects}
                          agents={agents}
                          rooms={rooms}
                          tasks={tasks}
                          projectId={project?.id}
                          agentId={agent?.id}
                          roomId={linkedRoom?.id}
                          taskId={taskRecord?.id}
                          routingHints={routingHints}
                        />
                      </div>
                    </details>
                  </article>
                )
              })}
            {!effectiveTasks.some((task) => task.decision_log.length > 0) ? <p className="empty-state">暂无处理记录。</p> : null}
          </div>
          <details className="scheduler-debug-block top-gap">
            <summary className="scheduler-task-result-head">
              <strong>查看变更记录（排障用）</strong>
            </summary>
            <div className="consultant-evidence-list top-gap">
              {auditEntries.map((entry, index) => (
                <article key={`${entry.id}-${index}`} className="consultant-evidence-card">
                  <strong>{formatTaskLogText(entry.action, '已记录变更')}</strong>
                  <p>{formatTaskLogText(entry.target, '涉及对象已记录')}</p>
                  <small>{formatTaskLogText(entry.result, '结果已记录')} · {formatUpdatedAt(entry.time)}</small>
                  <EvidenceObjectLinks
                    textParts={[entry.action, entry.target, entry.result]}
                    signalParts={[entry.actor, entry.target, entry.result]}
                    currentSearch={linking.currentSearch}
                    projects={projects}
                    agents={agents}
                    rooms={rooms}
                    tasks={tasks}
                    routingHints={{
                      agentSignals: [entry.actor].filter((value): value is string => Boolean(value)),
                      roomSignals: [entry.target],
                      taskSignals: [entry.target, entry.result],
                    }}
                  />
                </article>
              ))}
              {!auditEntries.length ? <p className="empty-state">暂无变更记录。</p> : null}
            </div>
          </details>
        </section>
      ) : null}
    </section>
  )
}
