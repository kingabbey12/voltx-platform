#!/usr/bin/env bash
# ── Voltx Health Check Script ─────────────────────────────────────────
# Runs health checks against all deployment endpoints.
# Exit code 0 = all healthy, 1 = one or more checks failed.
set -euo pipefail

API_BASE="${API_BASE_URL:-http://localhost:3000}"
WEB_BASE="${WEB_BASE_URL:-http://localhost:3001}"
PASS=0
FAIL=0

green() { echo -e "\033[32m✓ PASS\033[0m $1"; PASS=$((PASS + 1)); }
red()   { echo -e "\033[31m✗ FAIL\033[0m $1"; FAIL=$((FAIL + 1)); }

check_api() {
    local status
    status=$(curl -so /dev/null -w "%{http_code}" "${API_BASE}/readiness" 2>/dev/null || echo "000")
    if [ "$status" = "200" ]; then
        green "API readiness probe (HTTP ${status})"
    else
        red "API readiness probe returned HTTP ${status} — dependencies may be down"
    fi
}

check_api_deps() {
    local body
    body=$(curl -sf "${API_BASE}/readiness" 2>/dev/null || echo '{}')
    local db_status
    db_status=$(echo "$body" | grep -o '"database"[^,]*' | grep -o '"up"' || echo "down")
    if [ "$db_status" = '"up"' ]; then
        green "API database dependency is up"
    else
        red "API database dependency is down"
    fi
}

check_web() {
    local status
    status=$(curl -so /dev/null -w "%{http_code}" "${WEB_BASE}/health" 2>/dev/null || echo "000")
    if [ "$status" = "200" ] || [ "$status" = "404" ]; then
        green "Web health endpoint (HTTP ${status})"
    else
        red "Web health endpoint returned HTTP ${status}"
    fi
}

check_web_homepage() {
    local status
    status=$(curl -so /dev/null -w "%{http_code}" "${WEB_BASE}" 2>/dev/null || echo "000")
    if [ "$status" = "200" ] || [ "$status" = "302" ] || [ "$status" = "307" ]; then
        green "Web homepage loads (HTTP ${status})"
    else
        red "Web homepage returned HTTP ${status}"
    fi
}

check_cors() {
    local status
    status=$(curl -so /dev/null -w "%{http_code}" -H "Origin: https://staging.voltx.ai" -H "Access-Control-Request-Method: GET" -X OPTIONS "${API_BASE}/api/v1/health" 2>/dev/null || echo "000")
    if [ "$status" = "204" ] || [ "$status" = "200" ]; then
        green "CORS preflight succeeds (HTTP ${status})"
    else
        warn "CORS preflight returned HTTP ${status} (may be expected if CORS is not configured)"
    fi
}

check_security_headers() {
    local headers
    headers=$(curl -sI "${WEB_BASE}" 2>/dev/null || true)
    if echo "$headers" | grep -qi "Strict-Transport-Security"; then
        green "HSTS header present"
    else
        red "HSTS header missing"
    fi
    if echo "$headers" | grep -qi "Content-Security-Policy"; then
        green "CSP header present"
    else
        red "CSP header missing"
    fi
    if echo "$headers" | grep -qi "X-Content-Type-Options"; then
        green "X-Content-Type-Options header present"
    else
        red "X-Content-Type-Options header missing"
    fi
}

echo "═════════════════════════════════════════════════════"
echo "  Voltx Deployment Health Check"
echo "  API: $API_BASE"
echo "  Web: $WEB_BASE"
echo "═════════════════════════════════════════════════════"
echo ""

check_api
check_api_deps
check_web
check_web_homepage
check_cors
check_security_headers

echo ""
echo "─────────────────────────────────────────────────────"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "─────────────────────────────────────────────────────"

exit $FAIL
