import { chromium } from 'playwright'
import path from 'node:path'

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const outDir = path.resolve('screenshots')
const prefix = process.env.SCREENSHOT_PREFIX ?? 'DEV-64'

const shots = [
  {
    path: '/tasks?focusType=project&focusId=project-1',
    file: `${prefix}-tasks-focus-loop.png`,
    waitFor: '.page',
  },
  {
    path: '/leads?focusType=agent&focusId=agent-2',
    file: `${prefix}-leads-focus-loop.png`,
    waitFor: '.page',
  },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1.5 })

for (const shot of shots) {
  await page.goto(new URL(shot.path, baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.waitForSelector(shot.waitFor)
  await page.screenshot({ path: path.join(outDir, shot.file), fullPage: true })
}

await browser.close()
console.log(`Captured DEV-64 screenshots at ${outDir}`)
