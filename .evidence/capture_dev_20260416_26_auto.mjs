import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const boardFile = '/Users/ztl/OpenClaw-Runner/tasks-board.json'
const outDir = '/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/.evidence'
const baseUrl = 'http://127.0.0.1:5173/scheduler'
const now = () => new Date().toISOString()
const board = {
  generated_at: now(),
  tasks_file: boardFile,
  board: [{ task_name: '客户方案依赖确认', agent: 'builder', domain: 'builder', subdomain: 'engineering', project_line: 'builder_default', target_group_id: 'builder_default', notify_mode: 'default', preferred_agent: 'builder', assigned_agent: 'builder', target_system: 'openclaw-builder', slot_id: null, priority: 2, retry_count: 0, type: 'builder_task', status: 'done', timestamp: now(), updated_at: now(), queued_at: now(), attention: false, stuck: false, abnormal: false, auto_decision_log: [], decision_log: [], history: [{ action: 'create', operator: 'system', trigger_source: 'system', timestamp: now(), status_after: 'done', priority_after: 2 }] }],
}
const original = await fs.readFile(boardFile, 'utf8')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 2400 } })
try {
  await fs.writeFile(boardFile, `${JSON.stringify(board, null, 2)}\n`, 'utf8')
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(4000)
  await page.locator('.scheduler-pool-card', { hasText: 'Family' }).first().click()
  await page.waitForTimeout(1500)
  const locator = page.locator('article.scheduler-task-card', { hasText: '果果学习任务' }).first()
  await locator.waitFor({ timeout: 10000 })
  await locator.scrollIntoViewIfNeeded()
  await locator.screenshot({ path: path.join(outDir, 'dev-20260416-26-auto-generated.png') })
  console.log('captured auto')
} finally {
  await fs.writeFile(boardFile, original, 'utf8')
  await browser.close()
}
