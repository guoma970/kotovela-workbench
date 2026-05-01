import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
        进入执行中枢查看任务进度
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
          <strong>查看详细检查项</strong>
        </summary>
        <div id="test-case-table" className="scheduler-routing-table-wrap scheduler-system-test-table-wrap">
          <table className="scheduler-routing-table scheduler-system-test-table">
            <thead>
              <tr>
                <th>样例编号</th>
                <th>检查对象</th>
                <th>输入事项</th>
                <th>期望判断</th>
                <th>系统输出</th>
                <th>结论</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {payload.cases.map((item) => (
                <tr key={item.case_id} className={item.result === 'fail' ? 'is-failed' : ''}>
                  <td>{item.case_id}</td>
                  <td>{formatModuleLabel(item.module)}</td>
                  <td>{item.input}</td>
                  <td>{item.expected}</td>
                  <td>{item.actual}</td>
                  <td>{item.result === 'pass' ? '通过' : '未通过'}</td>
                  <td>{item.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div id="defect-list" className="scheduler-routing-table-wrap scheduler-system-test-table-wrap">
          <table className="scheduler-routing-table scheduler-system-test-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>级别</th>
                <th>是否可复现</th>
                <th>建议处理</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {payload.defects.length ? (
                payload.defects.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.severity}</td>
                    <td>{item.reproducible}</td>
                    <td>{item.suggestion}</td>
                    <td>{item.note}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>当前没有待处理异常。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
