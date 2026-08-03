#!/usr/bin/env bash
set -euo pipefail

# This command is intentionally fixed to the Docker-backed local test database.
# Do not accept DATABASE_URL from the caller: a convenience test command must
# never be capable of migrating a staging or production database.
TEST_DATABASE_URL="postgresql://voltx:voltx@localhost:5433/voltx_test"
SEED_BILLING_PLANS=false

case "${1:-}" in
  "") ;;
  --seed) SEED_BILLING_PLANS=true ;;
  *)
    echo "Usage: pnpm test:e2e:local [--seed]" >&2
    exit 2
    ;;
esac

DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" \
  ./node_modules/.bin/prisma migrate deploy

if [[ "$SEED_BILLING_PLANS" == true ]]; then
  DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" \
    ./node_modules/.bin/ts-node --transpile-only prisma/seed-billing-plans.ts
fi

DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" \
  ./node_modules/.bin/dotenv -e .env.test -- \
  ./node_modules/.bin/jest --config ./test/jest-e2e.json --maxWorkers=1 --workerIdleMemoryLimit=1GB