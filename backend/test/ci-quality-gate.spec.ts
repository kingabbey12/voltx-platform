import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the CI configuration itself.
 *
 * These checks exist because the quality gate was, in practice, switched off:
 * the workflow only triggered on `main` while all development happened on
 * `develop` and PRs targeted `release/**`, so lint, type-checking, 1338 unit
 * tests, 339 e2e tests and the dependency audit ran on no ordinary change. The
 * audit step was separately neutered with `continue-on-error: true` while 12
 * advisories (6 high, in production dependencies) went unaddressed.
 *
 * Both failures were invisible — CI reported success by never running. A test
 * is the only thing that makes that state loud.
 */
describe('CI quality gate', () => {
  const repoRoot = join(__dirname, '..', '..');
  const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');

  const triggerBlock = /^on:\n([\s\S]*?)^\w/m.exec(workflow)?.[1] ?? '';

  it.each(['main', 'develop', 'release/**'])('runs on %s', (branch) => {
    const quoted = branch.includes('*') ? `"${branch}"` : branch;
    // Both push and pull_request must list it, hence two occurrences.
    const occurrences = triggerBlock.split(quoted).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('does not let the dependency audit fail silently', () => {
    const auditSteps = workflow.split(/\n(?= {6}- )/).filter((step) => step.includes('pnpm audit'));

    expect(auditSteps.length).toBeGreaterThanOrEqual(2);
    for (const step of auditSteps) {
      expect(step).not.toContain('continue-on-error: true');
    }
  });

  it('still runs the checks the gate exists to enforce', () => {
    for (const command of [
      'pnpm lint',
      'tsc --noEmit',
      'pnpm test',
      'pnpm test:e2e',
      'pnpm build',
    ]) {
      expect(workflow).toContain(command);
    }
  });
});

/**
 * pnpm 10 ignores the `pnpm` key in package.json and reads overrides from
 * pnpm-workspace.yaml instead. Overrides left in the old location are silently
 * dropped, which would quietly reintroduce the advisories they were added to
 * resolve — with no warning at install time in CI.
 */
describe('dependency overrides live where pnpm reads them', () => {
  const repoRoot = join(__dirname, '..', '..');

  it.each([
    ['backend', join(repoRoot, 'backend')],
    ['apps/web', join(repoRoot, 'apps/web')],
  ])('%s declares overrides in pnpm-workspace.yaml, not package.json', (_name, dir) => {
    const workspace = readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8');
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      pnpm?: unknown;
    };

    expect(workspace).toContain('overrides:');
    expect(pkg.pnpm).toBeUndefined();
  });

  it('keeps the abandoned SheetJS parser out of the dependency tree', () => {
    // xlsx@0.18.5 is the last npm release and has prototype-pollution and
    // ReDoS advisories with no patched version on npm. It parsed user-uploaded
    // spreadsheets; XlsxTextExtractor now uses exceljs instead.
    const backendPkg = readFileSync(join(repoRoot, 'backend/package.json'), 'utf8');
    const lock = readFileSync(join(repoRoot, 'backend/pnpm-lock.yaml'), 'utf8');

    expect(backendPkg).not.toMatch(/"xlsx"\s*:/);
    expect(lock).not.toMatch(/\bxlsx@/);
  });
});
