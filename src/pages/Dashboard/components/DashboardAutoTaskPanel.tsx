import { useEffect, useState } from 'react'
import { SystemTestResultPanel } from './DashboardAutoTaskCards'
import {
  AutoTaskExecutionView,
  AutoTaskOperationsView,
} from './DashboardAutoTaskOpsViews'
import { DashboardAutoTaskTaskCard } from './DashboardAutoTaskTaskCard'
import {
  AutoTaskDebugMainView,
  AutoTaskDebugProfileCard,
  AutoTaskDebugSidebar,
  AutoTaskRoutingView,
} from './DashboardAutoTaskViews'
import { AUTO_TASK_SCENARIO_TEMPLATES } from '../lib/autoTaskConfig'
import { deriveAutoTaskViewData } from '../lib/autoTaskDerived'
import { formatScenarioTemplate } from '../lib/autoTaskLabels'
import type {
  AccountType,
  AutoDecisionLogEntry,
  AutoTaskBoardItem,
  AutoTaskBoardPayload,
  AutoTaskTemplateKey,
  ChannelTier,
  ContentLearningRecord,
  ExternalPartnerMode,
  RouteResult,
  TaskNotificationItem,
} from '../lib/autoTaskShared'

const BRAND_LABELS: Record<NonNullable<AutoTaskBoardItem['brand_line']>, string> = {
  kotovela: 'KOTOVELA',
  yanfami: 'YANFAMI',
  kotoharo: 'KOTOHARO',
  guoshituan: '果实团',
}

const MCN_LABELS: Record<NonNullable<AutoTaskBoardItem['mcn_line']>, string> = {
  self_operated: '自营矩阵',
  kotovela_mcn: 'KOTOVELA MCN',
  yanfami_mcn: 'YANFAMI MCN',
  partner_network: '合作分发网络',
}

function normalizeAccountType(item: AutoTaskBoardItem): AccountType {
  if (item.account_type === 'owned' || item.account_type === 'brand' || item.account_type === 'ip' || item.account_type === 'external_partner') {
    return item.account_type
  }
  if (item.account_type === 'official') return 'owned'
  if (item.account_type === 'hybrid') return 'brand'
  if (item.account_type === 'personal') return 'ip'
  if ((item.account_line ?? '').includes('official')) return 'owned'
  return 'ip'
}

function normalizeTier(item: AutoTaskBoardItem): ChannelTier {
  if (item.tier === 'L1' || item.tier === 'L2' || item.tier === 'L3') return item.tier
  if (item.distribution_channel === 'official_account') return 'L1'
  if ((item.account_line ?? '').includes('official')) return 'L1'
  if (item.distribution_channel === 'short_content') return 'L2'
  return 'L3'
}

function isLeadTask(item: AutoTaskBoardItem) {
  const target = [item.task_name, item.domain, item.subdomain, item.project_line, item.source_line, item.type].filter(Boolean).join(' ').toLowerCase()
  return ['lead', 'clue', 'business', 'followup', 'quote', 'crm', '成交', '转单', '商机', '报价', '跟进'].some((keyword) => target.includes(keyword.toLowerCase()))
}

function appendDecisionLog(item: AutoTaskBoardItem, entry: AutoDecisionLogEntry): AutoDecisionLogEntry[] {
  const signature = `${entry.action}|${entry.reason}|${entry.detail}|${entry.route_target ?? ''}`
  const existed = (item.decision_log ?? []).some((current) => `${current.action}|${current.reason}|${current.detail}|${current.route_target ?? ''}` === signature)
  return existed ? (item.decision_log ?? []) : [...(item.decision_log ?? []), entry]
}

