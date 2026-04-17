const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 900, height: 1600 } })
  const url = 'file:///Users/ztl/.openclaw/workspace-builder/kotovela-workbench/screenshots/task-notify-preview.html'
  const names = ['family', 'media', 'business']

  await page.goto(url)
  const sections = page.locator('section')
  for (let i = 0; i < names.length; i += 1) {
    await sections.nth(i).screenshot({
      path: `/Users/ztl/.openclaw/workspace-builder/kotovela-workbench/screenshots/${names[i]}-notification.png`,
    })
  }
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
