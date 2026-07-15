# Architecture overview

Voltx is four independently-deployed apps sharing one backend API. There is no
root-level build tool or shared package registry tying them together — each is
developed and versioned from its own directory (see the root `CLAUDE.md`).

```
                              usevoltx.com                app.usevoltx.com
                          (apps/marketing, Vercel)      (apps/web, Vercel)
                                    │                            │
                                    │                            │  HTTPS, Bearer JWT
                                    │                            ▼
                           (static marketing site,      api.usevoltx.com
                            no auth, contact form        (backend, Render)
                            via Resend)                          │
                                                                  │
                              apps/mobile (Flutter,                │
                              iOS + Android) ──────────────────────┤
                              same JSON API, Dio client            │
                                                                    ▼
                                                    ┌───────────────────────────┐
                                                    │  PostgreSQL + pgvector    │
                                                    │  (Neon)                   │
                                                    └───────────────────────────┘
                                                                    │
                                                    ┌───────────────────────────┐
                                                    │  Redis (optional)         │
                                                    │  knowledge-embedding      │
                                                    │  cache + BullMQ queues    │
                                                    └───────────────────────────┘
```

- **backend/** — NestJS 11 API. PostgreSQL via Prisma, optional Redis for
  caching and BullMQ job queues. Deploys to Render as a Docker image (see
  `docs/deployment/README.md`).
- **apps/web/** — Next.js 15 / React / TypeScript. The authenticated product
  surface (CRM, AI, billing, marketplace, security, compliance, developer
  portal). Deploys to Vercel, calls the backend over `NEXT_PUBLIC_API_BASE_URL`.
- **apps/marketing/** — Next.js marketing site (usevoltx.com). No auth, mostly
  static, a contact form that sends mail via Resend. Deploys to Vercel as its
  own project, independent of apps/web.
- **apps/mobile/** — Flutter app (Riverpod + go_router + Dio) for iOS and
  Android, feature-mirrors most of apps/web against the same backend API.

Every backend response is wrapped in a `{ success, data, meta: { requestId,
timestamp, version } }` envelope (`backend/src/common/dto/api-response.dto.ts`);
both the web `ApiClient` and the mobile `ApiClient` unwrap it the same way, so
a client-side type only ever has to model `data`.

## Request pipeline

Every request (`backend/src/bootstrap/configure-app.ts`) passes through, in
order: a request-ID stamp, `TenantMiddleware` (below), Helmet (CSP
deliberately off — this is a JSON API plus a Swagger UI, not an
HTML-rendering surface), a closed-by-default CORS allowlist
(`CORS_ALLOWED_ORIGINS`, empty = no browser origin trusted with credentials;
native mobile clients don't send an `Origin` header so they're unaffected
either way), compression, raw-body capture (needed for webhook HMAC
verification — a re-serialized JSON body would break signature checks), the
global `api` prefix with URI versioning (`/api/v1/...`; `/metrics`,
`/readiness`, `/liveness` are excluded from the prefix for
infra/scraper convenience), a global `ValidationPipe` (whitelist +
forbid-unknown + implicit type conversion), a global exception filter, and
logging/response/timeout interceptors.

Interactive API docs (Swagger UI, every DTO and every auth scheme — bearer
JWT, API key, PAT, service account, OAuth2) are served at `/api`; the raw
OpenAPI 3.1 spec is at `/api-json`. That's the source of truth for endpoint
shapes — this doc stays one level up, at the "how the pieces fit together"
level.

## Multi-tenancy

This is the central architectural concern, enforced at two independent
layers so a bug in one doesn't mean cross-tenant data exposure:

1. **`TenantMiddleware`** (`backend/src/common/tenant/tenant.middleware.ts`)
   runs on every request. It opportunistically decodes the JWT access token
   — without enforcing auth, that's the guards' job — and seeds an
   `AsyncLocalStorage`-backed `TenantContextService` with
   `{ requestId, userId, organizationId, supportSessionId }` before any
   guard or handler runs. A missing/invalid token just means the context
   has no `userId`/`organizationId`; unauthenticated routes still get a
   `requestId`.
2. **`createTenantPrismaExtension`** (`backend/src/database/tenant-prisma.extension.ts`)
   is a Prisma Client Extension that intercepts `organization`/`user`/
   `membership` queries and auto-injects an `organizationId` scope pulled
   from the current tenant context — this happens at the ORM layer itself,
   so it protects even a handler that forgot to add its own `where` clause.
   It's a no-op when there's no tenant context (e.g. the platform-admin
   cross-org endpoints, which use `PLATFORM_ADMIN_GUARDS` instead — see
   below).

Protected routes compose three guards via the `AUTH_GUARDS` constant
(`backend/src/common/guards/protected.guards.ts`):
`JwtAuthGuard` (validates the bearer token) → `UserContextGuard` (resolves
membership + RBAC permissions onto the request) → `TenantGuard` (enforces
that the JWT's org claim is the one being acted on). New controllers should
apply `AUTH_GUARDS` rather than hand-assembling guards. The one deliberate
exception is `PLATFORM_ADMIN_GUARDS` (`JwtAuthGuard` + `PlatformAdminGuard`,
no `TenantGuard`) — used only by the small set of cross-organization Super
Admin Billing Console routes, where "see every organization" is the point.

## RBAC

`Role` / `Permission` / `RolePermission` / `Membership` (see
`backend/prisma/schema.prisma` and `docs/architecture/data-model.md`)
implement per-organization role-based permissions. Permission keys follow a
`resource.action` convention (e.g. `sales.opportunity.create`,
`ai.agent.run`, `billing.subscription.manage`) — `backend/prisma/seed.ts` is
the full catalog and the pattern to follow when adding a new one.
`PermissionGuard` (`backend/src/modules/permissions/guards/permission.guard.ts`)
only enforces on routes that opt in via an `@Permissions(...)` decorator —
absence of that decorator means "no fine-grained check beyond `AUTH_GUARDS`",
not "unprotected."

## AI runtime

`backend/src/modules/ai/` is the largest subsystem — a provider-agnostic
agent runtime, not a thin wrapper around one vendor's SDK:

- **`providers/`** — pluggable `AIProvider` implementations (Anthropic,
  OpenAI, Google) behind one `chat`/`stream`/`embeddings`/`models`
  interface; `models/model-registry.service.ts` picks a provider per model.
- **`runtime/`** — `ai-runtime.service.ts` orchestrates provider calls and
  tool execution behind a single streaming interface (`AIStreamEvent`).
- **`agents/`** — `Agent`/`AgentRun` entities; `AgentExecutor` drives one
  turn of a run: loads conversation history, executes any requested tools
  (validated against the agent's `allowedToolNames`), streams the model
  response, persists the assistant message, hands off to memory capture.
  `approvals/`, `autonomous/`, `dashboard/`, and `jobs/` subfolders extend
  this for human-in-the-loop approval gates, unattended runs, and
  operational visibility respectively.
- **`memory/`** — long-term conversation memory with scoring/selection
  (`memory.scorer.ts`, `memory.selector.ts`) to decide what's relevant to
  inject into a future prompt, rather than replaying full history forever.
- **`tools/`** — a registry/executor pattern for function-calling; new tools
  implement `ToolInterface` and register in `tool.registry.ts`. An outbound
  HTTP tool exists behind its own host allowlist (`AI_HTTP_TOOL_ALLOWED_HOSTS`).
- **`conversations/`** — conversation + message persistence, independent of
  any specific agent (a human can just chat, no agent required).

## Domain modules

- **`sales/`** — the CRM ("Sales Copilot"): `SalesCompany`/`SalesContact`/
  `SalesLead`/`SalesOpportunity`/`SalesActivity`, plus AI-augmented actions
  (lead qualification, email drafting, opportunity insights/next-best-action,
  meeting summarization) that call through the AI runtime above. This is the
  reference pattern for wiring a new domain module into AI/tenant.
- **`billing/`** — Voltx's own SaaS subscriptions: plans, checkout,
  Stripe Customer Portal, upgrade/downgrade with proration, trials
  (`billing-cron.service.ts` sweeps expired trials hourly), usage-based
  metering, invoices. A Stripe webhook handler verifies signatures against
  the raw body and processes events idempotently via a BullMQ queue.
- **`marketplace/`** — third-party apps: browse/install/publish/review,
  plus its own Stripe Connect integration (destination charges — revenue
  share and developer payout happen automatically on checkout, not via a
  manual transfer step) and an Extension Framework for what an installed
  app can add to the product (pages, widgets, AI tools).
- **`compliance/`** — GDPR export/erasure (respecting active legal holds),
  retention policy management, consent records, and an audit-export/verify
  API backing the Compliance Center UI (see `data-model.md` for the audit
  hash chain).
- **`identity/`** — enterprise SSO: SAML and OIDC, with per-provider preset
  configs (Okta, Entra, Google Workspace, OneLogin, Ping) and JIT
  provisioning. This is "bring your own IdP" for an org, distinct from any
  future "Sign in with Google" consumer button, which does not exist yet.
- **`oauth-provider/`** — the inverse of `identity/`: Voltx acting as an
  OAuth 2.0 **authorization server** for third-party apps/integrations that
  want to call the Voltx API on a user's behalf. Don't confuse this with
  `integrations/`'s `GOOGLE_OAUTH_CLIENT_ID`-style vars, which are Voltx
  acting as an OAuth *client* connecting outbound to Gmail/Outlook/GitHub.
- **`webhooks/`** — outbound webhook delivery (retries with backoff,
  signing) for organizations that want to be notified of Voltx-side events.

## Client conventions

Both `apps/web/src/lib/api/client.ts` and the mobile
`lib/core/network/api_client.dart` follow the same shape: wrap the HTTP
client, unwrap the `{ success, data, meta }` envelope into typed models, and
convert transport failures into one typed error (`ApiError` / `NetworkException`)
rather than letting raw HTTP exceptions leak into UI code. Follow this
pattern for new endpoints instead of calling `fetch`/`Dio` directly from a
screen.
