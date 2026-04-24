import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import { resolveBaseUrl } from './shared/base-url.mjs'

const base = resolveBaseUrl({ envNames: ['WORKBENCH_BASE_URL', 'CAPTURE_BASE_URL', 'STAB_BASE_URL'] })
const outDir = path.resolve('screenshots')
await fs.mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })

async function save(name, locator = null) {
  const target = path.join(outDir, name)
  if (locator) {
    await locator.screenshot({ path: target })
  } else {
    await page.screenshot({ path: target, fullPage: true })
  }
}

await page.goto(base, { waitUntil: 'networkidle' })
await save('internal-logo.png')

await page.goto(base, { waitUntil: 'domcontentloaded' })
await save('opensource-logo.png')

await page.goto(`${base}/scheduler`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: '执行态' }).click()
await page.waitForTimeout(500)
await save('scheduler-page.png')
await save('priority-preempt.png', page.locator('.scheduler-queue-card'))

await page.getByRole('button', { name: '路由态' }).click()
await page.waitForTimeout(500)
await save('publish-center.png')
await save('hybrid-layout-card.png', page.locator('.scheduler-alert-card').nth(1))

await page.getByRole('button', { name: '运营态' }).click()
await page.waitForTimeout(500)
await save('learning-loop-dashboard.png')
await save('growth-dashboard.png', page.locator('.scheduler-template-strip').first())
await save('consultant-load-dashboard.png', page.locator('.scheduler-summary-grid').nth(2))

await page.getByRole('button', { name: '执行态' }).click()
await page.waitForTimeout(500)
await save('lead-task-card-auto.png', page.locator('.scheduler-task-card').filter({ hasText: '样板房地暖咨询跟进' }).first())

await browser.close()
