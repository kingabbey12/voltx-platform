#!/usr/bin/env bash
# ── Voltx Backup Integrity Verification ──────────────────────────────
# Restores the most recent backup archive into a disposable database and
# proves it is usable. This is the scheduled, unattended equivalent of
# restore-drill.sh: that one seeds its own known data, this one validates
# whatever the nightly backup actually captured.
#
# Exits non-zero on any failure so cron/alerting can act on it.
#
#   ./scripts/verify-latest-backup.sh [backup-dir]
set -uo pipefail

# Exclusive across backup and verification alike: two writers to the same
# archive directory, or a verification racing a half-written dump, are the
# failure modes this prevents. Portable — no flock dependency.
# shellcheck source=./with-lock.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/with-lock.sh"
acquire_lock voltx-backup || exit 0

BACKUP_DIR="${1:-${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}}"
PG_CONTAINER="${PG_CONTAINER:-deploy-postgres-1}"
PG_USER="${POSTGRES_USER:-voltx}"
VERIFY_DB="${VERIFY_DB:-voltx_backup_verify}"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# shellcheck source=./write-metric.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/write-metric.sh"

publish() {
  write_metrics voltx_backup_verify <<METRICS
# HELP voltx_backup_verify_last_timestamp_seconds Unix time of the last integrity verification attempt.
# TYPE voltx_backup_verify_last_timestamp_seconds gauge
voltx_backup_verify_last_timestamp_seconds $(date +%s)
# HELP voltx_backup_verify_last_success Whether the last integrity verification passed (1) or failed (0).
# TYPE voltx_backup_verify_last_success gauge
voltx_backup_verify_last_success $1
METRICS
}

log()  { echo "[verify ${STAMP}] $*"; }
fail() { echo "[verify ${STAMP}] FAIL: $*" >&2; publish 0; exit 1; }

ARCHIVE="$(ls -1t "${BACKUP_DIR}"/voltx-*.sql.gz 2>/dev/null | head -n1 || true)"
[ -n "$ARCHIVE" ] || fail "no backup archive found in ${BACKUP_DIR}"
log "archive: $(basename "$ARCHIVE") ($(du -h "$ARCHIVE" | cut -f1))"

# Freshness: an archive that stopped being produced is the failure this whole
# schedule exists to catch, and it is invisible if we only check readability.
MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-48}"
if [ "$(find "$ARCHIVE" -mmin +$((MAX_AGE_HOURS * 60)) | wc -l)" -gt 0 ]; then
  fail "latest backup is older than ${MAX_AGE_HOURS}h — the schedule may not be running"
fi

log "1/5 decompress"
gzip -t "$ARCHIVE" || fail "archive fails gzip integrity check"

log "2/5 dump readable"
# Read the header into a variable rather than piping through `head`: under
# `pipefail`, head closing the pipe early makes gunzip exit on SIGPIPE and
# poisons the pipeline's status even when the content is perfectly fine.
DUMP_HEAD="$(gunzip -c "$ARCHIVE" 2>/dev/null | dd bs=4096 count=1 2>/dev/null || true)"
printf '%s' "$DUMP_HEAD" | grep -qiE "postgresql database dump|^CREATE |^SET " \
  || fail "archive does not look like a readable SQL dump"

log "3/5 restore into ${VERIFY_DB}"
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS ${VERIFY_DB};" -c "CREATE DATABASE ${VERIFY_DB};" >/dev/null \
  || fail "could not provision ${VERIFY_DB}"
if ! gunzip -c "$ARCHIVE" | docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$VERIFY_DB" -q >/dev/null 2>&1; then
  fail "restore into ${VERIFY_DB} failed"
fi

log "4/5 structural checks"
query() { docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$VERIFY_DB" -tAc "$1" 2>/dev/null | tr -d ' '; }

TABLES="$(query "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
[ "${TABLES:-0}" -gt 0 ] || fail "restored database has no tables"

FKS="$(query "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public';")"
[ "${FKS:-0}" -gt 0 ] || fail "restored database has no foreign keys"

INDEXES="$(query "SELECT count(*) FROM pg_indexes WHERE schemaname='public';")"
[ "${INDEXES:-0}" -gt 0 ] || fail "restored database has no indexes"

SEQUENCES="$(query "SELECT count(*) FROM information_schema.sequences WHERE sequence_schema='public';")"

# Known-data validation: the RBAC catalogue is seeded on every environment, so
# an empty permissions table means the dump captured a schema with no content.
PERMISSIONS="$(query "SELECT count(*) FROM permissions;")"
[ "${PERMISSIONS:-0}" -gt 0 ] || fail "restored database has no permission rows — dump may be schema-only"

ORGS="$(query "SELECT count(*) FROM organizations;")"

log "    tables=${TABLES} fks=${FKS} indexes=${INDEXES} sequences=${SEQUENCES} permissions=${PERMISSIONS} organizations=${ORGS}"

log "5/5 cleanup"
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS ${VERIFY_DB};" >/dev/null || true

publish 1
log "PASS — $(basename "$ARCHIVE") restores cleanly and is structurally intact"
