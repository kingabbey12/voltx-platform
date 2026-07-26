#!/usr/bin/env bash
# ── Voltx Deployment Script ───────────────────────────────────────────
# Deploys the complete stack — postgres, redis, api, web, nginx AND the
# monitoring services. This is the ONLY supported deployment path for both
# staging and production; backend/docker-compose.prod.yml is an API-only
# subset and is not a complete deployment (see its header).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
DOCKER_TAG="${1:-latest}"

# Monitoring lives behind a compose profile, so every compose invocation must
# pass it or Prometheus/Alertmanager/the exporters are silently never created.
# Deploying without them is deploying blind, so the profile is always on.
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile monitoring)

# Public hostnames differ per environment; everything else is identical.
DEPLOY_ENV="${DEPLOY_ENV:-staging}"
if [ "$DEPLOY_ENV" = "production" ]; then
  API_PUBLIC_URL="${API_PUBLIC_URL:-https://api.voltx.ai}"
  WEB_PUBLIC_URL="${WEB_PUBLIC_URL:-https://app.voltx.ai}"
else
  API_PUBLIC_URL="${API_PUBLIC_URL:-https://api-staging.voltx.ai}"
  WEB_PUBLIC_URL="${WEB_PUBLIC_URL:-https://staging.voltx.ai}"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
banner() { echo -e "${BOLD}$*${NC}"; }

# ── Help ─────────────────────────────────────────────────────────────
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Usage: $0 [--strict] [--skip-backup] [DOCKER_TAG]"
  echo ""
  echo "Deploy the complete Voltx stack (app + monitoring) via Docker Compose."
  echo ""
  echo "Options:"
  echo "  --strict       Fail on security warnings (permissions, gitignore)"
  echo "  --skip-backup  Skip the pre-migration database backup"
  echo "  --help         Show this help message"
  echo ""
  echo "  DEPLOY_ENV=production  Use production hostnames (default: staging)"
  echo ""
  echo "Environment:"
  echo "  - Secrets are read from ${ENV_FILE}"
  echo "  - For production, prefer host environment variables over .env file"
  echo "  - The .env file must be chmod 600 (owner-read-only)"
  exit 0
fi

STRICT=false
SKIP_BACKUP=false
while [ "${1:-}" = "--strict" ] || [ "${1:-}" = "--skip-backup" ]; do
  if [ "${1:-}" = "--strict" ]; then STRICT=true; shift; fi
  if [ "${1:-}" = "--skip-backup" ]; then SKIP_BACKUP=true; shift; fi
done
DOCKER_TAG="${1:-latest}"

# ── Security audit ───────────────────────────────────────────────────
banner "═══════════════════════════════════════════════════════"
banner "  Voltx Deploy — Security Audit"
banner "═══════════════════════════════════════════════════════"

audit_pass=0
audit_fail=0
audit_warn=0

audit_ok()   { info "$1"; audit_pass=$((audit_pass + 1)); }
audit_issue(){ warn "$1"; audit_warn=$((audit_warn + 1)); }
audit_bad()  { error "$1"; }

# Check 1: .env file exists
if [ ! -f "$ENV_FILE" ]; then
  audit_bad "Missing .env file. Create one from deploy/.env.example:\n  cp deploy/.env.example deploy/.env && \$EDITOR deploy/.env"
fi

# Check 2: .env file permissions
PERMS=$(stat -f "%Lp" "$ENV_FILE" 2>/dev/null || echo "unknown")
case "$PERMS" in
  600)  audit_ok  ".env permissions: $PERMS (owner-read-only) ✓" ;;
  640)  audit_ok  ".env permissions: $PERMS (owner+group-read) ✓" ;;
  "")   audit_issue "Could not determine .env permissions" ;;
  *)
    audit_issue ".env permissions: $PERMS — WORLD-READABLE! Run: chmod 600 $ENV_FILE"
    if $STRICT; then
      audit_bad "--strict mode: fix .env permissions before deploying"
    fi
    ;;
