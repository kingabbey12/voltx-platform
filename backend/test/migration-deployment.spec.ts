import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

/**
 * Guards the contract that migrations are applied before the app serves traffic.
 *
 * The production incident: the API booted on Render against an empty database
 * and threw Prisma P2021 ("table does not exist") for `workflow_templates` and
 * `workflow_schedules`. Nothing had applied the migrations.
 *
 * Two independent faults combined:
 *
 *  1. `prisma` (the CLI) was a devDependency. The production stage of
 *     backend/Dockerfile runs `pnpm prune --prod`, which deleted it. The
 *     shipped image contained all 48 migration SQL files and no way to run
 *     them.
 *  2. The only thing that ever ran `prisma migrate deploy` was the separate
 *     `migrate` service in deploy/docker-compose.yml. A PaaS has no compose
 *     file, so on Render that step simply did not exist.
 *
 * Neither fault was visible to lint, tsc, `pnpm build` or any test — the code
 * was correct, the deployment mechanism was missing. Both are asserted here
 * because either one alone reproduces the outage.
 */

const backendDir = join(__dirname, '..');
const repoRoot = join(backendDir, '..');

const pkg = JSON.parse(readFileSync(join(backendDir, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

describe('the production image can migrate itself', () => {
  it('keeps the prisma CLI as a runtime dependency', () => {
    // `pnpm prune --prod` in the production stage removes devDependencies.
    // As a devDependency the CLI vanished from the shipped image.
    expect(pkg.dependencies?.prisma).toBeDefined();
    expect(pkg.devDependencies?.prisma).toBeUndefined();
  });

  it('ships @prisma/client too, so the pruned image can actually query', () => {
    expect(pkg.dependencies?.['@prisma/client']).toBeDefined();
  });

  it('exposes a deploy-only migration script that never generates schema', () => {
    // `migrate deploy` applies pending migrations and nothing else. `migrate
    // dev` would author new ones, and `db push` would silently diverge the
    // database from the migration history.
    expect(pkg.scripts?.['prisma:migrate:deploy']).toBe('prisma migrate deploy');
  });

  it('fails the docker build rather than shipping an image that cannot migrate', () => {
    const dockerfile = readFileSync(join(backendDir, 'Dockerfile'), 'utf8');

    // The guard must run after the prune, or it proves nothing.
    const pruneAt = dockerfile.indexOf('pnpm prune --prod');
    const guardAt = dockerfile.indexOf('node_modules/.bin/prisma --version');

    expect(pruneAt).toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(pruneAt);
  });

  it('copies the migration SQL into the production image', () => {
    const dockerfile = readFileSync(join(backendDir, 'Dockerfile'), 'utf8');
    const production = dockerfile.slice(dockerfile.indexOf('AS production'));
    expect(production).toMatch(/COPY\s+prisma\s+\.\/prisma/);
  });
});

describe('migration history is coherent', () => {
  const migrationsDir = join(backendDir, 'prisma/migrations');
  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it('has migrations to apply', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('names every migration with a sortable timestamp prefix', () => {
    // Prisma applies migrations in lexicographic directory order. A name that
    // does not start with a 14-digit timestamp sorts unpredictably relative to
    // the others, so a table could be altered before it is created.
    for (const name of migrations) {
      expect(name).toMatch(/^\d{14}_/);
    }
  });

  it('has no duplicate timestamps, which would make ordering ambiguous', () => {
    const stamps = migrations.map((name) => name.slice(0, 14));
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  it('gives every migration a migration.sql', () => {
    // An empty directory is recorded as applied while changing nothing,
    // permanently desynchronising the database from the schema.
    for (const name of migrations) {
      expect(existsSync(join(migrationsDir, name, 'migration.sql'))).toBe(true);
    }
  });

  it('creates the tables whose absence caused the P2021 outage', () => {
    const sql = migrations
      .map((name) => readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8'))
      .join('\n');

    for (const table of ['workflow_templates', 'workflow_schedules']) {
      expect(sql).toContain(`"${table}"`);
    }
  });
});

/**
 * The Render blueprint is the deployment mechanism that replaces the compose
 * `migrate` service. Without a pre-deploy step the fix to the image is inert:
 * the CLI would be present and simply never invoked.
 */
describe('render blueprint applies migrations before traffic shifts', () => {
  const blueprintPath = join(repoRoot, 'render.yaml');

  type RenderService = {
    name?: string;
    type?: string;
    preDeployCommand?: string;
    healthCheckPath?: string;
    envVars?: { key?: string; value?: string; sync?: boolean; generateValue?: boolean }[];
  };

  const blueprint = load(readFileSync(blueprintPath, 'utf8')) as {
    services?: RenderService[];
    databases?: { name?: string }[];
  };

  const api = blueprint.services?.find((service) => service.name === 'voltx-api');

  it('declares the API service', () => {
    expect(api).toBeDefined();
  });

  it('runs migrate deploy as a pre-deploy command', () => {
    // Running migrations in the start command instead would race: every
    // instance would migrate concurrently on scale-out, and a failure would
    // crash-loop the new version rather than abort the deploy.
    expect(api?.preDeployCommand).toContain('prisma migrate deploy');
  });

  it('invokes the CLI by path, since node_modules/.bin is not on PATH', () => {
    expect(api?.preDeployCommand).toContain('node_modules/.bin/prisma');
  });

  it('never resets, pushes or force-applies the schema', () => {
    // Any of these would satisfy "the app boots" by destroying or fabricating
    // data instead of applying the authored migrations.
    for (const forbidden of ['migrate reset', 'db push', '--force', 'migrate resolve']) {
      expect(api?.preDeployCommand).not.toContain(forbidden);
    }
  });

  it('health-checks a path that exists outside the /api/v1 prefix', () => {
    // configure-app.ts excludes `readiness` from the global prefix; a check
    // against /health or /api/v1/readiness would 404 and fail every deploy.
    expect(api?.healthCheckPath).toBe('/readiness');
  });

  it('wires DATABASE_URL to the declared database rather than a literal', () => {
    const dbUrl = api?.envVars?.find((env) => env.key === 'DATABASE_URL') as
      { fromDatabase?: { name?: string } } | undefined;

    expect(dbUrl?.fromDatabase?.name).toBe('voltx-postgres');
    expect(blueprint.databases?.some((db) => db.name === 'voltx-postgres')).toBe(true);
  });

  it('sets the env vars the API refuses to boot in production without', () => {
    const keys = (api?.envVars ?? []).map((env) => env.key);

    // MetricsScrapeGuard.assertConfigured throws without a >=32 char token;
    // StorageModule throws unless the provider is s3.
    expect(keys).toContain('METRICS_AUTH_TOKEN');
    expect(keys).toContain('INTEGRATIONS_ENCRYPTION_KEY');
    expect(keys).toContain('JWT_ACCESS_SECRET');

    const storage = api?.envVars?.find((env) => env.key === 'ATTACHMENTS_STORAGE_PROVIDER');
    expect(storage?.value).toBe('s3');
  });

  it('never hardcodes a secret value in version control', () => {
    // Secrets must come from generateValue (Render generates and stores it) or
    // sync:false (set in the dashboard) — never `value:` in a committed file.
    const secretish = /SECRET|TOKEN|KEY|PASSWORD/;

    for (const service of blueprint.services ?? []) {
      for (const env of service.envVars ?? []) {
        if (!env.key || !secretish.test(env.key)) continue;
        // Publishable/public values are safe to commit by definition.
        if (env.key.startsWith('NEXT_PUBLIC_')) continue;

        expect(env.value).toBeUndefined();
        expect(env.generateValue === true || env.sync === false).toBe(true);
      }
    }
  });
});
