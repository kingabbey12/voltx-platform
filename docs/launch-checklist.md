# Launch Checklist

## Pre-Launch (48 hours before)

### Code Readiness
- [ ] All PRs merged to main branch
- [ ] CI pipeline green on main:
  - [ ] Backend lint passes
  - [ ] Backend typecheck passes
  - [ ] Backend unit tests: 171 suites, 1201 tests — all passing
  - [ ] Backend build passes
  - [ ] Web lint passes
  - [ ] Web typecheck passes
  - [ ] Web build passes
- [ ] Playwright E2E tests have been run and pass
- [ ] No P0 or P1 bugs open against this release
- [ ] All new features documented

### Infrastructure
- [ ] Production environment provisioned
- [ ] DNS propagated (check with `dig +trace`)
- [ ] SSL certificates valid (check with `openssl s_client`)
- [ ] Database migrations tested against staging
- [ ] Backup system verified (manual backup + restore test)
- [ ] Monitoring dashboards configured
- [ ] Alert rules configured (Slack/PagerDuty integration)
- [ ] Rate limits configured and tested

### Security
- [ ] All secrets rotated from development values:
  - [ ] `JWT_ACCESS_SECRET`
  - [ ] `JWT_REFRESH_SECRET`
  - [ ] `INTEGRATIONS_ENCRYPTION_KEY`
  - [ ] `POSTGRES_PASSWORD`
  - [ ] `REDIS_PASSWORD`
- [ ] CORS configured for production origins
- [ ] CSP headers verified
- [ ] HSTS preload eligibility checked
- [ ] Security headers verified (curl -sI https://staging.voltx.ai)
- [ ] `NODE_ENV=production` confirmed
- [ ] Stripe webhook endpoints configured

## Launch Day

### 2 Hours Before
- [ ] Notify team of upcoming deployment
- [ ] Take final database backup
- [ ] Verify all team members have access to monitoring dashboards
- [ ] Ensure on-call engineer is available

### Deployment
- [ ] Run deployment: `bash deploy/deploy.sh`
- [ ] Run health check: `bash deploy/health-check.sh`
- [ ] All health checks pass
- [ ] Verify Sentry health check shows no errors
- [ ] Verify Prometheus targets all up
- [ ] Verify Grafana dashboards rendering

### Smoke Tests (15 minutes)
1. [ ] Open web app in incognito browser
2. [ ] Navigate to `https://staging.voltx.ai`
3. [ ] Register new user account
4. [ ] Complete email verification
5. [ ] Log in
6. [ ] Create organization
7. [ ] Invite team member
8. [ ] Open AI Chat → send message → verify response
9. [ ] Open Knowledge → add source → search
10. [ ] Open Agents → view/create agent
11. [ ] Open Workflows → browse templates
12. [ ] Open AI Operator → check interface
13. [ ] Open Settings → update profile
14. [ ] Open Monitoring → verify dashboard loads
15. [ ] Open Monitoring → Logs → verify log entries
16. [ ] Open Monitoring → Costs → verify cost data
17. [ ] Open Monitoring → Usage → verify usage metrics
18. [ ] Open Monitoring → Health → verify all green
19. [ ] Open Monitoring → Incidents → verify loads

### API Verification
1. [ ] `POST /api/v1/auth/login` returns `{ success: true, data: { accessToken } }`
2. [ ] `GET /api/v1/health` returns `{ success: true, data: { status: "ok" } }`
3. [ ] `GET /api/v1/ai/dashboard/performance` returns paginated data
4. [ ] `GET /api/v1/ai/dashboard/activity` returns recent activity
5. [ ] `GET /api/v1/ai/dashboard/tasks` returns task summary
6. [ ] `GET /api/v1/platform/alerts` returns alert list
7. [ ] `GET /api/v1/knowledge/stats` returns knowledge statistics
8. [ ] `GET /api/v1/platform/system-health` returns platform health

## Post-Launch (1 Hour After)

### Monitoring
- [ ] Error rates normal (< 0.1%)
- [ ] API latency within baseline (p95 < 500ms)
- [ ] No unusual rate limit triggers
- [ ] Queue depths stable
- [ ] Database connections within pool limits
- [ ] Memory usage stable
- [ ] CPU usage stable

### User Feedback
- [ ] Monitor support channels for issues
- [ ] Review Sentry for new error groups
- [ ] Review API logs for 4xx/5xx patterns

### 24 Hours Post-Launch
- [ ] Review full-day metrics
- [ ] Compare error rates to pre-launch baseline
- [ ] Confirm no memory leaks (check Prometheus container metrics)
- [ ] Review slow query log for new patterns
- [ ] Post-launch team retrospective scheduled

## Go/No-Go Criteria

### Go (all must pass)
- [ ] All pre-launch security checks pass
- [ ] CI pipeline green on main
- [ ] API smoke tests pass
- [ ] Web smoke tests pass
- [ ] Backup verified
- [ ] Monitoring operational
- [ ] On-call engineer confirmed

### No-Go (any of these fails)
- [ ] Any P0/P1 bug found during smoke testing
- [ ] CI pipeline not green
- [ ] Database migration has errors
- [ ] Security vulnerability found
- [ ] Backup/restore not verified
