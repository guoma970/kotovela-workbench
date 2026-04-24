import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const outDir = path.resolve(process.env.SCREENSHOT_DIR ?? 'screenshots/dev68')
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR ?? '.evidence/dev68')

fs.mkdirSync(outDir, { recursive: true })

const apiFixtures = {
  '/api/tasks-board': JSON.parse(fs.readFileSync(path.join(evidenceDir, 'dev68-tasks-board-api.json'), 'utf8')),
  '/api/leads': JSON.parse(fs.readFileSync(path.join(evidenceDir, 'dev68-leads-api.json'), 'utf8')),
  '/api/audit-log': JSON.parse(fs.readFileSync(path.join(evidenceDir, 'dev68-audit-log-api.json'), 'utf8')),
  '/api/system-mode': JSON.parse(fs.readFileSync(path.resolve('server/data/system-mode.internal.json'), 'utf8')),
}

const shots = [
  ['/dashboard', 'DEV-68-internal-dashboard-evidence-links.png'],
  ['/tasks?focusType=task&focusId=task-2', 'DEV-68-internal-tasks-parser-links.png'],
  ['/system-control', 'DEV-68-internal-system-control-parser-links.png'],
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1.5 })
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url())
  const payload = apiFixtures[url.pathname]
  await route.fulfill({ status: payload ? 200 : 404, contentType: 'application/json', body: JSON.stringify(payload ?? { message: 'fixture not found' }) })
})

for (const [routePath, filename] of shots) {
  await page.goto(new URL(routePath, baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.waitForSelector('.inline-link-chip', { timeout: 15000 })
  await page.screenshot({ path: path.join(outDir, filename), fullPage: true })
}

await browser.close()
console.log(`Captured DEV-68 screenshots at ${outDir}`)
