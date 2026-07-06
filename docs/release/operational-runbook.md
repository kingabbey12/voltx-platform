# Operational Runbook

## Health checks
- `GET /api/v1/health` — overall app health, includes database dependency status
- `GET /readiness` — readiness probe (version-neutral, not under `/api/v1`)
- `GET /liveness` — liveness probe (version-neutral, not under `/api/v1`)
- `GET /metrics` — Prometheus exposition format (`voltx_http_requests_total`, `voltx_http_request_duration_ms`, default Node process metrics)

All four are excluded from rate limiting (`@SkipThrottle()`) and from the versioned `/api/v1` prefix where applicable — safe for a load balancer or Prometheus to hit frequently.

## Common incidents

### "Requests are failing with 429"
Two independent rate limiters exist:
- Blanket API limit: `RATE_LIMIT_LIMIT`/`RATE_LIMIT_TTL_SECONDS` (default 120/60s)
- Auth-endpoint limit: `AUTH_RATE_LIMIT_LIMIT`/`AUTH_RATE_LIMIT_TTL_SECONDS` (default 10/60s, applies only to login/register/password-reset/verify-email)
Check which endpoint is being hit and whether the limit is appropriately tuned for real traffic vs. a misbehaving client hammering it. Raise the relevant env var and redeploy if it's legitimately too tight.

### "AI features are 503-ing with 'No AI providers are enabled'"
Expected if no `*_ENABLED`/`*_API_KEY` pair is set for at least one of OpenAI/Anthropic/Google. This is a real, correct error for anything that actually needs a model (agent creation, chat, AGENT-type workflow steps). It is NOT expected for: listing agents (returns empty list), or running a workflow with no AGENT steps (should succeed) — if either of those 503s, that's a regression of a bug fixed in VT-029 (`agent.registry.ts` / `workflow.service.ts`).

### "A workflow run is stuck"
Check `GET /api/v1/workflows/runs/:runId/logs` and `GET /api/v1/workflows/runs/:runId/checkpoints` first. If a step failed and exhausted retries, it lands in the dead-letter table (`GET /api/v1/workflows/dead-letters`) and the run is marked `FAILED` — this is the existing durability/retry mechanism; there is no separate message queue to check.

### "Database connection errors"
Check `DATABASE_CONNECTION_LIMIT`/`DATABASE_POOL_TIMEOUT_SECONDS` against actual concurrent load and your Postgres plan's connection limit. `/api/v1/health`'s `dependencies.database` field reports live connectivity + latency.

### "Someone reports seeing another org's data"
This should be impossible given the tenant-isolation design (Prisma extension auto-scopes `organization`/`user`/`membership` queries; every other mutation is preceded by an org-scoped lookup) — treat any report of this as a P0, not a "check the logs later" item. Start by identifying the exact endpoint and confirming whether it goes through the tenant-scoped Prisma client or a raw query that bypassed it.

### "Logout doesn't seem to actually revoke the session server-side"
Was a real bug (fixed VT-029): if the access token had expired at the moment of logout, the token-refresh auto-retry corrupted the retried logout request, so the client cleared its local session while the server-side refresh token stayed valid. If this resurfaces, check `auth_interceptor.dart`'s retry logic first.

### "A user can't accept an invitation" / "invitation link does nothing"
Check in order: (1) has the invitation expired (7 days) or already been used/revoked — `GET /invitations/:token` returns its current `status`; (2) if the invitee already has an account, `accept` never issues tokens (by design, to avoid a password bypass) — they need to sign in normally after accepting, this is not a bug; (3) on mobile, if the link opens the app but shows "Page Not Found" instead of the accept screen, that's the cold-start deep-link routing bug fixed in VT-030 (`lib/router/app_router.dart`'s `redirect` callback) — check it wasn't reintroduced.

### "Switching organizations shows stale data from the previous org"
`invalidateOrganizationScopedProviders` (`lib/features/auth/presentation/providers/auth_providers.dart`) must be called after every successful `switch-organization` call and must be kept in sync as new org-scoped providers are added — if a new feature adds a top-level provider that reads organization-scoped data, it needs to be added to that invalidation list or it will silently show the previous organization's data after a switch.

## Where things live
- Logs: structured JSON via pino, shipped wherever your log aggregator is pointed (stdout by default — no log shipper is configured in this repo, wire one up against your hosting platform's log collection)
- Traces: OpenTelemetry, OTLP HTTP exporter, only active if `OTEL_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is set
- Errors: Sentry, only active if `SENTRY_DSN` is set (backend and mobile both)
- Metrics: Prometheus format at `/metrics`; a starter Grafana dashboard is at `docs/grafana/voltx-backend-dashboard.json` (import it, don't rebuild from scratch)
- Backups: `backend/scripts/backup-db.sh`, see `docs/operations/backup-and-restore.md` for the restore procedure

## Escalation-worthy vs. not
**Escalate immediately:** cross-tenant data leak, auth completely down, database unreachable, backend failing to boot.
**Handle on next business day:** rate-limit tuning, a single workflow stuck (has a dead-letter/retry path), UI polish regressions, missing invitation flow (known gap, not a regression).
