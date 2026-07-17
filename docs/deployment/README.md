# Deployment

Current target stack: **Render** (backend), **Vercel** (apps/web and
apps/marketing, as two separate Vercel projects), **Neon** (Postgres).

> `docs/release/production-checklist.md` and `docs/release/beta-deployment-checklist.md`
> predate this decision — both were written when "no hosting target has been
> chosen yet" was still true, and beta-deployment-checklist.md's §1/§4 still
> say so. Their security/infra/mobile checklists are still useful as a
> pre-launch sanity pass; their *hosting* sections are superseded by this
> document. `docs/release/known-issues.md`, `operational-runbook.md`, and
> `rollback-checklist.md` are unaffected by the hosting decision and remain
> current.

## Backend — Render

Source of truth: `render.yaml` (repo root, a Render Blueprint) and
`.github/workflows/deploy.yml`.

**Deploy flow** (`deploy.yml`, runs after `ci.yml` completes successfully on
`main` — via `workflow_run`, so a commit whose CI failed never deploys — or
manually via `workflow_dispatch`):

1. **Build & push** — builds `backend/Dockerfile`'s `production` target,
   pushes to `ghcr.io/<owner>/<repo>/backend:<sha>` and `:latest`.
2. **Migrate** — from a full checkout (not the pruned production image,
   which deliberately has no Prisma CLI — see the Dockerfile's comments),
   runs `pnpm prisma:migrate:deploy` against `DATABASE_URL`, then
   `pnpm prisma:seed` to sync the permission/role catalog (idempotent —
   safe to re-run; a permission added to the catalog after the last deploy
   would otherwise silently 403 every request needing it until someone
   re-seeds by hand).
3. **Deploy to Render** — only after step 2 succeeds. PATCHes the Render
   service to point at the freshly-built image, then triggers a deploy via
   Render's API. If `RENDER_API_KEY`/`RENDER_SERVICE_ID` aren't set as
   GitHub secrets yet, this step logs exactly what's missing and exits
   cleanly instead of failing the whole workflow — the image is still
   built, pushed, and migrated either way.

This is deliberately **not** Render's own build-from-Dockerfile or
auto-deploy-on-push (`render.yaml` sets `autoDeploy: false`): the production
image has no Prisma CLI, so a Render "Pre-Deploy Command" can't run
migrations from inside it, and auto-deploying on every push risks the app
going live before its own migration has run. CI-triggered deploy,
migration-then-deploy ordering, is the whole point of the two-job split
above.

**`DATABASE_URL` vs `DIRECT_URL`**: Neon's pooled endpoint (PgBouncer,
transaction mode) is what `DATABASE_URL` should be at runtime, but it
doesn't support the prepared statements/advisory locks Prisma's migration
engine needs. `DIRECT_URL` is Neon's separate unpooled connection string,
read only by `prisma migrate deploy`/`dev` (see the `datasource` block in
`backend/prisma/schema.prisma`) — never by the running app. Every
environment that ever runs a migration needs both set; for a non-pooled
database (local dev, CI) they're just the same value.

