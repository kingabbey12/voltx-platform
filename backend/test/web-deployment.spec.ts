import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

/**
 * Deployment invariants for apps/web.
 *
 * `NEXT_PUBLIC_*` values are inlined into the client bundle by `next build`,
 * which makes them build inputs rather than runtime configuration. Two
 * production-breaking faults followed from that and are guarded here:
 *
 *  1. `.dockerignore` excluded only node_modules/.next/*.log, so `COPY . .`
 *     copied a developer's `.env.local` into the build context. The built
 *     image had `http://localhost:3000/api/v1` compiled in — every user's
 *     browser would have called their own machine — and the env file was
 *     baked into an image layer.
 *  2. CSP `connect-src` was `'self'`, which does not cover the API on a
 *     different origin (api.usevoltx.com vs app.usevoltx.com). The browser
 *     would have blocked every XHR and socket.io connection, rendering the
 *     app perfectly with no data.
 *
 * Neither was visible to lint, type-check or `next build` — both were found by
 * inspecting the built image and the running container.
 */

const repoRoot = join(__dirname, '..', '..');
const webDir = join(repoRoot, 'apps/web');

const dockerfile = readFileSync(join(webDir, 'Dockerfile'), 'utf8');
const dockerignore = readFileSync(join(webDir, '.dockerignore'), 'utf8');
const nextConfig = readFileSync(join(webDir, 'next.config.ts'), 'utf8');

describe('web build context excludes environment files', () => {
  it.each(['.env', '.env.*'])('ignores %s', (pattern) => {
    expect(dockerignore).toContain(pattern);
  });

  it('still allows .env.example, which carries no secrets', () => {
    expect(dockerignore).toContain('!.env.example');
  });
});

