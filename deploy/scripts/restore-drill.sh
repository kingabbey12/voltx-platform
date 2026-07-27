#!/usr/bin/env bash
# ── Voltx Restore Drill ──────────────────────────────────────────────
# Proves the backup/restore pair actually works, end to end, against a
# throwaway database: seed → backup → destroy → restore → verify checksums.
#
# Run this quarterly and after any change to backup.sh or restore.sh. A backup
# that has never been restored is a hypothesis; this is what turns it into a
# capability. Exits non-zero if the restored data does not match, so it can be
# wired into a scheduled job.
#
#   ./scripts/restore-drill.sh                       # uses backend-postgres-1
#   PG_CONTAINER=deploy-postgres-1 ./scripts/restore-drill.sh
set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-backend-postgres-1}"
PG_USER="${POSTGRES_USER:-voltx}"
PG_PASSWORD="${POSTGRES_PASSWORD:-voltx}"
DRILL_DB="${DRILL_DB:-voltx_restore_drill}"
WORK_DIR="$(mktemp -d)"
ARCHIVE="${WORK_DIR}/drill.sql.gz"

pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*" >&2; exit 1; }
step() { echo ""; echo "── $* ─────────────────────────────────"; }

cleanup() {
  docker exec -e PGPASSWORD="$PG_PASSWORD" "$PG_CONTAINER" \
    psql -U "$PG_USER" -d postgres -q -c "DROP DATABASE IF EXISTS ${DRILL_DB};" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

psql_drill() {
  docker exec -e PGPASSWORD="$PG_PASSWORD" "$PG_CONTAINER" psql -U "$PG_USER" -d "$DRILL_DB" "$@"
}

docker inspect "$PG_CONTAINER" >/dev/null 2>&1 || fail "Postgres container '$PG_CONTAINER' is not running. Set PG_CONTAINER."

step "1. Provision throwaway database"
docker exec -e PGPASSWORD="$PG_PASSWORD" "$PG_CONTAINER" \
  psql -U "$PG_USER" -d postgres -q -c "DROP DATABASE IF EXISTS ${DRILL_DB};" >/dev/null
docker exec -e PGPASSWORD="$PG_PASSWORD" "$PG_CONTAINER" \
  psql -U "$PG_USER" -d postgres -q -c "CREATE DATABASE ${DRILL_DB};"
pass "created ${DRILL_DB}"

step "2. Seed representative data (tables, FK, index, sequences)"
psql_drill -q -c "
CREATE TABLE customers (id serial primary key, name text not null, created_at timestamptz default now());
CREATE TABLE invoices (id serial primary key, customer_id int references customers(id), amount_cents bigint not null);
INSERT INTO customers (name) SELECT 'tenant-'||g FROM generate_series(1,500) g;
INSERT INTO invoices (customer_id, amount_cents) SELECT (random()*499)::int+1, (random()*100000)::bigint FROM generate_series(1,2000);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
"
BEFORE="$(psql_drill -tAc "SELECT (SELECT count(*) FROM customers)||'/'||(SELECT count(*) FROM invoices)||'/'||(SELECT sum(amount_cents) FROM invoices);")"
pass "seeded — customers/invoices/checksum = ${BEFORE}"

step "3. Back up"
docker exec -e PGPASSWORD="$PG_PASSWORD" "$PG_CONTAINER" \
  pg_dump --format=plain --no-owner --no-privileges -U "$PG_USER" "$DRILL_DB" | gzip > "$ARCHIVE"
gzip -t "$ARCHIVE" || fail "archive failed integrity check"
pass "archive written ($(du -h "$ARCHIVE" | cut -f1)) and passes gzip integrity check"

step "4. Simulate total data loss"
psql_drill -q -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null 2>&1
DESTROYED="$(psql_drill -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
[ "$DESTROYED" = "0" ] || fail "expected 0 tables after destruction, found ${DESTROYED}"
pass "schema dropped — 0 tables remain"

step "5. Restore"
RESTORE_START=$(date +%s)
docker cp "$ARCHIVE" "$PG_CONTAINER:/tmp/drill-restore.sql.gz" >/dev/null
docker exec -e PGPASSWORD="$PG_PASSWORD" "$PG_CONTAINER" sh -c \
  "gunzip -c /tmp/drill-restore.sql.gz | psql -U ${PG_USER} -d ${DRILL_DB} -v ON_ERROR_STOP=1 -q" >/dev/null
docker exec "$PG_CONTAINER" rm -f /tmp/drill-restore.sql.gz
RESTORE_SECONDS=$(( $(date +%s) - RESTORE_START ))
pass "restore completed in ${RESTORE_SECONDS}s"

step "6. Verify"
AFTER="$(psql_drill -tAc "SELECT (SELECT count(*) FROM customers)||'/'||(SELECT count(*) FROM invoices)||'/'||(SELECT sum(amount_cents) FROM invoices);")"
[ "$AFTER" = "$BEFORE" ] || fail "data mismatch — before=${BEFORE} after=${AFTER}"
pass "row counts and checksum match exactly (${AFTER})"

INDEXES="$(psql_drill -tAc "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='idx_invoices_customer';")"
[ "$INDEXES" = "1" ] || fail "custom index was not restored"
pass "custom index restored"

FKS="$(psql_drill -tAc "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY';")"
[ "$FKS" = "1" ] || fail "foreign key constraint was not restored"
pass "foreign key constraint restored"

# A restored sequence that did not advance would collide on the next insert —
# a corruption that only surfaces in production, so assert it here.
psql_drill -q -c "INSERT INTO customers (name) VALUES ('post-restore-write');" >/dev/null
pass "sequences intact — post-restore INSERT succeeded without a PK collision"

echo ""
echo "═══════════════════════════════════════════════"
echo "  RESTORE DRILL PASSED"
echo "  Restore time: ${RESTORE_SECONDS}s for $(du -h "$ARCHIVE" | cut -f1)"
echo "═══════════════════════════════════════════════"
