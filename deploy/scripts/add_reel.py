"""
Publishes a reel whose video is hosted elsewhere (a CDN, cloud storage bucket, or any public HTTPS link
that serves the video file itself). The Reel service stores only the link, so this is how reels are added
during the beta. Uses the app's normal APIs and the account you sign in with becomes the reel's author.

  python3 scripts/add_reel.py --url https://your-domain.com --email team@your-domain.com \\
      --video https://cdn.example.com/nvda-breakout.mp4 --duration 42 \\
      --caption "NVDA reclaiming the 50 day" --tickers NVDA AMD [--poster https://cdn.example.com/nvda.jpg]

The password is asked for (or set TEAM_PASSWORD). Videos: MP4 (H.264) or WebM, vertical 9:16, up to 3 minutes.
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


def call(url, method="GET", token=None, body=None, form=None):
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
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers, method=method), timeout=20) as r:
                return r.status, json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            raw = e.read()
            if e.code == 429 and attempt < 5:   # the gateway allows 10 sign-ins a minute per address
                time.sleep(int(e.headers.get("Retry-After") or 15))
                continue
            try:
                return e.code, json.loads(raw)
            except ValueError:
                return e.code, raw.decode(errors="replace")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", required=True, help="the site address, e.g. https://talktrading.example.com")
    p.add_argument("--email", required=True, help="the account that posts the reel")
    p.add_argument("--video", required=True, help="public HTTPS link to the video file (.mp4 or .webm)")
    p.add_argument("--duration", required=True, type=float, help="length in seconds (up to 180)")
    p.add_argument("--caption", default="")
    p.add_argument("--tickers", nargs="*", default=[], help="symbols shown on the reel, e.g. NVDA BTC")
    p.add_argument("--poster", help="optional link to a still image shown before the video plays")
    args = p.parse_args()

    if not args.video.startswith("https://"):
        sys.exit("The video link must start with https:// (browsers block other links on an HTTPS site).")
    if not 0 < args.duration <= 180:
        sys.exit("Duration must be between 0 and 180 seconds.")
    mime = "video/webm" if args.video.lower().split("?")[0].endswith(".webm") else "video/mp4"
    base = args.url.rstrip("/")
    password = os.environ.get("TEAM_PASSWORD") or getpass.getpass(f"Password for {args.email}: ")

    status, body = call(f"{base}/svc/post/auth/login", "POST", form={"username": args.email, "password": password})
    if status != 200:
        sys.exit(f"Could not sign in ({status}): {body}")
    token = body["access_token"]

    status, body = call(f"{base}/svc/reel/api/v1/reels", "POST", token, {
        "caption": args.caption or None,
        "tags": [t.upper().lstrip("$") for t in args.tickers],
        "media": {"video_url": args.video, "thumbnail_url": args.poster, "duration": args.duration, "mime_type": mime},
    })
    if status not in (200, 201):
        sys.exit(f"The reel was not published ({status}): {body}")
    print(f"Published reel {body['data']['id']}. It is now first in {base}/reels")


if __name__ == "__main__":
    main()
