import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1680, height: 2400 } })
await page.goto('http://127.0.0.1:4173/scheduler', { waitUntil: 'networkidle' })
await page.locator('#system-test-summary').scrollIntoViewIfNeeded()
await page.locator('#system-test-summary').screenshot({ path: '.evidence/system-test-summary.png' })
await page.locator('#test-case-table').scrollIntoViewIfNeeded()
await page.locator('#test-case-table').screenshot({ path: '.evidence/test-case-table.png' })
await page.locator('#defect-list').scrollIntoViewIfNeeded()
await page.locator('#defect-list').screenshot({ path: '.evidence/defect-list.png' })
await browser.close()
