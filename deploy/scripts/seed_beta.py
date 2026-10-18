"""
Gives a fresh TalkTrading a starting point for beta testers: a team account, a pinned-style
welcome post, and a few starter communities. Uses only the public APIs, like the app does.
Safe to run again: existing accounts and communities are reused, not duplicated.

  python3 scripts/seed_beta.py --url https://your-domain.com --username talktrading_team --email you@example.com
  python3 scripts/seed_beta.py --url http://localhost:8088 ...      (a --local trial)

The password is asked for (or set TEAM_PASSWORD). The account is a normal account you can log in with.
"""
import argparse
import getpass
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

COMMUNITIES = [
    ("Welcome & Feedback", "Say hi, ask questions about the beta, and tell the team what to fix next."),
    ("Stocks & Indices", "US, Indian and global equities: setups, earnings, index levels."),
    ("Crypto", "BTC, ETH and alts. Charts and on-chain, not shilling."),
    ("Forex & Commodities", "Currency pairs, gold, oil and macro drivers."),
    ("Options & Derivatives", "Strategies, flow and risk management for F&O traders."),
]

WELCOME = (
    "Welcome to the TalkTrading beta!\n\n"
    "Share trade ideas with $TICKERS and #hashtags, post short chart reels, chat privately (end-to-end encrypted), "
    "and join a community below.\n\n"
    "Found a bug or have an idea? Account menu → Send feedback. "
    "Everything here is opinion, not financial advice. #welcome"
)


def call(base, method, path, token=None, body=None, form=None):
    headers = {}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    if form is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        data = urllib.parse.urlencode(form).encode()
    for attempt in range(6):
        req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as e:
            raw = e.read()
            # The gateway allows 10 sign-in calls a minute per address; wait it out.
            if e.code == 429 and attempt < 5:
                wait = int(e.headers.get("Retry-After") or 15)
                print(f"  (rate limited, waiting {wait}s)")
                time.sleep(wait)
                continue
            try:
                return e.code, json.loads(raw)
            except ValueError:
                return e.code, raw.decode(errors="replace")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", required=True, help="the site address, e.g. https://talktrading.example.com")
    p.add_argument("--username", default="talktrading_team")
    p.add_argument("--email", required=True)
    p.add_argument("--display-name", default="TalkTrading Team")
    args = p.parse_args()
    base = args.url.rstrip("/")
    password = os.environ.get("TEAM_PASSWORD") or getpass.getpass("Password for the team account (8+ characters): ")
    if len(password) < 8:
        sys.exit("Use at least 8 characters.")

    post, comm = f"{base}/svc/post", f"{base}/svc/community"

    status, body = call(post, "POST", "/auth/register", body={
        "username": args.username, "email": args.email, "password": password, "display_name": args.display_name})
    if status == 200:
        print(f"Created account @{args.username}")
    elif status == 409:
        print(f"Account @{args.username} or {args.email} already exists; signing in to it")
    else:
        sys.exit(f"Could not create the account ({status}): {body}")

    status, body = call(post, "POST", "/auth/login", form={"username": args.email, "password": password})
    if status != 200:
        sys.exit(f"Could not sign in ({status}): {body}. If the account exists, check the password.")
    token = body["access_token"]

    status, me = call(post, "GET", "/api/v1/users/me", token)
    status, mine = call(post, "GET", f"/api/v1/posts/?author_id={me['author_id']}&limit=50", token)
    if any("Welcome to the TalkTrading beta" in (p.get("caption") or "") for p in (mine or [])):
        print("Welcome post already there")
    else:
        status, body = call(post, "POST", "/api/v1/posts/", token, {"caption": WELCOME, "visibility": "public"})
        print("Posted the welcome post" if status in (200, 201) else f"Welcome post failed ({status}): {body}")

    for name, description in COMMUNITIES:
        status, found = call(comm, "GET", f"/api/v1/communities?search={urllib.parse.quote(name)}&page=0&size=20", token)
        if status == 200 and any(c.get("name") == name for c in found.get("content", [])):
            print(f"Community '{name}' already there")
            continue
        status, body = call(comm, "POST", "/api/v1/communities", token, {"name": name, "description": description})
        print(f"Created community '{name}'" if status in (200, 201) else f"Community '{name}' failed ({status}): {body}")

    print(f"\nDone. Sign in as @{args.username} to answer questions in 'Welcome & Feedback'.")


if __name__ == "__main__":
    main()
