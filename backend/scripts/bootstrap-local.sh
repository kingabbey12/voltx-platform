#!/bin/sh
set -eu

attempt=1
max_attempts=30

until pnpm prisma:migrate:deploy; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Database migrations did not become ready after ${max_attempts} attempts." >&2
    exit 1
  fi
  echo "Database is not accepting migrations yet; retrying (${attempt}/${max_attempts})…" >&2
  attempt=$((attempt + 1))
  sleep 2
done

pnpm prisma:seed
pnpm prisma:seed:billing-plans
