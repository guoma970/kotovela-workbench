import type { ReactNode } from 'react'
import type {
  AutoTaskBoardItem,
  TaskNotificationItem,
  UserProfile,
} from './DashboardAutoTaskPanel'

type TaskCardTone = 'running' | 'queue' | 'paused' | 'done'

type RoutingDecisionRow = {
  key: string
  content_line: string
  brand_line: string
  account_line: string
  account_type: string
  tier: string
  can_close_deal: string
  route_target: string
  count: number
}

type ParentTaskView = {
  id: string
  title: string
  template: string
  childCount: number
  progress: number
  blockedPoint: string
  domains: Array<string | undefined>
}

type TaskGroupView = {
  id: string
  label: string
  template: string
  domain: string
  projectLine: string
  count: number
}

type PoolTab = {
  key: 'builder' | 'media' | 'family' | 'business' | 'personal'
  label: string
  max_concurrency: number
  running_count: number
  queue_count: number
  health: 'healthy' | 'warning' | 'critical'
}

type RecentDecision = {
  taskName: string
  agent: string
  decision: string
  reason: string
  detail: string
  timestamp: string
  retryCount: number
}

type RecentResult = {
  task_name: string
  updated_at?: string
  result: {
    content: string
  }
}

type AlertTaskItem = {
  task_name: string
  agent: string
}

type SystemAlertItem = {
  level: 'warning' | 'critical'
  task_name?: string
  agent?: string
  reason: string
}

type TaskCardRenderer = (item: AutoTaskBoardItem, tone: TaskCardTone, index: number) => ReactNode

type ManualControlAction = 'manual_done' | 'manual_continue' | 'assign'

type GroupNotificationAction = 'done' | 'continue' | 'transfer'

