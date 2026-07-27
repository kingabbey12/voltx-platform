# Architecture

## System Architecture

```
                        ┌─────────────────────────────────────┐
                        │            Load Balancer             │
                        │         (Cloudflare / Nginx)         │
                        └──────┬────────────────────┬──────────┘
                               │                    │
                    ┌──────────┴──────────┐ ┌──────┴──────────┐
                    │   Next.js (Web)     │ │  Flutter (Mobile)│
                    │  apps/web/          │ │  apps/mobile/    │
                    └──────────┬──────────┘ └──────┬──────────┘
                               │                    │
                               └────────┬───────────┘
                                        │ HTTPS / REST + SSE
                              ┌─────────┴─────────┐
                              │   NestJS Backend   │
                              │   backend/src/     │
                              ├────────────────────┤
                              │   BullMQ Queue     │
                              │   (Redis-backed)   │
                              └────┬───────────┬───┘
                                   │           │
                          ┌────────┴───┐  ┌───┴────────┐
                          │ PostgreSQL │  │   Redis    │
                          │ (pgvector) │  │ (Cache+Q)  │
                          └────────────┘  └────────────┘
```

## Service Components

### 1. Backend (NestJS 11)

**Module structure** (`backend/src/modules/`):
- `ai/` — AI agent runtime, LLM providers, memory, tool execution
- `sales/` — Sales copilot domain module
- `auth/` — Authentication, MFA, SSO, OAuth
- `workflows/` — Workflow engine, steps, conditions
- `knowledge/` — Knowledge base, vector search, embeddings
- `organizations/` — Organization management, branding
- `users/` — User management, RBAC
- `integrations/` — External integrations (Slack, email, etc.)
- `billing/` — Stripe billing, subscriptions, metering
- `marketplace/` — Extension marketplace
- `comms/` — Communications (email, SMS, Slack)
- `platform/` — Platform admin, system health, alerts
- `extensions/` — Extension framework

**Cross-cutting concerns**:
- `common/` — Guards, interceptors, filters, pipes, middleware
- `config/` — Configuration, env validation, Swagger
- `database/` — Prisma service, tenant extension
- `bootstrap/` — App initialization, OpenTelemetry, Sentry

### 2. Web App (Next.js 15)

**Feature structure** (`apps/web/src/`):
- `app/` — Next.js App Router pages
- `components/` — Shared UI components
- `hooks/` — React Query hooks for API integration
- `lib/` — API clients, utilities
- `providers/` — React context providers
- `theme/` — Design tokens, theme system
- `router/` — Route configuration

### 3. Mobile App (Flutter)

**Feature structure** (`apps/mobile/lib/`):
- `features/` — Feature-first structure
- `core/` — Networking, routing, theming
- State management via Riverpod

## Data Flow

### Request Pipeline

```
Client → Load Balancer → Helmet (Security Headers)
                       → CORS Check
                       → Rate Limiter (ThrottlerModule)
                       → Request ID Middleware
                       → Tenant Middleware (JWT decode)
                       → Validation Pipe
                       → Guard Chain (JWT → RBAC → Tenant)
                       → Controller → Service → Repository
                       → Response Interceptor (Envelope)
                       → Logging Interceptor
```

### AI Agent Execution

```
User Input → Conversation Service
          → AI Runtime (Provider selection)
          → LLM Call (Anthropic/OpenAI/Google)
          → Tool Execution (Registry → Executor)
          → Memory Capture (Scorer → Selector)
          → Response Stream (SSE)
```

### Workflow Engine

```
Trigger → Step Executor → Condition Evaluator
       → Tool/Action Step → Next Step
       → Approval Gate (wait) → Continue
       → Completion → Webhook/Callback
```

### Scheduled Work and Horizontal Scaling

Recurring work is registered per process (`@Interval`, and `CronJob`s added
through `SchedulerRegistry`), so **every replica wakes for every tick**. These
sweeps are not idempotent — they send customer-facing messages, write
`SubscriptionChange` history, and start workflow runs whose API/webhook steps
call third parties — so running one twice corrupts data that a rollback cannot
repair.

Each scheduled entry point is therefore wrapped in `DistributedLockService`
(`src/common/scheduling/distributed-lock.service.ts`), which offers two
primitives:

| Primitive | Semantics | Used for |
| --- | --- | --- |
| `runExclusive(key, ttl, task)` | Acquire, run, release; auto-extends while the task runs | Recurring `@Interval` sweeps — "never two at once", next interval retries |
| `runOncePerWindow(key, window, task)` | Claim held for the full window regardless of task duration | Cron ticks — "exactly one replica per tick", absorbing clock skew |

Cron ticks are keyed by `cronTickKey(scope, job.lastDate())`, which rounds the
fire time to the nearest second so replicas firing the same tick agree on a key
while consecutive ticks stay distinct.

Two properties are load-bearing and must not be relaxed:

- **The lock fails closed.** If Redis is unreachable the sweep is *skipped*, not
  run unguarded. A skipped tick self-heals on the next one; a duplicated tick
  does not. This is deliberately the opposite of `CacheService`, which fails soft.
- **Production cannot boot without Redis.** `assertRedisRequirement` rejects
  startup when `REDIS_ENABLED !== 'true'` under `NODE_ENV=production`. Without
  it the lock degrades to an in-process implementation that provides no
  cross-replica guarantee at all, and horizontal scaling would silently begin
  duplicating billing and customer messages.

Adding a new `@Interval` or `CronJob` without one of these primitives is a
correctness bug on any deployment running more than one replica.

## Multi-Tenancy

Two-layer isolation:
1. **Tenant Middleware** — Decodes JWT, sets organization context via AsyncLocalStorage
2. **Prisma Extension** — Auto-injects `organizationId` scope on queries

### Database per-tenant separation
- Shared database with `organizationId` column on all multi-tenant tables
- Prisma client extension enforces row-level isolation

## Security Architecture

```
┌─────────────┐
│  Request    │
└──────┬──────┘
       │
┌──────┴──────┐
│  Rate Limit │  ← ThrottlerModule (120 req/60s)
└──────┬──────┘
       │
┌──────┴──────┐
│  Auth Guard │  ← JWT / PAT / OAuth strategies
└──────┬──────┘
       │
┌──────┴──────┐
│  RBAC Guard │  ← Permission-based access control
└──────┬──────┘
       │
┌──────┴──────┐
│ Tenant Guard│  ← Organization isolation
└──────┬──────┘
       │
┌──────┴──────┐
│  Validation │  ← Zod / Class-validator (whitelist mode)
└─────────────┘
```

## Observability Stack

```
OpenTelemetry SDK → OTLP Exporter → Collector → Jaeger / Grafana Tempo
Prometheus Metrics → /metrics endpoint → Grafana
Structured Logs → pino → stdout → log aggregator
Error Tracking → Sentry SDK → sentry.io
```

## API Design

- RESTful with URI versioning (`/api/v1/`)
- Global envelope: `{ success, data, meta: { requestId, timestamp, version } }`
- Pagination via `{ items: [], total, page, limit, totalPages }`
- SSE for streaming responses (AI chat, workflow execution)
- WebSocket for real-time updates (Socket.IO)
