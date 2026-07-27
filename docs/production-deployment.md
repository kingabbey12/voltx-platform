# Production Deployment Guide

## Overview

This guide covers production deployment of the Voltx Platform — a multi-tenant AI business operating system with a NestJS backend, Next.js web app, and Flutter mobile app.

## Architecture

```
                         ┌──────────────┐
                         │   CDN/Edge   │
                         │  (Vercel)    │
                         └──────┬───────┘
                                │
                    ┌───────────┴───────────┐
                    │    Next.js Web App    │
                    │   (apps/web)          │
                    └───────────┬───────────┘
                                │ HTTPS
                    ┌───────────┴───────────┐
                    │   NestJS API Server   │
                    │   (backend/)          │
                    ├───────────┬───────────┤
                    │ PostgreSQL│   Redis   │
                    │ (pgvector)│  (BullMQ) │
                    └───────────┴───────────┘
```

## Prerequisites

- **Node.js** 22+
- **pnpm** 10.34+
- **Docker** & Docker Compose (for containerized deployment)
- **PostgreSQL** 16 with pgvector extension
- **Redis** 7+
- **Domain** with DNS configured
- **SSL certificate** (Let's Encrypt or similar)

## Environment Variables

See [ENVIRONMENT.md](../ENVIRONMENT.md) for the complete reference.

### Required variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/voltx

# Redis
REDIS_URL=redis://host:6379
REDIS_ENABLED=true

# Auth
JWT_ACCESS_SECRET=<min 32-char random string>
JWT_REFRESH_SECRET=<min 32-char random string>

# Security
CORS_ALLOWED_ORIGINS=https://app.example.com
ENCRYPTION_KEY=<32-byte hex key>

# Optional
SENTRY_DSN=https://key@sentry.io/project
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

## Deployment

### The supported path

```bash
DEPLOY_ENV=production ./deploy/deploy.sh
```

One script, one compose file (`deploy/docker-compose.yml`), for both staging and production — the only difference is `DEPLOY_ENV`, which selects the public hostnames. It brings up the complete stack:

| Tier | Services |
| --- | --- |
| Application | `api`, `web`, `nginx` (TLS termination) |
| Data | `postgres`, `redis`, `migrate` |
| Monitoring | `prometheus`, `alertmanager`, `grafana`, `postgres-exporter`, `redis-exporter`, `node-exporter`, `blackbox-exporter` |

It also takes a pre-migration backup, waits on `/readiness` before proceeding, and warns if the alert receiver or metrics token is unconfigured.

Before the first production run, complete the two monitoring prerequisites in [monitoring-and-alerting.md](operations/monitoring-and-alerting.md) — without them alerts are delivered nowhere and metrics scrapes return 401.

> **Do not deploy production from `backend/docker-compose.prod.yml`.** It runs the API tier only: no web app, no nginx (so no TLS), and no monitoring at all. It exists for running the backend in isolation. Its header says the same thing.

### Verifying a deployment

```bash
curl -f https://api.voltx.ai/readiness    # 503 until DB + Redis are reachable
./deploy/health-check.sh
```

Then confirm every Prometheus target is `UP` at `:9090/targets`. A `DOWN` target means that dimension is unmonitored.

### Manual deployment (API tier only)

```bash
cd backend
pnpm install --frozen-lockfile
pnpm build
pnpm prisma:migrate:deploy
pnpm prisma:seed
node dist/main.js
```

### Health checks

The backend exposes:
- `GET /api/v1/health` — informational health detail (DB, Redis); always returns 200, so never use it as a probe
- `GET /liveness` — k8s liveness probe (process is up)
- `GET /readiness` — k8s readiness probe; returns 503 when a required dependency is down. All Docker/compose healthchecks and deploy scripts poll this.
- `GET /metrics` — Prometheus metrics

## Web App Deployment

### Using Docker

```bash
# Enable standalone output
NODE_ENV=production pnpm build

# Build Docker image
docker build -t voltx-web:latest -f apps/web/Dockerfile apps/web/

# Run
docker run -p 3001:3000 voltx-web:latest
```

### Manual (Node)

```bash
cd apps/web
pnpm install --frozen-lockfile
pnpm build
pnpm start  # Serves on port 3000
```

### Vercel deployment

Connect the repository to Vercel — the `vercel.json` at the root configures the build.

## Reverse Proxy Configuration

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring & Observability

### OpenTelemetry

The backend is instrumented with OpenTelemetry. Configure via:

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=voltx-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

### Prometheus Metrics

Metrics are exposed at `GET /metrics`. Default port: 9464 (configurable via `METRICS_PORT`).

### Sentry Error Tracking

```bash
SENTRY_DSN=https://key@sentry.io/project
SENTRY_ENVIRONMENT=production
```

### Grafana Dashboards

Pre-built dashboards are in `backend/ops/grafana/`:
- `api-overview.json` — Request rate, error rate, latency, queue depth
- `enterprise-security.json` — SSO, SCIM, MFA metrics

## Backup & Restore

### Database backup

```bash
# Manual backup
pg_dump -h localhost -U voltx -d voltx -F c -f backup-$(date +%Y%m%d).dump

# Using the backup script
./backend/scripts/backup-db.sh
```

### Database restore

```bash
pg_restore -h localhost -U voltx -d voltx -c backup-file.dump
```

## Disaster Recovery

1. **Database failure**: Restore from latest backup, replay WAL if available
2. **Redis failure**: BullMQ jobs in progress will be retried on reconnect
3. **Application crash**: Docker/K8s auto-restart; stateless, safe to scale
4. **Full region outage**: Deploy to secondary region with DB replica

## Scaling

- **Horizontal**: Scale API behind a load balancer (stateless)
- **Database**: Use read replicas for reporting queries
- **Queue workers**: Increase `WORKER_CONCURRENCY` or spawn more instances
- **Caching**: Redis cluster for distributed cache

## Security Checklist

- [ ] All secrets stored in environment variables or vault
- [ ] HTTPS enabled with valid certificate
- [ ] HSTS enabled (max-age ≥ 63072000)
- [ ] CORS configured with specific origins
- [ ] Rate limiting enabled (120 req/60s default)
- [ ] Database accessible only from app subnet
- [ ] Redis requires authentication
- [ ] File upload size limited (default 1MB)
- [ ] Input validation enabled (whitelist mode)
- [ ] Security headers set (X-Content-Type-Options, X-Frame-Options, etc.)
- [ ] CSP configured
- [ ] Audit logging enabled
- [ ] Dependency scanning in CI pipeline

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 500 errors on all requests | Database connection failed | Check DATABASE_URL, ensure Postgres is running |
| 429 Too Many Requests | Rate limit exceeded | Wait 60 seconds or adjust RATE_LIMIT_LIMIT |
| WebSocket disconnects | Reverse proxy misconfigured | Ensure Upgrade/Connection headers are forwarded |
| Migration fails | Schema drift | Run `prisma migrate diff` to diagnose |
| Slow queries | Missing index | Run `EXPLAIN ANALYZE` on slow queries, add indexes |
