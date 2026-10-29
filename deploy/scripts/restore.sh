#!/bin/sh
# Put a backup made by backup.sh back. EVERYTHING currently in the databases and uploads is replaced.
#   Run from the deploy folder:  sh scripts/restore.sh backups/20261019-0330
set -eu
cd "$(dirname "$0")/.."
SRC=${1:-}
[ -n "$SRC" ] && [ -f "$SRC/databases.sql.gz" ] || { echo "Usage: sh scripts/restore.sh backups/<folder>   (folders: $(ls backups 2>/dev/null | tr '\n' ' '))"; exit 1; }
. ./.env
echo "This replaces ALL current data with the backup in $SRC."
printf 'Type RESTORE to continue: '
read answer
[ "$answer" = "RESTORE" ] || { echo "Nothing changed."; exit 1; }

docker compose stop
# A fresh, empty database volume, then the dump (it recreates every database and table).
docker compose rm -f db
docker volume rm "talktrading_pg_data"
docker compose up -d db
until docker compose exec -T db pg_isready -U "$POSTGRES_USER" -d postgres >/dev/null 2>&1; do sleep 2; done
sleep 3   # the image's first-start scripts create the empty service databases; let them finish
for db in post story news chart e2e community explore reel; do
  docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -q -c "DROP DATABASE IF EXISTS $db;"
done
gunzip -c "$SRC/databases.sql.gz" | docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -q -v ON_ERROR_STOP=0 >/dev/null

# Uploaded photos and videos
for archive in "$SRC"/*.tar.gz; do
  vol=$(basename "$archive" .tar.gz)
  docker run --rm -v "talktrading_$vol:/data" -v "$PWD/$SRC:/in:ro" alpine sh -c "find /data -mindepth 1 -delete && tar xzf /in/$vol.tar.gz -C /data"
done

docker compose up -d
echo "Restored $SRC. Check the site, then keep an eye on: docker compose logs -f --tail=50"
