# Database migrations in production

## The incident

The Render deployment reached application startup and then crashed with Prisma
`P2021` — `The table 'public.workflow_templates' does not exist in the current
database`. `workflow_schedules` and every other table were missing too.

The database was empty. Nothing had ever applied the migrations.

## Root cause

Two independent faults. Either one alone reproduces the outage.

### 1. The production image could not migrate itself

`backend/Dockerfile`'s production stage prunes to runtime dependencies:

```dockerfile
COPY --from=build /app/node_modules ./node_modules
RUN pnpm prune --prod --ignore-scripts
```

`prisma` — the CLI that provides `migrate deploy` — was a **devDependency**, so
the prune deleted it. Verified against the shipped image:

```
migration dirs in image: 49
prisma CLI: *** ABSENT — prisma migrate deploy cannot run ***
```

The image carried every migration SQL file and no way to execute any of them.

This is easy to miss because `@prisma/client` (the query engine, a real runtime
dependency) *was* present. The app could talk to the database perfectly well —
it just could not change its schema.

### 2. Nothing invoked migrations on a PaaS

The only thing that had ever run `prisma migrate deploy` was a separate
one-shot `migrate` service in `deploy/docker-compose.yml`, built from the
`build` stage — which still had the CLI. That is why local and compose-based
deployments always worked and hid fault #1.

Render has no compose file. There was also **no `render.yaml`** in the
repository, so the deployment was configured entirely through dashboard state
with no migration step at all.

The application code was correct throughout. The deployment *mechanism* was
missing, which is why lint, `tsc`, `pnpm build` and 1536 unit tests all passed
against a build that could not deploy.

## The fix

1. **`backend/package.json`** — moved `prisma` from `devDependencies` to
   `dependencies`. The CLI is genuinely required at runtime by the deployment,
   so this is a correction of the dependency's classification, not a workaround.

2. **`backend/Dockerfile`** — added a build-time guard that fails the build
   rather than shipping an image that cannot migrate:

   ```dockerfile
   RUN node_modules/.bin/prisma --version > /dev/null \
       || (echo "ERROR: prisma CLI missing from the production image ..." >&2 && exit 1)
   ```

3. **`render.yaml`** — a Blueprint declaring the topology in version control,
   with the migration step as a pre-deploy command:

   ```yaml
   preDeployCommand: node_modules/.bin/prisma migrate deploy
   ```

### Why pre-deploy and not the start command

`preDeployCommand` runs once, inside the built image, against the live
database, **before** any traffic shifts to the new version. A non-zero exit
aborts the deploy and the previous version keeps serving.

Migrating from the start command instead would mean every instance migrates
concurrently on scale-out, and a migration failure would crash-loop the new
version rather than cleanly abort the release.

### What was deliberately not done

No tables were created by hand. No migration was skipped, squashed, or marked
resolved. `migrate deploy` only applies pending migrations in filename order
and records them in `_prisma_migrations` — it never generates or resets schema,
and it aborts on a checksum mismatch rather than "repairing" anything.

## Verification

Run against a **fresh, empty** database using the actual production image
(`voltx-api:migfix`), simulating a new Render Postgres instance.

| Check | Result |
| --- | --- |
| Tables before migrate | `0` |
| `prisma migrate deploy` | `All migrations have been successfully applied.` |
| Migrations applied / on disk | `48 / 48` |
| Unfinished migrations | `0` |
| Rolled back | `0` |
| Applied in filename order | `true` |
| `workflow_templates` exists | `true` |
| `workflow_schedules` exists | `true` |
| Total tables after migrate | `142` |
| Production boot | `ready after 4s` |
| `P2021` occurrences | `0` |
| Sustained run | `6 min healthy, 0 restarts` |
| `/readiness` | `{"status":"ready","database":{"status":"up"},"redis":{"status":"up"}}` |

Regression coverage lives in `backend/test/migration-deployment.spec.ts` (18
tests). Those guards were mutation-tested: reverting `prisma` to a
devDependency and deleting the `preDeployCommand` fails 4 assertions.

## Known gaps on Render

These do not block boot, but they are real and unresolved:

- **Attachment uploads return 503.** There is no ClamAV service in the
  blueprint. An unset `CLAMAV_HOST` does not block startup — `VirusScanModule`
  falls back to the no-op scanner — but `AttachmentService` then refuses every
  upload in production rather than storing an unscanned file.
- **S3 credentials are `sync: false`** and must be set in the dashboard.
  `StorageModule` throws at boot in production unless
  `ATTACHMENTS_STORAGE_PROVIDER=s3`, because Render's disks are ephemeral.
- **`CORS_ALLOWED_ORIGINS` is unset by default**, which trusts no browser
  origin. It must be set to the web app origin or every authenticated request
  fails CORS.
- **The nightly cron is a drift check, not a backup.** The image has no
  `pg_dump` (`node:22-alpine` ships no `postgresql-client`), so
  `deploy/scripts/backup.sh` cannot run there. Render's managed Postgres takes
  its own backups; the cron runs `prisma migrate status` so a database that has
  drifted from the migration history surfaces as a failed job.

## Adding a migration

```bash
pnpm prisma:migrate        # authors a migration locally
```

Commit the generated directory. Deployment applies it automatically. Never edit
an already-applied migration — the checksum will mismatch and the deploy will
abort.