function enrichBoardItem(item: AutoTaskBoardItem): AutoTaskBoardItem {
  const accountType = normalizeAccountType(item)
  const tier = normalizeTier(item)
  const brandDisplay = item.brand_display ?? (item.brand_line ? BRAND_LABELS[item.brand_line] : undefined)
  const mcnLine = item.mcn_line ?? (accountType === 'external_partner' ? 'partner_network' : 'self_operated')
  const mcnDisplay = item.mcn_display ?? MCN_LABELS[mcnLine]
  const leadTask = isLeadTask(item)
  const canCloseDeal = accountType !== 'external_partner'
  const partnerMode: ExternalPartnerMode | undefined = accountType === 'external_partner'
    ? (leadTask ? 'consult_only' : item.domain === 'media' ? 'content_only' : 'no_delivery')
    : undefined
  let routeResult: RouteResult = item.route_result ?? 'direct'
  let routeTarget = item.route_target ?? (leadTask ? 'business.lead_router' : item.assigned_agent ?? item.target_system ?? item.instance_pool ?? 'direct')
  let nextItem: AutoTaskBoardItem = {
    ...item,
    account_type: accountType,
    tier,
    brand_display: brandDisplay,
    mcn_line: mcnLine,
    mcn_display: mcnDisplay,
    can_close_deal: canCloseDeal,
  }

  if (!canCloseDeal) {
    routeResult = leadTask ? 'transfer' : 'blocked'
    routeTarget = leadTask ? 'business.lead_router' : 'manual_review.required'
    nextItem = {
      ...nextItem,
      route_result: routeResult,
      route_target: routeTarget,
      predicted_block: leadTask ? nextItem.predicted_block : true,
      need_human: leadTask ? true : (nextItem.need_human ?? true),
      auto_action: 'need_human',
      assigned_agent: leadTask ? 'business' : nextItem.assigned_agent,
      instance_pool: leadTask ? 'business' : nextItem.instance_pool,
      target_system: routeTarget,
      blocked_by: leadTask ? nextItem.blocked_by : Array.from(new Set([...(nextItem.blocked_by ?? []), 'external_partner_deal_restricted'])),
    }

    nextItem.decision_log = appendDecisionLog(nextItem, {
      timestamp: nextItem.updated_at ?? nextItem.timestamp ?? new Date().toISOString(),
      action: leadTask ? 'lead_auto_transfer' : 'precheck_block',
      reason: leadTask ? 'external_partner lead 自动转单' : 'external_partner 禁止成交',
      detail: leadTask ? `Lead 已自动转交至 ${routeTarget}` : '该账号类型不允许直接成交，已拦截',
      route_target: routeTarget,
      route_result: routeResult,
      account_type: accountType,
      tier,
      brand_display: brandDisplay,
      mcn_display: mcnDisplay,
      can_close_deal: canCloseDeal,
      rule_hit_reason: 'external_partner account_type 命中专属路由规则',
      whitelist_hit: leadTask ? 'lead_transfer_whitelist' : undefined,
      block_reason: leadTask ? undefined : 'external_partner_deal_restricted',
      partner_mode: partnerMode,
    })
  } else {
    nextItem.decision_log = appendDecisionLog(nextItem, {
      timestamp: nextItem.updated_at ?? nextItem.timestamp ?? new Date().toISOString(),
      action: 'notify_result',
      reason: 'standard routing direct pass',
      detail: `按标准路由直达 ${routeTarget}`,
      route_target: routeTarget,
      route_result: routeResult,
      account_type: accountType,
      tier,
      brand_display: brandDisplay,
      mcn_display: mcnDisplay,
      can_close_deal: canCloseDeal,
      rule_hit_reason: 'standard route matrix',
      whitelist_hit: item.route_result === 'direct' ? 'default_delivery' : undefined,
    })
    nextItem.route_result = routeResult
    nextItem.route_target = routeTarget
  }

  return nextItem
}

function enrichBoardPayload(payload: AutoTaskBoardPayload): AutoTaskBoardPayload {
  const board = (payload.board ?? []).map(enrichBoardItem)
  return {
    ...payload,
    board,
    total: payload.total ?? board.length,
  }
}

type FailedTaskState = {
  taskName: string
  status: 'failed'
  message: string
  retryCount: number
  autoRetrying?: boolean
}

