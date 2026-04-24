import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import { resolveBaseUrl } from './shared/base-url.mjs'

const base = resolveBaseUrl({ envNames: ['WORKBENCH_BASE_URL', 'CAPTURE_BASE_URL', 'STAB_BASE_URL'] })
const outDir = path.resolve('screenshots')
await fs.mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })

async function save(name, target) {
  const file = path.join(outDir, name)
  if (target) {
    try {
      await target.waitFor({ state: 'visible', timeout: 3000 })
      await target.screenshot({ path: file })
      return
    } catch {
      // fall back to full-page screenshot when locator is missing or unstable
    }
  }
  await page.screenshot({ path: file, fullPage: false })
}

await page.goto(base, { waitUntil: 'networkidle' })
await save('DEV-62-dashboard-home.png')

await page.goto(`${base}/scheduler`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: '执行态' }).click()
await page.waitForTimeout(500)
await save('DEV-62-scheduler-execution.png')

await page.getByRole('button', { name: '路由态' }).click()
await page.waitForTimeout(500)
await save('DEV-62-publish-center.png')

await page.getByRole('button', { name: '运营态' }).click()
await page.waitForTimeout(500)
await save('DEV-62-consultant-dashboard.png', page.locator('.scheduler-summary-grid').nth(2))

await page.goto(`${base}/leads`, { waitUntil: 'networkidle' })
await save('DEV-62-leads-page.png')

await page.goto(`${base}/system-control`, { waitUntil: 'networkidle' })
await save('DEV-62-system-control.png')

await browser.close()
console.log(`Captured DEV-62 screenshots at ${outDir}`)
