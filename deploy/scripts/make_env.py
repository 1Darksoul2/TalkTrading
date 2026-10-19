"""
Creates deploy/.env with strong random secrets.

  python scripts/make_env.py --domain talktrading.example.com --email you@example.com
  python scripts/make_env.py --local          # trial run on this computer at http://localhost:8088

Refuses to overwrite an existing .env (that would lock everyone out and orphan the database).
"""
import argparse
import os
import secrets
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(HERE, "..", ".env")
NEWS_ENV = os.path.join(HERE, "..", "..", "backend", "news-service", ".env")


def existing_news_key():
    """Reuse the News API key already configured for local development, if there is one."""
    try:
        for line in open(NEWS_ENV, encoding="utf-8"):
            if line.startswith("NEWS_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return ""


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--domain", help="the domain users will open, e.g. talktrading.example.com")
    p.add_argument("--email", help="your email, for the free HTTPS certificate (Let's Encrypt)")
    p.add_argument("--local", action="store_true", help="trial run on this computer, plain http on port 8088")
    p.add_argument("--news-key", default=None, help="News API key (default: reuse backend/news-service/.env)")
    args = p.parse_args()

    if os.path.exists(ENV_PATH):
        sys.exit(f"{os.path.normpath(ENV_PATH)} already exists. Delete it yourself first if you really want new secrets.")
    if not args.local and not (args.domain and args.email):
        sys.exit("Give --domain and --email (or --local for a trial on this computer).")

    if args.local:
        site, public, http_port, https_port = ":80", "http://localhost:8088", "8088", "8443"
    else:
        domain = args.domain.strip().lower().removeprefix("https://").removeprefix("http://").rstrip("/")
        site, public, http_port, https_port = domain, f"https://{domain}", "80", "443"

    news_key = args.news_key if args.news_key is not None else existing_news_key()
    values = {
        "SITE_ADDRESS": site,
        "PUBLIC_URL": public,
        "ACME_EMAIL": args.email or "unused@example.invalid",   # certificates are only requested for a real domain
        # Where testers send feedback, reports and privacy requests (shown in the app).
        "SUPPORT_EMAIL": args.email or "",
        "HTTP_PORT": http_port,
        "HTTPS_PORT": https_port,
        "POSTGRES_USER": "talktrading",
        "POSTGRES_PASSWORD": secrets.token_hex(24),
        # Signs every login token; shared by Post (issues them) and Story/News/Chat (check them).
        "JWT_SECRET": secrets.token_hex(32),
        # Lets trusted internal callers moderate reels (never sent to browsers).
        "REEL_SERVICE_API_KEY": secrets.token_hex(32),
        # How long a login lasts (minutes). 10080 = 7 days.
        "LOGIN_LIFETIME_MINUTES": "10080",
        "NEWS_PROVIDER": "finnhub",
        "NEWS_API_KEY": news_key,
    }
    with open(ENV_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("# TalkTrading production settings. Keep this file private and backed up.\n")
        for k, v in values.items():
            f.write(f"{k}={v}\n")
        f.write(
            "\n# News: put your Finnhub key in NEWS_API_KEY above (free at https://finnhub.io).\n"
            "# Prices and charts come from TradingView and need no key.\n"
            "\n# Password-reset emails. Fill these in, then run: docker compose up -d\n"
            "# (until then, reset links are written to: docker compose logs post)\n"
            "SMTP_HOST=\n"
            "SMTP_PORT=587\n"
            "SMTP_USER=\n"
            "SMTP_PASSWORD=\n"
            f"SMTP_FROM=TalkTrading <no-reply@{(args.domain or 'talktrading.app').strip().lower().removeprefix('https://').removeprefix('http://').rstrip('/')}>\n"
        )
    print(f"Wrote {os.path.normpath(ENV_PATH)} for {public}")
    if not news_key:
        print("Note: NEWS_API_KEY is empty - add a free key from https://finnhub.io to show live news.")


if __name__ == "__main__":
    main()
