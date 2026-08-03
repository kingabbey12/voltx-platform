# Release Checklist

Every box must be evidenced, not assumed. "The script exists" is not evidence; "the script ran and here is the output" is.

## Release freeze

- [ ] `git rev-parse HEAD` recorded
- [ ] `git status --short` reviewed — no unintended changes
- [ ] `git diff --check` clean
- [ ] Release tag created
- [ ] Image digests recorded
- [ ] Fresh database backup taken
- [ ] Rollback images (`:previous`) preserved
- [ ] **No temporary staging artifacts in the release** — `deploy/.env.staging-local`, `deploy/metrics/*.prom`, `.uiqa/`, `deploy/backups/` are all gitignored; verify with `git check-ignore`

## Object storage — owner action

- [ ] Scoped R2 token created (not an account-wide admin token), restricted to the production bucket
- [ ] Values written to the production env file, `chmod 600`, never committed
- [ ] `HeadBucket` passes
- [ ] Upload / read / delete / cleanup pass on `release-verification/<timestamp>/r2-healthcheck.txt`
- [ ] API boots — the boot guard is the real test
- [ ] Old token revoked, application still healthy afterward

## TLS — owner action

- [ ] DNS resolves to the ingress; :80 reachable for ACME, :443 reaches nginx
- [ ] CA-issued certificate installed with **full chain**
- [ ] Private key `chmod 600`
- [ ] Automated renewal configured with an nginx reload hook
- [ ] Renewal dry run passes
- [ ] Not self-signed; subject matches; issuer trusted; chain validates
- [ ] TLS 1.2 and 1.3 both negotiate; HTTP redirects to HTTPS
- [ ] HSTS **without `preload`** unless the whole `voltx.ai` subdomain policy is approved

## Backups — Linux host

- [ ] `flock` present
- [ ] `./deploy/scripts/install-backup-schedule.sh` run; `crontab -l` shows both jobs
- [ ] No unsubstituted tokens (the installer refuses, but verify)
- [ ] Backup job runs manually and succeeds
- [ ] Integrity verification runs manually and succeeds
- [ ] Restore drill passes
- [ ] Stale-backup guard fails closed (exit 1)
- [ ] `deploy/metrics` mounted into node-exporter; six metrics scraped
- [ ] Five backup alerts loaded and evaluating
- [ ] Next scheduled run recorded

## Deployment

- [ ] `./deploy/scripts/preflight-test.sh` — 6/6
- [ ] `VOLTX_PREFLIGHT_ONLY=1 ... ./deploy/deploy.sh` passes against the production env
- [ ] Deploy completes; **`prisma migrate status` reports nothing pending**
- [ ] Migration count matches the repository
- [ ] Liveness 200, readiness 200
- [ ] Postgres, Redis, web, nginx healthy
- [ ] Prometheus targets all up; Alertmanager and Grafana healthy
- [ ] TLS trusted from an external client

## Smoke tests

- [ ] Owner, CRM-limited, Finance-limited, approval-restricted logins
- [ ] Unauthenticated → 401; missing permission → 403; cross-tenant inaccessible
- [ ] CORS rejects unapproved origins (no `Access-Control-Allow-Origin`)
- [ ] Executive stack and business modules load
- [ ] **Workflow safety chain**: generate → `awaiting_approval` → handoff rejected → approve → handoff → exactly one run → duplicate handoff replays → never `executed` → audit trail complete
- [ ] Attachment upload / retrieve / delete, with tenant isolation
- [ ] Metrics scrape, alert delivery, backup command, log capture

## Performance

Thresholds: API p95 < 500 ms · p99 < 1000 ms · error rate < 1% · container restarts = 0

- [ ] Measured and within threshold
- [ ] Largest frontend route bundle recorded

## Alerts

- [ ] Each alert observed pending → firing → Alertmanager → receiver → resolved
- [ ] Timestamps and receivers recorded

## Rollback

- [ ] Rollback candidate exists
- [ ] Rollback executed; **migrations not re-run**
- [ ] Readiness, login, Executive, BI verified on the rolled-back release
- [ ] Latest release restored; health re-verified
- [ ] Durations and data impact recorded

## Automated validation

- [ ] Backend lint / `tsc --noEmit` / `nest build`
- [ ] Backend unit suite
- [ ] Backend E2E with durable log and captured exit status
- [ ] Frontend lint / typecheck / build
- [ ] Playwright with durable log and captured exit status
- [ ] Axe: 0 critical, 0 serious
- [ ] Permission matrix with real restricted identities

## Production

- [ ] Change approval obtained
- [ ] On-call engineer available; dashboards open; alerts active
- [ ] **Immutable version tags / digests — never `latest`**
- [ ] Rollback window kept open

## Controlled rollout

- [ ] Internal only — observe several hours, no critical errors
- [ ] Private beta — trusted businesses, monitored
- [ ] Limited public — rate limits and support coverage active
- [ ] General availability — only after demonstrated stability

Define rollback criteria **before** each stage, not during an incident.
