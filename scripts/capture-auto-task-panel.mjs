import { chromium } from 'playwright'

const base = 'http://localhost:4174/'
const outSuccess = '/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/screenshots/auto-task-success.png'
const outFailed = '/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/screenshots/auto-task-failed.png'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } })

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForTimeout(2000)
await page.screenshot({ path: outSuccess, fullPage: true })

const input = page.locator('.auto-task-input')
await input.fill('fail:接口超时')
await page.getByRole('button', { name: '执行' }).click()
await page.waitForSelector('.auto-task-failed-box', { timeout: 120000 })
await page.screenshot({ path: outFailed, fullPage: true })

await browser.close()
console.log(outSuccess)
console.log(outFailed)
