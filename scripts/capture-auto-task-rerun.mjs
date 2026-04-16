import { chromium } from 'playwright'

const base = 'http://localhost:4174/'
const out = '/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/screenshots/auto-task-rerun.png'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } })

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForTimeout(2000)

const input = page.locator('.auto-task-input')
await input.fill('fail:接口超时')
await page.getByRole('button', { name: '执行' }).click()
await page.waitForSelector('.auto-task-failed-box', { timeout: 120000 })
await page.getByRole('button', { name: '重试' }).click()
await page.waitForTimeout(1000)
await page.screenshot({ path: out, fullPage: true })

await browser.close()
console.log(out)