**Owner setup checklist** (also documented, in more detail, in
`render.yaml`'s header comment):

1. Render dashboard → New → Blueprint → connect this repo (reads `render.yaml`).
2. If the GHCR package is private, add `ghcr.io` registry credentials on the service.
3. Fill in the `sync: false` env vars in the Render dashboard (see `backend/.env.example`).
   Two of these are **hard production-boot requirements**, not optional — the API
   exits at startup without them (verified by booting the production build):
   - `REDIS_URL` — a managed Redis, e.g. Upstash's `rediss://` URL
     (`REDIS_ENABLED=true` is already set in render.yaml; the boot check in
     `src/bootstrap/redis-requirement.check.ts` refuses production without it).
   - `ATTACHMENTS_S3_*` — bucket/region/keys for attachment storage
     (`storage.module.ts` refuses local-disk storage in production).
4. Add `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) from the Neon dashboard.
5. Add `DATABASE_URL`, `DIRECT_URL`, `RENDER_API_KEY`, `RENDER_SERVICE_ID` as
   GitHub Actions secrets on this repo's `staging`/`production` environments.
6. Point `api.usevoltx.com`'s DNS at the Render service (Render gives you
   the exact record under service → Settings → Custom Domains).
7. Verify `CORS_ALLOWED_ORIGINS` includes `https://app.usevoltx.com` in
   Render's env vars — CORS is closed by default and entirely env-driven
   (no hardcoded origin anywhere in code), so this is the one setting that
   can't be verified from the repo and will silently block the web app if
   it's wrong.

## apps/web and apps/marketing — Vercel

Two separate Vercel projects, each with its own `vercel.json` scoped
**inside its own app directory** (`apps/web/vercel.json`,
`apps/marketing/vercel.json`) rather than relying solely on the root
`vercel.json`. This matters because Vercel reads `vercel.json` relative to
a project's configured **Root Directory**, not the repo root, once Root
Directory is set to a subdirectory — which it must be here, since the repo
root has no `package.json` or build script of its own. A `vercel.json` that
only exists at the repo root is silently ignored by any Vercel project
whose Root Directory points at `apps/web` or `apps/marketing`; per-app
config is a hedge against that regardless of how the dashboard is
configured. The root `vercel.json` is left in place as a harmless fallback
for the (unlikely, given the point above) case a project's Root Directory
is ever unset.

- `apps/web/vercel.json` — pnpm (matches `apps/web/pnpm-lock.yaml`):
  `pnpm install --frozen-lockfile` / `pnpm build`.
- `apps/marketing/vercel.json` — npm (matches `apps/marketing/package-lock.json`,
  it has no pnpm lockfile): `npm ci` / `npm run build`.

Required env var for apps/web at build time: `NEXT_PUBLIC_API_BASE_URL`
(the bare API root + version prefix, e.g. `https://api.usevoltx.com/api/v1`
— no trailing route segment; `apps/web/src/config/env.ts` validates this
and fails the build loudly if it looks like a specific endpoint path
instead, since `NEXT_PUBLIC_*` values are inlined into the client bundle
and a bad value here can't be caught by working source code). See
`apps/web/.env.example` and `apps/marketing/.env.example` for the full list
per app — that's the source of truth, not a re-listing here.

## Domains

| Domain | Points at |
|---|---|
| `usevoltx.com` | apps/marketing (Vercel) |
| `app.usevoltx.com` | apps/web (Vercel) |
| `api.usevoltx.com` | backend (Render) |

Configure each in its respective platform's dashboard (Vercel → project →
Domains; Render → service → Custom Domains) and point DNS at whatever
target each gives you.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every PR, eight
independent jobs:

- **backend** — `pnpm lint` → `pnpm test` (unit) → materializes a gitignored
  `.env.test` → `pnpm prisma:migrate:deploy` against a `pgvector/pgvector:pg16`
  service container → `pnpm test:e2e` → `pnpm build`.
- **web** — `pnpm lint` → `pnpm build` (with a dummy but validation-passing
  `NEXT_PUBLIC_API_BASE_URL`, since CI never actually calls the API).
- **marketing** — `npm run lint` → `npm run build`.
- **mobile** — `flutter analyze` → `flutter test` → `flutter build macos --release
  -t lib/main_production.dart` (the production flavor entrypoint, not the
  default `lib/main.dart` — that one resolves its API URL via `--dart-define`
  at runtime and falls back to `localhost`, so building it wouldn't validate
  what a real release actually ships).
- **sdk-typescript** — `npm run lint` (typecheck) → `npm run build` → `npm test`.
- **cli** — builds `packages/sdk-typescript` first (its local `@voltx/sdk`
  dependency), then the same lint/build/test sequence.
- **sdk-python** — `pip install -e ".[dev]"` → `pytest`.
- **sdk-flutter** — `flutter analyze` → `flutter test`.

Before web/marketing CI jobs existed, a broken `apps/web` or
`apps/marketing` build was only ever caught when Vercel's own deploy
failed — these two jobs close that gap. The four `packages/*` jobs close a
similar gap: those packages had real tests but nothing ran them in CI.

## Environment variables

Each app's `.env.example` is the source of truth, kept in sync with what
the code actually reads (`backend/src/config/env.validation.ts` for the
backend):

- `backend/.env.example`
- `apps/web/.env.example`
- `apps/marketing/.env.example`

Don't duplicate that list here — if you add a new required env var, update
the relevant `.env.example`, not this doc.
