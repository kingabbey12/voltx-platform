#!/usr/bin/env bash
# ── Voltx Deploy Preflight Tests ─────────────────────────────────────
# Proves the deployment script refuses to touch containers when the
# environment is wrong, and that it never prints a secret while doing so.
#
# These exist because the failure mode they guard against was silent: a
# `grep` for a missing key, under `set -e -o pipefail`, aborted the whole
# script before its own error message could run. The deploy exited 1 with no
# output at all. Every case below asserts on the *message*, not just the exit
# code, so that regression cannot come back unnoticed.
#
#   ./scripts/preflight-test.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_SH="${DEPLOY_DIR}/deploy.sh"

pass_count=0
fail_count=0
ok()   { echo "  ✓ $*"; pass_count=$((pass_count + 1)); }
bad()  { echo "  ✗ $*" >&2; fail_count=$((fail_count + 1)); }

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# A sentinel that must never appear in output. If the script ever echoes a
# configuration value, this is what catches it.
SECRET_SENTINEL="s3cr3t-must-never-be-printed-0123456789"

write_env() {
  cat > "$1" <<EOF
DATABASE_URL=postgresql://voltx:${SECRET_SENTINEL}@postgres:5432/voltx
DIRECT_URL=postgresql://voltx:${SECRET_SENTINEL}@postgres:5432/voltx
POSTGRES_PASSWORD=${SECRET_SENTINEL}
REDIS_PASSWORD=${SECRET_SENTINEL}
JWT_ACCESS_SECRET=${SECRET_SENTINEL}-long-enough-for-the-length-check
INTEGRATIONS_ENCRYPTION_KEY=${SECRET_SENTINEL}
CORS_ALLOWED_ORIGINS=https://staging.voltx.ai
WEB_HOST=staging.voltx.ai
API_HOST=api-staging.voltx.ai
NEXT_PUBLIC_API_BASE_URL=https://api-staging.voltx.ai/api/v1
ATTACHMENTS_STORAGE_PROVIDER=s3
ATTACHMENTS_S3_BUCKET=voltx-attachments
ATTACHMENTS_S3_ENDPOINT=https://example.r2.cloudflarestorage.com
ATTACHMENTS_S3_ACCESS_KEY_ID=${SECRET_SENTINEL}
ATTACHMENTS_S3_SECRET_ACCESS_KEY=${SECRET_SENTINEL}
METRICS_AUTH_TOKEN=${SECRET_SENTINEL}
EOF
  chmod 600 "$1"
}

# Runs deploy.sh against a throwaway env file and captures combined output.
# DRY_RUN stops before any container work; the preflight has already run by
# then, which is the whole point of testing it in isolation.
run_deploy() {
  local env_file="$1"
  ( cd "$DEPLOY_DIR" && ENV_FILE_OVERRIDE="$env_file" DEPLOY_ENV=staging \
      VOLTX_PREFLIGHT_ONLY=1 bash "$DEPLOY_SH" 2>&1 )
}

echo ""
echo "── Preflight: missing variable fails with a named message ─────────"
ENV_MISSING="${WORK_DIR}/missing.env"
write_env "$ENV_MISSING"
grep -v '^REDIS_PASSWORD=' "$ENV_MISSING" > "${ENV_MISSING}.tmp" && mv "${ENV_MISSING}.tmp" "$ENV_MISSING"
chmod 600 "$ENV_MISSING"
OUT="$(run_deploy "$ENV_MISSING")"; RC=$?
if [ "$RC" -ne 0 ]; then ok "non-zero exit (${RC})"; else bad "expected non-zero exit"; fi
if printf '%s' "$OUT" | grep -q "REDIS_PASSWORD"; then
  ok "names the missing variable"
else
  bad "did not name REDIS_PASSWORD; output was: ${OUT}"
fi
if printf '%s' "$OUT" | grep -q "Nothing was changed"; then
  ok "states nothing was changed"
else
  bad "did not state that nothing was changed"
fi

echo ""
echo "── Preflight: never echoes a secret value ─────────────────────────"
ENV_FULL="${WORK_DIR}/full.env"
write_env "$ENV_FULL"
OUT="$(run_deploy "$ENV_FULL")"
if printf '%s' "$OUT" | grep -q "$SECRET_SENTINEL"; then
  bad "a configuration value leaked into deploy output"
else
  ok "no secret value appears in output"
fi

echo ""
echo "── Preflight: valid configuration reaches the deploy phase ────────"
if printf '%s' "$OUT" | grep -q "Configuration preflight passed"; then
  ok "valid configuration passes preflight"
else
  bad "valid configuration did not pass preflight; output was: ${OUT}"
fi

echo ""
echo "── Preflight: missing env file fails clearly ──────────────────────"
OUT="$(run_deploy "${WORK_DIR}/does-not-exist.env")"; RC=$?
if [ "$RC" -ne 0 ] && printf '%s' "$OUT" | grep -qi "env"; then
  ok "missing env file reported clearly (exit ${RC})"
else
  bad "missing env file was not reported clearly"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  Preflight tests: ${pass_count} passed, ${fail_count} failed"
echo "═══════════════════════════════════════════════"
[ "$fail_count" -eq 0 ]
