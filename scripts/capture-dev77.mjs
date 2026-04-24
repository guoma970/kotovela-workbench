import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const outDir = path.resolve(process.env.SCREENSHOT_DIR ?? 'screenshots/dev77')
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR ?? '.evidence/dev77')
const mode = process.env.CAPTURE_MODE ?? 'internal'

fs.mkdirSync(outDir, { recursive: true })

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(evidenceDir, name), 'utf8'))
const apiFixtures = {
  '/api/tasks-board': readJson('dev77-tasks-board-api.json'),
  '/api/leads': readJson('dev77-leads-api.json'),
  '/api/audit-log': readJson('dev77-audit-log-api.json'),
  '/api/system-mode': JSON.parse(fs.readFileSync(path.resolve(`server/data/system-mode.${mode}.json`), 'utf8')),
  '/evidence/dev75/drift-trend.json': readJson('dev77-drift-trend.json'),
  '/evidence/dev76/drift-trend.json': readJson('dev77-drift-trend.json'),
  '/evidence/dev77/drift-trend.json': readJson('dev77-drift-trend.json'),
}

const shots = mode === 'internal'
  ? [
      ['/evidence-acceptance', 'DEV-77-internal-evidence-acceptance-overview.png', '[data-evidence-link="true"]'],
      ['/tasks', 'DEV-77-internal-tasks-split-evidence.png', 'body'],
      ['/leads', 'DEV-77-internal-leads-split-evidence.png', 'body'],
    ]
  : [
      ['/evidence-acceptance', 'DEV-77-opensource-evidence-isolation.png', '.page-note'],
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
  if (filename.includes('tasks-split')) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.42, behavior: 'auto' }))
    await page.waitForTimeout(400)
  }
  if (filename.includes('leads-split')) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.48, behavior: 'auto' }))
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: path.join(outDir, filename), fullPage: true })
}

await page.goto(new URL('/evidence-acceptance', baseUrl).toString(), { waitUntil: 'networkidle' })
await page.waitForSelector('body', { timeout: 15000 })
const evidenceChipCount = await page.evaluate(() => document.querySelectorAll('[data-evidence-link="true"]').length)
const driftCardCount = await page.evaluate(() => Array.from(document.querySelectorAll('.consultant-evidence-card strong')).filter((node) => String(node.textContent || '').startsWith('signal_map_')).length)
const structuredSignalMentions = await page.evaluate(() => document.body.textContent?.match(/source_line|account_line|content_line/g)?.length ?? 0)
fs.writeFileSync(path.join(evidenceDir, `mode-isolation-${mode}.json`), JSON.stringify({ mode, evidence_chip_count: evidenceChipCount, drift_card_count: driftCardCount, structured_signal_mentions: structuredSignalMentions }, null, 2))

await browser.close()
console.log(`Captured DEV-77 ${mode} screenshots at ${outDir}`)
