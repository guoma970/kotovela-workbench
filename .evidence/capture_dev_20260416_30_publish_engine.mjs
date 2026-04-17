import path from 'node:path'
import { chromium } from 'playwright'

const outDir = '/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/.evidence'
const baseUrl = 'http://127.0.0.1:5173/scheduler'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1680, height: 2200 } })

try {
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: /执行态/i }).click()
  await page.waitForTimeout(1500)

  const publishCenter = page.locator('section.scheduler-alert-card', { hasText: '发布中心' }).first()
  await publishCenter.scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await publishCenter.screenshot({ path: path.join(outDir, 'dev-20260416-30-personas.png') })

  const warningCard = page.locator('article.scheduler-center-card', { hasText: 'OpenClaw 内容发布节奏建议' }).first()
  await warningCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await warningCard.screenshot({ path: path.join(outDir, 'dev-20260416-30-warning.png') })

  const manualCard = page.locator('article.scheduler-center-card', { hasText: '果妈970 内容选题发布' }).first()
  await manualCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await manualCard.screenshot({ path: path.join(outDir, 'dev-20260416-30-manual-published.png') })

  console.log('captured publish engine evidence')
} finally {
  await browser.close()
}
