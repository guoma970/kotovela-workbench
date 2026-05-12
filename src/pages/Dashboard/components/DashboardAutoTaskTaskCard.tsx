import { Fragment } from 'react'
import type { AutoTaskBoardItem, TaskCardTone } from '../lib/autoTaskShared'
import {
  formatAccountLine,
  formatAccountType,
  formatAutoAction,
  formatBrandLine,
  formatContentLine,
  formatPartnerMode,
  formatPoolKey,
  formatRiskLevel,
  formatRouteResult,
  formatRouteTarget,
  formatScenarioTemplate,
  formatTaskStatus,
} from '../lib/autoTaskLabels'
import { formatReadableDetail, formatReadableOwner, formatReadableTaskTitle, formatReadableTime } from '../../../lib/readableText'

type ControlAction = 'pause' | 'resume' | 'cancel' | 'priority_up' | 'priority_down'
type ManualAction = 'takeover' | 'assign' | 'ignore'

type DecisionLogEntry = NonNullable<AutoTaskBoardItem['decision_log']>[number]

function formatDecisionLogEntry(entry: DecisionLogEntry) {
  return `[${formatReadableTime(entry.timestamp)}] ${formatReadableDetail(entry.action)} | ${formatReadableDetail(entry.reason)} | ${formatReadableDetail(entry.detail)}${entry.route_result ? ` | 去向判断=${formatRouteResult(entry.route_result)}` : ''}${entry.route_target ? ` | 分配去向=${formatRouteTarget(entry.route_target)}` : ''}${entry.account_type ? ` | 账号类型=${formatAccountType(entry.account_type)}` : ''}${entry.tier ? ` | 档位=${formatReadableDetail(entry.tier)}` : ''}${entry.brand_display ? ` | 品牌=${entry.brand_display}` : ''}${entry.mcn_display ? ` | 机构=${entry.mcn_display}` : ''}${typeof entry.can_close_deal === 'boolean' ? ` | 可成交=${entry.can_close_deal ? '是' : '否'}` : ''}${entry.rule_hit_reason ? ` | 命中原因=${formatReadableDetail(entry.rule_hit_reason)}` : ''}${entry.whitelist_hit ? ` | 放行规则=${formatReadableDetail(entry.whitelist_hit)}` : ''}${entry.block_reason ? ` | 暂停原因=${formatReadableDetail(entry.block_reason)}` : ''}${entry.partner_mode ? ` | 合作方式=${formatPartnerMode(entry.partner_mode)}` : ''}${entry.publish_rhythm_hit ? ` | 发布节奏=${formatReadableDetail(entry.publish_rhythm_hit)}` : ''}${entry.persona_hit ? ` | 人设=${formatReadableDetail(entry.persona_hit)}` : ''}${entry.publish_risk_warning?.length ? ` | 发布提醒=${entry.publish_risk_warning.map((item) => formatReadableDetail(item)).join('/')}` : ''}${entry.memory_hit ? ` | 记忆命中=${formatReadableDetail(entry.memory_hit)}` : ''}${entry.profile_rule ? ` | 画像规则=${formatReadableDetail(entry.profile_rule)}` : ''}`
}

