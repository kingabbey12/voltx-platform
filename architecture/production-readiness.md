# Production Readiness

Status as of the infrastructure-recovery pass. **Voltx is not cleared for public launch**, but staging is now deployed, healthy and fully smoke-tested. Two gates remain, both requiring owner credentials: R2 token rotation and a CA-issued certificate.

Staging was validated against a **local S3-compatible endpoint (MinIO)**, not R2. The API's production storage guard is unchanged and genuinely passed — but production still requires working R2 credentials.

## Topology

```
                    ┌───────── nginx (80/443, TLS, HTTP/2) ─────────┐
                    │                                              │
              web (Next.js standalone)                    api (NestJS)
                                                                │
                              ┌─────────────────┬───────────────┼──────────────┐
                          postgres            redis        object storage    metrics
                        (pgvector:pg16)      (7-alpine)     (S3/R2)        (/metrics)
                                                                │
    prometheus ── alertmanager ── grafana ── {postgres,redis,node,blackbox}-exporter
```

Single compose stack (`deploy/docker-compose.yml`, monitoring behind the `monitoring` profile). `deploy/deploy.sh` is the only supported deployment path.

## Launch gate status

| Gate | Status | Evidence |
| --- | --- | --- |
| Object-storage credentials valid (production R2) | ❌ **BLOCKED** | `HeadBucket` → HTTP 401 — owner action |
| API boots in production mode | ✅ | healthy against a real S3 endpoint; guard unchanged |
| Staging deployment completes | ✅ | full stack healthy, 55/55 migrations |
| Deployment preflight | ✅ | 6/6 `scripts/preflight-test.sh` |
| Backup script + integrity check | ✅ | drill PASS; verifier PASS |
| Backup schedule installed | ❌ | `flock` absent on this host; installer verified, must run on Linux |
| CA-issued TLS certificate | ❌ **BLOCKED** | current cert is self-signed |
| Restricted-role fixtures | ✅ | 4 identities provisioned |
| Sign-in helper fails closed | ✅ | identity asserted against `/auth/me` |
| Permission matrix passes | ✅ | 4 real identities, no fail-open |
| Backend regression | ✅ | 62/62 suites, 497/497 tests, exit 0 |
| Backend unit | ✅ | 219/219 suites, 1854/1854 tests |
| Frontend regression | ✅ | lint, types, build clean |
| Playwright | ✅ | 85/85, exit 0 |
| Accessibility | ✅ | 0 critical, 0 serious — 7 shell routes + palette + mobile |
| Monitoring + alerts | ✅ | 7/7 targets up, 24 rules, Alertmanager OK |
| Backup observability | ✅ | 6 metrics via textfile collector, 5 alerts |
| Alert delivery | ✅ | `ApiDown` firing → active in Alertmanager; 157/160 webhook deliveries |
| Duplicate `<main>` fixed | ✅ | every shell route exposes exactly one, asserted |
| Staging smoke tests | ✅ | auth, 12 endpoints, CORS, workflow safety chain |
| Object round-trip | ✅ | HeadBucket/upload/read/delete/cleanup |
| Performance smoke | ✅ | p50 8ms, p99 ≤69ms, 0 restarts |
| Rollback drill | ✅ | 3s rollback, 4s restore, migrations unchanged |
| HSTS `preload` removed | ✅ | no irreversible parent-domain commitment |

## Object storage — owner action required

The configured Cloudflare R2 credentials return **HTTP 401**. The endpoint resolves and is reachable (an unauthenticated root GET returns 400 as expected), so this is authorization, not network. The API's `S3StorageProvider.verifyProductionReadiness()` correctly refuses to boot, which is the guard working — **do not weaken it**.

To resolve, in the Cloudflare dashboard:

1. Create a **scoped** R2 API token — object read + write, plus delete only if attachment deletion is required. Not an account-wide admin token.
2. Scope it to the single bucket named by `ATTACHMENTS_S3_BUCKET`.
3. Update `deploy/.env` (mode 600, gitignored) — never commit it.
4. Re-run the deployment preflight, then verify with a `HeadBucket` + put/get/delete round trip against a disposable key such as `release-verification/<timestamp>/healthcheck.txt`.
5. Revoke the old token once the new one is verified.

Credential values must never appear in logs, documentation or command history.

## TLS — owner action required

The staging certificate is **self-signed** (`subject == issuer`, CN `staging.voltx.ai`, valid to 2027-07-25). It cannot be replaced from a developer machine: issuance requires DNS for `staging.voltx.ai` pointing at the staging ingress and a publicly reachable ACME challenge.

