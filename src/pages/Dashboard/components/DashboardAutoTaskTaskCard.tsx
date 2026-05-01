import { Fragment } from 'react'
import type { AutoTaskBoardItem } from './DashboardAutoTaskPanel'

type TaskCardTone = 'running' | 'queue' | 'paused' | 'done'

type ControlAction = 'pause' | 'resume' | 'cancel' | 'priority_up' | 'priority_down'
type ManualAction = 'takeover' | 'assign' | 'ignore'

type DecisionLogEntry = NonNullable<AutoTaskBoardItem['decision_log']>[number]

function formatDecisionLogEntry(entry: DecisionLogEntry) {
  return `[${entry.timestamp}] ${entry.action} | ${entry.reason} | ${entry.detail}${entry.route_result ? ` | route_result=${entry.route_result}` : ''}${entry.route_target ? ` | route_target=${entry.route_target}` : ''}${entry.account_type ? ` | account_type=${entry.account_type}` : ''}${entry.tier ? ` | tier=${entry.tier}` : ''}${entry.brand_display ? ` | brand_display=${entry.brand_display}` : ''}${entry.mcn_display ? ` | mcn_display=${entry.mcn_display}` : ''}${typeof entry.can_close_deal === 'boolean' ? ` | can_close_deal=${entry.can_close_deal}` : ''}${entry.rule_hit_reason ? ` | rule_hit_reason=${entry.rule_hit_reason}` : ''}${entry.whitelist_hit ? ` | whitelist_hit=${entry.whitelist_hit}` : ''}${entry.block_reason ? ` | block_reason=${entry.block_reason}` : ''}${entry.partner_mode ? ` | partner_mode=${entry.partner_mode}` : ''}${entry.publish_rhythm_hit ? ` | publish_rhythm_hit=${entry.publish_rhythm_hit}` : ''}${entry.persona_hit ? ` | persona_hit=${entry.persona_hit}` : ''}${entry.publish_risk_warning?.length ? ` | publish_risk_warning=${entry.publish_risk_warning.join('/')}` : ''}${entry.memory_hit ? ` | memory_hit=${entry.memory_hit}` : ''}${entry.profile_rule ? ` | profile_rule=${entry.profile_rule}` : ''}`
}

function getRouteChain(item: AutoTaskBoardItem) {
  return [
    item.content_line ?? '-',
    item.brand_display ?? item.brand_line ?? '-',
    item.account_display ?? item.account_line ?? '-',
    item.route_result ?? '-',
    item.route_target ?? '-',
  ]
}

function getExternalPartnerMode(item: AutoTaskBoardItem): 'content_only' | 'consult_only' | 'no_delivery' | null {
  if (item.account_type !== 'external_partner') return null
  if ((item.decision_log ?? []).some((entry) => entry.partner_mode === 'consult_only')) return 'consult_only'
  if ((item.decision_log ?? []).some((entry) => entry.partner_mode === 'content_only')) return 'content_only'
  return item.domain === 'media' ? 'content_only' : 'no_delivery'
}