describe('web image is built for a specific environment', () => {
  it.each(['NEXT_PUBLIC_API_BASE_URL', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'])(
    'accepts %s as a build ARG',
    (name) => {
      expect(dockerfile).toMatch(new RegExp(`ARG\\s+${name}`));
    },
  );

  it('fails the build when the API URL is missing rather than emitting a bad bundle', () => {
    // `next build` succeeds on a missing value; the fault would only appear in
    // a user's browser, so the guard has to be explicit.
    expect(dockerfile).toContain('if [ -z "$NEXT_PUBLIC_API_BASE_URL" ]');
    expect(dockerfile).toContain('exit 1');
  });

  it('binds the standalone server to a reachable interface', () => {
    // Next's standalone server listens on 127.0.0.1 unless told otherwise,
    // which is unreachable from outside the container.
    expect(dockerfile).toMatch(/ENV\s+HOSTNAME=0\.0\.0\.0/);
  });

  it('healthchecks with node, not BusyBox wget', () => {
    // wget follows redirects with no way to stop it, so /health redirecting to
    // /login would report a broken app as healthy.
    expect(dockerfile).toContain("redirect:'manual'");
    expect(dockerfile).not.toMatch(/HEALTHCHECK[\s\S]*wget/);
  });
});

describe('compose supplies the build-time values', () => {
  const compose = load(readFileSync(join(repoRoot, 'deploy/docker-compose.yml'), 'utf8')) as {
    services: Record<string, { build?: { args?: Record<string, string> } }>;
  };
  const args = compose.services.web?.build?.args ?? {};

  it('passes the API URL as a build arg, not only as runtime env', () => {
    // Setting it under `environment:` has no effect on the compiled bundle.
    expect(Object.keys(args)).toContain('NEXT_PUBLIC_API_BASE_URL');
  });

  it('makes the API URL required rather than defaulting it', () => {
    expect(String(args.NEXT_PUBLIC_API_BASE_URL)).toContain(':?');
  });
});

describe('CSP allows the API origin the client is built against', () => {
  it('derives connect-src from NEXT_PUBLIC_API_BASE_URL', () => {
    expect(nextConfig).toContain('NEXT_PUBLIC_API_BASE_URL');
    expect(nextConfig).toMatch(/connect-src[^;]*\$\{apiConnectSources\(\)\}/);
  });

  it('allows the websocket origin, since the live inbox connects to the API', () => {
    expect(nextConfig).toContain('replace(/^http/, "ws")');
  });

  it('does not fall back to a blanket wss: source', () => {
    // A bare `wss:` permits a socket to any host; the derived origin is enough.
    expect(nextConfig).not.toMatch(/connect-src[^;]*\bwss:\s/);
  });
});

describe('deploy.sh refuses a web URL browsers cannot reach', () => {
  const deployScript = readFileSync(join(repoRoot, 'deploy/deploy.sh'), 'utf8');

  it('rejects localhost and internal compose hostnames', () => {
    expect(deployScript).toContain('NEXT_PUBLIC_API_BASE_URL');
    expect(deployScript).toMatch(/\*localhost\*/);
    expect(deployScript).toMatch(/127\.0\.0\.1/);
  });

  it('requires https in production', () => {
    expect(deployScript).toMatch(/must use https in production/);
  });
});

/**
 * nginx hostnames were hardcoded to staging.voltx.ai / api-staging.voltx.ai,
 * so `DEPLOY_ENV=production ./deploy/deploy.sh` would have produced a proxy
 * answering on no production hostname at all — every request 404ing at the
 * edge while every container reported healthy.
 */
describe('reverse proxy serves the environment it is deployed into', () => {
  const template = readFileSync(
    join(repoRoot, 'deploy/nginx/templates/voltx.conf.template'),
    'utf8',
  );
  const compose = load(readFileSync(join(repoRoot, 'deploy/docker-compose.yml'), 'utf8')) as {
    services: Record<string, { environment?: Record<string, string>; volumes?: string[] }>;
  };

  it('parameterises server_name instead of hardcoding one environment', () => {
    // Assert on the directives, not the whole file — the header comment
    // legitimately names the old hardcoded hosts to explain the change.
    const serverNames = [...template.matchAll(/^\s*server_name\s+(.+);$/gm)].map(
      ([, hosts]) => hosts,
    );

    expect(serverNames.length).toBeGreaterThan(0);
    for (const hosts of serverNames) {
      expect(hosts).toMatch(/\$\{(WEB|API)_HOST\}/);
      expect(hosts).not.toMatch(/voltx\.ai/);
    }
  });

  it('mounts the template directory so envsubst actually runs', () => {
    // Mounting into conf.d/ directly bypasses the entrypoint's substitution.
    const volumes = (compose.services.nginx?.volumes ?? []).join(' ');
    expect(volumes).toContain('/etc/nginx/templates');
    expect(volumes).not.toContain('conf.d/default.conf');
  });

  it('requires both hostnames rather than defaulting them', () => {
    const env = compose.services.nginx?.environment ?? {};
    expect(String(env.WEB_HOST)).toContain(':?');
    expect(String(env.API_HOST)).toContain(':?');
  });

  it('restricts envsubst so nginx runtime variables survive', () => {
    // Without a filter, envsubst would eat $host and $http_upgrade.
    const env = compose.services.nginx?.environment ?? {};
    expect(String(env.NGINX_ENVSUBST_FILTER)).toContain('WEB');
    expect(template).toContain('$http_upgrade');
  });

  it('proxies the websocket upgrade the live inbox depends on', () => {
    expect(template).toContain('proxy_set_header Upgrade $http_upgrade');
  });
});

describe('CI can actually build what it ships', () => {
  const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');

  it('gives the web build its required API URL', () => {
    // `prebuild` runs validate-env.mjs, which throws without it — the job was
    // failing before it reached the tests.
    expect(workflow).toMatch(/NEXT_PUBLIC_API_BASE_URL:\s*https:\/\//);
  });

  it('passes build-args when publishing the web image', () => {
    expect(workflow).toContain('build-args:');
    expect(workflow).toMatch(/NEXT_PUBLIC_API_BASE_URL=\$\{\{\s*vars\./);
  });

  it('gates apps/marketing, which previously had no job at all', () => {
    expect(workflow).toMatch(/^ {2}marketing:$/m);
    expect(workflow).toContain('working-directory: apps/marketing');
  });
});

/**
 * Every long-running service must restart itself. The web tier — the only
 * customer-facing one — had no policy, so a crash or host reboot left it down
 * while everything around it recovered.
 */
describe('long-running services restart themselves', () => {
  const compose = load(readFileSync(join(repoRoot, 'deploy/docker-compose.yml'), 'utf8')) as {
    services: Record<string, { restart?: string; entrypoint?: unknown; profiles?: string[] }>;
  };

  // `migrate` is a one-off job: restarting it would re-run migrations in a loop.
  const longRunning = Object.entries(compose.services).filter(([name]) => name !== 'migrate');

  it.each(longRunning.map(([name]) => name))('%s declares a restart policy', (name) => {
    expect(compose.services[name]?.restart).toBe('unless-stopped');
  });

  it('does not restart the one-off migration job', () => {
    expect(compose.services.migrate?.restart).toBeUndefined();
  });
});
