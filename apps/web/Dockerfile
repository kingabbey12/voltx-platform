# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
# pnpm-workspace.yaml carries the dependency `overrides`. Without it in the
# build context pnpm sees no overrides while the lockfile has them, and
# --frozen-lockfile aborts with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
# NEXT_PUBLIC_* values are inlined into the client bundle by `next build`, so
# they are BUILD inputs, not runtime configuration. Setting them in compose's
# `environment:` has no effect on the emitted bundle.
#
# Two consequences an operator must know:
#   1. The image is environment-specific. A staging image cannot be promoted
#      to production — production must be rebuilt with production values.
#   2. There is no default. The build fails loudly on a missing API URL rather
#      than emitting a bundle that calls the wrong host.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Fail here, with a usable message, rather than producing an image whose
# bundle points somewhere useless. Before .env* was excluded from the build
# context this silently picked up a developer's .env.local and compiled
# http://localhost:3000/api/v1 into the production image.
RUN if [ -z "$NEXT_PUBLIC_API_BASE_URL" ]; then \
      echo "ERROR: NEXT_PUBLIC_API_BASE_URL build arg is required." >&2; \
      echo "  It is compiled into the client bundle, so it must be supplied at BUILD time:" >&2; \
      echo "  docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1 ." >&2; \
      exit 1; \
    fi
RUN pnpm build

FROM base AS production
ENV NODE_ENV=production
# The standalone server binds 127.0.0.1 by default, which is unreachable from
# outside the container.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

EXPOSE 3000

# node rather than wget: BusyBox wget follows redirects and has no flag to stop
# it, so /health falling out of the middleware's PUBLIC_PATHS would redirect to
# /login, return 200, and report a broken app as healthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health',{redirect:'manual'}).then((r)=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"

USER node
CMD ["node", "server.js"]
