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
ENV_FILE="${ENV_FILE_OVERRIDE:-${SCRIPT_DIR}/.env}"
DOCKER_TAG="${1:-latest}"

# Monitoring lives behind a compose profile, so every compose invocation must
# pass it or Prometheus/Alertmanager/the exporters are silently never created.
# Deploying without them is deploying blind, so the profile is always on.
# Compose resolves `env_file:` relative to the compose file, and it is what
# the containers actually receive — `--env-file` alone only drives
# interpolation, so both must point at the same file or the deployed
# environment silently differs from the validated one.
COMPOSE_ENV_FILE="$(basename "$ENV_FILE")"
export COMPOSE_ENV_FILE
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
  TOKEN_VALUE="$(grep -E '^METRICS_AUTH_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"
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

# NEXT_PUBLIC_API_BASE_URL is compiled into the browser bundle, so a wrong
# value cannot be corrected by restarting the container — it needs a rebuild.
# It must also be an address a *browser* can resolve: an internal compose
# hostname or localhost produces an app that renders perfectly and loads no
# data at all. A previous build shipped http://localhost:3000/api/v1.
WEB_API_URL="$(grep -E '^NEXT_PUBLIC_API_BASE_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
if [ -z "${WEB_API_URL}" ]; then
  error "NEXT_PUBLIC_API_BASE_URL is not set in ${ENV_FILE}. The web image cannot be built without it."
fi
case "${WEB_API_URL}" in
  *localhost*|*127.0.0.1*|http://api:*|https://api:*)
    error "NEXT_PUBLIC_API_BASE_URL is '${WEB_API_URL}', which no browser outside this host can reach. Set it to the public API URL (e.g. https://api.usevoltx.com/api/v1)."
    ;;
esac
if [ "$DEPLOY_ENV" = "production" ]; then
  case "${WEB_API_URL}" in
    https://*) ;;
    *) error "NEXT_PUBLIC_API_BASE_URL must use https in production; got '${WEB_API_URL}'." ;;
  esac
fi
info "Web app will be built against ${WEB_API_URL}"

# nginx server_name comes from these; without them the proxy answers on no
# hostname and every request 404s at the edge.
for var in WEB_HOST API_HOST; do
  value="$(grep -E "^${var}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
  [ -n "$value" ] || error "${var} is not set in ${ENV_FILE}. nginx substitutes it into its server_name; see deploy/nginx/templates/."
done

# The API URL the browser is built against must match the hostname nginx
# serves the API on, or every request fails CORS/DNS at runtime.
CONFIGURED_API_HOST="$(grep -E '^API_HOST=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
case "${WEB_API_URL}" in
  *"${CONFIGURED_API_HOST}"*) ;;
  *) warn "NEXT_PUBLIC_API_BASE_URL (${WEB_API_URL}) does not contain API_HOST (${CONFIGURED_API_HOST}) — the browser may be pointed at a host nginx does not serve." ;;
esac

