import { chromium } from 'playwright'

const base = 'http://127.0.0.1:5173/scheduler'
const outDir = '/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/.evidence'
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function findNeedHumanNotice(page, taskName) {
  const cards = page.locator('.scheduler-notice-card')
  const count = await cards.count()
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i)
    const text = await card.innerText()
    if (text.includes(taskName) && text.includes('【任务需人工介入】')) return card
  }
  throw new Error(`need human notice not found: ${taskName}`)
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1800 }, deviceScaleFactor: 1 })
  await page.goto(base, { waitUntil: 'networkidle' })
  await wait(1500)

  const alpha = await findNeedHumanNotice(page, 'fail:group_action_case_alpha')
  await alpha.screenshot({ path: `${outDir}/group-action-alpha-before.png` })
  await alpha.getByRole('button', { name: '已处理' }).click()
  await wait(3000)
  const alphaAfter = await findNeedHumanNotice(page, 'fail:group_action_case_alpha')
  await alphaAfter.screenshot({ path: `${outDir}/group-action-alpha-after.png` })

  const beta = await findNeedHumanNotice(page, 'fail:group_action_case_beta')
  await beta.screenshot({ path: `${outDir}/group-action-beta-before.png` })
  page.once('dialog', (dialog) => dialog.accept('builder-transfer'))
  await beta.getByRole('button', { name: '转人工' }).click()
  await wait(3000)
  const betaAfter = await findNeedHumanNotice(page, 'fail:group_action_case_beta')
  await betaAfter.screenshot({ path: `${outDir}/group-action-beta-after.png` })

  await page.screenshot({ path: `${outDir}/scheduler-group-action-synced.png`, fullPage: true })
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