esac

# Check 3: .env is gitignored
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -n "$GIT_ROOT" ]; then
  if git -C "$GIT_ROOT" check-ignore -q "$ENV_FILE" 2>/dev/null; then
    audit_ok ".env is in .gitignore ✓"
  else
    audit_issue ".env is NOT in .gitignore — risk of accidental commit!"
    if $STRICT; then
      audit_bad "--strict mode: add deploy/.env to .gitignore before deploying"
    fi
  fi
else
  audit_issue "Not inside a git repository — cannot verify gitignore"
fi

echo ""
banner "Audit: $audit_pass passed, $audit_warn warnings"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || audit_bad "Docker is not installed"
command -v docker compose >/dev/null 2>&1 || audit_bad "Docker Compose is not installed"

# The API refuses to boot in production without METRICS_AUTH_TOKEN. Catch that
# here rather than after the container is swapped: without this check the old
# container is replaced by one that crash-loops, turning a missing variable
# into an outage. Observed during operational validation.
if grep -qE '^NODE_ENV=production' "$ENV_FILE" 2>/dev/null; then
  TOKEN_VALUE="$(grep -E '^METRICS_AUTH_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2-)"
  if [ -z "${TOKEN_VALUE}" ]; then
    error "METRICS_AUTH_TOKEN is not set in ${ENV_FILE}. The API will refuse to boot in production. Set it (>=32 chars) and mirror it into ${SCRIPT_DIR}/prometheus/metrics_token."
  fi
  if [ "${#TOKEN_VALUE}" -lt 32 ]; then
    error "METRICS_AUTH_TOKEN is shorter than 32 characters; the API rejects it at boot."
  fi
  if [ ! -f "${SCRIPT_DIR}/prometheus/metrics_token" ] || [ "$(cat "${SCRIPT_DIR}/prometheus/metrics_token")" != "${TOKEN_VALUE}" ]; then
    warn "prometheus/metrics_token does not match METRICS_AUTH_TOKEN — every /metrics scrape will return 401."
  fi
fi

# ── Step 1: Pull latest images ────────────────────────────────────────
info "Pulling latest base images..."
"${COMPOSE[@]}" pull --quiet || true

# ── Step 2: Start database services ───────────────────────────────────
info "Starting PostgreSQL and Redis..."
"${COMPOSE[@]}" up -d postgres redis
"${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-voltx}" -d "${POSTGRES_DB:-voltx}" --timeout=30 || error "PostgreSQL failed to start"
"${COMPOSE[@]}" exec -T redis redis-cli -a "${REDIS_PASSWORD}" ping || error "Redis failed to start"
info "Database services healthy."

# ── Step 3: Build services ────────────────────────────────────────────
info "Building API and Web images..."
"${COMPOSE[@]}" build api web

# ── Step 3.5: Pre-migration backup ────────────────────────────────────
if [ "$SKIP_BACKUP" = false ]; then
  info "Taking pre-migration database backup..."
  BACKUP_FILE=$("${SCRIPT_DIR}/scripts/backup.sh" --docker "${SCRIPT_DIR}/backups" 2>&1 | tee /dev/stderr | grep -o 'voltx-[^ ]*\.sql\.gz' | head -1)
  if [ -n "$BACKUP_FILE" ]; then
    info "Pre-migration backup saved: ${SCRIPT_DIR}/backups/${BACKUP_FILE}"
  else
    warn "Backup may have failed — check output above. Continuing anyway."
  fi
else
  info "Skipping pre-migration backup (--skip-backup)."
fi

# ── Step 4: Run migrations ────────────────────────────────────────────
info "Running database migrations and seeds..."
"${COMPOSE[@]}" run --rm migrate
info "Migrations complete."

# ── Step 5: Start API server ──────────────────────────────────────────
info "Starting API server..."
"${COMPOSE[@]}" up -d api
info "Waiting for API health check..."

