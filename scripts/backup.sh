#!/bin/sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:=/backups}"
mkdir -p "$BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$BACKUP_DIR/sapwms-$stamp.dump"
pg_dump --format=custom --no-owner --file="$target" "$DATABASE_URL"
sha256sum "$target" > "$target.sha256"
find "$BACKUP_DIR" -type f -name 'sapwms-*' -mtime +30 -delete
echo "$target"
