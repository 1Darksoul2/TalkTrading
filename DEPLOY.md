# Going live: TalkTrading for real users

Everything runs on **one small Linux server** with Docker. One address (`https://your-domain`) serves the app and all APIs; HTTPS certificates are free and renew automatically.

**Cost:** about **€5-8 / month** for the server + about **$10 / year** for a domain. Nothing else is required.

---

## 1. What to buy (once)

| What | Recommended | Why |
|---|---|---|
| Server | **Hetzner Cloud CX32** (4 vCPU, 8 GB RAM, ~€8/month), Ubuntu 24.04. The **CX22** (4 GB, ~€5/month) also works for a small test group. | Two Java services + PostgreSQL + five Python services need ~3 GB. Hetzner is the cheapest reliable option; DigitalOcean / AWS Lightsail work the same way at about twice the price. |
| Domain | Any registrar, e.g. **Cloudflare Registrar** or **Namecheap** (~$10/year for a `.com`) | Needed for HTTPS. |

When creating the server, add your **SSH key** (Hetzner shows how) instead of a password.

## 2. Point the domain at the server

In your registrar's DNS settings add an **A record**: name `@` (or a subdomain such as `app`), value = the server's IPv4 address. Wait until `ping your-domain` shows that address (usually minutes).

If you use Cloudflare DNS, set the record to **DNS only** (grey cloud) for the first start, so the certificate can be issued.

## 3. Prepare the server (copy-paste, once)

```bash
ssh root@YOUR_SERVER_IP
apt update && apt -y upgrade
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
apt -y install unattended-upgrades && dpkg-reconfigure -f noninteractive unattended-upgrades
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 4. Copy the project to the server

From this PC (PowerShell), in the folder that contains `D:\files (2)`:

```bash
scp -r "D:\files (2)" root@YOUR_SERVER_IP:/opt/talktrading
```

(Large leftovers such as `.zip` files and `venv` are not needed on the server; you can skip or delete them there.)

## 5. Create the settings and start

```bash
cd /opt/talktrading/deploy
python3 scripts/make_env.py --domain your-domain.com --email you@example.com
docker compose up -d --build
```

The first build takes 10-15 minutes. Then open `https://your-domain.com` and create the first account.

`make_env.py` writes `deploy/.env` with strong random secrets. **Keep a copy of that file somewhere safe**: without it the database and logins cannot be recovered.

## 6. Backups (once)

```bash
crontab -e
# add this line:
30 3 * * * cd /opt/talktrading/deploy && sh scripts/backup.sh >> backups/backup.log 2>&1
```

Every night at 03:30 all databases and uploaded media are saved to `deploy/backups/` and kept for 14 days. Copy them off the server now and then (or enable Hetzner's automatic server backups, +20% of the server price).

## 7. Know when it is down (free)

Create a free monitor at **uptimerobot.com** for `https://your-domain.com/svc/story/health`. It emails you if the site stops answering.

---

## Everyday commands (in `/opt/talktrading/deploy`)

| Task | Command |
|---|---|
| See what is running | `docker compose ps` |
| Logs of one service | `docker compose logs -f --tail 100 post` |
| Restart everything | `docker compose restart` |
| Deploy new code | copy the changed folders, then `docker compose up -d --build` |
| Stop everything | `docker compose down` (data is kept) |
| Back up now | `sh scripts/backup.sh` |

**Restore** (after a disaster): put `env.backup` back as `.env`, `docker compose up -d db`, then
`gunzip -c backups/<date>/databases.sql.gz | docker compose exec -T db psql -U talktrading -d postgres`, unpack the three media archives into their volumes, and `docker compose up -d`.

---

## How it is put together

```
Internet ──HTTPS──> gateway (Caddy)  ── /            the React app
                                     ── /svc/post    Post (logins, posts, follows)
                                     ── /svc/story   Stories
                                     ── /svc/news    News
                                     ── /svc/chart   Prices
                                     ── /svc/e2ee    Encrypted chat (+ WebSocket)
                                     ── /svc/community  ┐ login checked by the gateway,
                                     ── /svc/explore    ┘ identity set by the gateway
              PostgreSQL (one database per service) · Redis (cache) · private network only
```

What the gateway does for safety:
- **Identity for Community and Explore comes only from a verified login.** Those services trust an `X-User-Id` header; the gateway deletes whatever the browser sends and sets it from the login token (checked by the Story service at `/internal/gateway-auth`, which is not reachable from outside). It also deletes `X-User-Roles`, so nobody can claim admin rights.
- **Login brute-force limit:** 10 login/sign-up attempts per minute per address; 900 API calls per minute per address overall.
- **Security headers:** HTTPS-only (HSTS), no framing, strict Content-Security-Policy, no MIME sniffing.
- **Logs never contain login tokens** (the chat WebSocket passes its token in the URL; it is stripped from logs).
- **Only ports 80/443 are open.** Databases and services are not reachable from the internet.

## Known limits (because Post, Chat, Explore and Community are not changed)

- **Password rules are enforced by the sign-up form only** (8+ characters, letters and numbers). The Post API itself accepts any password, so someone calling the API directly could still set a weak one.
- **Logins last 7 days** (`LOGIN_LIFETIME_MINUTES` in `.env`). There is no "log out everywhere" or password reset by email; if a token leaks it stays valid until it expires. Changing `JWT_SECRET` logs everyone out.
- **No email at all** (no verification, no password reset). A lost password currently needs manual help.
- **Community roles:** moderator/owner actions inside a community still rely on Community's own data; nobody can fake a role header any more.

## Before inviting people

- [ ] Site opens on `https://` with a valid certificate; `http://` redirects to it.
- [ ] Sign up, post with a photo, story, chat between two accounts, news, chart, community, explore all work.
- [ ] `docker compose ps` shows every service `running` / `healthy`.
- [ ] A backup has run once and you copied `.env` somewhere safe.
- [ ] UptimeRobot monitor created.
- [ ] A short **privacy notice** for your testers (what is stored: account, posts, stories, encrypted chat, uploaded media; where: your server). Have it checked if you are in the EU/UK (GDPR).
- [ ] `NEWS_API_KEY` set in `.env` (free key from finnhub.io) so news is live.