for i in $(seq 1 30); do
    if "${COMPOSE[@]}" exec -T api node -e "fetch('http://127.0.0.1:3000/readiness').then(r=>process.exit(r.ok?0:1))" 2>/dev/null; then
        info "API is healthy."
        break
    fi
    if [ "$i" -eq 30 ]; then
        error "API health check failed after 30 attempts."
    fi
    sleep 2
done

# ── Step 6: Start web app ─────────────────────────────────────────────
info "Starting Web app..."
"${COMPOSE[@]}" up -d web

for i in $(seq 1 15); do
    if curl -sf http://localhost:${WEB_PORT:-3001}/health >/dev/null 2>&1; then
        info "Web app is healthy."
        break
    fi
    if [ "$i" -eq 15 ]; then
        warn "Web health check did not pass within timeout — check logs."
    fi
    sleep 2
done

# ── Step 7: Start nginx ───────────────────────────────────────────────
info "Starting nginx reverse proxy..."
"${COMPOSE[@]}" up -d nginx

# ── Step 7.5: Start monitoring ────────────────────────────────────────
# Previously omitted entirely: the monitoring services existed in the compose
# file but no deployment path ever started them, so alerting was unreachable in
# practice however well it was configured.
info "Starting monitoring stack (prometheus, alertmanager, exporters)..."
if [ ! -f "${SCRIPT_DIR}/alertmanager/webhook_url" ]; then
  warn "deploy/alertmanager/webhook_url is missing — alerts will fire but be delivered NOWHERE."
  warn "  cp deploy/alertmanager/webhook_url.example deploy/alertmanager/webhook_url && edit it"
fi
if [ ! -f "${SCRIPT_DIR}/prometheus/metrics_token" ]; then
  warn "deploy/prometheus/metrics_token is missing — /metrics scrapes will return 401."
fi
"${COMPOSE[@]}" up -d prometheus alertmanager postgres-exporter redis-exporter node-exporter blackbox-exporter grafana

# ── Step 8: Verify deployment ─────────────────────────────────────────
info "Running deployment verification..."
HEALTH_URL="${API_HEALTH_URL:-http://localhost:3000/readiness}"
HTTP_STATUS=$(curl -so /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    info "Deployment verified — API returned HTTP ${HTTP_STATUS}."
else
    warn "Health endpoint returned HTTP ${HTTP_STATUS} — check api logs:"
    warn "  docker compose -f ${COMPOSE_FILE} logs api"
fi

# ── Deployment summary ────────────────────────────────────────────────
echo ""
banner "═══════════════════════════════════════════════════════"
banner "  Deployment Complete"
banner "═══════════════════════════════════════════════════════"
info "Environment: ${DEPLOY_ENV}"
info "API:      ${API_PUBLIC_URL}"
info "Web:      ${WEB_PUBLIC_URL}"
info "Grafana:  http://localhost:3002 (admin:${GRAFANA_ADMIN_PASSWORD:-admin})"
info "Alerts:   http://localhost:9093  ·  Prometheus: http://localhost:9090"
info "Logs:     docker compose -f ${COMPOSE_FILE} logs -f [api|web|nginx]"

if [ "$SKIP_BACKUP" = false ]; then
  info "Backups:  ${SCRIPT_DIR}/backups/"
  info "Restore:  gunzip -c ${SCRIPT_DIR}/backups/voltx-<TIMESTAMP>.sql.gz | docker compose -f ${COMPOSE_FILE} exec -T postgres psql -U \${POSTGRES_USER:-voltx} -d \${POSTGRES_DB:-voltx}"
fi

if [ "$audit_warn" -gt 0 ]; then
  echo ""
  warn "Security audit: $audit_warn warnings — review above."
  warn "For production, migrate to host environment variables:"
  warn "  export \$(grep -v '^#' $ENF_FILE | xargs)"
  warn "  docker compose -f $COMPOSE_FILE up -d"
  warn "Then remove the .env file: rm $ENV_FILE"
fi
