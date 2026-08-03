# Backup & Restore

## Schedule

`deploy/crontab` is a **template**, not an installable file. Its tokens are substituted for the host you install on:

```bash
deploy/scripts/install-backup-schedule.sh --print    # preview, changes nothing
deploy/scripts/install-backup-schedule.sh            # install for the current user
crontab -l                                           # verify
```

The template previously shipped `/path/to/deploy` placeholders alongside an instruction to run `crontab deploy/crontab`. Installing it produced a schedule that failed on **every** run — the backups looked scheduled and were not. The installer refuses to install if any token is still unsubstituted, so that cannot recur silently.

| Job | Schedule (UTC) | Script |
| --- | --- | --- |
| Database backup | `0 3 * * *` (daily 03:00) | `scripts/backup.sh --docker` |
| Integrity verification | `0 5 * * 0` (Sunday 05:00) | `scripts/verify-latest-backup.sh` |

Both jobs take the **same exclusive lock**, acquired *inside the scripts* (`scripts/with-lock.sh`), so a slow backup can never overlap the next one, verification can never race a backup, **and a manual run is protected too** — the case a cron-only wrapper misses.

Locking uses an atomic `mkdir`, which is correct on every POSIX filesystem and needs no `flock`. The installer previously required `flock` and refused without it, which on macOS meant the schedule was never installed at all and the database it existed to protect went unbacked-up. A guard that blocks the thing it protects is worse than the risk it guards against.

Stale locks (host reboot, SIGKILL) are broken automatically after `LOCK_STALE_SECONDS` (default 2h), so an abandoned lock cannot suppress backups indefinitely.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `BACKUP_DIR` | `deploy/backups` | archive destination (created mode 700) |
| `LOG_DIR` | `deploy/logs` | job logs (created mode 700) |
| `LOCK_DIR` | `/tmp` | lock directory |
| `LOCK_STALE_SECONDS` | `7200` | age after which an abandoned lock is broken |
| `RETENTION_DAYS` | `14` | daily retention, enforced by `backup.sh` |
| `BACKUP_MAX_AGE_HOURS` | `48` | staleness threshold used by the verifier |

Retention is enforced inside `backup.sh` (`find -mtime +N -delete`). Only a daily tier exists today — see Known limitations.

## Restore

```bash
deploy/scripts/restore.sh <archive.sql.gz>
```

## Verification

Two complementary checks:

**`scripts/restore-drill.sh`** — seeds its own known dataset, backs it up, destroys the schema, restores, and compares checksums. Use it after changing `backup.sh` or `restore.sh`, and quarterly.

**`scripts/verify-latest-backup.sh`** — the scheduled, unattended check. It validates whatever the nightly backup actually captured:

1. An archive exists and is **newer than `BACKUP_MAX_AGE_HOURS`** — this is what catches a schedule that stopped running, which readability checks alone miss entirely.
2. `gzip -t` integrity.
3. The dump header is a readable PostgreSQL dump.
4. It restores into a disposable database.
5. Tables, foreign keys, indexes and sequences survived, and the RBAC catalogue is non-empty — an empty `permissions` table means a schema-only dump.

It exits non-zero on any failure so cron and alerting can act.

## Verified results

| Check | Result |
| --- | --- |
| `restore-drill.sh` | **PASS** — 500 customers / 2000 invoices / checksum `102636333` matched; index, FK and sequences intact; restore **1s** |
| `backup.sh --docker` | **PASS** — 52K archive, integrity check passed |
| `verify-latest-backup.sh` | **PASS** — 149 tables, 217 FKs, 611 indexes, 144 permission rows |
| Staleness detection | **PASS** — an 8-day-old archive fails with exit 1 and a named reason |
| Overlap protection | **PASS** — a second job while one runs exits 0 with `already running — skipping` |
| Stale-lock recovery | **PASS** — a lock older than `LOCK_STALE_SECONDS` is broken and reacquired |

## Failure alerting

Job output is appended to `$LOG_DIR/backup.log` and `$LOG_DIR/backup-verify.log`. Non-zero exits are what cron surfaces; route them through the host's cron `MAILTO`, a log shipper, or a wrapper that posts to Alertmanager.

Backup age, size, failure count and verification result are all published as Prometheus metrics (see Backup Monitoring), and five alerts cover overdue/empty/failed/repeated-failure cases. A dead schedule is therefore visible in Alertmanager, not just in logs.

## Known limitations

1. **Retention is daily-only** (14 copies). The weekly/monthly tiers described in the launch plan are not implemented.
2. **Backups are not encrypted at rest.** They contain business data and are protected only by directory permissions (700).
3. **The schedule is not installed on this machine.** The `flock` blocker is gone, but installing it replaces the machine's whole crontab with jobs that `DROP`/`CREATE` a database — a persistent change that belongs on the staging/production host, not a developer laptop. Run `deploy/scripts/install-backup-schedule.sh` there.
4. Off-host/off-site replication of archives is not configured.
