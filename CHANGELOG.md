# Changelog

Notable changes to Voltx Platform. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [SemVer](https://semver.org/).

---

## [2.4.0-rc.1] — 2026-07-26

Release candidate for Limited Beta. No new product features: this release is
entirely security, reliability and operational hardening. Every claim below was
verified by running the system, not by inspecting the code.

### Security

- **Removed the abandoned SheetJS parser.** `xlsx@0.18.5` parsed user-uploaded
  spreadsheets and carried prototype-pollution and ReDoS advisories with **no
  patched version published to npm**. Replaced with exceljs; output shape
  unchanged so indexed documents chunk identically.
- **Closed SSRF in workflow steps.** `ApiStepExecutor` and `WebhookStepExecutor`
  fetched user-authored URLs directly, allowing access to private ranges and
  cloud metadata endpoints. Both now go through `OutboundHttpGuardService`.
- **Removed a hardcoded signing key.** Attachment download URLs fell back to
  `'insecure-development-key'`, so they could be forged using a key published
  in the source.
- **Fixed path traversal** in `LocalStorageProvider` and **header injection**
  via unescaped attachment filenames in `Content-Disposition`.
- **Fixed incomplete logout** — revoked one refresh token rather than the
  session, leaving other tokens for that session valid.
- **Closed a tenant-scoping gap**: the Prisma extension intercepted `findFirst`
  but not `findFirstOrThrow`, so that read path bypassed automatic
  `organizationId` scoping across all 93 models.
- **Protected `/metrics`**, previously unauthenticated and exempt from rate
  limiting. Token-gated with constant-time comparison; production refuses to
  boot without `METRICS_AUTH_TOKEN`.
- **Resolved all dependency advisories.** Both trees report no known
  vulnerabilities at any severity, down from 27 (15 high).

### Reliability

- **Readiness probe now returns 503** when a dependency is down. It previously
  returned 200 with a `"not_ready"` body, so orchestrators kept routing traffic
  to unhealthy instances. Every probe watching the always-200 `/api/v1/health`
  was repointed at `/readiness`.
- **Scheduled work runs once per cluster.** All six schedulers were registered
  per process, so each replica fired its own copy — duplicating customer
  messages, billing history and workflow runs. Added Redis-backed distributed
  locking that fails *closed*.
- **Fixed an out-of-memory crash under sustained load.** The API exhausted its
  JS heap and was restarted, losing 13–22% of in-flight requests. Cause was
  per-request log volume: pino-http's default serializers dumped every request
  and response header, making each line ~1,450 bytes (~5 MB/s at 3,500 req/s).
  Trimmed to 274 bytes. See `docs/operations/incident-2026-07-26-api-oom.md`.
- **Fixed a vacuous web healthcheck** that passed by following an auth redirect
  to `/login` — it would have reported healthy with the app badly broken.

### Operations

- **Monitoring that can page a human.** Prometheus previously had no alert
  rules and no Alertmanager, and three of five scrape jobs pointed at exporters
  that were never deployed. Added 19 alert rules (each with a runbook anchor),
  Alertmanager with severity routing and inhibition, and the postgres/redis/
  node/blackbox exporters. `deploy.sh` now starts the monitoring profile as
  part of every deploy.
- **Consolidated the deployment path.** The production docs pointed at a
  4-service compose file with no web app, no TLS and no monitoring, while the
  complete 13-service stack sat under a "staging" filename. One compose file
  now serves both environments via `DEPLOY_ENV`.
- **Added `restore.sh`** to match `backup.sh`, with an integrity check before
  it touches the database and a post-restore verification.

### Developer experience

- **Made the test environment hermetic.** Tests inherited 81 variables from the
  developer's git-ignored `.env`, including `REDIS_ENABLED=true` (which broke
  27 e2e tests) and live Anthropic/OpenAI/Stripe keys and a Sentry DSN. Tests
  now load `.env.test` and nothing else.
- **Reconnected CI.** It triggered only on `main` while work lands on `develop`
  and PRs target `release/**`, so no ordinary change was gated by anything. The
  dependency audit is now blocking.
- **Fixed a broken Docker build** — the Dockerfiles did not copy
  `pnpm-workspace.yaml`, so the current source could not be built into a
  deployable image at all.

### Verified performance envelope

Single replica, 2 CPU / 1 GiB, against `/readiness`:

| Metric | Value |
| --- | --- |
| Sustained throughput | ~3,300 req/s over 30 min, **0.00% errors** (5,885,289 requests) |
| p95 / p99 latency | 29 ms / 54 ms |
| Stress (500 VUs) | 3,173 req/s, p99 201 ms, 0.00% errors |
| Bottleneck | API CPU (~195% of a 200% cap); Postgres 9%, Redis 3% |

### Known limitations

See [`docs/known-issues.md`](docs/known-issues.md). Notably: deploys cause a
brief outage, rate limiting is per-process (correct at one replica), and only
unauthenticated endpoints have been load-tested.
