# Browser tests

These drive the real app in Chromium as new users, against services that are already running.
They create real accounts and content, so point them at a local or staging stack, not at the live beta.

| Script | What it checks |
|---|---|
| `flows.js` | Two users: sign up, post with photo and ticker, story, reel upload, follow, like, comment, report, feed, notifications, community create/join, explore search, profile, encrypted chat both ways, username login with "Remember me", wrong password, password reset |
| `pages.js` | Every page opens without a crash, failed API call or console error (desktop size) |
| `mobile.js` | Every page fits an iPhone-size screen, and Market/Create are reachable |

## Run

```bash
cd tests/e2e
npm install
npx playwright install chromium

# Against the dev setup (python start_all.py):
npm run all

# Against the Docker stack (deploy/), including the password-reset step:
BASE=http://localhost:8088 RESET_LINK_CMD="docker compose -f ../../deploy/docker-compose.yml logs post" npm run all
```

Each script prints `OK` / `FAIL` per step, lists anything unexpected seen in the browser, and exits non-zero
if something failed. Screenshots go to `output/`.

Live prices and charts come from outside providers. When those are unreachable the app says so on the page,
and the tests ignore those calls; set `STRICT_MARKET_DATA=1` to count them as failures.
