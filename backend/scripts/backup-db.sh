#!/usr/bin/env bash
# Dumps the Voltx Postgres database to a timestamped, gzip-compressed file.
#
# Usage:
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/backup-db.sh [output-dir]
#
# Requires the `pg_dump` client (matching or newer than the server's major
# version) on PATH. Intended to be invoked by whatever scheduler your
# deployment already uses (cron, a CI scheduled workflow, a Kubernetes
# CronJob, etc.) — this script only does the dump, on-demand or on a
# schedule, plus rotation; it doesn't stand up a schedule itself, since
# that's the deployment target's job, not this repo's.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

OUTPUT_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_FILE="${OUTPUT_DIR}/voltx-${TIMESTAMP}.sql.gz"

mkdir -p "${OUTPUT_DIR}"

echo "Backing up database to ${OUTPUT_FILE}..."
pg_dump --format=plain --no-owner --no-privileges "${DATABASE_URL}" | gzip > "${OUTPUT_FILE}"
echo "Backup complete: $(du -h "${OUTPUT_FILE}" | cut -f1)"

echo "Pruning backups older than ${RETENTION_DAYS} days..."
find "${OUTPUT_DIR}" -name 'voltx-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete -print
