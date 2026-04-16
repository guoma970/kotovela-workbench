import { chromium } from 'playwright'

const base = 'http://localhost:4174/'
const outRetrying = '/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/screenshots/auto-retry-running.png'
const outStopped = '/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/screenshots/auto-retry-stopped.png'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } })

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForTimeout(2000)

const input = page.locator('.auto-task-input')
await input.fill('fail:接口超时')
await page.getByRole('button', { name: '执行' }).click()
await page.waitForSelector('.auto-task-failed-box', { timeout: 120000 })
await page.waitForSelector('text=正在自动重试', { timeout: 120000 })
await page.screenshot({ path: outRetrying, fullPage: true })
await page.waitForSelector('text=自动重试结束', { timeout: 120000 })
await page.screenshot({ path: outStopped, fullPage: true })

await browser.close()
console.log(outRetrying)
console.log(outStopped)
