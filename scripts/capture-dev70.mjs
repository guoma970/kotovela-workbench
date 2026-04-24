import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const outDir = path.resolve(process.env.SCREENSHOT_DIR ?? 'screenshots/dev70')
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR ?? '.evidence/dev70')
const mode = process.env.CAPTURE_MODE ?? 'internal'

fs.mkdirSync(outDir, { recursive: true })

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(evidenceDir, name), 'utf8'))
const apiFixtures = {
  '/api/tasks-board': readJson('dev70-tasks-board-api.json'),
  '/api/leads': readJson('dev70-leads-api.json'),
  '/api/audit-log': readJson('dev70-audit-log-api.json'),
  '/api/system-mode': JSON.parse(fs.readFileSync(path.resolve(`server/data/system-mode.${mode}.json`), 'utf8')),
}

const shots = mode === 'internal'
  ? [
      ['/dashboard', 'DEV-70-internal-dashboard-coverage.png', true],
      ['/leads', 'DEV-70-internal-leads-coverage.png', true],
      ['/system-control', 'DEV-70-internal-system-control-coverage.png', true],
    ]
  : [
      ['/dashboard', 'DEV-70-opensource-dashboard-isolation.png', false],
      ['/tasks', 'DEV-70-opensource-tasks-isolation.png', false],
    ]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1.5 })
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url())
  const payload = apiFixtures[url.pathname]
  await route.fulfill({ status: payload ? 200 : 404, contentType: 'application/json', body: JSON.stringify(payload ?? { message: 'fixture not found' }) })
})

for (const [routePath, filename, expectChips] of shots) {
  await page.goto(new URL(routePath, baseUrl).toString(), { waitUntil: 'networkidle' })
  if (expectChips) await page.waitForSelector('[data-evidence-link="true"]', { timeout: 15000 })
  else await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(outDir, filename), fullPage: true })
}

const evidenceChipCount = await page.evaluate(() => document.querySelectorAll('[data-evidence-link="true"]').length)
if (mode === 'opensource') {
  fs.writeFileSync(path.join(evidenceDir, 'mode-isolation-opensource.json'), JSON.stringify({ mode, evidence_chip_count: evidenceChipCount }, null, 2))
}

await browser.close()
console.log(`Captured DEV-70 ${mode} screenshots at ${outDir}`)
