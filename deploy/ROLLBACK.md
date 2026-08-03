# Rollback

## Mechanism

`deploy.sh` tags the currently-deployed images as `:previous` **before** the new build overwrites `:latest`. Without that step there is no version to return to.

```bash
docker tag voltx-api:latest voltx-api:previous   # done automatically by deploy.sh
```

CI rollback runs through `.github/workflows/deploy.yml` with `environment: rollback`.

## Procedure

1. Record the currently deployed version and image IDs.
2. Confirm a rollback candidate exists: `docker images | grep :previous`.
3. Trigger the documented rollback (CI workflow, or retag `:previous` → `:latest` and recreate).
4. **Migrations must not re-run.** The deploy workflow guards this explicitly: a rollback against an older image must not apply newer migrations.
5. Wait for API readiness and liveness.
6. Verify login and the dashboard.
7. Restore the newest version afterward and confirm health.

## Data impact

Rollback restores **code**, not data. Migrations already applied stay applied. A rollback across a destructive migration therefore requires a database restore (see BACKUP-RESTORE.md), not just an image swap. Prefer forward-fixing over rolling back across a schema change.

## Status

**Not exercised.** The drill requires a healthy deployment to roll back *from*, and the API cannot currently boot (invalid object-storage credentials). Once storage credentials are rotated and staging is serving, run the drill before launch.

Note that in the current failure a rollback would not have helped: the fault is configuration, not code, so the previous image fails identically.
