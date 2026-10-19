// Two new users go through every main feature of the app, against the real services.
const path = require('path')
const { BASE, OUT, launch, writePng, makeUser, watch, runner, signup } = require('./lib')

// Where the Reel API is: through the gateway in production, its own port with npm run dev.
const REEL_BASE = process.env.REEL_URL || (BASE.endsWith(':5173') ? 'http://127.0.0.1:8005' : `${BASE}/svc/reel`)

const PHOTO = writePng(path.join(OUT, 'photo.png'))
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

  // The Reel service stores only a link to a hosted video; the team adds reels with deploy/scripts/add_reel.py.
  // The same call is made here with Ann's login. (The test video address is not real; playback is not checked.)
  await step("Ann's reel is published through the Reel API", async () => {
    await a.goto(`${BASE}/reels`)
    const status = await a.evaluate(async ({ base, caption }) => {
      const token = sessionStorage.getItem('talktrading_token') || localStorage.getItem('talktrading_token')
      const res = await fetch(`${base}/api/v1/reels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caption, tags: ['NVDA'], media: { video_url: 'https://example.invalid/nvda.mp4', duration: 12, mime_type: 'video/mp4' } }),
      })
      return res.status
    }, { base: REEL_BASE, caption: `NVDA reclaiming the 50 day ${A.username}` })
    if (status !== 201) throw new Error(`Reel API answered ${status}`)
    await a.reload()
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

  await step('Ann logs out and back in with "Remember me"', async () => {
    await a.goto(`${BASE}/`)
    await a.click('button[aria-label="Account menu"]')
    await a.getByRole('button', { name: /Log out/ }).click()
    await a.waitForURL(`${BASE}/login`)
    await a.fill('#tt-identifier', A.email)
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
    await p.getByRole('alert').getByText(/Invalid email or password/).waitFor({ timeout: 5000 })
  })

  await step('"Forgot password?" explains how to get help', async () => {
    const p = await (await browser.newContext()).newPage()
    watch(p, 'guest', problems, expected)
    await p.goto(`${BASE}/login`)
    await p.getByRole('link', { name: 'Forgot password?' }).click()
    await p.getByText('passwords are reset by the TalkTrading team').waitFor({ timeout: 5000 })
  })

  await browser.close()
  finish(problems)
}

main().catch(e => { console.error(e); process.exit(1) })
