# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Engineering Standards

**General rules**
- Production-quality code only.
- Never use placeholders, TODOs, or mock implementations unless explicitly requested.
- Never duplicate existing logic — reuse existing services, repositories, providers, and widgets.
- Follow Clean Architecture and SOLID principles.
- Preserve backward compatibility whenever possible.

**Before making changes**
1. Read the relevant implementation.
2. Explain the implementation plan.
3. Modify only the requested scope.
4. Avoid unrelated refactoring.

**Validation** — resolve all errors before stopping.

Backend:
```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

Mobile:
```bash
flutter analyze
flutter test
flutter build macos --debug
```

**Completion report** — always end with:
- Files changed
- Why the change was needed
- Validation results
- Remaining work
- Risks (if any)

Never continue automatically to another phase unless explicitly instructed.

## Repository structure

This is a monorepo with two independent apps:

- `backend/` — NestJS 11 + Prisma/PostgreSQL multi-tenant API (package manager: **pnpm**)
- `apps/mobile/` — Flutter app (Riverpod + go_router + Dio)

There is no root-level build tool; each app is developed independently from its own directory.

## Backend (`backend/`)

### Commands

```bash
pnpm install                    # install deps (postinstall runs prisma generate)
docker-compose up -d            # start local Postgres (port 5433, db/user/pass: voltx)

pnpm start:dev                  # run API with hot reload
pnpm build                      # nest build
pnpm lint                       # eslint --fix over src/ and test/

pnpm test                       # unit tests (test/*.spec.ts via Jest)
pnpm test -- agent.service      # run a single unit spec by filename match
pnpm test:cov                   # unit tests with coverage
pnpm test:e2e                   # e2e tests (test/*.e2e-spec.ts, loads .env.test, runInBand)

