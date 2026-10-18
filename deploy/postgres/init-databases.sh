#!/bin/sh
# Runs once, when the database volume is first created: one database per service, all owned by the app user.
set -e
for db in post story news chart e2e community explore reel; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -c "CREATE DATABASE $db OWNER \"$POSTGRES_USER\";"
done
