import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const outDir = path.resolve(process.env.SCREENSHOT_DIR ?? 'screenshots/dev75')
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR ?? '.evidence/dev75')
const mode = process.env.CAPTURE_MODE ?? 'internal'

fs.mkdirSync(outDir, { recursive: true })

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(evidenceDir, name), 'utf8'))
const apiFixtures = {
  '/api/tasks-board': readJson('dev75-tasks-board-api.json'),
  '/api/leads': readJson('dev75-leads-api.json'),
  '/api/audit-log': readJson('dev75-audit-log-api.json'),
  '/api/system-mode': JSON.parse(fs.readFileSync(path.resolve(`server/data/system-mode.${mode}.json`), 'utf8')),
  '/evidence/dev75/drift-trend.json': readJson('dev75-drift-trend.json'),
}

const shots = mode === 'internal'
  ? [
      ['/evidence-acceptance', 'DEV-75-internal-evidence-acceptance-overview.png', '[data-evidence-link="true"]'],
      ['/evidence-acceptance', 'DEV-75-internal-heuristic-drift-alert.png', '.consultant-evidence-list.top-gap'],
      ['/evidence-acceptance', 'DEV-75-internal-evidence-unresolved.png', '.evidence-unresolved-list'],
    ]
  : [
      ['/evidence-acceptance', 'DEV-75-opensource-evidence-isolation.png', '.page-note'],
    ]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1.5 })
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  const payload = apiFixtures[url.pathname]
  if (!payload) return route.continue()
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
})

for (const [routePath, filename, waitFor] of shots) {
  await page.goto(new URL(routePath, baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.waitForSelector(waitFor, { timeout: 15000 })
  if (filename.includes('heuristic-drift')) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.16, behavior: 'auto' }))
    await page.waitForTimeout(400)
  }
  if (filename.includes('unresolved')) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.42, behavior: 'auto' }))
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: path.join(outDir, filename), fullPage: true })
}

const evidenceChipCount = await page.evaluate(() => document.querySelectorAll('[data-evidence-link="true"]').length)
const driftCardCount = await page.evaluate(() => Array.from(document.querySelectorAll('.consultant-evidence-card strong')).filter((node) => String(node.textContent || '').startsWith('signal_map_')).length)
fs.writeFileSync(path.join(evidenceDir, `mode-isolation-${mode}.json`), JSON.stringify({ mode, evidence_chip_count: evidenceChipCount, drift_card_count: driftCardCount }, null, 2))

await browser.close()
console.log(`Captured DEV-75 ${mode} screenshots at ${outDir}`)
