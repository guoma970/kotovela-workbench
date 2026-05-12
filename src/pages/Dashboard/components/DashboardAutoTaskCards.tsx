import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatReadableDetail, formatReadableTaskTitle } from '../../../lib/readableText'

type AutoTaskBoardSummaryPayload = {
  total?: number
  success?: number
  failed?: number
}

type SystemTestPayload = {
  summary: {
    total_cases: number
    pass: number
    fail: number
    failed_modules: string[]
  }
  cases: Array<{
    case_id: string
    module: string
    input: string
    expected: string
    actual: string
    result: 'pass' | 'fail'
    note?: string
  }>
  defects: Array<{
    id: string
    severity: 'P0' | 'P1' | 'P2'
    reproducible: string
    suggestion: string
    note: string
  }>
}

const MODULE_LABELS: Record<string, string> = {
  scheduler: '执行分配',
  content: '内容处理',
  business: '业务跟进',
  media: '内容协作',
  builder: '研发执行',
}

const formatModuleLabel = (value?: string) => {
  if (!value) return '未标注'
  return MODULE_LABELS[value] ?? value.replace(/[._-]+/g, ' ')
}

const SYSTEM_TEST_FIELD_LABELS: Record<string, string> = {
  account_line: '账号线索',
  content_line: '内容线索',
  domain: '领域',
  project_line: '项目线索',
  status: '状态',
  tasks: '任务数',
  priority: '优先级',
  route_target: '分配去向',
  route_result: '去向判断',
}

const formatSystemTestField = (value: string) =>
  SYSTEM_TEST_FIELD_LABELS[value] ?? formatReadableDetail(value)

const formatSystemTestValue = (value?: string) => {
  if (!value || value === '-') return '无'

  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed as Record<string, unknown>)
        .map(([key, item]) => `${formatSystemTestField(key)}：${formatReadableDetail(String(item ?? '无'))}`)
        .join('；')
    }
  } catch {
    // Plain text from the fixture, fall through to readable formatting.
  }

  return formatReadableDetail(value)
}

export function AutoTaskSystemSummaryCard() {
  const navigate = useNavigate()
  const [data, setData] = useState<AutoTaskBoardSummaryPayload | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/tasks-board', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) {
          setData((json as AutoTaskBoardSummaryPayload | null) ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="home-section panel strong-card auto-task-summary-card">
      <div className="home-section-head">
        <h3>执行系统概览</h3>
        <span className="home-count">{data?.total ?? 0}</span>
      </div>
      <div className="auto-task-overview">
        <div className="auto-task-metric">
          <span>任务总数</span>
          <strong>{data?.total ?? 0}</strong>
        </div>
        <div className="auto-task-metric">
          <span>已成功</span>
          <strong>{data?.success ?? 0}</strong>
        </div>
        <div className={`auto-task-metric ${(data?.failed ?? 0) > 0 ? 'is-failed' : ''}`}>
          <span>失败/需关注</span>
          <strong>{data?.failed ?? 0}</strong>
        </div>
      </div>
      <button className="auto-task-go-btn" type="button" onClick={() => navigate('/scheduler')}>
        进入自动化查看任务进度
      </button>
    </section>
  )
}

export function SystemTestResultPanel() {
  const [payload, setPayload] = useState<SystemTestPayload | null>(null)

  useEffect(() => {
    fetch('/system-test-results.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setPayload(json as SystemTestPayload | null))
      .catch(() => setPayload(null))
  }, [])

  if (!payload) return null

  return (
    <section className="scheduler-system-test-panel" aria-label="系统健康检查">
      <div className="scheduler-section-title">系统健康检查</div>
      <p className="page-note">用于确认最近一轮更新后，核心分配、执行和结果回写是否仍然正常。</p>
      <div id="system-test-summary" className="scheduler-system-test-summary">
        <div className="scheduler-overview-grid">
          <div className="scheduler-overview-metric">
            <span>检查项总数</span>
            <strong>{payload.summary.total_cases}</strong>
          </div>
          <div className="scheduler-overview-metric">
            <span>通过</span>
            <strong>{payload.summary.pass}</strong>
          </div>
          <div className="scheduler-overview-metric is-failed">
            <span>未通过</span>
            <strong>{payload.summary.fail}</strong>
          </div>
          <div className="scheduler-overview-metric is-warning">
            <span>受影响模块</span>
            <strong>{payload.summary.failed_modules.join(' / ') || '无'}</strong>
          </div>
        </div>
      </div>
      <details className="scheduler-debug-block">
        <summary className="scheduler-task-result-head">
          <strong>展开检查明细（研发排障用）</strong>
        </summary>
        <div id="test-case-table" className="scheduler-system-test-case-list">
          {payload.cases.map((item) => (
            <article key={item.case_id} className={`scheduler-system-test-case ${item.result === 'fail' ? 'is-failed' : ''}`}>
              <div className="scheduler-system-test-case-top">
                <strong>{formatReadableTaskTitle(item.input)}</strong>
                <span>{item.result === 'pass' ? '通过' : '未通过'}</span>
              </div>
              <div className="scheduler-system-test-case-grid">
                <div>
                  <span>检查编号</span>
                  <strong>{item.case_id}</strong>
                </div>
                <div>
                  <span>检查对象</span>
                  <strong>{formatModuleLabel(item.module)}</strong>
                </div>
                <div>
                  <span>期望判断</span>
                  <strong>{formatSystemTestValue(item.expected)}</strong>
                </div>
                <div>
                  <span>系统输出</span>
                  <strong>{formatSystemTestValue(item.actual)}</strong>
                </div>
              </div>
              <p>{item.note ? formatReadableDetail(item.note) : '无补充说明'}</p>
            </article>
          ))}
        </div>
        <div id="defect-list" className="scheduler-system-test-case-list">
          {payload.defects.length ? (
            payload.defects.map((item) => (
              <article key={item.id} className="scheduler-system-test-case is-failed">
                <div className="scheduler-system-test-case-top">
                  <strong>{item.id}</strong>
                  <span>{item.severity}</span>
                </div>
                <p>是否可复现：{formatReadableDetail(item.reproducible)}</p>
                <p>建议处理：{formatReadableDetail(item.suggestion)}</p>
                <p>备注：{formatReadableDetail(item.note)}</p>
              </article>
            ))
          ) : (
            <div className="auto-task-empty">当前没有待处理异常。</div>
          )}
        </div>
      </details>
    </section>
  )
}
