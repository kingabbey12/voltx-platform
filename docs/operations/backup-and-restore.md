# Backup & Restore

## Verified recovery characteristics

| Measure | Value | How it was established |
| --- | --- | --- |
| **Restore verified** | Yes — `deploy/scripts/restore-drill.sh` passes | Seed → backup → drop schema → restore → compare. Row counts **and a `SUM()` checksum** matched exactly; index, foreign key and sequence state all survived; a post-restore `INSERT` succeeded without a primary-key collision |
| **RTO** (recovery time) | **< 1s** for a 20 KB / 2,500-row archive | Measured by the drill. **Not representative of production volume** — see the caveat below |
| **RPO** (data loss window) | **Up to 24h**, or since the last deploy | Backups run pre-migration on every deploy plus a daily 03:00 UTC cron. Anything written after the most recent backup is lost |

> **RTO caveat.** The measured restore time is from a drill against a tiny dataset. It establishes that restore *works*, not how long a production-sized restore takes. Re-run the drill against a production-sized snapshot before quoting an RTO in any customer commitment.

> **RPO is a business decision.** A 24-hour worst case means up to a day of customer data lost in a total-loss event. Narrowing it requires continuous archiving (WAL shipping / PITR), which is not configured today.

## Restoring

```bash
cd deploy

# Docker mode (default) — prompts for the database name before dropping anything
./scripts/restore.sh backups/voltx-20260726T030000Z.sql.gz

# Guard against restoring into the wrong database
./scripts/restore.sh --expect-db voltx backups/voltx-....sql.gz

# Non-interactive (automation only)
./scripts/restore.sh --force --expect-db voltx backups/voltx-....sql.gz
```

`restore.sh` checks archive integrity **before** dropping anything, refuses to proceed if the target database name does not match `--expect-db`, and fails loudly if the restore completes with an empty schema. If the archive predates current migrations, run `pnpm prisma:migrate:deploy` afterwards.

## Restore drill

```bash
./deploy/scripts/restore-drill.sh          # exits non-zero on any mismatch
```

Provisions a throwaway database, seeds it, backs it up, destroys it, restores it, and compares checksums. It cleans up after itself even on failure.

**Run it quarterly, and after any change to `backup.sh` or `restore.sh`.** A backup that has never been restored is a hypothesis; the drill is what makes it a capability.

## Overview

Two backup mechanisms exist:

1. **`deploy/scripts/backup.sh`** — Docker-aware backup for staging/production deployments (runs via `docker compose exec`). Wired into the deploy pipeline as a pre-migration step.
2. **`backend/scripts/backup-db.sh`** — Standalone backup using direct `pg_dump` (for local dev / non-Docker environments).

## Deploy Pipeline (Staging / Production)

### Automatic pre-migration backup

Every deployment via `deploy/deploy.sh` automatically takes a database backup **before** running migrations. The backup is stored in `deploy/backups/` with the timestamp `voltx-<YYYYMMDDTHHMMSSZ>.sql.gz`.

```bash
cd deploy
./deploy.sh                         # normal deploy (includes backup)
./deploy.sh --skip-backup           # skip the pre-migration backup
./deploy.sh --strict                # strict mode + backup
```

### Manual backup

```bash
cd deploy
./scripts/backup.sh
# Output: deploy/backups/voltx-20260725T030000Z.sql.gz
```

### Scheduled backup (cron)

The `deploy/crontab` file provides a daily 3:00 AM UTC schedule. Install it:

```bash
# Deploy user's crontab
crontab deploy/crontab

# Or as root for a different user
crontab -u deploy deploy/crontab
```

Customize the paths in the crontab before installing.

### Restore

```bash
# List available backups
ls deploy/backups/

# Restore the latest backup into the running postgres container
gunzip -c deploy/backups/voltx-20260725T030000Z.sql.gz | \
  docker compose -f docker-compose.yml exec -T postgres \
  psql -U ${POSTGRES_USER:-voltx} -d ${POSTGRES_DB:-voltx}
```

**Important:** Restoring into a database that already has data will fail on unique constraint violations. Restore into a fresh database or truncate existing tables first.

## Local Development

### Backup

```bash
cd backend
DATABASE_URL=postgresql://voltx:voltx@localhost:5433/voltx ./scripts/backup-db.sh ./backups
```

### Restore

```bash
gunzip -c backend/backups/voltx-20260725T030000Z.sql.gz | psql postgresql://voltx:voltx@localhost:5433/voltx
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `BACKUP_DIR` | `deploy/backups/` | Output directory for backups |
| `BACKUP_RETENTION_DAYS` | `14` | Backups older than this are pruned after each run |
| `DATABASE_URL` | _(required for direct mode)_ | Postgres connection string |

## Verification

**An unverified backup is not a backup — it's an assumption.** Periodically verify backups are restorable:

```bash
# Create a scratch database
createdb voltx_verify

# Restore the latest backup into it
gunzip -c deploy/backups/voltx-20260725T030000Z.sql.gz | psql voltx_verify

# Run sanity checks
psql voltx_verify -c "SELECT count(*) FROM organizations;"
psql voltx_verify -c "SELECT count(*) FROM users;"

# Drop the scratch database
dropdb voltx_verify
```

## Disaster Recovery

In the event of total data loss:

1. Ensure postgres service is running: `docker compose up -d postgres`
2. Restore from the most recent backup (see Restore above)
3. Run any migrations that were applied after the backup timestamp
4. Verify data integrity
5. Restart API: `docker compose up -d api`
