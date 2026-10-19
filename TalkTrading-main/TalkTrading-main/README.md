# TalkTrading
A social network for traders — post trade ideas, discuss markets, and back your calls with live charts.

## Running it

From the project root, `python start_all.py` starts every backend service and this app (see the root README).
To run only the app against services that are already up:

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build    # production build; needs every VITE_*_SERVICE_URL (the gateway image sets them)
```

## Where the data comes from

| Area | Service | Code |
|---|---|---|
| Sign up, sign in, posts, comments, likes, follows, profiles, notifications | Post (8004) | `src/services/authService.js`, `postService.js` |
| Stories, highlights, story settings | Story (8001) | `storyService.js` |
| Reels (feed, likes, saves, comments, reports) | Reel (8005) | `reelService.js` |
| End-to-end encrypted chat | E2EE (8003) | `e2eService.js`, `src/crypto/` |
| Market list, quotes, sparklines | Chart (8002) | `chartService.js` |
| News and saved articles | News (8000) | `newsService.js` |
| Communities | Community (8080) | `communityService.js` |
| Explore feeds | Explore (8083) | `exploreService.js` |

Service addresses are set in `src/services/apiConfig.js`. Failures are shown on the page; nothing falls back to sample data.
