# Production Readiness Checklist

Status as of VT-030 (beta blocker remediation pass), with the CI/CD and
Validation sections refreshed during a later full-repo production audit
(2026-07-17) — see the note on each for what was actually re-verified then
versus what remains true from VT-030 and wasn't re-checked. Check items are
verified working as of the date noted; unchecked items are known gaps — see
`known-issues.md` for detail.

## Authentication & Session
- [x] Register / login / logout / password reset — verified live end-to-end against a running backend
- [x] Session restoration after app restart (access-token check → refresh fallback → clear on failure)
- [x] Token refresh actually re-authenticates the retried request (fixed VT-029 — was silently broken)
- [x] Post-login/register session carries full RBAC context (roles/permissions/organizationId) — fixed VT-029
- [x] Auth-specific rate limiting (10 attempts/60s on login/register/reset, separate from the blanket API limit)
- [x] Team invitation flow — built and live-tested in VT-030: invite by email + role, expire/revoke/resend, accept as new or existing account, RBAC-gated, audited
- [x] Multi-organization switching — built and live-tested in VT-030: switch active org without logging out, every org-scoped provider refetches automatically

## Security
- [x] RBAC enforced via `AUTH_GUARDS` + `PermissionGuard` on every controller except intentionally-open ones (health/metrics, personal-scope AI resources)
- [x] Tenant/organization isolation enforced via Prisma extension + explicit `organizationId` scoping before every mutation (audited, no IDOR path found)
- [x] No hardcoded secrets in source (audited)
- [x] CORS: closed by default, env-driven allowlist (`CORS_ALLOWED_ORIGINS`)
- [x] Security headers via Helmet (HSTS, X-Frame-Options, X-Content-Type-Options, etc.); CSP intentionally left off — pure JSON API, Swagger UI needs a relaxed policy
- [x] Input validation: global `ValidationPipe` (whitelist + forbid-unknown) + `class-validator` on every DTO
- [x] Webhook receivers verify provider signatures + use unguessable tokens, tenant-scoped internally despite being unauthenticated by design

## Infrastructure
- [x] Multi-stage production Dockerfile, non-root user, container healthcheck
- [x] Graceful shutdown (`enableShutdownHooks()` → Prisma connection pool closes cleanly on SIGTERM)
- [x] Structured logging (pino), request tracing (request ID propagation), OpenTelemetry (env-gated)
- [x] Prometheus metrics (`/metrics`, HTTP request counter + duration histogram + default Node metrics)
- [x] Error reporting via Sentry (env-gated, no-op without `SENTRY_DSN`)
- [x] Redis-backed knowledge-embedding cache (optional, `REDIS_ENABLED`) with in-memory fallback for single-instance/dev
- [x] `.env.example` documents all ~61 configuration variables
- [x] Grafana dashboard — imported into a real Grafana+Prometheus stack in VT-030 and confirmed all 7 panels return real data
- [x] Backup script — executed against the live dev database in VT-030 (`pg_dump`), then actually restored into a fresh database and row counts verified

## CI/CD (updated 2026-07-17 — the hosting-target gap below is closed)
- [x] `ci.yml`: 8 jobs — backend (lint/unit/e2e/build), web, marketing, mobile
  (analyze/test/build, now against the `main_production.dart` flavor
  entrypoint rather than the default one), and one each for
  `packages/sdk-typescript`, `packages/cli`, `packages/sdk-python`,
  `packages/sdk-flutter` (previously untested in CI despite having real
  test suites)
- [x] `deploy.yml`: builds and pushes a Docker image to GHCR, runs `prisma migrate deploy`, then deploys to Render via its API — hosting target (Render + Vercel + Neon) was chosen; see `docs/deployment/README.md`
- [x] `deploy.yml` now triggers via `workflow_run` off `ci.yml`'s completion (gated on `conclusion == 'success'`) instead of racing the same `push` event with no ordering guarantee, so a commit whose CI fails can no longer deploy

## Database
- [x] Prisma migrations tracked and applied via `prisma:migrate:deploy` (22 migrations, including the new `invitations` table)
- [x] Seed script (`prisma/seed.ts`) seeds permissions/roles catalog — confirmed idempotent (upsert-based), includes the new `organization.invite` permission
- [x] pgvector extension for knowledge embeddings

## Mobile platforms
- [x] macOS — release build succeeds
- [x] Android — release APK build succeeds (`--flavor production`); fixed a real Gradle config bug in VT-030. Not runtime-verified (no device/emulator in this environment)
- [x] iOS — unflavored release build succeeds; runtime-verified on a real simulator including the full deep-link → invitation-accept flow. Flavored builds need real Xcode schemes (not yet created — see known-issues.md)
- [x] Deep linking (`voltx://`) — registered on all 3 platforms, live-verified on iOS simulator (cold start + warm start)

## Validation (last full run: 2026-07-17 production audit)
- `pnpm lint` — clean
- `pnpm test` — 1215/1215 (172 suites)
- `pnpm test:e2e` — 341/341 (53 suites, real Postgres)
- `pnpm build` — clean
- `flutter analyze` — no issues
- `flutter test` — 183/183
- web (`pnpm lint` / `pnpm build`) — clean
- marketing (`npm run lint` / `npm run build`) — clean
- `flutter build macos` — not verifiable in the audit sandbox (Xcode CLT only,
  no `xcodebuild`); last verified in VT-030, and CI now builds the
  `main_production.dart` flavor on every push
- `flutter build apk --release --flavor production` — succeeds (61.1MB, VT-030)
- `flutter build ios --release --no-codesign` — succeeds (23.8MB, VT-030)
