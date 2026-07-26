# Testing

## Canonical end-to-end command

```bash
docker compose --profile test run --rm e2e
```

It starts the deterministic local dependency stack, applies migrations, runs both seed sets, and executes e2e tests inside the Docker network.

## Running e2e directly on the host

```bash
cd backend && docker-compose up -d && pnpm prisma:migrate:deploy && pnpm test:e2e
```

This needs Postgres on port 5433 with a `voltx_test` database — nothing else. All 52 suites should pass.

## The test environment is hermetic

`backend/.env.test` is the **only** env file loaded when `NODE_ENV=test`; there is no fall-through to `.env.local` or `.env`. This is enforced in `src/app.module.ts` and guarded by `test/test-env-hermetic.spec.ts`.

It matters more than it looks. When the fall-through existed, every local run silently inherited 80+ variables from the developer's personal, git-ignored `.env` — and two of those changed the outcome:

- **`REDIS_ENABLED=true`** switched workflow runs, attachment processing, and agent tasks from inline execution to BullMQ. 27 e2e tests assert on completed state immediately after the triggering request, so they observed `PENDING` and failed. CI, which has no `.env`, passed. The suite was green in CI and red on developer machines for reasons nothing in the repository explained.
- **Live `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `STRIPE_API_KEY` / `SENTRY_DSN`** meant a local test run could spend real money and report to the real Sentry project.

Because nothing falls through, **every variable the suite depends on must be declared in `.env.test`, including the ones whose value is "off"**. If you add code that reads a new env var, add it there too or it silently takes its production default under test. `.env.docker.test` is the container-hostname variant of the same contract; the regression spec keeps the behaviour-affecting keys in step across both.

## Host commands

```bash
(cd backend && pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build)
(cd apps/web && npm run lint && npx tsc --noEmit && NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 npm run build)
```

Unit tests mock network boundaries; no test requires public DNS, internet access, or cloud credentials.

## What CI enforces

CI runs on `main`, `develop` and `release/**` — the branches work actually happens on. It previously triggered only on `main`, which meant no ordinary change was gated by anything; `test/ci-quality-gate.spec.ts` now fails if a branch is dropped again.

Every step below is **blocking**, including the dependency audit:

| Step | Backend | Web |
| --- | --- | --- |
| `pnpm lint` | ✓ | ✓ |
| `tsc --noEmit` | ✓ | ✓ |
| `pnpm test` | ✓ | — |
| `pnpm test:e2e` | ✓ | Playwright |
| `pnpm build` | ✓ | ✓ |
| `pnpm audit --audit-level=high` | ✓ | ✓ |

### Dependency audit

Both trees are currently clean at **every** severity, so the audit fails only on a genuinely new advisory.

Fix one by pinning the patched version under `overrides:` in `backend/pnpm-workspace.yaml` or `apps/web/pnpm-workspace.yaml` — **not** by restoring `continue-on-error`. Note that pnpm 10 ignores the `pnpm` key in `package.json`; overrides left there are silently dropped.

**Pin conservatively.** An open-ended `>=` range resolves to the newest major and can break the build in ways the advisory never required — during this work `uuid: '>=11.1.1'` pulled in an ESM-only 14.x that stopped 12 Jest suites from loading, and a `minimatch` override that no advisory called for removed the CommonJS default export ESLint depends on. Prefer `^`, and re-run lint, tests and build after any override change.