export function AutoTaskSystemPanel() {
  const [data, setData] = useState<AutoTaskBoardPayload | null>(null)
  const [learningRecords, setLearningRecords] = useState<ContentLearningRecord[]>([])
  const [notifications, setNotifications] = useState<TaskNotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'operations' | 'execution' | 'routing' | 'debug'>('operations')
  const [activePool, setActivePool] = useState<'builder' | 'media' | 'family' | 'business' | 'personal'>('builder')
  const [taskInput, setTaskInput] = useState('')
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [failedTask, setFailedTask] = useState<FailedTaskState | null>(null)
  const [runningTaskName, setRunningTaskName] = useState('')
  const [autoRetryState, setAutoRetryState] = useState<{ taskName: string; retryCount: number } | null>(null)
  const [controlLoadingTask, setControlLoadingTask] = useState('')
  const [expandedTaskName, setExpandedTaskName] = useState('')
  const [copyState, setCopyState] = useState('')
  const [activeNoticeDomain, setActiveNoticeDomain] = useState<'builder' | 'media' | 'family' | 'business'>('builder')
  const [activeTemplateKey, setActiveTemplateKey] = useState<AutoTaskTemplateKey>('media_publish_with_distribution')

  const loadBoard = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/tasks-board', { cache: 'no-store' }).then((res) => res.json() as Promise<AutoTaskBoardPayload>),
      fetch('/api/task-notifications', { cache: 'no-store' })
        .then((res) => res.json() as Promise<{ notifications?: TaskNotificationItem[] }>)
        .catch(() => ({ notifications: [] })),
      fetch('/api/content-feedback', { cache: 'no-store' })
        .then((res) => res.json() as Promise<{ records?: ContentLearningRecord[] }>)
        .catch(() => ({ records: [] })),
    ])
      .then(([json, notifyJson, learningJson]) => {
        setData(enrichBoardPayload(json))
        setNotifications(notifyJson.notifications ?? [])
        setLearningRecords(learningJson.records ?? [])
      })
      .catch(() => {
        setData(null)
        setNotifications([])
        setLearningRecords([])
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadBoard()
    const timer = window.setInterval(loadBoard, 3000)
    return () => window.clearInterval(timer)
  }, [])

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const executeTask = async (input: string, options?: { silentFailure?: boolean }) => {
    if (!input || running) return
    setRunning(true)
    setRunningTaskName(input)
    setRunError('')
    setFailedTask(null)
    try {
      const res = await fetch('/api/tasks-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || data?.error || '执行失败')
      }
      setTaskInput('')
      loadBoard()
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      setRunError(message)
      if (!options?.silentFailure) {
        setFailedTask({
          taskName: input,
          status: 'failed',
          message,
          retryCount: autoRetryState?.taskName === input ? autoRetryState.retryCount : 0,
        })
      }
      throw error instanceof Error ? error : new Error(message)
    } finally {
      setRunning(false)
      setRunningTaskName('')
    }
  }

  const createScenarioTemplate = async () => {
    if (running) return
    setRunning(true)
    setRunningTaskName(activeTemplateKey)
    setRunError('')
    setFailedTask(null)
    try {
      const res = await fetch('/api/tasks-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_key: activeTemplateKey }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || data?.error || '模板创建失败')
      }
      loadBoard()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '模板创建失败')
    } finally {
      setRunning(false)
      setRunningTaskName('')
    }
  }

  const autoRetryTask = async (taskName: string, baseMessage: string) => {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      setAutoRetryState({ taskName, retryCount: attempt })
      setFailedTask({ taskName, status: 'failed', message: baseMessage, retryCount: attempt, autoRetrying: true })
      await wait(2000)
      try {
        await executeTask(taskName, { silentFailure: true })
        setFailedTask(null)
        setAutoRetryState(null)
        loadBoard()
        return
      } catch {
        // continue to next retry
      }
    }

    setFailedTask({ taskName, status: 'failed', message: baseMessage, retryCount: 2, autoRetrying: false })
    setAutoRetryState(null)
  }

  const runTask = async () => {
    const input = taskInput.trim()
    if (!input || running) return
    try {
      await executeTask(input)
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      await autoRetryTask(input, message)
    }
  }

  const retryTask = async (taskName: string) => {
    if (running || autoRetryState) return
    try {
      await executeTask(taskName)
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      await autoRetryTask(taskName, message)
    }
  }

  const controlTask = async (taskName: string, action: 'pause' | 'resume' | 'cancel' | 'priority_up' | 'priority_down') => {
    if (running || autoRetryState || controlLoadingTask) return
    setControlLoadingTask(`${taskName}:${action}`)
    try {
      const res = await fetch('/api/tasks-board', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_name: taskName, action }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || err?.error || '操作失败')
      }
      setData(enrichBoardPayload((await res.json()) as AutoTaskBoardPayload))
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '操作失败')
    } finally {
      setControlLoadingTask('')
    }
  }

  const manualControlTask = async (taskName: string, action: 'takeover' | 'assign' | 'ignore' | 'manual_done' | 'manual_continue' | 'mark_manual_published') => {
    if (running || autoRetryState || controlLoadingTask) return
    const humanOwner = action === 'assign'
      ? window.prompt('请输入指派人', 'builder')?.trim()
      : action === 'takeover' || action === 'ignore' || action === 'manual_done' || action === 'manual_continue' || action === 'mark_manual_published'
        ? 'builder'
        : ''
    if (action === 'assign' && !humanOwner) return
    setControlLoadingTask(`${taskName}:${action}`)
    try {
      const res = await fetch('/api/tasks-board', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_name: taskName, action, human_owner: humanOwner }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || err?.error || '操作失败')
      }
      setData(enrichBoardPayload((await res.json()) as AutoTaskBoardPayload))
      loadBoard()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '操作失败')
    } finally {
      setControlLoadingTask('')
    }
  }

  const markTemplateSource = async (taskName: string) => {
    if (running || autoRetryState || controlLoadingTask) return
    setControlLoadingTask(`${taskName}:mark_template_source`)
    try {
      const res = await fetch('/api/tasks-board', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_name: taskName, action: 'mark_template_source' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || err?.error || '标记失败')
      }
      setData(enrichBoardPayload((await res.json()) as AutoTaskBoardPayload))
      loadBoard()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '标记失败')
    } finally {
      setControlLoadingTask('')
    }
  }

  const groupNotificationAction = async (
    notice: TaskNotificationItem,
    action: 'done' | 'continue' | 'transfer',
  ) => {
    if (running || autoRetryState || controlLoadingTask) return
    const humanOwner = action === 'transfer' ? window.prompt('请输入转人工负责人', notice.assigned_agent || 'builder')?.trim() : (notice.assigned_agent || 'builder')
    if (action === 'transfer' && !humanOwner) return
    setControlLoadingTask(`${notice.task_name}:group:${action}`)
    try {
      const res = await fetch('/api/task-notification-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_action: action,
          task_id: notice.task_id,
          task_name: notice.task_name,
          domain: notice.domain,
          assigned_agent: notice.assigned_agent,
          human_owner: humanOwner,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || err?.error || '群动作回写失败')
      }
      loadBoard()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '群动作回写失败')
    } finally {
      setControlLoadingTask('')
    }
  }

  const poolTabs = data?.pools ?? []
  const normalizedActivePool = poolTabs.some((pool) => pool.key === activePool) ? activePool : (poolTabs[0]?.key ?? 'builder')
  const sortedBoard = [...(data?.board ?? [])].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
  const templatePool = data?.template_pool ?? []
  const humanPendingTasks = sortedBoard.filter((item) => item.need_human)
  const poolBoard = sortedBoard.filter((item) => (item.instance_pool ?? 'builder') === normalizedActivePool)
  const runningTasks = poolBoard.filter((item) => ['doing', 'running'].includes(item.status))
  const queuedTasks = poolBoard.filter((item) => ['todo', 'queued', 'queue', 'pending', 'preparing'].includes(item.status))
  const blockedTasks = queuedTasks.filter((item) => (item.blocked_by?.length ?? 0) > 0)
  const blockedPoolTasks = poolBoard.filter((item) => item.status === 'blocked' || (item.blocked_by?.length ?? 0) > 0 || item.predicted_block)
  const pausedTasks = poolBoard.filter((item) => ['paused', 'pause'].includes(item.status))
  const doneTasks = poolBoard.filter((item) => ['success', 'done', 'cancelled', 'failed'].includes(item.status))
  const needHumanPoolTasks = poolBoard.filter((item) => item.need_human)
  const failedTasks = sortedBoard.filter((item) => item.status === 'failed')
  const abnormalTasks = sortedBoard.filter((item) => item.abnormal || item.attention)
  const stuckTasks = sortedBoard.filter((item) => item.stuck)
  const continuousFailedTasks = failedTasks.filter((item) => {
    const lastEntries = [...(item.history ?? [])].slice(-2)
    return lastEntries.length >= 2 && lastEntries.every((entry) => entry.action === 'fail' || entry.status_after === 'failed')
  })

  const runningCount = data?.running_count ?? runningTasks.length
  const queueCount = data?.queue_count ?? queuedTasks.length
  const failedCount = data?.failed_count ?? failedTasks.length
  const abnormalCount = data?.abnormal_count ?? abnormalTasks.length
  const currentConcurrency = data?.current_concurrency ?? runningCount
  const maxConcurrency = data?.max_concurrency ?? 2

  const handleToggleExpandedTask = (taskName: string) => {
    setExpandedTaskName((current) => (current === taskName ? '' : taskName))
  }

  const handleCopyResult = async (taskName: string, resultText: string) => {
    try {
      await navigator.clipboard.writeText(resultText)
      setCopyState(taskName)
      window.setTimeout(() => setCopyState((current) => (current === taskName ? '' : current)), 1500)
    } catch {
      setCopyState('copy-failed')
    }
  }

  const renderTaskCard = (
    item: AutoTaskBoardItem,
    tone: 'running' | 'queue' | 'paused' | 'done',
    index: number,
  ) => {
    return (
      <DashboardAutoTaskTaskCard
        item={item}
        tone={tone}
        index={index}
        showTechnicalDetails={activeView === 'debug' || expandedTaskName === item.task_name}
        expanded={expandedTaskName === item.task_name}
        copyState={copyState}
        controlLoadingTask={controlLoadingTask}
        running={running || !!autoRetryState}
        autoRetrying={autoRetryState?.taskName === item.task_name}
        onToggleExpanded={handleToggleExpandedTask}
        onCopyResult={handleCopyResult}
        onControlTask={controlTask}
        onRetryTask={retryTask}
        onManualControlTask={manualControlTask}
      />
    )
  }

  const {
    recentDecisions,
    routingDecisionTable,
    routeFocusedTasks,
    recentResults,
    publishSourceGroups,
    archiveDomainGroups,
    archiveContentLineGroups,
    archiveAccountLineGroups,
    currentProfile,
    archiveStructureGroups,
    todayAutoGeneratedTasks,
    riskSummary,
    domainLoadSummary,
    executionStatusSummary,
    consultantSummary,
    reassignmentRecords,
    taskGroups,
    parentTaskViews,
    notificationTabs,
    visibleNotifications,
  } = deriveAutoTaskViewData({
    data,
    notifications,
    sortedBoard,
    humanPendingTasks,
    poolBoard,
    runningTasks,
    queuedTasks,
    activeNoticeDomain,
  })

  return (
    <section className="home-section panel strong-card auto-task-panel scheduler-hub-panel">
      <div className="home-section-head scheduler-hub-head">
        <div>
          <h3>执行中枢</h3>
          <p className="scheduler-hub-subtitle">集中查看任务分配、执行进度、结果回报和待人工事项</p>
        </div>
        <span className="home-count">{data?.board?.length ?? 0}</span>
      </div>

      <div className="scheduler-template-strip">
        <div className="scheduler-template-chips">
          <button type="button" className="scheduler-template-chip is-active">
            <strong>内容学习记录</strong>
            <span>记录 {data?.learning_summary?.total_records ?? learningRecords.length} · 平均分 {(data?.learning_summary?.avg_learning_score ?? 0).toFixed(2)} · 高分条目 {(data?.learning_summary?.high_score_records ?? 0)}</span>
          </button>
          {learningRecords.slice(0, 3).map((record) => (
            <button key={record.key} type="button" className="scheduler-template-chip">
              <strong>{record.structure_id}</strong>
              <span>{record.content_line} / {record.account_line} / 评分 {record.learning_score.toFixed(2)}</span>
            </button>
          ))}
          <button type="button" className="scheduler-template-chip">
            <strong>跟进转化概览</strong>
            <span>
              线索 {data?.business_summary?.total_leads ?? 0} · 顾问 {data?.business_summary?.assigned_consultants ?? 0} · 已转化 {data?.business_summary?.converted ?? 0} · 已流失 {data?.business_summary?.lost ?? 0} · 已归因 {data?.business_summary?.attributed ?? 0}
            </span>
          </button>
        </div>
      </div>

      <div className="auto-task-runner">
        <input
          className="auto-task-input"
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder="输入一句话事项，例如：整理注册页面"
          disabled={running}
        />
        <button className="auto-task-run-btn" type="button" onClick={runTask} disabled={running || !taskInput.trim()}>
          {running && runningTaskName === taskInput.trim() ? '执行中...' : '执行'}
        </button>
      </div>

      <div className="scheduler-template-strip">
        <div className="scheduler-template-form">
          <select className="auto-task-input" value={activeTemplateKey} onChange={(e) => setActiveTemplateKey(e.target.value as typeof activeTemplateKey)} disabled={running}>
            {AUTO_TASK_SCENARIO_TEMPLATES.map((template) => (
              <option key={template.key} value={template.key}>{formatScenarioTemplate(template.key)}</option>
            ))}
          </select>
          <button className="auto-task-run-btn" type="button" onClick={createScenarioTemplate} disabled={running}>
            {running && runningTaskName === activeTemplateKey ? '创建中...' : '按模板创建任务组'}
          </button>
        </div>
        <div className="scheduler-template-chips">
          {AUTO_TASK_SCENARIO_TEMPLATES.map((template) => (
            <button
              key={template.key}
              type="button"
              className={`scheduler-template-chip ${activeTemplateKey === template.key ? 'is-active' : ''}`}
              onClick={() => setActiveTemplateKey(template.key)}
            >
              <strong>{formatScenarioTemplate(template.key)}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </div>
      </div>

      {failedTask ? (
        <div className="auto-task-failed-box">
          <div className="auto-task-failed-title">执行提醒</div>
          <div>任务：{failedTask.taskName}</div>
          <div>当前状态：{failedTask.status === 'failed' ? '执行失败' : failedTask.status}</div>
          <div>原因：{failedTask.message}</div>
          <div>{failedTask.autoRetrying ? '正在自动重试' : '自动重试结束'}</div>
          <div>已重试次数: {autoRetryState?.retryCount ?? failedTask.retryCount}</div>
          <button className="auto-task-retry-btn" type="button" onClick={() => retryTask(failedTask.taskName)} disabled={running || !!autoRetryState}>
            {autoRetryState?.taskName === failedTask.taskName ? '自动重试中...' : '重试'}
          </button>
        </div>
      ) : null}

      {runError ? <div className="auto-task-error">{runError}</div> : null}

      <div className="scheduler-view-switch" role="tablist" aria-label="调度视图切换">
        {[
          { key: 'operations', label: '运营进展', note: '进度 / 风险 / 待人工' },
          { key: 'execution', label: '执行进展', note: '协作者 / 排队 / 结果' },
          { key: 'routing', label: '分配去向', note: '判断规则 / 去向 / 拦截说明' },
          { key: 'debug', label: '排障详情', note: '原始字段 / 排障' },
        ].map((view) => (
          <button
            key={view.key}
            type="button"
            className={`scheduler-view-tab ${activeView === view.key ? 'is-active' : ''}`}
            onClick={() => setActiveView(view.key as typeof activeView)}
          >
            <strong>{view.label}</strong>
            <span>{view.note}</span>
          </button>
        ))}
      </div>

      <div className="scheduler-hub-layout">
        <div className="scheduler-hub-main">
          {activeView === 'operations' ? (
            <AutoTaskOperationsView
              parentTaskViews={parentTaskViews}
              taskGroups={taskGroups}
              todayAutoGeneratedCount={todayAutoGeneratedTasks.length}
              riskSummary={riskSummary}
              loading={loading}
              domainLoadSummary={domainLoadSummary}
              humanPendingTasks={humanPendingTasks}
              consultantSummary={consultantSummary}
              reassignmentRecords={reassignmentRecords}
            />
          ) : null}

          {activeView === 'execution' ? (
            <AutoTaskExecutionView
              poolTabs={poolTabs}
              normalizedActivePool={normalizedActivePool}
              onSelectPool={setActivePool}
              executionStatusSummary={executionStatusSummary}
              runningTasks={runningTasks}
              queuedTasks={queuedTasks}
              blockedPoolTasks={blockedPoolTasks}
              needHumanPoolTasks={needHumanPoolTasks}
              renderTaskCard={renderTaskCard}
              recentDecisions={recentDecisions}
              recentResults={recentResults}
              publishSourceGroups={publishSourceGroups}
              templatePool={templatePool}
              controlLoadingTask={controlLoadingTask}
              onManualControlTask={manualControlTask}
              archiveContentLineGroups={archiveContentLineGroups}
              archiveAccountLineGroups={archiveAccountLineGroups}
              archiveStructureGroups={archiveStructureGroups}
              archiveDomainGroups={archiveDomainGroups}
              onMarkTemplateSource={markTemplateSource}
            />
          ) : null}

          {activeView === 'routing' ? (
            <AutoTaskRoutingView
              routingDecisionTable={routingDecisionTable}
              routeFocusedTasks={routeFocusedTasks}
              renderTaskCard={renderTaskCard}
            />
          ) : null}

          {activeView === 'debug' ? (
            <>
              <AutoTaskDebugProfileCard currentProfile={currentProfile} />
              <AutoTaskDebugMainView
                parentTaskViews={parentTaskViews}
                taskGroups={taskGroups}
                poolTabs={poolTabs}
                normalizedActivePool={normalizedActivePool}
                onSelectPool={setActivePool}
                currentConcurrency={currentConcurrency}
                maxConcurrency={maxConcurrency}
                runningCount={runningCount}
                queueCount={queueCount}
                blockedCount={blockedTasks.length}
                failedCount={failedCount}
                abnormalCount={abnormalCount}
                loading={loading}
                runningTasks={runningTasks}
                queuedTasks={queuedTasks}
                pausedTasks={pausedTasks}
                doneTasks={doneTasks}
                renderTaskCard={renderTaskCard}
                recentDecisions={recentDecisions}
                humanPendingTasks={humanPendingTasks}
                onManualControlTask={manualControlTask}
                controlsDisabled={running || !!autoRetryState || !!controlLoadingTask}
              />
            </>
          ) : null}
        </div>

        {activeView === 'debug' ? (
          <AutoTaskDebugSidebar
            notificationTabs={notificationTabs}
            activeNoticeDomain={activeNoticeDomain}
            onSelectNoticeDomain={setActiveNoticeDomain}
            visibleNotifications={visibleNotifications}
            controlsDisabled={running || !!autoRetryState || !!controlLoadingTask}
            onGroupNotificationAction={groupNotificationAction}
            recentResults={recentResults}
            continuousFailedTasks={continuousFailedTasks}
            stuckTasks={stuckTasks}
            abnormalTasks={abnormalTasks}
            systemAlerts={data?.system_alerts ?? []}
          />
        ) : null}
      </div>

      <SystemTestResultPanel />
    </section>
  )
}
