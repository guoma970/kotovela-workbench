import { chromium } from 'playwright'

const base = 'http://127.0.0.1:5173/scheduler'
const shots = [
  { name: 'dev-20260416-12-family.png', label: 'Family' },
  { name: 'dev-20260416-12-media.png', label: 'Media' },
  { name: 'dev-20260416-12-business.png', label: 'Business' },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 2200 } })
await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 })
await page.waitForTimeout(1200)
for (const shot of shots) {
  await page.getByRole('button', { name: new RegExp(shot.label, 'i') }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: new URL(`../screenshots/${shot.name}`, import.meta.url).pathname, fullPage: true })
}
await browser.close()
