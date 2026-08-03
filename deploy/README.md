# Voltx Deployment

The complete stack — postgres, redis, api, web, nginx and monitoring — deployed by one script.

| Document | Contents |
| --- | --- |
| [RUNBOOK.md](RUNBOOK.md) | deploy commands, required environment, health checks, troubleshooting |
| [BACKUP-RESTORE.md](BACKUP-RESTORE.md) | schedule, retention, restore, integrity verification |
| [ROLLBACK.md](ROLLBACK.md) | rollback mechanism, procedure, data impact |
| [../architecture/production-readiness.md](../architecture/production-readiness.md) | launch gate status and open blockers |

## Quick start

```bash
cp .env.example .env && chmod 600 .env   # then fill it in
./scripts/preflight-test.sh              # verify preflight behaviour
DEPLOY_ENV=staging ./deploy.sh
./scripts/install-backup-schedule.sh     # Linux hosts (needs flock)
```

## Layout

```
deploy/
  deploy.sh                    only supported deployment path
  docker-compose.yml           full stack (monitoring behind a profile)
  crontab                      backup schedule TEMPLATE — install via the script
  scripts/
    backup.sh                  pg_dump + gzip + retention
    restore.sh                 restore an archive
    restore-drill.sh           seeded end-to-end DR proof
    verify-latest-backup.sh    scheduled integrity check (fails closed)
    install-backup-schedule.sh renders + installs the crontab
    preflight-test.sh          asserts preflight fails safely and leaks nothing
  nginx/ prometheus/ alertmanager/ grafana/ blackbox/
```

**Never commit `.env`, TLS private keys, or `prometheus/metrics_token`.**
