#!/usr/bin/env bash
# Nightly Postgres backup for climate-gb.
# Requires rclone configured with remote 'b2' (Backblaze) or adjust remote name.
# Install: chmod +x bin/pg-backup.sh; add to crontab per docs/deploy-runbook.md §0.12.

set -euo pipefail

PROJECT_DIR="${CLIMATE_GB_DIR:-/opt/climate-gb}"
BACKUP_DIR="${PROJECT_DIR}/db/backups"
REMOTE="${BACKUP_REMOTE:-b2:climate-gb-backups}"
STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
DUMP="${BACKUP_DIR}/climate_gb_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -u -Iseconds)] Starting backup → ${DUMP}"

docker compose -f "${PROJECT_DIR}/docker-compose.yml" exec -T postgres \
  pg_dump -U climate_gb -d climate_gb --format=plain --no-owner \
  | gzip > "$DUMP"

SIZE=$(du -h "$DUMP" | cut -f1)
echo "[$(date -u -Iseconds)] Dump size: ${SIZE}"

echo "[$(date -u -Iseconds)] Uploading to ${REMOTE}"
rclone copy "$DUMP" "${REMOTE}/" --progress

echo "[$(date -u -Iseconds)] Pruning local dumps older than 7 days"
find "$BACKUP_DIR" -name '*.sql.gz' -mtime +7 -delete

echo "[$(date -u -Iseconds)] Pruning remote dumps older than 90 days"
rclone delete "${REMOTE}/" --min-age 90d

echo "[$(date -u -Iseconds)] Backup complete"
