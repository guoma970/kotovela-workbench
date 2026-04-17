import { chromium } from '@playwright/test'
import path from 'node:path'

const outDir = path.resolve('.evidence')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 2200 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:5173/scheduler', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /执行态/ }).click()
await page.waitForTimeout(800)
await page.locator('section.scheduler-alert-card').filter({ has: page.getByText('发布中心') }).screenshot({ path: path.join(outDir, 'dev-20260416-28-publish-center.png') })
await page.locator('section.scheduler-alert-card').filter({ has: page.getByText('结果沉淀中心') }).screenshot({ path: path.join(outDir, 'dev-20260416-28-archive-center.png') })
await browser.close()
