# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
# pnpm's default node_modules layout is symlinked into a content-addressable
# .pnpm store, not the flat/hoisted layout a plain `COPY node_modules/.prisma`
# from the build stage can rely on — so instead of a fresh `--prod` install
# here (which would also re-trigger the root "postinstall": "prisma generate"
# script and fail with "sh: prisma: not found", since the prisma CLI is a
# devDependency intentionally absent from a prod-only install), copy the
# build stage's already-fully-resolved node_modules — which has the Prisma
# client already generated in the correct location — and prune it down to
# production-only dependencies in place.
COPY --from=build /app/node_modules ./node_modules
RUN pnpm prune --prod --ignore-scripts
COPY prisma ./prisma
COPY --from=build /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
CMD ["node", "dist/main.js"]
