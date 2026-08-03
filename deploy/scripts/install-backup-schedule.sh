#!/usr/bin/env bash
# ── Voltx Backup Schedule Installer ──────────────────────────────────
# Renders deploy/crontab for this machine (absolute paths, real directories)
# and installs it. Exists because the template's placeholders used to be
# installed verbatim, producing a schedule that failed on every run.
#
#   ./scripts/install-backup-schedule.sh --print   # preview, change nothing
#   ./scripts/install-backup-schedule.sh           # install for current user
#
# Environment:
#   BACKUP_DIR       where archives are written  (default: deploy/backups)
#   LOG_DIR          where job logs are written  (default: deploy/logs)
#   LOCK_DIR         where the flock lives       (default: /tmp)
#   RETENTION_DAYS   daily retention             (default: 14)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE="${DEPLOY_DIR}/crontab"

BACKUP_DIR="${BACKUP_DIR:-${DEPLOY_DIR}/backups}"
LOG_DIR="${LOG_DIR:-${DEPLOY_DIR}/logs}"
LOCK_DIR="${LOCK_DIR:-/tmp}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

[ -f "$TEMPLATE" ] || { echo "Missing template: $TEMPLATE" >&2; exit 1; }

render() {
  sed -e "s|__DEPLOY_DIR__|${DEPLOY_DIR}|g" \
      -e "s|__BACKUP_DIR__|${BACKUP_DIR}|g" \
      -e "s|__LOG_DIR__|${LOG_DIR}|g" \
      -e "s|__LOCK_DIR__|${LOCK_DIR}|g" \
      -e "s|__RETENTION_DAYS__|${RETENTION_DAYS}|g" \
      "$TEMPLATE"
}

if [ "${1:-}" = "--print" ]; then
  render
  exit 0
fi

# Locking is intrinsic to the jobs (scripts/with-lock.sh, atomic mkdir), so
# there is no external dependency to check here. This previously required
# `flock` and refused to install without it — which on macOS meant the
# backup schedule was never installed at all, and the database it was meant
# to protect went unbacked-up. A guard that blocks the thing it protects is
# worse than the risk it guards against.
[ -f "${SCRIPT_DIR}/with-lock.sh" ] || {
  echo "Missing ${SCRIPT_DIR}/with-lock.sh — the jobs cannot lock without it." >&2
  exit 1
}

mkdir -p "$BACKUP_DIR" "$LOG_DIR"
# Backups and their logs can contain business data; keep them owner-only.
chmod 700 "$BACKUP_DIR" "$LOG_DIR"

RENDERED="$(mktemp)"
trap 'rm -f "$RENDERED"' EXIT
render > "$RENDERED"

if grep -q "__[A-Z_]*__" "$RENDERED"; then
  echo "Unsubstituted placeholders remain — refusing to install:" >&2
  grep -o "__[A-Z_]*__" "$RENDERED" | sort -u >&2
  exit 1
fi

crontab "$RENDERED"
echo "Installed. Active schedule:"
crontab -l | grep -E "^[0-9]" | sed 's/^/  /'
echo ""
echo "  backups → ${BACKUP_DIR}"
echo "  logs    → ${LOG_DIR}"
echo "  lock    → ${LOCK_DIR}/voltx-backup.lock (atomic mkdir, no flock needed)"
echo "  daily retention → ${RETENTION_DAYS} days"
