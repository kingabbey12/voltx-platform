#!/usr/bin/env bash
#
# Stands up a local, fully-authenticated Voltx environment so UI changes on
# pages behind the auth guard can actually be looked at.
#
# Why this exists: authenticated pages are client-rendered behind useAuthStore,
# so curling them returns the loading shell with no content. And the in-app
# browser preview reports visibilityState "hidden", which pins framer-motion
# elements at their `initial` opacity — screenshots come back blank. Neither
# path can verify the UI. A real browser with a real session is the only one
# that can.
#
# This mirrors the `web-e2e-authenticated` CI job in .github/workflows/ci.yml,
# deliberately: if the two drift, CI stops representing local reality.
#
#   ./scripts/dev-authenticated-env.sh          # set up, print next steps
#   ./scripts/dev-authenticated-env.sh --stop   # tear down
#
set -euo pipefail

DB_NAME="${DB_NAME:-voltx_uiqa}"
PG_CONTAINER="${PG_CONTAINER:-backend-postgres-1}"
API_PORT="${API_PORT:-3010}"
WEB_PORT="${WEB_PORT:-3011}"
E2E_EMAIL="${E2E_EMAIL:-uiqa@local.test}"
E2E_PASSWORD="${E2E_PASSWORD:-uiqa-Local-Password-1}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_URL="postgresql://voltx:voltx@localhost:5433/${DB_NAME}"
RUN_DIR="${ROOT}/.uiqa"
mkdir -p "$RUN_DIR"

stop() {
  [ -f "$RUN_DIR/api.pid" ] && kill "$(cat "$RUN_DIR/api.pid")" 2>/dev/null || true
  rm -f "$RUN_DIR/api.pid"
  echo "Stopped the API. The database ${DB_NAME} was left in place — drop it with:"
  echo "  docker exec ${PG_CONTAINER} psql -U voltx -d postgres -c 'DROP DATABASE ${DB_NAME};'"
}

if [ "${1:-}" = "--stop" ]; then stop; exit 0; fi

# The database is recreated below, so any saved Playwright session points at a
# user that no longer exists. Leaving it in place makes auth.setup.ts fail with
# a redirect back to /login and no obvious cause.
rm -rf "${ROOT}/apps/web/e2e/.auth"

echo "==> Postgres"
docker exec "$PG_CONTAINER" psql -U voltx -d postgres -c "SELECT 1" >/dev/null 2>&1 \
  || { echo "Postgres container '${PG_CONTAINER}' is not running. Start it with: (cd backend && docker compose up -d)"; exit 1; }

docker exec "$PG_CONTAINER" psql -U voltx -d postgres \
  -c "DROP DATABASE IF EXISTS ${DB_NAME};" -c "CREATE DATABASE ${DB_NAME};" >/dev/null
echo "    created ${DB_NAME}"

echo "==> Migrations and seed"
cd "$ROOT/backend"
# DIRECT_URL is required: schema.prisma declares `directUrl` so migrations can
# bypass Neon's pooler in production. Locally it is the same value.
DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" npx prisma migrate deploy >/dev/null
# The RBAC catalogue must exist before registration — /auth/register assigns the
# new user the Owner role, which prisma:seed creates.
DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" pnpm prisma:seed >/dev/null
echo "    migrations applied, RBAC seeded"

echo "==> API on :${API_PORT}"
# Always rebuild. `[ -d dist ] ||` meant an existing dist was reused, so code
# changes silently never reached the running API and endpoints 404'd against a
# stale build.
pnpm build >/dev/null
NODE_ENV=development PORT="$API_PORT" REDIS_ENABLED=false \
DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
JWT_ACCESS_SECRET=uiqa-local-jwt-access-secret-at-least-32-chars \
INTEGRATIONS_ENCRYPTION_KEY=uiqa-local-integrations-encryption-key \
DATABASE_SEED_ON_BOOTSTRAP=false \
CORS_ALLOWED_ORIGINS="http://localhost:${WEB_PORT}" \
  node dist/main.js > "$RUN_DIR/api.log" 2>&1 &
echo $! > "$RUN_DIR/api.pid"

for _ in $(seq 1 60); do
  curl -sf "http://localhost:${API_PORT}/readiness" >/dev/null && break
  sleep 1
done
curl -sf "http://localhost:${API_PORT}/readiness" >/dev/null \
  || { echo "API failed to start:"; tail -30 "$RUN_DIR/api.log"; exit 1; }
echo "    ready"

echo "==> Test user"
REG=$(curl -sS -X POST "http://localhost:${API_PORT}/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${E2E_EMAIL}\",\"password\":\"${E2E_PASSWORD}\",\"firstName\":\"UI\",\"lastName\":\"QA\",\"organizationName\":\"UI QA Workspace\"}")

TOKEN=$(printf '%s' "$REG" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.accessToken" 2>/dev/null || echo "")
[ -n "$TOKEN" ] || { echo "Registration failed: $REG"; exit 1; }

# A fresh account is held in the 5-step onboarding wizard and every app route
# redirects there until it completes — so without this you screenshot
# "Tell us about your business" instead of the page you meant to review.
ORG=$(node -pe "JSON.parse(Buffer.from('${TOKEN}'.split('.')[1],'base64url').toString()).org")
curl -sS -o /dev/null -X POST \
  "http://localhost:${API_PORT}/api/v1/organizations/${ORG}/complete-onboarding" \
  -H "Authorization: Bearer ${TOKEN}"
echo "    ${E2E_EMAIL} created, onboarding completed"

cat <<EOF

Environment ready.

  API   http://localhost:${API_PORT}
  user  ${E2E_EMAIL} / ${E2E_PASSWORD}

Capture authenticated screenshots:

  cd apps/web && \\
    NEXT_PUBLIC_API_BASE_URL=http://localhost:${API_PORT}/api/v1 \\
    PLAYWRIGHT_PORT=${WEB_PORT} \\
    E2E_USER_EMAIL=${E2E_EMAIL} E2E_USER_PASSWORD='${E2E_PASSWORD}' \\
    npx playwright test --project=screenshots

Output lands in apps/web/screenshots/. Tear down with --stop.
EOF
