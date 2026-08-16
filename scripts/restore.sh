#!/bin/sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${1:?Usage: restore.sh backup.dump}"
backup=$1
test -f "$backup"
test -f "$backup.sha256"
sha256sum -c "$backup.sha256"
test "${CONFIRM_RESTORE:-}" = "RESTORE" || { echo "Set CONFIRM_RESTORE=RESTORE to continue"; exit 2; }
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$backup"
./node_modules/.bin/prisma migrate deploy