function getRouteChain(item: AutoTaskBoardItem) {
  return [
    formatContentLine(item.content_line),
    item.brand_display ?? formatBrandLine(item.brand_line),
    item.account_display ?? formatAccountLine(item.account_line),
    formatRouteResult(item.route_result),
    formatRouteTarget(item.route_target),
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
  const updatedAt = formatReadableTime(item.updated_at || item.timestamp || item.queued_at)
  const resultText = item.result?.content ?? ''
  const routeChain = getRouteChain(item)
  const externalPartnerMode = getExternalPartnerMode(item)
  const flags = [
    item.auto_generated ? '自动生成' : '',
    item.trigger_source ? `来源：${formatReadableDetail(item.trigger_source)}` : '',
    item.predicted_risk ? `风险：${formatRiskLevel(item.predicted_risk)}` : '',
    item.predicted_block ? '预测卡住' : '',
    item.attention ? '需要关注' : '',
    item.stuck ? '任务卡住' : '',
    item.abnormal ? '发现异常' : '',
    item.need_human ? '待人工处理' : '',
    item.auto_action ? formatAutoAction(item.auto_action) : '',
  ].filter(Boolean)
  const latestDecision = [...(item.decision_log ?? [])].slice(-1)[0]
  const blockReason = item.blocked_by?.length
    ? item.blocked_by.map((entry) => formatReadableTaskTitle(entry)).join(' / ')
    : formatReadableDetail(latestDecision?.block_reason ?? latestDecision?.reason ?? (item.predicted_block ? '预测存在阻塞风险' : '-'), '暂无卡点')
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
        <strong>{formatReadableTaskTitle(item.task_name)}</strong>
        <span className={`scheduler-status scheduler-status-${item.status}`}>{formatTaskStatus(item.status)}</span>
      </div>
      <div className="scheduler-task-meta-grid scheduler-task-business-grid">
        <span>任务内容：{formatReadableTaskTitle(item.task_name)}</span>
        <span>当前状态：{formatTaskStatus(item.status)}</span>
        <span>阻塞原因：{blockReason}</span>
        <span>风险等级：{formatRiskLevel(riskLabel)}</span>
        <span>建议动作：{suggestedAction}</span>
        <span>负责人：{formatReadableOwner(item.human_owner ?? item.assigned_agent ?? item.agent)}</span>
      </div>
      <details className="scheduler-task-result-block" open={showTechnicalDetails}>
        <summary className="scheduler-task-result-head"><strong>分配与执行摘要</strong></summary>
        <div className="scheduler-task-result-content">
          <div><span>执行同事</span><strong>{formatReadableOwner(item.agent)}</strong></div>
          <div><span>协作池</span><strong>{formatPoolKey(item.instance_pool)}</strong></div>
          <div><span>领域</span><strong>{formatReadableDetail(item.domain)}</strong></div>
          <div><span>任务组</span><strong>{formatReadableTaskTitle(item.task_group_label)}</strong></div>
          <div><span>模板来源</span><strong>{formatReadableTaskTitle(item.template_source ?? formatScenarioTemplate(item.template_key), '暂未同步')}</strong></div>
          <div><span>分配去向</span><strong>{formatRouteTarget(item.route_target)}</strong></div>
          <div><span>去向判断</span><strong>{formatRouteResult(item.route_result)}</strong></div>
        </div>
        <details className="scheduler-task-result-block">
          <summary className="scheduler-task-result-head"><strong>查看排障字段</strong></summary>
          <div className="scheduler-task-result-content">
            <div><span>父任务编号</span><strong>{item.parent_task_id ?? '-'}</strong></div>
            <div><span>场景编号</span><strong>{item.scenario_id ?? '-'}</strong></div>
            <div><span>任务组编号</span><strong>{item.task_group_id ?? '-'}</strong></div>
          </div>
        </details>
        <details className="scheduler-task-result-block">
          <summary className="scheduler-task-result-head"><strong>查看原始记录</strong></summary>
          <div className="scheduler-task-result-content">
            <div><span>原始记录</span><pre>{JSON.stringify({ ...item, result: item.result ? '[result folded]' : undefined }, null, 2)}</pre></div>
          </div>
        </details>
        {item.decision_log?.length ? (
          <details className="scheduler-task-result-block">
            <summary className="scheduler-task-result-head"><strong>查看原始处理日志</strong></summary>
            <div className="scheduler-task-result-content">
              <div><span>原始处理日志</span><pre>{item.decision_log.map((entry) => formatDecisionLogEntry(entry)).join('\n')}</pre></div>
            </div>
          </details>
        ) : null}
      </details>
      {item.depends_on?.length ? (
        <div className="scheduler-task-result-block">
          <div className="scheduler-task-result-head"><strong>前后关系</strong></div>
          <div className="scheduler-task-result-content">
            <div><span>前置事项</span><strong>{item.depends_on.map((entry) => formatReadableTaskTitle(entry)).join(' → ')}</strong></div>
            <div><span>卡点来源</span><strong>{item.blocked_by?.length ? item.blocked_by.map((entry) => formatReadableTaskTitle(entry)).join('、') : '-'}</strong></div>
          </div>
        </div>
      ) : null}
      <div className="scheduler-task-result-block">
        <div className="scheduler-task-result-head"><strong>去向链路</strong></div>
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
            <span className={`scheduler-partner-mode is-${externalPartnerMode}`}>外部合作方 · {formatPartnerMode(externalPartnerMode)}</span>
          </div>
        ) : null}
      </div>
      {flags.length > 0 ? (
        <div className="auto-task-flags">
          {flags.map((flag, flagIndex) => (
            <span className={`auto-task-flag is-${flag}`} key={`${item.task_name}-${flag}-${flagIndex}`}>
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
              <div><span>结果类型</span><strong>{formatReadableDetail(item.result.type)}</strong></div>
              <div><span>结果内容</span><pre>{item.result.content}</pre></div>
            </div>
          ) : null}
        </div>
      ) : null}
      {item.decision_log?.length && showTechnicalDetails ? (
        <div className="scheduler-task-result-block">
          <div className="scheduler-task-result-head"><strong>自动判断</strong></div>
          <div className="scheduler-task-result-content">
            <div><span>最近处理</span><strong>{formatAutoAction(item.auto_action)}</strong></div>
            <div><span>账号类型</span><strong>{formatAccountType(item.account_type)}</strong></div>
            <div><span>命中记忆</span><strong>{item.memory_hits?.map((entry) => formatReadableDetail(entry)).join('、') || '-'}</strong></div>
            <div><span>人设标签</span><strong>{item.profile_tags?.map((entry) => formatReadableDetail(entry)).join('、') || '-'}</strong></div>
            <div><span>判断细节</span>
              <div className="scheduler-decision-detail-list">
                {item.decision_log.map((entry, entryIndex) => (
                  <article className="scheduler-decision-detail-card" key={`${item.task_name}-decision-${entryIndex}`}>
                    <strong>{formatAutoAction(entry.action as AutoTaskBoardItem['auto_action']) || formatReadableDetail(entry.action)}</strong>
                    <p>命中原因：{formatReadableDetail(entry.rule_hit_reason ?? entry.reason)}</p>
                    <p>放行规则：{formatReadableDetail(entry.whitelist_hit)}</p>
                    <p>暂停原因：{formatReadableDetail(entry.block_reason)}</p>
                    {entry.partner_mode ? <p>外部合作方式：{formatPartnerMode(entry.partner_mode)}</p> : null}
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
