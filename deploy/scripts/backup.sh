#!/bin/sh
# Nightly backup: every database plus all uploaded photos/videos, kept for 14 days.
#   Run from the deploy folder:  sh scripts/backup.sh
#   Schedule (crontab -e):       30 3 * * * cd /opt/talktrading/deploy && sh scripts/backup.sh >> backups/backup.log 2>&1
set -eu
cd "$(dirname "$0")/.."
. ./.env
STAMP=$(date +%Y%m%d-%H%M)
DEST="backups/$STAMP"
mkdir -p "$DEST"

# Databases (consistent dump of all of them, compressed)
docker compose exec -T db pg_dumpall -U "$POSTGRES_USER" | gzip > "$DEST/databases.sql.gz"

# Uploaded media, straight from the named volumes
for vol in post_uploads story_media community_uploads reel_media; do
  docker run --rm -v "talktrading_$vol:/data:ro" -v "$PWD/$DEST:/out" alpine \
    tar czf "/out/$vol.tar.gz" -C /data .
done

# The settings file holds the secrets needed to read the backup back in
cp .env "$DEST/env.backup"
chmod -R go-rwx "$DEST"

# Keep 14 days
find backups -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "Backup written to $DEST ($(du -sh "$DEST" | cut -f1))"
