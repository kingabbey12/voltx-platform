import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

/**
 * Guards the deployment path against the divergence this repository actually
 * had: two compose files describing the same system, with the one the
 * production documentation pointed at being the *less* complete of the two.
 *
 * `backend/docker-compose.prod.yml` — which docs/production-deployment.md told
 * operators to use — declared only postgres, redis, migrate and api. No web, no
 * nginx (so no TLS), and none of the monitoring stack. Meanwhile
 * deploy/docker-compose.yml carried the full 13-service topology.
 *
 * Compounding it, deploy.sh started postgres, redis, api, web and nginx and
 * never passed `--profile monitoring`, so even on the complete stack the
 * monitoring services were never created. Alerting was unreachable in practice
 * regardless of how well it was configured.
 */

const repoRoot = join(__dirname, '..', '..');

interface ComposeFile {
  services: Record<string, unknown>;
}

function services(relativePath: string): Set<string> {
  const parsed = load(readFileSync(join(repoRoot, relativePath), 'utf8')) as ComposeFile;
  return new Set(Object.keys(parsed.services ?? {}));
}

const deployStack = services('deploy/docker-compose.yml');
const deployScript = readFileSync(join(repoRoot, 'deploy/deploy.sh'), 'utf8');

describe('the deployed stack is complete', () => {
  it.each([
    ['api', 'the backend'],
    ['web', 'the frontend'],
    ['nginx', 'TLS termination'],
    ['postgres', 'the database'],
    ['redis', 'queues and scheduler locks'],
    ['prometheus', 'metric collection'],
    ['alertmanager', 'alert delivery'],
    ['postgres-exporter', 'database metrics'],
    ['redis-exporter', 'redis metrics'],
    ['node-exporter', 'host metrics'],
    ['blackbox-exporter', 'certificate expiry and external reachability'],
  ])('declares %s (%s)', (service) => {
    expect(deployStack.has(service)).toBe(true);
  });
});

describe('the deploy script actually starts what it declares', () => {
  it('passes the monitoring profile, without which those services are never created', () => {
    // Services behind a compose profile do not start unless the profile is
    // requested. Omitting it is silent — compose reports success.
    expect(deployScript).toContain('--profile monitoring');
  });

  it.each(['prometheus', 'alertmanager', 'postgres-exporter', 'blackbox-exporter'])(
    'brings up %s',
    (service) => {
      expect(deployScript).toMatch(new RegExp(`up -d[^\\n]*\\b${service}\\b`));
    },
  );

  it('resolves COMPOSE_FILE to the complete stack, not the API-only subset', () => {
    // Assert on the assignment rather than the whole file: the header comment
    // legitimately names docker-compose.prod.yml to warn operators off it.
    const composeFile = /^COMPOSE_FILE=.*$/m.exec(deployScript)?.[0] ?? '';

    expect(composeFile).toContain('docker-compose.yml');
    expect(composeFile).not.toContain('docker-compose.prod.yml');
  });

  it('warns when alert delivery or the scrape token is unconfigured', () => {
    // Both are files an operator must create; deploying without them yields a
    // stack that looks healthy but cannot page anyone.
    expect(deployScript).toContain('alertmanager/webhook_url');
    expect(deployScript).toContain('prometheus/metrics_token');
  });
});

describe('the API-only compose cannot be mistaken for a production deployment', () => {
  const prodComposeSource = readFileSync(join(repoRoot, 'backend/docker-compose.prod.yml'), 'utf8');

  it('says so in its header', () => {
    expect(prodComposeSource).toContain('NOT A COMPLETE PRODUCTION DEPLOYMENT');
    expect(prodComposeSource).toContain('deploy/deploy.sh');
  });

  it('is genuinely a subset — if it grows a web/monitoring tier, this guard is stale', () => {
    const apiOnly = services('backend/docker-compose.prod.yml');
    for (const absent of ['web', 'nginx', 'prometheus', 'alertmanager']) {
      expect(apiOnly.has(absent)).toBe(false);
    }
  });
});

describe('production documentation points at the complete stack', () => {
  const productionDoc = readFileSync(join(repoRoot, 'docs/production-deployment.md'), 'utf8');

  it('directs operators to the deploy script', () => {
    expect(productionDoc).toContain('deploy/deploy.sh');
  });

  it('does not instruct a production deploy from the API-only compose', () => {
    const instructsProdCompose = /docker compose -f backend\/docker-compose\.prod\.yml up/.test(
      productionDoc,
    );
    expect(instructsProdCompose).toBe(false);
  });
});

