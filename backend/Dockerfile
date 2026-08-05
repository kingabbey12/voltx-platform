# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
# pnpm-workspace.yaml carries the dependency `overrides`. Without it in the
# build context pnpm sees no overrides while the lockfile has them, and
# --frozen-lockfile aborts with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

FROM base AS production
ENV NODE_ENV=production
# pnpm-workspace.yaml carries the dependency `overrides`. Without it in the
# build context pnpm sees no overrides while the lockfile has them, and
# --frozen-lockfile aborts with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm's default node_modules layout is symlinked into a content-addressable
# .pnpm store, not the flat/hoisted layout a plain `COPY node_modules/.prisma`
# from the build stage can rely on — so instead of a fresh `--prod` install
# here (which would re-trigger the root "postinstall": "prisma generate"),
# copy the build stage's already-fully-resolved node_modules — which has the
# Prisma client generated in the correct location — and prune it down to
# production-only dependencies in place.
#
# `prisma` (the CLI) is deliberately a runtime dependency, not a devDependency,
# so it SURVIVES this prune. Migrations are applied by running
# `prisma migrate deploy` inside this image before the app starts. When the CLI
# was a devDependency the prune removed it, and the only thing that ever
# applied migrations was the separate `migrate` compose service — which does
# not exist on a PaaS. The result was a container that booted against an empty
# database and threw Prisma P2021 (table does not exist).
COPY --from=build /app/node_modules ./node_modules
RUN pnpm prune --prod --ignore-scripts
COPY prisma ./prisma
COPY --from=build /app/dist ./dist

# Fail the build rather than ship an image that cannot migrate itself.
RUN node_modules/.bin/prisma --version > /dev/null \
    || (echo "ERROR: prisma CLI missing from the production image — 'prisma migrate deploy' cannot run. Keep 'prisma' in dependencies, not devDependencies." >&2 && exit 1)

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/readiness').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
# Render's pre-deploy command and the Compose migrate service remain the
# preferred run-once migration paths. This final image-level guard covers
# manually-created PaaS services and direct `docker run` deployments that do
# not load either deployment manifest. `migrate deploy` is idempotent and uses
# Prisma's database advisory lock, so an already-migrated database exits
# quickly before the API starts.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
