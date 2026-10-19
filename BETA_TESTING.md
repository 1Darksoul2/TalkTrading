# TalkTrading closed beta: how to run it

Part 1 is for the team. Part 2 is the page to send to testers.

---

## Part 1 — For the team

### Before the first invite

1. **Deploy** with [DEPLOY.md](DEPLOY.md) (server, domain, `make_env.py`, `docker compose up -d --build`).
2. **Set the support email**: `SUPPORT_EMAIL` in `deploy/.env` is where feedback goes and who testers contact about a forgotten password.
3. **Add the news key**: `NEWS_API_KEY` in `deploy/.env` (free at finnhub.io), then `docker compose up -d`. TradingView needs no key.
4. **Seed the starter content** (team account, welcome post, five starter communities), then **publish a few reels** from videos you host (CDN or storage bucket; MP4 H.264, vertical, up to 3 minutes):
   ```bash
   cd /opt/talktrading/deploy
   python3 scripts/seed_beta.py --url https://your-domain.com --email team@your-domain.com
   python3 scripts/add_reel.py --url https://your-domain.com --email team@your-domain.com \
       --video https://cdn.example.com/nvda.mp4 --duration 42 --caption "NVDA reclaiming the 50 day" --tickers NVDA
   ```
5. **Check everything is up**: open `https://your-domain.com/status` while signed in. Every row should be green, including "News articles" (your Finnhub key works) and "Live prices" (TradingView, no key needed).
6. **Turn on backups and monitoring** (DEPLOY.md sections 6 and 7) and run one backup by hand: `sh scripts/backup.sh`.
7. **Do one full walk-through yourself**, on a laptop and on a phone, using the tester checklist in Part 2.

### Inviting testers

Start with 10–20 people you trust. Send them the link and Part 2 of this file. Suggested message:

> You're invited to the TalkTrading closed beta — a social network for traders.
> Sign up at https://your-domain.com, try the things on the checklist, and send feedback from the account
> menu (top right → Send feedback). It's an early version: expect rough edges, and please don't post
> anything you wouldn't want reset. Nothing on TalkTrading is financial advice.

### Daily routine (10 minutes)

All commands run in `/opt/talktrading/deploy` on the server.

| What | How |
|---|---|
| Is everything up? | `docker compose ps` (all `running`), or the `/status` page in the app |
| New reports | `sh scripts/moderate.sh reports` |
| Spot-check new content | `sh scripts/moderate.sh recent` |
| Hide something | `sh scripts/moderate.sh hide-post <id>` · `hide-reel <id>` · `end-story <id>` (undo with `restore-post` / `restore-reel`) |
| Who is this account? | `sh scripts/moderate.sh user <username>` |
| New reel | `python3 scripts/add_reel.py --url … --email … --video https://… --duration … --caption "…"` |
| How is the beta going? | `sh scripts/moderate.sh stats` (accounts, posts, reels, stories, chat messages; total and last 24 h) |
| Errors | `docker compose logs --since 24h post story reel e2e community explore 2>&1 \| grep -iE "error\|exception" \| tail -50` |
| Feedback | The support inbox (`SUPPORT_EMAIL` in `deploy/.env`). Each email includes the user, page and browser. |

### Handling requests

- **"Delete my account / send me my data"**: there is no self-service yet. Use `moderate.sh user <username>` to confirm who it is, then do it by hand and reply within 30 days (the Privacy Notice promises this).
- **Forgotten password**: there is no reset email. Check it is really them (`moderate.sh user`), run `sh scripts/moderate.sh set-password <email>`, and send the temporary password privately (the app has no password-change screen yet, so tell them to keep it safe).
- **Abuse**: hide the content first, then decide. There is no ban button yet; for a serious case, hide their posts and reels and contact them.

### What to measure during the beta

- Sign-ups vs. people who post at least once (`stats`)
- Chat messages per day (people coming back to talk)
- Reports per day (moderation load)
- The top 5 feedback themes each week

**Exit criteria for the closed beta:** 7 days without a crash-level bug, testers can post, chat and join communities
without help, and the top 5 complaints are fixed.

### Known limits to tell testers about

- **No email verification at sign-up** yet.
- **Chats are tied to the browser.** Encryption keys live in the browser where you signed in. Messages from
  before you used a new browser or phone, or cleared site data, can't be read there.
- **Prices and news** come from TradingView and Finnhub. If they are down, the app says so instead of showing
  numbers.
- **No block/mute for posts and chats** yet (story mute and hide exist in Settings).
- **Reels are posted by the TalkTrading team** during the beta; testers watch, like, comment, save, share and report them.

---

## Part 2 — For testers

Thanks for testing TalkTrading! It's an early version: things will break, and that's what we need to hear about.

**Sending feedback:** top-right account picture → **Send feedback**. Say what you did, what you expected, and what
happened. The page and browser details are added for you. To report a reel, use the flag button on it; for a
story, use its ⋯ menu.

### Please try

**Account**
- [ ] Sign up, sign out, sign back in with your email; try "Remember me"
- [ ] Edit your profile and add a photo (Profile → Edit Profile)

**Sharing**
- [ ] A post with a chart screenshot and a `$TICKER` (Create, or the box on Home)
- [ ] A story (Home → Your story)
- [ ] Comment on, like and save someone else's post, and a reel in Reels

**People**
- [ ] Find someone in Explore → People and follow them
- [ ] Check the Following tab on Home and your notifications (bell)
- [ ] Send someone a private message in Chats, and reply from their side if you know them

**Markets**
- [ ] Add symbols to your watchlist in Market and open a chart
- [ ] Read and save a news article

**Communities**
- [ ] Join a community, and create one

**On your phone**
- [ ] Do a few of the above on your phone's browser; try "Add to Home Screen"

Everything you read on TalkTrading is someone's opinion, not financial advice.