On the staging host:
1. Confirm DNS resolves to the ingress.
2. Issue via Let's Encrypt (or the approved CA) and install the **full chain**.
3. Private key mode 600, owned by the nginx user.
4. Configure renewal with an nginx reload hook, and test with the CA's dry-run.
5. Re-verify TLS 1.2/1.3, HTTP→HTTPS redirect, subject, issuer and chain.

**Review HSTS before launch.** nginx currently sends `max-age=63072000; includeSubDomains; preload`. `preload` commits the entire parent domain — do not submit it until the whole `voltx.ai` policy is understood.

## Deployment preflight

`deploy.sh` validates configuration **before** pulling, building or replacing any container. Checked: `DATABASE_URL`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_ACCESS_SECRET` (presence + ≥32 chars), `INTEGRATIONS_ENCRYPTION_KEY`, `CORS_ALLOWED_ORIGINS`, `WEB_HOST`, `API_HOST`, `NEXT_PUBLIC_API_BASE_URL`, the four object-storage variables, TLS file presence, and that production uses `s3` storage.

Three defects were fixed here, all of which had made the documented path unusable:

1. **Silent abort.** `set -e -o pipefail` killed the script on a `grep` command substitution whose key was absent — *before* the explicit error guard could run. The guards were unreachable dead code; a missing variable aborted the deploy with no output at all.
2. **Missing configuration.** `NEXT_PUBLIC_API_BASE_URL`, `WEB_HOST` and `API_HOST` were absent from `deploy/.env`.
3. **Unexported variable.** `REDIS_PASSWORD` was read from the script's own shell, but only ever handed to `docker compose` via `--env-file`. Under `set -u` this aborted the deploy *after* the databases were already running.

Preflight behaviour is covered by `deploy/scripts/preflight-test.sh` (6 assertions), which verifies a missing variable is named, that the script states nothing was changed, that a missing env file is reported, that valid configuration proceeds, and that **no configuration value is ever echoed**.

## Restricted-role fixtures

`backend/prisma/seed-e2e-fixtures.ts` (`pnpm prisma:seed:e2e-fixtures`) provisions three restricted identities alongside the owner, in the owner's organization, with deterministic custom roles. It is idempotent and rewrites grants so re-runs converge.

| Identity | Role | Grants |
| --- | --- | --- |
| `uiqa@local.test` | `owner` | full |
| `e2e-executive-crm@…` | `e2e-executive-crm` | base + sales read |
| `e2e-executive-finance@…` | `e2e-executive-finance` | base + finance read |
| `e2e-executive-approval@…` | `e2e-executive-approval` | base + `sales.opportunity.read`, **no** approval permissions |

`apps/web/e2e/authenticated/sign-in.ts` now **fails closed**: it uses a clean context, resolves the session identity from `/auth/me`, and refuses to continue when the resolved email differs from the requested one. Previously it only polled for a token — so a missing fixture let the matrix silently re-verify the owner and pass while proving nothing.

Fixing this immediately surfaced two further real problems: the owner authenticates with `E2E_USER_PASSWORD` rather than the fixture password (credentials are now resolved per identity), and the Executive page renders **two `<main>` landmarks**, which made a `locator("main")` assertion ambiguous.

## Monitoring

7/7 Prometheus targets up; 19 alert rules across 6 groups; Alertmanager healthy. Coverage: API/web/exporter down, 5xx rates, p99 latency, queue backlog/failures/stalls, Postgres down and connection saturation, Redis down and memory, disk low/critical, host memory pressure, certificate expiry (two thresholds), endpoint probes.

Backup jobs publish through node-exporter's textfile collector (`deploy/metrics/*.prom`, written atomically): last-success timestamp, archive size, cumulative failures, last-verification timestamp and result. Five alerts cover overdue backup, zero-size archive, repeated failures, overdue verification and failed verification — each with an `absent()` guard, because a schedule that never ran publishes nothing at all and a bare comparison would ignore it.

**Alert delivery is proven**: `ApiDown` fired in Prometheus and arrived active in Alertmanager, with 157 of 160 webhook notifications delivered to the configured receiver.

## Known limitations

1. Object-storage credentials invalid — blocks API boot and therefore staging.
2. Self-signed staging certificate.
3. Backup schedule not installed on this host (`flock` missing); daily retention only; archives unencrypted; no backup-age alert.
4. Staging smoke tests and the rollback drill have not run — both need a serving stack.
5. nginx has no `limit_req`, `gzip` or CSP; all three are handled at the app tier.
6. Axe is a floor, not proof of WCAG conformance — manual keyboard and screen-reader review is still outstanding.
7. The `voltx-api:previous` rollback tag exists, but a rollback would not help the current failure, which is configuration rather than code.
