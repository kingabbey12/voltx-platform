# Backup & Restore

## Backup

`backend/scripts/backup-db.sh` dumps the full Postgres database (schema + data, including `pgvector` embeddings) to a gzip-compressed `.sql.gz` file and prunes anything older than the retention window.

```bash
cd backend
DATABASE_URL=postgresql://voltx:voltx@localhost:5433/voltx ./scripts/backup-db.sh ./backups
```

- `DATABASE_URL` — required, the database to back up.
- Argument 1 (optional) — output directory, defaults to `./backups`.
- `BACKUP_RETENTION_DAYS` (optional, default `14`) — backups older than this are deleted after each run.

The script only performs the dump + rotation; scheduling it (cron, a CI scheduled workflow, a Kubernetes CronJob, your hosting provider's managed backup feature, etc.) is the deploying team's choice, since that depends on where this is actually deployed. Point the schedule's output directory at durable storage (not the container's own ephemeral disk) — e.g. a mounted volume or an object-storage sync step after the dump completes.

## Restore

```bash
gunzip -c voltx-20260706T030000Z.sql.gz | psql "$DATABASE_URL"
```

Restoring into a database that already has data will conflict on primary keys — restore into a fresh database (or one you've explicitly truncated) unless you specifically want to layer/merge, which this plain-SQL dump format doesn't support cleanly.

## Verifying a backup is restorable

Periodically restore a recent backup into a scratch database and run a basic sanity check (e.g. `SELECT count(*) FROM organizations;`) — an unverified backup is not a backup, it's an assumption.
