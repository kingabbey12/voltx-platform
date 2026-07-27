# Rollback Plan

## When to Rollback

Trigger rollback if any of the following occur within 30 minutes of deployment:

| Condition | Action |
|-----------|--------|
| API health check fails > 50% of requests | Immediate rollback |
| 5xx error rate > 5% of all requests | Immediate rollback |
| Database migration errors | Immediate rollback |
| AI provider responses fail > 20% of requests | Rollback within 15 min |
| User reports authentication failures | Immediate rollback |
| P1/P0 incident opened related to deployment | Immediate rollback |

## Rollback Procedures

### Option A: Docker Compose Rollback (Recommended)

```bash
# 1. Restore database from backup taken before deploy
gunzip -c backups/voltx_dump_$(date -d '1 day ago' +%Y%m%d).sql.gz | \
  docker compose -f deploy/docker-compose.yml exec -T postgres \
  psql -U voltx -d voltx

# 2. Rollback API image to the previous release
#    deploy.sh tags the outgoing image :previous before every build, so this
#    target exists after any deploy but the very first.
docker compose -f deploy/docker-compose.yml --env-file deploy/.env stop api
docker tag voltx-api:previous voltx-api:latest
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --force-recreate api

# 3. Rollback Web image to the previous release
docker compose -f deploy/docker-compose.yml --env-file deploy/.env stop web
docker tag voltx-web:previous voltx-web:latest
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --force-recreate web

# To roll back to a *specific* release rather than simply the one before,
# deploy.sh also tags each build with the version it was given:
#   docker tag voltx-api:v2.4.0-rc.1 voltx-api:latest

# VERIFIED 2026-07-26 by drill: a deliberately broken image was deployed
# (API crash-looping, /readiness unreachable), then rolled back by the above.
# Service restored in 3 seconds. `--force-recreate` matters — without it
# compose sees no config change and leaves the broken container running.

# 4. Verify health
bash deploy/health-check.sh
```

### Option B: GitHub Actions Rollback

```bash
# Trigger rollback via the deploy workflow
gh workflow run deploy.yml \
  -f environment=staging \
  -f action=rollback \
  -f image_tag=<previous-valid-sha>
```

### Option C: Full Stack Restart

```bash
# For issues with database or Redis
docker compose -f deploy/docker-compose.yml down
docker compose -f deploy/docker-compose.yml up -d postgres redis
docker compose -f deploy/docker-compose.yml run --rm migrate
docker compose -f deploy/docker-compose.yml up -d api web nginx
```

## Database Rollback

### Schema Rollback

```bash
# If the current migration introduced a breaking change:
# 1. Check migration history
docker compose -f deploy/docker-compose.yml exec -T postgres \
  psql -U voltx -d voltx -c "SELECT * FROM _prisma_migrations ORDER BY started_at DESC;"

# 2. Rollback to previous migration by name
docker compose -f deploy/docker-compose.yml run --rm migrate \
  sh -c "pnpm prisma migrate resolve --rolled-back <migration-name>"
```

### Data Rollback

```bash
# 1. Stop API (prevents writes)
docker compose -f deploy/docker-compose.yml stop api

# 2. Restore from backup
gunzip -c backups/voltx_dump_$(date -d '1 day ago' +%Y%m%d).sql.gz | \
  docker compose -f deploy/docker-compose.yml exec -T postgres \
  psql -U voltx -d voltx

# 3. Restart API
docker compose -f deploy/docker-compose.yml start api
```

## Verification After Rollback

After executing a rollback, verify:

```bash
# 1. Health checks pass
bash deploy/health-check.sh

# 2. Database is responsive
curl -sf http://localhost:3000/api/v1/health | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['data']['dependencies']['database']['status']=='up'"

# 3. Auth works
curl -sf -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test-password"}' | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['success']==True"

# 4. Core services work
curl -sf http://localhost:3001/
```

## Post-Rollback

- [ ] Document the incident in the deployment log
- [ ] Determine root cause before re-deploying
- [ ] Run full test suite locally
- [ ] Verify fix in isolated environment
- [ ] Apply fix, rebuild, and re-deploy
- [ ] Monitor for 30 minutes after re-deploy
