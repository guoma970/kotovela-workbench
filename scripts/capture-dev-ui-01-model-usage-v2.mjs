import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const outDir = path.resolve(process.env.SCREENSHOT_DIR ?? 'screenshots')
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR ?? '.evidence/dev20260501-ui01-model-usage-v2')

fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(evidenceDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1512, height: 982 },
  deviceScaleFactor: 1.5,
})

await page.goto(new URL('/model-usage', baseUrl).toString(), { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.model-usage-page', { timeout: 15000 })
await page.waitForTimeout(600)

const target = path.join(outDir, 'DEV-20260501-UI-01-model-usage-v2.png')
await page.screenshot({ path: target, fullPage: true })

fs.writeFileSync(
  path.join(evidenceDir, 'summary.json'),
  JSON.stringify(
    {
      baseUrl,
      route: '/model-usage',
      file: 'DEV-20260501-UI-01-model-usage-v2.png',
      title: await page.title(),
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
)

await browser.close()
console.log(`Captured DEV-20260501-UI-01 model usage screenshot at ${target}`)
