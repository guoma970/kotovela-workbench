import { chromium } from 'playwright'

const base = 'http://localhost:4174/'
const out = '/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/screenshots/auto-task-scheduler.png'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1800 } })

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForTimeout(2000)
await page.screenshot({ path: out, fullPage: true })

await browser.close()
console.log(out)
