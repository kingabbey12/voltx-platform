import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the property that makes the test suite trustworthy: under
 * NODE_ENV=test the application reads `.env.test` and nothing else.
 *
 * Before this was enforced, ConfigModule fell through to `.env.local` and
 * `.env`, so every local run inherited 80+ variables from the developer's
 * personal git-ignored config. REDIS_ENABLED=true leaking in switched
 * queue-backed work from inline to asynchronous and failed 27 e2e tests that
 * assert on completed state, and live ANTHROPIC/OPENAI/STRIPE keys and a
 * Sentry DSN leaked in alongside it. The suite passed in CI (no `.env`
 * present) and failed on developer machines for reasons nothing in the
 * repository explained.
 */
describe('test environment is hermetic', () => {
  const backendRoot = join(__dirname, '..');
  const appModuleSource = readFileSync(join(backendRoot, 'src/app.module.ts'), 'utf8');
  const envTestSource = readFileSync(join(backendRoot, '.env.test'), 'utf8');

  const declaredKeys = new Set(
    envTestSource
      .split('\n')
      .map((line) => /^([A-Z0-9_]+)=/.exec(line.trim())?.[1])
      .filter((key): key is string => Boolean(key)),
  );

  it('loads only .env.test when NODE_ENV is test', () => {
    const envFilePath = /envFilePath:[\s\S]{0,200}?,\n/.exec(appModuleSource)?.[0] ?? '';

    expect(envFilePath).toContain("'.env.test'");
    // The whole point: no fall-through to developer-local config under test.
    expect(envFilePath).toMatch(/NODE_ENV === 'test' \? \['\.env\.test'\]/);
  });

  it.each([
    // Switches queue-backed work between inline and asynchronous execution.
    // Left undeclared, it is inherited and silently breaks 27 e2e tests.
    'REDIS_ENABLED',
    // Without these pinned off, a test run can spend money on a real provider.
    'OPENAI_ENABLED',
    'ANTHROPIC_ENABLED',
    'GOOGLE_AI_ENABLED',
    // Without this pinned empty, a test run reports to the real Sentry project.
    'SENTRY_DSN',
  ])('declares %s explicitly rather than inheriting it', (key) => {
    expect(declaredKeys.has(key)).toBe(true);
  });

  it('keeps queue-backed work inline so completion assertions are valid', () => {
    expect(envTestSource).toMatch(/^REDIS_ENABLED=false$/m);
  });

  it('declares every variable env.validation.ts requires', () => {
    const validationSource = readFileSync(
      join(backendRoot, 'src/config/env.validation.ts'),
      'utf8',
    );
    const required = [...validationSource.matchAll(/^\s{2}([A-Z0-9_]+)!:/gm)].map(
      (match) => match[1],
    );

    expect(required.length).toBeGreaterThan(0);
    expect(required.filter((key) => !declaredKeys.has(key))).toEqual([]);
  });

  describe('.env.docker.test stays in step with .env.test', () => {
    const dockerEnvSource = readFileSync(join(backendRoot, '.env.docker.test'), 'utf8');
    const dockerKeys = new Set(
      dockerEnvSource
        .split('\n')
        .map((line) => /^([A-Z0-9_]+)=/.exec(line.trim())?.[1])
        .filter((key): key is string => Boolean(key)),
    );

    // These decide *how the suite behaves*, so the containerised run has to
    // agree with the local one or docker-compose silently tests something else.
    it.each([
      'REDIS_ENABLED',
      'OPENAI_ENABLED',
      'ANTHROPIC_ENABLED',
      'GOOGLE_AI_ENABLED',
      'SENTRY_DSN',
      'STRIPE_API_KEY',
    ])('declares %s', (key) => {
      expect(dockerKeys.has(key)).toBe(true);
    });

    it('also keeps queue-backed work inline', () => {
      expect(dockerEnvSource).toMatch(/^REDIS_ENABLED=false$/m);
    });
  });

  it('names the Stripe key the way configuration.ts reads it', () => {
    const configurationSource = readFileSync(
      join(backendRoot, 'src/config/configuration.ts'),
      'utf8',
    );

    expect(configurationSource).toContain('process.env.STRIPE_API_KEY');
    expect(declaredKeys.has('STRIPE_API_KEY')).toBe(true);
    // STRIPE_SECRET_KEY is read by nothing; declaring it only looks like coverage.
    expect(declaredKeys.has('STRIPE_SECRET_KEY')).toBe(false);
  });
});
