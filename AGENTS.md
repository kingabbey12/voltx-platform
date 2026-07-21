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
