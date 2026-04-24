import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const outDir = path.resolve(process.env.SCREENSHOT_DIR ?? 'screenshots/dev69')
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR ?? '.evidence/dev69')
const mode = process.env.CAPTURE_MODE ?? 'internal'

fs.mkdirSync(outDir, { recursive: true })

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(evidenceDir, name), 'utf8'))
const apiFixtures = {
  '/api/tasks-board': readJson('dev69-tasks-board-api.json'),
  '/api/leads': readJson('dev69-leads-api.json'),
  '/api/audit-log': readJson('dev69-audit-log-api.json'),
  '/api/system-mode': JSON.parse(fs.readFileSync(path.resolve(`server/data/system-mode.${mode}.json`), 'utf8')),
}

const shots = mode === 'internal'
  ? [
      ['/dashboard', 'DEV-69-internal-dashboard-evidence-coverage.png', '[data-evidence-link="true"]'],
      ['/system-control', 'DEV-69-internal-system-control-evidence-coverage.png', '[data-evidence-link="true"]'],
    ]
  : [
      ['/', 'DEV-69-opensource-dashboard-isolation.png', 'body'],
      ['/tasks', 'DEV-69-opensource-tasks-isolation.png', 'body'],
    ]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1.5 })
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url())
  const payload = apiFixtures[url.pathname]
  await route.fulfill({ status: payload ? 200 : 404, contentType: 'application/json', body: JSON.stringify(payload ?? { message: 'fixture not found' }) })
})

for (const [routePath, filename, waitFor] of shots) {
  await page.goto(new URL(routePath, baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.waitForSelector(waitFor, { timeout: 15000 })
  await page.screenshot({ path: path.join(outDir, filename), fullPage: true })
}

const evidenceChipCount = await page.evaluate(() => document.querySelectorAll('[data-evidence-link="true"]').length)
fs.writeFileSync(path.join(evidenceDir, mode === 'internal' ? 'internal-evidence-count.json' : 'mode-isolation-opensource.json'), JSON.stringify({ mode, evidence_chip_count: evidenceChipCount }, null, 2))

await browser.close()
console.log(`Captured DEV-69 ${mode} screenshots at ${outDir}`)
