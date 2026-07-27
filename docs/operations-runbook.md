# Operations Runbook

## Daily Operations

### Morning checklist
- [ ] Check monitoring dashboard for error spikes
- [ ] Review rate limit metrics (DDoS/abuse patterns)
- [ ] Check database connections and slow queries
- [ ] Review queue depths (BullMQ dashboards)
- [ ] Verify backup completion (check backup logs)

### Weekly
- [ ] Review error logs for new patterns
- [ ] Check disk usage on database server
- [ ] Review API latency trends
- [ ] Audit failed login attempts
- [ ] Review SSL certificate expiry dates

### Monthly
- [ ] Run `VACUUM ANALYZE` on database
- [ ] Review and rotate API keys if needed
- [ ] Audit user permissions and roles
- [ ] Review dependency vulnerabilities (dependabot)
- [ ] Performance review and capacity planning

## Incident Response

### Severity Levels

| Level | Definition | Response Time |
|-------|-----------|---------------|
| P0 | Complete outage | < 15 min |
| P1 | Major feature broken | < 1 hour |
| P2 | Minor feature degraded | < 4 hours |
| P3 | Cosmetic / non-critical | Next business day |

### Response Procedure

1. **Detect**: Alert via monitoring (Sentry, Grafana) or user report
2. **Acknowledge**: Mark incident in tracking system
3. **Assess**: Determine severity and affected users
4. **Mitigate**: Apply hotfix, rollback, or feature flag
5. **Resolve**: Fix root cause
6. **Review**: Post-mortem within 48 hours

### Rollback Procedure

```bash
# Rollback the API tier. deploy/docker-compose.yml is the deployed stack for
# both staging and production — backend/docker-compose.prod.yml is an API-only
# subset and is not what runs in production.
docker compose -f deploy/docker-compose.yml down api
docker compose -f deploy/docker-compose.yml pull api
docker compose -f deploy/docker-compose.yml up -d api

# Or using the deploy workflow
gh workflow run deploy.yml -f action=rollback -f environment=production
```

Full procedures, including database rollback, are in [rollback-plan.md](rollback-plan.md).

## Database Maintenance

### VACUUM ANALYZE
```sql
-- Analyze all tables
VACUUM ANALYZE;

-- Analyze specific table
VACUUM ANALYZE sales_opportunity;
```

### Index monitoring
```sql
-- Find unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- Check index size
SELECT pg_size_pretty(pg_total_relation_size('index_name'));
```

## Certificate Rotation

```bash
# Using Certbot
certbot renew --dry-run  # Test renewal
certbot renew            # Actual renewal

# Check expiry
openssl x509 -in /path/to/cert.pem -noout -dates
```

## Secret Rotation

### JWT secrets
1. Generate new secrets: `openssl rand -hex 32`
2. Update `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
3. Rolling restart of API servers
4. Old tokens remain valid until expiry

### Encryption key rotation
1. Run `pnpm reencrypt-secrets` (located in backend/scripts/)
2. Update `ENCRYPTION_KEY` environment variable
3. Verify all secrets are decryptable

## Log Management

### Access logs (pino-pretty)
```bash
# Tail production logs
docker compose logs -f api

# Search for errors
docker compose logs api | grep "ERROR"

# Export logs (last 1 hour)
docker compose logs --since=1h api > logs/api-$(date +%Y%m%d-%H%M).log
```

## Performance Troubleshooting

### High CPU/Latency

1. Check slow queries:
```sql
SELECT query, calls, total_exec_time / calls AS avg_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

2. Check queue depth in Grafana dashboard
3. Check Node.js event loop lag: `GET /metrics`
4. Scale horizontally if sustained load

### Memory Issues

1. Check Redis memory: `redis-cli INFO memory`
2. Check Node.js heap: `node -e "console.log(process.memoryUsage())"`
3. Review BullMQ job concurrency settings

## Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Check request format and validation rules |
| 401 | Unauthorized | Refresh token or re-authenticate |
| 403 | Forbidden | User lacks required permission |
| 404 | Not Found | Verify resource ID and URL path |
| 409 | Conflict | Resource already exists or version mismatch |
| 422 | Validation Error | Check request body against schema |
| 429 | Rate Limited | Implement backoff and retry |
| 500 | Internal Error | Check Sentry for error details |
| 502 | Bad Gateway | Upstream service unavailable |
| 503 | Service Unavailable | Server overloaded or under maintenance |
