import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const outDir = path.resolve(process.env.SCREENSHOT_DIR ?? 'screenshots')
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR ?? '.evidence/dev20260501-ui01')

fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(evidenceDir, { recursive: true })

const pageShots = [
  { route: '/', file: 'DEV-20260501-UI-01-dashboard.png', waitFor: '.main-content' },
  { route: '/agents', file: 'DEV-20260501-UI-01-agents.png', waitFor: '.main-content' },
  { route: '/system-control', file: 'DEV-20260501-UI-01-system-settings.png', waitFor: '.main-content' },
  { route: '/evidence-acceptance', file: 'DEV-20260501-UI-01-evidence-validation.png', waitFor: '.main-content' },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1512, height: 982 },
  deviceScaleFactor: 1.5,
  colorScheme: 'dark',
})

const summary = []

for (const scheme of ['dark', 'light']) {
  await page.emulateMedia({ colorScheme: scheme })
  await page.goto(new URL('/', baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.waitForSelector('.main-content', { timeout: 15000 })
  await page.waitForTimeout(600)
  const schemeTarget = path.join(outDir, `DEV-SEC-01-05-dashboard-${scheme}.png`)
  await page.screenshot({ path: schemeTarget, fullPage: true })
  summary.push({
    route: '/',
    file: path.basename(schemeTarget),
    title: await page.title(),
    colorScheme: scheme,
  })
}

await page.emulateMedia({ colorScheme: 'dark' })

for (const shot of pageShots) {
  await page.goto(new URL(shot.route, baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.waitForSelector(shot.waitFor, { timeout: 15000 })
  await page.waitForTimeout(600)
  const target = path.join(outDir, shot.file)
  await page.screenshot({ path: target, fullPage: true })
  summary.push({
    route: shot.route,
    file: shot.file,
    title: await page.title(),
  })
}

await page.goto(new URL('/', baseUrl).toString(), { waitUntil: 'networkidle' })
await page.waitForSelector('.sidebar', { timeout: 15000 })
await page.waitForTimeout(300)
const sidebarTarget = path.join(outDir, 'DEV-20260501-UI-01-sidebar.png')
await page.locator('.sidebar').screenshot({ path: sidebarTarget })
summary.push({
  route: '/',
  file: 'DEV-20260501-UI-01-sidebar.png',
  title: await page.title(),
  target: 'sidebar',
})

fs.writeFileSync(
  path.join(evidenceDir, 'summary.json'),
  JSON.stringify(
    {
      baseUrl,
      generatedAt: new Date().toISOString(),
      shots: summary,
    },
    null,
    2,
  ),
)

await browser.close()
console.log(`Captured DEV-20260501-UI-01 screenshots at ${outDir}`)
