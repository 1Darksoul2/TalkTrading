// Every page at phone size: nothing may stick out sideways and every key action must be reachable.
const path = require('path')
const { devices } = require('playwright')
const { BASE, OUT, launch, makeUser, watch, runner, signup } = require('./lib')

const PAGES = ['/', '/communities', '/explore', '/reels', '/create', '/chats', '/news', '/market', '/profile', '/notifications', '/settings', '/feedback', '/status']

async function main() {
  const browser = await launch()
  const problems = []
  const { step, finish } = runner()
  const { defaultBrowserType, ...phone } = devices['iPhone 13']
  void defaultBrowserType
  const page = await (await browser.newContext(phone)).newPage()
  watch(page, 'phone', problems)

  await step('Sign up on a phone', () => signup(page, makeUser('Mo')))
  await step('Market and Create are reachable from the top bar', async () => {
    await page.locator('a[aria-label="Create"]:visible').click()
    await page.waitForURL(`${BASE}/create`)
    await page.locator('a[aria-label="Market"]:visible').click()
    await page.waitForURL(`${BASE}/market`)
  })

  for (const p of PAGES) {
    await step(`${p} fits the screen`, async () => {
      await page.goto(`${BASE}${p}`)
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
      await page.screenshot({ path: path.join(OUT, `phone${p.replace(/\W+/g, '_') || '_home'}.png`) })
      const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }))
      if (scroll > width) throw new Error(`page is ${scroll}px wide on a ${width}px screen`)
    })
  }

  await browser.close()
  finish(problems)
}

main().catch(e => { console.error(e); process.exit(1) })
