# Rollback Checklist

## Application rollback (no schema change involved)
1. Identify the last known-good image tag (`deploy.yml` tags every build with the git SHA — `ghcr.io/<repo>/backend:<previous-sha>`).
2. Redeploy that image to your hosting target. No database action needed.
3. Confirm `/api/v1/health` and `/readiness` return 200 post-rollback.
4. If mobile shipped alongside, the mobile app version should be app-store/TestFlight rolled back independently — the backend API contract (`/api/v1/...`) is versioned (`VersioningType.URI`), so an old mobile build talking to a rolled-back backend should still work as long as you haven't rolled back past whatever version that mobile build expects.

## Application rollback (schema change involved)
Prisma migrations are forward-only by convention here — there is no automated down-migration tooling wired up.
1. Before rolling back application code past a migration boundary, check whether the migration was additive (new nullable column/table — safe, old code just ignores the new column) or destructive (dropped/renamed a column — rolling back code that expects the old shape will break against the new schema).
2. For an additive migration: roll back the application image only; leave the schema as-is. No action needed.
3. For a destructive migration: you need a hand-written down-migration (write a new forward migration that reverses it) rather than reverting Prisma migration files directly — reverting migration *files* without a corresponding database change will desync `_prisma_migrations` from actual schema state.
4. Always restore from backup (see below) rather than attempting to hand-reverse a destructive migration under time pressure during an incident.

## Database restore
See `docs/operations/backup-and-restore.md` for the actual restore procedure using `scripts/backup-db.sh`'s output. In short: `pg_restore` against a fresh database, then point the application at it — this is a full point-in-time restore, not a selective rollback, so any writes since the backup are lost. Only do this if the incident is severe enough that losing recent writes is preferable to leaving things broken.

## Redis rollback
Redis here is a pure cache (knowledge-embedding lookups) with no durable state that matters — if Redis is misbehaving, set `REDIS_ENABLED=false` and redeploy; the app falls back to its in-memory cache with no data loss (cache entries are, by definition, reconstructable from source data).

## Decision checklist during an incident
- [ ] Is this an application bug (rollback the image) or a data problem (restore from backup)?
- [ ] Did the deploy that caused this include a migration? If yes, is it additive or destructive?
- [ ] Is the mobile app affected, or only the backend? (Mobile releases and backend releases are independent — check which one actually changed before the incident started.)
- [ ] After rollback, re-run the smoke test in `beta-deployment-checklist.md` section 6 before declaring the incident resolved.
