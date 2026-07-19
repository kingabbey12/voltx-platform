# RAG v1 Deployment Checklist

## Preconditions
- [ ] Docker is running (for local validation workflows).
- [ ] PostgreSQL is reachable at configured host/port.
- [ ] Redis is reachable and `REDIS_ENABLED=true` in production environment.
- [ ] Required secrets/config are present for AI provider credentials.

## Database
- [ ] Verify no pending migrations in primary database:
  - `cd backend && pnpm prisma migrate status`
- [ ] Verify no pending migrations in test database:
  - `cd backend && pnpm exec dotenv -e .env.test -- pnpm prisma migrate status`
- [ ] Apply migrations in deployment environment:
  - `cd backend && pnpm prisma migrate deploy`

## Build & Quality Gates
- [ ] Run lint:
  - `cd backend && pnpm lint`
- [ ] Run build:
  - `cd backend && pnpm build`
- [ ] Run unit/integration tests:
  - `cd backend && pnpm test`
- [ ] Run full e2e tests:
  - `cd backend && pnpm test:e2e`
- [ ] Confirm all suites pass with no failing tests.

## RAG v1 Runtime Validation
- [ ] Confirm ingestion endpoints succeed for text and file inputs.
- [ ] Confirm knowledge search returns citations and ranked results.
- [ ] Confirm dashboard endpoints respond (`/knowledge/stats`, `/knowledge/jobs`, `/knowledge/searches`, `/knowledge/chunks`, `/knowledge/failures`).
- [ ] Confirm evaluation endpoint runs and returns metrics.
- [ ] Confirm Redis embedding cache metrics are visible in stats.

## Release Controls
- [ ] Create/review release tag `rag-v1` in Git.
- [ ] Capture validation evidence (lint/build/test/e2e summaries).
- [ ] Announce release window and rollback owner.

## Rollback Plan
- [ ] If deployment fails, roll back application version to last known-good release.
- [ ] If data migration rollback is required, use DB backup restore procedure.
- [ ] Re-run smoke checks after rollback.

## Post-Deploy Smoke Tests
- [ ] Create a knowledge source.
- [ ] Ingest a sample document.
- [ ] Execute a knowledge search query and verify citation metadata.
- [ ] Execute one AI conversation query that uses knowledge context.
- [ ] Check logs/metrics for errors in ingestion, retrieval, and conversation flows.
