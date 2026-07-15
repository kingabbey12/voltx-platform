# Voltx web app

Next.js / React / TypeScript — the authenticated product surface (CRM, AI,
billing, marketplace, security, compliance, developer portal) at
`app.usevoltx.com`. See `docs/architecture/overview.md` (repo root) for how
this fits into the rest of the platform.

## Local development

```bash
pnpm install
cp .env.example .env.local      # set NEXT_PUBLIC_API_BASE_URL, e.g.
                                 # http://localhost:3000/api/v1 against a
                                 # locally-running backend/
pnpm dev -- -p 3001             # next dev defaults to :3000, the same port
                                 # backend/ uses — pass -p 3001 (or similar)
                                 # to run both side by side locally.
                                 # backend/.env's local CORS_ALLOWED_ORIGINS
                                 # is already set to http://localhost:3001
                                 # for exactly this reason.
```

`NEXT_PUBLIC_API_BASE_URL` must be the bare API root + version prefix (e.g.
`https://api.usevoltx.com/api/v1`), never a specific endpoint path —
`src/config/env.ts` validates this at build/read time and fails loudly with
a clear message if it looks wrong, since `NEXT_PUBLIC_*` values are inlined
into the client bundle and a bad value can't be caught by working source
code once built.

## Commands

```bash
pnpm dev                        # next dev
pnpm lint                       # eslint .
pnpm build                      # next build (also type-checks)
```

There is no configured unit test runner for this app yet.

## Deployment

Deploys to Vercel as its own project, Root Directory set to `apps/web`
(config in `apps/web/vercel.json`, scoped inside this directory on
purpose — see `docs/deployment/README.md` for why). CI
(`.github/workflows/ci.yml`'s `web` job) runs lint + a real production
build on every push/PR so a broken build is caught before Vercel ever sees
it.