pnpm prisma:migrate             # create/apply a dev migration
pnpm prisma:migrate:deploy      # apply migrations (CI/prod)
pnpm prisma:generate            # regenerate Prisma client
pnpm prisma:studio               # inspect DB
pnpm prisma:seed                 # seed permissions/roles/etc via prisma/seed.ts
```

All tests (unit **and** e2e) live under `backend/test/`, not colocated with `src/`. Jest distinguishes them by suffix: `*.spec.ts` (unit, run by `pnpm test`) vs `*.e2e-spec.ts` (run by `pnpm test:e2e`, needs Postgres up and `.env.test`).

Infrastructure validation (e.g. Docker Compose YAML, deploy secrets) also live under `backend/test/` and use `js-yaml` (dev dependency) for YAML parsing. Run them with `pnpm test -- docker-compose-limits` or `pnpm test -- deploy-secrets-regression`.

### Docker Compose

All four compose files (`docker-compose.yml`, `backend/docker-compose.yml`, `backend/docker-compose.prod.yml`, `deploy/docker-compose.yml`) have resource limits on every long-running service:

| Service | CPUs | Memory limit | Memory reservation |
|---------|------|-------------|-------------------|
| postgres (local) | 2.0 | 2g | 1g |
| postgres (prod) | 2.0 | 4g | 2g |
| postgres (staging) | 2.0 | 2g | 1g |
| redis | 1.0 | 512m | 256m |
| api | 2.0 | 1g | 512m |
| web (dev) | 1.0 | 1g | 512m |
| web (staging) | 1.0 | 512m | 256m |
| nginx | 0.5 | 128m | 64m |
| prometheus | 1.0 | 1g | 512m |
| grafana | 0.5 | 256m | 128m |

Note: `deploy.resources` (swarm mode) is NOT used — limits are top-level service fields (`cpus`, `mem_limit`, `mem_reservation`), which work with `docker compose` (non-swarm).

### Secrets Management

**Critical rule: never commit `.env` files.** All `.env` and `.env.*` files are excluded by the root `.gitignore` and per-directory `.gitignore` files. Template files (`.env.example`, `.env.staging`) use placeholder values only — actual secrets are injected at deploy time.

**Current setup:** The staging deployment uses a `deploy/.env` file loaded by Docker Compose via `env_file: .env` and the deploy script's `--env-file` flag. This file is NOT tracked by git and should have `chmod 600` permissions. The `deploy/deploy.sh` script includes a security audit that:
1. Verifies `.env` exists
2. Checks file permissions (warn if not 600/640)
3. Confirms `.env` is gitignored
4. Supports `--strict` mode that fails on any security warning

**Production migration path:**
1. Replace `env_file: .env` with host environment variables: `export $(grep -v '^#' deploy/.env | xargs)` then `docker compose up -d`
2. Use Docker secrets (`/run/secrets/*`) for sensitive values
3. Integrate a secrets manager (Vault, AWS Secrets Manager, 1Password Connect) as the single source of truth
4. Run `deploy/deploy.sh --strict` in CI to gate the deploy pipeline

**Testing:** `pnpm test -- deploy-secrets-regression` validates gitignore coverage, `.env.example` has no real secrets, `.env` is not tracked, and the deploy script has security checks.

### Database Backups

**Critical rule: an unverified backup is not a backup — it's an assumption.** The backup infrastructure is organized under `deploy/`:

- `deploy/scripts/backup.sh` — Docker-aware backup script. Run with `--docker` to back up via `docker compose exec pg_dump`, or `--direct DATABASE_URL` for standalone. Outputs gzip-compressed SQL files with integrity check and automatic retention pruning.
- `deploy/deploy.sh` — automatically calls `backup.sh` before running migrations (Step 3.5). Supports `--skip-backup` to opt out. Shows restore instructions on completion.
- `deploy/crontab` — daily 3:00 AM UTC backup schedule. Install with `crontab deploy/crontab`.
- `docs/operations/backup-and-restore.md` — full documentation covering backup, restore, scheduled backups, verification, and disaster recovery.

**Backward compatibility preserved:** `backend/scripts/backup-db.sh` remains functional for local dev (standalone pg_dump).

**Testing:** `pnpm test -- database-backup-regression` validates backup.sh exists, is executable, supports both modes, has integrity checks, retention config, deploy script integration (--skip-backup flag, backup precedes migrations, restore output), crontab schedule, and documentation coverage.

### Architecture

**Request pipeline** (see `src/bootstrap/configure-app.ts` and `src/app.module.ts`): every request gets a request ID, runs through Helmet/compression, a global `api` prefix with URI versioning (`/api/v1/...`, health/metrics endpoints excluded), a global `ValidationPipe` (whitelist + forbid-unknown + implicit conversion), a global exception filter, and logging/response/timeout interceptors. Responses are wrapped in a `{ success, data, meta: { requestId, timestamp, version } }` envelope (`src/common/dto/api-response.dto.ts`) — the mobile `ApiClient` unwraps this envelope on every call.

**Multi-tenancy is the central architectural concern.** Two layers work together:
1. `TenantMiddleware` (`src/common/tenant/tenant.middleware.ts`) runs on every request, opportunistically decodes the JWT access token (without enforcing auth) to seed an AsyncLocalStorage-backed `TenantContextService` with `{ requestId, userId, organizationId }` before any guard/handler runs.
2. `createTenantPrismaExtension` (`src/database/tenant-prisma.extension.ts`) is a Prisma Client Extension that intercepts `organization`/`user`/`membership` queries and auto-injects an `organizationId` scope from the current tenant context — this is defense-in-depth row-level isolation baked into the ORM layer itself, not just guards.

Protected routes compose three guards via `AUTH_GUARDS` (`src/common/guards/protected.guards.ts`): `JwtAuthGuard` (validates the bearer token) → `UserContextGuard` (resolves membership + RBAC permissions) → `TenantGuard` (enforces JWT-derived tenant isolation). Apply this constant rather than hand-assembling guards on new controllers.

**RBAC**: `Role` / `Permission` / `RolePermission` / `Membership` models (see `prisma/schema.prisma`) implement per-organization role-based permissions. Permission keys follow a `resource.action` convention (e.g. `sales.opportunity.create`, `ai.agent.run`) — see `prisma/seed.ts` for the full catalog and the pattern to follow when adding new permissions.

**AI module** (`src/modules/ai/`) is the largest subsystem — a provider-agnostic agent runtime:
- `providers/` — pluggable `AIProvider` implementations (Anthropic, OpenAI, Google) behind a common `chat`/`stream`/`embeddings`/`models` interface (`providers/ai-provider.interface.ts`); provider selection happens via `models/model-registry.service.ts`.
- `runtime/ai-runtime.service.ts` — orchestrates provider calls and tool execution behind a single streaming interface (`AIStreamEvent`).
- `agents/` — `Agent`/`AgentRun` entities; `AgentExecutor` drives one turn of an agent run: loads conversation history, executes any requested tools (validated against the agent's `allowedToolNames`), streams the model response, persists the assistant message, and hands off to memory capture.
- `memory/` — long-term conversation memory with scoring/selection (`memory.scorer.ts`, `memory.selector.ts`) to decide what's relevant to inject into future prompts.
- `tools/` — a tool registry/executor pattern for function-calling; add new tools by implementing `ToolInterface` and registering in `tool.registry.ts`.
- `conversations/` — conversation + message persistence, independent of any specific agent.

**Sales module** (`src/modules/sales/`) is the first domain module built on top of this AI/tenant foundation ("Sales Copilot") — `SalesCompany`/`SalesContact`/`SalesLead`/`SalesOpportunity`/`SalesActivity` models plus `sales-ai.service.ts`, which is the pattern to follow for wiring a domain module into the agent/tool system.

**Module pattern**: each domain lives under `src/modules/<name>/` with `*.module.ts` / `*.controller.ts` / `*.service.ts` / `*.repository.ts` (repository owns Prisma access, service owns business logic, controller is thin). Config is centralized in `src/config/configuration.ts` with env validation in `src/config/env.validation.ts` — read config via `ConfigService`, not `process.env`, outside of bootstrap-time files.

## Mobile (`apps/mobile/`)

### Commands

```bash
flutter pub get                     # install deps
flutter run                         # run on a connected device/simulator
flutter analyze                     # static analysis (flutter_lints)
flutter test                        # run all tests under test/
flutter test test/path/to/file_test.dart   # run a single test file
dart run build_runner build --delete-conflicting-outputs   # regenerate freezed/json_serializable code
```

Run `build_runner` after changing any `@freezed` model or anything using `json_serializable` annotations (`.g.dart`/`.freezed.dart` files are generated, not hand-edited).

### Architecture

Feature-first structure under `lib/features/<feature>/{data,presentation}` (e.g. `ai`, `auth`, `dashboard`, `organizations`, `sales`, `users`, `settings`). Each feature's `data/` holds models and repositories; `presentation/` holds `screens/`, `widgets/`, and Riverpod `providers/`.

- **State management**: `flutter_riverpod`/`hooks_riverpod`. App bootstrap (`lib/app/bootstrap.dart`) creates a `ProviderContainer`, restores the auth session (`authSessionProvider`) before `runApp`, then hands the container to `UncontrolledProviderScope`.
- **Networking**: `lib/core/network/api_client.dart` wraps `Dio` and unwraps the backend's `{ success, data, meta }` envelope into typed models, converting `DioException`s into a `NetworkException`. Follow this pattern for new endpoints rather than calling `Dio` directly from features.
- **Routing**: `go_router`, configured in `lib/router/app_router.dart` / `lib/router/routes.dart` (there is also `lib/core/router/` — check both before adding routes).
- **Theming**: token-based theme system under `lib/theme/{tokens,extensions,components}`.
- **Storage**: `flutter_secure_storage` for sensitive data (tokens), `shared_preferences` for non-sensitive prefs.

The `ai` feature currently mixes real API models/providers with `data/mock/mock_ai_data.dart` — check whether a given screen is wired to the live backend or still using mock data before assuming behavior.
