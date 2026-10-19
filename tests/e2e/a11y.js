// Every page in the dark and light themes: no serious or critical accessibility problems (axe-core),
// which includes text contrast, unnamed buttons and links, and links told apart by colour alone.
const fs = require('fs')
const path = require('path')
const { BASE, OUT, launch, makeUser, watch, runner, signup } = require('./lib')

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const SIGNED_OUT = ['/login', '/signup', '/forgot-password', '/terms', '/privacy', '/guidelines']
const SIGNED_IN = ['/', '/communities', '/explore', '/reels', '/create', '/create?type=reel', '/chats', '/news', '/market',
  '/market/AAPL', '/profile', '/notifications', '/settings', '/settings/appearance', '/feedback', '/status', '/this-page-does-not-exist']

async function scan(page) {
  await page.addScriptTag({ content: AXE })
  return page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ')}`))
}

async function main() {
  const browser = await launch()
  const problems = []
  const { step, finish } = runner()

  // Sign up once; the login is copied into localStorage so every themed browser below starts signed in.
  const first = await (await browser.newContext()).newPage()
  watch(first, 'signup', problems)
  await step('Sign up', () => signup(first, makeUser('Ally')))
  await first.evaluate(() => { for (const k of ['talktrading_token', 'talktrading_user']) localStorage.setItem(k, sessionStorage.getItem(k)) })
  const signedIn = await first.context().storageState()

  for (const theme of ['dark', 'light']) {
    for (const [paths, state] of [[SIGNED_OUT, undefined], [SIGNED_IN, signedIn]]) {
      // The site's Content-Security-Policy rightly blocks injected scripts; the scanner needs to run anyway.
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, bypassCSP: true, storageState: state })
      await ctx.addInitScript(t => localStorage.setItem('tt-theme', t), theme)
      const page = await ctx.newPage()
      watch(page, theme, problems)
      for (const p of paths) {
        await step(`${theme} ${p}`, async () => {
          await page.goto(`${BASE}${p}`)
          await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
          await page.screenshot({ path: path.join(OUT, `${theme}${p.replace(/\W+/g, '_')}.png`) })
          const found = await scan(page)
          if (found.length) throw new Error(found.join(' | '))
        })
      }
      await ctx.close()
    }
  }

  await browser.close()
  finish(problems)
}

main().catch(e => { console.error(e); process.exit(1) })
