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
        <h3>任务调度系统</h3>
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
        进入 Scheduler 查看队列与待人工
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
    <section className="scheduler-system-test-panel" aria-label="系统测试结果">
      <div className="scheduler-section-title">系统测试结果</div>
      <div id="system-test-summary" className="scheduler-system-test-summary">
        <div className="scheduler-overview-grid">
          <div className="scheduler-overview-metric">
            <span>total cases</span>
            <strong>{payload.summary.total_cases}</strong>
          </div>
          <div className="scheduler-overview-metric">
            <span>pass</span>
            <strong>{payload.summary.pass}</strong>
          </div>
          <div className="scheduler-overview-metric is-failed">
            <span>fail</span>
            <strong>{payload.summary.fail}</strong>
          </div>
          <div className="scheduler-overview-metric is-warning">
            <span>failed modules</span>
            <strong>{payload.summary.failed_modules.join(' / ') || 'none'}</strong>
          </div>
        </div>
      </div>
      <div id="test-case-table" className="scheduler-routing-table-wrap scheduler-system-test-table-wrap">
        <table className="scheduler-routing-table scheduler-system-test-table">
          <thead>
            <tr>
              <th>case_id</th>
              <th>module</th>
              <th>input</th>
              <th>expected</th>
              <th>actual</th>
              <th>result</th>
              <th>note</th>
            </tr>
          </thead>
          <tbody>
            {payload.cases.map((item) => (
              <tr key={item.case_id} className={item.result === 'fail' ? 'is-failed' : ''}>
                <td>{item.case_id}</td>
                <td>{item.module}</td>
                <td>{item.input}</td>
                <td>{item.expected}</td>
                <td>{item.actual}</td>
                <td>{item.result}</td>
                <td>{item.note || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div id="defect-list" className="scheduler-routing-table-wrap scheduler-system-test-table-wrap">
        <table className="scheduler-routing-table scheduler-system-test-table">
          <thead>
            <tr>
              <th>id</th>
              <th>severity</th>
              <th>reproducible</th>
              <th>suggestion</th>
              <th>note</th>
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
                <td colSpan={5}>无缺陷</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