/**
 * Container healthchecks must actually test health, and must be executable by
 * the shell inside the image. Both failure modes have occurred here:
 *
 *  - `wget --spider /health` followed the auth redirect to /login, got 200, and
 *    reported healthy — it would have passed with the app badly broken.
 *  - The correction used `--max-redirect=0`, which is a GNU wget flag. The
 *    images run BusyBox wget, which exits 1 on the unknown option, so the web
 *    container was marked permanently unhealthy instead.
 *
 * Both were invisible to every other check: compose validated, the endpoint
 * returned 200 by hand, and the tests passed.
 */
describe('container healthchecks are valid for the image they run in', () => {
  const compose = load(readFileSync(join(repoRoot, 'deploy/docker-compose.yml'), 'utf8')) as {
    services: Record<string, { healthcheck?: { test?: string[] } }>;
  };

  const healthchecks = Object.entries(compose.services)
    .filter(([, svc]) => svc.healthcheck?.test)
    .map(([name, svc]) => [name, (svc.healthcheck?.test ?? []).join(' ')] as const);

  it('declares healthchecks for the services that serve traffic', () => {
    const named = healthchecks.map(([name]) => name);
    expect(named).toEqual(expect.arrayContaining(['api', 'web']));
  });

  it.each(healthchecks)('%s does not use GNU-only wget flags', (_name, test) => {
    // BusyBox wget supports only [-cqS] [--spider] [-O] [-o] [--header]
    // [--post-data] [--post-file] [-Y] [-P] [-U] [-T]. Anything else exits 1.
    for (const gnuOnly of ['--max-redirect', '--no-verbose', '--tries', '--timeout=']) {
      if (test.includes('wget')) {
        expect(test).not.toContain(gnuOnly);
      }
    }
  });

  it('web health is asserted on a direct 200, not a followed redirect', () => {
    const web = healthchecks.find(([name]) => name === 'web')?.[1] ?? '';
    expect(web).toContain("redirect:'manual'");
    expect(web).toContain('status===200');
  });
});

/**
 * Rollback requires something to roll back TO. It did not exist: api and web
 * were build-only services, so compose named their images
 * `<project>-<service>:latest` and nothing ever preserved the outgoing build.
 * The rollback plan meanwhile instructed `docker tag voltx-api:previous ...` —
 * an image name that was never produced and a tag that was never created.
 *
 * A drill on 2026-07-26 deployed a deliberately broken image and recovered in
 * 3 seconds using the corrected procedure.
 */
describe('a deploy leaves something to roll back to', () => {
  const compose = load(readFileSync(join(repoRoot, 'deploy/docker-compose.yml'), 'utf8')) as {
    services: Record<string, { image?: string; build?: unknown }>;
  };

  it.each([
    ['api', 'voltx-api'],
    ['web', 'voltx-web'],
  ])('%s declares a stable image name so builds are addressable', (service, expected) => {
    const image = compose.services[service]?.image ?? '';
    expect(image).toContain(expected);
  });

  it('deploy.sh preserves the outgoing image as :previous before rebuilding', () => {
    // Must happen BEFORE the build, or :latest is already overwritten.
    const preserveAt = deployScript.indexOf(':previous');
    const buildAt = deployScript.indexOf('build api web');
    expect(preserveAt).toBeGreaterThan(-1);
    expect(preserveAt).toBeLessThan(buildAt);
  });

  it('the rollback plan names images that a deploy actually produces', () => {
    const plan = readFileSync(join(repoRoot, 'docs/rollback-plan.md'), 'utf8');
    const declared = Object.values(compose.services)
      .map((svc) => svc.image?.split(':')[0])
      .filter((name): name is string => Boolean(name));

    for (const referenced of ['voltx-api', 'voltx-web']) {
      expect(plan).toContain(`${referenced}:previous`);
      expect(declared).toContain(referenced);
    }
    // Without --force-recreate compose sees no config change and leaves the
    // broken container running; the drill confirmed this.
    expect(plan).toContain('--force-recreate');
  });
});
