#!/usr/bin/env bash
# ── Voltx Database Backup ────────────────────────────────────────────
# Dumps the Postgres database (via Docker Compose exec or direct
# pg_dump) to a timestamped, gzip-compressed file with configurable
# retention. Designed to work both as part of the deploy pipeline
# (pre-migration) and as a standalone scheduled backup.
#
# Usage — Docker mode (recommended):
#   cd deploy && ./scripts/backup.sh
#
# Usage — Direct pg_dump mode:
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/backup.sh
#
# Scheduled via cron (add to crontab -e):
#   BACKUP_DIR=/var/voltx/backups 0 3 * * * /path/to/deploy/scripts/backup.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
ENV_FILE="${DEPLOY_DIR}/.env"

OUTPUT_DIR="${BACKUP_DIR:-${DEPLOY_DIR}/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_FILE="${OUTPUT_DIR}/voltx-${TIMESTAMP}.sql.gz"

# ── Help ─────────────────────────────────────────────────────────────
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<USAGE
Usage: ./scripts/backup.sh [--docker|--direct] [output-dir]

Backup the Voltx Postgres database.

Modes:
  --docker   Use docker compose exec (default if COMPOSE_FILE exists)
  --direct   Use pg_dump with DATABASE_URL (must be set)

Arguments:
  output-dir   Backup destination (default: ./backups/ or \$BACKUP_DIR)

Environment:
  BACKUP_DIR              Output directory (default: deploy/backups/)
  BACKUP_RETENTION_DAYS   Retention in days (default: 14)
  DATABASE_URL            Required for --direct mode
USAGE
  exit 0
fi

# ── Detect mode ──────────────────────────────────────────────────────
if [ "${1:-}" = "--direct" ]; then
  MODE="direct"
  shift
elif [ "${1:-}" = "--docker" ]; then
  MODE="docker"
  shift
elif [ -f "$COMPOSE_FILE" ] && command -v docker >/dev/null 2>&1; then
  MODE="docker"
else
  MODE="direct"
fi

# ── Override output dir from positional arg ──────────────────────────
if [ -n "${1:-}" ]; then
  OUTPUT_DIR="$1"
fi

mkdir -p "${OUTPUT_DIR}"

echo "[backup] Starting database backup at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "[backup] Mode:       ${MODE}"
echo "[backup] Output:     ${OUTPUT_FILE}"
echo "[backup] Retention:  ${RETENTION_DAYS} days"

# ── Perform the dump ─────────────────────────────────────────────────
case "${MODE}" in
  docker)
    # Ensure the database service is running
    if ! docker compose -f "$COMPOSE_FILE" ps --status running --format json 2>/dev/null | grep -q '"postgres"'; then
      echo "[backup] WARNING: postgres container is not running — attempting to start..."
      docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres 2>/dev/null || {
        echo "[backup] ERROR: Could not start postgres container" >&2
        exit 1
      }
      # Wait for it to be healthy
      for i in $(seq 1 15); do
        if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${POSTGRES_USER:-voltx}" -d "${POSTGRES_DB:-voltx}" 2>/dev/null; then
          break
        fi
        if [ "$i" -eq 15 ]; then
          echo "[backup] ERROR: postgres did not become healthy" >&2
          exit 1
        fi
        sleep 2
      done
    fi

    echo "[backup] Running pg_dump via docker compose exec..."
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
      pg_dump --format=plain --no-owner --no-privileges \
      -U "${POSTGRES_USER:-voltx}" -d "${POSTGRES_DB:-voltx}" 2>/dev/null \
    | gzip > "${OUTPUT_FILE}"
    ;;
  direct)
    if [ -z "${DATABASE_URL:-}" ]; then
      echo "[backup] ERROR: DATABASE_URL is required for --direct mode" >&2
      echo "[backup] Usage: DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/backup.sh" >&2
      exit 1
    fi
    echo "[backup] Running pg_dump via direct connection..."
    pg_dump --format=plain --no-owner --no-privileges "${DATABASE_URL}" | gzip > "${OUTPUT_FILE}"
    ;;
esac

# ── Verify the backup ────────────────────────────────────────────────
if [ ! -f "${OUTPUT_FILE}" ]; then
  echo "[backup] ERROR: Backup file was not created" >&2
  exit 1
fi

BACKUP_SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
echo "[backup] Backup complete: ${BACKUP_SIZE}"

# Quick integrity check: verify the gzip file is valid
if ! gzip -t "${OUTPUT_FILE}" 2>/dev/null; then
  echo "[backup] ERROR: Backup file is corrupted (gzip check failed)" >&2
  rm -f "${OUTPUT_FILE}"
  exit 1
fi
echo "[backup] Integrity check passed"

# ── Prune old backups ────────────────────────────────────────────────
echo "[backup] Pruning backups older than ${RETENTION_DAYS} days..."
PRUNED=$(find "${OUTPUT_DIR}" -name 'voltx-*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete 2>/dev/null || true)
if [ -n "$PRUNED" ]; then
  echo "[backup] Removed:"
  echo "$PRUNED" | sed 's/^/  /'
fi

echo "[backup] Done at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
