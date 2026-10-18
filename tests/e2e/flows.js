// Two new users go through every main feature of the app, against the real services.
const path = require('path')
const { execSync } = require('child_process')
const { BASE, OUT, launch, writePng, makeUser, watch, runner, signup } = require('./lib')

const PHOTO = writePng(path.join(OUT, 'photo.png'))
const REEL = path.join(__dirname, 'fixtures', 'sample-reel.webm')
const A = makeUser('Ann')
const B = makeUser('Ben')

// The wrong-password check fails on purpose.
const expected = r => r.status() === 401 && r.url().includes('/auth/login')

async function main() {
  const browser = await launch()
  const problems = []
  const { step, skip, finish } = runner()
  const ctxA = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const ctxB = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()
  watch(a, 'Ann', problems, expected)
  watch(b, 'Ben', problems, expected)

  await step('Ann signs up', () => signup(a, A))
  await step('Ben signs up', () => signup(b, B))

  await step('Ann sees her full name in the account menu', async () => {
    await a.click('button[aria-label="Account menu"]')
    await a.getByText(A.full).waitFor({ timeout: 5000 })
    await a.mouse.click(5, 500)
  })

  await step('Ann publishes a post with a photo, a ticker and a sentiment', async () => {
    await a.goto(`${BASE}/create?type=post`)
    await a.setInputFiles('input[type=file]', PHOTO)
    await a.fill('#create-text', 'Breakout above the range on volume')
    await a.getByRole('button', { name: /Bullish/ }).click()
    await a.getByRole('button', { name: /Share post/ }).click()
    await a.waitForURL(`${BASE}/`, { timeout: 15000 })
    await a.getByText('Breakout above the range on volume').first().waitFor({ timeout: 10000 })
  })

  await step('Ann publishes a story', async () => {
    await a.goto(`${BASE}/create?type=story`)
    await a.setInputFiles('input[type=file]', PHOTO)
    await a.fill('#create-text', 'Watching NVDA today')
    await a.getByRole('button', { name: /Share story/ }).click()
    await a.waitForURL(`${BASE}/`, { timeout: 15000 })
  })

  await step('Ann publishes a reel', async () => {
    await a.goto(`${BASE}/create?type=reel`)
    await a.setInputFiles('input[type=file]', REEL)
    await a.fill('#create-text', `NVDA reclaiming the 50 day ${A.username}`)
    await a.getByRole('button', { name: /Share reel/ }).click()
    await a.waitForURL(`${BASE}/reels`, { timeout: 20000 })
    await a.getByText(`NVDA reclaiming the 50 day ${A.username}`).first().waitFor({ timeout: 10000 })
  })

  await step('Ben follows Ann from her reel, likes it and comments', async () => {
    await b.goto(`${BASE}/reels`)
    await b.getByText(`NVDA reclaiming the 50 day ${A.username}`).first().waitFor({ timeout: 10000 })
    await b.getByRole('button', { name: 'Follow', exact: true }).first().click()
    await b.getByRole('button', { name: 'Following', exact: true }).first().waitFor({ timeout: 5000 })
    await b.locator('button[aria-label="Like"]:visible').first().click()
    await b.locator('button[aria-label="Unlike"]:visible').first().waitFor({ timeout: 5000 })
    await b.locator('button[aria-label="Comments"]:visible').first().click()
    await b.fill('input[placeholder="Add a comment…"]', 'Great level to watch')
    await b.getByRole('button', { name: 'Post', exact: true }).click()
    await b.getByText('Great level to watch').waitFor({ timeout: 5000 })
    await b.getByRole('button', { name: 'Close' }).click()
  })

  await step('Ben reports a reel', async () => {
    await b.locator('button[aria-label="Report reel"]:visible').first().click()
    await b.getByText('Spam or scam').click()
    await b.getByRole('button', { name: 'Report', exact: true }).click()
    await b.getByText(/team will review/).waitFor({ timeout: 5000 })
  })

  await step("Ben sees Ann's post in his home feed", async () => {
    await b.goto(`${BASE}/`)
    await b.getByText('Breakout above the range on volume').first().waitFor({ timeout: 10000 })
  })

  await step('Ann opens her notifications', async () => {
    await a.goto(`${BASE}/notifications`)
    await a.getByText(B.username).first().waitFor({ timeout: 10000 })
  })

  await step('Ann creates a community and Ben joins it', async () => {
    const name = `Swing ${A.username}`
    await a.goto(`${BASE}/communities`)
    await a.getByRole('button', { name: /New/ }).click()
    await a.fill('input[placeholder="e.g. Options Kings"]', name)
    await a.fill('textarea[placeholder="What is this community about?"]', 'Swing trading setups')
    await a.getByRole('button', { name: 'Create', exact: true }).click()
    await a.getByText(name).first().waitFor({ timeout: 10000 })
    await b.goto(`${BASE}/communities`)
    await b.fill('input[placeholder="Search communities..."]', name)
    await b.getByText(name).first().waitFor({ timeout: 10000 })
    await b.getByRole('button', { name: 'Join', exact: true }).first().click()
    await b.getByRole('button', { name: 'Leave', exact: true }).first().waitFor({ timeout: 10000 })
  })

  await step('Ben finds Ann in Explore → People', async () => {
    await b.goto(`${BASE}/explore`)
    await b.getByRole('button', { name: 'People', exact: true }).click()
    await b.fill('input[placeholder="Search people, or #hashtag"]', A.username)
    await b.getByText(A.username).first().waitFor({ timeout: 10000 })
  })

  await step('Ann opens her profile', async () => {
    await a.goto(`${BASE}/profile`)
    await a.getByText(A.full).first().waitFor({ timeout: 10000 })
  })

  await step('Ben sends Ann an encrypted message and Ann reads it', async () => {
    await a.goto(`${BASE}/chats`)          // Ann's browser publishes her chat keys
    await a.waitForLoadState('networkidle')
    await b.goto(`${BASE}/chats`)
    await b.waitForLoadState('networkidle')
    await b.getByText('New DM').click()
    await b.fill('input[placeholder="Search people by username"]', A.username)
    await b.getByRole('button', { name: new RegExp(A.username) }).click()
    await b.fill('input[placeholder="Message…"]', 'Hey Ann, saw your NVDA reel')
    await b.press('input[placeholder="Message…"]', 'Enter')
    await b.getByText('Hey Ann, saw your NVDA reel').first().waitFor({ timeout: 10000 })
    await a.goto(`${BASE}/chats`)
    await a.getByText(B.username).first().click({ timeout: 15000 })
    await a.getByText('Hey Ann, saw your NVDA reel').last().waitFor({ timeout: 15000 })
  })

  await step('Ann logs out and back in with her username and "Remember me"', async () => {
    await a.goto(`${BASE}/`)
    await a.click('button[aria-label="Account menu"]')
    await a.getByRole('button', { name: /Log out/ }).click()
    await a.waitForURL(`${BASE}/login`)
    await a.fill('#tt-identifier', A.username)
    await a.fill('#tt-password', A.password)
    await a.check('input[type=checkbox]')
    await a.click('button[type=submit]')
    await a.waitForURL(`${BASE}/`, { timeout: 10000 })
    if (!(await a.evaluate(() => localStorage.getItem('talktrading_token')))) throw new Error('login was not remembered')
  })

  await step('A wrong password shows a clear message', async () => {
    const p = await (await browser.newContext()).newPage()
    watch(p, 'guest', problems, expected)
    await p.goto(`${BASE}/login`)
    await p.fill('#tt-identifier', A.email)
    await p.fill('#tt-password', 'not-the-password')
    await p.click('button[type=submit]')
    await p.getByRole('alert').getByText(/Incorrect email\/username or password/).waitFor({ timeout: 5000 })
  })

  // Reading the emailed link needs the Post Service log (no mail server in tests):
  //   RESET_LINK_CMD="docker compose -f deploy/docker-compose.yml logs post"
  if (process.env.RESET_LINK_CMD) {
    await step('Forgot password → link → new password works', async () => {
      const p = await (await browser.newContext()).newPage()
      watch(p, 'reset', problems, expected)
      await p.goto(`${BASE}/forgot-password`)
      await p.fill('#tt-reset-email', A.email)
      await p.click('button[type=submit]')
      await p.getByText('Check your email').waitFor({ timeout: 5000 })
      await p.waitForTimeout(500)
      const logs = execSync(process.env.RESET_LINK_CMD, { maxBuffer: 1 << 26 }).toString().split('\n')
      const line = logs.filter(l => l.includes(A.email) && l.includes('reset-password?token=')).pop()
      if (!line) throw new Error('no reset link found in the Post Service log')
      const link = new URL(line.slice(line.indexOf('http')).trim())
      await p.goto(`${BASE}/reset-password${link.search}`)
      await p.fill('#tt-reset-password', 'Brand-new-pass1')
      await p.fill('#tt-reset-confirm', 'Brand-new-pass1')
      await p.click('button[type=submit]')
      await p.getByText('Password changed').waitFor({ timeout: 5000 })
      await p.goto(`${BASE}/login`)
      await p.fill('#tt-identifier', A.email)
      await p.fill('#tt-password', 'Brand-new-pass1')
      await p.click('button[type=submit]')
      await p.waitForURL(`${BASE}/`, { timeout: 10000 })
    })
  } else {
    skip('Forgot password → link → new password works', 'set RESET_LINK_CMD to run it')
  }

  await browser.close()
  finish(problems)
}

main().catch(e => { console.error(e); process.exit(1) })
