# Voltx backend

NestJS 11 API — PostgreSQL/Prisma, optional Redis (caching + BullMQ job
queues), multi-tenant, RBAC-enforced. See `docs/architecture/overview.md`
(repo root) for how this fits into the rest of the platform, and
`docs/architecture/data-model.md` for the schema.

## Local development

```bash
pnpm install                    # postinstall runs prisma generate
docker-compose up -d            # local Postgres (pgvector) on :5433
cp .env.example .env            # fill in required vars (see below)
pnpm prisma:migrate             # apply migrations
pnpm prisma:seed                # populate the permission/role catalog
pnpm start:dev                  # http://localhost:3000/api/v1, hot reload
```

Required env vars at minimum: `DATABASE_URL`, `DIRECT_URL` (same value as
`DATABASE_URL` for local dev — see the datasource comment in
`prisma/schema.prisma`), `JWT_ACCESS_SECRET`, `INTEGRATIONS_ENCRYPTION_KEY`.
Everything else in `.env.example` is optional — the corresponding feature
degrades gracefully (a disabled AI provider, no-op error reporting, etc.)
rather than the app failing to boot.

Interactive API docs (every endpoint, every auth scheme) are served at
`http://localhost:3000/api` once the app is running.

## Commands

```bash
pnpm lint                       # eslint --fix over src/ and test/
pnpm test                       # unit tests (test/*.spec.ts)
pnpm test -- agent.service      # run a single unit spec by filename match
pnpm test:e2e                   # e2e tests (test/*.e2e-spec.ts) — needs Postgres up + .env.test
pnpm build                      # nest build

pnpm prisma:migrate             # create/apply a dev migration
pnpm prisma:migrate:deploy      # apply migrations (CI/prod)
pnpm prisma:generate            # regenerate the Prisma client
pnpm prisma:studio              # inspect the DB
pnpm prisma:seed                # seed permissions/roles
```

All tests live under `test/`, not colocated with `src/` — Jest tells unit
(`*.spec.ts`, run by `pnpm test`) from e2e (`*.e2e-spec.ts`, run by
`pnpm test:e2e`) apart by that suffix.

## Deployment

Deploys to Render as a Docker image, built and migrated via
`.github/workflows/deploy.yml`. See `docs/deployment/README.md` (repo root)
for the full flow and owner setup checklist — don't hand-deploy against a
production database without reading that first.
