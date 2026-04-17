import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const boardFile = '/Users/ztl/OpenClaw-Runner/tasks-board.json'
const outDir = '/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/.evidence'
const baseUrl = 'http://127.0.0.1:5173/scheduler'
const now = () => new Date().toISOString()

const task = (task_name, status, priority, extra = {}) => ({
  task_name,
  agent: 'builder',
  domain: 'builder',
  subdomain: 'engineering',
  project_line: 'builder_default',
  target_group_id: 'builder_default',
  notify_mode: 'default',
  preferred_agent: 'builder',
  assigned_agent: 'builder',
  target_system: 'openclaw-builder',
  slot_id: null,
  priority,
  retry_count: 0,
  type: 'builder_task',
  status,
  timestamp: now(),
  updated_at: now(),
  queued_at: now(),
  attention: false,
  stuck: false,
  abnormal: false,
  auto_decision_log: [],
  decision_log: [],
  history: [{ action: 'create', operator: 'system', trigger_source: 'system', timestamp: now(), status_after: status, priority_after: priority }],
  ...extra,
})

const payload = (board) => ({
  generated_at: now(),
  tasks_file: boardFile,
  board,
  system_alerts: [],
  max_concurrency: 2,
  current_concurrency: 0,
  running_count: 0,
  queue_count: 0,
  failed_count: 0,
  abnormal_count: 0,
  pools: [],
  total: board.length,
  success: 0,
  failed: 0,
  recent_results: [],
})

const board = payload([
  task('客户方案依赖确认', 'done', 2, {
    result: { type: 'text', content: 'done', title: '执行结果', hook: 'done', outline: [], script: 'done', publish_text: 'done', generated_at: now(), generator: 'mock' },
  }),
  task('多依赖长链任务', 'queued', 2, { depends_on: ['客户方案依赖确认', '上游资源审批'], blocked_by: ['上游资源审批'] }),
  task('高失败率任务', 'failed', 2, {
    history: [
      { action: 'create', operator: 'system', trigger_source: 'system', timestamp: now(), status_after: 'queued', priority_after: 2 },
      { action: 'fail', operator: 'system', trigger_source: 'system', timestamp: now(), status_after: 'failed', priority_after: 2, error: 'x' },
      { action: 'retry', operator: 'system', trigger_source: 'rule_engine', timestamp: now(), status_before: 'failed', status_after: 'queued', priority_before: 2, priority_after: 2 },
      { action: 'fail', operator: 'system', trigger_source: 'system', timestamp: now(), status_after: 'failed', priority_after: 2, error: 'y' },
    ],
  }),
])

const original = await fs.readFile(boardFile, 'utf8')
await fs.mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 2400 } })

try {
  await fs.writeFile(boardFile, `${JSON.stringify(board, null, 2)}\n`, 'utf8')
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: path.join(outDir, 'dev-20260416-26-risk.png'), fullPage: true })

  const shots = [
    ['高失败率任务', 'dev-20260416-26-risk-card.png'],
    ['多依赖长链任务', 'dev-20260416-26-precheck-block.png'],
    ['果果学习任务', 'dev-20260416-26-auto-generated.png'],
  ]

  for (const [text, file] of shots) {
    const locator = page.locator('article.scheduler-task-card', { hasText: text }).first()
    await locator.scrollIntoViewIfNeeded()
    await locator.screenshot({ path: path.join(outDir, file) })
  }

  console.log('captured screenshots')
} finally {
  await fs.writeFile(boardFile, original, 'utf8')
  await browser.close()
}
