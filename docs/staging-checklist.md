# Staging Deployment Checklist

## Pre-Deployment

### Infrastructure
- [ ] Server provisioned (4 vCPU, 8 GB RAM minimum)
- [ ] Docker and Docker Compose installed
- [ ] DNS records configured:
  - `staging.voltx.ai` → server IP (A record)
  - `api-staging.voltx.ai` → server IP (A record)
- [ ] SSL certificates obtained (Let's Encrypt or commercial CA)
- [ ] Firewall rules configured (ports 80, 443 open; 22 restricted)
- [ ] PostgreSQL 16 with pgvector extension available
- [ ] Redis 7 available with password auth
- [ ] SMTP credentials ready for transactional emails

### Environment
- [ ] `.env` file created from `deploy/.env.staging`
- [ ] `JWT_ACCESS_SECRET` generated (`openssl rand -base64 48`)
- [ ] `JWT_REFRESH_SECRET` generated (`openssl rand -base64 48`)
- [ ] `POSTGRES_PASSWORD` generated (`openssl rand -base64 12`)
- [ ] `REDIS_PASSWORD` generated (`openssl rand -hex 16`)
- [ ] `INTEGRATIONS_ENCRYPTION_KEY` generated (`openssl rand -base64 32`)
- [ ] `CORS_ALLOWED_ORIGINS` set to web app URLs
- [ ] `INVITATIONS_ACCEPT_BASE_URL` set to staging web URL
- [ ] `NODE_ENV=staging`

### AI Providers
- [ ] OpenAI API key configured (required for default AI operations)
- [ ] Anthropic API key configured (optional)
- [ ] Google AI API key configured (optional)
- [ ] Embedding model API key configured (can reuse OpenAI)

### Monitoring
- [ ] Sentry DSN configured (optional but recommended)
- [ ] OpenTelemetry collector endpoint configured (optional)
- [ ] Prometheus data directory created and writable
- [ ] Grafana admin password configured

## Deployment Steps

### Phase 1: Database
- [ ] Run PostgreSQL container
- [ ] Verify pgvector extension loaded: `SELECT * FROM pg_extension WHERE extname = 'vector'`
- [ ] Run Redis container
- [ ] Verify Redis connectivity: `redis-cli -a <password> ping`

### Phase 2: Schema
- [ ] Build migration image: `docker compose build migrate`
- [ ] Run `docker compose run --rm migrate`
- [ ] Verify all migrations applied: `pnpm prisma migrate status`
- [ ] Verify seed data loaded (permissions, roles, billing plans)

### Phase 3: API
- [ ] Build API image
- [ ] Start API server
- [ ] Verify health endpoint: `GET /api/v1/health`
- [ ] Verify database connectivity in health response
- [ ] Verify Redis connectivity in health response
- [ ] Test authentication flow (login with test credentials)

### Phase 4: Web
- [ ] Build web image
- [ ] Start web server
- [ ] Verify web app loads: `GET /` returns 200
- [ ] Verify API proxy works (web → api)
- [ ] Verify static assets served with correct cache headers

### Phase 5: Reverse Proxy
- [ ] Configure nginx with SSL certificates
- [ ] Start nginx
- [ ] Verify HTTPS redirect works (HTTP → HTTPS)
- [ ] Verify HSTS header present
- [ ] Verify CSP header present
- [ ] Verify API proxying through nginx
- [ ] Verify WebSocket proxying (if applicable)

### Phase 6: Monitoring
- [ ] Start Prometheus
- [ ] Verify Prometheus targets are up
- [ ] Start Grafana
- [ ] Import API overview dashboard
- [ ] Import enterprise security dashboard
- [ ] Configure alert rules

## Post-Deployment Verification

### Smoke Tests
- [ ] Visit web app at `https://staging.voltx.ai`
- [ ] Register new account
- [ ] Verify email verification flow
- [ ] Log in with registered account
- [ ] Create organization
- [ ] Open AI Chat and send a message
- [ ] Verify AI response received
- [ ] Navigate to Knowledge base
- [ ] Add a knowledge source
- [ ] Search knowledge base
- [ ] Navigate to Agents
- [ ] Create or view an agent
- [ ] Navigate to Workflows
- [ ] View workflow templates
- [ ] Navigate to AI Operator
- [ ] Check operator interface loads
- [ ] Navigate to Settings
- [ ] Update profile settings
- [ ] Navigate to Monitoring dashboard
- [ ] Check all monitoring sub-pages load (logs, costs, usage, health, incidents)

### Integration Checks
- [ ] API returns wrapped responses `{ success, data, meta }`
- [ ] Error responses include proper HTTP status codes
- [ ] Rate limiting functioning (429 after exceeding limit)
- [ ] CORS working for configured origins
- [ ] Database connection pooling functioning
- [ ] Background job queues processing (BullMQ)

### Backup Verification
- [ ] Run manual backup: `./scripts/backup-db.sh`
- [ ] Verify backup file created and non-empty
- [ ] Verify backup retention (14 days)

## Rollback Preparation
- [ ] Previous API image tagged and available
- [ ] Database backup taken before deploy
- [ ] Rollback plan reviewed by team
- [ ] Rollback triggers defined (what constitutes a "failed" deploy)
