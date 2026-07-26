#!/usr/bin/env bash
# ── Voltx Database Restore ───────────────────────────────────────────
# Restores a gzip-compressed pg_dump produced by backup.sh. The counterpart
# that makes backup.sh meaningful: an untested restore is a hypothesis, not a
# recovery capability.
#
# Usage — Docker mode (default when a compose file is present):
#   cd deploy && ./scripts/restore.sh backups/voltx-20260726T030000Z.sql.gz
#
# Usage — Direct mode:
#   DATABASE_URL=postgresql://user:pass@host:5432/db \
#     ./scripts/restore.sh --direct backups/voltx-....sql.gz
#
# Safety: this DROPs and recreates the target schema. It refuses to run
# against a database whose name does not match --expect-db unless --force is
# given, so a mistyped target cannot silently destroy production.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
ENV_FILE="${DEPLOY_DIR}/.env"

MODE=""
FORCE=false
EXPECT_DB=""
ARCHIVE=""

info()  { echo "[restore] $*"; }
error() { echo "[restore] ERROR: $*" >&2; exit 1; }

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ] || [ $# -eq 0 ]; then
  cat <<USAGE
Usage: ./scripts/restore.sh [--docker|--direct] [--expect-db NAME] [--force] ARCHIVE

Restore a backup produced by backup.sh. Drops and recreates the public schema.

Modes:
  --docker   Restore via docker compose exec (default when compose file exists)
  --direct   Restore via psql using DATABASE_URL

Options:
  --expect-db NAME  Abort unless the target database is named NAME
  --force           Skip the confirmation prompt (required for automation)

Environment:
  DATABASE_URL   Required for --direct mode
USAGE
  exit 0
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --docker) MODE="docker"; shift ;;
    --direct) MODE="direct"; shift ;;
    --force)  FORCE=true; shift ;;
    --expect-db) EXPECT_DB="${2:-}"; shift 2 ;;
    *) ARCHIVE="$1"; shift ;;
  esac
done

[ -n "$ARCHIVE" ] || error "No archive given. See --help."
[ -f "$ARCHIVE" ] || error "Archive not found: $ARCHIVE"

if [ -z "$MODE" ]; then
  if [ -f "$COMPOSE_FILE" ] && command -v docker >/dev/null 2>&1; then
    MODE="docker"
  else
    MODE="direct"
  fi
fi

# ── Integrity check before touching the database ─────────────────────
# A truncated archive must be discovered now, not halfway through a restore
# that has already dropped the schema.
info "Verifying archive integrity..."
gzip -t "$ARCHIVE" || error "Archive is corrupt (failed gzip integrity check): $ARCHIVE"
info "Archive integrity OK ($(du -h "$ARCHIVE" | cut -f1))."

# ── Resolve target ───────────────────────────────────────────────────
if [ "$MODE" = "direct" ]; then
  [ -n "${DATABASE_URL:-}" ] || error "--direct requires DATABASE_URL"
  TARGET_DB="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')"
  DESCRIBE="$TARGET_DB (direct)"
else
  # shellcheck disable=SC1090
  [ -f "$ENV_FILE" ] && set -a && . "$ENV_FILE" && set +a
  TARGET_DB="${POSTGRES_DB:-voltx}"
  DESCRIBE="$TARGET_DB (docker compose)"
fi

if [ -n "$EXPECT_DB" ] && [ "$TARGET_DB" != "$EXPECT_DB" ]; then
  error "Refusing to restore: target database is '$TARGET_DB', expected '$EXPECT_DB'."
fi

info "Restore target: $DESCRIBE"
info "Archive:        $ARCHIVE"

if [ "$FORCE" != true ]; then
  echo ""
  echo "  This DROPS the public schema of '$TARGET_DB' and replaces it."
  printf "  Type the database name to confirm: "
  read -r CONFIRM
  [ "$CONFIRM" = "$TARGET_DB" ] || error "Confirmation did not match. Aborted."
fi

# ── Restore ──────────────────────────────────────────────────────────
# DROP SCHEMA ... CASCADE then recreate, rather than dropping the database:
# the connection performing the restore is itself attached to it, and pg_dump
# archives from backup.sh are schema-scoped (--no-owner --no-privileges).
RESET_SQL='DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'

if [ "$MODE" = "direct" ]; then
  command -v psql >/dev/null 2>&1 || error "psql not found (needed for --direct)"
  info "Resetting schema..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$RESET_SQL" >/dev/null
  info "Loading archive..."
  gunzip -c "$ARCHIVE" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null
else
  PSQL=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres
        psql -U "${POSTGRES_USER:-voltx}" -d "$TARGET_DB" -v ON_ERROR_STOP=1)
  info "Resetting schema..."
  "${PSQL[@]}" -c "$RESET_SQL" >/dev/null
  info "Loading archive..."
  gunzip -c "$ARCHIVE" | "${PSQL[@]}" >/dev/null
fi

# ── Post-restore verification ────────────────────────────────────────
# A restore that "succeeded" but produced an empty schema is the failure mode
# worth catching, so report what actually landed.
COUNT_SQL="SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
if [ "$MODE" = "direct" ]; then
  TABLE_COUNT="$(psql "$DATABASE_URL" -tAc "$COUNT_SQL")"
else
  TABLE_COUNT="$("${PSQL[@]}" -tAc "$COUNT_SQL" | tr -d '[:space:]')"
fi

[ "${TABLE_COUNT:-0}" -gt 0 ] || error "Restore completed but the schema is empty — treat as FAILED."

info "Restore complete: ${TABLE_COUNT} tables in schema 'public' of '${TARGET_DB}'."
info "Next: run 'pnpm prisma:migrate:deploy' if the archive predates current migrations."
