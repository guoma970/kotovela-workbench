import type { ReactNode } from 'react'
import type {
  AlertTaskItem,
  AutoTaskBoardItem,
  ParentTaskView,
  PoolTab,
  RecentDecision,
  RecentResult,
  RoutingDecisionRow,
  SystemAlertItem,
  TaskCardTone,
  TaskGroupView,
  TaskNotificationItem,
  UserProfile,
} from '../lib/autoTaskShared'
import {
  formatAccountLine,
  formatAccountType,
  formatBrandLine,
  formatBooleanDecision,
  formatContentLine,
  formatDecisionAction,
  formatPoolHealth,
  formatPoolKey,
  formatRouteTarget,
  formatScenarioTemplate,
  formatTaskStatus,
  formatTaskTone,
} from '../lib/autoTaskLabels'

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
        <div className="scheduler-section-title">分配判断表</div>
        <div className="scheduler-routing-table-wrap">
          <table className="scheduler-routing-table">
            <thead>
              <tr>
                <th>内容线</th>
                <th>品牌线</th>
                <th>账号线</th>
                <th>账号类型</th>
                <th>层级</th>
                <th>可否成交</th>
                <th>去向</th>
                <th>任务数</th>
              </tr>
            </thead>
            <tbody>
              {routingDecisionTable.map((row) => (
                <tr key={row.key}>
                  <td>{formatContentLine(row.content_line)}</td>
                  <td>{formatBrandLine(row.brand_line)}</td>
                  <td>{formatAccountLine(row.account_line)}</td>
                  <td>{formatAccountType(row.account_type as AutoTaskBoardItem['account_type'])}</td>
                  <td>{row.tier}</td>
                  <td>{row.can_close_deal === '-' ? '-' : formatBooleanDecision(row.can_close_deal === 'true')}</td>
                  <td>{formatRouteTarget(row.route_target)}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="scheduler-queue-card">
        <div className="scheduler-section-title">事项去向一览</div>
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
            : <div className="auto-task-empty">暂无去向数据</div>}
        </div>
      </section>
    </>
  )
}

