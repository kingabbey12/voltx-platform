# Voltx

Voltx is an AI-native business operating system: CRM, AI agents, workflow
automation, a third-party app marketplace, and enterprise security/compliance
tooling, in one multi-tenant platform.

This is a monorepo of four independently-deployed apps — there is no
root-level build tool; each is developed and run from its own directory.

| App | Stack | Deploys to |
|---|---|---|
| `backend/` | NestJS 11, Prisma/PostgreSQL, Redis, BullMQ | Render (`api.usevoltx.com`) |
| `apps/web/` | Next.js, React, TypeScript | Vercel (`app.usevoltx.com`) |
| `apps/marketing/` | Next.js | Vercel (`usevoltx.com`) |
| `apps/mobile/` | Flutter (iOS + Android) | App Store / Play Store |

Also in this repo: `packages/` (published TypeScript/Python/Flutter SDKs and
the Voltx CLI) and `free/`.

## Learn more

- **Engineering standards, commands, and how these apps fit together day to
  day**: `CLAUDE.md` — read this before making changes.
- **System architecture, multi-tenancy, RBAC, the AI runtime**:
  `docs/architecture/overview.md`
- **Data model / how to navigate the Prisma schema**:
  `docs/architecture/data-model.md`
- **Deployment (Render/Vercel/Neon, CI, env vars)**: `docs/deployment/README.md`
- **Using the product**: `docs/guides/admin-guide.md`, `docs/guides/user-guide.md`
- Per-app docs: `backend/README.md`, `apps/web/README.md`, `apps/mobile/README.md`

## Quickstart (backend + web, local)

```bash
# Backend
cd backend
pnpm install
docker-compose up -d          # local Postgres on :5433
pnpm prisma:migrate
pnpm prisma:seed
pnpm start:dev                 # http://localhost:3000/api/v1

# Web (in a second terminal)
cd apps/web
pnpm install
cp .env.example .env.local     # set NEXT_PUBLIC_API_BASE_URL
pnpm dev -- -p 3001            # next dev defaults to :3000, same as the
                                # backend — pass -p 3001 (or similar) to run
                                # both side by side. Backend's local
                                # CORS_ALLOWED_ORIGINS is already set to
                                # http://localhost:3001 for this reason.
```

Full command reference (lint/test/build for every app, mobile setup, etc.)
is in `CLAUDE.md`.
