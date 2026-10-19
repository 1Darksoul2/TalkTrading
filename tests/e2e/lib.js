// Shared helpers for the TalkTrading browser tests.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// The app under test: the dev server (npm run dev) or a deployed gateway such as http://localhost:8088.
const BASE = (process.env.BASE || 'http://127.0.0.1:5173').replace(/\/+$/, '')
const OUT = path.join(__dirname, 'output')
fs.mkdirSync(OUT, { recursive: true })

// Market data comes from outside providers; when they are unreachable the app says so on the page.
// Set STRICT_MARKET_DATA=1 to count those failures too.
const MARKET_DATA = /tradingview|\/sparkline|\/symbols\/[^/]+\/quote/
const ignored = url => !process.env.STRICT_MARKET_DATA && MARKET_DATA.test(url)

function launch() {
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
}

// A small valid PNG, so photo uploads go through the services' real image checks.
function writePng(file, w = 64, h = 64) {
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = b => { let c = 0xffffffff; for (const x of b) c = table[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = 212; raw[i + 1] = 175; raw[i + 2] = y * 4 }
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
  return file
}

const stamp = Date.now().toString().slice(-6)
const makeUser = name => ({
  full: `${name} Tester`,
  username: `${name.toLowerCase()}_${stamp}`,
  email: `${name.toLowerCase()}_${stamp}@example.com`,
  password: 'Sup3r-secret!',
})

// Known, harmless answers that are not app faults:
// - the chat service refuses a repeat key upload when pages are reloaded quickly (the keys are already there);
// - the gateway allows 10 sign-in/sign-up calls a minute per address, and the tests make many in a row.
// - when that limit cut a sign-up short, signing up again answers "already exists" (409) and signup() signs in instead.
const KNOWN = r =>
  (r.status() === 429 && r.url().endsWith('/e2ee/devices')) ||
  (r.status() === 429 && r.url().includes('/auth/')) ||
  (r.status() === 409 && r.url().endsWith('/auth/register'))

/** Collects console errors, crashes and failed API calls; `expected` filters intended failures of a test. */
function watch(page, who, problems, expected = () => false) {
  page.on('console', m => {
    const text = m.text()
    // Requests and the chat WebSocket that the test itself cut off by loading the next page.
    // (A chat that really fails to connect fails the chat step in flows.js.)
    const cutOff = text.includes('Failed to fetch') || /^WebSocket connection to .* failed/.test(text) || text.startsWith('[E2E WS] Error')
    if (m.type() === 'error' && !text.includes('Failed to load resource') && !cutOff && !ignored(text)) {
      problems.push(`[${who}] console: ${text.slice(0, 300)}`)
    }
  })
  page.on('pageerror', e => problems.push(`[${who}] page crashed: ${e.message}`))
  page.on('response', r => {
    if (r.status() >= 400 && !ignored(r.url()) && !KNOWN(r) && !expected(r)) problems.push(`[${who}] HTTP ${r.status()}: ${r.request().method()} ${r.url()}`)
  })
}

/** Runs named steps, prints a report, and sets a failing exit code if anything went wrong. */
function runner() {
  const results = []
  return {
    async step(name, fn) {
      try { await fn(); results.push(`OK    ${name}`) } catch (e) { results.push(`FAIL  ${name}: ${e.message.split('\n')[0]}`) }
    },
    skip(name, why) { results.push(`SKIP  ${name} (${why})`) },
    finish(problems) {
      console.log(results.join('\n'))
      const unique = [...new Set(problems)]
      console.log(`\nProblems seen in the browser: ${unique.length ? '\n' + unique.join('\n') : 'none'}`)
      const failed = results.some(r => r.startsWith('FAIL')) || unique.length > 0
      process.exitCode = failed ? 1 : 0
    },
  }
}

// The gateway allows 10 sign-in/sign-up calls a minute per address; running the suites back to back
// can reach that, so sign-up waits out the limit (the app says "Too many attempts") and tries again.
async function signup(page, u) {
  for (let attempt = 1; ; attempt++) {
    await page.goto(`${BASE}/signup`)
    await page.fill('#tt-fullname', u.full)
    await page.fill('#tt-username', u.username)
    await page.fill('#tt-email', u.email)
    await page.fill('#tt-new-password', u.password)
    await page.fill('#tt-confirm', u.password)
    await page.check('input[type=checkbox]')
    await page.click('button[type=submit]')
    const outcome = await Promise.race([
      page.waitForURL(`${BASE}/`, { timeout: 15000 }).then(() => 'in'),
      page.getByText(/Too many attempts/).waitFor({ timeout: 15000 }).then(() => 'limited'),
      page.getByText(/already exists|already taken/).waitFor({ timeout: 15000 }).then(() => 'exists'),
    ])
    if (outcome === 'in') return
    if (outcome === 'exists') {
      // The account was created but the sign-in right after it was rate limited: sign in instead.
      await page.waitForTimeout(30000)
      await page.goto(`${BASE}/login`)
      await page.fill('#tt-identifier', u.email)
      await page.fill('#tt-password', u.password)
      await page.click('button[type=submit]')
      await page.waitForURL(`${BASE}/`, { timeout: 15000 })
      return
    }
    if (attempt === 4) throw new Error('still rate limited after several minutes')
    await page.waitForTimeout(30000)
  }
}

module.exports = { BASE, OUT, launch, writePng, makeUser, watch, runner, signup }
