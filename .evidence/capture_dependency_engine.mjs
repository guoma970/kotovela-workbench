import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const boardFile = '/Users/ztl/OpenClaw-Runner/tasks-board.json'
const outDir = '/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/.evidence'
const baseUrl = 'http://127.0.0.1:5173/scheduler'

const now = () => new Date().toISOString()

function payload(board) {
  return {
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
  }
}

function baseTask(task_name, status, priority, extra = {}) {
  const timestamp = now()
  return {
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
    timestamp,
    updated_at: timestamp,
    queued_at: timestamp,
    attention: false,
    stuck: false,
    abnormal: false,
    auto_decision_log: [],
    decision_log: [],
    history: [{ action: 'create', operator: 'system', trigger_source: 'system', timestamp, status_after: status, priority_after: priority }],
    ...extra,
  }
}

const stateBlocked = payload([
  baseTask('依赖链路-A', 'running', 1, {
    slot_active: true,
    slot_id: 'builder-slot-1',
    history: [
      { action: 'create', operator: 'system', trigger_source: 'system', timestamp: now(), status_after: 'queued', priority_after: 1 },
      { action: 'run', operator: 'system', trigger_source: 'system', timestamp: now(), status_before: 'queued', status_after: 'running', priority_before: 1, priority_after: 1 },
    ],
  }),
  baseTask('依赖链路-B', 'queued', 2, { depends_on: ['依赖链路-A'] }),
  baseTask('依赖链路-C', 'queued', 3, { depends_on: ['依赖链路-B'] }),
])

const stateTrigger = payload([
  baseTask('依赖链路-A', 'done', 1, {
    result: {
      type: 'text',
      content: 'A done',
      title: '执行结果',
      hook: 'A done',
      outline: [],
      script: 'A done',
      publish_text: 'A done',
      generated_at: now(),
      generator: 'mock',
    },
    history: [
      { action: 'create', operator: 'system', trigger_source: 'system', timestamp: now(), status_after: 'queued', priority_after: 1 },
      { action: 'run', operator: 'system', trigger_source: 'system', timestamp: now(), status_before: 'queued', status_after: 'running', priority_before: 1, priority_after: 1 },
      { action: 'run', operator: 'system', trigger_source: 'system', timestamp: now(), status_before: 'running', status_after: 'done', priority_before: 1, priority_after: 1 },
    ],
  }),
  baseTask('依赖链路-B', 'queued', 2, { depends_on: ['依赖链路-A'] }),
  baseTask('依赖链路-C', 'queued', 3, { depends_on: ['依赖链路-B'] }),
])

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function waitForSettled(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.setViewportSize({ width: 1600, height: 2200 })
  await page.waitForTimeout(1500)
}

const original = await fs.readFile(boardFile, 'utf8')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

try {
  await fs.mkdir(outDir, { recursive: true })

  await writeJson(boardFile, stateBlocked)
  await waitForSettled(page)
  await page.screenshot({ path: path.join(outDir, 'dev-20260416-22-blocked.png'), fullPage: true })

  await writeJson(boardFile, stateTrigger)
  await waitForSettled(page)
  await page.screenshot({ path: path.join(outDir, 'dev-20260416-22-auto-trigger.png'), fullPage: true })

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(outDir, 'dev-20260416-22-chain-complete.png'), fullPage: true })
} finally {
  await fs.writeFile(boardFile, original, 'utf8')
  await browser.close()
}
