#!/usr/bin/env bash
# ── Portable exclusive lock ──────────────────────────────────────────
# `mkdir` is atomic on every POSIX filesystem: exactly one caller can
# create a given directory, and the loser gets a non-zero exit. That makes
# it a correct mutex without depending on `flock`, which ships with
# util-linux and is absent on macOS and minimal images.
#
# This previously blocked the backup schedule from being installed at all:
# the installer required flock, refused without it, and the schedule that
# was supposed to protect the database simply never ran.
#
# The lock lives inside the jobs rather than in the crontab entry, so it
# also protects a manual run that overlaps a scheduled one — the case a
# cron-only wrapper misses entirely.
#
#   . "$(dirname "$0")/with-lock.sh"
#   acquire_lock voltx-backup || exit 0     # already running: exit quietly
#   ... work ...                            # release is automatic on exit
set -uo pipefail

LOCK_DIR_BASE="${LOCK_DIR:-/tmp}"
# A lock older than this is assumed abandoned (host rebooted, job SIGKILLed).
# Longer than any legitimate backup, short enough that a stale lock cannot
# suppress backups indefinitely.
LOCK_STALE_SECONDS="${LOCK_STALE_SECONDS:-7200}"

_lock_path=""

_lock_age_seconds() {
  local dir="$1" mtime now
  # stat's flags differ between BSD (macOS) and GNU (Linux).
  mtime="$(stat -f %m "$dir" 2>/dev/null || stat -c %Y "$dir" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  echo $(( now - mtime ))
}

release_lock() {
  [ -n "$_lock_path" ] && rm -rf "$_lock_path" 2>/dev/null
  _lock_path=""
}

# Returns 0 when the lock was taken, 1 when another run holds it.
acquire_lock() {
  local name="$1"
  local dir="${LOCK_DIR_BASE}/${name}.lock"

  if ! mkdir "$dir" 2>/dev/null; then
    # Held — unless the holder died without cleaning up.
    local age
    age="$(_lock_age_seconds "$dir")"
    if [ "$age" -gt "$LOCK_STALE_SECONDS" ]; then
      echo "[lock] breaking stale ${name} lock (held ${age}s, limit ${LOCK_STALE_SECONDS}s)" >&2
      rm -rf "$dir" 2>/dev/null
      mkdir "$dir" 2>/dev/null || return 1
    else
      local holder=""
      [ -f "${dir}/pid" ] && holder="$(cat "${dir}/pid" 2>/dev/null)"
      echo "[lock] ${name} is already running${holder:+ (pid ${holder})} — skipping this run" >&2
      return 1
    fi
  fi

  echo "$$" > "${dir}/pid" 2>/dev/null || true
  _lock_path="$dir"
  # Release on any exit path, including the signals cron and systemd send.
  trap release_lock EXIT INT TERM
  return 0
}
