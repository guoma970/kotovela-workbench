import { chromium } from 'playwright'
import path from 'node:path'
import { resolveBaseUrl } from './shared/base-url.mjs'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
const out = (name) => path.resolve('screenshots', name)

await page.goto(resolveBaseUrl({ envNames: ['WORKBENCH_BASE_URL', 'CAPTURE_BASE_URL', 'STAB_BASE_URL'], path: '/scheduler' }), { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /运营态/ }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: out('learning-loop-dashboard.png'), fullPage: true })
await page.screenshot({ path: out('growth-dashboard.png'), fullPage: true })
await page.screenshot({ path: out('consultant-load-dashboard.png'), fullPage: true })

await page.getByRole('button', { name: /执行态/ }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: out('lead-task-card-auto.png'), fullPage: true })

await page.getByRole('button', { name: /路由态/ }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: out('hybrid-layout-card.png'), fullPage: true })

await browser.close()