export function DashboardAutoTaskTaskCard({
  item,
  tone,
  index,
  showTechnicalDetails,
  expanded,
  copyState,
  controlLoadingTask,
  running,
  autoRetrying,
  onToggleExpanded,
  onCopyResult,
  onControlTask,
  onRetryTask,
  onManualControlTask,
}: {
  item: AutoTaskBoardItem
  tone: TaskCardTone
  index: number
  showTechnicalDetails: boolean
  expanded: boolean
  copyState: string
  controlLoadingTask: string
  running: boolean
  autoRetrying: boolean
  onToggleExpanded: (taskName: string) => void
  onCopyResult: (taskName: string, text: string) => void
  onControlTask: (taskName: string, action: ControlAction) => void
  onRetryTask: (taskName: string) => void
  onManualControlTask: (taskName: string, action: ManualAction) => void
}) {
  const isBusy = Boolean(controlLoadingTask)
  const updatedAt = item.updated_at || item.timestamp || item.queued_at || '-'
  const resultText = item.result?.content ?? ''
  const routeChain = getRouteChain(item)
  const externalPartnerMode = getExternalPartnerMode(item)
  const flags = [
    item.auto_generated ? 'auto_generated' : '',
    item.trigger_source ? `trigger_${item.trigger_source}` : '',
    item.predicted_risk ? `risk_${item.predicted_risk}` : '',
    item.predicted_block ? 'predicted_block' : '',
    item.attention ? 'attention' : '',
    item.stuck ? 'stuck' : '',
    item.abnormal ? 'abnormal' : '',
    item.need_human ? 'need_human' : '',
    item.auto_action ? `auto_${item.auto_action}` : '',
  ].filter(Boolean)
  const latestDecision = [...(item.decision_log ?? [])].slice(-1)[0]
  const blockReason = item.blocked_by?.length
    ? item.blocked_by.join(' / ')
    : latestDecision?.block_reason ?? latestDecision?.reason ?? (item.predicted_block ? '预测存在阻塞风险' : '-')
  const riskLabel = item.predicted_risk ?? (item.abnormal || item.stuck ? 'high' : item.need_human || blockReason !== '-' ? 'medium' : 'low')
  const suggestedAction = item.need_human
    ? '人工接管 / 指派负责人'
    : item.status === 'blocked' || item.predicted_block || (item.blocked_by?.length ?? 0) > 0
      ? '先解除阻塞，再恢复执行'
      : ['todo', 'queued', 'queue', 'pending', 'preparing'].includes(item.status)
        ? '确认优先级后等待调度'
        : ['doing', 'running'].includes(item.status)
          ? '观察执行结果，必要时暂停'
          : item.status === 'failed'
            ? '查看失败原因并重试'
            : '归档结果或进入详情复核'

  return (
    <article className={`scheduler-task-card scheduler-task-card-${tone}`} key={`${tone}-${item.task_name}-${index}`}>
      <div className="scheduler-task-top">
        <strong>{item.task_name}</strong>
        <span className={`scheduler-status scheduler-status-${item.status}`}>{item.status}</span>
      </div>
      <div className="scheduler-task-meta-grid scheduler-task-business-grid">
        <span>任务名：{item.task_name}</span>
        <span>当前状态：{item.status}</span>
        <span>阻塞原因：{blockReason}</span>
        <span>风险等级：{riskLabel}</span>
        <span>建议动作：{suggestedAction}</span>
        <span>负责人：{item.human_owner ?? item.assigned_agent ?? item.agent}</span>
      </div>
      <details className="scheduler-task-result-block" open={showTechnicalDetails}>
        <summary className="scheduler-task-result-head"><strong>展开详情 / 调试字段</strong></summary>
        <div className="scheduler-task-result-content">
          <div><span>agent</span><strong>{item.agent}</strong></div>
          <div><span>pool</span><strong>{item.instance_pool ?? '-'}</strong></div>
          <div><span>domain</span><strong>{item.domain ?? '-'}</strong></div>
          <div><span>parent_task_id</span><strong>{item.parent_task_id ?? '-'}</strong></div>
          <div><span>scenario_id</span><strong>{item.scenario_id ?? '-'}</strong></div>
          <div><span>task_group</span><strong>{item.task_group_label ?? '-'}</strong></div>
          <div><span>task_group_id</span><strong>{item.task_group_id ?? '-'}</strong></div>
          <div><span>template_source</span><strong>{item.template_source ?? item.template_key ?? '-'}</strong></div>
          <div><span>route_target</span><strong>{item.route_target ?? '-'}</strong></div>
          <div><span>route_result</span><strong>{item.route_result ?? '-'}</strong></div>
          <div><span>raw payload</span><pre>{JSON.stringify({ ...item, result: item.result ? '[result folded]' : undefined }, null, 2)}</pre></div>
          {item.decision_log?.length ? <div><span>decision_log</span><pre>{item.decision_log.map((entry) => formatDecisionLogEntry(entry)).join('\n')}</pre></div> : null}
        </div>
      </details>
      {item.depends_on?.length ? (
        <div className="scheduler-task-result-block">
          <div className="scheduler-task-result-head"><strong>依赖链路</strong></div>
          <div className="scheduler-task-result-content">
            <div><span>depends_on</span><strong>{item.depends_on.join(' -> ')}</strong></div>
            <div><span>blocked_by</span><strong>{item.blocked_by?.length ? item.blocked_by.join(', ') : '-'}</strong></div>
          </div>
        </div>
      ) : null}
      <div className="scheduler-task-result-block">
        <div className="scheduler-task-result-head"><strong>路由链路</strong></div>
        <div className="scheduler-route-chain">
          {routeChain.map((segment, routeIndex) => (
            <Fragment key={`${item.task_name}-route-${routeIndex}`}>
              <span className="scheduler-route-node">{segment}</span>
              {routeIndex < routeChain.length - 1 ? <span className="scheduler-route-arrow">→</span> : null}
            </Fragment>
          ))}
        </div>
        {externalPartnerMode ? (
          <div className="scheduler-partner-mode-row">
            <span className={`scheduler-partner-mode is-${externalPartnerMode}`}>external_partner · {externalPartnerMode}</span>
          </div>
        ) : null}
      </div>
      {flags.length > 0 ? (
        <div className="auto-task-flags">
          {flags.map((flag) => (
            <span className={`auto-task-flag is-${flag}`} key={`${item.task_name}-${flag}`}>
              {flag}
            </span>
          ))}
        </div>
      ) : null}
      {item.result ? (
        <div className="scheduler-task-result-block">
          <div className="scheduler-task-result-head">
            <strong>执行结果</strong>
            <div className="scheduler-task-result-actions">
              <button
                className="auto-task-row-btn"
                type="button"
                onClick={() => onToggleExpanded(item.task_name)}
              >
                {expanded ? '收起' : '展开'}
              </button>
              <button
                className="auto-task-row-btn"
                type="button"
                onClick={() => onCopyResult(item.task_name, resultText)}
              >
                {copyState === item.task_name ? '已复制' : '复制'}
              </button>
            </div>
          </div>
          {expanded ? (
            <div className="scheduler-task-result-content">
              <div><span>type</span><strong>{item.result.type}</strong></div>
              <div><span>content</span><pre>{item.result.content}</pre></div>
            </div>
          ) : null}
        </div>
      ) : null}
      {item.decision_log?.length && showTechnicalDetails ? (
        <div className="scheduler-task-result-block">
          <div className="scheduler-task-result-head"><strong>自动决策</strong></div>
          <div className="scheduler-task-result-content">
            <div><span>last_action</span><strong>{item.auto_action ?? '-'}</strong></div>
            <div><span>memory_hits</span><strong>{item.memory_hits?.join(', ') || '-'}</strong></div>
            <div><span>profile_tags</span><strong>{item.profile_tags?.join(', ') || '-'}</strong></div>
            <div><span>decision_log</span><pre>{item.decision_log.map((entry) => formatDecisionLogEntry(entry)).join('\n')}</pre></div>
            <div><span>decision_detail</span>
              <div className="scheduler-decision-detail-list">
                {item.decision_log.map((entry, entryIndex) => (
                  <article className="scheduler-decision-detail-card" key={`${item.task_name}-decision-${entryIndex}`}>
                    <strong>{entry.action}</strong>
                    <p>规则命中原因: {entry.rule_hit_reason ?? entry.reason}</p>
                    <p>白名单命中: {entry.whitelist_hit ?? '-'}</p>
                    <p>拦截原因: {entry.block_reason ?? '-'}</p>
                    {entry.partner_mode ? <p>external_partner: {entry.partner_mode}</p> : null}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="scheduler-task-foot">
        <span>{updatedAt}</span>
        <div className="auto-task-actions">
          {tone === 'running' ? (
            <>
              <button className="auto-task-row-btn" type="button" onClick={() => onControlTask(item.task_name, 'pause')} disabled={running || isBusy}>
                {controlLoadingTask === `${item.task_name}:pause` ? '执行中...' : '暂停'}
              </button>
              <button className="auto-task-row-btn" type="button" onClick={() => onControlTask(item.task_name, 'cancel')} disabled={running || isBusy}>
                {controlLoadingTask === `${item.task_name}:cancel` ? '执行中...' : '取消'}
              </button>
            </>
          ) : null}
          {tone === 'queue' ? (
            <>
              <button className="auto-task-row-btn" type="button" onClick={() => onControlTask(item.task_name, 'priority_up')} disabled={running || isBusy}>
                {controlLoadingTask === `${item.task_name}:priority_up` ? '执行中...' : '提优先级'}
              </button>
              <button className="auto-task-row-btn" type="button" onClick={() => onControlTask(item.task_name, 'priority_down')} disabled={running || isBusy}>
                {controlLoadingTask === `${item.task_name}:priority_down` ? '执行中...' : '降优先级'}
              </button>
            </>
          ) : null}
          {tone === 'paused' ? (
            <button className="auto-task-row-btn" type="button" onClick={() => onControlTask(item.task_name, 'resume')} disabled={running || isBusy}>
              {controlLoadingTask === `${item.task_name}:resume` ? '执行中...' : '恢复'}
            </button>
          ) : null}
          {tone === 'done' && item.status === 'failed' ? (
            <button className="auto-task-row-btn" type="button" onClick={() => onRetryTask(item.task_name)} disabled={running || isBusy}>
              {autoRetrying ? '自动重试中...' : '重试'}
            </button>
          ) : null}
          {item.need_human ? (
            <>
              <button className="auto-task-row-btn" type="button" onClick={() => onManualControlTask(item.task_name, 'takeover')} disabled={running || isBusy}>
                {controlLoadingTask === `${item.task_name}:takeover` ? '执行中...' : '接管'}
              </button>
              <button className="auto-task-row-btn" type="button" onClick={() => onManualControlTask(item.task_name, 'assign')} disabled={running || isBusy}>
                {controlLoadingTask === `${item.task_name}:assign` ? '执行中...' : '指派'}
              </button>
              <button className="auto-task-row-btn" type="button" onClick={() => onManualControlTask(item.task_name, 'ignore')} disabled={running || isBusy}>
                {controlLoadingTask === `${item.task_name}:ignore` ? '执行中...' : '忽略'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  )
}
