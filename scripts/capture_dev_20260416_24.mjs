import { chromium } from 'playwright'

const base = 'http://127.0.0.1:5173/scheduler'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 2200 } })
await page.goto(base, { waitUntil: 'networkidle' })
await page.screenshot({ path: 'screenshots/dev-20260416-24-full.png', fullPage: true })
await page.locator('.scheduler-template-strip').screenshot({ path: 'screenshots/dev-20260416-24-template.png' })
await page.locator('.scheduler-overview-card').screenshot({ path: 'screenshots/dev-20260416-24-master-view.png' })
await page.locator('.scheduler-queue-card').screenshot({ path: 'screenshots/dev-20260416-24-domains.png' })
await browser.close()
