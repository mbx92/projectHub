#!/usr/bin/env bash
# Backup harian database OCN Project Hub (simpan minimal 30 hari).
# Pasang di cron server, mis.:  15 2 * * *  /opt/ocn-hub/scripts/backup-db.sh >> /var/log/ocn-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
mkdir -p "$BACKUP_DIR"

STAMP="$(TZ=Asia/Makassar date +%Y-%m-%d_%H%M)"
FILE="$BACKUP_DIR/projecthub_${STAMP}.dump"

pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$FILE"
# file bukti/dokumen privat ikut dicadangkan
if [ -d "${NUXT_STORAGE_DIR:-./storage}" ]; then
  tar -czf "$BACKUP_DIR/storage_${STAMP}.tar.gz" -C "$(dirname "${NUXT_STORAGE_DIR:-./storage}")" "$(basename "${NUXT_STORAGE_DIR:-./storage}")"
fi

find "$BACKUP_DIR" -type f \( -name 'projecthub_*.dump' -o -name 'storage_*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "[$(date -Iseconds)] backup OK: $FILE"
# Pulihkan: pg_restore --clean --no-owner --dbname="$DATABASE_URL" backups/projecthub_YYYY-MM-DD_HHMM.dump