export function AutoTaskDebugProfileCard({ currentProfile }: { currentProfile: UserProfile | null | undefined }) {
  if (!currentProfile) return null

  return (
    <section className="scheduler-overview-card">
      <div className="scheduler-section-title">用户偏好卡片</div>
      <div className="scheduler-task-result-content">
        <div><span>用户编号</span><strong>{currentProfile.user_id}</strong></div>
        <div><span>标签</span><strong>{currentProfile.tags.join(' / ') || '-'}</strong></div>
        <div><span>偏好设置</span><pre>{JSON.stringify(currentProfile.preferences, null, 2)}</pre></div>
        <div><span>行为特征</span><pre>{JSON.stringify(currentProfile.behavior_patterns, null, 2)}</pre></div>
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
        <div className="scheduler-section-title">执行概览</div>
        {parentTaskViews.length ? (
          <div className="scheduler-parent-task-list">
            {parentTaskViews.slice(0, 6).map((parent) => (
              <article className="scheduler-parent-task-card" key={parent.id}>
                <div className="scheduler-parent-task-top">
                  <strong>{parent.title}</strong>
                  <span>{formatScenarioTemplate(parent.template)}</span>
                </div>
                <div className="scheduler-parent-task-meta">
                  <span>子任务 {parent.childCount}</span>
                  <span>进度 {parent.progress}%</span>
                  <span>卡点 {parent.blockedPoint}</span>
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
                <span>{formatScenarioTemplate(group.template)} · {group.count} 项任务 · {group.domain} / {group.projectLine}</span>
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
                <strong>{formatPoolKey(pool.key)}</strong>
                <span>{formatPoolHealth(pool.health)}</span>
              </div>
              <div className="scheduler-pool-card-metrics">
                <span>并发 {pool.running_count}/{pool.max_concurrency}</span>
                <span>待处理 {pool.queue_count}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="scheduler-overview-grid">
          <div className="scheduler-overview-metric is-concurrency"><span>并发数</span><strong>{currentConcurrency}/{maxConcurrency}</strong></div>
          <div className="scheduler-overview-metric"><span>执行中</span><strong>{runningCount}</strong></div>
          <div className="scheduler-overview-metric"><span>待调度</span><strong>{queueCount}</strong></div>
          <div className="scheduler-overview-metric is-warning"><span>有卡点</span><strong>{blockedCount}</strong></div>
          <div className="scheduler-overview-metric is-failed"><span>执行失败</span><strong>{failedCount}</strong></div>
          <div className="scheduler-overview-metric is-warning"><span>异常提醒</span><strong>{abnormalCount}</strong></div>
        </div>
        <div className="scheduler-sync-line">{loading ? '执行状态：刷新中' : '执行状态：已同步'}</div>
      </section>

      <section className="scheduler-queue-card">
        <div className="scheduler-section-title">当前任务分布 · {formatPoolKey(normalizedActivePool)}</div>
        <div className="scheduler-queue-grid">
          <div className="scheduler-lane">
            <div className="scheduler-lane-head"><h4>{formatTaskTone('running')}</h4><span>{runningTasks.length}</span></div>
            <div className="scheduler-lane-list">{runningTasks.length ? runningTasks.map((item, index) => renderTaskCard(item, 'running', index)) : <div className="auto-task-empty">暂无执行中任务</div>}</div>
          </div>
          <div className="scheduler-lane">
            <div className="scheduler-lane-head"><h4>{formatTaskTone('queue')}</h4><span>{queuedTasks.length}</span></div>
            <div className="scheduler-lane-list">{queuedTasks.length ? queuedTasks.map((item, index) => renderTaskCard(item, 'queue', index)) : <div className="auto-task-empty">暂无待调度任务</div>}</div>
          </div>
          <div className="scheduler-lane">
            <div className="scheduler-lane-head"><h4>{formatTaskTone('paused')}</h4><span>{pausedTasks.length}</span></div>
            <div className="scheduler-lane-list">{pausedTasks.length ? pausedTasks.map((item, index) => renderTaskCard(item, 'paused', index)) : <div className="auto-task-empty">暂无已暂停任务</div>}</div>
          </div>
          <div className="scheduler-lane">
            <div className="scheduler-lane-head"><h4>{formatTaskTone('done')}</h4><span>{doneTasks.length}</span></div>
            <div className="scheduler-lane-list">{doneTasks.length ? doneTasks.map((item, index) => renderTaskCard(item, 'done', index)) : <div className="auto-task-empty">暂无已完成任务</div>}</div>
          </div>
        </div>
      </section>

      <section className="scheduler-decisions-card">
        <div className="scheduler-section-title">最近处理判断</div>
        <div className="scheduler-decision-list">
          {recentDecisions.length ? recentDecisions.map((decision, index) => (
            <article className="scheduler-decision-item" key={`${decision.taskName}-${decision.timestamp}-${index}`}>
              <div className="scheduler-decision-top">
                <strong>{formatDecisionAction(decision.decision)}</strong>
                <span>{decision.timestamp}</span>
              </div>
              <p>{decision.taskName} · {decision.agent}</p>
              <small>{decision.reason} · {decision.detail}{decision.decision === 'retry' ? ` · 重试次数 ${decision.retryCount}` : ''}</small>
            </article>
          )) : <div className="auto-task-empty">暂无自动决策记录</div>}
        </div>
      </section>

      <section className="scheduler-decisions-card scheduler-pending-human-card">
        <div className="scheduler-section-title">待人工跟进</div>
        <div className="scheduler-decision-list">
          {humanPendingTasks.length ? humanPendingTasks.map((item, index) => {
            const latestDecision = [...(item.decision_log ?? [])].slice(-1)[0]
            return (
              <article className="scheduler-decision-item scheduler-human-item" key={`${item.task_name}-human-${index}`}>
                <div className="scheduler-decision-top">
                  <strong>{item.task_name}</strong>
                  <span>{item.domain ?? '-'}</span>
                </div>
                <p>原因：{latestDecision?.reason ?? '待人工处理'}</p>
                <small>负责人：{item.human_owner ?? '-'} · 最新判断：{latestDecision?.detail ?? item.manual_decision ?? '-'}</small>
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
      <div className="scheduler-section-title">群内回报</div>
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
            <pre>{notice.message || `【${notice.event_type === 'task_warning' ? '任务告警' : '任务完成'}】\n任务编号：${notice.task_id ?? '-'}\n任务名称：${notice.task_name}\n领域：${notice.domain}\n执行协作者：${notice.assigned_agent}\n状态：${formatTaskStatus(notice.status)}\n摘要：${notice.summary}\n👉 查看：/scheduler`}</pre>
            {notice.event_type === 'task_need_human' ? (
              <div className="auto-task-actions scheduler-human-actions">
                <button className="auto-task-row-btn" type="button" onClick={() => onGroupNotificationAction(notice, 'done')} disabled={controlsDisabled}>已处理</button>
                <button className="auto-task-row-btn" type="button" onClick={() => onGroupNotificationAction(notice, 'continue')} disabled={controlsDisabled}>继续执行</button>
                <button className="auto-task-row-btn" type="button" onClick={() => onGroupNotificationAction(notice, 'transfer')} disabled={controlsDisabled}>转人工</button>
              </div>
            ) : null}
            <small>{notice.task_id ?? '-'} · {notice.project_line ?? '-'} · {notice.notify_mode ?? '-'} · {notice.target_group_id ?? '-'} · {notice.delivery} · {notice.created_at}</small>
          </div>
        )) : <div className="auto-task-empty">暂无群内回报</div>}
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
      <div className="scheduler-section-title">系统提醒</div>
      <div className="scheduler-alert-group">
        <h4>连续失败事项</h4>
        {continuousFailedTasks.length ? continuousFailedTasks.map((item, index) => (
          <div className="scheduler-alert-item is-critical" key={`failed-${item.task_name}-${index}`}>{item.task_name} · {item.agent}</div>
        )) : <div className="auto-task-empty">暂无连续失败任务</div>}
      </div>
      <div className="scheduler-alert-group">
        <h4>卡住事项</h4>
        {stuckTasks.length ? stuckTasks.map((item, index) => (
          <div className="scheduler-alert-item is-warning" key={`stuck-${item.task_name}-${index}`}>{item.task_name} · {item.agent}</div>
        )) : <div className="auto-task-empty">暂无卡住任务</div>}
      </div>
      <div className="scheduler-alert-group">
        <h4>异常事项</h4>
        {abnormalTasks.length ? abnormalTasks.map((item, index) => (
          <div className="scheduler-alert-item is-abnormal" key={`abnormal-${item.task_name}-${index}`}>{item.task_name} · {item.agent}</div>
        )) : <div className="auto-task-empty">暂无异常或提醒任务</div>}
      </div>
      {systemAlerts.length > 0 ? (
        <div className="scheduler-alert-group">
          <h4>系统级提醒</h4>
          {systemAlerts.map((alert, index) => (
            <div className={`scheduler-alert-item is-${alert.level}`} key={`sys-alert-${index}`}>{alert.task_name || '-'} · {alert.agent || '-'} · {alert.reason}</div>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