# ── Configuration preflight ───────────────────────────────────────────
# Everything below runs BEFORE any image is pulled, built, or any container
# is replaced, so a misconfigured environment can never leave the stack
# half-swapped. Each check names the variable and what it is for; none of
# them ever echoes a value, because several are secrets.
#
# `env_value` is the single way this script reads configuration. It reads
# from the env file rather than the ambient shell: `docker compose` receives
# the file via --env-file, so assuming a variable is exported into *this*
# shell is how REDIS_PASSWORD previously aborted a deploy mid-flight.
env_value() {
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

preflight_fail=0
preflight_missing=""
require_env() {
  local name="$1" purpose="$2"
  if [ -z "$(env_value "$name")" ]; then
    warn "missing ${name} — ${purpose}"
    preflight_missing="${preflight_missing} ${name}"
    preflight_fail=1
  fi
}

banner ""
banner "═══════════════════════════════════════════════════════"
banner "  Voltx Deploy — Configuration Preflight"
banner "═══════════════════════════════════════════════════════"

require_env DATABASE_URL          "PostgreSQL connection for the API"
require_env DIRECT_URL            "unpooled PostgreSQL connection; schema.prisma declares directUrl and every migration needs it"
require_env POSTGRES_PASSWORD     "PostgreSQL superuser password used by the postgres service"
require_env REDIS_PASSWORD        "Redis AUTH; docker-compose.yml refuses to start Redis without it"
require_env JWT_ACCESS_SECRET     "signing key for access tokens"
require_env INTEGRATIONS_ENCRYPTION_KEY "encryption key for stored integration credentials"
require_env CORS_ALLOWED_ORIGINS  "browser origins permitted to call the API"
require_env WEB_HOST              "nginx server_name for the web app"
require_env API_HOST              "nginx server_name for the API"
require_env NEXT_PUBLIC_API_BASE_URL "public API URL the web bundle is built against"
require_env ATTACHMENTS_STORAGE_PROVIDER "object storage backend (must be s3 in production)"
require_env ATTACHMENTS_S3_BUCKET "object storage bucket the API verifies at boot"
require_env ATTACHMENTS_S3_ENDPOINT "object storage endpoint"
require_env ATTACHMENTS_S3_ACCESS_KEY_ID "object storage credential"
require_env ATTACHMENTS_S3_SECRET_ACCESS_KEY "object storage credential"

# TLS material must exist before nginx is reloaded, or the edge comes back
# without a certificate and every HTTPS request fails.
for cert_path in "${SCRIPT_DIR}/nginx/ssl/fullchain.pem" "${SCRIPT_DIR}/nginx/ssl/privkey.pem"; do
  if [ ! -f "$cert_path" ]; then
    warn "missing TLS file: ${cert_path}"
    preflight_fail=1
  fi
done

# Secret strength: a short JWT secret is worse than a missing one, because it
# boots and looks fine. Length only — the value is never printed.
JWT_LEN="$(printf '%s' "$(env_value JWT_ACCESS_SECRET)" | wc -c | tr -d ' ')"
if [ -n "$(env_value JWT_ACCESS_SECRET)" ] && [ "$JWT_LEN" -lt 32 ]; then
  warn "JWT_ACCESS_SECRET is ${JWT_LEN} characters; 32 or more is required"
  preflight_fail=1
fi

# Production must not fall back to filesystem storage: it does not survive a
# container restart and is not shared across replicas.
if [ "$DEPLOY_ENV" = "production" ] && [ "$(env_value ATTACHMENTS_STORAGE_PROVIDER)" != "s3" ]; then
  warn "ATTACHMENTS_STORAGE_PROVIDER must be 's3' in production"
  preflight_fail=1
fi

if [ "$preflight_fail" -ne 0 ]; then
  error "Configuration preflight failed. Missing or invalid:${preflight_missing:- (see warnings above)}. Nothing was changed — fix ${ENV_FILE} and re-run."
fi
info "Configuration preflight passed — no container has been touched yet."

if [ "${VOLTX_PREFLIGHT_ONLY:-0}" = "1" ]; then
  info "VOLTX_PREFLIGHT_ONLY=1 — stopping before any container work."
  exit 0
fi

# ── Step 1: Pull latest images ────────────────────────────────────────
info "Pulling latest base images..."
"${COMPOSE[@]}" pull --quiet || true

# ── Step 2: Start database services ───────────────────────────────────
info "Starting PostgreSQL and Redis..."
"${COMPOSE[@]}" up -d postgres redis
"${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-voltx}" -d "${POSTGRES_DB:-voltx}" --timeout=30 || error "PostgreSQL failed to start"
# REDIS_PASSWORD lives in the env file, which is handed to `docker compose`
# but never sourced into this script's shell — so referencing it directly
# aborted the deploy here under `set -u`, after the databases were already
# up. Read it the same way every other value in this script is read.
REDIS_PASSWORD_VALUE="$(grep -E '^REDIS_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
[ -n "$REDIS_PASSWORD_VALUE" ] || error "REDIS_PASSWORD is not set in ${ENV_FILE}; docker-compose.yml requires it to start Redis."
"${COMPOSE[@]}" exec -T redis redis-cli -a "${REDIS_PASSWORD_VALUE}" ping || error "Redis failed to start"
info "Database services healthy."

# ── Step 3: Build services ────────────────────────────────────────────
# Preserve the currently-deployed images as :previous BEFORE the build
# overwrites :latest. Without this there is no version to roll back to —
# recovery would mean rebuilding from an older commit, which is slow and
# assumes that commit still builds.
for img in voltx-api voltx-web; do
  if docker image inspect "${img}:latest" >/dev/null 2>&1; then
    docker tag "${img}:latest" "${img}:previous"
    info "Preserved ${img}:latest as ${img}:previous (rollback target)."
  else
    warn "No existing ${img}:latest — first deploy, so no rollback target yet."
  fi
done

info "Building API and Web images..."
"${COMPOSE[@]}" build api web migrate

# Also tag this build with the release version, so a specific version can be
# redeployed later rather than only "the one before this one".
if [ -n "${DOCKER_TAG}" ] && [ "${DOCKER_TAG}" != "latest" ]; then
  for img in voltx-api voltx-web; do
    docker tag "${img}:latest" "${img}:${DOCKER_TAG}"
  done
  info "Tagged this build as ${DOCKER_TAG}."
fi

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

# Verify the schema actually caught up. `migrate deploy` can exit 0 having
# applied nothing when the runner image is stale, so trust the database's
# own account of pending migrations rather than the command's exit status.
if ! "${COMPOSE[@]}" run --rm --entrypoint sh migrate -c "npx prisma migrate status" > /tmp/voltx-migrate-status.txt 2>&1; then
  if grep -qiE "following migrations? have not yet been applied|drift detected" /tmp/voltx-migrate-status.txt; then
    cat /tmp/voltx-migrate-status.txt
    error "Migrations did not fully apply — the schema is behind. The API would start against a stale database."
  fi
fi
info "Migrations complete and schema verified up to date."

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
