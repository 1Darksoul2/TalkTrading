// A new user opens every page (desktop size): no crash, no failed API call, no console error.
const path = require('path')
const { BASE, OUT, launch, makeUser, watch, runner, signup } = require('./lib')

const PAGES = [
  '/', '/communities', '/explore', '/reels', '/create', '/chats', '/news', '/market', '/market/AAPL',
  '/profile', '/notifications', '/settings', '/settings/your-information', '/stories/archive',
  '/feedback', '/status', '/terms', '/privacy', '/guidelines', '/this-page-does-not-exist',
]

async function main() {
  const browser = await launch()
  const problems = []
  const { step, finish } = runner()
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  watch(page, 'user', problems)

  await step('Legal pages are readable before signing in', async () => {
    await page.goto(`${BASE}/terms`)
    await page.getByText('Not financial advice').waitFor({ timeout: 5000 })
  })
  await step('Sign up', () => signup(page, makeUser('Pat')))

  for (const p of PAGES) {
    await step(`Open ${p}`, async () => {
      await page.goto(`${BASE}${p}`)
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
      if (await page.getByText('Something went wrong on this page').count()) throw new Error('the page crashed')
      await page.screenshot({ path: path.join(OUT, `desktop${p.replace(/\W+/g, '_') || '_home'}.png`) })
    })
  }

  await browser.close()
  finish(problems)
}

main().catch(e => { console.error(e); process.exit(1) })
