#!/bin/sh
# Beta moderation from the server, until there is an admin screen.
#   Run from the deploy folder:  sh scripts/moderate.sh <command> [id]
#
#   reports              open reports on reels and stories, newest first
#   recent               the 20 newest posts and reels, to spot problems nobody reported
#   hide-reel <id>       take a reel out of every feed (its open reports are closed)
#   restore-reel <id>    put a hidden reel back
#   hide-post <id>       hide a post (number from its /p/<id> link)
#   restore-post <id>    show a hidden post again
#   end-story <id>       end a story now (it leaves the tray; the owner keeps it in their archive)
#   close-story-reports <story id>   mark a story's reports as handled
#   user <username>      who an account is (email, sign-up date) for follow-up
#   stats                accounts and activity, in total and in the last 24 hours
set -eu
cd "$(dirname "$0")/.."
. ./.env
sql() { docker compose exec -T db psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -P pager=off -c "$2"; }
need_id() { [ -n "${1:-}" ] || { echo "Give the id, e.g.: sh scripts/moderate.sh $CMD 1234"; exit 1; }; }
# Reel moderation goes through the Reel service's own endpoint, so it writes its audit log.
reel_status() {
  docker compose exec -T reel python - "$1" "$2" "$3" <<'PY'
import json, os, sys, urllib.request
reel_id, status, action = sys.argv[1:4]
req = urllib.request.Request(
    f"http://127.0.0.1:8005/api/v1/moderation/reels/{reel_id}/action",
    data=json.dumps({"action": action, "reason": "beta moderation", "new_reel_status": status}).encode(),
    headers={"Content-Type": "application/json", "X-Service-API-Key": os.environ["SERVICE_API_KEY"]},
    method="POST",
)
print(json.load(urllib.request.urlopen(req))["data"]["status"])
PY
}

CMD=${1:-help}
case "$CMD" in
  reports)
    echo "== Reels"
    sql reel "SELECT r.created_at::timestamp(0) AS reported, r.reel_id, r.reason, left(coalesce(r.description,''),60) AS details, left(coalesce(l.caption,''),40) AS caption
              FROM reel_reports r JOIN reels l ON l.id = r.reel_id WHERE r.status = 'PENDING' ORDER BY r.created_at DESC"
    echo "== Stories"
    sql story "SELECT r.created_at::timestamp(0) AS reported, r.story_id, r.reason, left(coalesce(r.details,''),60) AS details, s.expires_at > now() AS still_live
               FROM story_reports r LEFT JOIN stories s ON s.id = r.story_id WHERE r.status = 'open' ORDER BY r.created_at DESC" ;;
  recent)
    echo "== Posts"
    sql post "SELECT p.id, p.created_at::timestamp(0) AS posted, u.username, left(coalesce(p.caption,''),70) AS caption, p.status
              FROM posts p LEFT JOIN users u ON u.author_id = p.author_id ORDER BY p.created_at DESC LIMIT 20"
    echo "== Reels"
    sql reel "SELECT id, created_at::timestamp(0) AS posted, left(coalesce(caption,''),70) AS caption, status FROM reels ORDER BY created_at DESC LIMIT 20" ;;
  hide-reel) need_id "${2:-}"; reel_status "$2" restricted takedown ;;
  restore-reel) need_id "${2:-}"; reel_status "$2" active approve ;;
  hide-post) need_id "${2:-}"; sql post "UPDATE posts SET status = 'HIDDEN' WHERE id = $(printf '%d' "$2")" ;;
  restore-post) need_id "${2:-}"; sql post "UPDATE posts SET status = 'ACTIVE' WHERE id = $(printf '%d' "$2")" ;;
  end-story) need_id "${2:-}"; sql story "UPDATE stories SET expires_at = now() WHERE id = '$(echo "$2" | tr -cd '0-9a-f-')'" ;;
  close-story-reports) need_id "${2:-}"; sql story "UPDATE story_reports SET status = 'closed' WHERE story_id = '$(echo "$2" | tr -cd '0-9a-f-')'" ;;
  user) need_id "${2:-}"; sql post "SELECT username, display_name, email, created_at::timestamp(0) AS joined, author_id FROM users WHERE lower(username) = lower('$(echo "$2" | tr -cd 'A-Za-z0-9_.-')')" ;;
  stats)
    day="created_at > now() - interval '24 hours'"
    n() { docker compose exec -T db psql -U "$POSTGRES_USER" -d "$1" -Atc "SELECT count(*), count(*) FILTER (WHERE $day) FROM $2" | tr '|' ' '; }
    printf '%-22s %8s %8s\n' "" total "last 24h"
    for row in "Accounts:post:users" "Posts:post:posts" "Comments:post:comments" "Follows:post:follows" \
               "Stories:story:stories" "Reels:reel:reels" "Chat messages:e2e:messages" "Communities:community:communities"; do
      label=${row%%:*}; rest=${row#*:}; set -- $(n "${rest%%:*}" "${rest#*:}")
      printf '%-22s %8s %8s\n' "$label" "$1" "$2"
    done ;;
  *) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
