import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const outDir = path.resolve(process.env.SCREENSHOT_DIR ?? 'screenshots/dev67')
const prefix = process.env.SCREENSHOT_PREFIX ?? 'DEV-67'
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR ?? '.evidence/dev67')

fs.mkdirSync(outDir, { recursive: true })

const apiFixtures = {
  '/api/tasks-board': JSON.parse(fs.readFileSync(path.join(evidenceDir, 'dev67-tasks-board-api.json'), 'utf8')),
  '/api/leads': JSON.parse(fs.readFileSync(path.join(evidenceDir, 'dev67-leads-api.json'), 'utf8')),
  '/api/audit-log': JSON.parse(fs.readFileSync(path.join(evidenceDir, 'dev67-audit-log-api.json'), 'utf8')),
  '/api/system-mode': JSON.parse(fs.readFileSync(path.resolve('server/data/system-mode.internal.json'), 'utf8')),
}

const shots = [
  {
    path: '/tasks?focusType=task&focusId=task-2',
    file: `${prefix}-internal-tasks-routing-hints.png`,
    waitFor: '.consultant-evidence-card .inline-link-chip',
  },
  {
    path: '/leads',
    file: `${prefix}-internal-leads-routing-hints.png`,
    waitFor: '.consultant-evidence-card .inline-link-chip',
  },
  {
    path: '/system-control',
    file: `${prefix}-internal-system-control-routing-hints.png`,
    waitFor: '.consultant-evidence-card .inline-link-chip',
  },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1.5 })

await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url())
  const payload = apiFixtures[url.pathname]
  if (!payload) {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'fixture not found' }) })
    return
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
})

for (const shot of shots) {
  await page.goto(new URL(shot.path, baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.waitForSelector(shot.waitFor, { timeout: 15000 })
  await page.screenshot({ path: path.join(outDir, shot.file), fullPage: true })
}

await browser.close()
console.log(`Captured DEV-67 screenshots at ${outDir}`)
