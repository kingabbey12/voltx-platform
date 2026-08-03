# Deployment Runbook

## Deploy

```bash
cd deploy
DEPLOY_ENV=staging ./deploy.sh        # or DEPLOY_ENV=production
```

The script runs, in order: security audit → pre-flight checks → **configuration preflight** → pull → start databases → build → pre-migration backup → migrate → API → web → nginx → health checks.

Nothing destructive happens until the configuration preflight passes. To validate configuration alone:

```bash
VOLTX_PREFLIGHT_ONLY=1 DEPLOY_ENV=staging ./deploy.sh
./scripts/preflight-test.sh          # 6 assertions on preflight behaviour
```

## Required environment

Set in `deploy/.env` (mode **600**, gitignored). Values are never echoed by the tooling.

`DATABASE_URL`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_ACCESS_SECRET` (≥32 chars),
`INTEGRATIONS_ENCRYPTION_KEY`, `CORS_ALLOWED_ORIGINS`, `WEB_HOST`, `API_HOST`,
`NEXT_PUBLIC_API_BASE_URL`, `ATTACHMENTS_STORAGE_PROVIDER` (`s3` in production),
`ATTACHMENTS_S3_BUCKET`, `ATTACHMENTS_S3_ENDPOINT`, `ATTACHMENTS_S3_ACCESS_KEY_ID`,
`ATTACHMENTS_S3_SECRET_ACCESS_KEY`, `METRICS_AUTH_TOKEN`.

`NEXT_PUBLIC_API_BASE_URL` must be an address a **browser** can reach — an internal compose hostname produces an app that renders perfectly and loads no data.

## Health verification

```bash
curl -fsS http://localhost:3000/readiness    # API readiness (includes object storage)
curl -fsS http://localhost:3000/liveness
curl -fsS http://localhost:9090/api/v1/targets   # all targets up
curl -fsS http://localhost:9093/-/healthy        # alertmanager
```

Readiness includes object-storage reachability, which is why invalid credentials prevent boot rather than degrading silently.

## Local authenticated environment

```bash
./scripts/dev-authenticated-env.sh          # API :3010, web :3011, fixtures seeded
./scripts/dev-authenticated-env.sh --stop
```

This seeds the owner **and** the restricted-role fixtures the permission matrix needs.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Deploy exits with a named missing variable | Configuration preflight — fix `deploy/.env`, nothing was changed |
| API crash-loops on `Cannot reach S3 bucket` | Object-storage credentials invalid or bucket missing |
| Web renders but loads no data | `NEXT_PUBLIC_API_BASE_URL` not browser-reachable |
| Every request 404s at the edge | `WEB_HOST`/`API_HOST` unset — nginx has no server_name |