export function AutoTaskRoutingView({
  routingDecisionTable,
  routeFocusedTasks,
  renderTaskCard,
}: {
  routingDecisionTable: RoutingDecisionRow[]
  routeFocusedTasks: AutoTaskBoardItem[]
  renderTaskCard: TaskCardRenderer
}) {
  return (
    <>
      <section className="scheduler-overview-card">
        <div className="scheduler-section-title">内容归属决策表</div>
        <div className="scheduler-routing-table-wrap">
          <table className="scheduler-routing-table">
            <thead>
              <tr>
                <th>content_line</th>
                <th>brand_line</th>
                <th>account_line</th>
                <th>account_type</th>
                <th>tier</th>
                <th>can_close_deal</th>
                <th>route_target</th>
                <th>tasks</th>
              </tr>
            </thead>
            <tbody>
              {routingDecisionTable.map((row) => (
                <tr key={row.key}>
                  <td>{row.content_line}</td>
                  <td>{row.brand_line}</td>
                  <td>{row.account_line}</td>
                  <td>{row.account_type}</td>
                  <td>{row.tier}</td>
                  <td>{row.can_close_deal}</td>
                  <td>{row.route_target}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="scheduler-queue-card">
        <div className="scheduler-section-title">任务路由可视化</div>
        <div className="scheduler-route-card-list">
          {routeFocusedTasks.length
            ? routeFocusedTasks.map((item, index) =>
                renderTaskCard(
                  item,
                  item.route_result === 'blocked'
                    ? 'paused'
                    : item.route_result === 'transfer'
                      ? 'done'
                      : 'queue',
                  index,
                ),
              )
            : <div className="auto-task-empty">暂无路由数据</div>}
        </div>
      </section>
    </>
  )
}

export function AutoTaskDebugProfileCard({ currentProfile }: { currentProfile: UserProfile | null | undefined }) {
  if (!currentProfile) return null

  return (
    <section className="scheduler-overview-card">
      <div className="scheduler-section-title">用户画像卡片</div>
      <div className="scheduler-task-result-content">
        <div><span>user_id</span><strong>{currentProfile.user_id}</strong></div>
        <div><span>tags</span><strong>{currentProfile.tags.join(' / ') || '-'}</strong></div>
        <div><span>preferences</span><pre>{JSON.stringify(currentProfile.preferences, null, 2)}</pre></div>
        <div><span>behavior_patterns</span><pre>{JSON.stringify(currentProfile.behavior_patterns, null, 2)}</pre></div>
      </div>
    </section>
  )
}

export function AutoTaskDebugMainView({
  parentTaskViews,
  taskGroups,
  poolTabs,
  normalizedActivePool,
  onSelectPool,
  currentConcurrency,
  maxConcurrency,
  runningCount,
  queueCount,
  blockedCount,
  failedCount,
  abnormalCount,
  loading,
  runningTasks,
  queuedTasks,
  pausedTasks,
  doneTasks,
  renderTaskCard,
  recentDecisions,
  humanPendingTasks,
  onManualControlTask,
  controlsDisabled,
}: {
  parentTaskViews: ParentTaskView[]
  taskGroups: TaskGroupView[]
  poolTabs: PoolTab[]
  normalizedActivePool: PoolTab['key']
  onSelectPool: (poolKey: PoolTab['key']) => void
  currentConcurrency: number
  maxConcurrency: number
  runningCount: number
  queueCount: number
  blockedCount: number
  failedCount: number
  abnormalCount: number
  loading: boolean
  runningTasks: AutoTaskBoardItem[]
  queuedTasks: AutoTaskBoardItem[]
  pausedTasks: AutoTaskBoardItem[]
  doneTasks: AutoTaskBoardItem[]
  renderTaskCard: TaskCardRenderer
  recentDecisions: RecentDecision[]
  humanPendingTasks: AutoTaskBoardItem[]
  onManualControlTask: (taskName: string, action: ManualControlAction) => void
  controlsDisabled: boolean
}) {
  return (
    <>
      <section className="scheduler-overview-card">
        <div className="scheduler-section-title">调度概览</div>
        {parentTaskViews.length ? (
          <div className="scheduler-parent-task-list">
            {parentTaskViews.slice(0, 6).map((parent) => (
              <article className="scheduler-parent-task-card" key={parent.id}>
                <div className="scheduler-parent-task-top">
                  <strong>{parent.title}</strong>
                  <span>{parent.template}</span>
                </div>
                <div className="scheduler-parent-task-meta">
                  <span>子任务 {parent.childCount}</span>
                  <span>进度 {parent.progress}%</span>
                  <span>blocked {parent.blockedPoint}</span>
                </div>
                <div className="scheduler-parent-task-domains">
                  {parent.domains.map((domain) => (
                    <span key={`${parent.id}-${domain}`} className="scheduler-parent-domain-chip">{domain}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {taskGroups.length ? (
          <div className="scheduler-task-groups">
            {taskGroups.slice(0, 6).map((group) => (
              <div className="scheduler-task-group-chip" key={group.id}>
                <strong>{group.label}</strong>
                <span>{group.template} · {group.count} tasks · {group.domain} / {group.projectLine}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="scheduler-pool-overview">
          {poolTabs.map((pool) => (
            <button
              key={pool.key}
              type="button"
              className={`scheduler-pool-card ${normalizedActivePool === pool.key ? 'is-active' : ''} is-${pool.health}`}
              onClick={() => onSelectPool(pool.key)}
            >
              <div className="scheduler-pool-card-top">
                <strong>{pool.label}</strong>
                <span>{pool.health}</span>
              </div>
              <div className="scheduler-pool-card-metrics">
                <span>并发 {pool.running_count}/{pool.max_concurrency}</span>
                <span>queue {pool.queue_count}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="scheduler-overview-grid">
          <div className="scheduler-overview-metric is-concurrency"><span>并发数</span><strong>{currentConcurrency}/{maxConcurrency}</strong></div>
          <div className="scheduler-overview-metric"><span>running_count</span><strong>{runningCount}</strong></div>
          <div className="scheduler-overview-metric"><span>queue_count</span><strong>{queueCount}</strong></div>
          <div className="scheduler-overview-metric is-warning"><span>blocked_count</span><strong>{blockedCount}</strong></div>
          <div className="scheduler-overview-metric is-failed"><span>failed_count</span><strong>{failedCount}</strong></div>
          <div className="scheduler-overview-metric is-warning"><span>abnormal_count</span><strong>{abnormalCount}</strong></div>
        </div>
        <div className="scheduler-sync-line">{loading ? '调度状态: 刷新中' : '调度状态: 已同步'}</div>
      </section>

      <section className="scheduler-queue-card">
        <div className="scheduler-section-title">调度队列 · {normalizedActivePool}</div>
        <div className="scheduler-queue-grid">
          <div className="scheduler-lane">
            <div className="scheduler-lane-head"><h4>Running</h4><span>{runningTasks.length}</span></div>
            <div className="scheduler-lane-list">{runningTasks.length ? runningTasks.map((item, index) => renderTaskCard(item, 'running', index)) : <div className="auto-task-empty">暂无 Running 任务</div>}</div>
          </div>
          <div className="scheduler-lane">
            <div className="scheduler-lane-head"><h4>Queue</h4><span>{queuedTasks.length}</span></div>
            <div className="scheduler-lane-list">{queuedTasks.length ? queuedTasks.map((item, index) => renderTaskCard(item, 'queue', index)) : <div className="auto-task-empty">暂无 Queue 任务</div>}</div>
          </div>
          <div className="scheduler-lane">
            <div className="scheduler-lane-head"><h4>Paused</h4><span>{pausedTasks.length}</span></div>
            <div className="scheduler-lane-list">{pausedTasks.length ? pausedTasks.map((item, index) => renderTaskCard(item, 'paused', index)) : <div className="auto-task-empty">暂无 Paused 任务</div>}</div>
          </div>
          <div className="scheduler-lane">
            <div className="scheduler-lane-head"><h4>Done</h4><span>{doneTasks.length}</span></div>
            <div className="scheduler-lane-list">{doneTasks.length ? doneTasks.map((item, index) => renderTaskCard(item, 'done', index)) : <div className="auto-task-empty">暂无 Done 任务</div>}</div>
          </div>
        </div>
      </section>

      <section className="scheduler-decisions-card">
        <div className="scheduler-section-title">最近决策</div>
        <div className="scheduler-decision-list">
          {recentDecisions.length ? recentDecisions.map((decision, index) => (
            <article className="scheduler-decision-item" key={`${decision.taskName}-${decision.timestamp}-${index}`}>
              <div className="scheduler-decision-top">
                <strong>{decision.decision}</strong>
                <span>{decision.timestamp}</span>
              </div>
              <p>{decision.taskName} · {decision.agent}</p>
              <small>{decision.reason} · {decision.detail}{decision.decision === 'retry' ? ` · retry_count ${decision.retryCount}` : ''}</small>
            </article>
          )) : <div className="auto-task-empty">暂无自动决策记录</div>}
        </div>
      </section>

      <section className="scheduler-decisions-card scheduler-pending-human-card">
        <div className="scheduler-section-title">待人工处理</div>
        <div className="scheduler-decision-list">
          {humanPendingTasks.length ? humanPendingTasks.map((item, index) => {
            const latestDecision = [...(item.decision_log ?? [])].slice(-1)[0]
            return (
              <article className="scheduler-decision-item scheduler-human-item" key={`${item.task_name}-human-${index}`}>
                <div className="scheduler-decision-top">
                  <strong>{item.task_name}</strong>
                  <span>{item.domain ?? '-'}</span>
                </div>
                <p>reason: {latestDecision?.reason ?? 'need_human'}</p>
                <small>human_owner: {item.human_owner ?? '-'} · latest decision: {latestDecision?.detail ?? item.manual_decision ?? '-'}</small>
                <div className="auto-task-actions scheduler-human-actions">
                  <button className="auto-task-row-btn" type="button" onClick={() => onManualControlTask(item.task_name, 'manual_done')} disabled={controlsDisabled}>已处理</button>
                  <button className="auto-task-row-btn" type="button" onClick={() => onManualControlTask(item.task_name, 'manual_continue')} disabled={controlsDisabled}>继续执行</button>
                  <button className="auto-task-row-btn" type="button" onClick={() => onManualControlTask(item.task_name, 'assign')} disabled={controlsDisabled}>转人工</button>
                </div>
              </article>
            )
          }) : <div className="auto-task-empty">暂无待人工处理任务</div>}
        </div>
      </section>
    </>
  )
}

export function AutoTaskDebugSidebar({
  notificationTabs,
  activeNoticeDomain,
  onSelectNoticeDomain,
  visibleNotifications,
  controlsDisabled,
  onGroupNotificationAction,
  recentResults,
  continuousFailedTasks,
  stuckTasks,
  abnormalTasks,
  systemAlerts,
}: {
  notificationTabs: Array<{ key: 'builder' | 'media' | 'family' | 'business'; label: string }>
  activeNoticeDomain: 'builder' | 'media' | 'family' | 'business'
  onSelectNoticeDomain: (domain: 'builder' | 'media' | 'family' | 'business') => void
  visibleNotifications: TaskNotificationItem[]
  controlsDisabled: boolean
  onGroupNotificationAction: (notice: TaskNotificationItem, action: GroupNotificationAction) => void
  recentResults: RecentResult[]
  continuousFailedTasks: AlertTaskItem[]
  stuckTasks: AlertTaskItem[]
  abnormalTasks: AlertTaskItem[]
  systemAlerts: SystemAlertItem[]
}) {
  return (
    <aside className="scheduler-alert-card">
      <div className="scheduler-section-title">群通知回执</div>
      <div className="scheduler-notice-tabs" role="tablist" aria-label="群通知域名切换">
        {notificationTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`scheduler-notice-tab ${activeNoticeDomain === tab.key ? 'is-active' : ''}`}
            onClick={() => onSelectNoticeDomain(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="scheduler-alert-group">
        {visibleNotifications.length ? visibleNotifications.map((notice) => (
          <div className={`scheduler-alert-item scheduler-notice-card is-${notice.event_type === 'task_failed' ? 'critical' : notice.event_type === 'task_warning' || notice.event_type === 'task_need_human' ? 'warning' : 'abnormal'}`} key={notice.id}>
            <strong>{notice.target_group}</strong>
            <pre>{notice.message || `【${notice.event_type === 'task_warning' ? '任务告警' : '任务完成'}】\ntask_id：${notice.task_id ?? '-'}\ntask_name：${notice.task_name}\ndomain：${notice.domain}\nassigned_agent：${notice.assigned_agent}\n状态：${notice.status}\n摘要：${notice.summary}\n👉 查看：/scheduler`}</pre>
            {notice.event_type === 'task_need_human' ? (
              <div className="auto-task-actions scheduler-human-actions">
                <button className="auto-task-row-btn" type="button" onClick={() => onGroupNotificationAction(notice, 'done')} disabled={controlsDisabled}>已处理</button>
                <button className="auto-task-row-btn" type="button" onClick={() => onGroupNotificationAction(notice, 'continue')} disabled={controlsDisabled}>继续执行</button>
                <button className="auto-task-row-btn" type="button" onClick={() => onGroupNotificationAction(notice, 'transfer')} disabled={controlsDisabled}>转人工</button>
              </div>
            ) : null}
            <small>{notice.task_id ?? '-'} · {notice.project_line ?? '-'} · {notice.notify_mode ?? '-'} · {notice.target_group_id ?? '-'} · {notice.delivery} · {notice.created_at}</small>
          </div>
        )) : <div className="auto-task-empty">暂无通知回执</div>}
      </div>
      <div className="scheduler-section-title">最近结果</div>
      <div className="scheduler-alert-group">
        {recentResults.length ? recentResults.map((entry, index) => (
          <div className="scheduler-result-item" key={`${entry.task_name}-${index}`}>
            <strong>{entry.task_name}</strong>
            <p>{entry.result.content}</p>
            <small>{entry.updated_at ?? '-'}</small>
          </div>
        )) : <div className="auto-task-empty">暂无结果</div>}
      </div>
      <div className="scheduler-section-title">系统告警</div>
      <div className="scheduler-alert-group">
        <h4>连续失败任务</h4>
        {continuousFailedTasks.length ? continuousFailedTasks.map((item, index) => (
          <div className="scheduler-alert-item is-critical" key={`failed-${item.task_name}-${index}`}>{item.task_name} · {item.agent}</div>
        )) : <div className="auto-task-empty">暂无连续失败任务</div>}
      </div>
      <div className="scheduler-alert-group">
        <h4>stuck 任务</h4>
        {stuckTasks.length ? stuckTasks.map((item, index) => (
          <div className="scheduler-alert-item is-warning" key={`stuck-${item.task_name}-${index}`}>{item.task_name} · {item.agent}</div>
        )) : <div className="auto-task-empty">暂无 stuck 任务</div>}
      </div>
      <div className="scheduler-alert-group">
        <h4>异常任务</h4>
        {abnormalTasks.length ? abnormalTasks.map((item, index) => (
          <div className="scheduler-alert-item is-abnormal" key={`abnormal-${item.task_name}-${index}`}>{item.task_name} · {item.agent}</div>
        )) : <div className="auto-task-empty">暂无 abnormal / attention 任务</div>}
      </div>
      {systemAlerts.length > 0 ? (
        <div className="scheduler-alert-group">
          <h4>系统级告警</h4>
          {systemAlerts.map((alert, index) => (
            <div className={`scheduler-alert-item is-${alert.level}`} key={`sys-alert-${index}`}>{alert.task_name || '-'} · {alert.agent || '-'} · {alert.reason}</div>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
